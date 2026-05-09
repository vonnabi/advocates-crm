from django.conf import settings
from django.db import models


class MessageTemplate(models.Model):
    title = models.CharField(max_length=255)
    category = models.CharField(max_length=128)
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title


class Campaign(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "Чернетка"
        PLANNED = "planned", "Запланована"
        SENDING = "sending", "Відправляється"
        SENT = "sent", "Відправлена"
        PARTIAL = "partial", "Частково відправлена"
        ERROR = "error", "Помилка"
        CANCELLED = "cancelled", "Скасована"

    title = models.CharField(max_length=255)
    body = models.TextField()
    channels = models.JSONField(default=list)
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    scheduled_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=32, choices=Status.choices, default=Status.DRAFT)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title


class MessageDelivery(models.Model):
    campaign = models.ForeignKey(Campaign, on_delete=models.CASCADE, related_name="deliveries")
    client = models.ForeignKey("clients.Client", on_delete=models.CASCADE, related_name="message_deliveries")
    channel = models.CharField(max_length=32)
    status = models.CharField(max_length=64, default="pending")
    error = models.TextField(blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
