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
    court_or_authority = models.CharField(max_length=255, blank=True)
    authority_type = models.CharField(max_length=128, blank=True)
    authority_address = models.CharField(max_length=255, blank=True)
    authority_contact = models.CharField(max_length=128, blank=True)
    authority_email = models.EmailField(blank=True)
    parties = models.JSONField(default=list, blank=True)
    description = models.TextField(blank=True)
    opened_at = models.DateField(null=True, blank=True)
    deadline_at = models.DateField(null=True, blank=True)
    closed_at = models.DateField(null=True, blank=True)
    income_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    paid_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    debt_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    first_payment_at = models.DateField(null=True, blank=True)
    next_payment_due_at = models.DateField(null=True, blank=True)
    finance_comment = models.TextField(blank=True)
    history = models.JSONField(default=list, blank=True)
    procedural_actions = models.JSONField(default=list, blank=True)
    document_folders = models.JSONField(default=list, blank=True)
    is_demo = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"№{self.number} · {self.title}"


class CaseMember(models.Model):
    class Role(models.TextChoices):
        LAWYER = "lawyer", "Адвокат"
        ASSISTANT = "assistant", "Помічник"
        ACCOUNTANT = "accountant", "Бухгалтер"
        OBSERVER = "observer", "Спостерігач"

    case = models.ForeignKey(Case, on_delete=models.CASCADE, related_name="team_members")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="assigned_cases")
    role = models.CharField(max_length=32, choices=Role.choices, default=Role.OBSERVER)
    can_edit = models.BooleanField(default=True)
    is_demo = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["case", "user"], name="unique_case_member"),
        ]

    def __str__(self):
        return f"{self.case.number} · {self.user}"


class CaseDocument(models.Model):
    case = models.ForeignKey(Case, on_delete=models.CASCADE, related_name="documents")
    title = models.CharField(max_length=255)
    document_type = models.CharField(max_length=128, blank=True)
    status = models.CharField(max_length=128, blank=True)
    folder = models.CharField(max_length=128, blank=True)
    file = models.FileField(upload_to="case_documents/", blank=True)
    external_url = models.URLField(blank=True)
    submitted_at = models.DateField(null=True, blank=True)
    response_due_at = models.DateField(null=True, blank=True)
    responsible_name = models.CharField(max_length=128, blank=True)
    comment = models.TextField(blank=True)
    content = models.TextField(blank=True)
    history = models.JSONField(default=list, blank=True)
    is_demo = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title
