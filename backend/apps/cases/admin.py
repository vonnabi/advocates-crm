from django.contrib import admin

from .models import Case, CaseDocument


class CaseDocumentInline(admin.TabularInline):
    model = CaseDocument
    extra = 0
    fields = ("title", "folder", "status", "submitted_at", "response_due_at")


@admin.register(Case)
class CaseAdmin(admin.ModelAdmin):
    list_display = ("number", "client", "title", "status", "priority", "deadline_at", "income_amount", "debt_amount")
    list_filter = ("status", "priority", "practice_area", "opened_at")
    search_fields = ("number", "title", "client__full_name", "court_or_authority")
    inlines = (CaseDocumentInline,)


@admin.register(CaseDocument)
class CaseDocumentAdmin(admin.ModelAdmin):
    list_display = ("title", "case", "folder", "status", "submitted_at", "response_due_at")
    list_filter = ("folder", "status")
    search_fields = ("title", "case__number", "case__client__full_name")
