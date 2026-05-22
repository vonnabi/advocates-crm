import { expect, test } from "@playwright/test";

async function waitForAppReady(page) {
  await expect(page.locator("#dashboard")).toContainText("Активних справ");
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.localStorage.setItem("crmApiMode", "static");
  });
});

function apiWorkspacePayload(permissions) {
  const year = new Date().getFullYear();
  const currentUser = {
    id: 7,
    name: "Кравчук А.В.",
    email: "kravchuk@advocates.crm",
    role: "Помічник",
    access: "Індивідуальний доступ",
    photo: "КА",
    active: true
  };
  return {
    session: {
      authenticated: true,
      user: currentUser,
      permissions
    },
    currentUser,
    settingsUsers: [currentUser],
    clients: [
      {
        id: 1,
        name: "Марченко Олег",
        phone: "+380501112233",
        email: "oleg@example.com",
        request: "Оскарження рішення ТЦК",
        notes: "Тестова картка клієнта",
        status: "Активний",
        added: `${year}-05-01`,
        lastContact: `${year}-05-12`,
        source: "Сайт",
        manager: "Кравчук А.В.",
        telegramUsername: "@marchenko",
        communications: []
      }
    ],
    cases: [
      {
        id: `${year}/12345`,
        clientId: 1,
        title: "Оскарження рішення ТЦК",
        type: "Адміністративна",
        status: "В роботі",
        stage: "Підготовка позову",
        priority: "Високий",
        responsible: "Кравчук А.В.",
        court: "Окружний адміністративний суд",
        opened: `${year}-05-01`,
        deadline: `${year}-05-25`,
        debt: 0,
        income: 0,
        documents: [
          {
            name: "Адміністративний позов",
            type: "Позов",
            status: "Чернетка",
            submitted: "-",
            responseDue: "-"
          }
        ],
        history: [],
        tasks: [
          {
            title: "Підготувати позов",
            status: "Нова",
            priority: "Високий",
            due: `${year}-05-24 10:00`,
            responsible: "Кравчук А.В.",
            plannerManual: true,
            plannerDate: `${year}-05-24`,
            subtasks: []
          }
        ]
      }
    ],
    tasks: [],
    events: [],
    financeOperations: [],
    finance: { income: 0, paid: 0, debt: 0, activeCases: 1, documents: 1, tasks: 1 },
    meta: {
      clients: 1,
      cases: 1,
      tasks: 1,
      events: 0,
      demoData: {
        enabled: true,
        total: 3,
        counts: { clients: 1, cases: 1, tasks: 1, documents: 1, events: 0, financeOperations: 0, communications: 0, campaigns: 0 }
      }
    }
  };
}

test("topbar back returns from case detail to the cases list", async ({ page }) => {
  await page.goto("/");
  await waitForAppReady(page);
  await page.locator('.nav-item[data-view="cases"]').click();
  await page.locator("[data-open-case]").first().click();

  await expect(page.locator("#cases")).toHaveClass(/active/);
  await expect(page.locator("#case-detail")).toContainText("Справа №");
  await expect(page.locator("#topbar-back")).toHaveClass(/visible/);
  await expect(page.locator("#topbar-back")).toHaveAttribute("aria-label", "Назад к списку справ");

  await page.locator("#topbar-back").click();

  await expect(page.locator("#cases")).toHaveClass(/active/);
  await expect(page.locator("#case-detail")).toContainText("Усього справ");
  await expect(page.locator("#topbar-back")).not.toHaveAttribute("aria-label", "Назад к списку справ");
});

