import json
import re
from datetime import datetime, time
from decimal import Decimal
from hashlib import sha1

from django.contrib.auth import authenticate, get_user_model, login as auth_login, logout as auth_logout
from django.core.management import call_command
from django.db.models import Sum
from django.http import Http404, HttpResponse, JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_http_methods

from apps.accounts.models import UserProfile
from apps.calendar_app.models import CalendarEvent
from apps.cases.demo_data import clear_demo_business_data, demo_data_counts
from apps.cases.models import Case, CaseDocument
from apps.clients.models import Client, ClientCommunication
from apps.finance.models import Expense, Invoice, Payment
from apps.tasks.models import Task


def json_response(payload, status=200):
    response = JsonResponse(payload, status=status)
    response["Access-Control-Allow-Origin"] = "*"
    response["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
    response["Access-Control-Allow-Headers"] = "Content-Type"
    response["Access-Control-Allow-Credentials"] = "true"
    return response


def empty_response(status=204):
    response = HttpResponse(status=status)
    response["Access-Control-Allow-Origin"] = "*"
    response["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
    response["Access-Control-Allow-Headers"] = "Content-Type"
    response["Access-Control-Allow-Credentials"] = "true"
    return response


def parse_body(request):
    if not request.body:
        return {}
    return json.loads(request.body.decode("utf-8"))


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


ROLE_LABELS = {value: label for label, (value, _access) in ROLE_ACCESS.items()}


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


def serialize_system_user(user):
    profile = profile_for_user(user)
    name = user_name(user)
    role_label = profile.get_role_display()
    return {
        "id": user.id,
        "name": name,
        "email": user.email,
        "role": role_label,
        "access": profile.access_scope or ROLE_ACCESS.get(role_label, ("", ""))[1],
        "photo": profile.photo_label or initials_from_name(name),
        "active": user.is_active and profile.is_active_member,
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
    if data.get("password"):
        user.set_password(data["password"])
    user.save()
    profile = profile_for_user(user)
    profile.role = role
    profile.access_scope = access
    profile.photo_label = data.get("photo") or initials_from_name(name)
    profile.is_active_member = True
    profile.save()
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
    case.description = data.get("description", case.description or "")
    case.opened_at = parse_date(data.get("opened")) or case.opened_at or timezone.localdate()
    case.deadline_at = parse_date(data.get("deadline")) or case.deadline_at
    case.income_amount = data.get("income", case.income_amount or 0)
    case.paid_amount = data.get("paid", case.paid_amount or 0)
    case.debt_amount = data.get("debt", case.debt_amount or 0)
    case.finance_comment = data.get("financeComment", case.finance_comment or "")
    case.history = data.get("history", case.history or [])
    case.save()
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
    document.history = data.get("history", document.history or [])
    document.save()
    return document


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
    event.ends_at = ends_at
    event.client = client or event.client or (case.client if case else None)
    event.case = case or event.case
    event.authority = data.get("authority", event.authority or "")
    event.location = data.get("location", event.location or "")
    event.responsible = user_for_name(data.get("responsible")) or event.responsible
    event.description = data.get("description", event.description or "")
    event.recurrence = data.get("recurrence", event.recurrence or "")
    event.reminder_before = data.get("reminderBefore", event.reminder_before or "")
    event.reminder_channels = data.get("reminderChannels", event.reminder_channels or "")
    event.reminder_recipients = data.get("reminderRecipients", event.reminder_recipients or "")
    event.reminder_log = data.get("reminderLog", event.reminder_log or [])
    event.status = data.get("status", event.status or "Заплановано")
    event.save()
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


def serialize_finance_invoice(item):
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
    }


def serialize_finance_act(document):
    return {
        "id": f"document-{document.id}",
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


def finance_operations_payload():
    payments = [serialize_finance_payment(item) for item in Payment.objects.select_related("case", "client").all()]
    expenses = [serialize_finance_expense(item) for item in Expense.objects.select_related("case", "client").all()]
    invoices = [serialize_finance_invoice(item) for item in Invoice.objects.select_related("case", "client").all()]
    acts = [
        serialize_finance_act(item)
        for item in CaseDocument.objects.select_related("case", "case__client").filter(document_type="Акт", folder="Фінансові документи")
    ]
    return sorted(
        [*payments, *expenses, *invoices, *acts],
        key=lambda item: parse_date(item.get("date")) or timezone.localdate(),
        reverse=True,
    )


def recalculate_case_debt(case):
    case.debt_amount = max(case.income_amount - case.paid_amount, 0)
    case.save(update_fields=["income_amount", "paid_amount", "debt_amount", "finance_comment", "history"])


def create_finance_document(case, title, document_type, status, amount, date, comment):
    return CaseDocument.objects.create(
        case=case,
        title=f"{document_type}: {title} · №{case.number}.docx",
        document_type=document_type,
        status=status,
        folder="Фінансові документи",
        submitted_at=date,
        comment=f"{comment or ''} Сума: {money(amount):,.0f} грн.".strip(),
        history=[],
    )


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
        case.income_amount = max(case.income_amount, case.paid_amount + payment.amount)
        case.paid_amount = min(case.paid_amount + payment.amount, case.income_amount)
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
            due_at=date,
            status=status,
        )
        document = create_finance_document(case, title, "Рахунок", "Подано", amount, date, comment)
        case.income_amount = case.income_amount + invoice.amount
        case.finance_comment = comment or case.finance_comment
        history.insert(0, {"date": date_value(timezone.localdate()), "text": f"Виставлено рахунок: {invoice.number} на {money(invoice.amount):,.0f} грн."})
        case.history = history
        recalculate_case_debt(case)
        return {"operation": serialize_finance_invoice(invoice), "document": serialize_document(document), "case": serialize_case(case)}

    if action == "act" or operation_type == "Акт":
        document = create_finance_document(case, title, "Акт", status or "Чернетка", amount, date, comment)
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
        item = Invoice.objects.select_related("case").get(pk=raw_id)
        case = item.case
        case.income_amount = max(case.income_amount - item.amount, case.paid_amount)
        item.delete()
        recalculate_case_debt(case)
        return
    if prefix == "document":
        CaseDocument.objects.get(pk=raw_id, document_type="Акт", folder="Фінансові документи").delete()
        return
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


def serialize_document(item):
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
        "responsible": item.responsible_name,
        "comment": item.comment,
        "history": item.history,
    }


def serialize_task(item):
    return {
        "id": item.id,
        "title": item.title,
        "caseId": item.case.number if item.case else "",
        "clientId": item.client_id,
        "responsible": user_name(item.responsible),
        "due": datetime_value(item.due_at),
        "priority": item.priority,
        "status": item.status,
        "source": item.source,
        "description": item.description,
        "comment": item.comment,
        "coexecutors": item.coexecutors,
        "showInCalendar": item.show_in_calendar,
        "plannerManual": item.planner_manual,
        "plannerImportant": item.planner_important,
        "plannerAt": datetime_value(item.planner_at),
        "reminderEnabled": item.reminder_enabled,
        "reminderBefore": item.reminder_before,
        "reminderChannel": item.reminder_channel,
        "subtasks": item.subtasks,
        "comments": item.comments,
        "history": item.history,
    }


def serialize_case(item):
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
        "opened": date_value(item.opened_at),
        "deadline": date_value(item.deadline_at),
        "income": money(item.income_amount),
        "paid": money(item.paid_amount),
        "debt": money(item.debt_amount),
        "description": item.description,
        "financeComment": item.finance_comment,
        "history": item.history,
        "documents": [serialize_document(document) for document in item.documents.all()],
        "tasks": [serialize_task(task) for task in item.tasks.all()],
        "documentsCount": item.documents.count(),
        "tasksCount": item.tasks.count(),
        "eventsCount": item.events.count(),
    }


