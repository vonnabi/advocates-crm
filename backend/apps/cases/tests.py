from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.db.models import Q
from django.test import TestCase
from django.utils import timezone

from apps.accounts.models import UserProfile
from apps.calendar_app.models import CalendarEvent
from apps.cases.models import Case, CaseDocument, CaseMember
from apps.clients.models import Client, ClientCommunication
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
        self.assertEqual({key: payload["meta"][key] for key in ("clients", "cases", "tasks", "events")}, {"clients": 4, "cases": 4, "tasks": 9, "events": 6})
        self.assertTrue(payload["meta"]["demoData"]["enabled"])
        self.assertEqual(Client.objects.filter(is_demo=True).count(), 4)
        self.assertEqual(Case.objects.filter(is_demo=True).count(), 4)
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
        self.assertTrue(Client.objects.filter(pk=manual_client.pk, is_demo=False).exists())
        self.assertTrue(Case.objects.filter(number=manual_case.number, is_demo=False).exists())
        self.assertTrue(Task.objects.filter(title="Реальна задача", is_demo=False).exists())
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
        self.assertEqual(Client.objects.filter(is_demo=True).count(), 4)
        self.assertEqual(Case.objects.filter(is_demo=True).count(), 4)
        self.assertEqual(Task.objects.filter(is_demo=True).count(), 9)
        self.assertEqual(CalendarEvent.objects.filter(is_demo=True).count(), 6)
        self.assertEqual(Client.objects.count(), 5)
        self.assertEqual(Case.objects.count(), 5)
        self.assertEqual(Task.objects.count(), 10)
        self.assertEqual(CalendarEvent.objects.count(), 6)
        self.assertGreater(ClientCommunication.objects.count(), 0)
        self.assertTrue(get_user_model().objects.filter(email="melnyk@advocates.crm").exists())
        self.assertTrue(get_user_model().objects.filter(email="kravchuk@advocates.crm").exists())
        self.assertTrue(get_user_model().objects.filter(email="petrenko@advocates.crm").exists())

    def test_demo_clear_preserves_user_records_attached_to_demo_parent(self):
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
        self.assertEqual(delete_response.json(), {"deleted": operation["id"]})