test("topbar back closes the task detail panel before leaving tasks", async ({ page }) => {
  await page.goto("/");
  await waitForAppReady(page);
  await page.locator('.nav-item[data-view="tasks"]').click();
  const taskRow = page.locator("#tasks [data-task-key]").first();
  await expect(taskRow).toBeVisible();
  await taskRow.click();

  await expect(page.locator("#tasks")).toHaveClass(/active/);
  await expect(page.locator("#tasks .task-side-card:not(.empty)")).toBeVisible();
  await expect(page.locator("#topbar-back")).toHaveAttribute("aria-label", "Назад к списку задач");

  await page.locator("#topbar-back").click();

  await expect(page.locator("#tasks")).toHaveClass(/active/);
  await expect(page.locator("#tasks .task-side-card")).toHaveCount(0);
  await expect(page.locator("#topbar-back")).not.toHaveAttribute("aria-label", "Назад к списку задач");
});

test("dashboard rows open the exact event, task, and case", async ({ page }) => {
  await page.goto("/");
  await waitForAppReady(page);

  const eventRow = page.locator("#dashboard [data-dashboard-event]").first();
  const eventTitle = await eventRow.locator("strong").innerText();
  await eventRow.click();
  await expect(page.locator("#calendar")).toHaveClass(/active/);
  await expect(page.locator(".calendar-mode-group [data-calendar-mode='list']")).toHaveClass(/active/);
  await expect(page.locator("#calendar")).toContainText(eventTitle);

  await page.locator('.nav-item[data-view="dashboard"]').click();
  const taskRow = page.locator("#dashboard [data-dashboard-task]").first();
  const taskTitle = await taskRow.locator("strong").innerText();
  await taskRow.click();
  await expect(page.locator("#tasks")).toHaveClass(/active/);
  await expect(page.locator("#tasks .task-side-card:not(.empty)")).toContainText(taskTitle);

  await page.locator('.nav-item[data-view="dashboard"]').click();
  const caseRow = page.locator("#dashboard [data-dashboard-case]").first();
  const caseId = await caseRow.getAttribute("data-dashboard-case");
  await caseRow.click();
  await expect(page.locator("#cases")).toHaveClass(/active/);
  await expect(page.locator("#case-detail")).toContainText(`Справа № ${caseId}`);
});

for (const view of ["tasks", "planner"]) {
  test(`mobile topbar back returns from a restored ${view} screen to dashboard`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript((currentView) => {
      window.localStorage.setItem("advocates-crm-navigation", JSON.stringify({ currentView, viewHistory: [] }));
    }, view);
    await page.goto("/");

    await expect(page.locator(`#${view}`)).toHaveClass(/active/);
    await expect(page.locator("#topbar-back")).toHaveClass(/visible/);
    await expect(page.locator("#topbar-back")).toHaveAttribute("aria-label", "Назад к разделу: Дашборд");

    await page.locator("#topbar-back").click();
    await expect(page.locator("#dashboard")).toHaveClass(/active/);
  });
}

test("notifications menu navigates, closes, and clears the badge", async ({ page }) => {
  await page.goto("/");
  await waitForAppReady(page);
  await expect(page.locator("#notifications-count")).toHaveText("3");
  await page.locator("#notifications-toggle").click();

  await expect(page.locator("#notifications-menu")).toBeVisible();
  await expect(page.locator("#notifications-toggle")).toHaveAttribute("aria-expanded", "true");

  await page.locator('[data-notification-view="tasks"]').click();

  await expect(page.locator("#tasks")).toHaveClass(/active/);
  await expect(page.locator("#notifications-menu")).toBeHidden();
  await expect(page.locator("#notifications-count")).toHaveText("2");

  await page.locator("#notifications-toggle").click();
  await page.locator("[data-clear-notifications]").click();

  await expect(page.locator("#notifications-menu")).toBeHidden();
  await expect(page.locator("#notifications-count")).toHaveText("0");
  await expect(page.locator("#notifications-count")).toHaveClass(/empty/);
});