def serialize_event(item):
    return {
        "id": item.id,
        "title": item.title,
        "type": item.event_type,
        "date": date_value(item.starts_at.date()) if item.starts_at else "",
        "startsAt": datetime_value(item.starts_at),
        "endsAt": datetime_value(item.ends_at),
        "clientId": item.client_id,
        "caseId": item.case.number if item.case else "",
        "authority": item.authority,
        "location": item.location,
        "responsible": user_name(item.responsible),
        "description": item.description,
        "recurrence": item.recurrence,
        "reminderBefore": item.reminder_before,
        "reminderChannels": item.reminder_channels,
        "reminderRecipients": item.reminder_recipients,
        "reminderLog": item.reminder_log,
        "status": item.status,
    }


def finance_summary_payload():
    totals = Case.objects.aggregate(
        income=Sum("income_amount"),
        paid=Sum("paid_amount"),
        debt=Sum("debt_amount"),
    )
    return {
        "income": money(totals["income"]),
        "paid": money(totals["paid"]),
        "debt": money(totals["debt"]),
        "activeCases": Case.objects.exclude(status__in=["Закрито", "Завершено", "Архів"]).count(),
        "documents": CaseDocument.objects.count(),
        "tasks": Task.objects.count(),
    }


def demo_data_status_payload():
    counts = demo_data_counts()
    return {
        "enabled": any(counts.values()),
        "counts": counts,
        "total": sum(counts.values()),
    }


