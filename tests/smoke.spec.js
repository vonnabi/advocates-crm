import { expect, test } from "@playwright/test";

const views = [
  ["cases", "Усього справ"],
  ["clients", "Клієнти (124)"],
  ["calendar", "Найближчі події"],
  ["tasks", "Всі задачі"],
  ["documents", "Документи"],
  ["mailings", "Получатели"],
  ["planner", "План на завтра"],
  ["finance", "Фінанси по справах"],
  ["analytics", "Справи за типами"],
  ["ai", "Помічники по галузях права"],
  ["osint", "OSINT перевірки"],
  ["settings", "Профіль бюро"]
];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.localStorage.setItem("crmApiMode", "static");
  });
});

async function openApp(page) {
  await page.goto("/");
  await expect(page.locator("#dashboard")).toContainText("Активних справ");
}

test("main menu screens render content", async ({ page }) => {
  await openApp(page);
  for (const [view, expectedText] of views) {
    await page.locator(`.nav-item[data-view="${view}"]`).click();
    await expect(page.locator(`#${view}`)).toHaveClass(/active/);
    await expect(page.locator(`#${view}`)).toContainText(expectedText);
    const textLength = await page.locator(`#${view}`).evaluate((node) => node.textContent.trim().length);
    expect(textLength, `${view} should not be empty`).toBeGreaterThan(20);
  }
});

test("primary create dialogs open", async ({ page }) => {
  await openApp(page);

  await page.locator('.nav-item[data-view="clients"]').click();
  await expect(page.locator("#add-client")).toBeVisible();
  await page.locator("#add-client").click();
  await expect(page.locator("#client-dialog")).toHaveJSProperty("open", true);
  await page.keyboard.press("Escape");

  await page.locator('.nav-item[data-view="cases"]').click();
  await expect(page.locator("#create-case-from-list")).toBeVisible();
  await page.locator("#create-case-from-list").click();
  await expect(page.locator("#case-dialog")).toHaveJSProperty("open", true);
  await page.keyboard.press("Escape");

  await page.locator('.nav-item[data-view="planner"]').click();
  await expect(page.locator("#add-plan-task")).toBeVisible();
  await page.locator("#add-plan-task").click();
  await expect(page.locator("#task-dialog")).toHaveJSProperty("open", true);
});

test("global documents screen exposes document actions", async ({ page }) => {
  await openApp(page);

  await page.locator('.nav-item[data-view="documents"]').click();
  await expect(page.locator("#documents")).toHaveClass(/active/);
  await expect(page.locator("#documents [data-document-row]").first()).toBeVisible();
  await expect(page.locator(".documents-esign-overview")).toContainText("Електронний підпис");
  await expect(page.locator(".documents-kpi-grid")).toContainText("Електронний підпис");

  await page.locator("#documents [data-document-row]").first().click();
  const documentMenu = page.locator("#documents .documents-row-actions .row-action-menu-wrap").first();
  await documentMenu.locator("[data-action-menu-trigger]").click();
  await expect(page.locator(".row-action-menu:not([hidden])")).toContainText(/е-підпис|підпис/i);
  await expect(page.locator(".row-action-menu:not([hidden])")).toContainText("Копіювати документ");
  await expect(page.locator(".row-action-menu:not([hidden])")).toContainText("Відправити");
  await expect(page.locator(".row-action-menu:not([hidden])")).toContainText("Експорт");
  await expect(page.locator(".row-action-menu:not([hidden])")).toContainText("ONLYOFFICE");
  await page.locator(".row-action-menu:not([hidden]) [data-esign-global-document]").click();
  await expect(page.locator(".documents-esign-card")).toContainText("Очікує е-підпис");
  await page.locator("#documents .documents-side [data-office-global-document]").click();
  await expect(page.locator("#office-editor-dialog")).toHaveJSProperty("open", true);
  await expect(page.locator("#office-editor-dialog")).toContainText("ONLYOFFICE");
  await page.locator("#office-editor-close").click();
  await documentMenu.locator("[data-action-menu-trigger]").click();
  await page.locator(".row-action-menu:not([hidden]) [data-edit-global-document]").click();
  await expect(page.locator("#document-dialog")).toHaveJSProperty("open", true);
  await expect(page.locator("#document-form textarea[name='content']")).toBeVisible();
  await page.locator("[data-document-fill-draft]").click();
  await expect(page.locator("#document-form textarea[name='content']")).toHaveValue(/Справа/);
  await page.locator("#document-dialog-close").click();

  await page.locator("#documents [data-documents-add]").click();
  await expect(page.locator("#document-dialog")).toHaveJSProperty("open", true);
});

