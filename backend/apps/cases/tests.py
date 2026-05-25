from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.db.models import Q
from django.test import TestCase
from django.utils import timezone
from io import BytesIO
from unittest.mock import patch
from urllib.parse import urlsplit
from zipfile import ZipFile

from apps.accounts.models import CRMSettings, UserProfile
from apps.audit.models import AuditLog
from apps.calendar_app.models import CalendarEvent
from apps.cases.models import Case, CaseDocument, CaseMember
from apps.clients.models import Client, ClientCommunication
from apps.communications.models import AutomationRule, Campaign, MessageDelivery, MessageTemplate
from apps.finance.models import Expense, Invoice, Payment
from apps.tasks.models import Task


def demo_case_number(suffix):
    return f"{timezone.localdate().year}/{suffix}"


class DemoApiTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_demo", clear=True, verbosity=0)

    def test_bootstrap_api_returns_seeded_crm_data(self):
        response = self.client.get("/api/bootstrap/")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual({key: payload["meta"][key] for key in ("clients", "cases", "tasks", "events")}, {"clients": 5, "cases": 5, "tasks": 9, "events": 6})
        self.assertTrue(payload["meta"]["demoData"]["enabled"])
        self.assertEqual(Client.objects.filter(is_demo=True).count(), 5)
        self.assertEqual(Case.objects.filter(is_demo=True).count(), 5)
        self.assertEqual(Task.objects.filter(is_demo=True).count(), 9)
        self.assertEqual(CalendarEvent.objects.filter(is_demo=True).count(), 6)
        self.assertGreater(CaseMember.objects.filter(is_demo=True).count(), 0)
        self.assertEqual(payload["finance"]["income"], 107000.0)
        self.assertEqual(payload["finance"]["debt"], 23500.0)
        self.assertTrue(payload["clients"])
        self.assertTrue(payload["cases"])

    def test_case_scope_limits_non_admin_bootstrap_and_details(self):
        assistant = get_user_model().objects.get(email="kravchuk@advocates.crm")
        login_response = self.client.post(
            "/api/auth/login/",
            {"email": "kravchuk@advocates.crm", "password": "demo12345"},
            content_type="application/json",
        )
        self.assertEqual(login_response.status_code, 200)

        bootstrap = self.client.get("/api/bootstrap/").json()
        visible_numbers = {item["id"] for item in bootstrap["cases"]}
        assistant_name = assistant.get_full_name() or assistant.username
        expected_numbers = set(
            Case.objects.filter(
                Q(responsible=assistant)
                | Q(team_members__user=assistant)
                | Q(tasks__responsible=assistant)
                | Q(events__responsible=assistant)
                | Q(documents__responsible_name=assistant_name)
            ).distinct().values_list("number", flat=True)
        )
        self.assertEqual(visible_numbers, expected_numbers)
        self.assertLess(len(visible_numbers), Case.objects.count())

        hidden_case = Case.objects.exclude(number__in=visible_numbers).first()
        self.assertIsNotNone(hidden_case)
        detail_response = self.client.get(f"/api/cases/{hidden_case.number}/")
        self.assertEqual(detail_response.status_code, 403)
        hidden_task_response = self.client.post(
            "/api/tasks/",
            {"caseId": hidden_case.number, "clientId": hidden_case.client_id, "title": "Прихована задача"},
            content_type="application/json",
        )
        self.assertEqual(hidden_task_response.status_code, 403)

    def test_demo_data_api_clears_and_restores_business_data(self):
        manual_client = Client.objects.create(
            full_name="Реальний клієнт",
            client_type="Фізична особа",
            phone="+380 99 111 22 33",
            email="real.client@example.com",
            status="active",
        )
        manual_case = Case.objects.create(
            number=demo_case_number("9001"),
            title="Реальна справа",
            client=manual_client,
            practice_area="Цивільна",
            status="В роботі",
            priority="Середній",
            opened_at=timezone.localdate(),
        )
        Task.objects.create(
            title="Реальна задача",
            client=manual_client,
            case=manual_case,
            status="Нова",
            priority="Середній",
        )

        status_response = self.client.get("/api/demo-data/")
        self.assertEqual(status_response.status_code, 200)
        self.assertTrue(status_response.json()["enabled"])

        clear_response = self.client.post(
            "/api/demo-data/",
            {"action": "clear"},
            content_type="application/json",
        )
        self.assertEqual(clear_response.status_code, 200)
        self.assertFalse(clear_response.json()["demoData"]["enabled"])
        self.assertEqual(Client.objects.filter(is_demo=True).count(), 0)
        self.assertEqual(Case.objects.filter(is_demo=True).count(), 0)
        self.assertEqual(Task.objects.filter(is_demo=True).count(), 0)
        self.assertEqual(CaseDocument.objects.filter(is_demo=True).count(), 0)
        self.assertEqual(CaseMember.objects.filter(is_demo=True).count(), 0)
        self.assertEqual(CalendarEvent.objects.filter(is_demo=True).count(), 0)
        self.assertEqual(Payment.objects.filter(is_demo=True).count() + Invoice.objects.filter(is_demo=True).count() + Expense.objects.filter(is_demo=True).count(), 0)
        self.assertTrue(Client.objects.filter(pk=manual_client.pk).exists())
        self.assertTrue(Case.objects.filter(number=manual_case.number).exists())
        self.assertTrue(Task.objects.filter(title="Реальна задача").exists())
        self.assertTrue(get_user_model().objects.filter(email="ivanenko@advocates.crm").exists())
        self.assertFalse(get_user_model().objects.filter(email__in=[
            "melnyk@advocates.crm",
            "kravchuk@advocates.crm",
            "petrenko@advocates.crm",
        ]).exists())

        empty_bootstrap = self.client.get("/api/bootstrap/")
        self.assertEqual(empty_bootstrap.status_code, 200)
        self.assertEqual(empty_bootstrap.json()["meta"]["clients"], 1)

        restore_response = self.client.post(
            "/api/demo-data/",
            {"action": "restore"},
            content_type="application/json",
        )
        self.assertEqual(restore_response.status_code, 200)
        self.assertTrue(restore_response.json()["demoData"]["enabled"])
        self.assertEqual(Client.objects.filter(is_demo=True).count(), 5)
        self.assertEqual(Case.objects.filter(is_demo=True).count(), 5)
        self.assertEqual(Task.objects.filter(is_demo=True).count(), 9)
        self.assertEqual(CalendarEvent.objects.filter(is_demo=True).count(), 6)
        self.assertEqual(Client.objects.count(), 6)
        self.assertEqual(Case.objects.count(), 6)
        self.assertEqual(Task.objects.count(), 10)
        self.assertEqual(CalendarEvent.objects.count(), 6)
        self.assertGreater(ClientCommunication.objects.count(), 0)

    def test_demo_data_api_imports_snapshot_as_real_records(self):
        snapshot = {
            "settings": {
                "bureau": {"name": "Backup Bureau", "email": "backup@example.com"},
                "integrations": {},
                "integrationSettings": {},
                "notifications": {},
            },
            "clients": [
                {
                    "id": 9901,
                    "name": "Клієнт з копії",
                    "clientType": "Фізична особа",
                    "phone": "+380 50 111 22 33",
                    "email": "backup.client@example.com",
                    "status": "active",
                    "added": "2026-05-20",
                    "lastContact": "2026-05-21",
                }
            ],
            "cases": [
                {
                    "id": "2026/9901",
                    "clientId": 9901,
                    "title": "Справа з копії",
                    "type": "Цивільна",
                    "stage": "Підготовка",
                    "status": "В роботі",
                    "priority": "Середній",
                    "opened": "2026-05-20",
                    "documents": [
                        {
                            "id": 8801,
                            "caseId": "2026/9901",
                            "name": "Позов з копії.docx",
                            "type": "Позов",
                            "folder": "Процесуальні документи",
                            "status": "Чернетка",
                        }
                    ],
                    "tasks": [
                        {
                            "id": 7701,
                            "caseId": "2026/9901",
                            "clientId": 9901,
                            "title": "Задача з копії",
                            "status": "Нова",
                            "priority": "Середній",
                        }
                    ],
                }
            ],
            "events": [
                {
                    "id": 6601,
                    "title": "Подія з копії",
                    "type": "Зустріч з клієнтом",
                    "date": "2026-05-22",
                    "time": "10:00",
                    "clientId": 9901,
                    "caseId": "2026/9901",
                    "status": "Заплановано",
                }
            ],
        }

        response = self.client.post(
            "/api/demo-data/",
            {"action": "import_snapshot", "snapshot": snapshot},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        summary = response.json()["summary"]
        self.assertEqual({key: summary[key] for key in ("clients", "cases", "tasks", "documents", "events")}, {
            "clients": 1,
            "cases": 1,
            "tasks": 1,
            "documents": 1,
            "events": 1,
        })
        self.assertTrue(Client.objects.filter(email="backup.client@example.com", is_demo=False).exists())
        self.assertTrue(Case.objects.filter(number="2026/9901", is_demo=False).exists())
        self.assertTrue(Task.objects.filter(title="Задача з копії", is_demo=False).exists())
        self.assertTrue(CaseDocument.objects.filter(title="Позов з копії.docx", is_demo=False).exists())
        self.assertTrue(CalendarEvent.objects.filter(title="Подія з копії", is_demo=False).exists())
        self.assertEqual(CRMSettings.objects.get(key="global").bureau["name"], "Backup Bureau")
        self.assertTrue(get_user_model().objects.filter(email="melnyk@advocates.crm").exists())
        self.assertTrue(get_user_model().objects.filter(email="kravchuk@advocates.crm").exists())
        self.assertTrue(get_user_model().objects.filter(email="petrenko@advocates.crm").exists())

    def test_demo_clear_keeps_user_records_attached_to_demo_parent(self):
        demo_case = Case.objects.get(number=demo_case_number("12345"))
        demo_client_id = demo_case.client_id
        user_document = CaseDocument.objects.create(
            case=demo_case,
            title="Квитанція замовника.pdf",
            document_type="Документ",
            status="Подано",
        )

        response = self.client.post(
            "/api/demo-data/",
            {"action": "clear"},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json()["demoData"]["enabled"])
        self.assertTrue(CaseDocument.objects.filter(pk=user_document.pk, is_demo=False).exists())
        self.assertTrue(Case.objects.filter(number=demo_case_number("12345"), is_demo=False).exists())
        self.assertTrue(Client.objects.filter(pk=demo_client_id, is_demo=False).exists())
        self.assertEqual(Case.objects.filter(is_demo=True).count(), 0)
        self.assertEqual(Client.objects.filter(is_demo=True).count(), 0)

    def test_list_endpoints_are_available(self):
        endpoints = [
            "/api/users/",
            "/api/clients/",
            "/api/cases/",
            "/api/tasks/",
            "/api/calendar/events/",
            "/api/finance/operations/",
            "/api/audit-logs/",
            "/api/mailings/templates/",
            "/api/mailings/campaigns/",
            "/api/mailings/automation-rules/",
        ]

        for endpoint in endpoints:
            with self.subTest(endpoint=endpoint):
                response = self.client.get(endpoint)
                self.assertEqual(response.status_code, 200)
                self.assertIn("results", response.json())

    def test_document_file_upload_download_and_onlyoffice_callback(self):
        self.client.post(
            "/api/auth/login/",
            {"email": "ivanenko@advocates.crm", "password": "demo12345"},
            content_type="application/json",
        )
        case = Case.objects.first()
        document = CaseDocument.objects.create(
            case=case,
            title="Договір для редактора.docx",
            document_type="Договір",
            status="Чернетка",
            folder="Папка справи",
        )

        upload_response = self.client.post(
            f"/api/documents/{document.id}/file/",
            {"file": SimpleUploadedFile("contract.docx", b"original-docx", content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
        )

        self.assertEqual(upload_response.status_code, 200)
        payload = upload_response.json()
        self.assertIn("/api/documents/", payload["fileUrl"])
        self.assertIn("token=", payload["fileUrl"])
        file_path = urlsplit(payload["fileUrl"]).path + "?" + urlsplit(payload["fileUrl"]).query
        download_response = self.client.get(file_path)
        self.assertEqual(download_response.status_code, 200)
        self.assertEqual(b"".join(download_response.streaming_content), b"original-docx")

        class EditedResponse:
            def __enter__(self):
                return self

            def __exit__(self, *_args):
                return False

            def read(self):
                return b"edited-docx"

        with patch("config.api.urllib.request.urlopen", return_value=EditedResponse()):
            callback_response = self.client.post(
                f"/api/documents/{document.id}/onlyoffice/callback/",
                {"status": 2, "url": "https://onlyoffice.example/edited.docx"},
                content_type="application/json",
            )

        self.assertEqual(callback_response.status_code, 200)
        self.assertEqual(callback_response.json(), {"error": 0})
        document.refresh_from_db()
        self.assertEqual(document.file.read(), b"edited-docx")

    def test_finance_invoice_and_act_create_real_docx_files(self):
        self.client.post(
            "/api/auth/login/",
            {"email": "ivanenko@advocates.crm", "password": "demo12345"},
            content_type="application/json",
        )
        case = Case.objects.first()

        invoice_response = self.client.post(
            "/api/finance/operations/",
            {
                "action": "invoice",
                "caseId": case.number,
                "title": "Рахунок за правову допомогу",
                "amount": 8000,
                "date": "2026-05-25",
                "documentDue": "2026-06-01",
                "documentNumber": "INV-TEST-1",
                "documentTemplate": "Детальний шаблон",
                "status": "Виставлено",
                "method": "Документ",
            },
            content_type="application/json",
        )
        self.assertEqual(invoice_response.status_code, 200)
        invoice_document = CaseDocument.objects.get(pk=invoice_response.json()["document"]["id"])
        self.assertTrue(invoice_document.file)
        invoice_xml = ZipFile(BytesIO(invoice_document.file.read())).read("word/document.xml").decode("utf-8")
        self.assertIn("РАХУНОК НА ОПЛАТУ", invoice_xml)
        self.assertIn("INV-TEST-1", invoice_xml)
        self.assertIn("Умови оплати", invoice_xml)
        self.assertIn("/api/documents/", invoice_response.json()["document"]["fileUrl"])
        self.assertIn("token=", invoice_response.json()["document"]["fileUrl"])
        self.assertEqual(invoice_response.json()["operation"]["documentId"], invoice_document.id)

        act_response = self.client.post(
            "/api/finance/operations/",
            {
                "action": "act",
                "caseId": case.number,
                "title": "Акт виконаних робіт",
                "amount": 8000,
                "date": "2026-05-25",
                "documentNumber": "ACT-TEST-1",
                "workPeriod": "травень 2026",
                "documentTemplate": "Основний шаблон",
                "status": "Чернетка",
                "method": "Документ",
            },
            content_type="application/json",
        )
        self.assertEqual(act_response.status_code, 200)
        act_document = CaseDocument.objects.get(pk=act_response.json()["document"]["id"])
        self.assertTrue(act_document.file)
        act_xml = ZipFile(BytesIO(act_document.file.read())).read("word/document.xml").decode("utf-8")
        self.assertIn("АКТ НАДАНИХ ПОСЛУГ", act_xml)
        self.assertIn("ACT-TEST-1", act_xml)
        self.assertIn("Період виконання робіт", act_xml)
        self.assertIn("/api/documents/", act_response.json()["document"]["fileUrl"])

        delete_invoice_response = self.client.delete(f"/api/finance/operations/{invoice_response.json()['operation']['id']}/")
        self.assertEqual(delete_invoice_response.status_code, 200)
        self.assertFalse(CaseDocument.objects.filter(pk=invoice_document.id).exists())

        recreated_document = CaseDocument.objects.create(
            case=case,
            title="Рахунок без фінансової операції.docx",
            document_type="Рахунок",
            folder="Фінансові документи",
            status="Чернетка",
        )
        delete_orphan_invoice_response = self.client.delete(f"/api/documents/{recreated_document.id}/")
        self.assertEqual(delete_orphan_invoice_response.status_code, 200)
        self.assertFalse(CaseDocument.objects.filter(pk=recreated_document.id).exists())

        delete_act_response = self.client.delete(f"/api/finance/operations/{act_response.json()['operation']['id']}/")
        self.assertEqual(delete_act_response.status_code, 200)
        self.assertFalse(CaseDocument.objects.filter(pk=act_document.id).exists())

    def test_audit_log_api_records_crm_actions(self):
        create_response = self.client.post(
            "/api/clients/",
            {
                "name": "Клієнт для аудиту",
                "phone": "+380 50 222 33 44",
                "request": "Перевірити журнал дій.",
                "status": "Активний",
            },
            content_type="application/json",
        )
        self.assertEqual(create_response.status_code, 200)
        created = create_response.json()

        update_response = self.client.put(
            f"/api/clients/{created['id']}/",
            {**created, "name": "Клієнт для аудиту оновлений"},
            content_type="application/json",
        )
        self.assertEqual(update_response.status_code, 200)

        delete_response = self.client.delete(f"/api/clients/{created['id']}/")
        self.assertEqual(delete_response.status_code, 200)

        logs = AuditLog.objects.filter(entity_type="client", entity_id=str(created["id"]))
        self.assertEqual(logs.count(), 3)
        self.assertEqual(set(logs.values_list("action", flat=True)), {"create", "update", "delete"})

        api_response = self.client.get("/api/audit-logs/")
        self.assertEqual(api_response.status_code, 200)
        api_logs = api_response.json()["results"]
        self.assertTrue(any(item["summary"] == "Видалено клієнта Клієнт для аудиту оновлений." for item in api_logs))

        clear_response = self.client.delete("/api/audit-logs/")
        self.assertEqual(clear_response.status_code, 200)
        self.assertEqual(clear_response.json()["results"], [])
        self.assertEqual(AuditLog.objects.count(), 0)

        bootstrap = self.client.get("/api/bootstrap/")
        self.assertEqual(bootstrap.status_code, 200)
        self.assertEqual(bootstrap.json()["auditLogs"], [])

    def test_settings_api_persists_integrations_notifications_and_audit(self):
        payload = {
            "settings": {
                "bureau": {
                    "name": "Test Bureau",
                    "email": "office@test.example",
                    "phone": "+380 44 111 22 33",
                    "address": "Kyiv",
                    "logo": "data:image/png;base64," + "a" * 300,
                    "telegram": "@test_bureau",
                    "whatsapp": "+380 67 111 22 33",
                    "instagram": "test.bureau",
                    "facebook": "TestBureau",
                    "tiktok": "test.bureau",
                    "website": "https://test.example",
                },
                "integrations": {
                    "Telegram": False,
                    "SMS": True,
                    "Email": True,
                    "AI": False,
                },
                "integrationSettings": {
                    "Telegram": {
                        "botToken": "telegram-secret",
                        "chatId": "@admin",
                        "webhookUrl": "https://test.example/telegram",
                    },
                    "SMS": {
                        "provider": "TurboSMS",
                        "sender": "TestSender",
                        "apiKey": "sms-secret",
                    },
                    "Email": {
                        "senderEmail": "office@test.example",
                        "senderName": "Test Bureau",
                        "smtpHost": "smtp.test.example",
                        "smtpPort": "587",
                    },
                    "AI": {
                        "model": "demo",
                        "workspace": "cases",
                    },
                },
                "notifications": {
                    "deadlines": False,
                    "court": True,
                    "mailings": False,
                },
            }
        }

        response = self.client.put("/api/settings/", payload, content_type="application/json")
        self.assertEqual(response.status_code, 200)
        settings_payload = response.json()["settings"]
        self.assertEqual(settings_payload["bureau"]["name"], "Test Bureau")
        self.assertEqual(settings_payload["bureau"]["telegram"], "@test_bureau")
        self.assertEqual(settings_payload["bureau"]["website"], "https://test.example")
        self.assertGreater(len(settings_payload["bureau"]["logo"]), 255)
        self.assertFalse(settings_payload["integrations"]["Telegram"])
        self.assertTrue(settings_payload["integrations"]["Email"])
        self.assertEqual(settings_payload["integrationSettings"]["SMS"]["sender"], "TestSender")
        self.assertEqual(settings_payload["integrationSettings"]["Email"]["smtpHost"], "smtp.test.example")
        self.assertFalse(settings_payload["notifications"]["deadlines"])

        settings = CRMSettings.objects.get(key="global")
        self.assertEqual(settings.bureau["email"], "office@test.example")
        self.assertEqual(settings.integration_settings["Telegram"]["chatId"], "@admin")
        self.assertTrue(AuditLog.objects.filter(entity_type="settings", entity_id="global").exists())

        bootstrap = self.client.get("/api/bootstrap/")
        self.assertEqual(bootstrap.status_code, 200)
        self.assertEqual(bootstrap.json()["settings"]["bureau"]["name"], "Test Bureau")

        provider_status = self.client.get("/api/settings/provider-status/")
        self.assertEqual(provider_status.status_code, 200)
        provider_channels = {item["channel"]: item for item in provider_status.json()["providerStatus"]["channels"]}
        self.assertEqual(provider_channels["Telegram"]["status"], "disabled")
        self.assertEqual(provider_channels["SMS"]["status"], "ready")

        provider_test = self.client.post("/api/settings/provider-status/", {"channel": "SMS"}, content_type="application/json")
        self.assertEqual(provider_test.status_code, 200)
        self.assertTrue(provider_test.json()["result"]["ok"])

        settings.integration_settings = {
            **settings.integration_settings,
            "SMS": {"provider": "TurboSMS", "sender": "TestSender", "apiKey": ""},
        }
        settings.save(update_fields=["integration_settings"])
        missing_status = self.client.get("/api/settings/provider-status/")
        missing_channels = {item["channel"]: item for item in missing_status.json()["providerStatus"]["channels"]}
        self.assertEqual(missing_channels["SMS"]["status"], "setup")
        missing_test = self.client.post("/api/settings/provider-status/", {"channel": "SMS"}, content_type="application/json")
        self.assertEqual(missing_test.status_code, 200)
        self.assertFalse(missing_test.json()["result"]["ok"])
        self.assertIn("API key", missing_test.json()["result"]["error"])

        disabled_provider_test = self.client.post("/api/settings/provider-status/", {"channel": "Telegram"}, content_type="application/json")
        self.assertEqual(disabled_provider_test.status_code, 200)
        self.assertFalse(disabled_provider_test.json()["result"]["ok"])
        self.assertIn("вимкнено", disabled_provider_test.json()["result"]["error"])

        self.client.post("/api/auth/logout/", {}, content_type="application/json")
        self.client.post(
            "/api/auth/login/",
            {"email": "kravchuk@advocates.crm", "password": "demo12345"},
            content_type="application/json",
        )
        forbidden = self.client.put("/api/settings/", payload, content_type="application/json")
        self.assertEqual(forbidden.status_code, 403)

    def test_mailings_api_persists_templates_campaigns_and_audit(self):
        template_response = self.client.post(
            "/api/mailings/templates/",
            {
                "title": "Судове нагадування",
                "type": "Telegram",
                "text": "Шановний {{client_name}}, нагадуємо про засідання.",
            },
            content_type="application/json",
        )
        self.assertEqual(template_response.status_code, 200)
        template = template_response.json()
        self.assertEqual(template["title"], "Судове нагадування")
        self.assertTrue(MessageTemplate.objects.filter(pk=template["id"], body__contains="засідання").exists())

        campaign_response = self.client.post(
            "/api/mailings/campaigns/",
            {
                "title": "Інформаційна розсилка",
                "status": "Запланирована",
                "meta": "Telegram + SMS · 4 получателей · 25.05.2026 10:30",
                "text": "Текст розсилки",
                "channels": {"Telegram": True, "SMS": True, "Email": False},
                "sendMode": "later",
                "scheduleDate": "2026-05-25",
                "scheduleTime": "10:30",
                "recipientMode": "all",
                "recipientCount": 4,
            },
            content_type="application/json",
        )
        self.assertEqual(campaign_response.status_code, 200)
        campaign = campaign_response.json()
        self.assertEqual(campaign["status"], "Запланирована")
        self.assertTrue(campaign["channels"]["Telegram"])
        self.assertEqual(campaign["scheduleTime"], "10:30")
        self.assertTrue(Campaign.objects.filter(pk=campaign["id"], status=Campaign.Status.PLANNED).exists())
        self.assertGreater(MessageDelivery.objects.filter(campaign_id=campaign["id"]).count(), 0)
        self.assertEqual(campaign["deliveryStats"]["total"], MessageDelivery.objects.filter(campaign_id=campaign["id"]).count())
        self.assertIn(campaign["deliveries"][0]["status"], {"pending", "error"})
        delivery = MessageDelivery.objects.filter(campaign_id=campaign["id"]).exclude(status="error").first()
        self.assertIsNotNone(delivery)
        delivery_response = self.client.put(
            f"/api/mailings/deliveries/{delivery.id}/",
            {"status": "sent"},
            content_type="application/json",
        )
        self.assertEqual(delivery_response.status_code, 200)
        delivery.refresh_from_db()
        self.assertEqual(delivery.status, "sent")
        self.assertIsNotNone(delivery.sent_at)
        self.assertEqual(delivery_response.json()["campaign"]["deliveryStats"]["sent"], 1)

        retry_response = self.client.put(
            f"/api/mailings/deliveries/{delivery.id}/",
            {"status": "queued"},
            content_type="application/json",
        )
        self.assertEqual(retry_response.status_code, 200)
        delivery.refresh_from_db()
        self.assertEqual(delivery.status, "queued")
        self.assertEqual(delivery.error, "")
        self.assertIsNone(delivery.sent_at)
        self.assertTrue(AuditLog.objects.filter(entity_type="mailing_delivery", entity_id=str(delivery.id)).exists())

        settings, _created = CRMSettings.objects.get_or_create(key="global")
        settings.integration_settings = {
            "Telegram": {"botToken": "telegram-secret", "chatId": "@admin", "webhookUrl": ""},
            "SMS": {"provider": "TurboSMS", "sender": "Advocates", "apiKey": "sms-secret"},
            "Email": {"senderEmail": "admin@advocates.ua", "senderName": "Advocates Bureau", "smtpHost": "smtp.example", "smtpPort": "587"},
            "AI": {"model": "demo", "workspace": "cases"},
        }
        settings.save(update_fields=["integration_settings"])

        send_response = self.client.post(f"/api/mailings/campaigns/{campaign['id']}/send/")
        self.assertEqual(send_response.status_code, 200)
        send_payload = send_response.json()
        self.assertGreater(send_payload["sent"], 0)
        self.assertEqual(send_payload["campaign"]["deliveryStats"]["queued"], 0)
        self.assertGreater(send_payload["campaign"]["deliveryStats"]["sent"], 0)
        self.assertTrue(AuditLog.objects.filter(entity_type="mailing_campaign", entity_id=str(campaign["id"]), summary__contains="mock").exists())

        settings = CRMSettings.objects.get(key="global")
        settings.integrations = {**settings.integrations, "SMS": False}
        settings.save(update_fields=["integrations"])
        disabled_channel_response = self.client.post(
            "/api/mailings/campaigns/",
            {
                "title": "SMS disabled campaign",
                "status": "Готова к отправке",
                "text": "Текст розсилки",
                "channels": {"Telegram": False, "SMS": True, "Email": False},
                "sendMode": "now",
                "recipientMode": "all",
                "recipientCount": 4,
            },
            content_type="application/json",
        )
        self.assertEqual(disabled_channel_response.status_code, 200)
        disabled_campaign = disabled_channel_response.json()
        disabled_send = self.client.post(f"/api/mailings/campaigns/{disabled_campaign['id']}/send/")
        self.assertEqual(disabled_send.status_code, 200)
        disabled_payload = disabled_send.json()
        self.assertEqual(disabled_payload["sent"], 0)
        self.assertEqual(disabled_payload["campaign"]["deliveryStats"]["sent"], 0)
        self.assertGreater(disabled_payload["campaign"]["deliveryStats"]["error"], 0)
        self.assertTrue(MessageDelivery.objects.filter(campaign_id=disabled_campaign["id"], error__contains="вимкнено").exists())

        bootstrap = self.client.get("/api/bootstrap/")
        self.assertEqual(bootstrap.status_code, 200)
        self.assertTrue(any(item["id"] == template["id"] for item in bootstrap.json()["mailing"]["templates"]))
        self.assertTrue(any(item["id"] == campaign["id"] for item in bootstrap.json()["mailing"]["campaigns"]))
        self.assertTrue(AuditLog.objects.filter(entity_type="mailing_campaign", entity_id=str(campaign["id"])).exists())

        automation_rule = bootstrap.json()["mailing"]["automationRules"][0]
        automation_response = self.client.put(
            f"/api/mailings/automation-rules/{automation_rule['id']}/",
            {**automation_rule, "enabled": False, "channel": "Email"},
            content_type="application/json",
        )
        self.assertEqual(automation_response.status_code, 200)
        updated_rule = automation_response.json()
        self.assertFalse(updated_rule["enabled"])
        self.assertEqual(updated_rule["channel"], "Email")
        self.assertTrue(AutomationRule.objects.filter(pk=updated_rule["id"], enabled=False, channel="Email").exists())
        self.assertTrue(AuditLog.objects.filter(entity_type="mailing_automation", entity_id=str(updated_rule["id"])).exists())

        delete_response = self.client.delete(f"/api/mailings/templates/{template['id']}/")
        self.assertEqual(delete_response.status_code, 200)
        self.assertFalse(MessageTemplate.objects.filter(pk=template["id"]).exists())

        self.client.post("/api/auth/logout/", {}, content_type="application/json")
        self.client.post(
            "/api/auth/login/",
            {"email": "kravchuk@advocates.crm", "password": "demo12345"},
            content_type="application/json",
        )
        forbidden = self.client.post(
            "/api/mailings/templates/",
            {"title": "Forbidden", "type": "SMS", "text": "Nope"},
            content_type="application/json",
        )
        self.assertEqual(forbidden.status_code, 403)

    def test_users_api_returns_session_and_manages_roles(self):
        session_response = self.client.get("/api/session/")
        self.assertEqual(session_response.status_code, 200)
        session_payload = session_response.json()
        self.assertEqual(session_payload["user"]["role"], "Адміністратор")
        self.assertTrue(session_payload["permissions"]["canManageUsers"])
        self.assertFalse(session_payload["authenticated"])

        login_response = self.client.post(
            "/api/auth/login/",
            {"email": "ivanenko@advocates.crm", "password": "demo12345"},
            content_type="application/json",
        )
        self.assertEqual(login_response.status_code, 200)
        self.assertTrue(login_response.json()["authenticated"])

        logout_response = self.client.post("/api/auth/logout/", {}, content_type="application/json")
        self.assertEqual(logout_response.status_code, 200)
        self.assertFalse(logout_response.json()["authenticated"])

        payload = {
            "name": "Шевченко Марія Ігорівна",
            "email": "shevchenko@example.com",
            "role": "Помічник",
            "access": "Задачі та документи",
        }
        create_response = self.client.post("/api/users/", payload, content_type="application/json")
        self.assertEqual(create_response.status_code, 200)
        created = create_response.json()
        self.assertEqual(created["role"], "Помічник")
        self.assertEqual(created["photo"], "ШМ")

        update_response = self.client.put(
            f"/api/users/{created['id']}/",
            {**created, "role": "Бухгалтер", "access": "Фінанси та звіти"},
            content_type="application/json",
        )
        self.assertEqual(update_response.status_code, 200)
        updated = update_response.json()
        self.assertEqual(updated["role"], "Бухгалтер")
        self.assertEqual(updated["access"], "Фінанси та звіти")

        delete_response = self.client.delete(f"/api/users/{created['id']}/")
        self.assertEqual(delete_response.status_code, 200)
        self.assertEqual(delete_response.json(), {"deleted": created["id"]})

    def test_temporary_password_requires_change_after_login(self):
        create_response = self.client.post(
            "/api/users/",
            {
                "name": "Тимчасовий Користувач",
                "email": "temporary@example.com",
                "password": "start12345",
                "passwordTemporary": True,
                "role": "Помічник",
                "access": "Задачі та документи",
            },
            content_type="application/json",
        )
        self.assertEqual(create_response.status_code, 200)
        created = create_response.json()
        self.assertTrue(created["passwordTemporary"])
        self.assertEqual(created["accessStatus"], "Пароль тимчасовий")

        self.client.post("/api/auth/logout/", {}, content_type="application/json")
        login_response = self.client.post(
            "/api/auth/login/",
            {"email": "temporary@example.com", "password": "start12345"},
            content_type="application/json",
        )
        self.assertEqual(login_response.status_code, 200)
        self.assertTrue(login_response.json()["mustChangePassword"])
        self.assertTrue(login_response.json()["user"]["passwordTemporary"])

        change_response = self.client.post(
            "/api/auth/change-password/",
            {"password": "newstrong123"},
            content_type="application/json",
        )
        self.assertEqual(change_response.status_code, 200)
        changed = change_response.json()
        self.assertFalse(changed["mustChangePassword"])
        self.assertFalse(changed["user"]["passwordTemporary"])
        self.assertEqual(changed["user"]["accessStatus"], "Активний")

        self.client.post("/api/auth/logout/", {}, content_type="application/json")
        old_password = self.client.post(
            "/api/auth/login/",
            {"email": "temporary@example.com", "password": "start12345"},
            content_type="application/json",
        )
        self.assertEqual(old_password.status_code, 401)
        new_password = self.client.post(
            "/api/auth/login/",
            {"email": "temporary@example.com", "password": "newstrong123"},
            content_type="application/json",
        )
        self.assertEqual(new_password.status_code, 200)
        self.assertFalse(new_password.json()["mustChangePassword"])

    def test_user_card_saves_custom_permissions_and_case_scope(self):
        payload = {
            "name": "Доступ Тест",
            "email": "scope.user@example.com",
            "password": "demo12345",
            "role": "Помічник",
            "access": "Індивідуальний доступ",
            "permissionKeys": ["manage_tasks"],
            "assignedCaseIds": [demo_case_number("5678")],
        }

        create_response = self.client.post("/api/users/", payload, content_type="application/json")
        self.assertEqual(create_response.status_code, 200)
        created = create_response.json()
        self.assertEqual(created["permissionKeys"], ["manage_tasks"])
        self.assertEqual(created["assignedCaseIds"], [demo_case_number("5678")])
        self.assertEqual(created["assignedCasesCount"], 1)

        user = get_user_model().objects.get(email="scope.user@example.com")
        self.assertTrue(CaseMember.objects.filter(user=user, case__number=demo_case_number("5678")).exists())

        self.client.post("/api/auth/logout/", {}, content_type="application/json")
        login_response = self.client.post(
            "/api/auth/login/",
            {"email": "scope.user@example.com", "password": "demo12345"},
            content_type="application/json",
        )
        self.assertEqual(login_response.status_code, 200)
        permissions = login_response.json()["permissions"]
        self.assertTrue(permissions["canManageTasks"])
        self.assertFalse(permissions["canManageDocuments"])

        bootstrap = self.client.get("/api/bootstrap/").json()
        self.assertEqual([item["id"] for item in bootstrap["cases"]], [demo_case_number("5678")])

    def test_role_permissions_limit_write_actions(self):
        assistant_login = self.client.post(
            "/api/auth/login/",
            {"email": "kravchuk@advocates.crm", "password": "demo12345"},
            content_type="application/json",
        )
        self.assertEqual(assistant_login.status_code, 200)
        assistant_permissions = assistant_login.json()["permissions"]
        self.assertFalse(assistant_permissions["canManageClients"])
        self.assertTrue(assistant_permissions["canManageTasks"])

        client_response = self.client.post(
            "/api/clients/",
            {"name": "Клієнт помічника", "phone": "+380 50 000 00 00"},
            content_type="application/json",
        )
        self.assertEqual(client_response.status_code, 403)

        assistant_case = Case.objects.filter(team_members__user__email="kravchuk@advocates.crm").first()
        self.assertIsNotNone(assistant_case)
        task_response = self.client.post(
            "/api/tasks/",
            {
                "caseId": assistant_case.number,
                "clientId": assistant_case.client_id,
                "title": "Помічник може створити задачу",
                "status": "Нова",
                "priority": "Середній",
            },
            content_type="application/json",
        )
        self.assertEqual(task_response.status_code, 200)

        finance_response = self.client.get("/api/finance/operations/")
        self.assertEqual(finance_response.status_code, 403)

        self.client.post("/api/auth/logout/", {}, content_type="application/json")
        lawyer_login = self.client.post(
            "/api/auth/login/",
            {"email": "melnyk@advocates.crm", "password": "demo12345"},
            content_type="application/json",
        )
        self.assertEqual(lawyer_login.status_code, 200)
        self.assertTrue(lawyer_login.json()["permissions"]["canManageCases"])
        self.assertFalse(lawyer_login.json()["permissions"]["canSeeFinance"])
        lawyer_bootstrap = self.client.get("/api/bootstrap/").json()
        self.assertEqual(lawyer_bootstrap["financeOperations"], [])
        self.assertEqual(lawyer_bootstrap["finance"]["income"], 0)
        self.assertEqual(lawyer_bootstrap["cases"][0]["income"], 0)
        lawyer_case_response = self.client.post(
            "/api/cases/",
            {
                "clientId": 1,
                "title": "Адвокатська справа API",
                "type": "Цивільна",
                "stage": "Аналіз",
                "status": "В роботі",
                "priority": "Середній",
                "income": 7777,
                "paid": 1000,
                "debt": 6777,
                "financeComment": "Ці дані не має записати адвокат.",
            },
            content_type="application/json",
        )
        self.assertEqual(lawyer_case_response.status_code, 200)
        lawyer_case_payload = lawyer_case_response.json()
        self.assertEqual(lawyer_case_payload["income"], 0)
        self.assertEqual(lawyer_case_payload["debt"], 0)
        self.assertEqual(lawyer_case_payload["financeComment"], "")
        created_lawyer_case = Case.objects.get(number=lawyer_case_payload["id"])
        self.assertEqual(created_lawyer_case.income_amount, 0)
        self.assertEqual(created_lawyer_case.debt_amount, 0)
        self.assertEqual(self.client.get("/api/finance/summary/").status_code, 403)

        accountant = get_user_model().objects.create_user(
            username="accountant_api",
            email="accountant@example.com",
            password="demo12345",
            first_name="Бухгалтер API",
        )
        UserProfile.objects.create(
            user=accountant,
            role="accountant",
            access_scope="Фінанси та звіти",
            photo_label="БА",
        )
        CaseMember.objects.create(
            case=Case.objects.get(number=demo_case_number("12345")),
            user=accountant,
            role=CaseMember.Role.ACCOUNTANT,
        )
        self.client.post("/api/auth/logout/", {}, content_type="application/json")
        accountant_login = self.client.post(
            "/api/auth/login/",
            {"email": "accountant@example.com", "password": "demo12345"},
            content_type="application/json",
        )
        self.assertEqual(accountant_login.status_code, 200)
        self.assertTrue(accountant_login.json()["permissions"]["canSeeFinance"])
        self.assertFalse(accountant_login.json()["permissions"]["canManageTasks"])
        self.assertEqual(self.client.get("/api/finance/summary/").status_code, 200)
        accountant_bootstrap = self.client.get("/api/bootstrap/").json()
        self.assertGreater(accountant_bootstrap["finance"]["income"], 0)
        self.assertIn("financeOperations", accountant_bootstrap)
        self.assertTrue(any(item["income"] > 0 for item in accountant_bootstrap["cases"]))
        accountant_task_response = self.client.post(
            "/api/tasks/",
            {"caseId": demo_case_number("12345"), "title": "Бухгалтерська задача"},
            content_type="application/json",
        )
        self.assertEqual(accountant_task_response.status_code, 403)

    def test_client_create_update_and_delete_api(self):
        payload = {
            "name": "Тестовий клієнт API",
            "phone": "+380 99 000 11 22",
            "email": "api.client@example.com",
            "request": "Перевірити збереження клієнта через API.",
            "status": "Активний",
            "source": "CRM",
            "manager": "Іваненко А.Ю.",
            "telegram": True,
            "telegramUsername": "@api_client",
            "consent": True,
        }

        create_response = self.client.post("/api/clients/", payload, content_type="application/json")
        self.assertEqual(create_response.status_code, 200)
        created = create_response.json()
        self.assertEqual(created["name"], payload["name"])
        self.assertEqual(created["telegramUsername"], "@api_client")

        update_response = self.client.put(
            f"/api/clients/{created['id']}/",
            {**created, "name": "Тестовий клієнт API Оновлено", "phone": "+380 99 777 88 99"},
            content_type="application/json",
        )
        self.assertEqual(update_response.status_code, 200)
        updated = update_response.json()
        self.assertEqual(updated["name"], "Тестовий клієнт API Оновлено")
        self.assertEqual(updated["phone"], "+380 99 777 88 99")

        delete_response = self.client.delete(f"/api/clients/{created['id']}/")
        self.assertEqual(delete_response.status_code, 200)
        self.assertEqual(delete_response.json(), {"deleted": created["id"]})

    def test_client_communication_create_update_and_delete_api(self):
        payload = {
            "date": "2026-06-12",
            "channel": "Telegram",
            "title": "API повідомлення клієнту",
            "status": "Надіслано",
            "author": "Іваненко А.Ю.",
            "caseId": demo_case_number("12345"),
        }

        create_response = self.client.post("/api/clients/1/communications/", payload, content_type="application/json")
        self.assertEqual(create_response.status_code, 200)
        created = create_response.json()
        self.assertEqual(created["clientId"], 1)
        self.assertEqual(created["title"], payload["title"])
        self.assertEqual(created["caseId"], demo_case_number("12345"))

        list_response = self.client.get("/api/clients/1/communications/")
        self.assertEqual(list_response.status_code, 200)
        self.assertTrue(any(item["id"] == created["id"] for item in list_response.json()["results"]))

        update_response = self.client.put(
            f"/api/client-communications/{created['id']}/",
            {**created, "status": "Відповідь отримано", "channel": "Email"},
            content_type="application/json",
        )
        self.assertEqual(update_response.status_code, 200)
        updated = update_response.json()
        self.assertEqual(updated["status"], "Відповідь отримано")
        self.assertEqual(updated["channel"], "Email")

        delete_response = self.client.delete(f"/api/client-communications/{created['id']}/")
        self.assertEqual(delete_response.status_code, 200)
        self.assertEqual(delete_response.json(), {"deleted": created["id"]})

    def test_case_create_update_and_delete_api(self):
        payload = {
            "clientId": 1,
            "title": "API справа щодо договору",
            "type": "Цивільна",
            "stage": "Первинний аналіз",
            "status": "В роботі",
            "priority": "Середній",
            "responsible": "Іваненко А.Ю.",
            "deadline": "2026-06-15",
            "description": "Перевірка збереження справи через API.",
            "income": 12000,
            "paid": 3000,
            "debt": 9000,
        }

        create_response = self.client.post("/api/cases/", payload, content_type="application/json")
        self.assertEqual(create_response.status_code, 200)
        created = create_response.json()
        self.assertEqual(created["title"], payload["title"])
        self.assertTrue(created["id"].startswith(f"{timezone.localdate().year}/"))

        update_response = self.client.put(
            f"/api/cases/{created['id']}/",
            {**created, "title": "API справа оновлена", "status": "Терміново", "priority": "Високий"},
            content_type="application/json",
        )
        self.assertEqual(update_response.status_code, 200)
        updated = update_response.json()
        self.assertEqual(updated["title"], "API справа оновлена")
        self.assertEqual(updated["status"], "Терміново")
        self.assertEqual(updated["priority"], "Високий")

        delete_response = self.client.delete(f"/api/cases/{created['id']}/")
        self.assertEqual(delete_response.status_code, 200)
        self.assertEqual(delete_response.json(), {"deleted": created["id"]})

    def test_task_create_update_and_delete_api(self):
        payload = {
            "caseId": demo_case_number("12345"),
            "clientId": 1,
            "title": "API задача по справі",
            "status": "Нова",
            "priority": "Середній",
            "responsible": "Іваненко А.Ю.",
            "due": "2026-06-20",
            "plannerDate": "2026-06-19",
            "plannerTime": "11:30",
            "reminderEnabled": True,
            "reminderBefore": "За 1 день",
            "reminderChannel": "CRM + Telegram",
            "coexecutors": ["Петренко С.В."],
            "subtasks": [{"title": "Перевірити матеріали", "status": "Нова"}],
        }

        create_response = self.client.post("/api/tasks/", payload, content_type="application/json")
        self.assertEqual(create_response.status_code, 200)
        created = create_response.json()
        self.assertEqual(created["title"], payload["title"])
        self.assertEqual(created["caseId"], demo_case_number("12345"))
        self.assertTrue(created["id"])

        update_response = self.client.put(
            f"/api/tasks/{created['id']}/",
            {**created, "status": "Виконано", "priority": "Високий"},
            content_type="application/json",
        )
        self.assertEqual(update_response.status_code, 200)
        updated = update_response.json()
        self.assertEqual(updated["status"], "Виконано")
        self.assertEqual(updated["priority"], "Високий")

        delete_response = self.client.delete(f"/api/tasks/{created['id']}/")
        self.assertEqual(delete_response.status_code, 200)
        self.assertEqual(delete_response.json(), {"deleted": created["id"]})

    def test_document_create_update_and_delete_api(self):
        payload = {
            "caseId": demo_case_number("12345"),
            "name": "API документ.docx",
            "type": "Позов",
            "folder": "Позови",
            "status": "Чернетка",
            "submitted": "2026-06-01",
            "responseDue": "2026-06-10",
            "url": "https://example.com/document.docx",
            "responsible": "Іваненко А.Ю.",
            "comment": "Перевірка збереження документа через API.",
        }

        create_response = self.client.post("/api/documents/", payload, content_type="application/json")
        self.assertEqual(create_response.status_code, 200)
        created = create_response.json()
        self.assertEqual(created["name"], payload["name"])
        self.assertEqual(created["caseId"], demo_case_number("12345"))
        self.assertEqual(created["folder"], "Позови")

        update_response = self.client.put(
            f"/api/documents/{created['id']}/",
            {**created, "status": "Подано", "responseDue": "2026-06-15"},
            content_type="application/json",
        )
        self.assertEqual(update_response.status_code, 200)
        updated = update_response.json()
        self.assertEqual(updated["status"], "Подано")
        self.assertEqual(updated["responseDue"], "2026-06-15")

        delete_response = self.client.delete(f"/api/documents/{created['id']}/")
        self.assertEqual(delete_response.status_code, 200)
        self.assertEqual(delete_response.json(), {"deleted": created["id"]})

    def test_event_create_update_and_delete_api(self):
        payload = {
            "caseId": demo_case_number("12345"),
            "clientId": 1,
            "title": "API судове засідання",
            "type": "Судове засідання",
            "date": "2026-06-25",
            "time": "09:30",
            "endTime": "10:30",
            "authority": "Шевченківський районний суд",
            "location": "м. Київ",
            "responsible": "Іваненко А.Ю.",
            "description": "Перевірка збереження події через API.",
            "recurrence": "Не повторювати",
            "reminderBefore": "За 1 день",
            "reminderChannels": "CRM + Telegram",
            "reminderRecipients": "Відповідальний юрист + клієнт",
            "status": "Заплановано",
        }

        create_response = self.client.post("/api/calendar/events/", payload, content_type="application/json")
        self.assertEqual(create_response.status_code, 200)
        created = create_response.json()
        self.assertEqual(created["title"], payload["title"])
        self.assertEqual(created["caseId"], demo_case_number("12345"))
        self.assertEqual(created["date"], "2026-06-25")

        update_response = self.client.put(
            f"/api/calendar/events/{created['id']}/",
            {**created, "status": "Виконано", "time": "11:00", "endTime": "12:00"},
            content_type="application/json",
        )
        self.assertEqual(update_response.status_code, 200)
        updated = update_response.json()
        self.assertEqual(updated["status"], "Виконано")
        self.assertIn("11:00", updated["startsAt"])

        delete_response = self.client.delete(f"/api/calendar/events/{created['id']}/")
        self.assertEqual(delete_response.status_code, 200)
        self.assertEqual(delete_response.json(), {"deleted": created["id"]})

    def test_finance_operation_create_list_and_delete_api(self):
        payload = {
            "action": "income",
            "caseId": demo_case_number("12345"),
            "title": "API оплата клієнта",
            "amount": 2500,
            "date": "2026-06-30",
            "status": "Оплачено",
            "method": "Банківський переказ",
            "comment": "Перевірка фінансової операції через API.",
        }

        create_response = self.client.post("/api/finance/operations/", payload, content_type="application/json")
        self.assertEqual(create_response.status_code, 200)
        created = create_response.json()
        operation = created["operation"]
        self.assertTrue(operation["id"].startswith("payment-"))
        self.assertEqual(operation["type"], "Надходження")
        self.assertEqual(operation["title"], payload["title"])
        self.assertEqual(operation["amount"], 2500.0)

        list_response = self.client.get("/api/finance/operations/")
        self.assertEqual(list_response.status_code, 200)
        self.assertTrue(any(item["id"] == operation["id"] for item in list_response.json()["results"]))

        delete_response = self.client.delete(f"/api/finance/operations/{operation['id']}/")
        self.assertEqual(delete_response.status_code, 200)
        delete_payload = delete_response.json()
        self.assertEqual(delete_payload["deleted"], operation["id"])
        self.assertEqual(delete_payload["case"]["id"], demo_case_number("12345"))
