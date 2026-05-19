import { expect, test } from "@playwright/test";

async function waitForAppReady(page) {
  await expect(page.locator("#dashboard")).toContainText("Активних справ");
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
  await expect(page.locator(".settings-audit-card")).toContainText("Журнал змін очищено");
});

test("settings user actions open from the three dot menu", async ({ page }) => {
  await page.goto("/");
  await waitForAppReady(page);
  await page.locator('.nav-item[data-view="settings"]').click();

  const assistantRow = page.locator(".settings-user-row").filter({ hasText: "Кравчук А.В." });
  await assistantRow.locator("[data-settings-user-menu]").click();
  await expect(assistantRow.locator(".settings-user-menu")).toBeVisible();

  await assistantRow.locator("[data-settings-user-role]").click();
  await expect(page.locator(".settings-user-row").filter({ hasText: "Кравчук А.В." })).toContainText("Адвокат");
  await expect(page.locator(".settings-audit-card")).toContainText("Змінено роль користувача Кравчук А.В.");
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

  await page.goto("/");
  await expect(page.locator("#dashboard")).toContainText("Активних справ");
  await expect(page.locator("[data-demo-data-toggle]")).toBeVisible();
  await expect(page.locator("[data-demo-data-summary]")).toHaveText("Вимкнено");

  await page.locator('.nav-item[data-view="ai"]').click();
  await expect(page.locator("#ai")).toContainText("Додайте клієнта та справу");
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
