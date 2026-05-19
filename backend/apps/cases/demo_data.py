from django.db import transaction

from apps.calendar_app.models import CalendarEvent, Reminder
from apps.cases.models import Case, CaseDocument, CaseMember
from apps.clients.models import Client, ClientCommunication
from apps.communications.models import Campaign, MessageDelivery, MessageTemplate
from apps.finance.models import Expense, Invoice, Payment
from apps.tasks.models import Task


def demo_data_counts():
    return {
        "clients": Client.objects.filter(is_demo=True).count(),
        "cases": Case.objects.filter(is_demo=True).count(),
        "tasks": Task.objects.filter(is_demo=True).count(),
        "documents": CaseDocument.objects.filter(is_demo=True).count(),
        "events": CalendarEvent.objects.filter(is_demo=True).count(),
        "financeOperations": (
            Payment.objects.filter(is_demo=True).count()
            + Invoice.objects.filter(is_demo=True).count()
            + Expense.objects.filter(is_demo=True).count()
        ),
        "communications": ClientCommunication.objects.filter(is_demo=True).count(),
        "campaigns": Campaign.objects.filter(is_demo=True).count(),
    }


def case_has_user_records(case):
    return (
        case.documents.filter(is_demo=False).exists()
        or case.tasks.filter(is_demo=False).exists()
        or case.events.filter(is_demo=False).exists()
        or case.client_communications.filter(is_demo=False).exists()
        or case.payments.filter(is_demo=False).exists()
        or case.invoices.filter(is_demo=False).exists()
        or case.expenses.filter(is_demo=False).exists()
    )


def client_has_user_records(client):
    return (
        client.cases.exists()
        or client.communications.filter(is_demo=False).exists()
        or client.message_deliveries.filter(is_demo=False).exists()
        or Task.objects.filter(client=client, is_demo=False).exists()
        or CalendarEvent.objects.filter(client=client, is_demo=False).exists()
        or Payment.objects.filter(client=client, is_demo=False).exists()
        or Invoice.objects.filter(client=client, is_demo=False).exists()
        or Expense.objects.filter(client=client, is_demo=False).exists()
    )


def clear_demo_business_data():
    with transaction.atomic():
        MessageDelivery.objects.filter(is_demo=True).delete()
        Campaign.objects.filter(is_demo=True).delete()
        MessageTemplate.objects.filter(is_demo=True).delete()
        Reminder.objects.filter(is_demo=True).delete()
        Payment.objects.filter(is_demo=True).delete()
        Invoice.objects.filter(is_demo=True).delete()
        Expense.objects.filter(is_demo=True).delete()
        CalendarEvent.objects.filter(is_demo=True).delete()
        Task.objects.filter(is_demo=True).delete()
        CaseDocument.objects.filter(is_demo=True).delete()
        CaseMember.objects.filter(is_demo=True).delete()
        ClientCommunication.objects.filter(is_demo=True).delete()

        for case in Case.objects.filter(is_demo=True).order_by("id"):
            if case_has_user_records(case):
                case.is_demo = False
                case.save(update_fields=["is_demo"])
            else:
                case.delete()

        for client in Client.objects.filter(is_demo=True).order_by("id"):
            if client_has_user_records(client):
                client.is_demo = False
                client.save(update_fields=["is_demo"])
            else:
                client.delete()