def clear_crm_business_data():
    clear_demo_business_data()


def require_demo_admin(request):
    user = current_demo_user(request)
    profile = profile_for_user(user) if user else None
    if not profile or profile.role != "admin":
        return json_response({"error": "Forbidden", "message": "Демо-даними може керувати тільки адміністратор."}, status=403)
    return None


def system_users_queryset():
    User = get_user_model()
    return User.objects.select_related("crm_profile").filter(crm_profile__is_active_member=True, is_active=True).order_by("id")


def current_demo_user(request):
    if request.user.is_authenticated:
        return request.user
    User = get_user_model()
    return (
        User.objects.select_related("crm_profile").filter(crm_profile__role="admin", crm_profile__is_active_member=True, is_active=True).order_by("id").first()
        or User.objects.filter(is_active=True).order_by("id").first()
    )


def session_payload(request):
    user = current_demo_user(request)
    profile = profile_for_user(user) if user else None
    return {
        "authenticated": bool(request.user.is_authenticated),
        "user": serialize_system_user(user) if user else None,
        "permissions": {
            "canManageUsers": bool(profile and profile.role == "admin"),
            "canSeeFinance": bool(profile and profile.role in ("admin", "accountant")),
            "canManageCases": bool(profile and profile.role in ("admin", "lawyer")),
        },
    }


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
    return json_response(session_payload(request))


@csrf_exempt
@require_http_methods(["POST", "OPTIONS"])
def logout_api(request):
    if request.method == "OPTIONS":
        return empty_response()
    auth_logout(request)
    return json_response(session_payload(request))


@csrf_exempt
@require_http_methods(["GET", "POST", "OPTIONS"])
def users_api(request):
    if request.method == "OPTIONS":
        return empty_response()
    if request.method == "POST":
        user = upsert_system_user(parse_body(request))
        return json_response(serialize_system_user(user))
    return json_response({"results": [serialize_system_user(user) for user in system_users_queryset()]})


@csrf_exempt
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
        profile = profile_for_user(user)
        profile.is_active_member = False
        profile.save(update_fields=["is_active_member", "updated_at"])
        user.is_active = False
        user.save(update_fields=["is_active"])
        return json_response({"deleted": user_id})
    return json_response(serialize_system_user(upsert_system_user(parse_body(request), user)))


@require_GET
def session_api(request):
    return json_response(session_payload(request))


@csrf_exempt
@require_http_methods(["GET", "POST", "OPTIONS"])
def clients_api(request):
    if request.method == "OPTIONS":
        return empty_response()
    if request.method == "POST":
        client = upsert_client(parse_body(request))
        return json_response(serialize_client(client))
    items = Client.objects.prefetch_related("communications", "cases").order_by("full_name")
    return json_response({"results": [serialize_client(item) for item in items]})


@csrf_exempt
@require_http_methods(["GET", "PUT", "PATCH", "DELETE", "OPTIONS"])
def client_detail_api(request, client_id):
    if request.method == "OPTIONS":
        return empty_response()
    try:
        client = Client.objects.get(pk=client_id)
    except Client.DoesNotExist as exc:
        raise Http404("Client not found") from exc
    if request.method == "GET":
        return json_response(serialize_client(client))
    if request.method == "DELETE":
        Task.objects.filter(client=client).delete()
        CalendarEvent.objects.filter(client=client).delete()
        client.cases.all().delete()
        client.delete()
        return json_response({"deleted": client_id})
    return json_response(serialize_client(upsert_client(parse_body(request), client)))


