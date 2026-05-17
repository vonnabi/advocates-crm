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
from apps.cases.models import Case, CaseDocument
from apps.clients.models import Client, ClientCommunication
from apps.finance.models import Expense, Invoice, Payment
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
            Payment.objects.all().delete()
            Invoice.objects.all().delete()
            Expense.objects.all().delete()
            CalendarEvent.objects.all().delete()
            Task.objects.all().delete()
            CaseDocument.objects.all().delete()
            Case.objects.all().delete()
            ClientCommunication.objects.all().delete()
            Client.objects.all().delete()

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
            client, _ = Client.objects.update_or_create(
                id=row["id"],
                defaults={
                    "full_name": row.get("name", ""),
                    "client_type": row.get("clientType", ""),
                    "phone": row.get("phone", ""),
                    "email": row.get("email", ""),
                    "address": row.get("address", ""),
                    "telegram_username": row.get("telegramUsername", ""),
                    "telegram_connected": bool(row.get("telegram")),
                    "photo_url": row.get("photoUrl", ""),
                    "show_photo": bool(row.get("showPhoto")),
                    "request_summary": row.get("request", ""),
                    "source": row.get("source", ""),
                    "status": row.get("status", ""),
                    "responsible": manager,
                    "consent_to_marketing": bool(row.get("consent")),
                    "risk_level": row.get("risk", ""),
                    "next_action": row.get("nextAction", ""),
                    "notes": row.get("notes", ""),
                    "added_at": parse_date(row.get("added")),
                    "last_contact_at": parse_date(row.get("lastContact")),
                },
            )
            client.communications.all().delete()
            for communication in row.get("communications", []):
                ClientCommunication.objects.create(
                    client=client,
                    date=parse_date(communication.get("date")),
                    channel=communication.get("channel", ""),
                    title=communication.get("title", ""),
                    status=communication.get("status", ""),
                    author=manager,
                )
            clients[client.id] = client

        cases = {}
        for row in cases_payload:
            client = clients.get(row.get("clientId")) or Client.objects.filter(id=row.get("clientId")).first()
            if not client:
                continue
            responsible = user_for_name(row.get("responsible"))
            income = decimal_value(row.get("income"))
            debt = decimal_value(row.get("debt"))
            paid = decimal_value(row.get("paid")) if "paid" in row else max(Decimal("0"), income - debt)
            item, _ = Case.objects.update_or_create(
                number=row["id"],
                defaults={
                    "title": row.get("title", ""),
                    "client": client,
                    "practice_area": row.get("type", ""),
                    "stage": row.get("stage", ""),
                    "status": row.get("status", ""),
                    "priority": row.get("priority", ""),
                    "responsible": responsible,
                    "court_or_authority": row.get("court", ""),
                    "authority_type": row.get("authorityType", ""),
                    "authority_address": row.get("authorityAddress", ""),
                    "authority_contact": row.get("authorityContact", ""),
                    "description": row.get("description", ""),
                    "opened_at": parse_date(row.get("opened")),
                    "deadline_at": parse_date(row.get("deadline")),
                    "income_amount": income,
                    "paid_amount": paid,
                    "debt_amount": debt,
                    "finance_comment": row.get("financeComment", ""),
                    "history": row.get("history", []),
                },
            )
            item.documents.all().delete()
            item.tasks.all().delete()
            for document in row.get("documents", []):
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
                )
            for folder in row.get("folders", []):
                for document in folder.get("files", []):
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
                    )
            for task in row.get("tasks", []):
                planner_at = None
                if task.get("plannerDate"):
                    planner_at = parse_datetime(f"{task.get('plannerDate')} {task.get('plannerTime') or '09:00'}")
                Task.objects.create(
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
                )
            cases[item.number] = item

        CalendarEvent.objects.all().delete()
        for row in events_payload:
            case = cases.get(row.get("caseId")) or Case.objects.filter(number=row.get("caseId")).first()
            client = clients.get(row.get("clientId")) or Client.objects.filter(id=row.get("clientId")).first()
            CalendarEvent.objects.update_or_create(
                id=row["id"],
                defaults={
                    "title": row.get("title", ""),
                    "event_type": row.get("type", ""),
                    "starts_at": date_time_from_event(row, "time"),
                    "ends_at": date_time_from_event(row, "endTime"),
                    "client": client,
                    "case": case,
                    "authority": row.get("authority", ""),
                    "location": row.get("location", ""),
                    "responsible": user_for_name(row.get("responsible")),
                    "description": row.get("description", ""),
                    "recurrence": row.get("recurrence", ""),
                    "reminder_before": row.get("reminderBefore", ""),
                    "reminder_channels": row.get("reminderChannels", ""),
                    "reminder_recipients": row.get("reminderRecipients", ""),
                    "reminder_log": row.get("reminderLog", []),
                    "status": row.get("status", ""),
                },
            )

        if options.get("verbosity", 1) > 0:
            self.stdout.write(self.style.SUCCESS(
                f"Seeded {Client.objects.count()} clients, {Case.objects.count()} cases, "
                f"{Task.objects.count()} tasks, {CalendarEvent.objects.count()} events."
            ))
