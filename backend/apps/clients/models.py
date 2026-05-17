from django.conf import settings
from django.db import models


class Client(models.Model):
    class Status(models.TextChoices):
        NEW = "new", "Новий"
        ACTIVE = "active", "Активний"
        REGULAR = "regular", "Постійний клієнт"
        DO_NOT_CONTACT = "do_not_contact", "Не турбувати"

    full_name = models.CharField(max_length=255)
    client_type = models.CharField(max_length=128, blank=True)
    phone = models.CharField(max_length=64)
    email = models.EmailField(blank=True)
    address = models.CharField(max_length=255, blank=True)
    telegram_username = models.CharField(max_length=128, blank=True)
    telegram_chat_id = models.CharField(max_length=128, blank=True)
    telegram_connected = models.BooleanField(default=False)
    photo_url = models.URLField(blank=True)
    show_photo = models.BooleanField(default=False)
    request_summary = models.TextField(blank=True)
    source = models.CharField(max_length=128, blank=True)
    status = models.CharField(max_length=32, choices=Status.choices, default=Status.NEW)
    responsible = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    consent_to_marketing = models.BooleanField(default=False)
    risk_level = models.CharField(max_length=64, blank=True)
    next_action = models.CharField(max_length=255, blank=True)
    notes = models.TextField(blank=True)
    added_at = models.DateField(null=True, blank=True)
    last_contact_at = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.full_name


class ClientCommunication(models.Model):
    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name="communications")
    date = models.DateField(null=True, blank=True)
    channel = models.CharField(max_length=64)
    title = models.CharField(max_length=255)
    status = models.CharField(max_length=64, blank=True)
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    case = models.ForeignKey("cases.Case", on_delete=models.SET_NULL, null=True, blank=True, related_name="client_communications")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.client} · {self.channel} · {self.title}"
