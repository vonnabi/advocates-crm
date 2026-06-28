import { expect, test } from "@playwright/test";

// A limited role's menu must not flash the full list on reload: the inline script in
// index.html hides the cached restricted items before the app boots.
test("cached restricted menu items are hidden immediately on reload", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#dashboard")).toHaveClass(/active/);
  await page.evaluate(() => localStorage.setItem("crmHiddenViews", JSON.stringify(["finance", "settings", "osint"])));
  // Block the app boot so we verify the inline hydration alone hides the items.
  await page.route("**/app.js**", (route) => route.fulfill({ status: 200, contentType: "application/javascript", body: "" }));
  await page.reload();
  await expect(page.locator('.nav-item[data-view="finance"]')).toBeHidden();
  await expect(page.locator('.nav-item[data-view="settings"]')).toBeHidden();
  await expect(page.locator('.nav-item[data-view="osint"]')).toBeHidden();
  await expect(page.locator('.nav-item[data-view="dashboard"]')).toBeVisible();
});