@csrf_exempt
@require_http_methods(["GET", "POST", "OPTIONS"])
def client_communications_api(request, client_id):
    if request.method == "OPTIONS":
        return empty_response()
    try:
        client = Client.objects.get(pk=client_id)
    except Client.DoesNotExist as exc:
        raise Http404("Client not found") from exc
    if request.method == "POST":
        item = upsert_client_communication({**parse_body(request), "clientId": client.id}, client=client)
        return json_response(serialize_client_communication(item))
    items = client.communications.select_related("author", "case").order_by("-date", "-id")
    return json_response({"results": [serialize_client_communication(item) for item in items]})


@csrf_exempt
@require_http_methods(["GET", "PUT", "PATCH", "DELETE", "OPTIONS"])
def client_communication_detail_api(request, communication_id):
    if request.method == "OPTIONS":
        return empty_response()
    try:
        item = ClientCommunication.objects.select_related("client", "author", "case").get(pk=communication_id)
    except ClientCommunication.DoesNotExist as exc:
        raise Http404("Client communication not found") from exc
    if request.method == "GET":
        return json_response(serialize_client_communication(item))
    if request.method == "DELETE":
        item.delete()
        return json_response({"deleted": communication_id})
    return json_response(serialize_client_communication(upsert_client_communication(parse_body(request), item)))


@csrf_exempt
@require_http_methods(["GET", "POST", "OPTIONS"])
def cases_api(request):
    if request.method == "OPTIONS":
        return empty_response()
    if request.method == "POST":
        item = upsert_case(parse_body(request))
        return json_response(serialize_case(item))
    items = Case.objects.select_related("client", "responsible").prefetch_related("documents", "tasks", "events").order_by("client__full_name", "opened_at")
    return json_response({"results": [serialize_case(item) for item in items]})


@csrf_exempt
@require_http_methods(["GET", "PUT", "PATCH", "DELETE", "OPTIONS"])
def case_detail_api(request, case_number):
    if request.method == "OPTIONS":
        return empty_response()
    try:
        item = Case.objects.get(number=case_number)
    except Case.DoesNotExist as exc:
        raise Http404("Case not found") from exc
    if request.method == "GET":
        return json_response(serialize_case(item))
    if request.method == "DELETE":
        Task.objects.filter(case=item).delete()
        CalendarEvent.objects.filter(case=item).delete()
        item.delete()
        return json_response({"deleted": case_number})
    return json_response(serialize_case(upsert_case(parse_body(request), item)))


@csrf_exempt
@require_http_methods(["GET", "POST", "OPTIONS"])
def tasks_api(request):
    if request.method == "OPTIONS":
        return empty_response()
    if request.method == "POST":
        item = upsert_task(parse_body(request))
        return json_response(serialize_task(item))
    items = Task.objects.select_related("client", "case", "responsible").order_by("due_at", "id")
    return json_response({"results": [serialize_task(item) for item in items]})


@csrf_exempt
@require_http_methods(["GET", "POST", "OPTIONS"])
def documents_api(request):
    if request.method == "OPTIONS":
        return empty_response()
    if request.method == "POST":
        item = upsert_document(parse_body(request))
        return json_response(serialize_document(item))
    items = CaseDocument.objects.select_related("case").order_by("case__number", "folder", "title")
    return json_response({"results": [serialize_document(item) for item in items]})


@csrf_exempt
@require_http_methods(["GET", "PUT", "PATCH", "DELETE", "OPTIONS"])
def document_detail_api(request, document_id):
    if request.method == "OPTIONS":
        return empty_response()
    try:
        item = CaseDocument.objects.select_related("case").get(pk=document_id)
    except CaseDocument.DoesNotExist as exc:
        raise Http404("Document not found") from exc
    if request.method == "GET":
        return json_response(serialize_document(item))
    if request.method == "DELETE":
        item.delete()
        return json_response({"deleted": document_id})
    return json_response(serialize_document(upsert_document(parse_body(request), item)))


