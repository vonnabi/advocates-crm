import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());
});

async function openApp(page) {
  await page.goto("/");
  await expect(page.locator("#dashboard")).toHaveClass(/active/);
}

async function openAndCloseDialog(page, clickSelector, dialogSelector, label) {
  await page.locator(clickSelector).first().click();
  await expect(page.locator(dialogSelector), label).toHaveJSProperty("open", true);
  await page.keyboard.press("Escape");
  await expect(page.locator(dialogSelector), `${label} closes`).toHaveJSProperty("open", false);
}

test("core dialogs and topbar panels open and close cleanly", async ({ page }) => {
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await openApp(page);

  await page.locator('.nav-item[data-view="clients"]').click();
  await openAndCloseDialog(page, "#add-client", "#client-dialog", "client dialog");
  await page.locator("#clients [data-edit-client-row]").first().click();
  await expect(page.locator("#client-dialog")).toHaveJSProperty("open", true);
  await page.locator("#client-dialog-close").click();
  await expect(page.locator("#client-dialog")).toHaveJSProperty("open", false);

  await page.locator('.nav-item[data-view="cases"]').click();
  await openAndCloseDialog(page, "#create-case-from-list", "#case-dialog", "case dialog");
  await page.locator("[data-open-case]").first().click();
  await expect(page.locator("#case-detail")).toContainText("Справа №");
  await openAndCloseDialog(page, "[data-edit-case-section]", "#essence-dialog", "essence dialog");
  await openAndCloseDialog(page, "[data-edit-authority]", "#authority-dialog", "authority dialog");
  await openAndCloseDialog(page, "[data-edit-finance]", "#finance-dialog", "finance dialog");
  await openAndCloseDialog(page, "[data-add-document]", "#document-dialog", "document dialog");
  await openAndCloseDialog(page, "[data-add-folder]", "#folder-dialog", "folder dialog");
  await openAndCloseDialog(page, "[data-add-task]", "#task-dialog", "task dialog from case");
  await openAndCloseDialog(page, "[data-add-event]", "#event-dialog", "event dialog from case");

  await page.locator('.nav-item[data-view="calendar"]').click();
  await openAndCloseDialog(page, "#add-event", "#event-dialog", "calendar event dialog");

  await page.locator('.nav-item[data-view="tasks"]').click();
  await openAndCloseDialog(page, "#task-create-from-section", "#task-dialog", "global task dialog");
  await page.locator("#tasks [data-task-key]").first().click();
  await expect(page.locator("#tasks .task-side-card:not(.empty)")).toBeVisible();
  await page.locator("#tasks [data-delete-task-global]").first().click();
  await expect(page.locator("#delete-document-dialog")).toHaveJSProperty("open", true);
  await page.locator("#delete-document-cancel").click();
  await expect(page.locator("#delete-document-dialog")).toHaveJSProperty("open", false);

  await page.locator('.nav-item[data-view="planner"]').click();
  await openAndCloseDialog(page, "#add-plan-task", "#task-dialog", "planner task dialog");

  await page.locator("#notifications-toggle").click();
  await expect(page.locator("#notifications-menu")).toBeVisible();
  await page.locator("body").click({ position: { x: 10, y: 100 } });
  await expect(page.locator("#notifications-menu")).toBeHidden();

  await page.locator("#admin-profile-toggle").click();
  await expect(page.locator("#admin-profile-menu")).toBeVisible();
  await page.locator("body").click({ position: { x: 10, y: 100 } });
  await expect(page.locator("#admin-profile-menu")).toBeHidden();

  expect(consoleErrors).toEqual([]);
});
