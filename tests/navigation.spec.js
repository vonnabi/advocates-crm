import { expect, test } from "@playwright/test";

async function waitForAppReady(page) {
  await expect(page.locator("#dashboard")).toContainText("Активних справ");
}

test("topbar back returns from case detail to the cases list", async ({ page }) => {
  await page.goto("/");
  await waitForAppReady(page);
  await page.locator('.nav-item[data-view="cases"]').click();
  await page.locator("[data-open-case]").first().click();

  await expect(page.locator("#cases")).toHaveClass(/active/);
  await expect(page.locator("#case-detail")).toContainText("Справа №");
  await expect(page.locator("#topbar-back")).toHaveClass(/visible/);
  await expect(page.locator("#topbar-back")).toHaveAttribute("aria-label", "Назад к списку справ");

  await page.locator("#topbar-back").click();

  await expect(page.locator("#cases")).toHaveClass(/active/);
  await expect(page.locator("#case-detail")).toContainText("Усього справ");
  await expect(page.locator("#topbar-back")).not.toHaveAttribute("aria-label", "Назад к списку справ");
});

test("topbar back closes the task detail panel before leaving tasks", async ({ page }) => {
  await page.goto("/");
  await waitForAppReady(page);
  await page.locator('.nav-item[data-view="tasks"]').click();
  const taskRow = page.locator("#tasks [data-task-key]").first();
  await expect(taskRow).toBeVisible();
  await taskRow.click();

  await expect(page.locator("#tasks")).toHaveClass(/active/);
  await expect(page.locator("#tasks .task-side-card:not(.empty)")).toBeVisible();
  await expect(page.locator("#topbar-back")).toHaveAttribute("aria-label", "Назад к списку задач");

  await page.locator("#topbar-back").click();

  await expect(page.locator("#tasks")).toHaveClass(/active/);
  await expect(page.locator("#tasks .task-side-card")).toHaveCount(0);
  await expect(page.locator("#topbar-back")).not.toHaveAttribute("aria-label", "Назад к списку задач");
});

for (const view of ["tasks", "planner"]) {
  test(`mobile topbar back returns from a restored ${view} screen to dashboard`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript((currentView) => {
      window.localStorage.setItem("advocates-crm-navigation", JSON.stringify({ currentView, viewHistory: [] }));
    }, view);
    await page.goto("/");

    await expect(page.locator(`#${view}`)).toHaveClass(/active/);
    await expect(page.locator("#topbar-back")).toHaveClass(/visible/);
    await expect(page.locator("#topbar-back")).toHaveAttribute("aria-label", "Назад к разделу: Дашборд");

    await page.locator("#topbar-back").click();
    await expect(page.locator("#dashboard")).toHaveClass(/active/);
  });
}

test("notifications menu navigates, closes, and clears the badge", async ({ page }) => {
  await page.goto("/");
  await waitForAppReady(page);
  await page.locator("#notifications-toggle").click();

  await expect(page.locator("#notifications-menu")).toBeVisible();
  await expect(page.locator("#notifications-toggle")).toHaveAttribute("aria-expanded", "true");

  await page.locator('[data-notification-view="tasks"]').click();

  await expect(page.locator("#tasks")).toHaveClass(/active/);
  await expect(page.locator("#notifications-menu")).toBeHidden();
  await expect(page.locator("#notifications-count")).toHaveText("4");

  await page.locator("#notifications-toggle").click();
  await page.locator("[data-clear-notifications]").click();

  await expect(page.locator("#notifications-menu")).toBeHidden();
  await expect(page.locator("#notifications-count")).toHaveText("0");
  await expect(page.locator("#notifications-count")).toHaveClass(/empty/);
});

test("sidebar collapse and restore controls keep the navigation usable", async ({ page }) => {
  await page.goto("/");
  await waitForAppReady(page);

  await page.locator(".collapse-menu").click();
  await expect(page.locator("body")).toHaveClass(/sidebar-collapsed/);
  await expect(page.locator(".sidebar-restore")).toBeVisible();

  await page.locator(".sidebar-restore").click();
  await expect(page.locator("body")).not.toHaveClass(/sidebar-collapsed/);
  await expect(page.locator('.nav-item[data-view="dashboard"]')).toBeVisible();
});

test("profile menu actions can open settings and collapse the sidebar", async ({ page }) => {
  await page.goto("/");
  await waitForAppReady(page);
  await page.locator("#admin-profile-toggle").click();

  await expect(page.locator("#admin-profile-menu")).toBeVisible();
  await page.locator('[data-profile-action="settings"]').click();
  await expect(page.locator("#settings")).toHaveClass(/active/);

  await page.locator("#admin-profile-toggle").click();
  await page.locator('[data-profile-action="compact"]').click();
  await expect(page.locator("body")).toHaveClass(/sidebar-collapsed/);
});

test("mobile profile demo buttons stay inside the dropdown", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await waitForAppReady(page);
  await page.locator("#admin-profile-toggle").click();

  await expect(page.locator("#admin-profile-menu")).toBeVisible();
  const buttonsFit = await page.locator(".demo-share-box").evaluate((box) => {
    const boxRect = box.getBoundingClientRect();
    return [...box.querySelectorAll("button")].every((button) => {
      const rect = button.getBoundingClientRect();
      return rect.left >= boxRect.left - 1 && rect.right <= boxRect.right + 1;
    });
  });

  expect(buttonsFit).toBe(true);
});

test("profile logout opens a visible demo session screen", async ({ page }) => {
  await page.goto("/");
  await waitForAppReady(page);
  await page.locator("#admin-profile-toggle").click();
  await page.locator('[data-profile-action="logout"]').click();

  await expect(page.locator("#logout-overlay")).toBeVisible();
  await expect(page.locator("#logout-overlay")).toContainText("Сеанс завершено");

  await page.locator("[data-login-return]").click();
  await expect(page.locator("#logout-overlay")).toBeHidden();
});
