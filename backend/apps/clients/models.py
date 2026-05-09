from django.conf import settings
from django.db import models


class Client(models.Model):
    class Status(models.TextChoices):
        NEW = "new", "Новий"
        ACTIVE = "active", "Активний"
        REGULAR = "regular", "Постійний клієнт"
        DO_NOT_CONTACT = "do_not_contact", "Не турбувати"

    full_name = models.CharField(max_length=255)
    phone = models.CharField(max_length=64)
    email = models.EmailField(blank=True)
    telegram_username = models.CharField(max_length=128, blank=True)
    telegram_chat_id = models.CharField(max_length=128, blank=True)
    telegram_connected = models.BooleanField(default=False)
    request_summary = models.TextField(blank=True)
    source = models.CharField(max_length=128, blank=True)
    status = models.CharField(max_length=32, choices=Status.choices, default=Status.NEW)
    responsible = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    consent_to_marketing = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.full_name