test("notification settings control topbar notification rows", async ({ page }) => {
  await page.goto("/");
  await waitForAppReady(page);
  await page.locator('.nav-item[data-view="settings"]').click();
  await page.locator('[data-settings-notification="court"]').uncheck();

  await expect(page.locator("#notifications-count")).toHaveText("2");
  await page.locator("#notifications-toggle").click();
  await expect(page.locator('[data-notification-key="court"]')).toBeHidden();

  await page.locator("#notifications-toggle").click();
  await page.locator('[data-settings-notification="court"]').check();
  await expect(page.locator("#notifications-count")).toHaveText("3");
});

test("settings integrations update summary and audit trail", async ({ page }) => {
  await page.goto("/");
  await waitForAppReady(page);
  await page.locator('.nav-item[data-view="settings"]').click();

  await expect(page.locator('[data-settings-action="invite"]')).toContainText("Додати користувача");
  await expect(page.locator("[data-save-settings]")).toContainText("Зберегти профіль");
  await expect(page.locator("[data-bureau-logo-manual]")).toBeVisible();
  await expect(page.locator('[data-bureau-field="instagram"]')).toBeVisible();
  await expect(page.locator('[data-bureau-field="facebook"]')).toBeVisible();
  await expect(page.locator('[data-bureau-field="tiktok"]')).toBeVisible();
  await expect(page.locator('[data-bureau-field="whatsapp"]')).toBeVisible();
  await expect(page.locator('[data-bureau-field="telegram"]')).toBeVisible();
  await expect(page.locator('[data-bureau-field="website"]')).toBeVisible();
  await expect(page.locator(".settings-contact-preview")).toHaveCount(0);
  await page.locator("[data-bureau-logo-upload]").setInputFiles({
    name: "test-logo.png",
    mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=", "base64")
  });
  await expect(page.locator(".settings-bureau-logo-preview img")).toHaveAttribute("src", /^data:image\/png/);
  await expect(page.locator("[data-bureau-logo-manual]")).toHaveValue("Завантажений логотип");
  await expect(page.locator('[data-bureau-field="logo"]')).toHaveValue(/^data:image\/png/);
  await expect(page.locator(".brand-mark img")).toHaveAttribute("src", /^data:image\/png/);
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute("href", /^data:image\/png/);
  await expect(page.locator(".settings-summary-grid")).toContainText("3/4");
  await page.locator('[data-settings-focus="integrations"]').click();
  await expect(page.locator('[data-settings-section="integrations"]')).toHaveClass(/is-focused/);
  await expect(page.locator('[data-settings-focus="integrations"]')).toHaveClass(/active/);
  await page.locator('[data-settings-integration="Email"]').check();
  await expect(page.locator(".settings-summary-grid")).toContainText("4/4");
  await expect(page.locator(".settings-audit-card")).toContainText("Email: інтеграцію увімкнено");

  await page.locator('[data-settings-focus="audit"]').click();
  await expect(page.locator('[data-settings-section="audit"]')).toHaveClass(/is-focused/);
  await page.locator("[data-settings-clear-audit]").click();
  await expect(page.locator("#settings-audit-clear-dialog")).toHaveJSProperty("open", true);
  await expect(page.locator("#settings-audit-clear-dialog")).toContainText("Очистити журнал змін?");
  await page.locator("#settings-audit-clear-dialog [data-settings-clear-audit-cancel]").first().click();
  await expect(page.locator("#settings-audit-clear-dialog")).toHaveJSProperty("open", false);
  await expect(page.locator(".settings-audit-card")).toContainText("Email: інтеграцію увімкнено");
  await page.locator("[data-settings-clear-audit]").click();
  await page.locator("#settings-audit-clear-dialog [data-settings-clear-audit-confirm]").click();
  await expect(page.locator(".settings-audit-card")).toContainText("Журнал змін порожній");
});

