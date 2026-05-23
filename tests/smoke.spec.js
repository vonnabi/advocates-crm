import { expect, test } from "@playwright/test";

const views = [
  ["cases", "Усього справ"],
  ["clients", "Клієнти (124)"],
  ["calendar", "Найближчі події"],
  ["tasks", "Всі задачі"],
  ["documents", "Документи"],
  ["mailings", "Получатели"],
  ["planner", "План на завтра"],
  ["finance", "Фінанси по справах"],
  ["analytics", "Справи за типами"],
  ["ai", "Помічники по галузях права"],
  ["osint", "OSINT перевірки"],
  ["settings", "Профіль бюро"]
];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.localStorage.setItem("crmApiMode", "static");
  });
});

async function openApp(page) {
  await page.goto("/");
  await expect(page.locator("#dashboard")).toContainText("Активних справ");
}

test("main menu screens render content", async ({ page }) => {
  await openApp(page);
  for (const [view, expectedText] of views) {
    await page.locator(`.nav-item[data-view="${view}"]`).click();
    await expect(page.locator(`#${view}`)).toHaveClass(/active/);
    await expect(page.locator(`#${view}`)).toContainText(expectedText);
    const textLength = await page.locator(`#${view}`).evaluate((node) => node.textContent.trim().length);
    expect(textLength, `${view} should not be empty`).toBeGreaterThan(20);
  }
});

test("primary create dialogs open", async ({ page }) => {
  await openApp(page);

  await page.locator('.nav-item[data-view="clients"]').click();
  await expect(page.locator("#add-client")).toBeVisible();
  await page.locator("#add-client").click();
  await expect(page.locator("#client-dialog")).toHaveJSProperty("open", true);
  await page.keyboard.press("Escape");

  await page.locator('.nav-item[data-view="cases"]').click();
  await expect(page.locator("#create-case-from-list")).toBeVisible();
  await page.locator("#create-case-from-list").click();
  await expect(page.locator("#case-dialog")).toHaveJSProperty("open", true);
  await page.keyboard.press("Escape");

  await page.locator('.nav-item[data-view="planner"]').click();
  await expect(page.locator("#add-plan-task")).toBeVisible();
  await page.locator("#add-plan-task").click();
  await expect(page.locator("#task-dialog")).toHaveJSProperty("open", true);
});

test("global documents screen exposes document actions", async ({ page }) => {
  await openApp(page);

  await page.locator('.nav-item[data-view="documents"]').click();
  await expect(page.locator("#documents")).toHaveClass(/active/);
  await expect(page.locator("#documents [data-document-row]").first()).toBeVisible();
  await expect(page.locator(".documents-esign-overview")).toContainText("Електронний підпис");
  await expect(page.locator(".documents-kpi-grid")).toContainText("Електронний підпис");

  await page.locator("#documents [data-document-row]").first().click();
  const documentMenu = page.locator("#documents .documents-row-actions .row-action-menu-wrap").first();
  await documentMenu.locator("[data-action-menu-trigger]").click();
  await expect(page.locator(".row-action-menu:not([hidden])")).toContainText(/е-підпис|підпис/i);
  await expect(page.locator(".row-action-menu:not([hidden])")).toContainText("Експорт");
  await expect(page.locator(".row-action-menu:not([hidden])")).toContainText("ONLYOFFICE");
  await page.locator(".row-action-menu:not([hidden]) [data-esign-global-document]").click();
  await expect(page.locator(".documents-esign-card")).toContainText("Очікує е-підпис");
  await page.locator("#documents .documents-side [data-office-global-document]").click();
  await expect(page.locator("#office-editor-dialog")).toHaveJSProperty("open", true);
  await expect(page.locator("#office-editor-dialog")).toContainText("ONLYOFFICE");
  await page.locator("#office-editor-close").click();
  await documentMenu.locator("[data-action-menu-trigger]").click();
  await page.locator(".row-action-menu:not([hidden]) [data-edit-global-document]").click();
  await expect(page.locator("#document-dialog")).toHaveJSProperty("open", true);
  await expect(page.locator("#document-form textarea[name='content']")).toBeVisible();
  await page.locator("[data-document-fill-draft]").click();
  await expect(page.locator("#document-form textarea[name='content']")).toHaveValue(/Справа/);
  await page.locator("#document-dialog-close").click();

  await page.locator("#documents [data-documents-add]").click();
  await expect(page.locator("#document-dialog")).toHaveJSProperty("open", true);
});

test("case procedural action edit opens dialog", async ({ page }) => {
  await openApp(page);
  const demoCaseId = `${new Date().getFullYear()}/12345`;

  await page.locator('.nav-item[data-view="cases"]').click();
  await page.locator(`[data-open-case="${demoCaseId}"]`).first().click();
  await expect(page.locator("#case-detail")).toContainText("5. ПРОЦЕСУАЛЬНІ ДІЇ");

  await page.locator(".procedural-actions-table [data-action-menu-trigger]").nth(1).click();
  await page.locator('.row-action-menu:not([hidden]) [data-edit-procedural-action="1"]').click();
  await expect(page.locator("#event-dialog")).toHaveJSProperty("open", true);
  await expect(page.locator('#event-dialog input[name="title"]')).toHaveValue("Клопотання про забезпечення позову");
});