test("documents archive groups cases under clients", async ({ page }) => {
  await openApp(page);

  await page.locator('.nav-item[data-view="documents"]').click();
  await expect(page.locator("#documents")).toHaveClass(/active/);

  const clientNode = page.locator("#documents [data-document-client-node]").filter({ hasText: "Андрієнко Тест Документів" });
  await expect(clientNode).toBeVisible();
  await clientNode.click();
  await expect(clientNode).toHaveClass(/active/);
  await expect(page.locator(".documents-folder-head")).toContainText("Андрієнко Тест Документів");
  await expect(page.locator(".documents-folder-head")).toContainText("Клієнт");
  const caseNode = page.locator("#documents [data-document-case-node]").filter({ hasText: "0001" });
  await expect(caseNode).toBeVisible();

  await caseNode.click();
  await expect(page.locator(".documents-folder-head")).toContainText("Усі документи справи");
  await expect(page.locator(".documents-folder-head")).toContainText(/№20\d{2}\/0001/);
  await expect(page.locator("#documents [data-document-row]").first()).toContainText(/№20\d{2}\/0001/);
  await expect(page.locator("#documents .documents-tree-case.open [data-document-folder-node]").filter({ hasText: "Клопотання" })).toBeVisible();
});

test("document creation uses selected existing case folder", async ({ page }) => {
  await openApp(page);

  await page.locator('.nav-item[data-view="documents"]').click();
  await expect(page.locator("#documents")).toHaveClass(/active/);

  await page.locator("#documents [data-document-client-node]").filter({ hasText: "Андрієнко Тест Документів" }).click();
  await page.locator("#documents [data-document-case-node]").filter({ hasText: "0001" }).click();
  await page.locator("#documents .documents-tree-case.open [data-document-folder-node]").filter({ hasText: "Клопотання" }).click();
  await expect(page.locator(".documents-folder-head")).toContainText("Клопотання");

  await page.locator("#documents [data-documents-add-current]").click();
  await expect(page.locator("#document-dialog")).toHaveJSProperty("open", true);
  await expect(page.locator("#document-folder")).toHaveValue("1");
  await expect(page.locator('#document-form input[name="newFolderName"]')).toBeEnabled();
  await page.locator('#document-form select[name="type"]').selectOption("Клопотання", { force: true });
  await page.locator('#document-form input[name="name"]').fill("Документ у клопотання.docx");
  await page.locator("#document-submit-button").click();
  await expect(page.locator("#office-editor-dialog")).toHaveJSProperty("open", true);
  await page.locator("#office-editor-close").click();

  await expect(page.locator(".documents-folder-head")).toContainText("Клопотання");
  await expect(page.locator("#documents")).toContainText("Документ у клопотання.docx");
  await expect(page.locator("#documents .documents-tree-case.open [data-document-folder-node]").filter({ hasText: "Нова папка" })).toHaveCount(0);
});

test("document creation sorts standard folders by document type", async ({ page }) => {
  await openApp(page);

  await page.locator('.nav-item[data-view="documents"]').click();
  await expect(page.locator("#documents")).toHaveClass(/active/);
  await page.locator("#documents [data-document-client-node]").filter({ hasText: "Андрієнко Тест Документів" }).click();
  await page.locator("#documents [data-document-case-node]").filter({ hasText: "0001" }).click();
  await page.locator("#documents .documents-tree-case.open [data-document-folder-node]").filter({ hasText: "Інші документи" }).click();
  await expect(page.locator(".documents-folder-head")).toContainText("Інші документи");

  await page.locator("#documents [data-documents-add-current]").click();
  await expect(page.locator("#document-dialog")).toHaveJSProperty("open", true);
  await expect(page.locator("#document-folder")).toHaveValue("4");
  await page.locator('#document-form select[name="type"]').selectOption("Позов", { force: true });
  await page.locator('#document-form input[name="name"]').fill("Авто позов з іншої папки.docx");
  await page.locator("#document-submit-button").click();
  await expect(page.locator("#office-editor-dialog")).toHaveJSProperty("open", true);
  await page.locator("#office-editor-close").click();

  await expect(page.locator(".documents-folder-head")).toContainText("Позови");
  await expect(page.locator("#documents")).toContainText("Авто позов з іншої папки.docx");
  await page.locator("#documents .documents-tree-case.open [data-document-folder-node]").filter({ hasText: "Інші документи" }).click();
  await expect(page.locator(".documents-table")).not.toContainText("Авто позов з іншої папки.docx");
});