test("settings user actions open from the three dot menu", async ({ page }) => {
  await page.goto("/");
  await waitForAppReady(page);
  await page.locator('.nav-item[data-view="settings"]').click();

  const assistantRow = page.locator(".settings-user-row").filter({ hasText: "Кравчук А.В." });
  await assistantRow.locator("[data-settings-user-menu]").click();
  await expect(assistantRow.locator(".settings-user-menu")).toBeVisible();
  await assistantRow.locator("[data-settings-user-delivery]").click();
  await expect(page.locator("#settings-access-delivery-dialog")).toHaveJSProperty("open", true);
  await expect(page.locator("[data-settings-delivery-message]")).toHaveValue(/Логін:/);
  await expect(page.locator("[data-settings-delivery-message]")).toHaveValue(/Тимчасовий пароль:/);
  await page.locator("[data-settings-delivery-close]").click();

  await page.locator(".settings-user-row").filter({ hasText: "Кравчук А.В." }).locator("[data-settings-user-menu]").click();
  await page.locator(".settings-user-row").filter({ hasText: "Кравчук А.В." }).locator("[data-settings-user-delete]").click();
  await expect(page.locator("#settings-user-delete-dialog")).toHaveJSProperty("open", true);
  await expect(page.locator("#settings-user-delete-dialog")).toContainText("Видалити користувача?");
  await expect(page.locator("#settings-user-delete-dialog")).toContainText("Кравчук А.В.");
  await page.locator("#settings-user-delete-dialog [data-settings-delete-user-cancel]").first().click();
  await expect(page.locator("#settings-user-delete-dialog")).toHaveJSProperty("open", false);
  await expect(page.locator(".settings-user-row").filter({ hasText: "Кравчук А.В." })).toBeVisible();

  await page.locator(".settings-user-row").filter({ hasText: "Кравчук А.В." }).locator("[data-settings-user-menu]").click();
  await expect(assistantRow.locator("[data-settings-user-role]")).toHaveCount(0);
  await expect(assistantRow.locator("[data-settings-user-access]")).toHaveCount(0);
  await assistantRow.locator("[data-settings-user-edit]").click();
  await expect(page.locator("#settings-invite-dialog")).toHaveJSProperty("open", true);
  await expect(page.locator("[data-settings-user-dialog-title]")).toHaveText("Картка користувача");
  await expect(page.locator("#settings-invite-form input[name='name']")).toHaveValue("Кравчук А.В.");
});

test("sidebar collapse and restore controls keep the navigation usable", async ({ page }) => {
  await page.goto("/");
  await waitForAppReady(page);

  await page.locator(".collapse-menu").click();
  await expect(page.locator("body")).toHaveClass(/sidebar-collapsed/);
  await expect(page.locator(".sidebar-restore")).toBeVisible();

  await page.locator(".sidebar-restore").click();
  await expect(page.locator("body")).not.toHaveClass(/sidebar-collapsed/);
  await expect(page.locator('.nav-item[data-view="dashboard"]')).toBeVisible();
});

test("profile menu actions can open settings and collapse the sidebar", async ({ page }) => {
  await page.goto("/");
  await waitForAppReady(page);
  await page.locator("#admin-profile-toggle").click();

  await expect(page.locator("#admin-profile-menu")).toBeVisible();
  await page.locator('[data-profile-action="settings"]').click();
  await expect(page.locator("#settings")).toHaveClass(/active/);

  await page.locator("#admin-profile-toggle").click();
  await page.locator('[data-profile-action="compact"]').click();
  await expect(page.locator("body")).toHaveClass(/sidebar-collapsed/);
});

test("mobile profile demo buttons stay inside the dropdown", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await waitForAppReady(page);
  await page.locator("#admin-profile-toggle").click();

  await expect(page.locator("#admin-profile-menu")).toBeVisible();
  const buttonsFit = await page.locator(".demo-share-box").evaluate((box) => {
    const boxRect = box.getBoundingClientRect();
    return [...box.querySelectorAll("button")].every((button) => {
      const rect = button.getBoundingClientRect();
      return rect.left >= boxRect.left - 1 && rect.right <= boxRect.right + 1;
    });
  });

  expect(buttonsFit).toBe(true);
});

