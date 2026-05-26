import { expect, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

const views = [
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

const emptyApiPayload = {
  session: {
    authenticated: false,
    user: { id: 1, name: "Admin", email: "admin@advocates.crm", role: "Адміністратор", access: "Повний доступ", photo: "A", active: true },
    permissions: { canManageUsers: true, canSeeFinance: true, canManageCases: true }
  },
  currentUser: { id: 1, name: "Admin", email: "admin@advocates.crm", role: "Адміністратор", access: "Повний доступ", photo: "A", active: true },
  settingsUsers: [{ id: 1, name: "Admin", email: "admin@advocates.crm", role: "Адміністратор", access: "Повний доступ", photo: "A", active: true }],
  clients: [],
  cases: [],
  tasks: [],
  events: [],
  financeOperations: [],
  finance: { income: 0, paid: 0, debt: 0, activeCases: 0, documents: 0, tasks: 0 },
  meta: {
    clients: 0,
    cases: 0,
    tasks: 0,
    events: 0,
    demoData: {
      enabled: false,
      total: 0,
      counts: { clients: 0, cases: 0, tasks: 0, documents: 0, events: 0, financeOperations: 0, communications: 0, campaigns: 0 }
    }
  }
};

function stamp() {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

async function openApp(page) {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.localStorage.removeItem("crmApiMode");
  });
  await page.goto("/");
  await expect(page.locator(".nav-item[data-view='dashboard']")).toBeVisible();
  await expect(page.locator("#dashboard")).toHaveClass(/active/);
}

async function apiJson(response, label) {
  const text = await response.text();
  expect(response.ok(), `${label}: ${response.status()} ${text}`).toBeTruthy();
  return text ? JSON.parse(text) : {};
}

async function apiPost(request, path, data) {
  return apiJson(await request.post(path, { data }), `POST ${path}`);
}

async function apiDelete(request, path) {
  const response = await request.delete(path);
  if (response.status() === 404) return {};
  return apiJson(response, `DELETE ${path}`);
}

async function createGoldenMatter(request, label = stamp()) {
  const client = await apiPost(request, "/api/clients/", {
    name: `Golden Client ${label}`,
    phone: "+380 50 100 20 30",
    email: `golden-${label}@example.com`,
    telegramUsername: `@golden_${label.replaceAll("-", "_")}`,
    request: "Golden smoke: перевірка створення живого клієнта.",
    status: "Активний",
    source: "Автотест",
    manager: "Іваненко А.Ю."
  });
  const matter = await apiPost(request, "/api/cases/", {
    clientId: client.id,
    title: `Golden Case ${label}`,
    type: "Цивільна",
    stage: "Підготовка документів",
    status: "В роботі",
    priority: "Середній",
    responsible: "Іваненко А.Ю.",
    deadline: "2026-06-15",
    description: "Golden smoke: справа для перевірки основного сценарію."
  });
  return { client, matter };
}

async function cleanupGoldenMatter(request, created) {
  const operationIds = new Set(created.operationIds || []);
  const documentIds = new Set(created.documentIds || []);
  if (created.matter?.id) {
    const bootstrap = await apiJson(await request.get("/api/bootstrap/"), "GET /api/bootstrap/");
    bootstrap.financeOperations
      .filter((item) => item.caseId === created.matter.id)
      .forEach((item) => operationIds.add(item.id));
    const persistedCase = bootstrap.cases.find((item) => item.id === created.matter.id);
    (persistedCase?.documents || []).forEach((item) => documentIds.add(item.id));
  }
  for (const operationId of operationIds) {
    await apiDelete(request, `/api/finance/operations/${operationId}/`);
  }
  for (const documentId of documentIds) {
    await apiDelete(request, `/api/documents/${documentId}/`);
  }
  for (const taskId of created.taskIds || []) {
    await apiDelete(request, `/api/tasks/${taskId}/`);
  }
  for (const eventId of created.eventIds || []) {
    await apiDelete(request, `/api/calendar/events/${eventId}/`);
  }
  if (created.matter?.id) {
    await apiDelete(request, `/api/cases/${encodeURIComponent(created.matter.id)}/`);
  }
  if (created.client?.id) {
    await apiDelete(request, `/api/clients/${created.client.id}/`);
  }
}

test("current CRM menu screens render in API mode", async ({ page }) => {
  await openApp(page);

  for (const view of views) {
    await page.locator(`.nav-item[data-view="${view}"]`).click();
    await expect(page.locator(`#${view}`), `${view} should become active`).toHaveClass(/active/);
    const textLength = await page.locator(`#${view}`).evaluate((node) => node.textContent.trim().length);
    expect(textLength, `${view} should render real content`).toBeGreaterThan(20);
  }
});

test("empty API mode does not show demo charts or static counts", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.localStorage.setItem("crmApiBase", window.location.origin);
  });
  await page.route("**/api/bootstrap/", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(emptyApiPayload) });
  });
  await page.route("**/api/demo-data/", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(emptyApiPayload.meta.demoData) });
  });

  await page.goto("/");
  await expect(page.locator(".dashboard-kpi-grid")).toContainText("Без даних");
  await expect(page.locator("#dashboard")).not.toContainText("демо-справ");
  await expect(page.locator("#dashboard")).not.toContainText("демо-CRM");

  await page.locator('.nav-item[data-view="finance"]').click();

  await expect(page.locator(".finance-kpi-grid")).toContainText("Без даних");
  await expect(page.locator(".finance-status-card")).not.toContainText("540 200");
  await expect(page.locator(".finance-line-chart")).toHaveCount(0);
  await expect(page.locator(".finance-cashflow-chart")).toHaveCount(0);
  await expect(page.locator("#finance")).toContainText("Фінансової динаміки ще немає");
  await expect(page.locator("#finance")).toContainText("Прогноз ще не сформовано");
  await expect(page.locator("#finance")).not.toContainText("800k");
  await expect(page.locator("#finance")).not.toContainText("304 800");

  await page.locator('.nav-item[data-view="analytics"]').click();
  await expect(page.locator(".analytics-kpi-card strong")).toHaveText(["0", "0", "0", "0", "0 днів", "0%"]);
  await expect(page.locator(".analytics-line-chart")).toHaveCount(0);
  await expect(page.locator(".analytics-column-chart")).toHaveCount(0);
  await expect(page.locator("#analytics")).toContainText("Динаміки справ ще немає");
  await expect(page.locator("#analytics")).toContainText("Фінансової аналітики ще немає");

  await page.locator('.nav-item[data-view="mailings"]').click();
  await expect(page.locator(".coverage-row")).toContainText("Клиенты0");
  await expect(page.locator(".forecast-card")).toContainText("Всего получателей0");
  await expect(page.locator(".forecast-card")).toContainText("0 сообщений");
  await expect(page.locator(".forecast-card")).not.toContainText("744");
  await expect(page.locator("#mailings")).not.toContainText("1245");
});

