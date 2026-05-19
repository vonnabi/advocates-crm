from django.db import migrations


DEMO_CLIENTS = [
    (1, "Петренко Іван Миколайович", "+380 96 123 45 67"),
    (2, "Коваленко Олександр Сергійович", "+380 97 234 56 78"),
    (3, "Шевченко Марія Ігорівна", "+380 63 345 67 89"),
    (4, "Бондаренко Дмитро Єфремович", "+380 95 456 78 90"),
]
DEMO_CASE_NUMBERS = ["2024/12345", "2024/5678", "2024/4321", "2024/9999"]
DEMO_EVENT_IDS = [1, 2, 3, 4, 5, 6]


def mark_existing_demo_data(apps, schema_editor):
    Client = apps.get_model("clients", "Client")
    ClientCommunication = apps.get_model("clients", "ClientCommunication")
    Case = apps.get_model("cases", "Case")
    CaseDocument = apps.get_model("cases", "CaseDocument")
    Task = apps.get_model("tasks", "Task")
    CalendarEvent = apps.get_model("calendar_app", "CalendarEvent")
    Reminder = apps.get_model("calendar_app", "Reminder")
    Payment = apps.get_model("finance", "Payment")
    Invoice = apps.get_model("finance", "Invoice")
    Expense = apps.get_model("finance", "Expense")
    for client_id, full_name, phone in DEMO_CLIENTS:
        Client.objects.filter(id=client_id, full_name=full_name, phone=phone).update(is_demo=True)
    demo_client_ids = list(Client.objects.filter(is_demo=True).values_list("id", flat=True))

    Case.objects.filter(number__in=DEMO_CASE_NUMBERS).update(is_demo=True)
    ClientCommunication.objects.filter(client_id__in=demo_client_ids).update(is_demo=True)
    CaseDocument.objects.filter(case__number__in=DEMO_CASE_NUMBERS).update(is_demo=True)
    Task.objects.filter(case__number__in=DEMO_CASE_NUMBERS).update(is_demo=True)
    Task.objects.filter(client_id__in=demo_client_ids).update(is_demo=True)
    CalendarEvent.objects.filter(id__in=DEMO_EVENT_IDS).update(is_demo=True)
    CalendarEvent.objects.filter(case__number__in=DEMO_CASE_NUMBERS).update(is_demo=True)
    CalendarEvent.objects.filter(client_id__in=demo_client_ids).update(is_demo=True)
    Reminder.objects.filter(event__is_demo=True).update(is_demo=True)
    Payment.objects.filter(case__number__in=DEMO_CASE_NUMBERS).update(is_demo=True)
    Payment.objects.filter(client_id__in=demo_client_ids).update(is_demo=True)
    Invoice.objects.filter(case__number__in=DEMO_CASE_NUMBERS).update(is_demo=True)
    Invoice.objects.filter(client_id__in=demo_client_ids).update(is_demo=True)
    Expense.objects.filter(case__number__in=DEMO_CASE_NUMBERS).update(is_demo=True)
    Expense.objects.filter(client_id__in=demo_client_ids).update(is_demo=True)


class Migration(migrations.Migration):

    dependencies = [
        ("calendar_app", "0003_calendarevent_is_demo_reminder_is_demo"),
        ("cases", "0003_case_is_demo_casedocument_is_demo"),
        ("clients", "0002_client_is_demo_clientcommunication_is_demo"),
        ("communications", "0002_campaign_is_demo_messagedelivery_is_demo_and_more"),
        ("finance", "0002_expense_is_demo_invoice_is_demo_payment_is_demo"),
        ("tasks", "0002_task_is_demo"),
    ]

    operations = [
        migrations.RunPython(mark_existing_demo_data, migrations.RunPython.noop),
    ]
