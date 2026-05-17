from django.contrib import admin

from .models import Campaign, MessageDelivery, MessageTemplate


@admin.register(MessageTemplate)
class MessageTemplateAdmin(admin.ModelAdmin):
    list_display = ("title", "category", "created_at")
    list_filter = ("category",)
    search_fields = ("title", "body")


class MessageDeliveryInline(admin.TabularInline):
    model = MessageDelivery
    extra = 0
    fields = ("client", "channel", "status", "sent_at", "delivered_at")


@admin.register(Campaign)
class CampaignAdmin(admin.ModelAdmin):
    list_display = ("title", "status", "scheduled_at", "author", "created_at")
    list_filter = ("status", "scheduled_at", "created_at")
    search_fields = ("title", "body")
    inlines = (MessageDeliveryInline,)


@admin.register(MessageDelivery)
class MessageDeliveryAdmin(admin.ModelAdmin):
    list_display = ("campaign", "client", "channel", "status", "sent_at", "delivered_at")
    list_filter = ("channel", "status")
    search_fields = ("campaign__title", "client__full_name")
