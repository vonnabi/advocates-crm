from django.contrib import admin

from .models import Task


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ("title", "case", "client", "responsible", "priority", "status", "due_at")
    list_filter = ("priority", "status", "show_in_calendar", "planner_manual", "due_at")
    search_fields = ("title", "case__number", "client__full_name", "description")
