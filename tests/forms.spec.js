import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());
});

async function openApp(page) {
  await page.goto("/");
  await expect(page.locator("#dashboard")).toHaveClass(/active/);
}

test("client form creates and edits a client", async ({ page }) => {
  const originalName = "Тестовий клієнт Автотест";
  const updatedName = "Тестовий клієнт Оновлено";

  await openApp(page);
  await page.locator('.nav-item[data-view="clients"]').click();
  await expect(page.locator("#clients")).toHaveClass(/active/);
  await expect(page.locator("#add-client")).toBeVisible();
  await page.locator("#add-client").click();

  await expect(page.locator("#client-dialog")).toHaveJSProperty("open", true);
  await page.locator('#client-form [name="name"]').fill(originalName);
  await page.locator('#client-form [name="phone"]').fill("+380 99 111 22 33");
  await page.locator('#client-form [name="email"]').fill("autotest.client@example.com");
  await page.locator('#client-form [name="telegramUsername"]').fill("@autotest_client");
  await page.locator('#client-form [name="request"]').fill("Перевірка створення клієнта через форму.");
  await page.locator('#client-form [name="source"]').selectOption("Сайт");
  await page.locator('#client-form button[type="submit"]').click();

  await expect(page.locator("#clients")).toHaveClass(/active/);
  await expect(page.locator("#clients")).toContainText(originalName);

  await page.locator("#clients [data-edit-client]").click();
  await expect(page.locator("#client-dialog-title")).toHaveText("Редагувати клієнта");
  await page.locator('#client-form [name="name"]').fill(updatedName);
  await page.locator('#client-form [name="phone"]').fill("+380 99 777 88 99");
  await page.locator('#client-form button[type="submit"]').click();

  await expect(page.locator("#clients")).toContainText(updatedName);
  await expect(page.locator("#clients")).toContainText("+380 99 777 88 99");
});

test("case form creates a case and opens its detail screen", async ({ page }) => {
  const caseTitle = "Автотестова справа щодо договору";

  await openApp(page);
  await page.locator('.nav-item[data-view="cases"]').click();
  await page.locator("#create-case-from-list").click();

  await expect(page.locator("#case-dialog")).toHaveJSProperty("open", true);
  await page.locator('#case-form [name="title"]').fill(caseTitle);
  await page.locator('#case-form [name="type"]').selectOption("Цивільна");
  await page.locator('#case-form [name="stage"]').fill("Первинний аналіз");
  await page.locator('#case-form [name="priority"]').selectOption("Високий");
  await page.locator('#case-form [name="deadline"]').fill("2026-06-15");
  await page.locator("#case-submit-button").click();

  await expect(page.locator("#cases")).toHaveClass(/active/);
  await page.locator("#topbar-back").click();
  await expect(page.locator("#case-detail")).toContainText(caseTitle);
  await expect(page.locator("#cases tr").filter({ hasText: caseTitle })).toContainText("Високий");
});

test("task form creates, edits, and deletes a task", async ({ page }) => {
  const taskTitle = "Автотестова задача для перевірки";
  const updatedTitle = "Автотестова задача оновлена";

  await openApp(page);
  await page.locator('.nav-item[data-view="tasks"]').click();
  await page.locator("#task-create-from-section").click();

  await expect(page.locator("#task-dialog")).toHaveJSProperty("open", true);
  await page.locator('#task-form [name="title"]').fill(taskTitle);
  await page.locator('#task-form [name="status"]').selectOption("В роботі");
  await page.locator('#task-form [name="responsible"]').selectOption("Мельник Н.П.");
  await page.locator('#task-form [name="due"]').fill("2026-06-20");
  await page.locator("#task-submit-button").click();

  await expect(page.locator("#tasks")).toHaveClass(/active/);
  await page.locator("#task-search").fill(taskTitle);
  const createdRow = page.locator("#tasks [data-task-key]").filter({ hasText: taskTitle });
  await expect(createdRow).toBeVisible();

  await createdRow.locator("[data-action-menu-trigger]").click();
  await page.locator(".row-action-menu:not([hidden]) [data-edit-task-global]").click();
  await expect(page.locator("#task-dialog-title")).toHaveText("Редагувати задачу");
  await page.locator('#task-form [name="title"]').fill(updatedTitle);
  await page.locator('#task-form [name="status"]').selectOption("Виконано");
  await page.locator("#task-submit-button").click();

  await page.locator("#task-search").fill(updatedTitle);
  const updatedRow = page.locator("#tasks [data-task-key]").filter({ hasText: updatedTitle });
  await expect(updatedRow).toBeVisible();
  await expect(updatedRow).toContainText("Виконано");

  await updatedRow.locator("[data-action-menu-trigger]").click();
  await page.locator(".row-action-menu:not([hidden]) [data-delete-task-global]").click();
  await expect(page.locator("#delete-document-dialog")).toHaveJSProperty("open", true);
  await expect(page.locator("#delete-document-text")).toContainText(updatedTitle);
  await page.locator("#delete-document-confirm").click();

  await expect(page.locator("#delete-document-dialog")).toHaveJSProperty("open", false);
  await expect(page.locator("#tasks [data-task-key]").filter({ hasText: updatedTitle })).toHaveCount(0);
});