@csrf_exempt
@require_http_methods(["GET", "PUT", "PATCH", "DELETE", "OPTIONS"])
def task_detail_api(request, task_id):
    if request.method == "OPTIONS":
        return empty_response()
    try:
        item = Task.objects.select_related("client", "case", "responsible").get(pk=task_id)
    except Task.DoesNotExist as exc:
        raise Http404("Task not found") from exc
    if request.method == "GET":
        return json_response(serialize_task(item))
    if request.method == "DELETE":
        item.delete()
        return json_response({"deleted": task_id})
    return json_response(serialize_task(upsert_task(parse_body(request), item)))


@csrf_exempt
@require_http_methods(["GET", "POST", "OPTIONS"])
def events_api(request):
    if request.method == "OPTIONS":
        return empty_response()
    if request.method == "POST":
        item = upsert_event(parse_body(request))
        return json_response(serialize_event(item))
    items = CalendarEvent.objects.select_related("client", "case", "responsible").order_by("starts_at", "id")
    return json_response({"results": [serialize_event(item) for item in items]})


@csrf_exempt
@require_http_methods(["GET", "PUT", "PATCH", "DELETE", "OPTIONS"])
def event_detail_api(request, event_id):
    if request.method == "OPTIONS":
        return empty_response()
    try:
        item = CalendarEvent.objects.select_related("client", "case", "responsible").get(pk=event_id)
    except CalendarEvent.DoesNotExist as exc:
        raise Http404("Event not found") from exc
    if request.method == "GET":
        return json_response(serialize_event(item))
    if request.method == "DELETE":
        item.delete()
        return json_response({"deleted": event_id})
    return json_response(serialize_event(upsert_event(parse_body(request), item)))


@csrf_exempt
@require_http_methods(["GET", "POST", "OPTIONS"])
def finance_operations_api(request):
    if request.method == "OPTIONS":
        return empty_response()
    if request.method == "POST":
        return json_response(create_finance_operation(parse_body(request)))
    return json_response({"results": finance_operations_payload()})


@csrf_exempt
@require_http_methods(["DELETE", "OPTIONS"])
def finance_operation_detail_api(request, operation_id):
    if request.method == "OPTIONS":
        return empty_response()
    try:
        delete_finance_operation(operation_id)
    except (Payment.DoesNotExist, Expense.DoesNotExist, Invoice.DoesNotExist, CaseDocument.DoesNotExist) as exc:
        raise Http404("Finance operation not found") from exc
    return json_response({"deleted": operation_id})


@require_GET
def finance_summary_api(_request):
    return json_response(finance_summary_payload())


@csrf_exempt
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
        return json_response({"demoData": demo_data_status_payload(), "message": "Демо-дані очищено."})
    if action == "restore":
        clear_crm_business_data()
        call_command("seed_demo", verbosity=0)
        return json_response({"demoData": demo_data_status_payload(), "message": "Демо-дані відновлено."})
    return json_response({"error": "Unsupported action"}, status=400)


@require_GET
def bootstrap_api(_request):
    current_user = current_demo_user(_request)
    return json_response({
        "session": session_payload(_request),
        "currentUser": serialize_system_user(current_user) if current_user else None,
        "settingsUsers": [serialize_system_user(user) for user in system_users_queryset()],
        "clients": [serialize_client(item) for item in Client.objects.prefetch_related("communications", "cases").order_by("full_name")],
        "cases": [serialize_case(item) for item in Case.objects.select_related("client", "responsible").prefetch_related("documents", "tasks", "events").order_by("client__full_name", "opened_at")],
        "tasks": [serialize_task(item) for item in Task.objects.select_related("client", "case", "responsible").order_by("due_at", "id")],
        "events": [serialize_event(item) for item in CalendarEvent.objects.select_related("client", "case", "responsible").order_by("starts_at", "id")],
        "financeOperations": finance_operations_payload(),
        "finance": finance_summary_payload(),
        "meta": {
            "clients": Client.objects.count(),
            "cases": Case.objects.count(),
            "tasks": Task.objects.count(),
            "events": CalendarEvent.objects.count(),
            "demoData": demo_data_status_payload(),
        },
    })