test("document dialog can create a subfolder under selected case folder", async ({ page }) => {
  await openApp(page);

  await page.locator('.nav-item[data-view="documents"]').click();
  await expect(page.locator("#documents")).toHaveClass(/active/);
  await page.locator("#documents [data-document-client-node]").filter({ hasText: "Андрієнко Тест Документів" }).click();
  await page.locator("#documents [data-document-case-node]").filter({ hasText: "0001" }).click();
  await page.locator("#documents .documents-tree-case.open [data-document-folder-node]").filter({ hasText: "Позови" }).first().click();

  await page.locator("#documents [data-documents-add-current]").click();
  await expect(page.locator("#document-dialog")).toHaveJSProperty("open", true);
  await expect(page.locator("#document-folder")).toHaveValue("0");
  await expect(page.locator('#document-form input[name="newFolderName"]')).toBeEnabled();
  await page.locator('#document-form input[name="newFolderName"]').fill("Апеляція");
  await page.locator('#document-form input[name="name"]').fill("Апеляційний позов.docx");
  await page.locator("#document-submit-button").click();
  await expect(page.locator("#office-editor-dialog")).toHaveJSProperty("open", true);
  await page.locator("#office-editor-close").click();

  const subfolder = page.locator("#documents .documents-tree-case.open [data-document-folder-node]").filter({ hasText: "Апеляція" });
  await expect(subfolder).toBeVisible();
  await subfolder.click();
  await expect(page.locator(".documents-folder-head")).toContainText("Апеляція");
  await expect(page.locator(".documents-table")).toContainText("Апеляційний позов.docx");
});

test("document rows show inferred type labels inside standard folders", async ({ page }) => {
  await openApp(page);

  await page.locator('.nav-item[data-view="documents"]').click();
  await expect(page.locator("#documents")).toHaveClass(/active/);
  await page.locator("#documents [data-document-client-node]").filter({ hasText: "Андрієнко Тест Документів" }).click();
  await page.locator("#documents [data-document-case-node]").filter({ hasText: "0001" }).click();
  await page.locator("#documents .documents-tree-case.open [data-document-folder-node]").filter({ hasText: "Запити" }).click();

  const requestRow = page.locator("#documents [data-document-row]").filter({ hasText: "Запит документів до ТЦК" }).first();
  await expect(requestRow).toBeVisible();
  await expect(requestRow.locator(".document-title-button small")).toHaveText("Запит");
  await expect(page.locator(".documents-side .documents-meta")).toContainText("Запит");
});

test("document edit can move a document to another case folder", async ({ page }) => {
  await openApp(page);

  await page.locator('.nav-item[data-view="documents"]').click();
  await expect(page.locator("#documents")).toHaveClass(/active/);
  await page.locator("#documents [data-document-client-node]").filter({ hasText: "Андрієнко Тест Документів" }).click();
  await page.locator("#documents [data-document-case-node]").filter({ hasText: "0001" }).click();
  await page.locator("#documents .documents-tree-case.open [data-document-folder-node]").filter({ hasText: "Інші документи" }).click();

  const row = page.locator("#documents [data-document-row]").filter({ hasText: "Паспорт клієнта.pdf" }).first();
  await expect(row).toBeVisible();
  await row.locator("[data-action-menu-trigger]").click();
  await page.locator(".row-action-menu:not([hidden]) [data-edit-global-document]").click();

  await expect(page.locator("#document-dialog")).toHaveJSProperty("open", true);
  await expect(page.locator("[data-document-target-mode]")).toBeVisible();
  await expect(page.locator("[data-document-destination]")).toBeVisible();
  await page.locator('#document-form select[name="type"]').selectOption("Клопотання", { force: true });
  await page.locator("#document-folder").selectOption("1", { force: true });
  await page.locator("#document-submit-button").click();

  await expect(page.locator("#document-dialog")).toHaveJSProperty("open", false);
  await expect(page.locator(".documents-folder-head")).toContainText("Клопотання");
  await expect(page.locator(".documents-table")).toContainText("Паспорт клієнта.pdf");
  await page.locator("#documents .documents-tree-case.open [data-document-folder-node]").filter({ hasText: "Інші документи" }).click();
  await expect(page.locator(".documents-table")).not.toContainText("Паспорт клієнта.pdf");
});

