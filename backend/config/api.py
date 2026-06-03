import json
import hmac
import ipaddress
import re
import os
import socket
import urllib.request
from urllib.parse import urlsplit
from datetime import datetime, time, timedelta
from decimal import Decimal
from hashlib import sha1
from io import BytesIO
from xml.sax.saxutils import escape
from zipfile import ZIP_DEFLATED, ZipFile

from django.contrib.auth import authenticate, get_user_model, login as auth_login, logout as auth_logout, update_session_auth_hash
from django.conf import settings
from django.core.exceptions import BadRequest
from django.core.files.base import ContentFile
from django.core.management import call_command
from django.db import transaction
from django.db.models import Q, Sum
from django.http import FileResponse, Http404, HttpResponse, JsonResponse
from django.urls import reverse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt, ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_http_methods

from apps.accounts.models import CRMSettings, UserProfile
from apps.audit.models import AuditLog
from apps.calendar_app.models import CalendarEvent
from apps.cases.demo_data import clear_demo_business_data, demo_data_counts
from apps.cases.models import Case, CaseDocument, CaseMember
from apps.clients.models import Client, ClientCommunication
from apps.communications.models import AutomationRule, Campaign, MessageDelivery, MessageTemplate
from apps.communications.providers import provider_status_payload, send_delivery_with_provider, test_provider_channel
from apps.finance.models import Expense, Invoice, Payment, Salary
from apps.tasks.models import Task


def json_response(payload, status=200):
    # CORS headers are applied centrally by ApiCorsMiddleware (origin allow-list).
    return JsonResponse(payload, status=status)


def empty_response(status=204):
    return HttpResponse(status=status)


