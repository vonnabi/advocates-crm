from django.conf import settings
from django.db import models


class AuditLog(models.Model):
    class Action(models.TextChoices):
        CREATE = "create", "Створення"
        UPDATE = "update", "Оновлення"
        DELETE = "delete", "Видалення"
        LOGIN = "login", "Вхід"
        LOGOUT = "logout", "Вихід"
        SYSTEM = "system", "Система"

    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="audit_logs")
    actor_label = models.CharField(max_length=255, blank=True)
    action = models.CharField(max_length=32, choices=Action.choices)
    entity_type = models.CharField(max_length=64)
    entity_id = models.CharField(max_length=128, blank=True)
    entity_label = models.CharField(max_length=255, blank=True)
    summary = models.CharField(max_length=500)
    metadata = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(fields=["-created_at"], name="audit_audit_created_2e9dd7_idx"),
            models.Index(fields=["entity_type", "entity_id"], name="audit_audit_entity__4e32a1_idx"),
            models.Index(fields=["action"], name="audit_audit_action_3080a2_idx"),
        ]

    def __str__(self):
        return self.summary
