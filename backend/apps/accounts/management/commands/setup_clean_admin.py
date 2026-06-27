"""Prepare the CRM for handover to the customer.

Wipes every piece of demo/business data and leaves a single clean admin account
the customer can log in with and manage everything. Safe to re-run.

Examples
--------
# Clean slate + admin "admin" with a password you choose:
    python manage.py setup_clean_admin --password 'LaqZ-pdJ5-xeaP'

# Clean slate + admin with an auto-generated strong password (printed once):
    python manage.py setup_clean_admin

# Only (re)create/repair the admin, keep existing data and users:
    python manage.py setup_clean_admin --keep-data --keep-users --password '...'
"""

import secrets

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.accounts.models import CRMSettings, UserProfile
from apps.audit.models import AuditLog
from apps.cases.demo_data import clear_all_business_data

# Readable alphabet: drops the ambiguous 0/O/1/l/I so the password is easy to dictate.
PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"


def generate_password():
    """A grouped 12-char password (e.g. LaqZ-pdJ5-xeaP) — strong but easy to share."""
    chunks = ["".join(secrets.choice(PASSWORD_ALPHABET) for _ in range(4)) for _ in range(3)]
    return "-".join(chunks)


class Command(BaseCommand):
    help = "Wipe all CRM data and (re)create a single clean admin account for customer handover."

    def add_arguments(self, parser):
        parser.add_argument("--username", default="admin", help="Admin login (default: admin).")
        parser.add_argument("--email", default="admin@advokatcrm.com", help="Admin email.")
        parser.add_argument(
            "--password",
            default="",
            help="Admin password. If omitted, a strong one is generated and printed.",
        )
        parser.add_argument(
            "--keep-data",
            action="store_true",
            help="Do not wipe business data (clients, cases, finance, mailings, audit).",
        )
        parser.add_argument(
            "--keep-users",
            action="store_true",
            help="Do not delete other existing users; only upsert the admin.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        username = (options["username"] or "admin").strip()
        email = (options["email"] or "").strip()
        password = options["password"] or generate_password()

        User = get_user_model()

        if not options["keep_data"]:
            clear_all_business_data()
            AuditLog.objects.all().delete()
            # Blank the bureau profile so the customer starts from empty fields. Storing
            # explicit empty strings is required: the API only serves the built-in
            # "Advocates Bureau" demo defaults for keys that are *missing*, not empty.
            settings_row, _ = CRMSettings.objects.get_or_create(key="global")
            settings_row.bureau = {key: "" for key in CRMSettings.DEFAULT_BUREAU}
            settings_row.save(update_fields=["bureau", "updated_at"])
            self.stdout.write("· Wiped all business data, the audit log and the bureau profile.")

        if not options["keep_users"]:
            removed, _ = User.objects.exclude(username=username).delete()
            self.stdout.write(f"· Removed {removed} existing account(s); keeping only '{username}'.")

        user, created = User.objects.get_or_create(username=username)
        user.email = email
        user.first_name = "Адміністратор"
        user.is_staff = True
        user.is_superuser = True
        user.is_active = True
        user.set_password(password)
        user.save()

        profile, _ = UserProfile.objects.get_or_create(user=user)
        profile.role = UserProfile.Role.ADMIN
        profile.access_scope = "Повний доступ"
        profile.module_permissions = []
        profile.photo_label = profile.photo_label or "АД"
        profile.is_active_member = True
        profile.password_temporary = False
        profile.password_updated_at = timezone.now()
        profile.save()

        verb = "Created" if created else "Updated"
        self.stdout.write(self.style.SUCCESS("\n================ CLEAN ADMIN READY ================"))
        self.stdout.write(self.style.SUCCESS(f"  {verb} admin account:"))
        self.stdout.write(self.style.SUCCESS(f"  Логін:  {username}"))
        self.stdout.write(self.style.SUCCESS(f"  Email:  {email}"))
        self.stdout.write(self.style.SUCCESS(f"  Пароль: {password}"))
        self.stdout.write(self.style.SUCCESS("===================================================\n"))
        self.stdout.write("Save the password now — it is not stored anywhere else in clear text.")