def file_response(response):
    response["Access-Control-Allow-Origin"] = "*"
    response["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    response["Access-Control-Allow-Headers"] = "Content-Type"
    response["Access-Control-Allow-Credentials"] = "true"
    return response


def parse_body(request):
    if not request.body:
        return {}
    try:
        data = json.loads(request.body.decode("utf-8"))
    except (ValueError, UnicodeDecodeError) as exc:
        raise BadRequest("Невірний формат запиту: очікується коректний JSON.") from exc
    if not isinstance(data, dict):
        raise BadRequest("Тіло запиту має бути JSON-об'єктом.")
    return data


def is_safe_fetch_url(url):
    """Block SSRF: only http(s) to public hosts. Rejects file://, localhost,
    link-local metadata (169.254.x), and private/reserved ranges."""
    try:
        parts = urlsplit(str(url or ""))
    except ValueError:
        return False
    if parts.scheme not in ("http", "https") or not parts.hostname:
        return False
    try:
        port = parts.port or (443 if parts.scheme == "https" else 80)
        infos = socket.getaddrinfo(parts.hostname, port, proto=socket.IPPROTO_TCP)
    except (socket.gaierror, ValueError):
        return False
    for info in infos:
        try:
            ip = ipaddress.ip_address(info[4][0])
        except ValueError:
            return False
        if (ip.is_private or ip.is_loopback or ip.is_link_local
                or ip.is_reserved or ip.is_multicast or ip.is_unspecified):
            return False
    return True


def clean_string_map(source, defaults, max_lengths=None):
    payload = source if isinstance(source, dict) else {}
    max_lengths = max_lengths or {}
    return {
        key: str(payload.get(key, defaults[key]) or "").strip()[:max_lengths.get(key, 255)]
        for key in defaults
    }


def clean_bool_map(source, defaults):
    payload = source if isinstance(source, dict) else {}
    return {
        key: bool(payload.get(key, defaults[key]))
        for key in defaults
    }


def clean_nested_string_map(source, defaults):
    payload = source if isinstance(source, dict) else {}
    result = {}
    for group, fields in defaults.items():
        values = payload.get(group) if isinstance(payload.get(group), dict) else {}
        result[group] = {
            key: str(values.get(key, default) or "").strip()[:500]
            for key, default in fields.items()
        }
    return result


def parse_date(value):
    if not value or value == "-":
        return None
    value = str(value).strip()
    for fmt in ("%Y-%m-%d", "%d.%m.%Y"):
        try:
            return datetime.strptime(value[:10], fmt).date()
        except ValueError:
            continue
    return None


def decimal_value(value):
    try:
        return abs(Decimal(str(value or 0)))
    except (TypeError, ValueError):
        return Decimal("0")


def parse_datetime(value, fallback_time="09:00"):
    if not value or value == "-":
        return None
    value = str(value).strip().replace("T", " ")
    for fmt in ("%Y-%m-%d %H:%M", "%d.%m.%Y %H:%M", "%Y-%m-%d", "%d.%m.%Y"):
        try:
            parsed = datetime.strptime(value[:16] if " " in fmt else value[:10], fmt)
            if fmt in ("%Y-%m-%d", "%d.%m.%Y"):
                hour, minute = [int(part) for part in fallback_time.split(":")]
                parsed = datetime.combine(parsed.date(), time(hour, minute))
            return timezone.make_aware(parsed, timezone.get_current_timezone()) if timezone.is_naive(parsed) else parsed
        except ValueError:
            continue
    return None


def username_from_name(name):
    slug = re.sub(r"[^a-zA-Z0-9]+", "_", name or "").strip("_").lower()
    if slug:
        return slug[:120]
    digest = sha1((name or "user").encode("utf-8")).hexdigest()[:10]
    return f"crm_{digest}"


def user_for_name(name):
    if not name:
        return None
    User = get_user_model()
    user, _created = User.objects.get_or_create(username=username_from_name(name), defaults={"first_name": name})
    if not user.first_name:
        user.first_name = name
        user.save(update_fields=["first_name"])
    return user


ROLE_ACCESS = {
    "Адміністратор": ("admin", "Повний доступ"),
    "Адвокат": ("lawyer", "Справи, клієнти, календар"),
    "Помічник": ("assistant", "Задачі та документи"),
    "Бухгалтер": ("accountant", "Фінанси та звіти"),
}

ROLE_PERMISSIONS = {
    "admin": {
        "manage_users",
        "manage_clients",
        "manage_cases",
        "manage_tasks",
        "manage_documents",
        "manage_calendar",
        "manage_mailings",
        "manage_ai",
        "view_planner",
        "view_analytics",
        "view_finance",
        "manage_finance",
        "view_osint",
    },
    "lawyer": {
        "manage_clients",
        "manage_cases",
        "manage_calendar",
    },
    "assistant": {
        "manage_tasks",
        "manage_documents",
        "manage_calendar",
        "view_planner",
        "manage_ai",
    },
    "accountant": {
        "view_finance",
        "manage_finance",
        "view_analytics",
    },
}


PERMISSION_KEYS = (
    "manage_users",
    "manage_clients",
    "manage_cases",
    "manage_tasks",
    "manage_documents",
    "manage_calendar",
    "manage_mailings",
    "manage_ai",
    "view_planner",
    "view_analytics",
    "view_finance",
    "manage_finance",
    "view_osint",
)
ROLE_LABELS = {value: label for label, (value, _access) in ROLE_ACCESS.items()}
CASE_MEMBER_ROLES = {
    "lawyer": CaseMember.Role.LAWYER,
    "assistant": CaseMember.Role.ASSISTANT,
    "accountant": CaseMember.Role.ACCOUNTANT,
    "admin": CaseMember.Role.OBSERVER,
}


def initials_from_name(name):
    parts = [part for part in str(name or "").split() if part]
    return "".join(part[0].upper() for part in parts[:2]) or "К"


def profile_for_user(user):
    profile, _created = UserProfile.objects.get_or_create(
        user=user,
        defaults={
            "role": "assistant",
            "access_scope": ROLE_ACCESS["Помічник"][1],
            "photo_label": initials_from_name(user_name(user)),
        },
    )
    return profile


def iso_datetime(value):
    return value.isoformat() if value else None


def access_status_for_profile(profile):
    if profile.password_temporary:
        return "Пароль тимчасовий"
    if profile.last_login_at:
        return "Активний"
    return "Запрошено"


def serialize_system_user(user):
    profile = profile_for_user(user)
    name = user_name(user)
    role_label = profile.get_role_display()
    permission_keys = sorted(permissions_for_user(user), key=lambda item: PERMISSION_KEYS.index(item) if item in PERMISSION_KEYS else 999)
    assigned_cases = assigned_cases_for_user(user)
    return {
        "id": user.id,
        "name": name,
        "email": user.email,
        "role": role_label,
        "roleKey": profile.role,
        "access": profile.access_scope or ROLE_ACCESS.get(role_label, ("", ""))[1],
        "permissionKeys": permission_keys,
        "permissions": permission_flags(permission_keys),
        "photo": profile.photo_label or initials_from_name(name),
        "active": user.is_active and profile.is_active_member,
        "accessStatus": access_status_for_profile(profile),
        "passwordTemporary": profile.password_temporary,
        "mustChangePassword": profile.password_temporary,
        "passwordUpdatedAt": iso_datetime(profile.password_updated_at),
        "lastLoginAt": iso_datetime(profile.last_login_at),
        "caseScope": "all" if profile.role == "admin" else "assigned",
        "assignedCaseIds": [case.number for case in assigned_cases],
        "assignedCases": [
            {
                "id": case.number,
                "title": case.title,
                "client": case.client.full_name if case.client else "",
            }
            for case in assigned_cases[:8]
        ],
        "assignedCasesCount": assigned_cases.count(),
    }


def upsert_system_user(data, user=None):
    name = data.get("name") or user_name(user) or ""
    email = str(data.get("email") or (user.email if user else "")).strip().lower()
    role_label = data.get("role") or "Помічник"
    role, default_access = ROLE_ACCESS.get(role_label, ROLE_ACCESS["Помічник"])
    access = data.get("access") or default_access
    if not user:
        username = username_from_name(email or name)
        user, _created = get_user_model().objects.get_or_create(
            username=username,
            defaults={"first_name": name, "email": email},
        )
    user.first_name = name
    user.email = email
    user.is_staff = role == "admin"
    user.is_superuser = role == "admin"
    user.is_active = True
    password_changed = bool(data.get("password"))
    if data.get("password"):
        user.set_password(data["password"])
    user.save()
    profile = profile_for_user(user)
    profile.role = role
    profile.access_scope = access
    profile.photo_label = data.get("photo") or initials_from_name(name)
    if "permissionKeys" in data:
        profile.module_permissions = sanitize_permission_keys(data.get("permissionKeys"))
    elif "permissions" in data:
        profile.module_permissions = sanitize_permission_keys([
            key for key, enabled in (data.get("permissions") or {}).items() if enabled
        ])
    elif "role" in data:
        profile.module_permissions = []
    if password_changed:
        profile.password_temporary = bool(data.get("passwordTemporary", data.get("mustChangePassword", True)))
        profile.password_updated_at = timezone.now()
    elif "passwordTemporary" in data or "mustChangePassword" in data:
        profile.password_temporary = bool(data.get("passwordTemporary", data.get("mustChangePassword")))
    profile.is_active_member = True
    profile.save()
    update_user_case_members(user, data)
    return user


def upsert_client(data, client=None):
    client = client or Client()
    client.full_name = data.get("name", client.full_name or "")
    client.client_type = data.get("clientType", client.client_type or "Фізична особа")
    client.phone = data.get("phone", client.phone or "")
    client.email = data.get("email", client.email or "")
    client.address = data.get("address", client.address or "")
    client.telegram_username = data.get("telegramUsername", client.telegram_username or "")
    client.telegram_connected = bool(data.get("telegram", client.telegram_connected))
    client.photo_url = data.get("photoUrl", client.photo_url or "")
    client.show_photo = bool(data.get("showPhoto", client.show_photo))
    client.request_summary = data.get("request", client.request_summary or "")
    client.source = data.get("source", client.source or "")
    client.status = data.get("status", client.status or "Новий")
    client.responsible = user_for_name(data.get("manager")) or client.responsible
    client.consent_to_marketing = bool(data.get("consent", client.status != "Не турбувати"))
    client.risk_level = data.get("risk", client.risk_level or "Середній")
    client.next_action = data.get("nextAction", client.next_action or "")
    client.notes = data.get("notes", client.notes or "")
    client.added_at = parse_date(data.get("added")) or client.added_at or timezone.localdate()
    client.last_contact_at = parse_date(data.get("lastContact")) or timezone.localdate()
    client.save()

    if "communications" in data:
        client.communications.all().delete()
        for row in data.get("communications") or []:
            ClientCommunication.objects.create(
                client=client,
                date=parse_date(row.get("date")),
                channel=row.get("channel", ""),
                title=row.get("title", ""),
                status=row.get("status", ""),
                author=user_for_name(row.get("author") or data.get("manager")),
                case=Case.objects.filter(number=row.get("caseId")).first() if row.get("caseId") else None,
            )
    return client


def upsert_client_communication(data, communication=None, client=None):
    communication = communication or ClientCommunication()
    client = client or Client.objects.filter(pk=data.get("clientId") or communication.client_id).first()
    if not client:
        raise Http404("Client not found")
    communication.client = client
    communication.date = parse_date(data.get("date")) or communication.date or timezone.localdate()
    communication.channel = data.get("channel", communication.channel or "CRM")
    communication.title = data.get("title", communication.title or "")
    communication.status = data.get("status", communication.status or "")
    communication.author = user_for_name(data.get("author") or data.get("manager")) or communication.author
    communication.case = Case.objects.filter(number=data.get("caseId")).first() if data.get("caseId") else communication.case
    communication.save()
    client.last_contact_at = communication.date or timezone.localdate()
    client.save(update_fields=["last_contact_at", "updated_at"])
    return communication


def next_case_number():
    year = timezone.localdate().year
    prefix = f"{year}/"
    values = Case.objects.filter(number__startswith=prefix).values_list("number", flat=True)
    suffixes = []
    for value in values:
        try:
            suffixes.append(int(str(value).split("/", 1)[1]))
        except (IndexError, ValueError):
            continue
    return f"{year}/{max(suffixes, default=1111) + 1}"


def upsert_case(data, case=None):
    case = case or Case()
    if not case.pk:
        case.number = data.get("id") or data.get("number") or next_case_number()

    client = Client.objects.filter(pk=data.get("clientId") or case.client_id).first()
    if not client:
        raise Http404("Client not found")

    case.client = client
    case.title = data.get("title", case.title or "")
    case.practice_area = data.get("type", case.practice_area or "")
    case.stage = data.get("stage", case.stage or "")
    case.status = data.get("status", case.status or "В роботі")
    case.priority = data.get("priority", case.priority or "Середній")
    case.responsible = user_for_name(data.get("responsible")) or case.responsible
    case.court_or_authority = data.get("court", case.court_or_authority or "")
    case.authority_type = data.get("authorityType", case.authority_type or "")
    case.authority_address = data.get("authorityAddress", case.authority_address or "")
    case.authority_contact = data.get("authorityContact", case.authority_contact or "")
    case.authority_email = data.get("authorityEmail", case.authority_email or "")
    case.description = data.get("description", case.description or "")
    case.opened_at = parse_date(data.get("opened")) or case.opened_at or timezone.localdate()
    case.deadline_at = parse_date(data.get("deadline")) or case.deadline_at
    case.income_amount = data.get("income", case.income_amount or 0)
    case.paid_amount = data.get("paid", case.paid_amount or 0)
    case.debt_amount = data.get("debt", case.debt_amount or 0)
    if "firstPaymentDate" in data:
        case.first_payment_at = parse_date(data.get("firstPaymentDate"))
    if "nextPaymentDue" in data:
        case.next_payment_due_at = parse_date(data.get("nextPaymentDue"))
    case.finance_comment = data.get("financeComment", case.finance_comment or "")
    case.history = data.get("history", case.history or [])
    case.procedural_actions = data.get("proceduralActions", case.procedural_actions or [])
    case.document_folders = data.get("folders", case.document_folders or [])
    case.save()
    sync_case_members_from_payload(case, data)
    return case


def upsert_task(data, task=None):
    task = task or Task()
    case = Case.objects.filter(number=data.get("caseId") or (task.case.number if task.case else "")).first()
    if not case:
        raise Http404("Case not found")

    client = Client.objects.filter(pk=data.get("clientId") or case.client_id or task.client_id).first()
    planner_at = parse_datetime(data.get("plannerAt"))
    if not planner_at and data.get("plannerDate"):
        planner_at = parse_datetime(f"{data.get('plannerDate')} {data.get('plannerTime') or '09:00'}")

    task.case = case
    task.client = client or case.client
    task.title = data.get("title", task.title or "")
    task.responsible = user_for_name(data.get("responsible")) or task.responsible
    task.due_at = parse_datetime(data.get("due") or data.get("dueText")) or task.due_at
    task.priority = data.get("priority", task.priority or "Середній")
    task.status = data.get("status", task.status or "Нова")
    task.source = data.get("source", task.source or "manual")
    task.description = data.get("description", task.description or "")
    task.comment = data.get("comment", task.comment or "")
    task.coexecutors = data.get("coexecutors", task.coexecutors or [])
    task.show_in_calendar = bool(data.get("showInCalendar", task.show_in_calendar))
    task.planner_manual = bool(data.get("plannerManual", task.planner_manual))
    task.planner_important = bool(data.get("plannerImportant", task.planner_important))
    task.planner_at = planner_at or task.planner_at
    task.reminder_enabled = bool(data.get("reminderEnabled", task.reminder_enabled))
    task.reminder_before = data.get("reminderBefore", task.reminder_before or "")
    task.reminder_channel = data.get("reminderChannel", task.reminder_channel or "")
    task.subtasks = data.get("subtasks", task.subtasks or [])
    task.comments = data.get("comments", task.comments or [])
    task.history = data.get("history", task.history or [])
    task.save()
    assign_task_case_members(task)
    return task


def upsert_document(data, document=None):
    document = document or CaseDocument()
    case = Case.objects.filter(number=data.get("caseId") or (document.case.number if document.case_id else "")).first()
    if not case:
        raise Http404("Case not found")

    document.case = case
    document.title = data.get("name", document.title or "")
    document.document_type = data.get("type", document.document_type or "Інше")
    document.status = data.get("status", document.status or "Чернетка")
    document.folder = data.get("folder") or document.folder or "Процесуальні документи"
    document.external_url = data.get("url", document.external_url or "")
    document.submitted_at = parse_date(data.get("submitted")) or document.submitted_at
    document.response_due_at = parse_date(data.get("responseDue")) or document.response_due_at
    document.responsible_name = data.get("responsible", document.responsible_name or user_name(case.responsible))
    document.comment = data.get("comment", document.comment or "")
    document.content = data.get("content", document.content or "")
    document.history = data.get("history", document.history or [])
    document.save()
    ensure_case_member(case, user_for_name(document.responsible_name))
    return document


def document_file_token(document):
    raw = f"{document.id}:{document.file.name}:{settings.SECRET_KEY}"
    return sha1(raw.encode("utf-8")).hexdigest()


def document_file_url(request, document):
    if not document.file:
        return ""
    path = reverse("document_file", kwargs={"document_id": document.id})
    signed_path = f"{path}?token={document_file_token(document)}"
    return request.build_absolute_uri(signed_path) if request else signed_path


def document_callback_url(request, document):
    path = reverse("document_onlyoffice_callback", kwargs={"document_id": document.id})
    return request.build_absolute_uri(path) if request else path


def has_valid_document_file_token(request, document):
    token = request.GET.get("token") or ""
    expected = document_file_token(document)
    return bool(token and hmac.compare_digest(token, expected))


def safe_document_upload_name(document, uploaded_name="document.docx"):
    _, ext = os.path.splitext(uploaded_name or "")
    ext = ext.lower() if ext else ".docx"
    if ext not in {".doc", ".docx", ".odt", ".rtf", ".txt", ".pdf", ".xls", ".xlsx", ".png", ".jpg", ".jpeg"}:
        ext = ".docx"
    slug = re.sub(r"[^0-9A-Za-zА-Яа-яІіЇїЄєҐґ_-]+", "-", document.title or "document").strip("-")[:80] or "document"
    return f"{document.id}-{slug}{ext}"


def datetime_from_parts(date_value, time_value, fallback=None):
    if not date_value:
        return fallback
    return parse_datetime(f"{date_value} {time_value or '09:00'}")


def upsert_event(data, event=None):
    event = event or CalendarEvent()
    case = Case.objects.filter(number=data.get("caseId") or (event.case.number if event.case_id else "")).first()
    client = Client.objects.filter(pk=data.get("clientId") or (case.client_id if case else event.client_id)).first()
    if data.get("caseId") and not case:
        raise Http404("Case not found")
    if data.get("clientId") and not client:
        raise Http404("Client not found")

    starts_at = datetime_from_parts(data.get("date"), data.get("time")) or parse_datetime(data.get("startsAt")) or event.starts_at
    ends_at = datetime_from_parts(data.get("date"), data.get("endTime")) or parse_datetime(data.get("endsAt")) or event.ends_at

    event.title = data.get("title", event.title or "")
    event.event_type = data.get("type", event.event_type or "Інше")
    event.starts_at = starts_at or event.starts_at or timezone.now()
    if ends_at and ends_at <= event.starts_at:
        ends_at = event.starts_at + timedelta(hours=1)
    event.ends_at = ends_at
    event.client = client or event.client or (case.client if case else None)
    event.case = case or event.case
    event.authority = data.get("authority", event.authority or "")
    event.location = data.get("location", event.location or "")
    event.responsible = user_for_name(data.get("responsible")) or event.responsible
    event.description = data.get("description", event.description or "")
    event.recurrence = data.get("recurrence", event.recurrence or "")
    reminder_enabled = bool(data.get("reminderEnabled")) if "reminderEnabled" in data else bool(event.reminder_channels)
    if reminder_enabled:
        event.reminder_before = data.get("reminderBefore", event.reminder_before or "За 1 день")
        event.reminder_channels = data.get("reminderChannels", event.reminder_channels or "CRM")
        event.reminder_recipients = data.get("reminderRecipients", event.reminder_recipients or "Відповідальний юрист + клієнт")
    else:
        event.reminder_before = ""
        event.reminder_channels = ""
        event.reminder_recipients = ""
    event.reminder_log = data.get("reminderLog", event.reminder_log or [])
    event.status = data.get("status", event.status or "Заплановано")
    event.procedural_action = bool(data.get("proceduralAction", event.procedural_action))
    event.save()
    ensure_case_member(case, event.responsible)
    return event


def next_invoice_number():
    year = timezone.localdate().year
    prefix = f"INV-{year}-"
    values = Invoice.objects.filter(number__startswith=prefix).values_list("number", flat=True)
    suffixes = []
    for value in values:
        try:
            suffixes.append(int(str(value).rsplit("-", 1)[1]))
        except (IndexError, ValueError):
            continue
    return f"{prefix}{max(suffixes, default=0) + 1:04d}"


def finance_note(title, comment=""):
    return json.dumps({"title": title or "", "comment": comment or ""}, ensure_ascii=False)


def parse_finance_note(value, fallback_title=""):
    try:
        payload = json.loads(value or "{}")
    except json.JSONDecodeError:
        return {"title": value or fallback_title, "comment": value or ""}
    return {
        "title": payload.get("title") or fallback_title,
        "comment": payload.get("comment") or "",
    }


def finance_date_value(value):
    return date_value(value) if value else ""


def serialize_finance_payment(item):
    note = parse_finance_note(item.comment, "Оплата за правову допомогу")
    return {
        "id": f"payment-{item.id}",
        "date": finance_date_value(item.paid_at),
        "type": "Надходження",
        "title": note["title"],
        "caseId": item.case.number if item.case else "",
        "client": item.client.full_name if item.client else "",
        "amount": money(item.amount),
        "status": "Оплачено",
        "method": item.method or "Банківський переказ",
        "comment": note["comment"],
        "custom": True,
    }


def serialize_finance_expense(item):
    return {
        "id": f"expense-{item.id}",
        "date": finance_date_value(item.spent_at),
        "type": "Витрата",
        "title": item.category,
        "caseId": item.case.number if item.case else "",
        "client": item.client.full_name if item.client else "",
        "amount": -money(item.amount),
        "status": "Оплачено",
        "method": "Картка",
        "comment": item.comment,
        "custom": True,
    }


def serialize_salary(item):
    base = money(item.base)
    bonus = money(item.bonus)
    return {
        "id": f"salary-{item.id}",
        "name": item.employee_name,
        "role": item.role or "Співробітник",
        "base": base,
        "bonus": bonus,
        "total": base + bonus,
        "status": item.status or "Готово",
        "date": item.accrued_on.strftime("%d.%m.%Y") if item.accrued_on else "",
        "comment": item.comment or "",
        "custom": True,
    }


def upsert_salary(data, item=None):
    item = item or Salary()
    item.employee_name = data.get("name") or item.employee_name or ""
    item.role = data.get("role") or item.role or ""
    item.base = decimal_value(data.get("base"))
    item.bonus = decimal_value(data.get("bonus"))
    item.status = data.get("status") or "Готово"
    item.accrued_on = parse_date(data.get("date")) or item.accrued_on or timezone.localdate()
    item.comment = data.get("comment") or ""
    item.save()
    return item


def salary_pk_from_id(salary_id):
    return str(salary_id).split("salary-", 1)[-1]


def finance_document_links_invoice(document, invoice_number):
    needle = str(invoice_number or "").strip()
    if not needle:
        return False
    haystack = " ".join([
        document.title or "",
        document.comment or "",
        " ".join(str(row.get("text", "")) for row in (document.history or []) if isinstance(row, dict)),
    ])
    if needle in haystack:
        return True
    return any(
        isinstance(row, dict) and str(row.get("invoiceNumber") or row.get("financeLinkNumber") or "").strip() == needle
        for row in (document.history or [])
    )


def finance_invoice_documents(invoice):
    documents = CaseDocument.objects.filter(
        case=invoice.case,
        document_type="Рахунок",
        folder="Фінансові документи",
    ).order_by("-id")
    return [document for document in documents if finance_document_links_invoice(document, invoice.number)]


def invoice_number_from_finance_document(document):
    for row in document.history or []:
        if isinstance(row, dict):
            marker = str(row.get("invoiceNumber") or row.get("financeLinkNumber") or "").strip()
            if marker:
                return marker
    for source in (document.comment or "", document.title or ""):
        match = re.search(r"Номер рахунку:\s*([^\n]+)", source)
        if match:
            return match.group(1).strip()
    return ""


def serialize_finance_invoice(item):
    documents = finance_invoice_documents(item)
    document = documents[0] if documents else None
    return {
        "id": f"invoice-{item.id}",
        "date": finance_date_value(item.issued_at),
        "type": "Рахунок",
        "title": item.number,
        "caseId": item.case.number if item.case else "",
        "client": item.client.full_name if item.client else "",
        "amount": money(item.amount),
        "status": item.status or "Очікується",
        "method": "Документ",
        "custom": True,
        "documentId": document.id if document else "",
    }


def serialize_finance_act(document):
    return {
        "id": f"document-{document.id}",
        "documentId": document.id,
        "date": finance_date_value(document.submitted_at),
        "type": "Акт",
        "title": document.title,
        "caseId": document.case.number if document.case else "",
        "client": document.case.client.full_name if document.case and document.case.client else "",
        "amount": 0,
        "status": document.status or "Чернетка",
        "method": "Документ",
        "comment": document.comment,
        "custom": True,
    }


def finance_cases_scope(request):
    user = current_demo_user(request)
    return None if user_can_see_all_cases(user) else accessible_case_queryset(request)


def scoped_case_queryset(queryset, cases_queryset):
    return queryset if cases_queryset is None else queryset.filter(case__in=cases_queryset)


def finance_operations_payload(cases_queryset=None):
    payments = [
        serialize_finance_payment(item)
        for item in scoped_case_queryset(Payment.objects.select_related("case", "client"), cases_queryset)
    ]
    expenses = [
        serialize_finance_expense(item)
        for item in scoped_case_queryset(Expense.objects.select_related("case", "client"), cases_queryset)
    ]
    invoices = [
        serialize_finance_invoice(item)
        for item in scoped_case_queryset(Invoice.objects.select_related("case", "client"), cases_queryset)
    ]
    acts = [
        serialize_finance_act(item)
        for item in scoped_case_queryset(
            CaseDocument.objects.select_related("case", "case__client").filter(document_type="Акт", folder="Фінансові документи"),
            cases_queryset,
        )
    ]
    return sorted(
        [*payments, *expenses, *invoices, *acts],
        key=lambda item: parse_date(item.get("date")) or timezone.localdate(),
        reverse=True,
    )


def recalculate_case_debt(case):
    case.debt_amount = max(case.income_amount - case.paid_amount, 0)
    case.save(update_fields=["income_amount", "paid_amount", "debt_amount", "finance_comment", "history"])


def docx_text(value):
    return escape(str(value or ""))


def money_label(value):
    return f"{money(value):,.0f}".replace(",", " ")


def docx_run(text, bold=False, size=22):
    props = f"<w:rPr>{'<w:b/>' if bold else ''}<w:sz w:val=\"{size}\"/></w:rPr>"
    return f"<w:r>{props}<w:t>{docx_text(text)}</w:t></w:r>"


def docx_paragraph(text="", bold=False, size=22, align="left", spacing_after=120):
    return (
        "<w:p>"
        f"<w:pPr><w:jc w:val=\"{align}\"/><w:spacing w:after=\"{spacing_after}\"/></w:pPr>"
        f"{docx_run(text, bold=bold, size=size)}"
        "</w:p>"
    )


def docx_paragraphs(text="", bold=False, size=22, align="left", spacing_after=120):
    lines = str(text or "").splitlines() or [""]
    return "".join(docx_paragraph(line, bold=bold, size=size, align=align, spacing_after=spacing_after) for line in lines)


def docx_cell(text="", bold=False, width=2400, shading="", align="left"):
    shade = f'<w:shd w:fill="{shading}"/>' if shading else ""
    return (
        "<w:tc>"
        f"<w:tcPr><w:tcW w:w=\"{width}\" w:type=\"dxa\"/>{shade}</w:tcPr>"
        f"{docx_paragraph(text, bold=bold, align=align, spacing_after=0)}"
        "</w:tc>"
    )


def docx_table(rows, header=True, widths=None, aligns=None):
    body = []
    for index, row in enumerate(rows):
        shading = "EAF4FF" if header and index == 0 else ""
        cells = []
        for cell_index, cell in enumerate(row):
            width = widths[cell_index] if widths and cell_index < len(widths) else 2400
            align = aligns[cell_index] if aligns and cell_index < len(aligns) else "left"
            cells.append(docx_cell(cell, bold=header and index == 0, width=width, shading=shading, align=align))
        body.append("<w:tr>" + "".join(cells) + "</w:tr>")
    return (
        "<w:tbl>"
        '<w:tblPr><w:tblW w:w="0" w:type="auto"/>'
        '<w:tblBorders><w:top w:val="single" w:sz="6" w:color="CBD8E6"/>'
        '<w:left w:val="single" w:sz="6" w:color="CBD8E6"/>'
        '<w:bottom w:val="single" w:sz="6" w:color="CBD8E6"/>'
        '<w:right w:val="single" w:sz="6" w:color="CBD8E6"/>'
        '<w:insideH w:val="single" w:sz="6" w:color="CBD8E6"/>'
        '<w:insideV w:val="single" w:sz="6" w:color="CBD8E6"/></w:tblBorders></w:tblPr>'
        + "".join(body)
        + "</w:tbl>"
    )


def finance_bureau_details():
    try:
        bureau = serialize_crm_settings()["bureau"]
    except Exception:
        bureau = CRMSettings.DEFAULT_BUREAU
    name = bureau.get("name") or CRMSettings.DEFAULT_BUREAU["name"]
    return {
        "name": name,
        "email": bureau.get("email") or CRMSettings.DEFAULT_BUREAU["email"],
        "phone": bureau.get("phone") or CRMSettings.DEFAULT_BUREAU["phone"],
        "address": bureau.get("address") or CRMSettings.DEFAULT_BUREAU["address"],
        "website": bureau.get("website") or CRMSettings.DEFAULT_BUREAU["website"],
        "signature": f"{name}\n{bureau.get('phone') or CRMSettings.DEFAULT_BUREAU['phone']}\n{bureau.get('email') or CRMSettings.DEFAULT_BUREAU['email']}",
    }


def docx_bytes(elements):
    body = "".join(elements)
    document_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        f"<w:body>{body}<w:sectPr><w:pgSz w:w=\"11906\" w:h=\"16838\"/>"
        '<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body>'
        "</w:document>"
    )
    buffer = BytesIO()
    with ZipFile(buffer, "w", ZIP_DEFLATED) as archive:
        archive.writestr(
            "[Content_Types].xml",
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            '<Default Extension="xml" ContentType="application/xml"/>'
            '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
            "</Types>",
        )
        archive.writestr(
            "_rels/.rels",
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
            "</Relationships>",
        )
        archive.writestr("word/document.xml", document_xml)
    return buffer.getvalue()


