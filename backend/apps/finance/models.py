from decimal import Decimal

from django.db import models


class Invoice(models.Model):
    case = models.ForeignKey("cases.Case", on_delete=models.PROTECT, related_name="invoices")
    client = models.ForeignKey("clients.Client", on_delete=models.PROTECT, related_name="invoices")
    number = models.CharField(max_length=64, unique=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    issued_at = models.DateField()
    due_at = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=64, default="draft")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.number


class Payment(models.Model):
    invoice = models.ForeignKey(Invoice, on_delete=models.SET_NULL, null=True, blank=True, related_name="payments")
    case = models.ForeignKey("cases.Case", on_delete=models.PROTECT, related_name="payments")
    client = models.ForeignKey("clients.Client", on_delete=models.PROTECT, related_name="payments")
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    paid_at = models.DateField()
    method = models.CharField(max_length=128, blank=True)
    comment = models.TextField(blank=True)

    def __str__(self):
        return f"{self.amount} · {self.client}"


class Expense(models.Model):
    case = models.ForeignKey("cases.Case", on_delete=models.SET_NULL, null=True, blank=True, related_name="expenses")
    client = models.ForeignKey("clients.Client", on_delete=models.SET_NULL, null=True, blank=True, related_name="expenses")
    category = models.CharField(max_length=128)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    spent_at = models.DateField()
    comment = models.TextField(blank=True)

    def __str__(self):
        return f"{self.category}: {self.amount}"


def case_debt(total, paid):
    return max(Decimal("0.00"), total - paid)