test("profile logout opens a visible demo session screen", async ({ page }) => {
  await page.goto("/");
  await waitForAppReady(page);
  await page.locator("#admin-profile-toggle").click();
  await page.locator('[data-profile-action="logout"]').click();

  await expect(page.locator("#logout-overlay")).toBeVisible();
  await expect(page.locator("#logout-overlay")).toContainText("Сеанс завершено");

  await page.locator("[data-login-return]").click();
  await expect(page.locator("#logout-overlay")).toBeHidden();
});

test("API empty demo mode still renders the workspace and AI empty state", async ({ page }) => {
  const emptyPayload = {
    session: {
      authenticated: false,
      user: { id: 1, name: "Іваненко А.Ю.", email: "ivanenko@advocates.crm", role: "Адміністратор", access: "Повний доступ", photo: "ІА", active: true },
      permissions: { canManageUsers: true, canSeeFinance: true, canManageCases: true }
    },
    currentUser: { id: 1, name: "Іваненко А.Ю.", email: "ivanenko@advocates.crm", role: "Адміністратор", access: "Повний доступ", photo: "ІА", active: true },
    settingsUsers: [{ id: 1, name: "Іваненко А.Ю.", email: "ivanenko@advocates.crm", role: "Адміністратор", access: "Повний доступ", photo: "ІА", active: true }],
    clients: [],
    cases: [],
    tasks: [],
    events: [],
    financeOperations: [],
    finance: { income: 0, paid: 0, debt: 0, activeCases: 0, documents: 0, tasks: 0 },
    meta: {
      clients: 0,
      cases: 0,
      tasks: 0,
      events: 0,
      demoData: {
        enabled: false,
        total: 0,
        counts: { clients: 0, cases: 0, tasks: 0, documents: 0, events: 0, financeOperations: 0, communications: 0, campaigns: 0 }
      }
    }
  };
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.localStorage.setItem("crmApiBase", window.location.origin);
  });
  await page.route("**/api/bootstrap/", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(emptyPayload) });
  });
  await page.route("**/api/demo-data/", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(emptyPayload.meta.demoData) });
  });

  await page.goto("/");
  await expect(page.locator("#dashboard")).toContainText("Активних справ");
  await expect(page.locator(".dashboard-kpi-grid")).toContainText("Без даних");
  await expect(page.locator(".dashboard-kpi-grid")).not.toContainText("+12%");
  await expect(page.locator(".dashboard-kpi-grid")).not.toContainText("+20%");
  await expect(page.locator("#admin-profile-toggle")).toContainText("Admin");
  await expect(page.locator("#admin-profile-toggle")).not.toContainText("Іваненко");
  await expect(page.locator('.nav-item[data-view="tasks"] .nav-badge')).toBeHidden();
  await expect(page.locator('.nav-item[data-view="ai"] .nav-new')).toHaveCount(0);
  await expect(page.locator("[data-demo-data-toggle]")).toBeVisible();
  await expect(page.locator("[data-demo-data-summary]")).toHaveText("Вимкнено");
  await expect(page.locator("#notifications-count")).toHaveText("0");
  await expect(page.locator("#notifications-count")).toHaveClass(/empty/);
  await page.locator("#notifications-toggle").click();
  await expect(page.locator("[data-notifications-empty]")).toBeVisible();
  await page.locator("#notifications-toggle").click();

  await page.locator('.nav-item[data-view="tasks"]').click();
  await expect(page.locator(".tasks-kpi-grid")).toContainText("Без даних");
  await expect(page.locator(".tasks-kpi-grid")).not.toContainText("+12%");

  await page.locator('.nav-item[data-view="settings"]').click();
  await expect(page.locator(".settings-user-row").first()).toContainText("Admin");
  await expect(page.locator(".settings-user-row").first()).not.toContainText("Іваненко");

  await page.locator('.nav-item[data-view="finance"]').click();
  await expect(page.locator(".finance-kpi-grid")).toContainText("Без даних");
  await expect(page.locator(".finance-kpi-grid")).not.toContainText("+12%");
  await expect(page.locator(".finance-kpi-grid")).not.toContainText("+8%");
  await expect(page.locator(".finance-status-card")).toContainText("Всього на рахунках0 грн");
  await expect(page.locator(".finance-status-card")).not.toContainText("540 200");
  await expect(page.locator(".finance-income-donut")).toHaveClass(/is-empty/);

  await page.locator('.nav-item[data-view="mailings"]').click();
  await expect(page.locator(".coverage-row")).toContainText("Всего клиентов0");
  await expect(page.locator(".coverage-row")).not.toContainText("82%");
  await expect(page.locator(".forecast-card")).toContainText("0 сообщений");
  await expect(page.locator(".forecast-card")).not.toContainText("744");

  await page.locator('.nav-item[data-view="analytics"]').click();
  await expect(page.locator(".analytics-kpi-card strong")).toHaveText(["0", "0", "0", "0", "0 днів", "0%"]);
  await expect(page.locator(".analytics-status-donut")).toHaveClass(/is-empty/);
  await expect(page.locator(".analytics-finance-summary")).toContainText("Без даних");
  await expect(page.locator(".analytics-finance-summary")).not.toContainText("з фінансів");
  await expect(page.locator(".analytics-finance-summary")).not.toContainText("з операцій");

  await page.locator('.nav-item[data-view="osint"]').click();
  await expect(page.locator("#osint .osint-kpi-card strong")).toHaveText(["0", "0", "0", "0", "0", "0"]);
  await expect(page.locator("#osint .osint-kpi-grid")).toContainText("Без даних");
  await expect(page.locator("#osint .osint-kpi-grid")).not.toContainText("+18%");
  await expect(page.locator("#osint .osint-kpi-grid")).not.toContainText("+12%");
  await expect(page.locator("#osint .osint-empty-state")).toContainText("OSINT даних ще немає");
  await expect(page.locator("#osint .osint-line-chart")).toHaveCount(0);

  await page.locator('.nav-item[data-view="ai"]').click();
  await expect(page.locator("#ai")).toContainText("Додайте клієнта та справу");
});