def finance_document_elements(case, document_type, title, amount, date, comment, document_number="", document_due=None, work_period="", template="Основний шаблон"):
    client_name = case.client.full_name if case.client else "Клієнт не вказаний"
    client_phone = case.client.phone if case.client else ""
    client_email = case.client.email if case.client else ""
    bureau = finance_bureau_details()
    template = template or "Основний шаблон"
    amount_text = f"{money_label(amount)} грн"
    doc_number = document_number or f"{document_type.upper()}-{case.number.replace('/', '-')}"
    short = template == "Короткий шаблон"
    detailed = template == "Детальний шаблон"
    service_name = title or ("Правова допомога" if document_type == "Рахунок" else "Юридичні послуги")
    service_rows = [
        ["№", "Послуга", "К-сть", "Ціна", "Сума"],
        ["1", service_name, "1", amount_text, amount_text],
    ]
    party_rows = [
        ["Виконавець", bureau["name"]],
        ["Адреса виконавця", bureau["address"]],
        ["Контакти виконавця", f"{bureau['phone']} · {bureau['email']}"],
        ["Замовник", client_name],
        ["Контакти замовника", " · ".join(part for part in [client_phone, client_email] if part) or "не вказано"],
        ["Справа", f"№{case.number} · {case.title}"],
    ]
    if document_type == "Рахунок":
        title_text = "РАХУНОК НА ОПЛАТУ"
        elements = [
            docx_paragraph(bureau["name"], bold=True, size=24, align="center", spacing_after=40),
            docx_paragraph(f"{bureau['address']} · {bureau['phone']} · {bureau['email']}", size=18, align="center", spacing_after=220),
            docx_paragraph(f"{title_text} № {doc_number}", bold=True, size=32, align="center", spacing_after=60),
            docx_paragraph(f"від {date_value(date)}", size=22, align="center", spacing_after=220),
        ]
        if short:
            elements.extend([
                docx_table([
                    ["Клієнт", client_name],
                    ["Справа", f"№{case.number}"],
                    ["Строк оплати", date_value(document_due) if document_due else date_value(date)],
                ], header=False, widths=[2200, 6800]),
                docx_paragraph("", spacing_after=80),
            ])
        else:
            elements.extend([
                docx_table(party_rows, header=False, widths=[2400, 6600]),
                docx_paragraph("", spacing_after=120),
            ])
        elements.extend([
            docx_paragraph(f"Строк оплати: {date_value(document_due) if document_due else date_value(date)}", bold=True),
            docx_table(service_rows, widths=[700, 5000, 900, 1500, 1500], aligns=["center", "left", "center", "right", "right"]),
            docx_paragraph(f"Разом до сплати: {amount_text}", bold=True, size=24, align="right", spacing_after=220),
        ])
        if not short:
            elements.extend([
                docx_paragraph("Призначення платежу", bold=True, size=24),
                docx_paragraph(f"Оплата правової допомоги за справою №{case.number}. Рахунок сформовано CRM та прикріплено до папки «Фінансові документи».", spacing_after=160),
            ])
        if detailed:
            elements.extend([
                docx_paragraph("Умови оплати", bold=True, size=24),
                docx_paragraph("Оплата здійснюється на підставі цього рахунку. Після надходження коштів CRM зменшує поточну заборгованість у фінансах справи."),
                docx_paragraph("Документ можна відкрити та відредагувати в ONLYOFFICE перед надсиланням клієнту.", spacing_after=160),
            ])
        if comment and not short:
            elements.extend([docx_paragraph("Коментар", bold=True, size=24), docx_paragraphs(comment, spacing_after=80)])
    else:
        period = work_period or "період не вказано"
        elements = [
            docx_paragraph(f"АКТ ВИКОНАНИХ РОБІТ № {doc_number}", bold=True, size=32, align="center", spacing_after=60),
            docx_paragraph(f"від {date_value(date)}", size=22, align="center", spacing_after=220),
            docx_table(party_rows, header=False, widths=[2400, 6600]),
            docx_paragraph("", spacing_after=120),
            docx_paragraph(f"Період виконання робіт: {period}", bold=True),
            docx_table(service_rows, widths=[700, 5000, 900, 1500, 1500], aligns=["center", "left", "center", "right", "right"]),
            docx_paragraph(f"Загальна вартість послуг: {amount_text}", bold=True, size=24, align="right", spacing_after=160),
            docx_paragraph("Сторони підтверджують, що послуги надані належним чином, у погодженому обсязі та прийняті Замовником.", spacing_after=160),
        ]
        if detailed:
            elements.extend([
                docx_paragraph("Зміст виконаних робіт", bold=True, size=24),
                docx_paragraph(f"Юридичний супровід у справі №{case.number}: консультації, підготовка процесуальних матеріалів, аналіз документів та комунікація зі сторонами.", spacing_after=160),
                docx_paragraph("Зауваження сторін", bold=True, size=24),
                docx_paragraph("На момент підписання цього акта зауваження щодо строків, якості та обсягу наданих послуг відсутні."),
            ])
        if comment and not short:
            elements.extend([docx_paragraph("Коментар", bold=True, size=24), docx_paragraphs(comment, spacing_after=80)])
    elements.extend([
        docx_paragraph("", spacing_after=240),
        docx_table([
            ["Виконавець", "Замовник"],
            ["________________________", "________________________"],
            [bureau["signature"], client_name],
        ], header=False, widths=[4500, 4500]),
    ])
    return elements


def create_finance_document(case, title, document_type, status, amount, date, comment, document_number="", document_due=None, work_period="", template="Основний шаблон", finance_link_number=""):
    link_number = finance_link_number or document_number
    document_marker = f"Номер рахунку: {link_number}" if document_type == "Рахунок" and link_number else ""
    full_comment = "\n".join(part for part in [comment or "", document_marker] if part).strip()
    finance_history = [{
        "date": date_value(timezone.localdate()),
        "kind": "finance_document",
        "documentType": document_type,
        "invoiceNumber": link_number if document_type == "Рахунок" else "",
        "financeLinkNumber": link_number,
        "text": f"Фінансовий документ створено CRM: {document_type}.",
    }]
    document = CaseDocument.objects.create(
        case=case,
        title=f"{document_type}: {title} · №{case.number}.docx",
        document_type=document_type,
        status=status,
        folder="Фінансові документи",
        submitted_at=date,
        comment=f"{full_comment} Сума: {money(amount):,.0f} грн.".strip(),
        history=finance_history,
    )
    content = docx_bytes(
        finance_document_elements(
            case,
            document_type,
            title,
            amount,
            date,
            comment,
            document_number=document_number,
            document_due=document_due,
            work_period=work_period,
            template=template,
        ),
    )
    document.file.save(safe_document_upload_name(document, document.title), ContentFile(content), save=True)
    return document


def create_finance_operation(data):
    case = Case.objects.select_related("client").filter(number=data.get("caseId")).first()
    if not case:
        raise Http404("Case not found")
    action = data.get("action") or ""
    operation_type = data.get("type") or data.get("operationType") or ""
    amount = decimal_value(data.get("amount"))
    date = parse_date(data.get("date")) or timezone.localdate()
    title = data.get("title") or "Фінансова операція"
    status = data.get("status") or "Оплачено"
    method = data.get("method") or "Банківський переказ"
    comment = data.get("comment") or ""
    document_number = data.get("documentNumber") or ""
    document_due = parse_date(data.get("documentDue"))
    work_period = data.get("workPeriod") or ""
    document_template = data.get("documentTemplate") or "Основний шаблон"
    history = case.history or []

    if action == "income" or operation_type == "Надходження":
        payment = Payment.objects.create(
            case=case,
            client=case.client,
            amount=amount,
            paid_at=date,
            method=method,
            comment=finance_note(title, comment),
        )
        # Record the payment honestly: paid grows by the amount, the agreed fee
        # (income) is NOT bumped to absorb it. Overpayment is now possible and
        # debt stops being forced to zero (see recalculate_case_debt).
        case.paid_amount = case.paid_amount + payment.amount
        case.finance_comment = comment or case.finance_comment
        history.insert(0, {"date": date_value(timezone.localdate()), "text": f"Додано надходження: {title} на {money(payment.amount):,.0f} грн."})
        case.history = history
        recalculate_case_debt(case)
        return {"operation": serialize_finance_payment(payment), "case": serialize_case(case)}

    if action == "expense" or operation_type == "Витрата":
        expense = Expense.objects.create(
            case=case,
            client=case.client,
            category=title,
            amount=amount,
            spent_at=date,
            comment=comment,
        )
        history.insert(0, {"date": date_value(timezone.localdate()), "text": f"Додано витрату: {title} на {money(expense.amount):,.0f} грн."})
        case.finance_comment = comment or case.finance_comment
        case.history = history
        case.save(update_fields=["finance_comment", "history"])
        return {"operation": serialize_finance_expense(expense), "case": serialize_case(case)}

    if action == "invoice" or operation_type == "Рахунок":
        invoice = Invoice.objects.create(
            case=case,
            client=case.client,
            number=next_invoice_number(),
            amount=amount,
            issued_at=date,
            due_at=document_due or date,
            status=status,
        )
        document = create_finance_document(
            case,
            title,
            "Рахунок",
            status or "Виставлено",
            amount,
            date,
            comment,
            document_number=document_number or invoice.number,
            document_due=document_due or date,
            template=document_template,
            finance_link_number=invoice.number,
        )
        case.income_amount = case.income_amount + invoice.amount
        case.finance_comment = comment or case.finance_comment
        history.insert(0, {"date": date_value(timezone.localdate()), "text": f"Виставлено рахунок: {invoice.number} на {money(invoice.amount):,.0f} грн."})
        case.history = history
        recalculate_case_debt(case)
        operation_payload = serialize_finance_invoice(invoice)
        operation_payload["documentId"] = document.id
        return {"operation": operation_payload, "document": serialize_document(document), "case": serialize_case(case)}

    if action == "act" or operation_type == "Акт":
        document = create_finance_document(
            case,
            title,
            "Акт",
            status or "Чернетка",
            amount,
            date,
            comment,
            document_number=document_number,
            work_period=work_period,
            template=document_template,
        )
        history.insert(0, {"date": date_value(timezone.localdate()), "text": f"Створено акт: {document.title}."})
        case.finance_comment = comment or case.finance_comment
        case.history = history
        case.save(update_fields=["finance_comment", "history"])
        return {"operation": serialize_finance_act(document), "document": serialize_document(document), "case": serialize_case(case)}

    raise Http404("Unsupported finance operation")


def delete_finance_operation(operation_id):
    prefix, _, raw_id = str(operation_id).partition("-")
    if not raw_id:
        raise Http404("Finance operation not found")
    if prefix == "payment":
        item = Payment.objects.select_related("case").get(pk=raw_id)
        case = item.case
        case.paid_amount = max(case.paid_amount - item.amount, 0)
        item.delete()
        recalculate_case_debt(case)
        return
    if prefix == "expense":
        Expense.objects.get(pk=raw_id).delete()
        return
    if prefix == "invoice":
        item = Invoice.objects.select_related("case").filter(pk=raw_id).first()
        if not item:
            CaseDocument.objects.get(pk=raw_id, document_type="Рахунок", folder="Фінансові документи").delete()
            return
        case = item.case
        for document in finance_invoice_documents(item):
            document.delete()
        # Drop the invoice from the agreed fee without clamping to paid — if that
        # leaves paid > income, recalculate_case_debt surfaces it as overpayment.
        case.income_amount = max(case.income_amount - item.amount, 0)
        item.delete()
        recalculate_case_debt(case)
        return
    if prefix == "document":
        CaseDocument.objects.get(pk=raw_id, document_type="Акт", folder="Фінансові документи").delete()
        return
    raise Http404("Finance operation not found")


def finance_operation_case(operation_id):
    prefix, _, raw_id = str(operation_id).partition("-")
    if not raw_id:
        raise Http404("Finance operation not found")
    if prefix == "payment":
        return Payment.objects.select_related("case").get(pk=raw_id).case
    if prefix == "expense":
        return Expense.objects.select_related("case").get(pk=raw_id).case
    if prefix == "invoice":
        try:
            return Invoice.objects.select_related("case").get(pk=raw_id).case
        except Invoice.DoesNotExist:
            document = CaseDocument.objects.select_related("case").filter(pk=raw_id, document_type="Рахунок", folder="Фінансові документи").first()
            if document:
                return document.case
            raise
    if prefix == "document":
        return CaseDocument.objects.select_related("case").get(pk=raw_id, document_type="Акт", folder="Фінансові документи").case
    raise Http404("Finance operation not found")


def money(value):
    return float(value or 0)


def date_value(value):
    return value.isoformat() if value else ""


def datetime_value(value):
    return value.isoformat() if value else ""


def user_name(user):
    if not user:
        return ""
    return user.get_full_name() or user.username


def serialize_client(item):
    return {
        "id": item.id,
        "name": item.full_name,
        "clientType": item.client_type,
        "phone": item.phone,
        "email": item.email,
        "address": item.address,
        "telegram": item.telegram_connected,
        "telegramUsername": item.telegram_username,
        "photoUrl": item.photo_url,
        "showPhoto": item.show_photo,
        "request": item.request_summary,
        "status": item.status,
        "source": item.source,
        "manager": user_name(item.responsible),
        "consent": item.consent_to_marketing,
        "risk": item.risk_level,
        "nextAction": item.next_action,
        "notes": item.notes,
        "added": date_value(item.added_at),
        "lastContact": date_value(item.last_contact_at),
        "communications": [serialize_client_communication(row) for row in item.communications.all()],
        "casesCount": item.cases.count(),
    }


def serialize_client_communication(row):
    return {
        "id": row.id,
        "clientId": row.client_id,
        "date": date_value(row.date),
        "channel": row.channel,
        "title": row.title,
        "status": row.status,
        "author": user_name(row.author),
        "caseId": row.case.number if row.case else "",
    }


def serialize_document(item, request=None):
    return {
        "id": item.id,
        "documentId": item.id,
        "caseId": item.case.number if item.case else "",
        "name": item.title,
        "type": item.document_type,
        "folder": item.folder,
        "status": item.status,
        "submitted": date_value(item.submitted_at),
        "responseDue": date_value(item.response_due_at),
        "url": item.external_url,
        "fileUrl": document_file_url(request, item),
        "fileName": os.path.basename(item.file.name) if item.file else "",
        "onlyOfficeCallbackUrl": document_callback_url(request, item),
        "source": document_source_label(item),
        "responsible": item.responsible_name,
        "comment": item.comment,
        "content": item.content,
        "history": item.history,
    }


def document_source_label(item):
    external_url = item.external_url or ""
    haystack = " ".join([
        item.title or "",
        item.comment or "",
        external_url,
        " ".join(str(row.get("text", "")) for row in (item.history or []) if isinstance(row, dict)),
    ]).lower()
    if "docs.google" in external_url or "drive.google" in external_url or "google" in haystack:
        return "Google Docs"
    if "комп" in haystack or "computer" in haystack or "ноутбук" in haystack:
        return "Комп'ютер"
    if item.file:
        return "CRM файл"
    if external_url:
        return "Зовнішнє посилання"
    return "CRM"


