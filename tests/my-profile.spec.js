import { expect, test } from "@playwright/test";

// "Мій профіль" — every logged-in user edits their OWN photo / name / email / phone from
// the top-right profile menu (bureau-profile-style card with photo upload on the left).
async function openApp(page) {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.localStorage.removeItem("crmApiMode");
  });
  await page.goto("/");
  await expect(page.locator(".nav-item[data-view='dashboard']")).toBeVisible();
  await expect(page.locator("#dashboard")).toHaveClass(/active/);
}

test("my profile dialog uploads a photo and saves the user's own data", async ({ page }) => {
  await openApp(page);

  await page.locator("#admin-profile-toggle").click();
  await page.locator('[data-profile-action="settings"]').click();

  const dialog = page.locator("#my-profile-dialog");
  await expect(dialog).toHaveJSProperty("open", true);
  await expect(dialog.locator('input[name="name"]')).toBeVisible();
  await expect(dialog.locator('input[name="phone"]')).toBeVisible();
  await expect(dialog.locator("[data-my-profile-upload]")).toHaveCount(1);

  // Upload a photo → the hidden photo field becomes a data: image URL.
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "base64"
  );
  await dialog.locator("[data-my-profile-upload]").setInputFiles({ name: "me.png", mimeType: "image/png", buffer: png });
  await expect(dialog.locator('input[name="photo"]')).toHaveValue(/^data:image\//, { timeout: 5000 });

  await dialog.locator('input[name="name"]').fill("Новий Я");
  await dialog.locator('input[name="phone"]').fill("+380671234567");
  await dialog.locator('#my-profile-form button[type="submit"]').click();

  await expect(dialog).toHaveJSProperty("open", false);
  // The topbar reflects the saved name + photo (rendered as an <img>).
  await expect(page.locator("#admin-profile-toggle > div:nth-of-type(2) strong")).toHaveText("Новий Я");
  await expect(page.locator("#admin-profile-toggle .admin-photo img")).toHaveCount(1);
});