test("assistant API role cannot open the finance section", async ({ page }) => {
  const assistantPayload = {
    session: {
      authenticated: true,
      user: { id: 3, name: "Кравчук А.В.", email: "kravchuk@advocates.crm", role: "Помічник", access: "Задачі та документи", photo: "КА", active: true },
      permissions: {
        canManageUsers: false,
        canSeeFinance: false,
        canManageFinance: false,
        canManageCases: false,
        canManageClients: false,
        canManageTasks: true,
        canManageDocuments: true,
        canManageCalendar: true
      }
    },
    currentUser: { id: 3, name: "Кравчук А.В.", email: "kravchuk@advocates.crm", role: "Помічник", access: "Задачі та документи", photo: "КА", active: true },
    settingsUsers: [{ id: 3, name: "Кравчук А.В.", email: "kravchuk@advocates.crm", role: "Помічник", access: "Задачі та документи", photo: "КА", active: true }],
    clients: [],
    cases: [],
    tasks: [],
    events: [],
    financeOperations: [],
    finance: { income: 0, paid: 0, debt: 0, activeCases: 0, documents: 0, tasks: 0 },
    meta: { clients: 0, cases: 0, tasks: 0, events: 0, demoData: { enabled: false, total: 0, counts: {} } }
  };
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.localStorage.setItem("crmApiBase", window.location.origin);
    window.localStorage.setItem("advocates-crm-navigation", JSON.stringify({ currentView: "finance", viewHistory: [] }));
  });
  await page.route("**/api/bootstrap/", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(assistantPayload) });
  });

  await page.goto("/");

  await expect(page.locator("#dashboard")).toHaveClass(/active/);
  await expect(page.locator('.nav-item[data-view="finance"]')).toBeHidden();
  await expect(page.locator("#finance")).not.toHaveClass(/active/);
});