def serialize_task(item):
    due_local = timezone.localtime(item.due_at) if item.due_at else None
    planner_local = timezone.localtime(item.planner_at) if item.planner_at else None
    return {
        "id": item.id,
        "title": item.title,
        "caseId": item.case.number if item.case else "",
        "clientId": item.client_id,
        "responsible": user_name(item.responsible),
        "due": datetime_value(due_local),
        "priority": item.priority,
        "status": item.status,
        "source": item.source,
        "description": item.description,
        "comment": item.comment,
        "coexecutors": item.coexecutors,
        "showInCalendar": item.show_in_calendar,
        "plannerManual": item.planner_manual,
        "plannerImportant": item.planner_important,
        "plannerAt": datetime_value(planner_local),
        "reminderEnabled": item.reminder_enabled,
        "reminderBefore": item.reminder_before,
        "reminderChannel": item.reminder_channel,
        "subtasks": item.subtasks,
        "comments": item.comments,
        "history": item.history,
    }


def serialize_case_member(item):
    return {
        "id": item.id,
        "userId": item.user_id,
        "name": user_name(item.user),
        "email": item.user.email,
        "role": item.get_role_display(),
        "roleKey": item.role,
        "canEdit": item.can_edit,
        "photo": profile_for_user(item.user).photo_label or initials_from_name(user_name(item.user)),
    }


def serialize_case(item, include_finance=True):
    finance_payload = {
        "income": money(item.income_amount),
        "paid": money(item.paid_amount),
        "debt": money(item.debt_amount),
        "overpaid": max(money(item.paid_amount) - money(item.income_amount), 0),
        "firstPaymentDate": date_value(item.first_payment_at),
        "nextPaymentDue": date_value(item.next_payment_due_at),
        "financeComment": item.finance_comment,
    } if include_finance else {
        "income": 0,
        "paid": 0,
        "debt": 0,
        "overpaid": 0,
        "firstPaymentDate": "",
        "nextPaymentDue": "",
        "financeComment": "",
    }
    return {
        "id": item.number,
        "clientId": item.client_id,
        "client": item.client.full_name,
        "title": item.title,
        "type": item.practice_area,
        "stage": item.stage,
        "status": item.status,
        "priority": item.priority,
        "responsible": user_name(item.responsible),
        "court": item.court_or_authority,
        "authorityType": item.authority_type,
        "authorityAddress": item.authority_address,
        "authorityContact": item.authority_contact,
        "authorityEmail": item.authority_email,
        "opened": date_value(item.opened_at),
        "deadline": date_value(item.deadline_at),
        **finance_payload,
        "description": item.description,
        "history": item.history,
        "proceduralActions": item.procedural_actions or [],
        "folders": item.document_folders or [],
        "teamMembers": [serialize_case_member(member) for member in item.team_members.select_related("user", "user__crm_profile").all()],
        "documents": [serialize_document(document) for document in item.documents.all()],
        "tasks": [serialize_task(task) for task in item.tasks.all()],
        "documentsCount": item.documents.count(),
        "tasksCount": item.tasks.count(),
        "eventsCount": item.events.count(),
    }


def serialize_event(item):
    starts_local = timezone.localtime(item.starts_at) if item.starts_at else None
    ends_local = timezone.localtime(item.ends_at) if item.ends_at else None
    return {
        "id": item.id,
        "title": item.title,
        "type": item.event_type,
        "date": date_value(starts_local.date()) if starts_local else "",
        "time": starts_local.strftime("%H:%M") if starts_local else "",
        "endTime": ends_local.strftime("%H:%M") if ends_local else "",
        "startsAt": datetime_value(item.starts_at),
        "endsAt": datetime_value(item.ends_at),
        "clientId": item.client_id,
        "caseId": item.case.number if item.case else "",
        "authority": item.authority,
        "location": item.location,
        "responsible": user_name(item.responsible),
        "description": item.description,
        "recurrence": item.recurrence,
        "reminderEnabled": bool(item.reminder_channels),
        "reminderBefore": item.reminder_before,
        "reminderChannels": item.reminder_channels,
        "reminderRecipients": item.reminder_recipients,
        "reminderLog": item.reminder_log,
        "proceduralAction": item.procedural_action,
        "status": item.status,
    }


def finance_summary_payload(cases_queryset=None):
    cases = cases_queryset if cases_queryset is not None else Case.objects.all()
    documents = CaseDocument.objects if cases_queryset is None else CaseDocument.objects.filter(case__in=cases_queryset)
    tasks = Task.objects if cases_queryset is None else Task.objects.filter(case__in=cases_queryset)
    totals = cases.aggregate(
        income=Sum("income_amount"),
        paid=Sum("paid_amount"),
        debt=Sum("debt_amount"),
    )
    return {
        "income": money(totals["income"]),
        "paid": money(totals["paid"]),
        "debt": money(totals["debt"]),
        "activeCases": cases.exclude(status__in=["Закрито", "Завершено", "Архів"]).count(),
        "documents": documents.count(),
        "tasks": tasks.count(),
    }


def empty_finance_summary_payload():
    return {
        "income": 0,
        "paid": 0,
        "debt": 0,
        "activeCases": 0,
        "documents": 0,
        "tasks": 0,
    }


def demo_data_status_payload():
    counts = demo_data_counts()
    return {
        "enabled": any(counts.values()),
        "counts": counts,
        "total": sum(counts.values()),
    }


def crm_settings_instance():
    settings, _created = CRMSettings.objects.get_or_create(key="global")
    return settings


def serialize_crm_settings(settings=None):
    settings = settings or crm_settings_instance()
    return {
        "bureau": clean_string_map(settings.bureau, CRMSettings.DEFAULT_BUREAU, {"logo": 200000}),
        "integrations": clean_bool_map(settings.integrations, CRMSettings.DEFAULT_INTEGRATIONS),
        "integrationSettings": clean_nested_string_map(settings.integration_settings, CRMSettings.DEFAULT_INTEGRATION_SETTINGS),
        "notifications": clean_bool_map(settings.notifications, CRMSettings.DEFAULT_NOTIFICATIONS),
        "documentArchiveFolders": settings.document_archive_folders or [],
    }


def mailing_provider_status_payload():
    settings = serialize_crm_settings()
    return {
        "provider": "mock",
        "channels": provider_status_payload(settings["integrations"], settings["integrationSettings"]),
    }


def apply_crm_settings_payload(settings, payload):
    settings.bureau = clean_string_map(payload.get("bureau"), CRMSettings.DEFAULT_BUREAU, {"logo": 200000})
    settings.integrations = clean_bool_map(payload.get("integrations"), CRMSettings.DEFAULT_INTEGRATIONS)
    settings.integration_settings = clean_nested_string_map(payload.get("integrationSettings"), CRMSettings.DEFAULT_INTEGRATION_SETTINGS)
    settings.notifications = clean_bool_map(payload.get("notifications"), CRMSettings.DEFAULT_NOTIFICATIONS)
    settings.save(update_fields=["bureau", "integrations", "integration_settings", "notifications", "updated_at"])
    return settings


MAILING_CHANNELS = ("Telegram", "SMS", "Email")
DEFAULT_AUTOMATION_RULES = (
    {
        "title": "Напоминание за день до события",
        "description": "Автоматически отправлять клиенту напоминание за 24 часа до события в календаре.",
        "channel": "Telegram",
        "enabled": True,
    },
    {
        "title": "Поздравление с днём рождения",
        "description": "Отправлять персональное поздравление клиентам с заполненной датой рождения.",
        "channel": "SMS",
        "enabled": False,
    },
    {
        "title": "Пропускать отписанных клиентов",
        "description": "Исключать клиентов без согласия на информационные сообщения из любых рассылок.",
        "channel": "Все каналы",
        "enabled": True,
    },
)
MAILING_STATUS_LABELS = {
    Campaign.Status.DRAFT: "Готова к отправке",
    Campaign.Status.PLANNED: "Запланирована",
    Campaign.Status.SENDING: "Відправляється",
    Campaign.Status.SENT: "Відправлено",
    Campaign.Status.PARTIAL: "Частично отправлено",
    Campaign.Status.ERROR: "Помилка",
    Campaign.Status.CANCELLED: "Скасована",
}


def mailing_channels_payload(value):
    if isinstance(value, dict):
        return {channel: bool(value.get(channel)) for channel in MAILING_CHANNELS}
    if isinstance(value, list):
        selected = set(value)
        return {channel: channel in selected for channel in MAILING_CHANNELS}
    return {channel: False for channel in MAILING_CHANNELS}


def mailing_status_from_label(label, send_mode="now"):
    label = str(label or "").strip()
    if label == "Запланирована" or send_mode == "later":
        return Campaign.Status.PLANNED
    if label in ("Тест отправлен", "Відправлено", "Отправлено"):
        return Campaign.Status.SENT
    if label in ("Помилка", "Ошибка"):
        return Campaign.Status.ERROR
    return Campaign.Status.DRAFT


def scheduled_at_from_payload(data):
    if data.get("sendMode") != "later":
        return None
    if data.get("scheduleDate"):
        return parse_datetime(f"{data.get('scheduleDate')} {data.get('scheduleTime') or '09:00'}")
    return parse_datetime(data.get("scheduledAt"))


def serialize_mailing_template(item):
    return {
        "id": item.id,
        "title": item.title,
        "type": item.category,
        "text": item.body,
        "createdAt": datetime_value(item.created_at),
    }


def upsert_mailing_template(data, item=None):
    item = item or MessageTemplate()
    item.title = str(data.get("title") or item.title or "Шаблон розсилки").strip()[:255]
    item.category = str(data.get("type") or data.get("category") or item.category or "Telegram").strip()[:128]
    item.body = str(data.get("text") or data.get("body") or item.body or "").strip()
    item.save()
    return item


def campaign_channels_record(data):
    channels = mailing_channels_payload(data.get("channels"))
    return {
        **channels,
        "__meta": str(data.get("meta") or "").strip()[:500],
        "__statusLabel": str(data.get("status") or "").strip()[:128],
        "__sendMode": str(data.get("sendMode") or "now").strip()[:32],
        "__scheduleDate": str(data.get("scheduleDate") or "").strip()[:32],
        "__scheduleTime": str(data.get("scheduleTime") or "").strip()[:16],
        "__recipientMode": str(data.get("recipientMode") or "segment").strip()[:32],
        "__manualClientIds": [int(client_id) for client_id in data.get("manualClientIds") or [] if str(client_id).isdigit()],
        "__filters": [str(value)[:255] for value in data.get("filters") or []],
        "__recipientCount": int(data.get("recipientCount") or 0),
    }


def campaign_status_label(item):
    channels = item.channels if isinstance(item.channels, dict) else {}
    return channels.get("__statusLabel") or MAILING_STATUS_LABELS.get(item.status, item.get_status_display())


def campaign_meta(item):
    channels = item.channels if isinstance(item.channels, dict) else {}
    if channels.get("__meta"):
        return channels["__meta"]
    enabled_channels = [name for name, enabled in mailing_channels_payload(item.channels).items() if enabled]
    scheduled = item.scheduled_at.strftime("%d.%m.%Y %H:%M") if item.scheduled_at else "сейчас"
    return f"{' + '.join(enabled_channels) or 'Каналы не выбраны'} · {scheduled}"


DELIVERY_STATUS_LABELS = {
    "pending": "Ожидает",
    "queued": "В очереди",
    "sent": "Отправлено",
    "delivered": "Доставлено",
    "error": "Ошибка",
}


def serialize_message_delivery(item):
    return {
        "id": item.id,
        "clientId": item.client_id,
        "client": item.client.full_name if item.client else "",
        "channel": item.channel,
        "status": item.status,
        "statusLabel": DELIVERY_STATUS_LABELS.get(item.status, item.status),
        "error": item.error,
        "provider": (item.campaign.channels if isinstance(item.campaign.channels, dict) else {}).get("__provider", "mock"),
        "sentAt": datetime_value(item.sent_at),
        "deliveredAt": datetime_value(item.delivered_at),
    }


def campaign_delivery_stats(item):
    stats = {
        "total": 0,
        "pending": 0,
        "queued": 0,
        "sent": 0,
        "delivered": 0,
        "error": 0,
        "byChannel": {channel: 0 for channel in MAILING_CHANNELS},
    }
    for delivery in MessageDelivery.objects.filter(campaign=item):
        stats["total"] += 1
        stats[delivery.status] = stats.get(delivery.status, 0) + 1
        if delivery.channel in stats["byChannel"]:
            stats["byChannel"][delivery.channel] += 1
    return stats


def serialize_mailing_campaign(item):
    channels = item.channels if isinstance(item.channels, dict) else {}
    schedule_date = date_value(item.scheduled_at.date()) if item.scheduled_at else channels.get("__scheduleDate", "")
    schedule_time = item.scheduled_at.strftime("%H:%M") if item.scheduled_at else channels.get("__scheduleTime", "")
    deliveries = list(item.deliveries.select_related("client").order_by("client__full_name", "channel")[:30])
    return {
        "id": item.id,
        "title": item.title,
        "status": campaign_status_label(item),
        "meta": campaign_meta(item),
        "createdAt": datetime_value(item.created_at),
        "text": item.body,
        "channels": mailing_channels_payload(item.channels),
        "sendMode": channels.get("__sendMode") or ("later" if item.scheduled_at else "now"),
        "scheduleDate": schedule_date,
        "scheduleTime": schedule_time,
        "recipientMode": channels.get("__recipientMode") or "segment",
        "manualClientIds": channels.get("__manualClientIds") or [],
        "filters": channels.get("__filters") or [],
        "recipientCount": channels.get("__recipientCount") or campaign_delivery_stats(item)["total"],
        "deliveryStats": campaign_delivery_stats(item),
        "deliveries": [serialize_message_delivery(delivery) for delivery in deliveries],
    }


def ensure_default_automation_rules():
    if AutomationRule.objects.exists():
        return
    for position, rule in enumerate(DEFAULT_AUTOMATION_RULES):
        AutomationRule.objects.create(position=position, is_demo=True, **rule)


def serialize_automation_rule(item):
    return {
        "id": item.id,
        "title": item.title,
        "description": item.description,
        "channel": item.channel,
        "enabled": item.enabled,
        "position": item.position,
    }


def upsert_automation_rule(data, item=None):
    item = item or AutomationRule()
    item.title = str(data.get("title") or item.title or "Правило автоматизації").strip()[:255]
    item.description = str(data.get("description") or item.description or "").strip()
    item.channel = str(data.get("channel") or item.channel or "Telegram").strip()[:64]
    item.enabled = bool(data.get("enabled", item.enabled))
    item.position = int(data.get("position", item.position or 0) or 0)
    item.save()
    return item


def delivery_channel_available(client, channel):
    if channel == "Telegram":
        return client.telegram_connected or bool(client.telegram_username or client.telegram_chat_id)
    if channel == "SMS":
        return bool(client.phone)
    if channel == "Email":
        return bool(client.email)
    return False


def status_values_for_filter(filter_text):
    source = filter_text.casefold()
    values = []
    if "нов" in source:
        values.extend(["new", "Новий", "Новый"])
    if "актив" in source:
        values.extend(["active", "Активний", "Активный"])
    if "пост" in source:
        values.extend(["regular", "Постійний клієнт", "Постоянный"])
    if "не турб" in source:
        values.extend(["do_not_contact", "Не турбувати"])
    return values


def campaign_recipient_queryset(data):
    mode = data.get("recipientMode") or "segment"
    queryset = Client.objects.exclude(status__in=["do_not_contact", "Не турбувати"])
    if mode == "manual":
        ids = [int(client_id) for client_id in data.get("manualClientIds") or [] if str(client_id).isdigit()]
        return queryset.filter(pk__in=ids)
    if mode == "all":
        return queryset
    for filter_text in data.get("filters") or []:
        if "Telegram: Подключен" in filter_text:
            queryset = queryset.filter(telegram_connected=True)
        if "SMS: Доступен" in filter_text:
            queryset = queryset.exclude(phone="")
        if "Email: Заполнен" in filter_text:
            queryset = queryset.exclude(email="")
        if "Есть согласие" in filter_text:
            queryset = queryset.filter(consent_to_marketing=True)
        status_values = status_values_for_filter(filter_text) if "Статус клиента" in filter_text else []
        if status_values:
            queryset = queryset.filter(status__in=status_values)
    return queryset