test("golden workflow creates and persists client, case, task, event, document and finance", async ({ page, request }) => {
  const created = { operationIds: [], documentIds: [], taskIds: [], eventIds: [] };
  const label = stamp();

  try {
    Object.assign(created, await createGoldenMatter(request, label));

    const task = await apiPost(request, "/api/tasks/", {
      caseId: created.matter.id,
      clientId: created.client.id,
      title: `Golden Task ${label}`,
      status: "Нова",
      priority: "Середній",
      responsible: "Іваненко А.Ю.",
      due: "2026-06-10 09:00",
      description: "Golden smoke: задача по справі."
    });
    created.taskIds.push(task.id);

    const event = await apiPost(request, "/api/calendar/events/", {
      title: `Golden Event ${label}`,
      type: "Судове засідання",
      date: "2026-06-11",
      time: "10:00",
      endTime: "11:00",
      clientId: created.client.id,
      caseId: created.matter.id,
      authority: "Golden court",
      location: "Київ",
      responsible: "Іваненко А.Ю.",
      status: "Заплановано",
      reminderEnabled: false
    });
    created.eventIds.push(event.id);

    const document = await apiPost(request, "/api/documents/", {
      caseId: created.matter.id,
      name: `Golden Document ${label}.docx`,
      type: "Запит",
      folder: "Запити",
      status: "Чернетка",
      submitted: "2026-06-01",
      responseDue: "2026-06-08",
      responsible: "Іваненко А.Ю.",
      comment: "Golden smoke: документ має зберегтися після оновлення."
    });
    created.documentIds.push(document.id);

    const invoice = await apiPost(request, "/api/finance/operations/", {
      caseId: created.matter.id,
      action: "invoice",
      title: `Golden Invoice ${label}`,
      amount: 2500,
      date: "2026-06-01",
      status: "Очікується",
      method: "Документ",
      documentNumber: `INV-GOLDEN-${label}`,
      documentDue: "2026-06-08",
      documentTemplate: "Основний шаблон",
      comment: "Golden smoke: рахунок має створити документ."
    });
    created.operationIds.push(invoice.operation.id);

    const payment = await apiPost(request, "/api/finance/operations/", {
      caseId: created.matter.id,
      action: "income",
      title: `Golden Payment ${label}`,
      amount: 1000,
      date: "2026-06-02",
      status: "Оплачено",
      method: "Банківський переказ",
      comment: "Golden smoke: платіж має потрапити у фінанси."
    });
    created.operationIds.push(payment.operation.id);

    const bootstrap = await apiJson(await request.get("/api/bootstrap/"), "GET /api/bootstrap/");
    const persistedCase = bootstrap.cases.find((item) => item.id === created.matter.id);
    expect(persistedCase, "created case should persist in bootstrap").toBeTruthy();
    expect(persistedCase.documents.map((item) => item.name || item.title)).toContain(document.name);
    expect(persistedCase.tasks.map((item) => item.title)).toContain(task.title);
    expect(bootstrap.events.map((item) => item.title)).toContain(event.title);
    expect(bootstrap.financeOperations.map((item) => item.id)).toEqual(expect.arrayContaining(created.operationIds));

    await openApp(page);
    for (const view of ["clients", "cases", "documents", "finance"]) {
      await page.locator(`.nav-item[data-view="${view}"]`).click();
      await expect(page.locator(`#${view}`), `${view} should render after golden data writes`).toHaveClass(/active/);
      const textLength = await page.locator(`#${view}`).evaluate((node) => node.textContent.trim().length);
      expect(textLength, `${view} should not be blank`).toBeGreaterThan(20);
    }
  } finally {
    await cleanupGoldenMatter(request, created);
  }
});

