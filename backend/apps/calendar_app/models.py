from django.conf import settings
from django.db import models


class CalendarEvent(models.Model):
    class EventType(models.TextChoices):
        COURT = "court", "Судове засідання"
        CLIENT_MEETING = "client_meeting", "Зустріч з клієнтом"
        CONSULTATION = "consultation", "Консультація"
        DOCUMENT = "document", "Підготовка/подача документа"
        DEADLINE = "deadline", "Крайній строк"
        WAITING = "waiting", "Ожидання відповіді"
        INTERNAL = "internal", "Внутрішня задача"
        OTHER = "other", "Інше"

    class Status(models.TextChoices):
        PLANNED = "planned", "Заплановано"
        WAITING = "waiting", "Очікує виконання"
        DONE = "done", "Виконано"
        MOVED = "moved", "Перенесено"
        CANCELLED = "cancelled", "Скасовано"
        OVERDUE = "overdue", "Просрочено"

    title = models.CharField(max_length=255)
    event_type = models.CharField(max_length=32, choices=EventType.choices)
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField(null=True, blank=True)
    client = models.ForeignKey("clients.Client", on_delete=models.SET_NULL, null=True, blank=True)
    case = models.ForeignKey("cases.Case", on_delete=models.SET_NULL, null=True, blank=True, related_name="events")
    authority = models.CharField(max_length=255, blank=True)
    location = models.CharField(max_length=255, blank=True)
    responsible = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    description = models.TextField(blank=True)
    status = models.CharField(max_length=32, choices=Status.choices, default=Status.PLANNED)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title


class Reminder(models.Model):
    class Channel(models.TextChoices):
        CRM = "crm", "CRM"
        TELEGRAM = "telegram", "Telegram"
        SMS = "sms", "SMS"
        EMAIL = "email", "Email"

    event = models.ForeignKey(CalendarEvent, on_delete=models.CASCADE, related_name="reminders")
    channel = models.CharField(max_length=32, choices=Channel.choices)
    remind_at = models.DateTimeField()
    recipient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    client_recipient = models.ForeignKey("clients.Client", on_delete=models.SET_NULL, null=True, blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    delivery_status = models.CharField(max_length=64, default="pending")