def sync_campaign_deliveries(item, data):
    if campaign_status_label(item) == "Тест отправлен":
        item.deliveries.all().delete()
        return
    enabled_channels = [channel for channel, enabled in mailing_channels_payload(item.channels).items() if enabled]
    recipients = list(campaign_recipient_queryset(data).order_by("full_name", "id"))
    item.deliveries.all().delete()
    rows = []
    queued_status = "pending" if item.status == Campaign.Status.PLANNED else "queued"
    for client in recipients:
        for channel in enabled_channels:
            available = delivery_channel_available(client, channel)
            rows.append(MessageDelivery(
                campaign=item,
                client=client,
                channel=channel,
                status=queued_status if available else "error",
                error="" if available else "Немає контакту для цього каналу.",
            ))
    if rows:
        MessageDelivery.objects.bulk_create(rows)


def update_message_delivery(data, item):
    status = str(data.get("status") or item.status or "queued").strip()
    if status not in DELIVERY_STATUS_LABELS:
        status = "queued"
    now = timezone.now()
    item.status = status
    item.error = str(data.get("error") or ("Помилка доставки." if status == "error" else "")).strip()[:500]
    if status in ("sent", "delivered") and not item.sent_at:
        item.sent_at = now
    if status == "delivered" and not item.delivered_at:
        item.delivered_at = now
    if status in ("pending", "queued"):
        item.error = ""
        item.sent_at = None
        item.delivered_at = None
    item.save(update_fields=["status", "error", "sent_at", "delivered_at"])
    return item


def refresh_campaign_status_from_deliveries(item):
    stats = campaign_delivery_stats(item)
    channels = item.channels if isinstance(item.channels, dict) else {}
    if stats["total"] and not stats["pending"] and not stats["queued"]:
        if stats["error"]:
            item.status = Campaign.Status.PARTIAL if stats["sent"] or stats["delivered"] else Campaign.Status.ERROR
            channels["__statusLabel"] = "Частично отправлено" if item.status == Campaign.Status.PARTIAL else "Помилка"
        else:
            item.status = Campaign.Status.SENT
            channels["__statusLabel"] = "Відправлено"
    item.channels = channels
    item.save(update_fields=["status", "channels"])
    return item


def send_campaign_deliveries(item):
    now = timezone.now()
    queryset = item.deliveries.filter(status__in=["pending", "queued"]).select_related("client")
    settings = serialize_crm_settings()
    integrations = settings["integrations"]
    integration_settings = settings["integrationSettings"]
    channels = item.channels if isinstance(item.channels, dict) else {}
    channels["__provider"] = "mock"
    item.channels = channels
    item.save(update_fields=["channels"])
    sent_count = 0
    for delivery in queryset:
        result = send_delivery_with_provider(delivery, integrations, integration_settings)
        if not result.ok:
            delivery.status = result.status
            delivery.error = result.error
            delivery.save(update_fields=["status", "error"])
            continue
        delivery.status = result.status
        delivery.error = ""
        delivery.sent_at = now
        delivery.save(update_fields=["status", "error", "sent_at"])
        sent_count += 1
    refresh_campaign_status_from_deliveries(item)
    return sent_count


def upsert_mailing_campaign(data, item=None, author=None):
    item = item or Campaign()
    send_mode = str(data.get("sendMode") or "now")
    status = mailing_status_from_label(data.get("status"), send_mode)
    item.title = str(data.get("title") or item.title or "Розсилка").strip()[:255]
    item.body = str(data.get("text") or data.get("body") or item.body or "").strip()
    item.channels = campaign_channels_record({**data, "status": data.get("status") or MAILING_STATUS_LABELS.get(status)})
    item.author = author or item.author
    item.scheduled_at = scheduled_at_from_payload(data)
    item.status = status
    item.save()
    sync_campaign_deliveries(item, data)
    return item


def mailing_payload():
    ensure_default_automation_rules()
    return {
        "templates": [serialize_mailing_template(item) for item in MessageTemplate.objects.order_by("-created_at", "-id")],
        "campaigns": [serialize_mailing_campaign(item) for item in Campaign.objects.prefetch_related("deliveries__client").order_by("-created_at", "-id")],
        "automationRules": [serialize_automation_rule(item) for item in AutomationRule.objects.order_by("position", "id")],
    }


def clear_crm_business_data():
    clear_demo_business_data()


SNAPSHOT_LIST_KEYS = ("clients", "cases", "events")


def snapshot_list(snapshot, key):
    value = snapshot.get(key)
    return value if isinstance(value, list) else []


def validate_snapshot_payload(snapshot):
    if not isinstance(snapshot, dict):
        return "JSON-копія має бути об'єктом."
    missing = [key for key in SNAPSHOT_LIST_KEYS if not isinstance(snapshot.get(key), list)]
    if missing:
        return f"У копії немає базових розділів: {', '.join(missing)}."
    return ""


def existing_or_none(model, raw_id):
    if raw_id in (None, ""):
        return None
    try:
        return model.objects.filter(pk=int(raw_id)).first()
    except (TypeError, ValueError):
        return None


def mark_as_real(item):
    if item and hasattr(item, "is_demo") and item.is_demo:
        item.is_demo = False
        item.save(update_fields=["is_demo"])


def snapshot_nested_rows(snapshot, top_level_key, nested_key):
    rows = []
    seen = set()
    for item in [*snapshot_list(snapshot, top_level_key), *[
        row
        for case in snapshot_list(snapshot, "cases")
        for row in (case.get(nested_key) if isinstance(case, dict) and isinstance(case.get(nested_key), list) else [])
    ]]:
        if not isinstance(item, dict):
            continue
        marker = item.get("id") or item.get("documentId") or f"{item.get('caseId')}::{item.get('title') or item.get('name')}"
        if marker in seen:
            continue
        seen.add(marker)
        rows.append(item)
    return rows


def import_snapshot_payload(snapshot):
    error = validate_snapshot_payload(snapshot)
    if error:
        return {"error": error}

    summary = {
        "clients": 0,
        "cases": 0,
        "tasks": 0,
        "documents": 0,
        "events": 0,
        "settingsUsers": 0,
        "mailingTemplates": 0,
        "mailingCampaigns": 0,
        "automationRules": 0,
        "settings": 0,
        "skipped": [],
    }
    client_id_map = {}

    with transaction.atomic():
        settings_payload = snapshot.get("settings") if isinstance(snapshot.get("settings"), dict) else {}
        if any(key in snapshot for key in ("bureauSettings", "settingsIntegrations", "settingsIntegrationSettings", "settingsNotifications")) or settings_payload:
            apply_crm_settings_payload(crm_settings_instance(), {
                "bureau": snapshot.get("bureauSettings") or settings_payload.get("bureau") or {},
                "integrations": snapshot.get("settingsIntegrations") or settings_payload.get("integrations") or {},
                "integrationSettings": snapshot.get("settingsIntegrationSettings") or settings_payload.get("integrationSettings") or {},
                "notifications": snapshot.get("settingsNotifications") or settings_payload.get("notifications") or {},
            })
            summary["settings"] = 1

        for data in snapshot_list(snapshot, "clients"):
            if not isinstance(data, dict) or not data.get("name"):
                continue
            client = existing_or_none(Client, data.get("id"))
            if not client and data.get("email"):
                client = Client.objects.filter(email=str(data.get("email")).strip().lower()).first()
            if not client and data.get("phone"):
                client = Client.objects.filter(phone=str(data.get("phone")).strip()).first()
            client = upsert_client(data, client)
            mark_as_real(client)
            client_id_map[str(data.get("id"))] = client.id
            summary["clients"] += 1

        for data in snapshot_list(snapshot, "cases"):
            if not isinstance(data, dict) or not (data.get("id") or data.get("number")):
                continue
            payload = dict(data)
            old_client_id = str(payload.get("clientId") or "")
            if old_client_id in client_id_map:
                payload["clientId"] = client_id_map[old_client_id]
            case = Case.objects.filter(number=payload.get("id") or payload.get("number")).first()
            try:
                case = upsert_case(payload, case)
            except Http404 as exc:
                summary["skipped"].append({"section": "cases", "id": payload.get("id"), "reason": str(exc)})
                continue
            mark_as_real(case)
            summary["cases"] += 1

        for data in snapshot_list(snapshot, "settingsUsers"):
            if not isinstance(data, dict) or not data.get("email"):
                continue
            user = existing_or_none(get_user_model(), data.get("id")) or get_user_model().objects.filter(email=str(data.get("email")).strip().lower()).first()
            upsert_system_user({**data, "password": ""}, user=user)
            summary["settingsUsers"] += 1

        for data in snapshot_nested_rows(snapshot, "tasks", "tasks"):
            if not isinstance(data, dict) or not data.get("caseId") or not data.get("title"):
                continue
            payload = dict(data)
            old_client_id = str(payload.get("clientId") or "")
            if old_client_id in client_id_map:
                payload["clientId"] = client_id_map[old_client_id]
            task = existing_or_none(Task, payload.get("id")) or Task.objects.filter(case__number=payload.get("caseId"), title=payload.get("title")).first()
            try:
                task = upsert_task(payload, task)
            except Http404 as exc:
                summary["skipped"].append({"section": "tasks", "id": payload.get("id"), "reason": str(exc)})
                continue
            mark_as_real(task)
            summary["tasks"] += 1

        for data in snapshot_nested_rows(snapshot, "documents", "documents"):
            if not isinstance(data, dict) or not data.get("caseId") or not data.get("name"):
                continue
            document = existing_or_none(CaseDocument, data.get("documentId") or data.get("id")) or CaseDocument.objects.filter(
                case__number=data.get("caseId"),
                title=data.get("name"),
                folder=data.get("folder") or "Процесуальні документи",
            ).first()
            try:
                document = upsert_document(data, document)
            except Http404 as exc:
                summary["skipped"].append({"section": "documents", "id": data.get("id"), "reason": str(exc)})
                continue
            mark_as_real(document)
            summary["documents"] += 1

        for data in snapshot_list(snapshot, "events"):
            if not isinstance(data, dict) or not data.get("title"):
                continue
            payload = dict(data)
            old_client_id = str(payload.get("clientId") or "")
            if old_client_id in client_id_map:
                payload["clientId"] = client_id_map[old_client_id]
            event = existing_or_none(CalendarEvent, payload.get("id")) or CalendarEvent.objects.filter(
                case__number=payload.get("caseId") or "",
                title=payload.get("title"),
                starts_at=parse_datetime(payload.get("startsAt") or f"{payload.get('date') or ''} {payload.get('time') or '09:00'}"),
            ).first()
            try:
                event = upsert_event(payload, event)
            except Http404 as exc:
                summary["skipped"].append({"section": "events", "id": payload.get("id"), "reason": str(exc)})
                continue
            mark_as_real(event)
            summary["events"] += 1

        mailing = snapshot.get("mailing") if isinstance(snapshot.get("mailing"), dict) else {}
        for data in mailing.get("templates") or []:
            if not isinstance(data, dict):
                continue
            item = existing_or_none(MessageTemplate, data.get("id")) or MessageTemplate.objects.filter(title=data.get("title"), category=data.get("type")).first()
            upsert_mailing_template(data, item)
            summary["mailingTemplates"] += 1
        for data in mailing.get("campaigns") or []:
            if not isinstance(data, dict):
                continue
            item = existing_or_none(Campaign, data.get("id")) or Campaign.objects.filter(title=data.get("title"), body=data.get("text") or data.get("body")).first()
            upsert_mailing_campaign(data, item)
            summary["mailingCampaigns"] += 1
        for data in mailing.get("automationRules") or []:
            if not isinstance(data, dict):
                continue
            item = existing_or_none(AutomationRule, data.get("id")) or AutomationRule.objects.filter(title=data.get("title")).first()
            upsert_automation_rule(data, item)
            summary["automationRules"] += 1

    return {"summary": summary}


def require_demo_admin(request):
    user = current_demo_user(request)
    profile = profile_for_user(user) if user else None
    if not profile or profile.role != "admin":
        return json_response({"error": "Forbidden", "message": "Демо-даними може керувати тільки адміністратор."}, status=403)
    return None


def permissions_for_user(user):
    profile = profile_for_user(user) if user else None
    if profile and profile.module_permissions:
        return set(sanitize_permission_keys(profile.module_permissions))
    return set(ROLE_PERMISSIONS.get(profile.role if profile else "", set()))


def sanitize_permission_keys(keys):
    allowed = set(PERMISSION_KEYS)
    return [key for key in keys or [] if key in allowed]


def permission_flags(keys):
    permissions = set(keys or [])
    return {
        "canManageUsers": "manage_users" in permissions,
        "canManageClients": "manage_clients" in permissions,
        "canManageCases": "manage_cases" in permissions,
        "canManageTasks": "manage_tasks" in permissions,
        "canManageDocuments": "manage_documents" in permissions,
        "canManageCalendar": "manage_calendar" in permissions,
        "canManageMailings": "manage_mailings" in permissions,
        "canUseAi": "manage_ai" in permissions,
        "canViewPlanner": "view_planner" in permissions,
        "canViewAnalytics": "view_analytics" in permissions,
        "canSeeFinance": "view_finance" in permissions,
        "canManageFinance": "manage_finance" in permissions,
        "canUseOsint": "view_osint" in permissions,
    }


def role_for_user(user):
    profile = profile_for_user(user) if user else None
    return profile.role if profile else ""


def user_can_see_all_cases(user):
    return role_for_user(user) == "admin"


def request_permissions(request):
    return permissions_for_user(current_demo_user(request))


def request_can(request, permission):
    return permission in request_permissions(request)


def sanitize_case_payload_for_permissions(request, data):
    if request_can(request, "manage_finance"):
        return data
    sanitized = dict(data)
    for key in ("income", "paid", "debt", "totalFee", "firstPaymentDate", "nextPaymentDue", "financeComment"):
        sanitized.pop(key, None)
    return sanitized


def case_member_role(user):
    return CASE_MEMBER_ROLES.get(role_for_user(user), CaseMember.Role.OBSERVER)


def ensure_case_member(case, user, role=None, is_demo=False):
    if not case or not user:
        return None
    member, _created = CaseMember.objects.update_or_create(
        case=case,
        user=user,
        defaults={
            "role": role or case_member_role(user),
            "can_edit": True,
            "is_demo": is_demo,
        },
    )
    return member


def assigned_cases_for_user(user):
    if not user:
        return Case.objects.none()
    return Case.objects.select_related("client").filter(
        Q(responsible=user) | Q(team_members__user=user)
    ).distinct().order_by("client__full_name", "opened_at", "number")


def update_user_case_members(user, data):
    if not user or "assignedCaseIds" not in data:
        return
    profile = profile_for_user(user)
    if profile.role == "admin":
        CaseMember.objects.filter(user=user).delete()
        return
    selected_numbers = {str(number) for number in data.get("assignedCaseIds") or [] if number}
    CaseMember.objects.filter(user=user).exclude(case__number__in=selected_numbers).delete()
    member_role = CASE_MEMBER_ROLES.get(profile.role, CaseMember.Role.OBSERVER)
    for case in Case.objects.filter(number__in=selected_numbers):
        ensure_case_member(case, user, role=member_role)


def sync_case_members_from_payload(case, data, is_demo=False):
    ensure_case_member(case, case.responsible, is_demo=is_demo)
    for row in data.get("teamMembers") or data.get("members") or []:
        name = row.get("name") if isinstance(row, dict) else row
        user = user_for_name(name)
        ensure_case_member(case, user, role=case_member_role(user), is_demo=is_demo)