test("task planner flags sync with the planner screen", async ({ page }) => {
  const taskTitle = "Автотестова задача для планера";

  await openApp(page);
  await page.locator('.nav-item[data-view="tasks"]').click();
  await page.locator("#task-create-from-section").click();

  await expect(page.locator("#task-dialog")).toHaveJSProperty("open", true);
  await page.locator('#task-form [name="title"]').fill(taskTitle);
  await page.locator('#task-form [name="status"]').selectOption("В роботі");
  await page.locator('#task-form [name="priority"]').selectOption("Високий");
  await page.locator('#task-form [name="responsible"]').selectOption("Іваненко А.Ю.");
  await page.locator('#task-form [name="due"]').fill("2026-06-21");
  await page.locator('#task-form [name="plannerManual"]').check();
  await page.locator("#task-submit-button").click();

  await expect(page.locator("#tasks")).toHaveClass(/active/);
  await page.locator("#task-sync-planner").click();
  await page.locator('.nav-item[data-view="planner"]').click();

  const plannerItem = page.locator(".planner-item").filter({ hasText: taskTitle });
  await expect(plannerItem).toBeVisible();
  await plannerItem.locator("[data-planner-more]").click();
  await expect(plannerItem.locator(".planner-more-menu")).toBeVisible();
  await plannerItem.locator("[data-edit-planner-task]").click();
  await expect(page.locator("#task-dialog")).toHaveJSProperty("open", true);
  await page.keyboard.press("Escape");
  await expect(page.locator("#task-dialog")).toHaveJSProperty("open", false);
  await plannerItem.locator('[data-complete-planner-task]').click();
  await expect(plannerItem).toHaveCount(0);

  await page.locator('.nav-item[data-view="tasks"]').click();
  await page.locator("#task-search").fill(taskTitle);
  const taskRow = page.locator("#tasks [data-task-key]").filter({ hasText: taskTitle });
  await expect(taskRow).toBeVisible();
  await expect(taskRow).toContainText("Виконано");
});

test("settings invite form adds a bureau user", async ({ page }) => {
  const userName = "Автотестовий співробітник";

  await openApp(page);
  await page.locator('.nav-item[data-view="settings"]').click();
  await expect(page.locator("#settings")).toHaveClass(/active/);

  await page.locator('[data-settings-action="invite"]').click();
  await expect(page.locator("#settings-invite-dialog")).toHaveJSProperty("open", true);
  await page.locator('#settings-invite-form [name="name"]').fill(userName);
  await page.locator('#settings-invite-form [name="email"]').fill("team.autotest@example.com");
  await page.locator('#settings-invite-form [name="role"]').selectOption("Бухгалтер");
  await expect(page.locator('#settings-invite-form [name="access"]')).toHaveValue("Фінанси та звіти");
  await page.locator('#settings-invite-form button[type="submit"]').click();

  await expect(page.locator("#settings-invite-dialog")).toHaveJSProperty("open", false);
  await expect(page.locator("#settings")).toContainText(userName);
  await expect(page.locator("#settings")).toContainText("Бухгалтер");
  await expect(page.locator("#settings")).toContainText(`Запрошено користувача ${userName}`);
});

