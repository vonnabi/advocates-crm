from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase

from apps.calendar_app.models import CalendarEvent
from apps.cases.models import Case, CaseDocument
from apps.clients.models import Client, ClientCommunication
from apps.finance.models import Expense, Invoice, Payment
from apps.tasks.models import Task


class DemoApiTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_demo", clear=True, verbosity=0)

    def test_bootstrap_api_returns_seeded_crm_data(self):
        response = self.client.get("/api/bootstrap/")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual({key: payload["meta"][key] for key in ("clients", "cases", "tasks", "events")}, {"clients": 4, "cases": 4, "tasks": 9, "events": 6})
        self.assertTrue(payload["meta"]["demoData"]["enabled"])
        self.assertEqual(payload["finance"]["income"], 107000.0)
        self.assertEqual(payload["finance"]["debt"], 23500.0)
        self.assertTrue(payload["clients"])
        self.assertTrue(payload["cases"])

    def test_demo_data_api_clears_and_restores_business_data(self):
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
        self.assertEqual(Client.objects.count(), 0)
        self.assertEqual(Case.objects.count(), 0)
        self.assertEqual(Task.objects.count(), 0)
        self.assertEqual(CaseDocument.objects.count(), 0)
        self.assertEqual(CalendarEvent.objects.count(), 0)
        self.assertEqual(Payment.objects.count() + Invoice.objects.count() + Expense.objects.count(), 0)
        self.assertGreater(get_user_model().objects.count(), 0)

        empty_bootstrap = self.client.get("/api/bootstrap/")
        self.assertEqual(empty_bootstrap.status_code, 200)
        self.assertEqual(empty_bootstrap.json()["meta"]["clients"], 0)

        restore_response = self.client.post(
            "/api/demo-data/",
            {"action": "restore"},
            content_type="application/json",
        )
        self.assertEqual(restore_response.status_code, 200)
        self.assertTrue(restore_response.json()["demoData"]["enabled"])
        self.assertEqual(Client.objects.count(), 4)
        self.assertEqual(Case.objects.count(), 4)
        self.assertEqual(Task.objects.count(), 9)
        self.assertEqual(CalendarEvent.objects.count(), 6)
        self.assertGreater(ClientCommunication.objects.count(), 0)

    def test_list_endpoints_are_available(self):
        endpoints = [
            "/api/users/",
            "/api/clients/",
            "/api/cases/",
            "/api/tasks/",
            "/api/calendar/events/",
            "/api/finance/operations/",
        ]

        for endpoint in endpoints:
            with self.subTest(endpoint=endpoint):
                response = self.client.get(endpoint)
                self.assertEqual(response.status_code, 200)
                self.assertIn("results", response.json())

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
            "caseId": "2024/12345",
        }

        create_response = self.client.post("/api/clients/1/communications/", payload, content_type="application/json")
        self.assertEqual(create_response.status_code, 200)
        created = create_response.json()
        self.assertEqual(created["clientId"], 1)
        self.assertEqual(created["title"], payload["title"])
        self.assertEqual(created["caseId"], "2024/12345")

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
        self.assertTrue(created["id"].startswith("2026/"))

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
            "caseId": "2024/12345",
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
        self.assertEqual(created["caseId"], "2024/12345")
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
            "caseId": "2024/12345",
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
        self.assertEqual(created["caseId"], "2024/12345")
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
            "caseId": "2024/12345",
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
        self.assertEqual(created["caseId"], "2024/12345")
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
            "caseId": "2024/12345",
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
        self.assertEqual(delete_response.json(), {"deleted": operation["id"]})