def assign_task_case_members(task, is_demo=False):
    ensure_case_member(task.case, task.responsible, is_demo=is_demo)
    for name in task.coexecutors or []:
        ensure_case_member(task.case, user_for_name(name), is_demo=is_demo)


def accessible_case_filter_for_user(user):
    if not user:
        return Q(pk__in=[])
    if user_can_see_all_cases(user):
        return Q()
    name = user_name(user)
    return (
        Q(responsible=user)
        | Q(team_members__user=user)
        | Q(tasks__responsible=user)
        | Q(events__responsible=user)
        | Q(documents__responsible_name=name)
    )


def accessible_case_queryset(request):
    user = current_demo_user(request)
    queryset = Case.objects.all()
    if user_can_see_all_cases(user):
        return queryset
    return queryset.filter(accessible_case_filter_for_user(user)).distinct()


def accessible_client_queryset(request):
    user = current_demo_user(request)
    if user_can_see_all_cases(user):
        return Client.objects.all()
    return Client.objects.filter(
        Q(responsible=user) | Q(cases__in=accessible_case_queryset(request))
    ).distinct()


def accessible_task_queryset(request):
    user = current_demo_user(request)
    if user_can_see_all_cases(user):
        return Task.objects.all()
    return Task.objects.filter(
        Q(case__in=accessible_case_queryset(request)) | Q(responsible=user)
    ).distinct()


def accessible_document_queryset(request):
    user = current_demo_user(request)
    if user_can_see_all_cases(user):
        return CaseDocument.objects.all()
    return CaseDocument.objects.filter(case__in=accessible_case_queryset(request)).distinct()


def accessible_event_queryset(request):
    user = current_demo_user(request)
    if user_can_see_all_cases(user):
        return CalendarEvent.objects.all()
    return CalendarEvent.objects.filter(
        Q(case__in=accessible_case_queryset(request)) | Q(responsible=user)
    ).distinct()


def require_case_access(request, case):
    if not case:
        return json_response({"error": "Forbidden", "message": "Справу не знайдено або немає доступу."}, status=403)
    if accessible_case_queryset(request).filter(pk=case.pk).exists():
        return None
    return json_response({"error": "Forbidden", "message": "Немає доступу до цієї справи."}, status=403)


def case_from_payload(data, fallback=None):
    number = data.get("caseId") or data.get("id") or data.get("number") or (fallback.number if fallback else "")
    return Case.objects.filter(number=number).first() if number else None


def require_permission(request, permission, message="Недостатньо прав для цієї дії."):
    user = current_demo_user(request)
    if permission not in permissions_for_user(user):
        return json_response({"error": "Forbidden", "message": message}, status=403)
    return None


def system_users_queryset():
    User = get_user_model()
    return User.objects.select_related("crm_profile").filter(crm_profile__is_active_member=True, is_active=True).order_by("id")


def current_demo_user(request):
    if request.user.is_authenticated:
        return request.user
    # Secured mode: no anonymous-as-admin fallback. permissions_for_user(None) is empty,
    # so every require_permission/accessible_* check denies anonymous callers.
    if getattr(settings, "CRM_REQUIRE_AUTH", False):
        return None
    User = get_user_model()
    return (
        User.objects.select_related("crm_profile").filter(crm_profile__role="admin", crm_profile__is_active_member=True, is_active=True).order_by("id").first()
        or User.objects.filter(is_active=True).order_by("id").first()
    )


def session_payload(request):
    user = current_demo_user(request)
    profile = profile_for_user(user) if user else None
    permissions = permissions_for_user(user)
    return {
        "authenticated": bool(request.user.is_authenticated),
        "user": serialize_system_user(user) if user else None,
        "permissions": permission_flags(permissions),
        "mustChangePassword": bool(request.user.is_authenticated and profile and profile.password_temporary),
    }


AUDIT_TONES = {
    AuditLog.Action.CREATE: "green",
    AuditLog.Action.UPDATE: "blue",
    AuditLog.Action.DELETE: "red",
    AuditLog.Action.LOGIN: "green",
    AuditLog.Action.LOGOUT: "blue",
    AuditLog.Action.SYSTEM: "amber",
}


def request_ip_address(request):
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if forwarded:
        return forwarded.split(",", 1)[0].strip() or None
    return request.META.get("REMOTE_ADDR") or None


def audit_entity_id(value):
    return str(value or "")[:128]


def audit_entity_label(value):
    return str(value or "")[:255]


def log_crm_action(request, action, entity_type, entity_id="", entity_label="", summary="", metadata=None, actor=None):
    user = actor or current_demo_user(request)
    AuditLog.objects.create(
        actor=user if getattr(user, "pk", None) else None,
        actor_label=user_name(user) if user else "Система",
        action=action,
        entity_type=entity_type,
        entity_id=audit_entity_id(entity_id),
        entity_label=audit_entity_label(entity_label),
        summary=str(summary or "")[:500],
        metadata=metadata or {},
        ip_address=request_ip_address(request),
        user_agent=str(request.META.get("HTTP_USER_AGENT", ""))[:255],
    )


def serialize_audit_log(item):
    return {
        "id": item.id,
        "date": datetime_value(item.created_at),
        "actor": item.actor_label,
        "action": item.action,
        "actionLabel": item.get_action_display(),
        "entityType": item.entity_type,
        "entityId": item.entity_id,
        "entityLabel": item.entity_label,
        "summary": item.summary,
        "tone": AUDIT_TONES.get(item.action, "blue"),
        "metadata": item.metadata,
    }


def recent_audit_logs(limit=30):
    return [serialize_audit_log(item) for item in AuditLog.objects.select_related("actor").all()[:limit]]


@csrf_exempt
@require_http_methods(["POST", "OPTIONS"])
def login_api(request):
    if request.method == "OPTIONS":
        return empty_response()
    data = parse_body(request)
    login_value = str(data.get("email") or data.get("username") or "").strip().lower()
    password = data.get("password") or ""
    User = get_user_model()
    user = (
        User.objects.filter(email__iexact=login_value, is_active=True).first()
        or User.objects.filter(username__iexact=login_value, is_active=True).first()
    )
    authenticated = authenticate(request, username=user.username if user else login_value, password=password)
    if not authenticated:
        return json_response({"error": "Invalid credentials", "message": "Невірний email або пароль."}, status=401)
    auth_login(request, authenticated)
    profile = profile_for_user(authenticated)
    profile.last_login_at = timezone.now()
    profile.save(update_fields=["last_login_at", "updated_at"])
    log_crm_action(
        request,
        AuditLog.Action.LOGIN,
        "user",
        authenticated.id,
        user_name(authenticated),
        f"{user_name(authenticated)} увійшов у CRM.",
        actor=authenticated,
    )
    return json_response(session_payload(request))


@csrf_exempt
@require_http_methods(["POST", "OPTIONS"])
def logout_api(request):
    if request.method == "OPTIONS":
        return empty_response()
    if request.user.is_authenticated:
        log_crm_action(
            request,
            AuditLog.Action.LOGOUT,
            "user",
            request.user.id,
            user_name(request.user),
            f"{user_name(request.user)} вийшов із CRM.",
            actor=request.user,
        )
    auth_logout(request)
    return json_response(session_payload(request))


@require_http_methods(["POST", "OPTIONS"])
def change_password_api(request):
    if request.method == "OPTIONS":
        return empty_response()
    if not request.user.is_authenticated:
        return json_response({"error": "Unauthorized", "message": "Потрібно увійти в систему."}, status=401)
    data = parse_body(request)
    password = str(data.get("password") or "").strip()
    if len(password) < 8:
        return json_response({"error": "Invalid password", "message": "Пароль має містити щонайменше 8 символів."}, status=400)
    request.user.set_password(password)
    request.user.save(update_fields=["password"])
    profile = profile_for_user(request.user)
    now = timezone.now()
    profile.password_temporary = False
    profile.password_updated_at = now
    profile.last_login_at = now
    profile.save(update_fields=["password_temporary", "password_updated_at", "last_login_at", "updated_at"])
    update_session_auth_hash(request, request.user)
    log_crm_action(
        request,
        AuditLog.Action.UPDATE,
        "user",
        request.user.id,
        user_name(request.user),
        f"{user_name(request.user)} змінив пароль доступу.",
        actor=request.user,
    )
    return json_response(session_payload(request))


@require_http_methods(["GET", "POST", "OPTIONS"])
def users_api(request):
    if request.method == "OPTIONS":
        return empty_response()
    if request.method == "POST":
        forbidden = require_permission(request, "manage_users", "Користувачами може керувати тільки адміністратор.")
        if forbidden:
            return forbidden
        user = upsert_system_user(parse_body(request))
        log_crm_action(request, AuditLog.Action.CREATE, "user", user.id, user_name(user), f"Додано користувача {user_name(user)}.")
        return json_response(serialize_system_user(user))
    return json_response({"results": [serialize_system_user(user) for user in system_users_queryset()]})


@require_http_methods(["GET", "PUT", "PATCH", "DELETE", "OPTIONS"])
def user_detail_api(request, user_id):
    if request.method == "OPTIONS":
        return empty_response()
    try:
        user = get_user_model().objects.select_related("crm_profile").get(pk=user_id)
    except get_user_model().DoesNotExist as exc:
        raise Http404("User not found") from exc
    if request.method == "GET":
        return json_response(serialize_system_user(user))
    if request.method == "DELETE":
        forbidden = require_permission(request, "manage_users", "Користувачами може керувати тільки адміністратор.")
        if forbidden:
            return forbidden
        profile = profile_for_user(user)
        profile.is_active_member = False
        profile.save(update_fields=["is_active_member", "updated_at"])
        user.is_active = False
        user.save(update_fields=["is_active"])
        log_crm_action(request, AuditLog.Action.DELETE, "user", user.id, user_name(user), f"Видалено користувача {user_name(user)}.")
        return json_response({"deleted": user_id})
    forbidden = require_permission(request, "manage_users", "Користувачами може керувати тільки адміністратор.")
    if forbidden:
        return forbidden
    updated = upsert_system_user(parse_body(request), user)
    log_crm_action(request, AuditLog.Action.UPDATE, "user", updated.id, user_name(updated), f"Оновлено доступ користувача {user_name(updated)}.")
    return json_response(serialize_system_user(updated))


@require_GET
def session_api(request):
    return json_response(session_payload(request))


@require_http_methods(["GET", "POST", "OPTIONS"])
def clients_api(request):
    if request.method == "OPTIONS":
        return empty_response()
    if request.method == "POST":
        forbidden = require_permission(request, "manage_clients", "Клієнтами можуть керувати адміністратор або адвокат.")
        if forbidden:
            return forbidden
        client = upsert_client(parse_body(request))
        log_crm_action(request, AuditLog.Action.CREATE, "client", client.id, client.full_name, f"Створено клієнта {client.full_name}.")
        return json_response(serialize_client(client))
    items = accessible_client_queryset(request).prefetch_related("communications", "cases").order_by("full_name")
    return json_response({"results": [serialize_client(item) for item in items]})


@require_http_methods(["GET", "PUT", "PATCH", "DELETE", "OPTIONS"])
def client_detail_api(request, client_id):
    if request.method == "OPTIONS":
        return empty_response()
    try:
        client = Client.objects.get(pk=client_id)
    except Client.DoesNotExist as exc:
        raise Http404("Client not found") from exc
    if not accessible_client_queryset(request).filter(pk=client.pk).exists():
        return json_response({"error": "Forbidden", "message": "Немає доступу до цього клієнта."}, status=403)
    if request.method == "GET":
        return json_response(serialize_client(client))
    if request.method == "DELETE":
        forbidden = require_permission(request, "manage_clients", "Клієнтами можуть керувати адміністратор або адвокат.")
        if forbidden:
            return forbidden
        client_name = client.full_name
        case_ids = list(client.cases.values_list("id", flat=True))
        with transaction.atomic():
            Payment.objects.filter(Q(client=client) | Q(case_id__in=case_ids)).delete()
            Invoice.objects.filter(Q(client=client) | Q(case_id__in=case_ids)).delete()
            Expense.objects.filter(Q(client=client) | Q(case_id__in=case_ids)).delete()
            Task.objects.filter(Q(client=client) | Q(case_id__in=case_ids)).delete()
            CalendarEvent.objects.filter(Q(client=client) | Q(case_id__in=case_ids)).delete()
            ClientCommunication.objects.filter(Q(client=client) | Q(case_id__in=case_ids)).delete()
            Case.objects.filter(id__in=case_ids).delete()
            client.delete()
        log_crm_action(request, AuditLog.Action.DELETE, "client", client_id, client_name, f"Видалено клієнта {client_name}.")
        return json_response({"deleted": client_id})
    forbidden = require_permission(request, "manage_clients", "Клієнтами можуть керувати адміністратор або адвокат.")
    if forbidden:
        return forbidden
    updated = upsert_client(parse_body(request), client)
    log_crm_action(request, AuditLog.Action.UPDATE, "client", updated.id, updated.full_name, f"Оновлено клієнта {updated.full_name}.")
    return json_response(serialize_client(updated))


@require_http_methods(["GET", "POST", "OPTIONS"])
def client_communications_api(request, client_id):
    if request.method == "OPTIONS":
        return empty_response()
    try:
        client = Client.objects.get(pk=client_id)
    except Client.DoesNotExist as exc:
        raise Http404("Client not found") from exc
    if not accessible_client_queryset(request).filter(pk=client.pk).exists():
        return json_response({"error": "Forbidden", "message": "Немає доступу до цього клієнта."}, status=403)
    if request.method == "POST":
        forbidden = require_permission(request, "manage_clients", "Комунікації клієнта можуть змінювати адміністратор або адвокат.")
        if forbidden:
            return forbidden
        item = upsert_client_communication({**parse_body(request), "clientId": client.id}, client=client)
        log_crm_action(request, AuditLog.Action.CREATE, "client_communication", item.id, item.title, f"Додано комунікацію з клієнтом {client.full_name}: {item.title}.")
        return json_response(serialize_client_communication(item))
    items = client.communications.select_related("author", "case").order_by("-date", "-id")
    return json_response({"results": [serialize_client_communication(item) for item in items]})


@require_http_methods(["GET", "PUT", "PATCH", "DELETE", "OPTIONS"])
def client_communication_detail_api(request, communication_id):
    if request.method == "OPTIONS":
        return empty_response()
    try:
        item = ClientCommunication.objects.select_related("client", "author", "case").get(pk=communication_id)
    except ClientCommunication.DoesNotExist as exc:
        raise Http404("Client communication not found") from exc
    if item.client_id and not accessible_client_queryset(request).filter(pk=item.client_id).exists():
        return json_response({"error": "Forbidden", "message": "Немає доступу до цієї комунікації."}, status=403)
    if request.method == "GET":
        return json_response(serialize_client_communication(item))
    if request.method == "DELETE":
        forbidden = require_permission(request, "manage_clients", "Комунікації клієнта можуть змінювати адміністратор або адвокат.")
        if forbidden:
            return forbidden
        log_crm_action(request, AuditLog.Action.DELETE, "client_communication", item.id, item.title, f"Видалено комунікацію з клієнтом {item.client.full_name}: {item.title}.")
        item.delete()
        return json_response({"deleted": communication_id})
    forbidden = require_permission(request, "manage_clients", "Комунікації клієнта можуть змінювати адміністратор або адвокат.")
    if forbidden:
        return forbidden
    updated = upsert_client_communication(parse_body(request), item)
    log_crm_action(request, AuditLog.Action.UPDATE, "client_communication", updated.id, updated.title, f"Оновлено комунікацію з клієнтом {updated.client.full_name}: {updated.title}.")
    return json_response(serialize_client_communication(updated))