test("finance invoice and act create documents and clean them up on delete", async ({ request }) => {
  const created = { operationIds: [], documentIds: [] };
  const label = stamp();

  try {
    Object.assign(created, await createGoldenMatter(request, label));

    const invoice = await apiPost(request, "/api/finance/operations/", {
      caseId: created.matter.id,
      action: "invoice",
      title: `Golden cleanup invoice ${label}`,
      amount: 3100,
      date: "2026-06-03",
      status: "Очікується",
      method: "Документ",
      documentNumber: `INV-CLEAN-${label}`,
      documentDue: "2026-06-10",
      documentTemplate: "Основний шаблон",
      comment: "Golden cleanup: invoice document link."
    });
    created.operationIds.push(invoice.operation.id);
    created.documentIds.push(invoice.document.id);

    const act = await apiPost(request, "/api/finance/operations/", {
      caseId: created.matter.id,
      action: "act",
      title: `Golden cleanup act ${label}`,
      amount: 3100,
      date: "2026-06-04",
      status: "Чернетка",
      method: "Документ",
      documentNumber: `ACT-CLEAN-${label}`,
      workPeriod: "червень 2026",
      documentTemplate: "Основний шаблон",
      comment: "Golden cleanup: act document link."
    });
    created.operationIds.push(act.operation.id);
    created.documentIds.push(act.document.id);

    let bootstrap = await apiJson(await request.get("/api/bootstrap/"), "GET /api/bootstrap/");
    let persistedCase = bootstrap.cases.find((item) => item.id === created.matter.id);
    expect(persistedCase.documents.map((item) => item.id)).toEqual(expect.arrayContaining(created.documentIds));

    await apiDelete(request, `/api/finance/operations/${invoice.operation.id}/`);
    await apiDelete(request, `/api/finance/operations/${act.operation.id}/`);
    created.operationIds = [];

    bootstrap = await apiJson(await request.get("/api/bootstrap/"), "GET /api/bootstrap/");
    persistedCase = bootstrap.cases.find((item) => item.id === created.matter.id);
    const remainingDocumentIds = persistedCase ? persistedCase.documents.map((item) => item.id) : [];
    expect(remainingDocumentIds).not.toContain(invoice.document.id);
    expect(remainingDocumentIds).not.toContain(act.document.id);
    expect(bootstrap.financeOperations.map((item) => item.id)).not.toContain(invoice.operation.id);
    expect(bootstrap.financeOperations.map((item) => item.id)).not.toContain(act.operation.id);
    created.documentIds = [];
  } finally {
    await cleanupGoldenMatter(request, created);
  }
});

