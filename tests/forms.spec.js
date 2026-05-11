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

  await createdRow.locator("[data-edit-task-global]").click();
  await expect(page.locator("#task-dialog-title")).toHaveText("Редагувати задачу");
  await page.locator('#task-form [name="title"]').fill(updatedTitle);
  await page.locator('#task-form [name="status"]').selectOption("Виконано");
  await page.locator("#task-submit-button").click();

  await page.locator("#task-search").fill(updatedTitle);
  const updatedRow = page.locator("#tasks [data-task-key]").filter({ hasText: updatedTitle });
  await expect(updatedRow).toBeVisible();
  await expect(updatedRow).toContainText("Виконано");

  await updatedRow.locator("[data-delete-task-global]").click();
  await expect(page.locator("#delete-document-dialog")).toHaveJSProperty("open", true);
  await expect(page.locator("#delete-document-text")).toContainText(updatedTitle);
  await page.locator("#delete-document-confirm").click();

  await expect(page.locator("#delete-document-dialog")).toHaveJSProperty("open", false);
  await expect(page.locator("#tasks [data-task-key]").filter({ hasText: updatedTitle })).toHaveCount(0);
});
