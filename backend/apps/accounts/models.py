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
    photo_label = models.CharField(max_length=255, blank=True)
    is_active_member = models.BooleanField(default=True)
    password_temporary = models.BooleanField(default=False)
    password_updated_at = models.DateTimeField(null=True, blank=True)
    last_login_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.get_full_name() or self.user.username} · {self.get_role_display()}"


class CRMSettings(models.Model):
    DEFAULT_BUREAU = {
        "name": "Advocates Bureau",
        "email": "admin@advocates.ua",
        "phone": "+380 44 000 11 22",
        "address": "м. Київ, вул. Дегтярівська, 31",
        "logo": "assets/advocates-crm-logo.png",
        "instagram": "",
        "facebook": "",
        "tiktok": "",
        "whatsapp": "+380 44 000 11 22",
        "telegram": "@advocates_bureau",
        "website": "https://advocates.ua",
    }
    DEFAULT_INTEGRATIONS = {
        "Telegram": True,
        "SMS": True,
        "Email": False,
        "AI": True,
    }
    DEFAULT_NOTIFICATIONS = {
        "deadlines": True,
        "court": True,
        "mailings": True,
    }
    DEFAULT_INTEGRATION_SETTINGS = {
        "Telegram": {
            "botToken": "",
            "chatId": "",
            "webhookUrl": "",
        },
        "SMS": {
            "provider": "TurboSMS",
            "sender": "Advocates",
            "apiKey": "",
        },
        "Email": {
            "senderEmail": "admin@advocates.ua",
            "senderName": "Advocates Bureau",
            "smtpHost": "",
            "smtpPort": "587",
        },
        "AI": {
            "model": "demo",
            "workspace": "cases",
        },
    }

    key = models.CharField(max_length=64, unique=True, default="global")
    bureau = models.JSONField(default=dict, blank=True)
    integrations = models.JSONField(default=dict, blank=True)
    integration_settings = models.JSONField(default=dict, blank=True)
    notifications = models.JSONField(default=dict, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "CRM settings"
        verbose_name_plural = "CRM settings"

    def __str__(self):
        return self.bureau.get("name") or "CRM settings"
