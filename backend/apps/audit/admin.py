from django.contrib import admin

from .models import AuditLog


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ("created_at", "actor_label", "action", "entity_type", "entity_label", "summary")
    list_filter = ("action", "entity_type", "created_at")
    search_fields = ("actor_label", "entity_label", "summary", "entity_id")
    readonly_fields = ("created_at",)