test("document menu can copy a document and open the copy for editing", async ({ page }) => {
  await openApp(page);

  await page.locator('.nav-item[data-view="documents"]').click();
  await expect(page.locator("#documents")).toHaveClass(/active/);
  const row = page.locator("#documents [data-document-row]").filter({ hasText: "Запит документів до ТЦК" }).first();
  await expect(row).toBeVisible();
  await row.locator("[data-action-menu-trigger]").click();
  await page.locator(".row-action-menu:not([hidden]) [data-copy-global-document]").click();

  await expect(page.locator("#document-dialog")).toHaveJSProperty("open", true);
  await expect(page.locator('#document-form input[name="name"]')).toHaveValue(/копія/);
  await page.locator("#document-dialog-close").click();
  await expect(page.locator("#documents")).toContainText("Запит документів до ТЦК - копія.docx");
});

test("document menu can open send dialog and prepare Telegram send", async ({ page }) => {
  await openApp(page);

  await page.locator('.nav-item[data-view="documents"]').click();
  await expect(page.locator("#documents")).toHaveClass(/active/);
  const row = page.locator("#documents [data-document-row]").filter({ hasText: "Запит документів до ТЦК" }).first();
  await expect(row).toBeVisible();
  await row.locator("[data-action-menu-trigger]").click();
  await page.locator(".row-action-menu:not([hidden]) [data-send-global-document]").click();

  await expect(page.locator("#document-send-dialog")).toHaveJSProperty("open", true);
  await expect(page.locator("#document-send-dialog")).toContainText("Відправити документ");
  await expect(page.locator('#document-send-form select[name="channel"]')).toHaveValue("Telegram");
  await expect(page.locator("#document-send-recipient-preview")).toContainText("@test_documents");
  await page.locator('#document-send-form select[name="recipientMode"]').selectOption("manual");
  await page.locator('#document-send-form input[name="manualRecipient"]').fill("@manual_client");
  await page.locator("#document-send-submit").click();
  await expect(page.locator("#document-send-dialog")).toHaveJSProperty("open", false);
  await page.locator('.nav-item[data-view="mailings"]').click();
  await page.locator('[data-mailing-main-tab="campaigns"]').click();
  await expect(page.locator("#mailings")).toContainText("Документ: Запит документів до ТЦК");
});

test("document dialog cancel, escape, and enter shortcuts work", async ({ page }) => {
  await openApp(page);
  await page.locator('.nav-item[data-view="documents"]').click();
  await expect(page.locator("#documents")).toHaveClass(/active/);

  await page.locator("#documents [data-documents-add]").click();
  await expect(page.locator("#document-dialog")).toHaveJSProperty("open", true);
  await page.locator("#document-cancel-button").click();
  await expect(page.locator("#document-dialog")).toHaveJSProperty("open", false);

  await page.locator("#documents [data-documents-add]").click();
  await expect(page.locator("#document-dialog")).toHaveJSProperty("open", true);
  await page.keyboard.press("Escape");
  await expect(page.locator("#document-dialog")).toHaveJSProperty("open", false);

  await page.locator("#documents [data-documents-add]").click();
  await expect(page.locator("#document-dialog")).toHaveJSProperty("open", true);
  await page.locator('#document-form input[name="name"]').fill("Enter створює документ.docx");
  await page.keyboard.press("Enter");
  await expect(page.locator("#document-dialog")).toHaveJSProperty("open", false);
  await expect(page.locator("#office-editor-dialog")).toHaveJSProperty("open", true);
  await page.locator("#office-editor-close").click();
  await expect(page.locator("#documents")).toContainText("Enter створює документ.docx");
});

