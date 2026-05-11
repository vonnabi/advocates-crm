import { expect, test } from "@playwright/test";

const viewports = [
  { name: "desktop", width: 1366, height: 768 },
  { name: "tablet", width: 820, height: 1180 },
  { name: "mobile", width: 390, height: 844 }
];

const criticalViews = [
  "dashboard",
  "cases",
  "clients",
  "calendar",
  "tasks",
  "documents",
  "mailings",
  "ai",
  "planner",
  "analytics",
  "finance",
  "osint",
  "settings"
];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());
});

for (const viewport of viewports) {
  test(`critical screens fit the ${viewport.name} viewport`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/");

    for (const view of criticalViews) {
      await page.locator(`.nav-item[data-view="${view}"]`).click();
      await expect(page.locator(`#${view}`)).toHaveClass(/active/);

      const overflow = await page.evaluate((activeView) => {
        const section = document.querySelector(`#${activeView}`);
        return {
          documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          bodyOverflow: document.body.scrollWidth - document.body.clientWidth,
          sectionOverflow: section ? section.scrollWidth - section.clientWidth : 0
        };
      }, view);

      expect(overflow.documentOverflow, `${viewport.name} ${view} document overflow`).toBeLessThanOrEqual(2);
      expect(overflow.bodyOverflow, `${viewport.name} ${view} body overflow`).toBeLessThanOrEqual(2);
      expect(overflow.sectionOverflow, `${viewport.name} ${view} section overflow`).toBeLessThanOrEqual(2);
    }
  });
}
