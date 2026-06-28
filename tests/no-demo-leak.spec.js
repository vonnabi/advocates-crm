import { expect, test } from "@playwright/test";

// Regression: in API mode the bundled demo settings ("Advocates Bureau") must never leak
// into the brand/profile, even if the bootstrap is unavailable (slow network, expired
// session). The app should fall back to neutral, not to demo data.
test("bundled demo bureau does not leak when the bootstrap fails (API mode)", async ({ page }) => {
  await page.route("**/api/bootstrap/**", (route) => route.fulfill({ status: 500, contentType: "application/json", body: "{}" }));
  await page.goto("/");
  await page.waitForTimeout(1500);
  // The visible sidebar brand must be neutral, not the bundled "Advocates Bureau" demo.
  const brand = (await page.locator("[data-brand-name]").textContent().catch(() => "")) || "";
  const logo = (await page.locator("[data-brand-logo]").textContent().catch(() => "")) || "";
  expect(brand).not.toContain("Advocates");
  expect(logo).not.toContain("Advocates");
  expect(brand.trim()).toBeTruthy();
});
