import { expect, test } from "@playwright/test";

const viewports = [
  { name: "desktop", width: 1366, height: 768 },
  { name: "tablet", width: 820, height: 1180 },
  { name: "mobile", width: 390, height: 844 }
];

const criticalViews = ["cases", "tasks", "calendar", "planner", "documents", "mailings"];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());
});

for (const viewport of viewports) {
  test(`critical screens fit the ${viewport.name} viewport`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/");

    for (const view of criticalViews) {
      await page.locator(`[data-view="${view}"]`).click();
      await expect(page.locator(`#${view}`)).toHaveClass(/active/);

      const overflow = await page.evaluate(() => ({
        documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        bodyOverflow: document.body.scrollWidth - document.body.clientWidth
      }));

      expect(overflow.documentOverflow, `${viewport.name} ${view} document overflow`).toBeLessThanOrEqual(2);
      expect(overflow.bodyOverflow, `${viewport.name} ${view} body overflow`).toBeLessThanOrEqual(2);
    }
  });
}