test("API role hides denied action controls inside allowed sections", async ({ page }) => {
  const limitedPayload = apiWorkspacePayload({
    canManageUsers: false,
    canSeeFinance: false,
    canManageFinance: false,
    canManageCases: false,
    canManageClients: true,
    canManageTasks: true,
    canManageDocuments: true,
    canManageCalendar: true,
    canManageMailings: false,
    canUseAi: false,
    canViewPlanner: true,
    canViewAnalytics: false,
    canUseOsint: false
  });
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.localStorage.setItem("crmApiBase", window.location.origin);
  });
  await page.route("**/api/bootstrap/", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(limitedPayload) });
  });

  await page.goto("/");
  await page.locator('.nav-item[data-view="clients"]').click();

  await expect(page.locator("#add-client")).toBeVisible();
  await expect(page.locator("[data-client-telegram-settings]")).toBeHidden();
  await expect(page.locator("[data-client-mailing-panel]")).toBeHidden();

  await page.locator('.nav-item[data-view="documents"]').click();
  await expect(page.locator("[data-documents-add]")).toBeVisible();
  await expect(page.locator("[data-documents-ai]")).toHaveCount(2);
  await expect(page.locator("[data-documents-ai]").first()).toBeHidden();
  await expect(page.locator("[data-documents-ai]").nth(1)).toBeHidden();
});

test("AI action controls are available without client management access", async ({ page }) => {
  const aiPayload = apiWorkspacePayload({
    canManageUsers: false,
    canSeeFinance: false,
    canManageFinance: false,
    canManageCases: false,
    canManageClients: false,
    canManageTasks: true,
    canManageDocuments: true,
    canManageCalendar: true,
    canManageMailings: false,
    canUseAi: true,
    canViewPlanner: true,
    canViewAnalytics: false,
    canUseOsint: false
  });
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.localStorage.setItem("crmApiBase", window.location.origin);
  });
  await page.route("**/api/bootstrap/", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(aiPayload) });
  });

  await page.goto("/");

  await expect(page.locator('.nav-item[data-view="clients"]')).toBeHidden();
  await page.locator('.nav-item[data-view="ai"]').click();
  await expect(page.locator("[data-ai-create-case]")).toBeVisible();
  await expect(page.locator("[data-ai-send]")).toBeVisible();
});

test("AI assistants search, open chat, and answer quick questions", async ({ page }) => {
  await page.goto("/");
  await waitForAppReady(page);
  await page.locator('.nav-item[data-view="ai"]').click();

  await expect(page.locator("#ai")).toContainText("Помічники по галузях права");
  await expect(page.locator(".ai-summary-strip")).toContainText("Активні");
  await page.locator('[data-ai-helper="military"]').click();
  await expect(page.locator('[data-ai-helper="military"]')).toHaveClass(/active/);
  await expect(page.locator("[data-ai-assistant-row]").first()).toContainText("Військове право");
  await page.locator('[data-ai-helper="military"]').click();
  await expect(page.locator('[data-ai-helper="military"]')).not.toHaveClass(/active/);
  await page.locator('[data-ai-view-mode="list"]').click();
  await expect(page.locator(".ai-case-list")).toHaveClass(/list-mode/);
  await page.locator('[data-ai-summary-filter="На навчанні"]').click();
  await expect(page.locator("[data-ai-status-filter]")).toHaveValue("На навчанні");
  await page.locator('[data-ai-summary-filter="all"]').click();
  await page.locator("[data-ai-case-search]").fill("ТЦК");
  await expect(page.locator("[data-ai-assistant-row]").first()).toContainText(/тцк/i);

  await page.locator("[data-ai-assistant-row]").first().click();
  await expect(page.locator(".ai-card-chat-panel")).toContainText("Чат по справі");
  await page.locator("[data-ai-close-chat]").click();
  await expect(page.locator(".ai-card-chat-panel")).toHaveCount(0);
  await page.locator("[data-ai-assistant-row]").first().click();
  await expect(page.locator(".ai-card-chat-panel")).toContainText("Чат по справі");

  await page.locator("[data-ai-question]").first().click();
  await expect(page.locator(".ai-chat .bubble.user").last()).toContainText("Які підстави");
});

