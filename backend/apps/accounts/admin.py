from django.contrib import admin

from .models import UserProfile


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "role", "access_scope", "is_active_member", "updated_at")
    list_filter = ("role", "is_active_member")
    search_fields = ("user__first_name", "user__last_name", "user__email", "user__username", "access_scope")
