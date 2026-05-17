from django.contrib import admin

from .models import Client, ClientCommunication


class ClientCommunicationInline(admin.TabularInline):
    model = ClientCommunication
    extra = 0
    fields = ("date", "channel", "title", "status", "case")


@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    list_display = ("full_name", "phone", "status", "telegram_connected", "responsible", "last_contact_at")
    list_filter = ("status", "client_type", "telegram_connected", "source")
    search_fields = ("full_name", "phone", "email", "telegram_username")
    inlines = (ClientCommunicationInline,)


@admin.register(ClientCommunication)
class ClientCommunicationAdmin(admin.ModelAdmin):
    list_display = ("client", "date", "channel", "title", "status", "author")
    list_filter = ("channel", "status", "date")
    search_fields = ("client__full_name", "title")