test("mailing flow saves a template and creates campaigns", async ({ page }) => {
  const message = "Автотестова розсилка для клієнтів {{client_name}}";

  await openApp(page);
  await page.locator('.nav-item[data-view="mailings"]').click();
  await expect(page.locator("#mailings")).toHaveClass(/active/);

  await page.locator("#mailing-text").fill(message);
  await page.locator("[data-save-mailing-template]").click();
  await page.locator('[data-mailing-main-tab="templates"]').click();
  await expect(page.locator("#mailings")).toContainText(message);
  await expect(page.locator("#mailings")).toContainText("Telegram");

  await page.locator('[data-mailing-main-tab="new"]').click();
  await page.locator('[data-mailing-action="test"]').click();
  await expect(page.locator("#mailings")).toContainText("Тестовая отправка");
  await expect(page.locator("#mailings")).toContainText("Тест отправлен");
  await expect(page.locator("#mailings")).toContainText("@ivanenko_admin");

  await page.locator("[data-new-mailing]").click();
  await page.locator("#mailing-text").fill(`${message}\nЗапланований варіант.`);
  await page.locator('input[name="send-time"][value="later"]').check();
  await expect(page.locator("[data-mailing-schedule-date]")).toBeVisible();
  await page.locator("[data-mailing-schedule-date]").fill("2026-06-22");
  await page.locator("[data-mailing-schedule-time]").fill("11:30");
  await page.locator('[data-mailing-action="schedule"]').click();

  await expect(page.locator("#mailings")).toContainText("Информационное сообщение клиентам");
  await expect(page.locator("#mailings")).toContainText("Запланирована");
  await expect(page.locator("#mailings")).toContainText("22.06.2026 11:30");

  await page.locator('[data-mailing-main-tab="automation"]').click();
  await expect(page.locator(".mailing-automation-kpis")).toContainText("Правил");
  const firstAutomationRule = page.locator(".automation-rule").first();
  await firstAutomationRule.locator('[data-toggle-automation="0"]').uncheck();
  await expect(page.locator(".automation-rule").first()).toContainText("Выключено");
  await page.locator('[data-automation-channel="0"]').selectOption("Email");
  await expect(page.locator('[data-automation-channel="0"]')).toHaveValue("Email");
});

test("analytics filters and date picker update the screen", async ({ page }) => {
  await openApp(page);
  await page.locator('.nav-item[data-view="analytics"]').click();
  await expect(page.locator("#analytics")).toHaveClass(/active/);
  await expect(page.locator("#analytics .analytics-date-range")).toContainText("01.05.2024 - 15.05.2024");

  await page.locator("[data-analytics-status]").selectOption("debt");
  await page.locator("[data-apply-analytics]").click();
  await expect(page.locator("[data-analytics-status]")).toHaveValue("debt");
  await expect(page.locator(".analytics-kpi-grid")).toContainText("Всього справ");

  await page.locator("[data-analytics-date-toggle]").click();
  await expect(page.locator("#analytics .analytics-date-popover")).toBeVisible();
  await page.locator("[data-analytics-date-start]").fill("2024-05-10");
  await page.locator("[data-analytics-date-end]").fill("2024-05-15");
  await page.locator("[data-analytics-date-apply]").click();
  await expect(page.locator("#analytics .analytics-date-range")).toContainText("10.05.2024 - 15.05.2024");

  await page.locator("[data-reset-analytics]").click();
  await expect(page.locator("[data-analytics-status]")).toHaveValue("all");
  await expect(page.locator("#analytics .analytics-date-range")).toContainText("01.05.2024 - 15.05.2024");
});

test("finance tabs and date picker update the screen", async ({ page }) => {
  await openApp(page);
  await page.locator('.nav-item[data-view="finance"]').click();
  await expect(page.locator("#finance")).toHaveClass(/active/);

  await expect(page.locator("#finance .finance-date-range")).toContainText("01.05.2024 - 15.05.2024");
  await expect(page.locator(".finance-kpi-grid")).toContainText("Загальний дохід");

  await page.locator('[data-finance-tab="payments"]').click();
  await expect(page.locator('.finance-tabs [data-finance-tab="payments"]')).toHaveClass(/active/);
  await expect(page.locator(".finance-workspace-panel")).toContainText("Платежі");

  await page.locator("[data-finance-date-toggle]").click();
  await expect(page.locator("#finance .finance-date-popover")).toBeVisible();
  await page.locator("[data-finance-date-start]").fill("2024-05-10");
  await page.locator("[data-finance-date-end]").fill("2024-05-15");
  await page.locator("[data-finance-date-apply]").click();

  await expect(page.locator("#finance .finance-date-range")).toContainText("10.05.2024 - 15.05.2024");
  await expect(page.locator("#finance .finance-date-popover")).toHaveCount(0);
});
