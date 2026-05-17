from django.contrib import admin

from .models import Expense, Invoice, Payment


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ("number", "client", "case", "amount", "issued_at", "due_at", "status")
    list_filter = ("status", "issued_at", "due_at")
    search_fields = ("number", "client__full_name", "case__number")


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ("client", "case", "amount", "paid_at", "method")
    list_filter = ("method", "paid_at")
    search_fields = ("client__full_name", "case__number", "comment")


@admin.register(Expense)
class ExpenseAdmin(admin.ModelAdmin):
    list_display = ("category", "client", "case", "amount", "spent_at")
    list_filter = ("category", "spent_at")
    search_fields = ("category", "client__full_name", "case__number", "comment")