@require_http_methods(["GET", "POST", "OPTIONS"])
def cases_api(request):
    if request.method == "OPTIONS":
        return empty_response()
    include_finance = request_can(request, "view_finance")
    if request.method == "POST":
        forbidden = require_permission(request, "manage_cases", "Справами можуть керувати адміністратор або адвокат.")
        if forbidden:
            return forbidden
        data = sanitize_case_payload_for_permissions(request, parse_body(request))
        current_user = current_demo_user(request)
        if not user_can_see_all_cases(current_user) and not data.get("responsible"):
            data["responsible"] = user_name(current_user)
        item = upsert_case(data)
        ensure_case_member(item, current_user)
        log_crm_action(request, AuditLog.Action.CREATE, "case", item.number, item.title, f"Створено справу №{item.number}: {item.title}.")
        return json_response(serialize_case(item, include_finance=include_finance))
    items = accessible_case_queryset(request).select_related("client", "responsible").prefetch_related("documents", "tasks", "events", "team_members").order_by("client__full_name", "opened_at")
    return json_response({"results": [serialize_case(item, include_finance=include_finance) for item in items]})


@require_http_methods(["GET", "PUT", "PATCH", "DELETE", "OPTIONS"])
def case_detail_api(request, case_number):
    if request.method == "OPTIONS":
        return empty_response()
    try:
        item = Case.objects.get(number=case_number)
    except Case.DoesNotExist as exc:
        raise Http404("Case not found") from exc
    include_finance = request_can(request, "view_finance")
    forbidden = require_case_access(request, item)
    if forbidden:
        return forbidden
    if request.method == "GET":
        return json_response(serialize_case(item, include_finance=include_finance))
    if request.method == "DELETE":
        forbidden = require_permission(request, "manage_cases", "Справами можуть керувати адміністратор або адвокат.")
        if forbidden:
            return forbidden
        with transaction.atomic():
            Task.objects.filter(case=item).delete()
            CalendarEvent.objects.filter(case=item).delete()
            # Invoice.case / Payment.case are PROTECT — remove them explicitly,
            # otherwise item.delete() raises ProtectedError (500). Expense is SET_NULL
            # but we drop it too so no orphaned finance tail survives the case.
            Payment.objects.filter(case=item).delete()
            Invoice.objects.filter(case=item).delete()
            Expense.objects.filter(case=item).delete()
            log_crm_action(request, AuditLog.Action.DELETE, "case", item.number, item.title, f"Видалено справу №{item.number}: {item.title}.")
            item.delete()
        return json_response({"deleted": case_number})
    forbidden = require_permission(request, "manage_cases", "Справами можуть керувати адміністратор або адвокат.")
    if forbidden:
        return forbidden
    data = sanitize_case_payload_for_permissions(request, parse_body(request))
    updated = upsert_case(data, item)
    log_crm_action(request, AuditLog.Action.UPDATE, "case", updated.number, updated.title, f"Оновлено справу №{updated.number}: {updated.title}.")
    return json_response(serialize_case(updated, include_finance=include_finance))


@require_http_methods(["GET", "POST", "OPTIONS"])
def tasks_api(request):
    if request.method == "OPTIONS":
        return empty_response()
    if request.method == "POST":
        forbidden = require_permission(request, "manage_tasks", "Задачами можуть керувати адміністратор, адвокат або помічник.")
        if forbidden:
            return forbidden
        data = parse_body(request)
        forbidden = require_case_access(request, case_from_payload(data))
        if forbidden:
            return forbidden
        item = upsert_task(data)
        log_crm_action(request, AuditLog.Action.CREATE, "task", item.id, item.title, f"Створено задачу {item.title}.")
        return json_response(serialize_task(item))
    items = accessible_task_queryset(request).select_related("client", "case", "responsible").order_by("due_at", "id")
    return json_response({"results": [serialize_task(item) for item in items]})


@require_http_methods(["GET", "POST", "OPTIONS"])
def documents_api(request):
    if request.method == "OPTIONS":
        return empty_response()
    if request.method == "POST":
        forbidden = require_permission(request, "manage_documents", "Документами можуть керувати адміністратор, адвокат або помічник.")
        if forbidden:
            return forbidden
        data = parse_body(request)
        forbidden = require_case_access(request, case_from_payload(data))
        if forbidden:
            return forbidden
        item = upsert_document(data)
        log_crm_action(request, AuditLog.Action.CREATE, "document", item.id, item.title, f"Створено документ {item.title}.")
        return json_response(serialize_document(item, request))
    items = accessible_document_queryset(request).select_related("case").order_by("case__number", "folder", "title")
    return json_response({"results": [serialize_document(item, request) for item in items]})


@require_http_methods(["GET", "PUT", "PATCH", "DELETE", "OPTIONS"])
def document_detail_api(request, document_id):
    if request.method == "OPTIONS":
        return empty_response()
    try:
        item = CaseDocument.objects.select_related("case").get(pk=document_id)
    except CaseDocument.DoesNotExist as exc:
        raise Http404("Document not found") from exc
    forbidden = require_case_access(request, item.case)
    if forbidden:
        return forbidden
    if request.method == "GET":
        return json_response(serialize_document(item, request))
    if request.method == "DELETE":
        forbidden = require_permission(request, "manage_documents", "Документами можуть керувати адміністратор, адвокат або помічник.")
        if forbidden:
            return forbidden
        if item.document_type == "Рахунок" and item.folder == "Фінансові документи":
            invoice_number = invoice_number_from_finance_document(item)
            if invoice_number:
                Invoice.objects.filter(case=item.case, number=invoice_number).delete()
        log_crm_action(request, AuditLog.Action.DELETE, "document", item.id, item.title, f"Видалено документ {item.title}.")
        item.delete()
        return json_response({"deleted": document_id})
    forbidden = require_permission(request, "manage_documents", "Документами можуть керувати адміністратор, адвокат або помічник.")
    if forbidden:
        return forbidden
    data = parse_body(request)
    forbidden = require_case_access(request, case_from_payload(data, fallback=item.case))
    if forbidden:
        return forbidden
    updated = upsert_document(data, item)
    log_crm_action(request, AuditLog.Action.UPDATE, "document", updated.id, updated.title, f"Оновлено документ {updated.title}.")
    return json_response(serialize_document(updated, request))


@require_http_methods(["GET", "POST", "OPTIONS"])
def document_file_api(request, document_id):
    if request.method == "OPTIONS":
        return empty_response()
    try:
        item = CaseDocument.objects.select_related("case").get(pk=document_id)
    except CaseDocument.DoesNotExist as exc:
        raise Http404("Document not found") from exc
    if request.method == "GET":
        if not has_valid_document_file_token(request, item):
            forbidden = require_case_access(request, item.case)
            if forbidden:
                return forbidden
        if not item.file:
            raise Http404("Document file not found")
        return file_response(FileResponse(item.file.open("rb"), as_attachment=False, filename=os.path.basename(item.file.name)))
    forbidden = require_permission(request, "manage_documents", "Документами можуть керувати адміністратор, адвокат або помічник.")
    if forbidden:
        return forbidden
    forbidden = require_case_access(request, item.case)
    if forbidden:
        return forbidden
    uploaded = request.FILES.get("file")
    if not uploaded:
        return json_response({"error": "No file uploaded"}, status=400)
    item.file.save(safe_document_upload_name(item, uploaded.name), uploaded, save=True)
    history = item.history or []
    history.insert(0, {"date": date_value(timezone.localdate()), "text": f"Завантажено файл документа: {uploaded.name}."})
    item.history = history
    item.save(update_fields=["file", "history"])
    log_crm_action(request, AuditLog.Action.UPDATE, "document", item.id, item.title, f"Завантажено файл документа {item.title}.")
    return json_response(serialize_document(item, request))


@csrf_exempt
@require_http_methods(["POST", "OPTIONS"])
def document_onlyoffice_callback_api(request, document_id):
    if request.method == "OPTIONS":
        return empty_response()
    try:
        item = CaseDocument.objects.select_related("case").get(pk=document_id)
    except CaseDocument.DoesNotExist:
        return json_response({"error": 1}, status=404)
    try:
        payload = parse_body(request)
        status = int(payload.get("status", 0))
        if status in {2, 6} and payload.get("url"):
            if not is_safe_fetch_url(payload["url"]):
                return json_response({"error": 1, "message": "Недопустиме посилання на документ."}, status=400)
            with urllib.request.urlopen(payload["url"], timeout=30) as response:
                content = response.read()
            file_name = safe_document_upload_name(item, f"{item.title}.docx")
            item.file.save(file_name, ContentFile(content), save=False)
            item.status = item.status or "В роботі"
            history = item.history or []
            history.insert(0, {
                "date": date_value(timezone.localdate()),
                "text": "ONLYOFFICE зберіг нову версію документа."
            })
            item.history = history
            item.save()
        return json_response({"error": 0})
    except Exception:
        return json_response({"error": 1}, status=500)


@require_http_methods(["GET", "PUT", "PATCH", "DELETE", "OPTIONS"])
def task_detail_api(request, task_id):
    if request.method == "OPTIONS":
        return empty_response()
    try:
        item = Task.objects.select_related("client", "case", "responsible").get(pk=task_id)
    except Task.DoesNotExist as exc:
        raise Http404("Task not found") from exc
    if not accessible_task_queryset(request).filter(pk=item.pk).exists():
        return json_response({"error": "Forbidden", "message": "Немає доступу до цієї задачі."}, status=403)
    if request.method == "GET":
        return json_response(serialize_task(item))
    if request.method == "DELETE":
        forbidden = require_permission(request, "manage_tasks", "Задачами можуть керувати адміністратор, адвокат або помічник.")
        if forbidden:
            return forbidden
        log_crm_action(request, AuditLog.Action.DELETE, "task", item.id, item.title, f"Видалено задачу {item.title}.")
        item.delete()
        return json_response({"deleted": task_id})
    forbidden = require_permission(request, "manage_tasks", "Задачами можуть керувати адміністратор, адвокат або помічник.")
    if forbidden:
        return forbidden
    data = parse_body(request)
    forbidden = require_case_access(request, case_from_payload(data, fallback=item.case))
    if forbidden:
        return forbidden
    updated = upsert_task(data, item)
    log_crm_action(request, AuditLog.Action.UPDATE, "task", updated.id, updated.title, f"Оновлено задачу {updated.title}.")
    return json_response(serialize_task(updated))


@require_http_methods(["GET", "POST", "OPTIONS"])
def events_api(request):
    if request.method == "OPTIONS":
        return empty_response()
    if request.method == "POST":
        forbidden = require_permission(request, "manage_calendar", "Календарем можуть керувати адміністратор, адвокат або помічник.")
        if forbidden:
            return forbidden
        data = parse_body(request)
        if data.get("caseId"):
            forbidden = require_case_access(request, case_from_payload(data))
            if forbidden:
                return forbidden
        item = upsert_event(data)
        log_crm_action(request, AuditLog.Action.CREATE, "calendar_event", item.id, item.title, f"Створено подію календаря {item.title}.")
        return json_response(serialize_event(item))
    items = accessible_event_queryset(request).select_related("client", "case", "responsible").order_by("starts_at", "id")
    return json_response({"results": [serialize_event(item) for item in items]})


@require_http_methods(["GET", "PUT", "PATCH", "DELETE", "OPTIONS"])
def event_detail_api(request, event_id):
    if request.method == "OPTIONS":
        return empty_response()
    try:
        item = CalendarEvent.objects.select_related("client", "case", "responsible").get(pk=event_id)
    except CalendarEvent.DoesNotExist as exc:
        raise Http404("Event not found") from exc
    if not accessible_event_queryset(request).filter(pk=item.pk).exists():
        return json_response({"error": "Forbidden", "message": "Немає доступу до цієї події."}, status=403)
    if request.method == "GET":
        return json_response(serialize_event(item))
    if request.method == "DELETE":
        forbidden = require_permission(request, "manage_calendar", "Календарем можуть керувати адміністратор, адвокат або помічник.")
        if forbidden:
            return forbidden
        log_crm_action(request, AuditLog.Action.DELETE, "calendar_event", item.id, item.title, f"Видалено подію календаря {item.title}.")
        item.delete()
        return json_response({"deleted": event_id})
    forbidden = require_permission(request, "manage_calendar", "Календарем можуть керувати адміністратор, адвокат або помічник.")
    if forbidden:
        return forbidden
    data = parse_body(request)
    target_case = case_from_payload(data, fallback=item.case) if data.get("caseId") or item.case_id else None
    if target_case:
        forbidden = require_case_access(request, target_case)
        if forbidden:
            return forbidden
    updated = upsert_event(data, item)
    log_crm_action(request, AuditLog.Action.UPDATE, "calendar_event", updated.id, updated.title, f"Оновлено подію календаря {updated.title}.")
    return json_response(serialize_event(updated))


@require_http_methods(["GET", "POST", "OPTIONS"])
def finance_operations_api(request):
    if request.method == "OPTIONS":
        return empty_response()
    if request.method == "POST":
        forbidden = require_permission(request, "manage_finance", "Фінансами можуть керувати адміністратор або бухгалтер.")
        if forbidden:
            return forbidden
        data = parse_body(request)
        forbidden = require_case_access(request, case_from_payload(data))
        if forbidden:
            return forbidden
        result = create_finance_operation(data)
        operation = result.get("operation") or {}
        operation_title = operation.get("title") or "Фінансова операція"
        log_crm_action(
            request,
            AuditLog.Action.CREATE,
            "finance_operation",
            operation.get("id", ""),
            operation_title,
            f"Створено фінансову операцію: {operation_title}.",
        )
        return json_response(result)
    forbidden = require_permission(request, "view_finance", "Фінанси доступні адміністратору або бухгалтеру.")
    if forbidden:
        return forbidden
    return json_response({"results": finance_operations_payload(finance_cases_scope(request))})


@require_http_methods(["DELETE", "OPTIONS"])
def finance_operation_detail_api(request, operation_id):
    if request.method == "OPTIONS":
        return empty_response()
    forbidden = require_permission(request, "manage_finance", "Фінансами можуть керувати адміністратор або бухгалтер.")
    if forbidden:
        return forbidden
    try:
        operation_case = finance_operation_case(operation_id)
        if operation_case:
            forbidden = require_case_access(request, operation_case)
            if forbidden:
                return forbidden
        elif not user_can_see_all_cases(current_demo_user(request)):
            return json_response({"error": "Forbidden", "message": "Немає доступу до цієї фінансової операції."}, status=403)
        delete_finance_operation(operation_id)
    except (Payment.DoesNotExist, Expense.DoesNotExist, Invoice.DoesNotExist, CaseDocument.DoesNotExist) as exc:
        raise Http404("Finance operation not found") from exc
    log_crm_action(request, AuditLog.Action.DELETE, "finance_operation", operation_id, operation_id, f"Видалено фінансову операцію {operation_id}.")
    payload = {"deleted": operation_id}
    if operation_case:
        operation_case.refresh_from_db()
        payload["case"] = serialize_case(operation_case)
    return json_response(payload)


@require_GET
def finance_summary_api(request):
    forbidden = require_permission(request, "view_finance", "Фінанси доступні адміністратору або бухгалтеру.")
    if forbidden:
        return forbidden
    return json_response(finance_summary_payload(finance_cases_scope(request)))


@require_http_methods(["GET", "POST", "OPTIONS"])
def salaries_api(request):
    if request.method == "OPTIONS":
        return empty_response()
    if request.method == "POST":
        forbidden = require_permission(request, "manage_finance", "Фінансами можуть керувати адміністратор або бухгалтер.")
        if forbidden:
            return forbidden
        item = upsert_salary(parse_body(request))
        log_crm_action(request, AuditLog.Action.CREATE, "salary", item.id, item.employee_name, f"Нараховано зарплату: {item.employee_name}.")
        return json_response(serialize_salary(item))
    forbidden = require_permission(request, "view_finance", "Фінанси доступні адміністратору або бухгалтеру.")
    if forbidden:
        return forbidden
    return json_response({"results": [serialize_salary(item) for item in Salary.objects.all()]})


