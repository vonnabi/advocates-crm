import json
import re
from hashlib import sha1
from datetime import datetime, time
from decimal import Decimal

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.accounts.models import UserProfile
from apps.calendar_app.models import CalendarEvent
from apps.cases.demo_data import clear_demo_business_data
from apps.cases.models import Case, CaseDocument, CaseMember
from apps.clients.models import Client, ClientCommunication
from apps.tasks.models import Task


def load_json(name):
    path = settings.BASE_DIR.parent / "frontend" / "data" / name
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def parse_date(value):
    if not value or value == "-":
        return None
    value = str(value).strip()
    for fmt in ("%Y-%m-%d", "%d.%m.%Y"):
        try:
            return datetime.strptime(value, fmt).date()
        except ValueError:
            continue
    return None


def parse_datetime(value, fallback_time="09:00"):
    if not value or value == "-":
        return None
    value = str(value).strip()
    value = value.replace("T", " ")
    patterns = ("%Y-%m-%d %H:%M", "%d.%m.%Y %H:%M", "%Y-%m-%d", "%d.%m.%Y")
    for fmt in patterns:
        try:
            parsed = datetime.strptime(value, fmt)
            if fmt in ("%Y-%m-%d", "%d.%m.%Y"):
                hour, minute = [int(part) for part in fallback_time.split(":")]
                parsed = datetime.combine(parsed.date(), time(hour, minute))
            return timezone.make_aware(parsed, timezone.get_current_timezone())
        except ValueError:
            continue
    return None


def decimal_value(value):
    return Decimal(str(value or 0))


def username_from_name(name):
    slug = re.sub(r"[^a-zA-Z0-9]+", "_", name or "user").strip("_").lower()
    if slug:
        return slug[:120]
    digest = sha1((name or "user").encode("utf-8")).hexdigest()[:10]
    return f"crm_{digest}"


def user_for_name(name):
    if not name:
        return None
    User = get_user_model()
    user, _ = User.objects.get_or_create(username=username_from_name(name), defaults={"first_name": name})
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

DEMO_PASSWORD = "demo12345"


def initials_from_name(name):
    parts = [part for part in str(name or "").split() if part]
    return "".join(part[0].upper() for part in parts[:2]) or "К"


def ensure_team_user(name, email, role_label):
    user = user_for_name(name)
    role, access = ROLE_ACCESS.get(role_label, ROLE_ACCESS["Помічник"])
    user.email = email
    user.set_password(DEMO_PASSWORD)
    user.is_staff = role == "admin"
    user.is_superuser = role == "admin"
    user.is_active = True
    user.save(update_fields=["email", "password", "is_staff", "is_superuser", "is_active"])
    UserProfile.objects.update_or_create(
        user=user,
        defaults={
            "role": role,
            "access_scope": access,
            "photo_label": initials_from_name(name),
            "is_active_member": True,
        },
    )
    return user


def case_member_role_for_user(user):
    profile_role = UserProfile.objects.filter(user=user).values_list("role", flat=True).first()
    return {
        "lawyer": CaseMember.Role.LAWYER,
        "assistant": CaseMember.Role.ASSISTANT,
        "accountant": CaseMember.Role.ACCOUNTANT,
    }.get(profile_role, CaseMember.Role.OBSERVER)


def ensure_case_member(case, user):
    if not case or not user:
        return None
    member, _created = CaseMember.objects.update_or_create(
        case=case,
        user=user,
        defaults={
            "role": case_member_role_for_user(user),
            "can_edit": True,
            "is_demo": True,
        },
    )
    return member


def date_time_from_event(event, key="time"):
    date = event.get("date")
    value_time = event.get(key) or event.get("time") or "09:00"
    return parse_datetime(f"{date} {value_time}") if date else None


