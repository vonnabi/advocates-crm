from django.contrib import admin

from .models import CRMSettings, UserProfile


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "role", "access_scope", "is_active_member", "updated_at")
    list_filter = ("role", "is_active_member")
    search_fields = ("user__first_name", "user__last_name", "user__email", "user__username", "access_scope")


@admin.register(CRMSettings)
class CRMSettingsAdmin(admin.ModelAdmin):
    list_display = ("key", "updated_at")
    fields = ("key", "bureau", "integrations", "integration_settings", "notifications", "updated_at")
    readonly_fields = ("updated_at",)
