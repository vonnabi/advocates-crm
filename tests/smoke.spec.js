import { expect, test } from "@playwright/test";

const views = [
  ["cases", "Усього справ"],
  ["clients", "Клієнти (124)"],
  ["calendar", "Найближчі події"],
  ["tasks", "Всі задачі"],
  ["documents", "Документи"],
  ["mailings", "Получатели"],
  ["planner", "План на завтра"],
  ["analytics", "Справи за типами"]
];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());
});

test("main menu screens render content", async ({ page }) => {
  await page.goto("/");

  for (const [view, expectedText] of views) {
    await page.locator(`[data-view="${view}"]`).click();
    await expect(page.locator(`#${view}`)).toHaveClass(/active/);
    await expect(page.locator(`#${view}`)).toContainText(expectedText);
    const textLength = await page.locator(`#${view}`).evaluate((node) => node.textContent.trim().length);
    expect(textLength, `${view} should not be empty`).toBeGreaterThan(20);
  }
});

test("primary create dialogs open", async ({ page }) => {
  await page.goto("/");

  await page.locator('[data-view="clients"]').click();
  await expect(page.locator("#add-client")).toBeVisible();
  await page.locator("#add-client").click();
  await expect(page.locator("#client-dialog")).toHaveJSProperty("open", true);
  await page.keyboard.press("Escape");

  await page.locator('[data-view="cases"]').click();
  await expect(page.locator("#create-case-from-list")).toBeVisible();
  await page.locator("#create-case-from-list").click();
  await expect(page.locator("#case-dialog")).toHaveJSProperty("open", true);
  await page.keyboard.press("Escape");

  await page.locator('[data-view="planner"]').click();
  await expect(page.locator("#add-plan-task")).toBeVisible();
  await page.locator("#add-plan-task").click();
  await expect(page.locator("#task-dialog")).toHaveJSProperty("open", true);
});