test("finance UI flow creates payment, invoice, act and opens row actions", async ({ page, request }) => {
  const created = { operationIds: [], documentIds: [] };
  const label = stamp();
  const paymentTitle = `UI payment ${label}`;
  const invoiceTitle = `UI invoice ${label}`;
  const actTitle = `UI act ${label}`;

  async function chooseFinanceCase() {
    await page.locator("#finance-action-case").selectOption(created.matter.id);
  }

  async function submitFinanceAction(action, title, amount, extra = {}) {
    const trigger = extra.fromTab
      ? page.locator(`[data-finance-work-action="${action}"]`).first()
      : page.locator("[data-finance-quick-action]");
    await trigger.click();
    await expect(page.locator("#finance-action-dialog")).toHaveJSProperty("open", true);
    if (!extra.fromTab) {
      await page.locator(`[data-finance-action-choice="${action}"]`).click();
    }
    await chooseFinanceCase();
    await page.locator('#finance-action-form input[name="title"]').fill(title);
    await page.locator('#finance-action-form input[name="amount"]').fill(String(amount));
    await page.locator('#finance-action-form input[name="date"]').fill("2026-05-25");
    if (extra.documentNumber) {
      await page.locator('#finance-action-form input[name="documentNumber"]').fill(extra.documentNumber);
    }
    if (extra.documentDue) {
      await page.locator('#finance-action-form input[name="documentDue"]').fill(extra.documentDue);
    }
    if (extra.workPeriod) {
      await page.locator('#finance-action-form input[name="workPeriod"]').fill(extra.workPeriod);
    }
    await page.locator('#finance-action-form textarea[name="comment"]').fill(`Golden UI finance flow: ${title}`);
    await page.locator("#finance-action-submit").click();
    await expect(page.locator("#finance-action-dialog")).not.toHaveJSProperty("open", true);
  }

  try {
    Object.assign(created, await createGoldenMatter(request, label));

    await openApp(page);
    await page.locator('.nav-item[data-view="finance"]').click();
    await expect(page.locator("#finance")).toHaveClass(/active/);
    await submitFinanceAction("income", paymentTitle, 900);
    await expect(page.locator('.finance-tabs [data-finance-tab="payments"]')).toHaveClass(/active/);
    await expect(page.locator(".finance-workspace-table")).toContainText(paymentTitle);

    await page.locator('[data-finance-tab="invoices"]').click();
    await submitFinanceAction("invoice", invoiceTitle, 2700, {
      fromTab: true,
      documentNumber: `INV-UI-${label}`,
      documentDue: "2026-06-01"
    });
    let bootstrap = await apiJson(await request.get("/api/bootstrap/"), "GET /api/bootstrap/");
    const invoiceOperation = bootstrap.financeOperations.find((item) => item.caseId === created.matter.id && item.type === "Рахунок");
    expect(invoiceOperation, "invoice operation should be created from UI").toBeTruthy();
    await expect(page.locator('.finance-tabs [data-finance-tab="invoices"]')).toHaveClass(/active/);
    await expect(page.locator(".finance-workspace-table")).toContainText(invoiceOperation.title);

    await page.locator('[data-finance-tab="acts"]').click();
    await submitFinanceAction("act", actTitle, 2700, {
      fromTab: true,
      documentNumber: `ACT-UI-${label}`,
      workPeriod: "травень 2026"
    });
    bootstrap = await apiJson(await request.get("/api/bootstrap/"), "GET /api/bootstrap/");
    const actOperation = bootstrap.financeOperations.find((item) => item.caseId === created.matter.id && item.type === "Акт");
    expect(actOperation, "act operation should be created from UI").toBeTruthy();
    await expect(page.locator('.finance-tabs [data-finance-tab="acts"]')).toHaveClass(/active/);
    await expect(page.locator(".finance-workspace-table")).toContainText(actOperation.title);

    await page.locator('.nav-item[data-view="documents"]').click();
    await expect(page.locator("#documents")).toHaveClass(/active/);
    await expect(page.locator("#documents")).toContainText(invoiceTitle);
    await expect(page.locator("#documents")).toContainText(actTitle);

    await page.locator('.nav-item[data-view="finance"]').click();
    await page.locator('[data-finance-tab="invoices"]').click();
    await page.locator("[data-finance-operation-search]").fill(invoiceOperation.title);
    let invoiceRow = page.locator(".finance-operation-row", { hasText: invoiceOperation.title }).first();
    const workspaceTable = page.locator(".finance-workspace-table").first();
    const tableHeightBeforeMenu = await workspaceTable.evaluate((node) => node.getBoundingClientRect().height);
    await invoiceRow.locator("[data-finance-operation-menu]").click();
    await expect(page.locator(".finance-operation-menu")).toContainText("До документа");
    await expect(page.locator(".finance-operation-menu")).toContainText("Редагувати");
    await expect(page.locator(".finance-operation-menu")).toContainText("Видалити");
    const tableHeightWithMenu = await workspaceTable.evaluate((node) => node.getBoundingClientRect().height);
    expect(Math.abs(tableHeightWithMenu - tableHeightBeforeMenu), "row menu should not resize finance table").toBeLessThan(1);
    await page.locator(".finance-workspace-top").click();
    await expect(page.locator(".finance-operation-menu")).toHaveCount(0);
    await invoiceRow.locator("[data-finance-operation-menu]").click();
    await page.locator(".finance-operation-menu [data-finance-operation-document]").click();
    await expect(page.locator("#documents")).toHaveClass(/active/);
    await expect(page.locator("#documents tr.selected")).toContainText(invoiceTitle);

    await page.locator('.nav-item[data-view="finance"]').click();
    await page.locator('[data-finance-tab="invoices"]').click();
    await page.locator("[data-finance-operation-search]").fill(invoiceOperation.title);
    invoiceRow = page.locator(".finance-operation-row", { hasText: invoiceOperation.title }).first();
    await invoiceRow.locator("[data-finance-operation-menu]").click();
    await page.locator(".finance-operation-menu [data-finance-operation-delete]").click();
    await expect(page.locator(".finance-workspace-table")).not.toContainText(invoiceTitle);

    bootstrap = await apiJson(await request.get("/api/bootstrap/"), "GET /api/bootstrap/");
    for (const operation of bootstrap.financeOperations.filter((item) => [paymentTitle, actTitle].includes(item.title))) {
      created.operationIds.push(operation.id);
    }
    const persistedCase = bootstrap.cases.find((item) => item.id === created.matter.id);
    for (const document of persistedCase?.documents || []) {
      if ((document.name || "").includes(invoiceTitle) || (document.name || "").includes(actTitle)) {
        created.documentIds.push(document.id);
      }
    }
  } finally {
    await cleanupGoldenMatter(request, created);
  }
});

