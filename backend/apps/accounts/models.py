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
    phone = models.CharField(max_length=64, blank=True)
    module_permissions = models.JSONField(default=list, blank=True)
    # Holds initials, a photo URL, or an uploaded (resized) data: URL — hence TextField.
    photo_label = models.TextField(blank=True)
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
        "Е-підпис": False,
        "ONLYOFFICE": False,
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
        "Е-підпис": {
            "provider": "Вчасно або Дія.Підпис",
            "apiToken": "",
            "callbackUrl": "",
            "edrpou": "",
        },
        "ONLYOFFICE": {
            "documentServerUrl": "http://127.0.0.1:8082",
            "serverAccessUrl": "http://host.docker.internal:8001",
            "callbackUrl": "http://127.0.0.1:8001/api/documents/{id}/onlyoffice/callback/",
            "jwtSecret": "",
        },
        "AI": {
            "apiKey": "",
            "model": "claude-opus-4-8",
            "budgetUsd": "",
        },
    }

    key = models.CharField(max_length=64, unique=True, default="global")
    bureau = models.JSONField(default=dict, blank=True)
    integrations = models.JSONField(default=dict, blank=True)
    integration_settings = models.JSONField(default=dict, blank=True)
    notifications = models.JSONField(default=dict, blank=True)
    document_archive_folders = models.JSONField(default=list, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "CRM settings"
        verbose_name_plural = "CRM settings"

    def __str__(self):
        return self.bureau.get("name") or "CRM settings"


class AiSkill(models.Model):
    """A per-area "skill": the bureau's own expertise/instructions for a branch of
    law (family, criminal, …). Injected into the AI помічник's system prompt so it
    specialises. Editable, exportable and clearable from the UI — not model training.
    """

    area_key = models.CharField(max_length=64, unique=True)
    title = models.CharField(max_length=128, blank=True)
    content = models.TextField(blank=True)
    # Editable per-area quick questions shown as chips in the chat composer.
    questions = models.JSONField(default=list, blank=True)
    # Real usage counter — replaces the old hardcoded demo numbers in the UI.
    request_count = models.PositiveIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "AI skill"
        verbose_name_plural = "AI skills"

    def __str__(self):
        return f"AiSkill<{self.area_key}>"


class AiUsage(models.Model):
    """Cumulative Anthropic token usage — lets the UI show spend and estimate the
    remaining budget/requests. Anthropic does not expose the live account balance
    via the API, so this is our own running total from each response's usage.
    """

    key = models.CharField(max_length=32, unique=True, default="global")
    request_count = models.PositiveIntegerField(default=0)
    input_tokens = models.PositiveBigIntegerField(default=0)
    output_tokens = models.PositiveBigIntegerField(default=0)
    cache_read_tokens = models.PositiveBigIntegerField(default=0)
    cache_write_tokens = models.PositiveBigIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"AiUsage<{self.request_count} requests>"


class AiCaseAssistant(models.Model):
    """A case explicitly connected to an AI помічник. Cases are opt-in: only the
    ones the bureau connects appear in the AI помічники list (not every case).
    """

    case_number = models.CharField(max_length=64, unique=True)
    # Toggleable: an inactive (paused) assistant stays connected but is marked off.
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "AI case assistant"
        verbose_name_plural = "AI case assistants"
        ordering = ["-created_at"]

    def __str__(self):
        return f"AiCaseAssistant<{self.case_number}>"


class AiKnowledgeDoc(models.Model):
    """A knowledge file (template, methodology, checklist) uploaded per branch of
    law. Its extracted text is injected into the AI помічник's prompt so the model
    answers using the bureau's own materials. Этап 2 of the AI помічники rework.
    """

    area_key = models.CharField(max_length=64, db_index=True)
    filename = models.CharField(max_length=255)
    content = models.TextField(blank=True)  # extracted plain text
    size_chars = models.PositiveIntegerField(default=0)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "AI knowledge doc"
        verbose_name_plural = "AI knowledge docs"
        ordering = ["-uploaded_at"]

    def __str__(self):
        return f"AiKnowledgeDoc<{self.area_key}:{self.filename}>"
