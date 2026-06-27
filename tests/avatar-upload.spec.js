import { expect, test } from "@playwright/test";

// The user card has an "upload photo from computer" button next to the avatar field.
// Picking a file should resize it and drop a data: image URL into the photo input,
// which then renders as a real <img> avatar (see renderUserAvatar).
async function openApp(page) {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.localStorage.removeItem("crmApiMode");
  });
  await page.goto("/");
  await expect(page.locator(".nav-item[data-view='dashboard']")).toBeVisible();
  await expect(page.locator("#dashboard")).toHaveClass(/active/);
}

test("user card: upload photo fills the avatar field with a data image", async ({ page }) => {
  await openApp(page);

  await page.locator('.nav-item[data-view="settings"]').click();
  await expect(page.locator('[data-settings-focus="users"] strong')).toBeVisible({ timeout: 10000 });
  await page.locator('[data-settings-focus="users"]').click();
  await page.locator('[data-settings-action="invite"]').click();

  const dialog = page.locator("#settings-invite-dialog");
  await expect(dialog).toHaveJSProperty("open", true);
  const upload = dialog.locator("[data-user-photo-upload]");
  await expect(upload).toHaveCount(1);

  // A tiny valid PNG; the handler resizes it to a JPEG thumbnail data URL.
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "base64"
  );
  await upload.setInputFiles({ name: "avatar.png", mimeType: "image/png", buffer: png });

  await expect(dialog.locator('input[name="photo"]')).toHaveValue(/^data:image\//, { timeout: 5000 });
});
