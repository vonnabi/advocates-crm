from django.conf import settings
from django.db import models


class Case(models.Model):
    class Status(models.TextChoices):
        NEW = "new", "Нова"
        IN_PROGRESS = "in_progress", "В роботі"
        WAITING = "waiting", "Очікує відповідь"
        URGENT = "urgent", "Терміново"
        CLOSED = "closed", "Закрита"

    number = models.CharField(max_length=64, unique=True)
    title = models.CharField(max_length=255)
    client = models.ForeignKey("clients.Client", on_delete=models.PROTECT, related_name="cases")
    practice_area = models.CharField(max_length=128)
    stage = models.CharField(max_length=255, blank=True)
    status = models.CharField(max_length=32, choices=Status.choices, default=Status.NEW)
    priority = models.CharField(max_length=64, default="Звичайний")
    responsible = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    description = models.TextField(blank=True)
    opened_at = models.DateField(null=True, blank=True)
    closed_at = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"№{self.number} · {self.title}"


class CaseDocument(models.Model):
    case = models.ForeignKey(Case, on_delete=models.CASCADE, related_name="documents")
    title = models.CharField(max_length=255)
    document_type = models.CharField(max_length=128, blank=True)
    status = models.CharField(max_length=128, blank=True)
    file = models.FileField(upload_to="case_documents/", blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title