@require_http_methods(["PUT", "PATCH", "DELETE", "OPTIONS"])
def salary_detail_api(request, salary_id):
    if request.method == "OPTIONS":
        return empty_response()
    forbidden = require_permission(request, "manage_finance", "Фінансами можуть керувати адміністратор або бухгалтер.")
    if forbidden:
        return forbidden
    try:
        item = Salary.objects.get(pk=salary_pk_from_id(salary_id))
    except (Salary.DoesNotExist, ValueError) as exc:
        raise Http404("Salary not found") from exc
    if request.method == "DELETE":
        name = item.employee_name
        item.delete()
        log_crm_action(request, AuditLog.Action.DELETE, "salary", salary_id, name, f"Видалено нарахування зарплати: {name}.")
        return json_response({"deleted": salary_id})
    updated = upsert_salary(parse_body(request), item)
    log_crm_action(request, AuditLog.Action.UPDATE, "salary", updated.id, updated.employee_name, f"Оновлено зарплату: {updated.employee_name}.")
    return json_response(serialize_salary(updated))


@require_http_methods(["GET", "PUT", "POST", "OPTIONS"])
def document_archive_folders_api(request):
    if request.method == "OPTIONS":
        return empty_response()
    settings = crm_settings_instance()
    if request.method == "GET":
        return json_response({"folders": settings.document_archive_folders or []})
    forbidden = require_permission(request, "manage_documents", "Документами можуть керувати адміністратор, адвокат або помічник.")
    if forbidden:
        return forbidden
    payload = parse_body(request)
    folders = payload.get("folders")
    settings.document_archive_folders = folders if isinstance(folders, list) else []
    settings.save(update_fields=["document_archive_folders", "updated_at"])
    return json_response({"folders": settings.document_archive_folders})


@require_GET
def mailings_api(request):
    forbidden = require_permission(request, "manage_mailings", "Розсилками може керувати тільки користувач з доступом до розсилок.")
    if forbidden:
        return forbidden
    return json_response(mailing_payload())


@require_http_methods(["GET", "POST", "OPTIONS"])
def mailing_templates_api(request):
    if request.method == "OPTIONS":
        return empty_response()
    forbidden = require_permission(request, "manage_mailings", "Шаблонами розсилок може керувати тільки користувач з доступом до розсилок.")
    if forbidden:
        return forbidden
    if request.method == "POST":
        item = upsert_mailing_template(parse_body(request))
        log_crm_action(request, AuditLog.Action.CREATE, "mailing_template", item.id, item.title, f"Створено шаблон розсилки «{item.title}».")
        return json_response(serialize_mailing_template(item))
    return json_response({"results": mailing_payload()["templates"]})


@require_http_methods(["GET", "PUT", "PATCH", "DELETE", "OPTIONS"])
def mailing_template_detail_api(request, template_id):
    if request.method == "OPTIONS":
        return empty_response()
    forbidden = require_permission(request, "manage_mailings", "Шаблонами розсилок може керувати тільки користувач з доступом до розсилок.")
    if forbidden:
        return forbidden
    try:
        item = MessageTemplate.objects.get(pk=template_id)
    except MessageTemplate.DoesNotExist as exc:
        raise Http404("Mailing template not found") from exc
    if request.method == "GET":
        return json_response(serialize_mailing_template(item))
    if request.method == "DELETE":
        title = item.title
        item.delete()
        log_crm_action(request, AuditLog.Action.DELETE, "mailing_template", template_id, title, f"Видалено шаблон розсилки «{title}».")
        return json_response({"deleted": template_id})
    updated = upsert_mailing_template(parse_body(request), item)
    log_crm_action(request, AuditLog.Action.UPDATE, "mailing_template", updated.id, updated.title, f"Оновлено шаблон розсилки «{updated.title}».")
    return json_response(serialize_mailing_template(updated))


@require_http_methods(["GET", "POST", "OPTIONS"])
def mailing_campaigns_api(request):
    if request.method == "OPTIONS":
        return empty_response()
    forbidden = require_permission(request, "manage_mailings", "Розсилками може керувати тільки користувач з доступом до розсилок.")
    if forbidden:
        return forbidden
    if request.method == "POST":
        item = upsert_mailing_campaign(parse_body(request), author=current_demo_user(request))
        log_crm_action(request, AuditLog.Action.CREATE, "mailing_campaign", item.id, item.title, f"Створено розсилку «{item.title}».")
        return json_response(serialize_mailing_campaign(item))
    return json_response({"results": mailing_payload()["campaigns"]})


@require_http_methods(["GET", "PUT", "PATCH", "DELETE", "OPTIONS"])
def mailing_campaign_detail_api(request, campaign_id):
    if request.method == "OPTIONS":
        return empty_response()
    forbidden = require_permission(request, "manage_mailings", "Розсилками може керувати тільки користувач з доступом до розсилок.")
    if forbidden:
        return forbidden
    try:
        item = Campaign.objects.get(pk=campaign_id)
    except Campaign.DoesNotExist as exc:
        raise Http404("Mailing campaign not found") from exc
    if request.method == "GET":
        return json_response(serialize_mailing_campaign(item))
    if request.method == "DELETE":
        title = item.title
        item.delete()
        log_crm_action(request, AuditLog.Action.DELETE, "mailing_campaign", campaign_id, title, f"Видалено розсилку «{title}».")
        return json_response({"deleted": campaign_id})
    updated = upsert_mailing_campaign(parse_body(request), item, author=current_demo_user(request))
    log_crm_action(request, AuditLog.Action.UPDATE, "mailing_campaign", updated.id, updated.title, f"Оновлено розсилку «{updated.title}».")
    return json_response(serialize_mailing_campaign(updated))


@require_http_methods(["POST", "OPTIONS"])
def mailing_campaign_send_api(request, campaign_id):
    if request.method == "OPTIONS":
        return empty_response()
    forbidden = require_permission(request, "manage_mailings", "Відправкою розсилок може керувати тільки користувач з доступом до розсилок.")
    if forbidden:
        return forbidden
    try:
        item = Campaign.objects.prefetch_related("deliveries__client").get(pk=campaign_id)
    except Campaign.DoesNotExist as exc:
        raise Http404("Mailing campaign not found") from exc
    sent_count = send_campaign_deliveries(item)
    item = Campaign.objects.prefetch_related("deliveries__client").get(pk=campaign_id)
    log_crm_action(
        request,
        AuditLog.Action.UPDATE,
        "mailing_campaign",
        item.id,
        item.title,
        f"Запущено mock-відправку розсилки «{item.title}»: відправлено {sent_count} доставок.",
        metadata={"sent": sent_count, "deliveryStats": campaign_delivery_stats(item)},
    )
    return json_response({"campaign": serialize_mailing_campaign(item), "sent": sent_count})


@require_http_methods(["GET", "PUT", "PATCH", "OPTIONS"])
def mailing_delivery_detail_api(request, delivery_id):
    if request.method == "OPTIONS":
        return empty_response()
    forbidden = require_permission(request, "manage_mailings", "Доставками розсилок може керувати тільки користувач з доступом до розсилок.")
    if forbidden:
        return forbidden
    try:
        item = MessageDelivery.objects.select_related("client", "campaign").get(pk=delivery_id)
    except MessageDelivery.DoesNotExist as exc:
        raise Http404("Mailing delivery not found") from exc
    if request.method == "GET":
        return json_response({"delivery": serialize_message_delivery(item), "campaign": serialize_mailing_campaign(item.campaign)})
    updated = update_message_delivery(parse_body(request), item)
    log_crm_action(
        request,
        AuditLog.Action.UPDATE,
        "mailing_delivery",
        updated.id,
        f"{updated.client.full_name} · {updated.channel}",
        f"Оновлено доставку розсилки «{updated.campaign.title}»: {updated.client.full_name}, {updated.channel}, {DELIVERY_STATUS_LABELS.get(updated.status, updated.status)}.",
    )
    campaign = Campaign.objects.prefetch_related("deliveries__client").get(pk=updated.campaign_id)
    return json_response({"delivery": serialize_message_delivery(updated), "campaign": serialize_mailing_campaign(campaign)})


@require_http_methods(["GET", "POST", "OPTIONS"])
def mailing_automation_rules_api(request):
    if request.method == "OPTIONS":
        return empty_response()
    forbidden = require_permission(request, "manage_mailings", "Автоматизацією розсилок може керувати тільки користувач з доступом до розсилок.")
    if forbidden:
        return forbidden
    ensure_default_automation_rules()
    if request.method == "POST":
        item = upsert_automation_rule(parse_body(request))
        log_crm_action(request, AuditLog.Action.CREATE, "mailing_automation", item.id, item.title, f"Створено правило автоматизації «{item.title}».")
        return json_response(serialize_automation_rule(item))
    return json_response({"results": mailing_payload()["automationRules"]})


@require_http_methods(["GET", "PUT", "PATCH", "DELETE", "OPTIONS"])
def mailing_automation_rule_detail_api(request, rule_id):
    if request.method == "OPTIONS":
        return empty_response()
    forbidden = require_permission(request, "manage_mailings", "Автоматизацією розсилок може керувати тільки користувач з доступом до розсилок.")
    if forbidden:
        return forbidden
    try:
        item = AutomationRule.objects.get(pk=rule_id)
    except AutomationRule.DoesNotExist as exc:
        raise Http404("Mailing automation rule not found") from exc
    if request.method == "GET":
        return json_response(serialize_automation_rule(item))
    if request.method == "DELETE":
        title = item.title
        item.delete()
        log_crm_action(request, AuditLog.Action.DELETE, "mailing_automation", rule_id, title, f"Видалено правило автоматизації «{title}».")
        return json_response({"deleted": rule_id})
    updated = upsert_automation_rule(parse_body(request), item)
    log_crm_action(request, AuditLog.Action.UPDATE, "mailing_automation", updated.id, updated.title, f"Оновлено правило автоматизації «{updated.title}».")
    return json_response(serialize_automation_rule(updated))


@require_http_methods(["GET", "POST", "OPTIONS"])
def demo_data_api(request):
    if request.method == "OPTIONS":
        return empty_response()
    if request.method == "GET":
        return json_response(demo_data_status_payload())

    forbidden = require_demo_admin(request)
    if forbidden:
        return forbidden

    action = parse_body(request).get("action")
    if action == "clear":
        clear_crm_business_data()
        log_crm_action(request, AuditLog.Action.SYSTEM, "demo_data", "clear", "Демо-дані", "Демо-дані очищено.")
        return json_response({"demoData": demo_data_status_payload(), "message": "Демо-дані очищено."})
    if action == "restore":
        clear_crm_business_data()
        call_command("seed_demo", verbosity=0)
        log_crm_action(request, AuditLog.Action.SYSTEM, "demo_data", "restore", "Демо-дані", "Демо-дані відновлено.")
        return json_response({"demoData": demo_data_status_payload(), "message": "Демо-дані відновлено."})
    if action == "import_snapshot":
        result = import_snapshot_payload(parse_body(request).get("snapshot") or {})
        if result.get("error"):
            return json_response({"error": "Invalid snapshot", "message": result["error"]}, status=400)
        summary = result["summary"]
        imported_total = sum(value for key, value in summary.items() if key != "skipped" and isinstance(value, int))
        log_crm_action(
            request,
            AuditLog.Action.SYSTEM,
            "snapshot",
            "import",
            "JSON-копія CRM",
            f"Імпортовано JSON-копію CRM: {imported_total} записів.",
            metadata=summary,
        )
        return json_response({
            "summary": summary,
            "demoData": demo_data_status_payload(),
            "message": "JSON-копію імпортовано в серверну базу.",
        })
    return json_response({"error": "Unsupported action"}, status=400)


@require_http_methods(["GET", "DELETE", "OPTIONS"])
def audit_logs_api(request):
    if request.method == "OPTIONS":
        return empty_response()
    forbidden = require_permission(request, "manage_users", "Журнал дій доступний тільки адміністратору.")
    if forbidden:
        return forbidden
    if request.method == "DELETE":
        deleted_count, _deleted_by_model = AuditLog.objects.all().delete()
        return json_response({"results": [], "deleted": deleted_count})
    try:
        limit = max(1, min(int(request.GET.get("limit", 50)), 100))
    except ValueError:
        limit = 50
    return json_response({"results": recent_audit_logs(limit)})


@require_http_methods(["GET", "PUT", "PATCH", "OPTIONS"])
def settings_api(request):
    if request.method == "OPTIONS":
        return empty_response()
    forbidden = require_permission(request, "manage_users", "Налаштування доступні тільки адміністратору.")
    if forbidden:
        return forbidden

    settings = crm_settings_instance()
    if request.method == "GET":
        return json_response({"settings": serialize_crm_settings(settings)})

    payload = parse_body(request)
    settings = apply_crm_settings_payload(settings, payload.get("settings") or payload)
    log_crm_action(
        request,
        AuditLog.Action.UPDATE,
        "settings",
        "global",
        "Налаштування CRM",
        "Оновлено налаштування бюро, інтеграцій та сповіщень.",
        metadata=serialize_crm_settings(settings),
    )
    return json_response({
        "settings": serialize_crm_settings(settings),
        "auditLogs": recent_audit_logs(),
    })


@require_http_methods(["GET", "POST", "OPTIONS"])
def settings_provider_status_api(request):
    if request.method == "OPTIONS":
        return empty_response()
    forbidden = require_permission(request, "manage_users", "Перевірка інтеграцій доступна тільки адміністратору.")
    if forbidden:
        return forbidden

    if request.method == "GET":
        return json_response({"providerStatus": mailing_provider_status_payload()})

    payload = parse_body(request)
    channel = str(payload.get("channel") or "").strip()
    settings = serialize_crm_settings()
    result = test_provider_channel(channel, settings["integrations"], settings["integrationSettings"])
    log_crm_action(
        request,
        AuditLog.Action.SYSTEM,
        "settings",
        f"provider:{channel or 'unknown'}",
        "Перевірка інтеграції",
        f"Тест {channel or 'каналу'} через mock-провайдер: {result.status}.",
        metadata={"channel": channel, "provider": result.provider, "ok": result.ok, "error": result.error},
    )
    return json_response({
        "result": {
            "channel": channel,
            "provider": result.provider,
            "ok": result.ok,
            "status": result.status,
            "error": result.error,
        },
        "providerStatus": mailing_provider_status_payload(),
        "auditLogs": recent_audit_logs(),
    })


@ensure_csrf_cookie
@require_GET
def bootstrap_api(_request):
    current_user = current_demo_user(_request)
    user_permissions = permissions_for_user(current_user)
    can_see_finance = "view_finance" in user_permissions
    can_manage_users = "manage_users" in user_permissions
    clients = accessible_client_queryset(_request).prefetch_related("communications", "cases").order_by("full_name")
    cases = accessible_case_queryset(_request).select_related("client", "responsible").prefetch_related(
        "documents",
        "tasks",
        "events",
        "team_members",
    ).order_by("client__full_name", "opened_at")
    tasks = accessible_task_queryset(_request).select_related("client", "case", "responsible").order_by("due_at", "id")
    events = accessible_event_queryset(_request).select_related("client", "case", "responsible").order_by("starts_at", "id")
    finance_cases = finance_cases_scope(_request)
    return json_response({
        "session": session_payload(_request),
        "currentUser": serialize_system_user(current_user) if current_user else None,
        # Don't ship the full staff directory to non-admins — only their own profile.
        "settingsUsers": [serialize_system_user(user) for user in system_users_queryset()]
            if can_manage_users
            else ([serialize_system_user(current_user)] if current_user else []),
        "clients": [serialize_client(item) for item in clients],
        "cases": [serialize_case(item, include_finance=can_see_finance) for item in cases],
        "tasks": [serialize_task(item) for item in tasks],
        "events": [serialize_event(item) for item in events],
        "financeOperations": finance_operations_payload(finance_cases) if can_see_finance else [],
        "salaries": [serialize_salary(item) for item in Salary.objects.all()] if can_see_finance else [],
        "finance": finance_summary_payload(finance_cases) if can_see_finance else empty_finance_summary_payload(),
        "mailing": mailing_payload() if "manage_mailings" in permissions_for_user(current_user) else {},
        "settings": serialize_crm_settings(),
        "auditLogs": recent_audit_logs() if "manage_users" in permissions_for_user(current_user) else [],
        "meta": {
            "clients": clients.count(),
            "cases": cases.count(),
            "tasks": tasks.count(),
            "events": events.count(),
            "demoData": demo_data_status_payload(),
        },
    })
