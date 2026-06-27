import { expect, test } from "@playwright/test";

// Verifies the "демо"/"демо" login entry point:
//   - on :8001 the app boots in API mode (port 8001 → same-origin API);
//   - logging in as демо/демо flips it to the bundled static demo (apiBaseUrl → "");
//   - logging out of the demo clears the flag and returns to API mode.
test.describe.configure({ mode: "serial" });

const apiBase = (page, bust) =>
  page.evaluate((b) => import(`/js/api.js?${b}`).then((m) => m.apiBaseUrl()), bust);

async function bootReady(page) {
  await expect(page.locator(".nav-item[data-view='dashboard']")).toBeVisible();
  await expect(page.locator("#dashboard")).toHaveClass(/active/);
}

test("демо/демо flips to static demo mode, logout returns to API mode", async ({ page }) => {
  await page.goto("/");
  await bootReady(page);

  // No flag on :8001 → API mode (origin).
  expect(await apiBase(page, "before")).toBe("http://127.0.0.1:8001");

  // Open profile menu → logout → login overlay; the field is now a plain text "Логін".
  await page.click("#admin-profile-toggle");
  await page.click('[data-profile-action="logout"]');
  await expect(page.locator("[data-login-form]")).toBeVisible();
  expect(await page.getAttribute('[data-login-form] input[name="email"]', "type")).toBe("text");

  // Enter демо / демо and submit → handler sets the flag and reloads.
  await page.fill('[data-login-form] input[name="email"]', "демо");
  await page.fill('[data-login-form] input[name="password"]', "демо");
  await page.click('[data-login-form] button[type="submit"]');
  await page.waitForFunction(() => localStorage.getItem("crmApiMode") === "static");

  // After reload: still on :8001, but the static flag wins → demo data, no DB writes.
  await bootReady(page);
  expect(await page.evaluate(() => localStorage.getItem("crmApiMode"))).toBe("static");
  expect(await apiBase(page, "after-demo")).toBe("");

  // Logout of the demo → flag cleared, back to API mode.
  await page.click("#admin-profile-toggle");
  await page.click('[data-profile-action="logout"]');
  await page.waitForFunction(() => localStorage.getItem("crmApiMode") === null);
  await bootReady(page);
  expect(await apiBase(page, "after-exit")).toBe("http://127.0.0.1:8001");
});
