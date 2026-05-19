from django.conf import settings
from django.db import models


class UserProfile(models.Model):
    class Role(models.TextChoices):
        ADMIN = "admin", "Адміністратор"
        LAWYER = "lawyer", "Адвокат"
        ASSISTANT = "assistant", "Помічник"
        ACCOUNTANT = "accountant", "Бухгалтер"

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="crm_profile")
    role = models.CharField(max_length=32, choices=Role.choices, default=Role.ASSISTANT)
    access_scope = models.CharField(max_length=255, blank=True)
    module_permissions = models.JSONField(default=list, blank=True)
    photo_label = models.CharField(max_length=8, blank=True)
    is_active_member = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.get_full_name() or self.user.username} · {self.get_role_display()}"