class Command(BaseCommand):
    help = "Import demo frontend JSON into the Django database."

    def add_arguments(self, parser):
        parser.add_argument("--clear", action="store_true", help="Clear imported CRM demo data before seeding.")

    def handle(self, *args, **options):
        if options["clear"]:
            clear_demo_business_data()

        clients_payload = load_json("clients.json")
        cases_payload = load_json("cases.json")
        events_payload = load_json("events.json")

        ensure_team_user("Іваненко А.Ю.", "ivanenko@advocates.crm", "Адміністратор")
        ensure_team_user("Мельник Н.П.", "melnyk@advocates.crm", "Адвокат")
        ensure_team_user("Кравчук А.В.", "kravchuk@advocates.crm", "Помічник")
        ensure_team_user("Петренко С.В.", "petrenko@advocates.crm", "Адвокат")

        clients = {}
        for row in clients_payload:
            manager = user_for_name(row.get("manager"))
            client = Client.objects.filter(id=row["id"], is_demo=True).first()
            if not client:
                client = Client(id=row["id"]) if not Client.objects.filter(id=row["id"]).exists() else Client()
            client.full_name = row.get("name", "")
            client.client_type = row.get("clientType", "")
            client.phone = row.get("phone", "")
            client.email = row.get("email", "")
            client.address = row.get("address", "")
            client.telegram_username = row.get("telegramUsername", "")
            client.telegram_connected = bool(row.get("telegram"))
            client.photo_url = row.get("photoUrl", "")
            client.show_photo = bool(row.get("showPhoto"))
            client.request_summary = row.get("request", "")
            client.source = row.get("source", "")
            client.status = row.get("status", "")
            client.responsible = manager
            client.consent_to_marketing = bool(row.get("consent"))
            client.risk_level = row.get("risk", "")
            client.next_action = row.get("nextAction", "")
            client.notes = row.get("notes", "")
            client.added_at = parse_date(row.get("added"))
            client.last_contact_at = parse_date(row.get("lastContact"))
            client.is_demo = True
            client.save()
            client.communications.filter(is_demo=True).delete()
            for communication in row.get("communications", []):
                ClientCommunication.objects.create(
                    client=client,
                    date=parse_date(communication.get("date")),
                    channel=communication.get("channel", ""),
                    title=communication.get("title", ""),
                    status=communication.get("status", ""),
                    author=manager,
                    is_demo=True,
                )
            clients[client.id] = client
            clients[row["id"]] = client

        cases = {}
        for row in cases_payload:
            client = clients.get(row.get("clientId")) or Client.objects.filter(id=row.get("clientId"), is_demo=True).first()
            if not client:
                continue
            responsible = user_for_name(row.get("responsible"))
            income = decimal_value(row.get("income"))
            debt = decimal_value(row.get("debt"))
            paid = decimal_value(row.get("paid")) if "paid" in row else max(Decimal("0"), income - debt)
            item = Case.objects.filter(number=row["id"], is_demo=True).first()
            if not item and Case.objects.filter(number=row["id"]).exists():
                continue
            item = item or Case(number=row["id"])
            item.title = row.get("title", "")
            item.client = client
            item.practice_area = row.get("type", "")
            item.stage = row.get("stage", "")
            item.status = row.get("status", "")
            item.priority = row.get("priority", "")
            item.responsible = responsible
            item.court_or_authority = row.get("court", "")
            item.authority_type = row.get("authorityType", "")
            item.authority_address = row.get("authorityAddress", "")
            item.authority_contact = row.get("authorityContact", "")
            item.description = row.get("description", "")
            item.opened_at = parse_date(row.get("opened"))
            item.deadline_at = parse_date(row.get("deadline"))
            item.income_amount = income
            item.paid_amount = paid
            item.debt_amount = debt
            item.finance_comment = row.get("financeComment", "")
            item.history = row.get("history", [])
            item.is_demo = True
            item.save()
            item.team_members.filter(is_demo=True).delete()
            ensure_case_member(item, responsible)
            item.documents.filter(is_demo=True).delete()
            item.tasks.filter(is_demo=True).delete()
            for document in row.get("documents", []):
                document_responsible = user_for_name(document.get("responsible", row.get("responsible", "")))
                CaseDocument.objects.create(
                    case=item,
                    title=document.get("name", ""),
                    document_type=document.get("type", ""),
                    status=document.get("status", ""),
                    submitted_at=parse_date(document.get("submitted")),
                    response_due_at=parse_date(document.get("responseDue")),
                    responsible_name=document.get("responsible", row.get("responsible", "")),
                    comment=document.get("comment", ""),
                    history=document.get("history", []),
                    is_demo=True,
                )
                ensure_case_member(item, document_responsible)
            for folder in row.get("folders", []):
                for document in folder.get("files", []):
                    document_responsible = user_for_name(document.get("responsible", row.get("responsible", "")))
                    CaseDocument.objects.create(
                        case=item,
                        title=document.get("name", ""),
                        document_type=document.get("type", ""),
                        folder=folder.get("name", ""),
                        status=document.get("status", ""),
                        external_url=document.get("url", ""),
                        submitted_at=parse_date(document.get("submitted")),
                        response_due_at=parse_date(document.get("responseDue")),
                        responsible_name=document.get("responsible", row.get("responsible", "")),
                        comment=document.get("comment", ""),
                        history=document.get("history", []),
                        is_demo=True,
                    )
                    ensure_case_member(item, document_responsible)
            for task in row.get("tasks", []):
                planner_at = None
                if task.get("plannerDate"):
                    planner_at = parse_datetime(f"{task.get('plannerDate')} {task.get('plannerTime') or '09:00'}")
                task_item = Task.objects.create(
                    title=task.get("title", ""),
                    client=client,
                    case=item,
                    responsible=user_for_name(task.get("responsible")) or responsible,
                    due_at=parse_datetime(task.get("due")),
                    priority=task.get("priority", ""),
                    status=task.get("status", ""),
                    source=task.get("source", "demo"),
                    description=task.get("description", ""),
                    comment=task.get("comment", ""),
                    coexecutors=task.get("coexecutors", []),
                    show_in_calendar=bool(task.get("showInCalendar")),
                    planner_manual=bool(task.get("plannerManual")),
                    planner_important=bool(task.get("plannerImportant")),
                    planner_at=planner_at,
                    reminder_enabled=bool(task.get("reminderEnabled")),
                    reminder_before=task.get("reminderBefore", ""),
                    reminder_channel=task.get("reminderChannel", ""),
                    subtasks=task.get("subtasks", []),
                    comments=task.get("comments", []),
                    history=task.get("history", []),
                    is_demo=True,
                )
                ensure_case_member(item, task_item.responsible)
                for name in task.get("coexecutors", []):
                    ensure_case_member(item, user_for_name(name))
                for subtask in task.get("subtasks", []):
                    ensure_case_member(item, user_for_name(subtask.get("responsible")))
            cases[item.number] = item

        CalendarEvent.objects.filter(is_demo=True).delete()
        for row in events_payload:
            case = cases.get(row.get("caseId")) or Case.objects.filter(number=row.get("caseId"), is_demo=True).first()
            client = clients.get(row.get("clientId")) or Client.objects.filter(id=row.get("clientId"), is_demo=True).first()
            event = CalendarEvent.objects.filter(id=row["id"], is_demo=True).first()
            if not event:
                event = CalendarEvent(id=row["id"]) if not CalendarEvent.objects.filter(id=row["id"]).exists() else CalendarEvent()
            event.title = row.get("title", "")
            event.event_type = row.get("type", "")
            event.starts_at = date_time_from_event(row, "time")
            event.ends_at = date_time_from_event(row, "endTime")
            event.client = client
            event.case = case
            event.authority = row.get("authority", "")
            event.location = row.get("location", "")
            event.responsible = user_for_name(row.get("responsible"))
            event.description = row.get("description", "")
            event.recurrence = row.get("recurrence", "")
            event.reminder_before = row.get("reminderBefore", "")
            event.reminder_channels = row.get("reminderChannels", "")
            event.reminder_recipients = row.get("reminderRecipients", "")
            event.reminder_log = row.get("reminderLog", [])
            event.status = row.get("status", "")
            event.is_demo = True
            event.save()
            ensure_case_member(case, event.responsible)

        if options.get("verbosity", 1) > 0:
            self.stdout.write(self.style.SUCCESS(
                f"Seeded {Client.objects.count()} clients, {Case.objects.count()} cases, "
                f"{Task.objects.count()} tasks, {CalendarEvent.objects.count()} events."
            ))
