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

// The finance workspace defaults to a rolling [today-14, today] window
// (DEMO_END = localIsoDate(), DEMO_START = -14d in derived-data.js). Operation
// dates fed to period-filtered UI must land inside it, so compute them relative
// to "now" instead of hardcoding a date that silently drifts out of range.
function isoDaysAgo(days = 0) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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

async function csrfHeaders(request) {
  // CSRF is now enforced on mutating endpoints. The browser gets the cookie via
  // bootstrap (@ensure_csrf_cookie); for direct API calls we fetch it the same way.
  let state = await request.storageState();
  let token = state.cookies.find((c) => c.name === "csrftoken")?.value;
  if (!token) {
    await request.get("/api/bootstrap/");
    state = await request.storageState();
    token = state.cookies.find((c) => c.name === "csrftoken")?.value;
  }
  return token ? { "X-CSRFToken": token } : {};
}

async function apiPost(request, path, data) {
  return apiJson(await request.post(path, { data, headers: await csrfHeaders(request) }), `POST ${path}`);
}

async function apiDelete(request, path) {
  const response = await request.delete(path, { headers: await csrfHeaders(request) });
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

async function cleanupMailingArtifacts(request, matcher) {
  const bootstrap = await apiJson(await request.get("/api/bootstrap/"), "GET /api/bootstrap/");
  const mailing = bootstrap.mailing || {};
  for (const campaign of mailing.campaigns || []) {
    if (matcher(campaign)) await apiDelete(request, `/api/mailings/campaigns/${campaign.id}/`);
  }
  for (const template of mailing.templates || []) {
    if (matcher(template)) await apiDelete(request, `/api/mailings/templates/${template.id}/`);
  }
}

async function cleanupSettingsUsers(request, matcher) {
  const bootstrap = await apiJson(await request.get("/api/bootstrap/"), "GET /api/bootstrap/");
  for (const user of bootstrap.settingsUsers || []) {
    if (user.id && matcher(user)) await apiDelete(request, `/api/users/${user.id}/`);
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
  // KPI grid renders real labels/zeros and no longer fabricates a "+12%" trend.
  await expect(page.locator(".dashboard-kpi-grid")).toContainText("Активних справ");
  await expect(page.locator(".dashboard-kpi-grid")).not.toContainText("%");
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

test("client and case UI forms persist edits after reload", async ({ page, request }) => {
  const created = {};
  const label = stamp();
  const clientEmail = `ui-client-${label}@example.com`;
  const clientName = `UI Client ${label}`;
  const updatedClientName = `UI Client Updated ${label}`;
  const caseTitle = `UI Case ${label}`;
  const updatedCaseTitle = `UI Case Updated ${label}`;

  try {
    await openApp(page);

    await page.locator('.nav-item[data-view="clients"]').click();
    await expect(page.locator("#clients")).toHaveClass(/active/);
    await page.locator("#add-client").click();
    await expect(page.locator("#client-dialog")).toHaveJSProperty("open", true);
    await page.locator('#client-form input[name="name"]').fill(clientName);
    await page.locator('#client-form input[name="phone"]').fill("+380 67 555 12 34");
    await page.locator('#client-form input[name="email"]').fill(clientEmail);
    await page.locator('#client-form input[name="address"]').fill("м. Київ, вул. UI smoke, 10");
    await page.locator('#client-form input[name="telegramUsername"]').fill(`@ui_${label.replaceAll("-", "_")}`);
    await page.locator('#client-form textarea[name="request"]').fill("UI smoke: первинне звернення клієнта.");
    await page.locator('#client-form select[name="source"]').selectOption("Сайт", { force: true });
    await page.locator('#client-form select[name="status"]').selectOption("Активний", { force: true });
    await page.locator('#client-form select[name="manager"]').selectOption({ label: "Admin" }, { force: true });
    await page.locator('#client-form button[type="submit"]').click();
    await expect(page.locator("#client-dialog")).not.toHaveJSProperty("open", true);

    let bootstrap = await apiJson(await request.get("/api/bootstrap/"), "GET /api/bootstrap/");
    created.client = bootstrap.clients.find((client) => client.email === clientEmail);
    expect(created.client, "client should be created through UI form").toBeTruthy();

    await page.locator("#client-filter").fill(clientName);
    await expect(page.locator("#clients-table")).toContainText(clientName);
    await page.locator(`[data-edit-client="${created.client.id}"]`).click();
    await expect(page.locator("#client-dialog")).toHaveJSProperty("open", true);
    await page.locator('#client-form input[name="name"]').fill(updatedClientName);
    await page.locator('#client-form textarea[name="request"]').fill("UI smoke: звернення оновлено через форму.");
    await page.locator('#client-form button[type="submit"]').click();
    await expect(page.locator("#client-dialog")).not.toHaveJSProperty("open", true);

    await page.locator('.nav-item[data-view="cases"]').click();
    await expect(page.locator("#cases")).toHaveClass(/active/);
    await page.locator("#create-case-from-list").click();
    await expect(page.locator("#case-dialog")).toHaveJSProperty("open", true);
    await page.locator('#case-form select[name="clientId"]').selectOption(String(created.client.id), { force: true });
    await page.locator('#case-form input[name="title"]').fill(caseTitle);
    await page.locator('#case-form select[name="type"]').selectOption("Цивільна", { force: true });
    await page.locator('#case-form input[name="stage"]').fill("Первинний аналіз");
    await page.locator('#case-form select[name="status"]').selectOption("В роботі", { force: true });
    await page.locator('#case-form select[name="priority"]').selectOption("Високий", { force: true });
    await page.locator('#case-form input[name="deadline"]').fill("2026-06-30");
    await page.locator('#case-form select[name="responsible"]').selectOption({ label: "Admin" }, { force: true });
    await page.locator("#case-submit-button").click();
    await expect(page.locator("#case-dialog")).not.toHaveJSProperty("open", true);

    bootstrap = await apiJson(await request.get("/api/bootstrap/"), "GET /api/bootstrap/");
    created.client = bootstrap.clients.find((client) => client.email === clientEmail);
    created.matter = bootstrap.cases.find((item) => item.clientId === created.client.id && item.title === caseTitle);
    expect(created.matter, "case should be created through UI form").toBeTruthy();

    await page.locator("#back-to-case-list").click();
    await page.locator("#case-search").fill(caseTitle);
    await expect(page.locator("#case-detail")).toContainText(caseTitle);
    await page.locator(`.case-preview-card [data-edit-case-row="${created.matter.id}"]`).click();
    await expect(page.locator("#case-dialog")).toHaveJSProperty("open", true);
    await page.locator('#case-form input[name="title"]').fill(updatedCaseTitle);
    await page.locator('#case-form input[name="stage"]').fill("Підготовка документів");
    await page.locator('#case-form select[name="status"]').selectOption("Очікує відповідь", { force: true });
    await page.locator("#case-submit-button").click();
    await expect(page.locator("#case-dialog")).not.toHaveJSProperty("open", true);

    await openApp(page);
    await page.locator('.nav-item[data-view="clients"]').click();
    await page.locator("#client-filter").fill(updatedClientName);
    await expect(page.locator("#clients-table")).toContainText(updatedClientName);
    await expect(page.locator("#clients-table")).not.toContainText(clientName);

    await page.locator('.nav-item[data-view="cases"]').click();
    if (await page.locator("#back-to-case-list").isVisible().catch(() => false)) {
      await page.locator("#back-to-case-list").click();
    }
    await page.locator("#case-search").fill(updatedCaseTitle);
    await expect(page.locator("#case-detail")).toContainText(updatedCaseTitle);
    await expect(page.locator("#case-detail")).toContainText(updatedClientName);
    await expect(page.locator("#case-detail")).toContainText("Підготовка документів");
    await expect(page.locator("#case-detail")).not.toContainText(caseTitle);
  } finally {
    const bootstrap = await apiJson(await request.get("/api/bootstrap/"), "GET /api/bootstrap/");
    created.client = created.client || bootstrap.clients.find((client) => client.email === clientEmail);
    created.matter = created.matter || bootstrap.cases.find((item) => item.title === caseTitle || item.title === updatedCaseTitle);
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

test("finance chain keeps debt/overpayment honest and deletion cleans the documents", async ({ request }) => {
  // End-to-end финансовий контур: рахунок → акт → платіж → платіж → видалення.
  // Locks in the Sprint 2 arithmetic (debt = income - paid, payments never inflate
  // income, overpayment surfaces) and the Sprint 1/4 document lifecycle (each
  // рахунок/акт spawns a finance document that is removed when the operation is).
  const created = { operationIds: [], documentIds: [] };
  const label = stamp();

  async function readCase() {
    const bootstrap = await apiJson(await request.get("/api/bootstrap/"), "GET /api/bootstrap/");
    return bootstrap.cases.find((item) => item.id === created.matter.id);
  }

  try {
    Object.assign(created, await createGoldenMatter(request, label));

    // 1) Рахунок на 10000 → задає гонорар (income) і породжує фінансовий документ.
    const invoice = await apiPost(request, "/api/finance/operations/", {
      caseId: created.matter.id,
      action: "invoice",
      title: `Chain invoice ${label}`,
      amount: 10000,
      date: "2026-06-01",
      status: "Очікується",
      method: "Документ",
      documentNumber: `INV-CHAIN-${label}`,
      documentDue: "2026-06-15",
      documentTemplate: "Основний шаблон",
      comment: "Chain: рахунок задає гонорар і створює документ."
    });
    created.operationIds.push(invoice.operation.id);
    created.documentIds.push(invoice.document.id);
    expect(invoice.document?.id, "invoice must spawn a finance document").toBeTruthy();
    expect(invoice.case.income, "invoice sets the agreed fee").toBe(10000);
    expect(invoice.case.debt, "unpaid invoice → full debt").toBe(10000);
    expect(invoice.case.overpaid).toBe(0);

    // 2) Акт → окремий документ, гроші не чіпає.
    const act = await apiPost(request, "/api/finance/operations/", {
      caseId: created.matter.id,
      action: "act",
      title: `Chain act ${label}`,
      amount: 10000,
      date: "2026-06-02",
      status: "Чернетка",
      method: "Документ",
      documentNumber: `ACT-CHAIN-${label}`,
      workPeriod: "червень 2026",
      documentTemplate: "Основний шаблон",
      comment: "Chain: акт створює окремий документ."
    });
    created.operationIds.push(act.operation.id);
    created.documentIds.push(act.document.id);
    expect(act.document?.id, "act must spawn a finance document").toBeTruthy();
    expect(act.case.income, "act must not inflate income").toBe(10000);

    // 3) Платіж 5000 → борг наполовину, переплати ще немає.
    const partial = await apiPost(request, "/api/finance/operations/", {
      caseId: created.matter.id,
      action: "income",
      title: `Chain payment A ${label}`,
      amount: 5000,
      date: "2026-06-03",
      status: "Оплачено",
      method: "Банківський переказ",
      comment: "Chain: частковий платіж."
    });
    created.operationIds.push(partial.operation.id);
    expect(partial.case.paid).toBe(5000);
    expect(partial.case.debt).toBe(5000);
    expect(partial.case.overpaid).toBe(0);

    // 4) Платіж 8000 → разом сплачено 13000 при гонорарі 10000: income НЕ роздувається,
    //    борг обнуляється, зайве проявляється як переплата.
    const overpay = await apiPost(request, "/api/finance/operations/", {
      caseId: created.matter.id,
      action: "income",
      title: `Chain payment B ${label}`,
      amount: 8000,
      date: "2026-06-04",
      status: "Оплачено",
      method: "Банківський переказ",
      comment: "Chain: переплата."
    });
    created.operationIds.push(overpay.operation.id);
    expect(overpay.case.income, "payments must NOT inflate the fee").toBe(10000);
    expect(overpay.case.paid).toBe(13000);
    expect(overpay.case.debt, "fully paid → no debt").toBe(0);
    expect(overpay.case.overpaid, "13000 paid on a 10000 fee → 3000 overpaid").toBe(3000);

    // Обидва фінансові документи мають бути підшиті до справи.
    let persistedCase = await readCase();
    expect(persistedCase.documents.map((item) => item.id)).toEqual(
      expect.arrayContaining([invoice.document.id, act.document.id])
    );

    // 5) Видалення: знімаємо рахунок → його документ зникає, гонорар відкочується.
    await apiDelete(request, `/api/finance/operations/${invoice.operation.id}/`);
    persistedCase = await readCase();
    expect(persistedCase.documents.map((item) => item.id), "invoice document removed with its operation")
      .not.toContain(invoice.document.id);
    expect(persistedCase.income, "removing the invoice unwinds the fee").toBe(0);
    expect(persistedCase.paid, "payments survive invoice removal").toBe(13000);
    expect(persistedCase.overpaid, "no fee + 13000 paid → all of it is overpayment").toBe(13000);

    // Знімаємо акт → його документ теж прибирається.
    await apiDelete(request, `/api/finance/operations/${act.operation.id}/`);
    persistedCase = await readCase();
    expect(persistedCase.documents.map((item) => item.id), "act document removed with its operation")
      .not.toContain(act.document.id);

    // Рахунок та акт зникли з фінансового реєстру; платежі лишаються.
    const bootstrap = await apiJson(await request.get("/api/bootstrap/"), "GET /api/bootstrap/");
    const operationIds = bootstrap.financeOperations.map((item) => item.id);
    expect(operationIds).not.toContain(invoice.operation.id);
    expect(operationIds).not.toContain(act.operation.id);
    expect(operationIds, "the two payments stay in the ledger").toEqual(
      expect.arrayContaining([partial.operation.id, overpay.operation.id])
    );
    created.documentIds = [];
  } finally {
    // cleanupGoldenMatter re-derives leftover operations/documents from bootstrap,
    // so already-deleted ids are harmless (DELETE 404 is treated as a no-op).
    await cleanupGoldenMatter(request, created);
  }
});

test("documents send and ONLYOFFICE actions open from the document registry", async ({ page, request }) => {
  const created = { operationIds: [], documentIds: [] };
  const label = stamp();
  const invoiceTitle = `Document action invoice ${label}`;

  try {
    Object.assign(created, await createGoldenMatter(request, label));
    const invoice = await apiPost(request, "/api/finance/operations/", {
      caseId: created.matter.id,
      action: "invoice",
      title: invoiceTitle,
      amount: 1900,
      date: "2026-06-05",
      status: "Очікується",
      method: "Документ",
      documentNumber: `INV-DOC-${label}`,
      documentDue: "2026-06-12",
      documentTemplate: "Основний шаблон",
      comment: "Golden smoke: document actions should stay connected."
    });
    created.operationIds.push(invoice.operation.id);
    created.documentIds.push(invoice.document.id);

    await page.route("**/web-apps/apps/api/documents/api.js", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/javascript",
        body: `
          window.DocsAPI = {
            DocEditor: function DocEditor(id, config) {
              window.__onlyOfficeSmoke = { id: id, config: config };
              this.destroyEditor = function() {};
              this.resizeEditor = function() {};
            }
          };
        `
      });
    });

    await openApp(page);
    await page.locator('.nav-item[data-view="documents"]').click();
    await page.locator("[data-document-query]").fill(invoiceTitle);
    const docRow = page.locator(".documents-table tbody tr", { hasText: invoiceTitle }).first();
    await expect(docRow).toBeVisible();
    const documentPanel = page.locator(".documents-side", { hasText: invoiceTitle });
    await expect(documentPanel).toBeVisible();

    await documentPanel.locator("[data-send-global-document]").click();
    await expect(page.locator("#document-send-dialog")).toHaveJSProperty("open", true);
    await expect(page.locator("#document-send-recipient-preview")).toContainText("@golden_");
    await expect(page.locator('#document-send-form textarea[name="message"]')).toHaveValue(new RegExp(invoiceTitle));
    await page.keyboard.press("Escape");
    await expect(page.locator("#document-send-dialog")).not.toHaveJSProperty("open", true);

    await documentPanel.locator("[data-office-global-document]").click();
    await expect(page.locator("#office-editor-dialog")).toHaveJSProperty("open", true);
    await expect(page.locator("#office-editor-title")).toContainText(invoiceTitle);
    await expect(page.locator("#onlyoffice-editor-container")).toBeVisible();
    const officeConfig = await page.evaluate(() => window.__onlyOfficeSmoke?.config || null);
    expect(officeConfig?.document?.url, "ONLYOFFICE should receive a document URL").toContain("/api/documents/");
    await page.locator("#office-editor-close").click();
  } finally {
    await cleanupGoldenMatter(request, created);
  }
});

test("tasks calendar and planner stay linked after reload", async ({ page, request }) => {
  const created = { taskIds: [], eventIds: [] };
  const label = stamp();
  const taskTitle = `Planner linked task ${label}`;
  const eventTitle = `Calendar linked event ${label}`;

  async function expectLinkedViews() {
    await page.locator('.nav-item[data-view="tasks"]').click();
    await expect(page.locator("#tasks")).toHaveClass(/active/);
    await page.locator("#task-search").fill(taskTitle);
    await expect(page.locator("#tasks [data-task-key]", { hasText: taskTitle })).toBeVisible();

    await page.locator('.nav-item[data-view="calendar"]').click();
    await expect(page.locator("#calendar")).toHaveClass(/active/);
    await expect(page.locator("#calendar")).toContainText(eventTitle);
    await expect(page.locator("#calendar")).toContainText(taskTitle);

    await page.locator('.nav-item[data-view="planner"]').click();
    await expect(page.locator("#planner")).toHaveClass(/active/);
    await expect(page.locator(".planner-item", { hasText: taskTitle })).toBeVisible();
  }

  try {
    Object.assign(created, await createGoldenMatter(request, label));

    const task = await apiPost(request, "/api/tasks/", {
      caseId: created.matter.id,
      clientId: created.client.id,
      title: taskTitle,
      status: "Нова",
      priority: "Високий",
      responsible: "Іваненко А.Ю.",
      due: "2026-05-27 09:30",
      description: "Golden smoke: задача має бути в задачах, календарі та планері.",
      showInCalendar: true,
      plannerManual: true,
      plannerImportant: true,
      plannerDate: "2026-05-27",
      plannerTime: "09:30",
      reminderEnabled: true,
      reminderBefore: "За 1 день",
      reminderChannel: "CRM",
      subtasks: [
        { title: "Підготувати матеріали", status: "Нова", responsible: "Іваненко А.Ю.", due: "27.05.2026" }
      ]
    });
    created.taskIds.push(task.id);

    const event = await apiPost(request, "/api/calendar/events/", {
      title: eventTitle,
      type: "Судове засідання",
      date: "2026-05-28",
      time: "10:00",
      endTime: "11:00",
      clientId: created.client.id,
      caseId: created.matter.id,
      authority: "Golden court",
      location: "Київ",
      responsible: "Іваненко А.Ю.",
      status: "Заплановано",
      reminderEnabled: true,
      reminderBefore: "За 1 день",
      reminderChannels: "CRM",
      reminderRecipients: "Відповідальний юрист"
    });
    created.eventIds.push(event.id);

    const bootstrap = await apiJson(await request.get("/api/bootstrap/"), "GET /api/bootstrap/");
    const persistedCase = bootstrap.cases.find((item) => item.id === created.matter.id);
    expect(persistedCase.tasks.map((item) => item.title)).toContain(taskTitle);
    expect(bootstrap.events.map((item) => item.title)).toContain(eventTitle);

    await openApp(page);
    await expectLinkedViews();
    await page.reload();
    await expect(page.locator(".nav-item[data-view='dashboard']")).toBeVisible();
    await expect(page.locator("#dashboard")).toHaveClass(/active/);
    await expectLinkedViews();
  } finally {
    await cleanupGoldenMatter(request, created);
  }
});

test("calendar-created event stays a calendar event after reload", async ({ page, request }) => {
  const created = { eventIds: [] };
  const label = stamp();
  const eventTitle = `Calendar manual event ${label}`;
  const eventDate = "2026-05-29";

  try {
    Object.assign(created, await createGoldenMatter(request, label));

    await openApp(page);
    await page.locator('.nav-item[data-view="calendar"]').click();
    await expect(page.locator("#calendar")).toHaveClass(/active/);
    await page.locator("#add-event").click();
    await expect(page.locator("#event-dialog")).toHaveJSProperty("open", true);
    await page.locator('#event-form input[name="title"]').fill(eventTitle);
    await page.locator('#event-form select[name="client"]').selectOption(String(created.client.id));
    await page.locator('#event-form select[name="caseId"]').selectOption(created.matter.id);
    await page.locator('#event-form select[name="type"]').selectOption("Зустріч з клієнтом");
    await page.locator('#event-form input[name="date"]').fill(eventDate);
    await page.locator('#event-form input[name="time"]').fill("14:30");
    await page.locator('#event-form input[name="endTime"]').fill("15:00");
    await page.locator('#event-form input[name="authority"]').fill("Golden meeting room");
    await page.locator('#event-form textarea[name="description"]').fill("Golden smoke: подія створена з календаря, не з блоку процесуальних дій.");
    await page.locator("#event-submit-button").click();
    await expect(page.locator("#event-dialog")).not.toHaveJSProperty("open", true);

    let bootstrap = await apiJson(await request.get("/api/bootstrap/"), "GET /api/bootstrap/");
    const createdEvent = bootstrap.events.find((item) => item.title === eventTitle);
    expect(createdEvent, "calendar UI should create a real calendar event").toBeTruthy();
    expect(createdEvent.proceduralAction, "calendar event should not be marked as procedural action").not.toBeTruthy();
    created.eventIds.push(createdEvent.id);
    await expect(page.locator("#calendar")).toContainText(eventTitle);

    const persistedCase = bootstrap.cases.find((item) => item.id === created.matter.id);
    const proceduralTitles = (persistedCase?.proceduralActions || []).map((item) => item.action || item.title);
    expect(proceduralTitles).not.toContain(eventTitle);

    await page.reload();
    await expect(page.locator(".nav-item[data-view='dashboard']")).toBeVisible();
    await page.locator('.nav-item[data-view="calendar"]').click();
    await expect(page.locator("#calendar")).toContainText(eventTitle);

    bootstrap = await apiJson(await request.get("/api/bootstrap/"), "GET /api/bootstrap/");
    expect(bootstrap.events.some((item) => item.id === createdEvent.id && item.title === eventTitle)).toBeTruthy();
  } finally {
    await cleanupGoldenMatter(request, created);
  }
});

test("mailing preview templates and scheduled campaigns use live recipients", async ({ page, request }) => {
  const created = {};
  const label = stamp();
  const signature = `mailing-smoke-${label}`;
  const message = `Шановний {{client_name}}!\n\nПовідомлення ${signature}: перевірка Telegram, SMS та Email.\n\nЗ повагою,\nAdvocates Bureau`;

  try {
    Object.assign(created, await createGoldenMatter(request, label));

    await openApp(page);
    await page.locator('.nav-item[data-view="mailings"]').click();
    await expect(page.locator("#mailings")).toHaveClass(/active/);
    await expect(page.locator(".coverage-row")).toContainText("Клиенты");
    await expect(page.locator(".forecast-card")).toContainText("Всего получателей");

    await page.locator("#mailing-text").fill(message);
    await expect(page.locator("#mail-preview")).toContainText(signature);
    await expect(page.locator("#mail-preview")).toContainText("Шановні клієнти!");
    await expect(page.locator("#mailing-char-count")).toHaveText(String(message.length));

    await page.locator('[data-preview-channel="SMS"]').click();
    await expect(page.locator("#mail-preview")).toContainText(signature);
    await page.locator('[data-preview-channel="Email"]').click();
    await expect(page.locator("#mail-preview")).toContainText("Тема: Важливе повідомлення");
    await expect(page.locator("#mail-preview")).toContainText(signature);

    await page.locator("[data-save-mailing-template]").click();
    await expect(page.locator("#mailings")).toContainText("Шаблон сохранён");
    await page.locator('[data-mailing-main-tab="templates"]').click();
    await expect(page.locator(".template-library-list")).toContainText(signature);

    await page.locator('[data-mailing-main-tab="new"]').click();
    await page.locator("#mailing-text").fill(message);
    await page.locator('input[name="send-time"][value="later"]').check();
    await page.locator("[data-mailing-schedule-date]").fill("2026-06-22");
    await page.locator("[data-mailing-schedule-time]").fill("11:30");
    await page.locator('[data-mailing-action="schedule"]').click();
    await expect(page.locator(".mailing-history-list")).toContainText("Информационное сообщение клиентам");
    await expect(page.locator(".mailing-history-list")).toContainText("Запланирована");
    await expect(page.locator(".mailing-history-list")).toContainText("22.06.2026 11:30");

    const bootstrap = await apiJson(await request.get("/api/bootstrap/"), "GET /api/bootstrap/");
    expect((bootstrap.mailing?.templates || []).some((item) => String(item.text || "").includes(signature))).toBeTruthy();
    expect((bootstrap.mailing?.campaigns || []).some((item) => String(item.text || "").includes(signature))).toBeTruthy();
  } finally {
    await cleanupMailingArtifacts(request, (item) => String(item.text || "").includes(signature));
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
    await page.locator('#finance-action-form input[name="date"]').fill(isoDaysAgo(3));
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
        date: isoDaysAgo(3),
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

test("settings readiness users and integrations stay consistent after reload", async ({ page, request }) => {
  const label = stamp();
  const userName = `Settings Smoke ${label}`;
  const userEmail = `settings-${label}@example.com`;
  let createdUserId = null;

  try {
    await cleanupSettingsUsers(request, (user) => user.email === userEmail || user.name === userName);
    const before = await apiJson(await request.get("/api/bootstrap/"), "GET /api/bootstrap/");
    const initialActiveUsers = (before.settingsUsers || []).filter((user) => user.role !== "Видалений").length;

    await openApp(page);
    await page.locator('.nav-item[data-view="settings"]').click();
    await expect(page.locator("#settings")).toHaveClass(/active/);
    await expect(page.locator("[data-settings-section='readiness']")).toContainText("Аудит готовності");
    await expect(page.locator("[data-settings-section='integrations']")).toContainText("ONLYOFFICE");
    await expect(page.locator("[data-settings-section='integrations']")).toContainText("Email");
    await expect(page.locator("[data-settings-section='audit']")).toContainText("Журнал змін");
    await expect(page.locator('[data-settings-focus="users"] strong')).toHaveText(String(initialActiveUsers));

    const summaryReadiness = (await page.locator('[data-settings-focus="readiness"] strong').innerText()).trim();
    const auditReadiness = (await page.locator(".settings-readiness-total strong").innerText()).trim();
    expect(summaryReadiness).toBe(auditReadiness);

    await page.locator('[data-settings-focus="users"]').click();
    await page.locator('[data-settings-action="invite"]').click();
    await expect(page.locator("#settings-invite-dialog")).toHaveJSProperty("open", true);
    await page.locator('#settings-invite-form input[name="name"]').fill(userName);
    await page.locator('#settings-invite-form input[name="email"]').fill(userEmail);
    await page.locator('#settings-invite-form input[name="photo"]').fill("SS");
    await page.locator('#settings-invite-form input[name="password"]').fill("Smoke12345");
    await page.locator('#settings-invite-form select[name="role"]').selectOption("Бухгалтер", { force: true });
    await page.locator('#settings-invite-form select[name="access"]').selectOption("Фінанси та звіти", { force: true });
    await page.locator("[data-settings-user-submit]").click();
    await expect(page.locator("#settings-invite-dialog")).not.toHaveJSProperty("open", true);

    let bootstrap = await apiJson(await request.get("/api/bootstrap/"), "GET /api/bootstrap/");
    let createdUser = (bootstrap.settingsUsers || []).find((user) => user.email === userEmail);
    expect(createdUser, "settings user should be saved through UI").toBeTruthy();
    createdUserId = createdUser.id;
    expect(createdUser.role).toBe("Бухгалтер");
    expect(createdUser.access).toBe("Фінанси та звіти");

    await openApp(page);
    await page.locator('.nav-item[data-view="settings"]').click();
    await page.locator('[data-settings-focus="users"]').click();
    await expect(page.locator('[data-settings-focus="users"] strong')).toHaveText(String(initialActiveUsers + 1));
    const createdRow = page.locator(".settings-user-row").filter({ hasText: userEmail });
    await expect(createdRow).toContainText(userName);
    await expect(createdRow).toContainText("Бухгалтер");
    await expect(createdRow).toContainText("Фінанси та звіти");

    await createdRow.locator("[data-settings-user-menu]").click();
    await expect(createdRow.locator(".settings-user-menu")).toBeVisible();
    await createdRow.locator("[data-settings-user-delete]").click();
    await expect(page.locator("#settings-user-delete-dialog")).toHaveJSProperty("open", true);
    await page.locator("#settings-user-delete-dialog [data-settings-delete-user-confirm]").click();
    await expect(page.locator("#settings-user-delete-dialog")).not.toHaveJSProperty("open", true);
    await expect(page.locator(".settings-user-row").filter({ hasText: userEmail })).toHaveCount(0);
    await expect(page.locator('[data-settings-focus="users"] strong')).toHaveText(String(initialActiveUsers));

    bootstrap = await apiJson(await request.get("/api/bootstrap/"), "GET /api/bootstrap/");
    createdUser = (bootstrap.settingsUsers || []).find((user) => user.email === userEmail);
    expect(createdUser).toBeFalsy();
    createdUserId = null;
  } finally {
    if (createdUserId) await apiDelete(request, `/api/users/${createdUserId}/`);
    await cleanupSettingsUsers(request, (user) => user.email === userEmail || user.name === userName);
  }
});

test("OSINT uses live cases for search, monitoring, reports and case navigation", async ({ page, request }) => {
  const created = { documentIds: [], taskIds: [], operationIds: [] };
  const label = stamp();
  const clientName = `OSINT Client ${label}`;
  const caseTitle = `OSINT Risk Case ${label}`;
  const taskTitle = `OSINT Monitor Task ${label}`;
  const documentName = `OSINT Registry Evidence ${label}.pdf`;

  try {
    const client = await apiPost(request, "/api/clients/", {
      name: clientName,
      phone: "+380 67 100 90 80",
      email: `osint-${label}@example.com`,
      telegramUsername: `@osint_${label.replaceAll("-", "_")}`,
      request: "OSINT smoke: перевірити відкриті джерела по клієнту.",
      status: "Активний",
      source: "Автотест",
      manager: "Іваненко А.Ю."
    });
    const matter = await apiPost(request, "/api/cases/", {
      clientId: client.id,
      title: caseTitle,
      type: "Господарська",
      stage: "OSINT моніторинг",
      status: "В роботі",
      priority: "Високий",
      responsible: "Іваненко А.Ю.",
      deadline: "2026-06-20",
      description: "OSINT smoke: справа з високим ризиком для перевірки моніторингу."
    });
    created.client = client;
    created.matter = matter;

    const task = await apiPost(request, "/api/tasks/", {
      caseId: matter.id,
      clientId: client.id,
      title: taskTitle,
      status: "Нова",
      priority: "Високий",
      responsible: "Іваненко А.Ю.",
      due: "2026-06-12 12:00",
      description: "OSINT smoke: задача під моніторинг відкритих джерел."
    });
    created.taskIds.push(task.id);

    const document = await apiPost(request, "/api/documents/", {
      caseId: matter.id,
      name: documentName,
      type: "Доказ",
      folder: "Інші документи",
      status: "Подано",
      submitted: "2026-06-02",
      responseDue: "2026-06-16",
      responsible: "Іваненко А.Ю.",
      comment: "OSINT smoke: документ має дати згадку у відкритих джерелах."
    });
    created.documentIds.push(document.id);

    await openApp(page);
    await page.locator('.nav-item[data-view="osint"]').click();
    await expect(page.locator("#osint")).toHaveClass(/active/);
    await expect(page.locator("#osint .osint-kpi-card").first()).not.toContainText("Без даних");
    await expect(page.locator("#osint")).toContainText(caseTitle);

    await page.locator("[data-osint-query]").fill(clientName);
    await expect(page.locator(".osint-mention-row")).toHaveCount(1);
    await expect(page.locator(".osint-mention-row")).toContainText(caseTitle);
    await expect(page.locator(".osint-mention-row")).toContainText(clientName);

    await page.locator('[data-osint-metric="risks"]').click();
    await expect(page.locator('[data-osint-subtab="risks"]')).toHaveClass(/active/);
    await expect(page.locator(".osint-mention-row")).toContainText(caseTitle);

    await page.locator('[data-osint-metric="monitoring"]').click();
    await expect(page.locator('[data-osint-tab="monitoring"]')).toHaveClass(/active/);
    await expect(page.locator("#osint")).toContainText("Активний моніторинг");
    await expect(page.locator("#osint")).toContainText(caseTitle);

    await page.locator('[data-osint-metric="sources"]').click();
    await expect(page.locator(".osint-source-manager")).toBeVisible();
    await expect(page.locator(".osint-source-manager")).toContainText("Керування джерелами");

    await page.locator("[data-create-osint]").first().click();
    await expect(page.locator('[data-osint-tab="reports"]')).toHaveClass(/active/);
    await expect(page.locator("#osint")).toContainText("OSINT звіт №");

    await page.locator('[data-osint-tab="overview"]').click();
    await page.locator("[data-osint-query]").fill(clientName);
    await page.locator(".osint-mention-row").first().click();
    await expect(page.locator("#cases")).toHaveClass(/active/);
    await expect(page.locator("#case-detail")).toContainText(`Справа № ${matter.id}`);
    await expect(page.locator("#case-detail")).toContainText(clientName);
  } finally {
    await cleanupGoldenMatter(request, created);
  }
});

test("role walkthrough: finance gating and case scoping per role", async ({ request, playwright }) => {
  // Closes the last unchecked item of the "ready to demo" checklist (LOGIC_AUDIT
  // Sprint 5 / risk #4): admin / адвокат / помічник / бухгалтер each get exactly
  // the access their role allows. Logging in flips current_demo_user to the real
  // session user (works even in demo mode), so this exercises the live gate.
  const label = stamp();
  const password = "RoleWalk-2026!";
  const created = { operationIds: [], documentIds: [], userIds: [] };
  const contexts = [];

  async function loginBootstrap(email) {
    const ctx = await playwright.request.newContext({ baseURL: "http://127.0.0.1:8001" });
    contexts.push(ctx);
    const session = await apiJson(await ctx.post("/api/auth/login/", { data: { email, password } }), `login ${email}`);
    const bootstrap = await apiJson(await ctx.get("/api/bootstrap/"), `bootstrap ${email}`);
    return { session, bootstrap };
  }

  try {
    // Admin (the demo `request` context) sets the stage: one matter + an invoice on it.
    Object.assign(created, await createGoldenMatter(request, label));
    const invoice = await apiPost(request, "/api/finance/operations/", {
      caseId: created.matter.id,
      action: "invoice",
      title: `Role invoice ${label}`,
      amount: 4200,
      date: "2026-06-01",
      status: "Очікується",
      method: "Документ",
      documentNumber: `INV-ROLE-${label}`,
      documentDue: "2026-06-15",
      documentTemplate: "Основний шаблон",
      comment: "Role walkthrough: ledger entry for finance gating."
    });
    created.operationIds.push(invoice.operation.id);
    created.documentIds.push(invoice.document.id);

    // Three non-admin roles. Lawyer + accountant are members of the matter;
    // the assistant deliberately is NOT, to prove case scoping hides it.
    const lawyerEmail = `role-lawyer-${label}@example.com`;
    const assistantEmail = `role-assistant-${label}@example.com`;
    const accountantEmail = `role-accountant-${label}@example.com`;
    const lawyer = await apiPost(request, "/api/users/", {
      name: `Role Lawyer ${label}`, email: lawyerEmail, role: "Адвокат",
      password, passwordTemporary: false, assignedCaseIds: [created.matter.id]
    });
    const assistant = await apiPost(request, "/api/users/", {
      name: `Role Assistant ${label}`, email: assistantEmail, role: "Помічник",
      password, passwordTemporary: false, assignedCaseIds: []
    });
    const accountant = await apiPost(request, "/api/users/", {
      name: `Role Accountant ${label}`, email: accountantEmail, role: "Бухгалтер",
      password, passwordTemporary: false, assignedCaseIds: [created.matter.id]
    });
    created.userIds.push(lawyer.id, assistant.id, accountant.id);

    // --- ADMIN: sees the full picture ---
    const admin = await apiJson(await request.get("/api/bootstrap/"), "bootstrap admin");
    expect(admin.session.permissions.canSeeFinance, "admin sees finance").toBe(true);
    expect(admin.session.permissions.canManageUsers, "admin manages users").toBe(true);
    expect(admin.financeOperations.map((o) => o.id), "admin sees the invoice op").toContain(invoice.operation.id);
    expect(admin.settingsUsers.length, "admin gets the full staff directory").toBeGreaterThan(1);
    expect(admin.cases.map((c) => c.id), "admin sees the matter").toContain(created.matter.id);

    // --- АДВОКАТ: cases yes, finance no, users no ---
    const law = await loginBootstrap(lawyerEmail);
    expect(law.session.user.roleKey).toBe("lawyer");
    expect(law.session.permissions.canManageCases, "lawyer manages cases").toBe(true);
    expect(law.session.permissions.canSeeFinance, "lawyer must NOT see finance").toBe(false);
    expect(law.session.permissions.canManageUsers, "lawyer must NOT manage users").toBe(false);
    expect(law.bootstrap.financeOperations, "no finance ledger for lawyer").toEqual([]);
    expect(law.bootstrap.settingsUsers.length, "lawyer only gets own profile").toBe(1);
    expect(law.bootstrap.cases.map((c) => c.id), "lawyer sees the assigned matter").toContain(created.matter.id);
    const lawyerCase = law.bootstrap.cases.find((c) => c.id === created.matter.id);
    expect(lawyerCase.income, "finance figures zeroed for lawyer").toBe(0);
    expect(lawyerCase.debt, "finance figures zeroed for lawyer").toBe(0);

    // --- ПОМІЧНИК: no finance, no users, not a member → matter hidden ---
    const asst = await loginBootstrap(assistantEmail);
    expect(asst.session.user.roleKey).toBe("assistant");
    expect(asst.session.permissions.canSeeFinance, "assistant must NOT see finance").toBe(false);
    expect(asst.session.permissions.canManageUsers, "assistant must NOT manage users").toBe(false);
    expect(asst.session.permissions.canViewPlanner, "assistant has the planner").toBe(true);
    expect(asst.bootstrap.financeOperations, "no finance ledger for assistant").toEqual([]);
    expect(asst.bootstrap.settingsUsers.length, "assistant only gets own profile").toBe(1);
    expect(asst.bootstrap.cases.map((c) => c.id), "non-member assistant cannot see the matter").not.toContain(created.matter.id);

    // --- БУХГАЛТЕР: finance yes, users no, cases no, member → sees the ledger ---
    const acc = await loginBootstrap(accountantEmail);
    expect(acc.session.user.roleKey).toBe("accountant");
    expect(acc.session.permissions.canSeeFinance, "accountant sees finance").toBe(true);
    expect(acc.session.permissions.canManageFinance, "accountant manages finance").toBe(true);
    expect(acc.session.permissions.canManageUsers, "accountant must NOT manage users").toBe(false);
    expect(acc.session.permissions.canManageCases, "accountant must NOT manage cases").toBe(false);
    expect(acc.bootstrap.settingsUsers.length, "accountant only gets own profile").toBe(1);
    expect(acc.bootstrap.financeOperations.map((o) => o.id), "accountant sees the matter's ledger").toContain(invoice.operation.id);
  } finally {
    for (const ctx of contexts) await ctx.dispose();
    for (const userId of created.userIds || []) {
      await apiDelete(request, `/api/users/${userId}/`);
    }
    await cleanupGoldenMatter(request, created);
  }
});