test("OSINT metric cards open the relevant workspace slices", async ({ page }) => {
  await page.goto("/");
  await waitForAppReady(page);
  await page.locator('.nav-item[data-view="osint"]').click();

  await expect(page.locator("#osint")).toContainText("OSINT перевірки");
  await page.locator('[data-osint-metric="risks"]').click();
  await expect(page.locator('[data-osint-subtab="risks"]')).toHaveClass(/active/);
  await expect(page.locator('[data-osint-metric="risks"]')).toHaveClass(/active/);

  await page.locator('[data-osint-metric="monitoring"]').click();
  await expect(page.locator('[data-osint-tab="monitoring"]')).toHaveClass(/active/);
  await expect(page.locator("#osint")).toContainText("Активний моніторинг");

  await page.locator('[data-osint-metric="sources"]').click();
  await expect(page.locator('[data-osint-tab="overview"]')).toHaveClass(/active/);
  await expect(page.locator(".osint-source-manager")).toBeVisible();

  await page.locator("[data-osint-date-toggle]").click();
  await expect(page.locator("#osint .osint-date-popover")).toBeVisible();
  await page.locator("[data-osint-date-start]").fill("2024-05-12");
  await page.locator("[data-osint-date-end]").fill("2024-05-16");
  await page.locator("[data-osint-date-apply]").click();
  await expect(page.locator("#osint .osint-date-range")).toContainText("12.05.2024 - 16.05.2024");
  await expect(page.locator("#osint .osint-date-popover")).toHaveCount(0);
});

test("calendar filters can narrow events and reset cleanly", async ({ page }) => {
  await page.goto("/");
  await waitForAppReady(page);
  await page.locator('.nav-item[data-view="calendar"]').click();

  await page.locator("#calendar-filter").selectOption("court");
  await expect(page.locator("#calendar-filter")).toHaveValue("court");
  await page.locator("#calendar-overdue-filter").check();
  await expect(page.locator("#calendar-overdue-filter")).toBeChecked();
  await page.locator("[data-calendar-show-list]").click();
  await expect(page.locator(".calendar-mode-group [data-calendar-mode='list']")).toHaveClass(/active/);

  await page.locator("[data-calendar-reset-filters]").click();
  await expect(page.locator("#calendar-filter")).toHaveValue("all");
  await expect(page.locator("#calendar-overdue-filter")).not.toBeChecked();
  await expect(page.locator(".calendar-mode-group [data-calendar-mode='month']")).toHaveClass(/active/);
});

test("planner KPI cards focus the matching priority group", async ({ page }) => {
  await page.goto("/");
  await waitForAppReady(page);
  await page.locator('.nav-item[data-view="planner"]').click();

  await page.locator('[data-planner-kpi="urgent"]').click();
  await expect(page.locator('[data-planner-kpi="urgent"]')).toHaveClass(/active/);
  await expect(page.locator('[data-planner-group="urgent"]')).toHaveClass(/is-focused/);

  await page.locator('[data-planner-kpi="all"]').click();
  await expect(page.locator('[data-planner-kpi="all"]')).toHaveClass(/active/);
  await expect(page.locator('[data-planner-group="urgent"]')).not.toHaveClass(/is-focused/);
  await expect(page.locator(".planner-item-icon").first()).toHaveAttribute("data-tooltip", /^(?!.* · ).+/);
});
