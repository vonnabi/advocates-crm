from django.contrib import admin

from .models import CalendarEvent, Reminder


@admin.register(CalendarEvent)
class CalendarEventAdmin(admin.ModelAdmin):
    list_display = ("title", "event_type", "starts_at", "status", "client", "case", "responsible")
    list_filter = ("event_type", "status", "starts_at")
    search_fields = ("title", "client__full_name", "case__number", "authority", "location")


@admin.register(Reminder)
class ReminderAdmin(admin.ModelAdmin):
    list_display = ("event", "channel", "remind_at", "delivery_status", "recipient", "client_recipient")
    list_filter = ("channel", "delivery_status")
    search_fields = ("event__title", "recipient__username", "client_recipient__full_name")
