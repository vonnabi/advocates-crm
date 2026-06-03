import { expect, test } from "@playwright/test";

const widths = [320, 375, 390, 430, 768, 820, 1024, 1280, 1440, 1920];

const criticalViews = [
  "dashboard",
  "cases",
  "clients",
  "tasks",
  "calendar",
  "documents",
  "mailings",
  "finance",
  "osint",
  "settings"
];

async function pageOverflow(page) {
  return page.evaluate(() => ({
    documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    bodyOverflow: document.body.scrollWidth - document.body.clientWidth
  }));
}

async function openMobileNavigation(page) {
  await page.waitForFunction(() => Boolean(document.body.dataset.view));
  await page.locator("[data-mobile-menu]").click();
  await expect.poll(() => page.evaluate(() => document.body.classList.contains("sidebar-drawer-open"))).toBeTruthy();
}

for (const width of widths) {
  test(`CRM shell is responsive at ${width}px`, async ({ page }) => {
    const isMobileNavigation = width < 1024;

    await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 });
    await page.goto("/");
    await page.waitForFunction(() => Boolean(document.body.dataset.view));

    if (isMobileNavigation) {
      await expect(page.locator("[data-mobile-menu]")).toBeVisible();

      await openMobileNavigation(page);
      await expect(page.locator("#primary-sidebar")).toBeVisible();
      await expect(page.locator("[data-sidebar-overlay]")).toBeVisible();

      await page.keyboard.press("Escape");
      await page.waitForTimeout(280);
      await expect(page.locator("[data-sidebar-overlay]")).toBeHidden();

      await openMobileNavigation(page);
      await page.locator("[data-sidebar-close]").click();
      await page.waitForTimeout(280);
      await expect(page.locator("[data-sidebar-overlay]")).toBeHidden();
    } else {
      await expect(page.locator("[data-mobile-menu]")).toBeHidden();
      await expect(page.locator("#primary-sidebar")).toBeVisible();
      const sidebarWidth = await page.locator("#primary-sidebar").evaluate((node) => node.getBoundingClientRect().width);
      expect(sidebarWidth).toBeGreaterThanOrEqual(239);
      expect(sidebarWidth).toBeLessThanOrEqual(281);
    }

    for (const view of criticalViews) {
      if (isMobileNavigation) {
        await openMobileNavigation(page);
      }
      await page.locator(`.nav-item[data-view="${view}"]`).click();
      await expect(page.locator(`#${view}`)).toHaveClass(/active/);

      if (isMobileNavigation) {
        await expect(page.locator("[data-sidebar-overlay]")).toBeHidden();
      }

      const overflow = await pageOverflow(page);
      expect(overflow.documentOverflow, `${width}px ${view} document overflow`).toBeLessThanOrEqual(2);
      expect(overflow.bodyOverflow, `${width}px ${view} body overflow`).toBeLessThanOrEqual(2);
    }
  });
}
