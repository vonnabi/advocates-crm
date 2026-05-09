from django.conf import settings
from django.db import models


class Task(models.Model):
    class Status(models.TextChoices):
        TODO = "todo", "Потрібно зробити"
        IN_PROGRESS = "in_progress", "В роботі"
        DONE = "done", "Виконано"
        MOVED = "moved", "Перенесено"
        OVERDUE = "overdue", "Просрочено"

    title = models.CharField(max_length=255)
    client = models.ForeignKey("clients.Client", on_delete=models.SET_NULL, null=True, blank=True)
    case = models.ForeignKey("cases.Case", on_delete=models.SET_NULL, null=True, blank=True, related_name="tasks")
    responsible = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    due_at = models.DateTimeField(null=True, blank=True)
    priority = models.CharField(max_length=64, default="Планова")
    status = models.CharField(max_length=32, choices=Status.choices, default=Status.TODO)
    source = models.CharField(max_length=64, default="manual")
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title