test("finance payment workspace paginates dense operation lists without resizing menus", async ({ page, request }) => {
  const created = { operationIds: [] };
  const label = stamp();

  try {
    Object.assign(created, await createGoldenMatter(request, label));
    for (let index = 1; index <= 12; index += 1) {
      const operation = await apiPost(request, "/api/finance/operations/", {
        caseId: created.matter.id,
        action: "income",
        title: `Pagination payment ${label} ${String(index).padStart(2, "0")}`,
        amount: 1000 + index,
        date: "2026-05-25",
        status: index % 2 ? "Оплачено" : "Частково",
        method: index % 2 ? "Банківський переказ" : "Картка",
        comment: "Pagination regression"
      });
      created.operationIds.push(operation.operation.id);
    }

    await openApp(page);
    await page.locator('.nav-item[data-view="finance"]').click();
    await page.locator('[data-finance-tab="payments"]').click();
    await page.locator("[data-finance-operation-search]").fill(`Pagination payment ${label}`);

    await expect(page.locator(".finance-operation-row")).toHaveCount(10);
    await expect(page.locator(".finance-pagination")).toContainText("Показано 1-10 з 12 платежів");
    const workspaceTable = page.locator(".finance-workspace-table").first();
    const tableHeightBeforeMenu = await workspaceTable.evaluate((node) => node.getBoundingClientRect().height);
    await page.locator("[data-finance-operation-menu]").first().click();
    await expect(page.locator(".finance-operation-menu")).toBeVisible();
    const tableHeightWithMenu = await workspaceTable.evaluate((node) => node.getBoundingClientRect().height);
    expect(Math.abs(tableHeightWithMenu - tableHeightBeforeMenu), "payment row menu should not resize finance table").toBeLessThan(1);
    await page.locator(".finance-workspace-top").click();
    await expect(page.locator(".finance-operation-menu")).toHaveCount(0);
    await page.locator(".finance-pagination button", { hasText: "2" }).click();
    await expect(page.locator(".finance-operation-row")).toHaveCount(2);
    await expect(page.locator(".finance-pagination")).toContainText("Показано 11-12 з 12 платежів");
  } finally {
    await cleanupGoldenMatter(request, created);
  }
});
