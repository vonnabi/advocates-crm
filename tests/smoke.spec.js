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
  ["ai", "AI помічник по справі"],
  ["osint", "OSINT перевірки"],
  ["settings", "Профіль бюро"]
];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());
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

  await page.locator("#documents [data-document-row]").first().click();
  await page.locator("#documents [data-edit-global-document]").first().click();
  await expect(page.locator("#document-dialog")).toHaveJSProperty("open", true);
  await page.locator("#document-dialog-close").click();

  await page.locator("#documents [data-documents-add]").click();
  await expect(page.locator("#document-dialog")).toHaveJSProperty("open", true);
});