test("archive folder dialog enter and escape shortcuts work", async ({ page }) => {
  await openApp(page);
  await page.locator('.nav-item[data-view="documents"]').click();
  await expect(page.locator("#documents")).toHaveClass(/active/);

  await page.locator("[data-archive-folder-add-root]").click();
  await expect(page.locator("#document-archive-folder-dialog")).toHaveJSProperty("open", true);
  await page.locator('#document-archive-folder-form input[name="name"]').fill("Enter архівна папка");
  await page.keyboard.press("Enter");
  await expect(page.locator("#document-archive-folder-dialog")).toHaveJSProperty("open", false);
  await expect(page.locator(".documents-storage-archive")).toContainText("Enter архівна папка");

  await page.locator("[data-archive-folder-add-root]").click();
  await expect(page.locator("#document-archive-folder-dialog")).toHaveJSProperty("open", true);
  await page.locator('#document-archive-folder-form input[name="name"]').fill("Escape архівна папка");
  await page.keyboard.press("Escape");
  await expect(page.locator("#document-archive-folder-dialog")).toHaveJSProperty("open", false);
  await expect(page.locator(".documents-storage-archive")).not.toContainText("Escape архівна папка");
});

test("new archive document selects storage folder and opens ONLYOFFICE state", async ({ page }) => {
  const documentName = "Автотестовий архівний документ.docx";

  await openApp(page);
  await page.locator('.nav-item[data-view="documents"]').click();
  await expect(page.locator("#documents")).toHaveClass(/active/);

  await page.locator("#documents [data-documents-add]").click();
  await expect(page.locator("#document-dialog")).toHaveJSProperty("open", true);
  await page.locator('#document-form .document-target-mode label').filter({ hasText: "В архів" }).click();
  await expect(page.locator("[data-document-archive-destination]")).toBeVisible();

  const storageFolder = page.locator('[data-document-archive-picker="document-form"] [data-document-archive-pick]').filter({ hasText: "На зберіганні" });
  await storageFolder.click();
  await expect(storageFolder).toHaveClass(/active/);

  await page.locator('#document-form input[name="name"]').fill(documentName);
  await page.locator("#document-submit-button").click();

  await expect(page.locator("#office-editor-dialog")).toHaveJSProperty("open", true);
  await expect(page.locator("#office-editor-dialog")).toContainText("Потрібен URL файлу");
  await page.locator("#office-editor-close").click();

  await expect(page.locator("#documents")).toHaveClass(/active/);
  await expect(page.locator(".documents-storage-folder-row.active")).toContainText("На зберіганні");
  await expect(page.locator(".documents-folder-head")).toContainText("На зберіганні");
  await expect(page.locator(".documents-folder-head")).toContainText("Папка самостійного архіву");
  await expect(page.locator("#documents")).toContainText(documentName);

  await page.locator(".documents-archive").first().locator("[data-document-all-node]").click();
  await expect(page.locator(".documents-folder-head")).toContainText("Усі документи");
  await expect(page.locator(".documents-folder-head")).toContainText("Архів по всіх справах");
});

test("case procedural action edit opens dialog", async ({ page }) => {
  await openApp(page);
  const demoCaseId = `${new Date().getFullYear()}/12345`;

  await page.locator('.nav-item[data-view="cases"]').click();
  await page.locator(`[data-open-case="${demoCaseId}"]`).first().click();
  await expect(page.locator("#case-detail")).toContainText("5. ПРОЦЕСУАЛЬНІ ДІЇ");

  await page.locator(".procedural-actions-table [data-action-menu-trigger]").nth(1).click();
  await page.locator('.row-action-menu:not([hidden]) [data-edit-procedural-action="1"]').click();
  await expect(page.locator("#event-dialog")).toHaveJSProperty("open", true);
  await expect(page.locator('#event-dialog input[name="title"]')).toHaveValue("Клопотання про забезпечення позову");
});
