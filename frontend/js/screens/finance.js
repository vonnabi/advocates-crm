import { deleteFinanceOperationFromApi, saveCaseToApi, saveFinanceOperationToApi, shouldUseApi } from "../api.js";
import {
  buildFinanceOperations,
  DEMO_END,
  DEMO_START,
  financeInsightsFromData,
  financeRowsFromCases,
  financeTotalsFromData
} from "../derived-data.js?v=finance-real-data-1";
import { normalizeCase, normalizeFinanceOperation } from "../state.js";

const DEFAULT_START = DEMO_START;
const DEFAULT_END = DEMO_END;
const FINANCE_PAGE_SIZE = 10;
let financeOutsideMenuHandler = null;

function financePageState(state) {
  state.financePages = state.financePages && typeof state.financePages === "object" ? state.financePages : {};
  return state.financePages;
}

function resetFinancePage(state, key = state.financeTab || "overview") {
  financePageState(state)[key] = 1;
}

function paginateFinanceItems(state, key, items, pageSize = FINANCE_PAGE_SIZE) {
  const pages = financePageState(state);
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(Math.max(Number(pages[key]) || 1, 1), totalPages);
  pages[key] = currentPage;
  const start = (currentPage - 1) * pageSize;
  return {
    key,
    items: items.slice(start, start + pageSize),
    page: currentPage,
    pageSize,
    start,
    total,
    totalPages
  };
}

function financePageNumbers(page, totalPages) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
  const numbers = new Set([1, totalPages, page - 1, page, page + 1]);
  return [...numbers].filter((item) => item >= 1 && item <= totalPages).sort((a, b) => a - b);
}

function financePaginationHtml(pagination, itemLabel = "записів") {
  if (!pagination || pagination.total <= pagination.pageSize) return "";
  const shownFrom = pagination.start + 1;
  const shownTo = pagination.start + pagination.items.length;
  const pages = financePageNumbers(pagination.page, pagination.totalPages);
  return `
    <div class="finance-pagination">
      <span>Показано ${shownFrom}-${shownTo} з ${pagination.total} ${itemLabel}</span>
      <div>
        <button type="button" data-finance-page-key="${pagination.key}" data-finance-page="${Math.max(1, pagination.page - 1)}" ${pagination.page === 1 ? "disabled" : ""}>‹</button>
        ${pages.map((page, index) => `
          ${index > 0 && page - pages[index - 1] > 1 ? `<em>…</em>` : ""}
          <button class="${page === pagination.page ? "active" : ""}" type="button" data-finance-page-key="${pagination.key}" data-finance-page="${page}">${page}</button>
        `).join("")}
        <button type="button" data-finance-page-key="${pagination.key}" data-finance-page="${Math.min(pagination.totalPages, pagination.page + 1)}" ${pagination.page === pagination.totalPages ? "disabled" : ""}>›</button>
      </div>
    </div>
  `;
}

function financeOperationPaginationLabel(tab) {
  if (tab === "payments") return "платежів";
  if (tab === "invoices") return "рахунків";
  if (tab === "acts") return "актів";
  return "операцій";
}

function financeDisplayDate(daysAgo = 0) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")}.${date.getFullYear()}`;
}

const FINANCE_TABS = [
  ["overview", "Огляд"],
  ["payments", "Платежі"],
  ["cases", "Справа"],
  ["clients", "Клієнти"],
  ["invoices", "Рахунки"],
  ["acts", "Акти"],
  ["salary", "Зарплата"],
  ["reports", "Звіти"]
];

const CASHFLOW = [
  ["16-22 трав", 88, 52],
  ["23-29 трав", 82, 51],
  ["30 трав - 05 черв", 74, 52],
  ["06-12 черв", 69, 48]
];

const FINANCE_LINE = {
  income: [55, 70, 76, 72, 72, 82, 73, 86, 72, 80, 81, 76, 88, 97],
  expenses: [12, 15, 18, 19, 18, 24, 19, 26, 20, 26, 27, 22, 27, 29],
  profit: [29, 38, 41, 35, 34, 42, 37, 47, 41, 45, 46, 42, 51, 56]
};

const EMPTY_FINANCE_LINE = {
  income: FINANCE_LINE.income.map(() => 0),
  expenses: FINANCE_LINE.expenses.map(() => 0),
  profit: FINANCE_LINE.profit.map(() => 0)
};

const chartDates = ["01.05", "03.05", "05.05", "07.05", "09.05", "11.05", "13.05", "15.05"];

const FINANCE_ACTIONS = {
  income: {
    tab: "payments",
    title: "Додати надходження",
    hint: "Платіж зменшить борг по вибраній справі і з'явиться у фінансових операціях.",
    operationType: "Надходження",
    defaultTitle: "Оплата за правову допомогу",
    status: "Оплачено",
    method: "Банківський переказ",
    submit: "Зберегти надходження"
  },
  expense: {
    tab: "payments",
    title: "Додати витрату",
    hint: "Витрата буде прив'язана до справи, але не збільшить борг клієнта.",
    operationType: "Витрата",
    defaultTitle: "Судові витрати",
    status: "Оплачено",
    method: "Картка",
    submit: "Зберегти витрату"
  },
  invoice: {
    tab: "invoices",
    title: "Виставити рахунок клієнту",
    hint: "Буде створено документ-рахунок у папці «Фінансові документи» і очікуване надходження.",
    operationType: "Рахунок",
    defaultTitle: "Рахунок клієнту",
    status: "Очікується",
    method: "Документ",
    submit: "Створити рахунок"
  },
  act: {
    tab: "acts",
    title: "Створити акт",
    hint: "Буде створено акт виконаних робіт у документах справи.",
    operationType: "Акт",
    defaultTitle: "Акт виконаних робіт",
    status: "Чернетка",
    method: "Документ",
    submit: "Створити акт"
  }
};

const FINANCE_WORKSPACES = {
  income: {
    title: "Надходження",
    subtitle: "Оплати клієнтів, консультації та гонорари, пов'язані зі справами.",
    action: "income",
    actionLabel: "Додати надходження",
    empty: "Надходжень за обраний період немає."
  },
  expenses: {
    title: "Витрати",
    subtitle: "Судові збори, поштові та інші витрати, які потрібно врахувати у фінансах.",
    action: "expense",
    actionLabel: "Додати витрату",
    empty: "Витрат за обраний період немає."
  },
  cases: {
    title: "Фінанси по справах",
    subtitle: "Контроль договорів, оплат і боргів у розрізі кожної справи.",
    action: "invoice",
    actionLabel: "Виставити рахунок",
    empty: "Справи з фінансовими даними не знайдені."
  },
  clients: {
    title: "Клієнти та борги",
    subtitle: "Клієнти з неоплаченими рахунками або частковими платежами.",
    action: "income",
    actionLabel: "Додати оплату",
    empty: "Активних боргів за обраний період немає."
  },
  invoices: {
    title: "Рахунки",
    subtitle: "Виставлені рахунки, очікувані надходження і статуси оплати.",
    action: "invoice",
    actionLabel: "Виставити рахунок",
    empty: "Рахунків за обраний період немає."
  },
  acts: {
    title: "Акти",
    subtitle: "Акти виконаних робіт, які створюються у документах справи.",
    action: "act",
    actionLabel: "Створити акт",
    empty: "Актів за обраний період немає."
  },
  payments: {
    title: "Платежі",
    subtitle: "Усі фактичні надходження та витрати за вибраний період.",
    action: "income",
    actionLabel: "Додати платіж",
    empty: "Платежів за обраний період немає."
  }
};

const SALARY_ROWS = [
  { name: "Іваненко А.Ю.", role: "Адвокат", base: 80000, bonus: 12000, total: 92000, status: "Готово", date: financeDisplayDate(), comment: "Ставка та бонус за закриті задачі" },
  { name: "Мельник Н.П.", role: "Адвокат", base: 62000, bonus: 8000, total: 70000, status: "Готово", date: financeDisplayDate(), comment: "Ставка за травень" },
  { name: "Кравчук А.В.", role: "Помічник", base: 34000, bonus: 3500, total: 37500, status: "Очікує", date: financeDisplayDate(), comment: "Потребує підтвердження" },
  { name: "Петренко С.В.", role: "Юрист", base: 48000, bonus: 6000, total: 54000, status: "Готово", date: financeDisplayDate(), comment: "Ставка за травень" }
];

const SALARY_MONTHS = ["Черв", "Лип", "Серп", "Вер", "Жов", "Лис", "Гру", "Січ", "Лют", "Бер", "Квіт", "Трав"];

const REPORT_ROWS = [
  ["Фінансовий звіт за період", "Доходи, витрати, прибуток і борги", "CSV"],
  ["Звіт по заборгованості", "Клієнти, суми боргу і прострочки", "PDF"],
  ["Реєстр рахунків та актів", "Документи, статуси і пов'язані справи", "XLSX"]
];

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function isoToday() {
  return DEFAULT_END;
}

function financeRows(ctx) {
  return financeRowsFromCases(ctx.state);
}

function openFinanceCase(ctx, caseId) {
  const { state, renderCases, switchView } = ctx;
  if (!caseId) return;
  state.selectedCaseId = caseId;
  state.caseScreen = "detail";
  state.openCaseSection = "finance";
  renderCases();
  switchView("cases");
}

function findFinanceOperationDocumentTarget(ctx, operation = {}) {
  const { caseById, caseFolders } = ctx;
  const item = caseById(operation.caseId);
  const documentId = String(operation.documentId || "").trim();
  if (!item || !["Рахунок", "Акт"].includes(operation.type) && !documentId) return null;
  const normalizedTitle = String(operation.title || "").trim().toLowerCase();
  const byFinanceDocument = (entry = {}) => {
    const entryId = String(entry.documentId || entry.id || "");
    const entryType = String(entry.type || "");
    const entryName = String(entry.name || entry.title || "").toLowerCase();
    if (documentId && entryId === documentId) return true;
    if (operation.type && entryType === operation.type) return true;
    return Boolean(normalizedTitle && entryName.includes(normalizedTitle));
  };
  const docIndex = (item.documents || []).findIndex(byFinanceDocument);
  const linkedDoc = docIndex >= 0 ? item.documents[docIndex] : null;
  const folders = caseFolders(item);
  const findFolderFile = (items = [], path = []) => {
    for (let folderIndex = 0; folderIndex < items.length; folderIndex += 1) {
      const folder = items[folderIndex];
      const folderPath = [...path, folderIndex];
      const fileIndex = (folder.files || []).findIndex(byFinanceDocument);
      if (fileIndex >= 0) {
        return { folder, folderPath, fileIndex, file: folder.files[fileIndex] };
      }
      const nested = findFolderFile(folder.children || [], folderPath);
      if (nested) return nested;
    }
    return null;
  };
  const folderMatch = findFolderFile(folders);
  const encoded = linkedDoc
    ? `procedural:${docIndex}`
    : folderMatch
      ? folderMatch.folderPath.length > 1
        ? `folderPath:${folderMatch.folderPath.join(".")}:${folderMatch.fileIndex}`
        : `folder:${folderMatch.folderPath[0]}:${folderMatch.fileIndex}`
      : "";
  if (!encoded) return null;
  return {
    caseId: item.id,
    clientId: String(item.clientId || "all"),
    folderName: folderMatch?.folder?.name || linkedDoc?.folder || linkedDoc?.folderName || "",
    key: `${item.id}|${encoded}`
  };
}

function openFinanceOperationDocument(ctx, operationId) {
  const { state, renderAll, switchView, showToast } = ctx;
  const operation = findFinanceOperation(state, operationId);
  const target = findFinanceOperationDocumentTarget(ctx, operation);
  state.financeOperationMenuId = "";
  if (!target) {
    showToast?.("Документ для цієї фінансової дії не знайдено.", "warning");
    renderAll?.();
    return;
  }
  state.documentQuickFilter = "all";
  state.documentQuery = "";
  state.documentStatusFilter = "all";
  state.documentTypeFilter = "all";
  state.documentDueFilter = "all";
  state.documentClientFilter = target.clientId;
  state.documentCaseFilter = target.caseId;
  state.documentArchiveScope = "cases";
  state.documentArchiveClientId = target.clientId;
  state.documentArchiveCaseId = target.caseId;
  state.documentArchiveFolder = target.folderName;
  state.selectedDocumentKeys = [];
  state.selectedDocumentKey = target.key;
  renderAll?.();
  switchView("documents");
  showToast?.("Відкрито документ фінансової дії.");
}

function dateFromAny(value) {
  if (!value) return null;
  const clean = String(value).split(" ")[0];
  if (clean.includes("-")) {
    const [year, month, day] = clean.split("-").map(Number);
    return new Date(year, month - 1, day);
  }
  const [day, month, year] = clean.split(".").map(Number);
  return new Date(year, month - 1, day);
}

function financeDate(value) {
  const clean = String(value || DEFAULT_START);
  if (clean.includes("-")) {
    const [year, month, day] = clean.split("-");
    return `${day}.${month}.${year}`;
  }
  return clean;
}

function inDateRange(value, startIso, endIso) {
  const date = dateFromAny(value);
  const start = dateFromAny(startIso);
  const end = dateFromAny(endIso);
  if (!date || !start || !end) return true;
  return date >= start && date <= end;
}

function linePoints(values, max = 100, width = 560, height = 190) {
  if (values.length <= 1) {
    const value = values[0] || 0;
    return `0,${Math.round(height - (value / max) * height)} ${width},${Math.round(height - (value / max) * height)}`;
  }
  const step = width / (values.length - 1);
  return values.map((value, index) => `${Math.round(index * step)},${Math.round(height - (value / max) * height)}`).join(" ");
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function isoDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function shortDateLabel(date) {
  return `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function financeAmountParts(operation = {}) {
  const amount = Math.abs(Number(operation.amount) || 0);
  if (!amount) return { income: 0, expenses: 0 };
  if (operation.type === "Витрата" || Number(operation.amount) < 0) return { income: 0, expenses: amount };
  if (operation.type === "Надходження") return { income: amount, expenses: 0 };
  return { income: 0, expenses: 0 };
}

function financeLineChartData(operations, startIso, endIso, scale = "days") {
  const start = dateFromAny(startIso) || new Date();
  const end = dateFromAny(endIso) || start;
  const buckets = [];
  if (scale === "weeks") {
    let cursor = new Date(start);
    while (cursor <= end) {
      const bucketStart = new Date(cursor);
      const bucketEnd = addDays(bucketStart, 6);
      if (bucketEnd > end) bucketEnd.setTime(end.getTime());
      buckets.push({
        key: isoDate(bucketStart),
        start: bucketStart,
        end: bucketEnd,
        label: bucketStart.getTime() === bucketEnd.getTime()
          ? shortDateLabel(bucketStart)
          : `${shortDateLabel(bucketStart)}-${shortDateLabel(bucketEnd)}`,
        income: 0,
        expenses: 0
      });
      cursor = addDays(bucketEnd, 1);
    }
  } else {
    let cursor = new Date(start);
    while (cursor <= end) {
      buckets.push({
        key: isoDate(cursor),
        start: new Date(cursor),
        end: new Date(cursor),
        label: shortDateLabel(cursor),
        income: 0,
        expenses: 0
      });
      cursor = addDays(cursor, 1);
    }
  }
  operations.forEach((operation) => {
    const date = dateFromAny(operation.date);
    if (!date) return;
    const bucket = buckets.find((item) => date >= item.start && date <= item.end);
    if (!bucket) return;
    const parts = financeAmountParts(operation);
    bucket.income += parts.income;
    bucket.expenses += parts.expenses;
  });
  const values = {
    income: buckets.map((item) => item.income),
    expenses: buckets.map((item) => item.expenses),
    profit: buckets.map((item) => Math.max(item.income - item.expenses, 0))
  };
  const max = Math.max(1, ...values.income, ...values.expenses, ...values.profit);
  return {
    labels: buckets.map((item) => item.label),
    values,
    axis: [0, 0.25, 0.5, 0.75, 1].map((ratio) => Math.round(max * ratio)),
    max,
    hasData: operations.some((operation) => financeAmountParts(operation).income || financeAmountParts(operation).expenses)
  };
}

function financeDonutStyle(items = []) {
  const values = items
    .map((item) => ({ color: item[2], value: Number(item[3]) || 0 }))
    .filter((item) => item.value > 0);
  const total = values.reduce((sum, item) => sum + item.value, 0);
  if (!total) return "";
  let cursor = 0;
  const segments = values.map((item, index) => {
    const start = cursor;
    const end = index === values.length - 1 ? 100 : cursor + (item.value / total) * 100;
    cursor = end;
    return `${item.color} ${start.toFixed(2)}% ${end.toFixed(2)}%`;
  });
  return `style="background: conic-gradient(${segments.join(", ")});"`;
}

function financeOperations(state) {
  state.financeOperations = state.financeOperations || [];
  return buildFinanceOperations(state);
}

function isDemoDataDisabled(state) {
  return shouldUseApi(state) && state.demoDataStatus?.enabled === false;
}

function salaryRows(state) {
  state.salaryRows = state.salaryRows || [];
  state.deletedSalaryIds = state.deletedSalaryIds || [];
  const deleted = new Set(state.deletedSalaryIds);
  const baseRows = isDemoDataDisabled(state) ? [] : SALARY_ROWS.map((row, index) => ({
    id: `salary-base-${index}`,
    custom: false,
    ...row
  }));
  return [...state.salaryRows, ...baseRows].filter((row) => !deleted.has(row.id));
}

function statusPillTone(status) {
  return status === "Готово" || status === "Виплачено" ? "green" : "amber";
}

function filteredSalaryRows(state) {
  const selected = state.salaryFilter || "all";
  return salaryRows(state).filter((row) => selected === "all" || row.name === selected);
}

function findSalaryRow(state, salaryId) {
  return salaryRows(state).find((row) => row.id === salaryId);
}

function findFinanceOperation(state, operationId) {
  return financeOperations(state).find((item) => item.id === operationId);
}

function financeActionForOperation(operation = {}) {
  if (operation.type === "Витрата") return "expense";
  if (operation.type === "Рахунок") return "invoice";
  if (operation.type === "Акт") return "act";
  return "income";
}

async function saveFinanceCaseState(ctx, item) {
  const { state, showToast } = ctx;
  if (!item || !shouldUseApi(state)) return true;
  try {
    Object.assign(item, normalizeCase(await saveCaseToApi(item)));
    return true;
  } catch (_error) {
    showToast("Не вдалося зберегти фінанси справи в базі.", "danger");
    return false;
  }
}

function salaryTotals(rows) {
  return rows.reduce((totals, row) => ({
    base: totals.base + row.base,
    bonus: totals.bonus + row.bonus,
    total: totals.total + row.total
  }), { base: 0, bonus: 0, total: 0 });
}

function salaryHistoryValues(rows) {
  if (!rows.length) {
    return SALARY_MONTHS.map((month) => ({ month, value: 0 }));
  }
  const average = rows.length ? Math.round(rows.reduce((sum, row) => sum + row.total, 0) / rows.length) : 0;
  const fallback = average || 45000;
  return SALARY_MONTHS.map((month, index) => ({
    month,
    value: Math.round(fallback * (0.88 + ((index % 5) * 0.04)))
  }));
}

function salaryEmployeeOptions(state) {
  const employees = new Map();
  const demoSalaryRows = isDemoDataDisabled(state) ? [] : SALARY_ROWS;
  [...(state.settingsUsers || []), ...salaryRows(state), ...demoSalaryRows].forEach((item) => {
    const name = item.name;
    const role = item.role || "Співробітник";
    if (name && !employees.has(name)) employees.set(name, role);
  });
  return [...employees.entries()].map(([name, role]) => ({ name, role }));
}

function operationMatchesTab(operation, tab) {
  if (tab === "payments") return ["Надходження", "Витрата"].includes(operation.type);
  if (tab === "invoices") return operation.type === "Рахунок";
  if (tab === "acts") return operation.type === "Акт";
  if (tab === "clients") return operation.status === "Частково" || operation.status === "Очікується";
  return true;
}

function operationMatchesPaymentMode(operation, mode = "all") {
  if (mode === "income") return operation.type === "Надходження";
  if (mode === "expense") return operation.type === "Витрата";
  return true;
}

function financeOperationCaseLabel(state, caseId) {
  const item = state.cases.find((entry) => entry.id === caseId);
  return item ? `№${item.id} · ${item.title || "Без назви"}` : `№${caseId}`;
}

function financeOperationFilterOptions(state, operations) {
  const clients = new Map();
  const casesByClient = new Map();
  operations.forEach((operation) => {
    const client = operation.client || "Клієнт не вказаний";
    if (!clients.has(client)) clients.set(client, 0);
    clients.set(client, clients.get(client) + 1);
    if (!operation.caseId) return;
    if (!casesByClient.has(client)) casesByClient.set(client, new Map());
    const caseMap = casesByClient.get(client);
    if (!caseMap.has(operation.caseId)) {
      caseMap.set(operation.caseId, {
        id: operation.caseId,
        label: financeOperationCaseLabel(state, operation.caseId),
        count: 0
      });
    }
    caseMap.get(operation.caseId).count += 1;
  });
  return {
    clients: [...clients.entries()].sort((a, b) => a[0].localeCompare(b[0], "uk")),
    casesByClient
  };
}

function operationMatchesFinanceFilters(operation, state) {
  const query = (state.financeQuery || "").trim().toLowerCase();
  const clientFilter = state.financeOperationClientFilter || "all";
  const caseFilter = state.financeOperationCaseFilter || "all";
  if (clientFilter !== "all" && operation.client !== clientFilter) return false;
  if (caseFilter !== "all" && operation.caseId !== caseFilter) return false;
  if (!query) return true;
  return [
    operation.date,
    operation.type,
    operation.title,
    operation.client,
    operation.caseId ? `№${operation.caseId}` : "",
    operation.amount,
    operation.status,
    operation.method
  ].some((value) => String(value || "").toLowerCase().includes(query));
}

function financeOperationFilters(state, operations, icon) {
  const options = financeOperationFilterOptions(state, operations);
  const selectedClient = state.financeOperationClientFilter || "all";
  const selectedCase = state.financeOperationCaseFilter || "all";
  const caseGroups = [...options.casesByClient.entries()]
    .filter(([client]) => selectedClient === "all" || client === selectedClient)
    .sort((a, b) => a[0].localeCompare(b[0], "uk"));
  return `
    <div class="finance-operation-filters">
      <label class="finance-operation-search">
        ${icon("search")}
        <input type="search" data-finance-operation-search value="${escapeHtml(state.financeQuery || "")}" placeholder="Пошук операції, клієнта, справи...">
      </label>
      <label class="finance-filter-field">
        <select data-finance-operation-client aria-label="Фільтр за клієнтом">
          <option value="all" ${selectedClient === "all" ? "selected" : ""}>Усі клієнти</option>
          ${options.clients.map(([client, count]) => `<option value="${escapeHtml(client)}" ${selectedClient === client ? "selected" : ""}>${escapeHtml(client)} · ${count}</option>`).join("")}
        </select>
      </label>
      <label class="finance-filter-field">
        <select data-finance-operation-case aria-label="Фільтр за справою">
          <option value="all" ${selectedCase === "all" ? "selected" : ""}>Усі справи</option>
          ${caseGroups.map(([client, caseMap]) => `
            <optgroup label="${escapeHtml(client)}">
              ${[...caseMap.values()].sort((a, b) => a.label.localeCompare(b.label, "uk")).map((item) => (
                `<option value="${escapeHtml(item.id)}" ${selectedCase === item.id ? "selected" : ""}>${escapeHtml(item.label)} · ${item.count}</option>`
              )).join("")}
            </optgroup>
          `).join("")}
        </select>
      </label>
      <button class="secondary compact" type="button" data-finance-operation-reset>${icon("refresh")} Скинути</button>
    </div>
  `;
}

function financeCaseStatusKey(item) {
  if ((Number(item.debt) || 0) > 0) return "debt";
  if ((Number(item.total) || 0) > 0 || (Number(item.paid) || 0) > 0) return "paid";
  return "empty";
}

function financeCaseMatchesFilters(item, query, statusFilter = "all") {
  const status = financeCaseStatusKey(item);
  if (statusFilter !== "all" && status !== statusFilter) return false;
  const cleanQuery = String(query || "").trim().toLowerCase();
  if (!cleanQuery) return true;
  return [
    item.id,
    `№${item.id}`,
    item.title,
    item.client,
    item.financeStatus,
    item.total,
    item.paid,
    item.debt
  ].some((value) => String(value || "").toLowerCase().includes(cleanQuery));
}

function financeCaseWorkspaceFilters(state, icon, rows) {
  const query = state.financeCaseQuery || "";
  const status = state.financeCaseStatusFilter || "all";
  const counts = rows.reduce((acc, item) => {
    const key = financeCaseStatusKey(item);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  return `
    <div class="finance-operation-filters finance-case-filters">
      <label class="finance-operation-search">
        ${icon("search")}
        <input type="search" data-finance-case-search value="${escapeHtml(query)}" placeholder="Пошук справи, клієнта, суми...">
      </label>
      <label class="finance-filter-field">
        <select data-finance-case-status aria-label="Фільтр справ за статусом">
          <option value="all" ${status === "all" ? "selected" : ""}>Усі статуси · ${rows.length}</option>
          <option value="debt" ${status === "debt" ? "selected" : ""}>Є борг · ${counts.debt || 0}</option>
          <option value="paid" ${status === "paid" ? "selected" : ""}>Оплачено · ${counts.paid || 0}</option>
          <option value="empty" ${status === "empty" ? "selected" : ""}>Не виставлено · ${counts.empty || 0}</option>
        </select>
      </label>
      <button class="secondary compact" type="button" data-finance-case-reset>${icon("refresh")} Скинути</button>
    </div>
  `;
}

function financeClientDebtFilters(state, icon, debtRows) {
  const query = state.financeClientDebtQuery || "";
  const status = state.financeClientDebtStatusFilter || "all";
  const counts = debtRows.reduce((acc, item) => {
    const key = item.paid > 0 ? "partial" : "waiting";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  return `
    <div class="finance-operation-filters finance-client-debt-filters">
      <label class="finance-operation-search">
        ${icon("search")}
        <input type="search" data-finance-client-debt-search value="${escapeHtml(query)}" placeholder="Пошук клієнта, справи, боргу...">
      </label>
      <label class="finance-filter-field">
        <select data-finance-client-debt-status aria-label="Фільтр боргів">
          <option value="all" ${status === "all" ? "selected" : ""}>Усі борги · ${debtRows.length}</option>
          <option value="partial" ${status === "partial" ? "selected" : ""}>Частково оплачено · ${counts.partial || 0}</option>
          <option value="waiting" ${status === "waiting" ? "selected" : ""}>Очікує оплату · ${counts.waiting || 0}</option>
        </select>
      </label>
      <button class="secondary compact" type="button" data-finance-client-debt-reset>${icon("refresh")} Скинути</button>
    </div>
  `;
}

function financePaymentModeControl(state) {
  const modes = [
    ["income", "Надходження"],
    ["all", "Усі платежі"],
    ["expense", "Витрати"]
  ];
  const selected = state.financePaymentMode || "all";
  return `
    <div class="finance-payment-mode" role="group" aria-label="Режим платежів">
      ${modes.map(([mode, label]) => `
        <button class="${selected === mode ? "active" : ""}" type="button" data-finance-payment-mode="${mode}">${label}</button>
      `).join("")}
    </div>
  `;
}

function closeFinanceSelectMenus(root, except = null) {
  root.querySelectorAll(".finance-filter-field .document-custom-select.is-open, .finance-action-select-field .document-custom-select.is-open, .salary-select-field .document-custom-select.is-open").forEach((shell) => {
    if (shell === except) return;
    shell.classList.remove("is-open");
    shell.querySelector(".document-custom-select-button")?.setAttribute("aria-expanded", "false");
    const menu = shell.querySelector(".document-custom-select-menu");
    if (menu) menu.hidden = true;
  });
}

function financeSelectOptionButton(option, select) {
  return `
    <button class="document-custom-select-option ${option.value === select.value ? "is-selected" : ""}" type="button" role="option" data-value="${escapeHtml(option.value)}" aria-selected="${option.value === select.value ? "true" : "false"}">
      <span aria-hidden="true">✓</span>
      <strong>${escapeHtml(option.textContent || "")}</strong>
    </button>
  `;
}

function syncFinanceCustomSelect(select) {
  const shell = select.nextElementSibling?.classList?.contains("document-custom-select")
    ? select.nextElementSibling
    : null;
  if (!shell) return;
  const selected = select.selectedOptions?.[0] || select.options[0];
  const buttonText = shell.querySelector("[data-document-select-value]");
  const menu = shell.querySelector(".document-custom-select-menu");
  if (buttonText) buttonText.textContent = selected?.textContent || "";
  if (!menu) return;
  menu.innerHTML = [...select.children].map((child) => {
    if (child.tagName === "OPTGROUP") {
      return `
        <div class="document-custom-select-group">${escapeHtml(child.label || "")}</div>
        ${[...child.children].map((option) => financeSelectOptionButton(option, select)).join("")}
      `;
    }
    return financeSelectOptionButton(child, select);
  }).join("");
}

function syncFinanceActionModeButtons(form) {
  const action = form.elements.action?.value || "income";
  form.querySelectorAll("[data-finance-action-choice]").forEach((button) => {
    button.classList.toggle("active", button.dataset.financeActionChoice === action);
  });
}

function setNativeSelectOptions(select, options, value) {
  if (!select) return;
  select.innerHTML = options.map((option) => `<option>${escapeHtml(option)}</option>`).join("");
  select.value = options.includes(value) ? value : options[0] || "";
  syncFinanceCustomSelect(select);
}

function addDaysIso(value, days) {
  const date = dateFromAny(value) || dateFromAny(isoToday()) || new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function workPeriodLabel(value) {
  const date = dateFromAny(value) || dateFromAny(isoToday()) || new Date();
  const months = ["січень", "лютий", "березень", "квітень", "травень", "червень", "липень", "серпень", "вересень", "жовтень", "листопад", "грудень"];
  return `${months[date.getMonth()]} ${date.getFullYear()}`;
}

function financeDocumentNumber(action) {
  const prefix = action === "act" ? "АКТ" : "РХ";
  return `${prefix}-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
}

function setFinanceActionMode(ctx, action, operation = null) {
  const { state, caseById, currencyText } = ctx;
  const form = document.querySelector("#finance-action-form");
  const config = FINANCE_ACTIONS[action];
  if (!form || !config) return;
  const selected = caseById(form.elements.caseId.value) || caseById(state.selectedFinanceCaseId) || state.cases[0];
  const selectedDebt = selected?.debt || selected?.income || 20000;
  const isInvoice = action === "invoice";
  const isAct = action === "act";
  const isDocumentAction = isInvoice || isAct;
  const labels = {
    income: {
      title: "Призначення платежу",
      titlePlaceholder: "Наприклад: Оплата за правову допомогу",
      titleHelp: "Фактичне надходження зменшує борг клієнта по вибраній справі.",
      amount: "Сума надходження",
      date: "Дата оплати",
      status: "Статус платежу",
      method: "Спосіб оплати",
      commentPlaceholder: "Коротке пояснення для історії справи"
    },
    expense: {
      title: "Категорія / опис витрати",
      titlePlaceholder: "Наприклад: Судові витрати",
      titleHelp: "Витрата прив'язується до справи, але не збільшує борг клієнта.",
      amount: "Сума витрати",
      date: "Дата витрати",
      status: "Статус витрати",
      method: "Спосіб оплати",
      commentPlaceholder: "Наприклад: судовий збір або поштова відправка"
    },
    invoice: {
      title: "Послуги / опис рахунку",
      titlePlaceholder: "Наприклад: Рахунок за правову допомогу",
      titleHelp: "Рахунок створює очікуване надходження і документ у справі.",
      amount: "Сума рахунку",
      date: "Дата рахунку",
      status: "Статус рахунку",
      method: "Канал документа",
      commentPlaceholder: "Що включено у рахунок або як його потрібно відправити"
    },
    act: {
      title: "Опис виконаних робіт",
      titlePlaceholder: "Наприклад: Акт виконаних робіт",
      titleHelp: "Акт фіксує виконані послуги і створює документ у справі.",
      amount: "Сума за актом",
      date: "Дата акта",
      status: "Статус акта",
      method: "Канал документа",
      commentPlaceholder: "Коротко опишіть виконані роботи"
    }
  }[action];
  const statusOptions = isInvoice
    ? ["Чернетка", "Виставлено", "Подано", "Очікується", "Частково", "Оплачено", "Скасовано"]
    : isAct
      ? ["Чернетка", "Подано", "На підпис", "Підписано", "Скасовано"]
      : ["Оплачено", "Частково", "Очікується", "Чернетка"];
  const methodOptions = isDocumentAction
    ? ["Документ", "ONLYOFFICE", "PDF", "Email"]
    : ["Банківський переказ", "Картка", "Готівка", "Документ"];
  form.elements.action.value = action;
  document.querySelector("#finance-action-title").textContent = operation ? `Редагувати: ${operation.title}` : config.title;
  document.querySelector("#finance-action-hint").textContent = config.hint;
  document.querySelector("#finance-action-submit").textContent = operation ? "Зберегти зміни" : config.submit;
  form.elements.title.value = operation?.title || config.defaultTitle;
  form.elements.amount.value = operation ? Math.abs(Number(operation.amount) || 0) : action === "expense" ? 5000 : selectedDebt;
  setNativeSelectOptions(form.elements.status, statusOptions, operation?.status || config.status);
  setNativeSelectOptions(form.elements.method, methodOptions, operation?.method || config.method);
  form.elements.comment.value = operation?.comment || (action === "invoice"
    ? `Рахунок буде додано у документи справи. Поточний борг: ${currencyText(selected?.debt || 0)}.`
    : "");
  const titleField = document.querySelector("#finance-action-title-field");
  const amountField = document.querySelector("#finance-action-amount-field");
  const dateField = document.querySelector("#finance-action-date-field");
  const statusField = form.elements.status?.closest("label");
  const methodField = form.elements.method?.closest("label");
  const titleHelp = document.querySelector("#finance-action-title-help");
  const documentFields = document.querySelector("#finance-action-document-fields");
  const dueField = document.querySelector("#finance-action-due-field");
  const periodField = document.querySelector("#finance-action-period-field");
  const numberField = document.querySelector("#finance-action-number-field");
  const documentNote = document.querySelector("#finance-action-document-note");
  if (titleField) titleField.childNodes[0].textContent = labels.title;
  if (amountField) amountField.childNodes[0].textContent = labels.amount;
  if (dateField) dateField.childNodes[0].textContent = labels.date;
  if (statusField) statusField.childNodes[0].textContent = labels.status;
  if (methodField) methodField.childNodes[0].textContent = labels.method;
  if (titleHelp) titleHelp.textContent = labels.titleHelp;
  form.elements.title.placeholder = labels.titlePlaceholder;
  form.elements.comment.placeholder = labels.commentPlaceholder;
  if (documentFields) documentFields.hidden = !isDocumentAction;
  if (dueField) dueField.hidden = !isInvoice;
  if (periodField) periodField.hidden = !isAct;
  if (numberField) numberField.childNodes[0].textContent = isAct ? "Номер акта" : "Номер рахунку";
  if (isDocumentAction) {
    form.elements.documentNumber.value = operation?.documentNumber || form.elements.documentNumber.value || financeDocumentNumber(action);
    form.elements.documentDue.value = form.elements.documentDue.value || addDaysIso(form.elements.date.value || isoToday(), 7);
    form.elements.workPeriod.value = form.elements.workPeriod.value || workPeriodLabel(form.elements.date.value || isoToday());
    form.elements.documentTemplate.value = form.elements.documentTemplate.value || "Основний шаблон";
    if (documentNote) {
      documentNote.textContent = isInvoice
        ? "Буде створено документ-рахунок у папці «Фінансові документи» цієї справи."
        : "Буде створено акт виконаних робіт у папці «Фінансові документи» цієї справи.";
    }
  } else {
    form.elements.documentNumber.value = "";
    form.elements.documentDue.value = "";
    form.elements.workPeriod.value = "";
  }
  syncFinanceActionModeButtons(form);
  form.querySelectorAll(".finance-action-select-field > select").forEach(syncFinanceCustomSelect);
}

function setupFinanceCustomSelects(root) {
  root.querySelectorAll(".finance-filter-field > select, .finance-action-select-field > select, .finance-action-case-field:not(.is-locked) > select, .salary-select-field > select").forEach((select) => {
    select.classList.add("document-native-select");
    select.tabIndex = -1;
    select.setAttribute("aria-hidden", "true");
    let shell = select.nextElementSibling?.classList?.contains("document-custom-select")
      ? select.nextElementSibling
      : null;
    if (!shell) {
      shell = document.createElement("div");
      const isModalSelect = Boolean(select.closest(".finance-action-select-field, .finance-action-case-field"))
        || Boolean(select.closest(".salary-select-field") && !select.closest(".salary-filter-field"));
      shell.className = `document-custom-select ${isModalSelect ? "finance-modal-select" : "finance-filter-select"}`;
      shell.innerHTML = `
        <button class="document-custom-select-button" type="button" aria-haspopup="listbox" aria-expanded="false">
          <span data-document-select-value></span>
          <span class="document-custom-select-chevron" aria-hidden="true"></span>
        </button>
        <div class="document-custom-select-menu" role="listbox" hidden></div>
      `;
      select.insertAdjacentElement("afterend", shell);
      shell.querySelector(".document-custom-select-button")?.addEventListener("click", () => {
        const isOpen = shell.classList.contains("is-open");
        closeFinanceSelectMenus(root, isOpen ? null : shell);
        shell.classList.toggle("is-open", !isOpen);
        shell.querySelector(".document-custom-select-button")?.setAttribute("aria-expanded", String(!isOpen));
        const menu = shell.querySelector(".document-custom-select-menu");
        if (menu) menu.hidden = isOpen;
      });
      shell.querySelector(".document-custom-select-menu")?.addEventListener("click", (event) => {
        const optionButton = event.target.closest(".document-custom-select-option");
        if (!optionButton) return;
        select.value = optionButton.dataset.value || "";
        select.dispatchEvent(new Event("change", { bubbles: true }));
        syncFinanceCustomSelect(select);
        closeFinanceSelectMenus(root);
      });
    }
    syncFinanceCustomSelect(select);
  });
  if (!root.dataset.financeCustomSelectsBound) {
    root.dataset.financeCustomSelectsBound = "true";
    root.addEventListener("click", (event) => {
      if (event.target.closest(".finance-filter-field .document-custom-select, .finance-action-select-field .document-custom-select, .salary-select-field .document-custom-select")) return;
      closeFinanceSelectMenus(root);
    });
    root.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeFinanceSelectMenus(root);
    });
  }
}

function financeTotals(rows, operations, state) {
  return financeTotalsFromData(rows, operations, state);
}

function kpiCard({ title, value, trend, detail = "порівняно з попер. періодом", iconName, tone, trendTone = "" }, icon) {
  return `
    <article class="finance-kpi-card">
      <span>${title}</span>
      <strong>${value}</strong>
      <em class="${trendTone}">${trend}</em>
      <small>${detail}</small>
      <i class="${tone}">${icon(iconName)}</i>
    </article>
  `;
}

function operationRows(operations, badge, icon, options = {}) {
  const { menuId = "", showActions = true, clickable = false, selectedId = "", caseTree = false } = options;
  if (!operations.length) {
    return `<div class="finance-operation-empty">Фінансових операцій за обраний період не знайдено.</div>`;
  }
  const grouped = operations.reduce((groups, item) => {
    const client = item.client || "Клієнт не вказаний";
    if (!groups.has(client)) groups.set(client, []);
    groups.get(client).push(item);
    return groups;
  }, new Map());
  return [...grouped.entries()].map(([client, items]) => {
    const rowsHtml = caseTree
      ? financeOperationCaseTreeRows(items, badge, icon, { menuId, showActions, clickable, selectedId })
      : items.map((item) => financeOperationRow(item, badge, icon, { menuId, showActions, clickable, selectedId })).join("");
    return `
    <div class="finance-operation-client-group">
      <div class="finance-operation-client-cell">
        <strong>${escapeHtml(client)}</strong>
        <small>${items.length} ${items.length === 1 ? "операція" : "операції"}</small>
      </div>
      <div class="finance-operation-client-rows">${rowsHtml}</div>
    </div>
  `;
  }).join("");
}

function financeOperationCaseTreeRows(items, badge, icon, options = {}) {
  const { menuId = "", showActions = true, clickable = false, selectedId = "" } = options;
  const grouped = items.reduce((groups, item) => {
    const caseKey = item.caseId || "none";
    if (!groups.has(caseKey)) groups.set(caseKey, []);
    groups.get(caseKey).push(item);
    return groups;
  }, new Map());
  return [...grouped.entries()].map(([caseId, caseItems]) => `
    <div class="finance-operation-case-group">
      <div class="finance-operation-case-cell">
        ${caseId !== "none"
          ? `<button class="case-link-button" type="button" data-finance-open-case="${escapeHtml(caseId)}">№${escapeHtml(caseId)}</button>`
          : `<span class="muted">Без справи</span>`}
        <small>${caseItems.length} ${caseItems.length === 1 ? "дія" : "дії"}</small>
      </div>
      <div class="finance-operation-case-rows">
        ${caseItems.map((item) => financeOperationRow(item, badge, icon, { menuId, showActions, clickable, selectedId, tree: true })).join("")}
      </div>
    </div>
  `).join("");
}

function financeOperationRow(item, badge, icon, options = {}) {
  const { menuId = "", showActions = true, clickable = false, selectedId = "", tree = false } = options;
  const statusTone = item.status === "Частково"
      ? "red"
      : item.status === "Очікується"
        ? "amber"
        : item.status === "Чернетка"
          ? "blue"
          : "green";
  const amountText = item.amount
    ? `${item.amount < 0 ? "-" : ""}${new Intl.NumberFormat("uk-UA").format(Math.abs(item.amount))} грн`
    : "Документ";
  const hasLinkedDocumentAction = Boolean(item.documentId);
  const caseCell = item.caseId
    ? `<button class="case-link-button" type="button" data-finance-open-case="${item.caseId}">№${item.caseId}</button>`
    : `<span class="muted">Без справи</span>`;
  return `
    <div class="finance-operation-row ${tree ? "is-case-tree" : ""} ${clickable ? "is-clickable" : ""} ${selectedId === item.id ? "is-selected" : ""}" ${clickable ? `role="button" tabindex="0" data-finance-select-operation="${escapeHtml(item.id)}" data-finance-open-operation="${escapeHtml(item.id)}"` : ""}>
      <span>${item.date}</span>
      ${tree ? "" : caseCell}
      <strong class="${item.type === "Витрата" ? "danger" : "success"}">${item.type}</strong>
      <span>${item.title}</span>
      <b class="${item.amount < 0 ? "danger" : ""}">${amountText}</b>
      ${badge(item.status, statusTone)}
      <span>${item.method}</span>
      ${showActions ? `<div class="finance-action-cell">
        <button class="icon-button finance-row-menu ${menuId === item.id ? "is-open" : ""}" type="button" data-finance-operation-menu="${item.id}" aria-expanded="${menuId === item.id}" title="Дії">⋮</button>
        ${menuId === item.id ? `
          <div class="salary-row-menu finance-operation-menu">
            ${hasLinkedDocumentAction ? `<button type="button" data-finance-operation-document="${item.id}">${icon("file")} До документа</button>` : ""}
            <button type="button" data-finance-operation-edit="${item.id}">${icon("edit")} Редагувати</button>
            <button class="danger" type="button" data-finance-operation-delete="${item.id}">${icon("trash")} Видалити</button>
          </div>
        ` : ""}
      </div>` : ""}
    </div>
  `;
}

function financeOperationDetailCard(operation, icon, badge, currencyText) {
  if (!operation) return "";
  const statusTone = operation.status === "Частково"
    ? "red"
    : operation.status === "Очікується"
      ? "amber"
      : operation.status === "Чернетка"
        ? "blue"
        : "green";
  const amountText = operation.amount
    ? `${operation.amount < 0 ? "-" : ""}${new Intl.NumberFormat("uk-UA").format(Math.abs(operation.amount))} грн`
    : currencyText(0);
  return `
    <article class="panel finance-selected-operation-card">
      <div class="toolbar">
        <h2>Операція</h2>
        <span>${operation.type}</span>
      </div>
      <strong>${escapeHtml(operation.title || "Фінансова операція")}</strong>
      <div><span>Дата</span><b>${operation.date || "-"}</b></div>
      <div><span>Клієнт</span><b>${escapeHtml(operation.client || "Не вказано")}</b></div>
      <div><span>Справа</span>${operation.caseId ? `<button class="case-link-button" type="button" data-finance-open-case="${operation.caseId}">№${operation.caseId}</button>` : "<b>Без справи</b>"}</div>
      <div><span>Сума</span><b class="${operation.amount < 0 ? "danger" : ""}">${amountText}</b></div>
      <div><span>Статус</span>${badge(operation.status, statusTone)}</div>
      <div><span>Спосіб</span><b>${escapeHtml(operation.method || "-")}</b></div>
      <button class="secondary compact" type="button" data-finance-open-operation="${escapeHtml(operation.id)}">${icon("file")} Відкрити в платежах</button>
    </article>
  `;
}

function barRows(rows, color = "#1f7ae0") {
  const max = Math.max(1, ...rows.map((item) => item[1]));
  return rows.map(([label, value]) => `
    <div class="finance-mini-bar">
      <span>${label}</span>
      <em><i style="width:${Math.round((value / max) * 100)}%; background:${color}"></i></em>
      <strong>${new Intl.NumberFormat("uk-UA").format(value)} грн</strong>
    </div>
  `).join("");
}

function expenseRows(rows) {
  return rows.map(([label, percent, amount]) => `
    <div class="finance-mini-bar">
      <span>${label}</span>
      <em><i style="width:${percent}%; background:#7c5ce8"></i></em>
      <strong>${percent}% (${amount})</strong>
    </div>
  `).join("");
}

function financeWorkspaceSummary(label, value, hint) {
  return `
    <div class="finance-workspace-metric">
      <span>${label}</span>
      <strong>${value}</strong>
      <small>${hint}</small>
    </div>
  `;
}

function financeCaseWorkspace(state, rows, currencyText, badge, icon) {
  const filteredRows = rows.filter((item) => financeCaseMatchesFilters(
    item,
    state.financeCaseQuery,
    state.financeCaseStatusFilter || "all"
  ));
  const pagination = paginateFinanceItems(state, "cases", filteredRows);
  return `
    <div class="finance-workspace-table case-finance-workspace">
      ${financeCaseWorkspaceFilters(state, icon, rows)}
      <div class="finance-workspace-head">
        <span>Справа</span><span>Клієнт</span><span>Договір</span><span>Оплачено</span><span>Борг</span><span>Статус</span><span></span>
      </div>
      ${pagination.items.length ? pagination.items.map((item) => `
        <div class="finance-workspace-row">
          <button class="case-link-button" type="button" data-finance-open-case="${item.id}">№${item.id}</button>
          <span>${item.client}</span>
          <strong>${currencyText(item.total)}</strong>
          <span>${currencyText(item.paid)}</span>
          <b class="${item.debt ? "danger" : ""}">${currencyText(item.debt)}</b>
          ${badge(item.financeStatus, item.debt ? "red" : "green")}
          <button class="secondary compact" type="button" data-finance-work-case="${item.id}">Відкрити</button>
        </div>
      `).join("") : `<div class="finance-operation-empty">Справ за цим фільтром немає.</div>`}
      ${financePaginationHtml(pagination, "справ")}
    </div>
  `;
}

function financeClientWorkspace(state, rows, currencyText, icon) {
  const debtRows = rows.filter((item) => item.debt > 0);
  if (!debtRows.length) {
    return `<div class="finance-operation-empty">Активних боргів немає.</div>`;
  }
  const query = String(state.financeClientDebtQuery || "").trim().toLowerCase();
  const statusFilter = state.financeClientDebtStatusFilter || "all";
  const filteredRows = debtRows.filter((item) => {
    const status = item.paid > 0 ? "partial" : "waiting";
    if (statusFilter !== "all" && status !== statusFilter) return false;
    if (!query) return true;
    return [
      item.id,
      `№${item.id}`,
      item.title,
      item.client,
      item.financeStatus,
      item.total,
      item.paid,
      item.debt
    ].some((value) => String(value || "").toLowerCase().includes(query));
  });
  const clients = new Map();
  filteredRows.forEach((item) => {
    const clientName = item.client || "Клієнт не вказаний";
    if (!clients.has(clientName)) {
      clients.set(clientName, {
        name: clientName,
        debt: 0,
        paid: 0,
        total: 0,
        cases: []
      });
    }
    const client = clients.get(clientName);
    client.debt += Number(item.debt) || 0;
    client.paid += Number(item.paid) || 0;
    client.total += Number(item.total) || 0;
    client.cases.push(item);
  });
  const clientGroups = [...clients.values()].sort((a, b) => b.debt - a.debt || a.name.localeCompare(b.name, "uk"));
  const pagination = paginateFinanceItems(state, "clients", clientGroups);
  return `
    <div class="finance-workspace-table finance-client-debt-workspace">
      ${financeClientDebtFilters(state, icon, debtRows)}
      <div class="finance-workspace-head">
        <span>Клієнт</span><span>Справи</span><span>Договір</span><span>Оплачено</span><span>Борг</span><span></span>
      </div>
      ${pagination.items.length ? pagination.items.map((client) => `
        <div class="finance-client-debt-group">
          <div class="finance-client-debt-cell">
            <strong>${escapeHtml(client.name)}</strong>
            <small>${client.cases.length} ${client.cases.length === 1 ? "справа" : "справ"} · борг ${currencyText(client.debt)}</small>
          </div>
          <div class="finance-client-debt-cases">
            ${client.cases.sort((a, b) => b.debt - a.debt || String(a.id).localeCompare(String(b.id), "uk")).map((item) => `
              <div class="finance-client-debt-row">
                <button class="case-link-button" type="button" data-finance-open-case="${item.id}">№${escapeHtml(item.id)}</button>
                <span>${escapeHtml(item.title || "Без назви")}</span>
                <strong>${currencyText(item.total)}</strong>
                <span>${currencyText(item.paid)}</span>
                <b class="danger">${currencyText(item.debt)}</b>
                <button class="secondary compact" type="button" data-finance-work-case="${item.id}">Відкрити</button>
              </div>
            `).join("")}
          </div>
        </div>
      `).join("") : `<div class="finance-operation-empty">Боргів за цим фільтром немає.</div>`}
    </div>
    ${financePaginationHtml(pagination, "клієнтів")}
  `;
}

function financeSalaryWorkspace(state, icon, currencyText) {
  const rows = filteredSalaryRows(state);
  const pagination = paginateFinanceItems(state, "salary", rows);
  const employees = salaryEmployeeOptions(state);
  const totals = salaryTotals(rows);
  const history = salaryHistoryValues(rows);
  const historyMax = Math.max(...history.map((item) => item.value), 1);
  const selectedEmployee = state.salaryFilter || "all";
  return `
    <div class="salary-toolbar">
      <label class="salary-select-field salary-filter-field">Співробітник
        <select data-salary-filter>
          <option value="all" ${selectedEmployee === "all" ? "selected" : ""}>Усі співробітники</option>
          ${employees.map((employee) => `
            <option value="${employee.name}" ${selectedEmployee === employee.name ? "selected" : ""}>${employee.name} · ${employee.role}</option>
          `).join("")}
        </select>
      </label>
      <div class="salary-toolbar-total">
        <span>${selectedEmployee === "all" ? "Загальний фонд" : "Фонд співробітника"}</span>
        <strong>${currencyText(totals.total)}</strong>
      </div>
      <button class="secondary compact" type="button" data-finance-salary-export>${icon("file")} Експорт відомості</button>
    </div>

    <div class="salary-history-card">
      <div>
        <span class="section-kicker">Динаміка за 12 місяців</span>
        <h3>${selectedEmployee === "all" ? "Нарахування команди" : selectedEmployee}</h3>
        <p>Ставка, бонуси та загальна сума для швидкої перевірки.</p>
      </div>
      <div class="salary-history-bars">
        ${history.map((item) => `
          <div class="salary-month">
            <span style="height: ${Math.max(18, Math.round((item.value / historyMax) * 76))}px"></span>
            <small>${item.month}</small>
          </div>
        `).join("")}
      </div>
      <div class="salary-history-total">
        <span>Середньомісячно</span>
        <strong>${currencyText(rows.length ? Math.round(totals.total / rows.length) : 0)}</strong>
      </div>
    </div>

    <div class="finance-workspace-table salary-workspace ${state.salaryMenuId ? "has-open-menu" : ""}">
      <div class="finance-workspace-head">
        <span>Співробітник</span><span>Роль</span><span>Ставка</span><span>Бонус</span><span>До виплати</span><span>Дата</span><span>Статус</span><span></span>
      </div>
      ${rows.length ? pagination.items.map((row) => `
        <div class="finance-workspace-row">
          <div class="salary-person">
            <strong>${row.name}</strong>
            <small>${row.comment || "Поточне нарахування"}</small>
          </div>
          <span>${row.role}</span>
          <span>${currencyText(row.base)}</span>
          <span>${currencyText(row.bonus)}</span>
          <b>${currencyText(row.total)}</b>
          <span>${row.date}</span>
          <span class="status-pill ${statusPillTone(row.status)}">${row.status}</span>
          <div class="salary-action-cell">
            <button class="icon-button finance-row-menu ${state.salaryMenuId === row.id ? "is-open" : ""}" type="button" aria-label="Дії зарплати" data-salary-menu="${row.id}" aria-expanded="${state.salaryMenuId === row.id}">⋮</button>
            ${state.salaryMenuId === row.id ? `
              <div class="salary-row-menu finance-operation-menu">
                <button type="button" data-salary-edit="${row.id}">${icon("edit")} Редагувати</button>
                <button type="button" data-salary-export-row="${row.id}">${icon("file")} Експорт</button>
                <button class="danger" type="button" data-salary-delete="${row.id}">${icon("trash")} Видалити</button>
              </div>
            ` : ""}
          </div>
        </div>
      `).join("") : `<div class="finance-operation-empty">Для обраного співробітника нарахувань немає.</div>`}
      ${financePaginationHtml(pagination, "нарахувань")}
    </div>
  `;
}

function financeReportsWorkspace(icon, totals, currencyText) {
  return `
    <div class="finance-report-grid">
      ${REPORT_ROWS.map(([title, text, format]) => `
        <article class="finance-report-card">
          <span>${icon("file")}</span>
          <strong>${title}</strong>
          <p>${text}</p>
          <button class="secondary compact" type="button" data-export-finance>${format}</button>
        </article>
      `).join("")}
    </div>
    <div class="finance-workspace-footer finance-report-total">
      <span>Поточний фінансовий результат</span>
      <strong>${currencyText(totals.profit)}</strong>
      <button class="primary" type="button" data-export-finance>${icon("file")} Експорт звіту</button>
    </div>
  `;
}

function financeWorkspace(ctx, rows, operations, visibleOperations, totals) {
  const { state, icon, badge, currencyText } = ctx;
  const meta = FINANCE_WORKSPACES[state.financeTab];
  const isCases = state.financeTab === "cases";
  const isClients = state.financeTab === "clients";
  const isSalary = state.financeTab === "salary";
  const isReports = state.financeTab === "reports";
  const isPayments = state.financeTab === "payments";
  const income = operations.filter((item) => item.type === "Надходження").reduce((sum, item) => sum + Math.max(item.amount, 0), 0);
  const expenses = Math.abs(operations.filter((item) => item.type === "Витрата").reduce((sum, item) => sum + item.amount, 0));
  const currentSalaryRows = isSalary ? filteredSalaryRows(state) : [];
  const currentSalaryTotals = isSalary ? salaryTotals(currentSalaryRows) : { base: 0, bonus: 0, total: 0 };
  const currentMeta = meta || {
    title: FINANCE_TABS.find(([tab]) => tab === state.financeTab)?.[1] || "Фінанси",
    subtitle: "Окремий фінансовий розділ з власними діями та записами.",
    action: "income",
    actionLabel: "Додати запис",
    empty: "Записів за обраний період немає."
  };
  const workspaceAction = isPayments && state.financePaymentMode === "expense" ? "expense" : currentMeta.action;
  const workspaceActionLabel = isPayments && state.financePaymentMode === "expense"
    ? "Додати витрату"
    : isPayments && state.financePaymentMode === "income"
      ? "Додати надходження"
      : currentMeta.actionLabel;
  const operationPagination = !isCases && !isClients && !isSalary && !isReports
    ? paginateFinanceItems(state, state.financeTab, visibleOperations)
    : null;
  const pageOperations = operationPagination?.items || visibleOperations;
  const debtClientCount = new Set(rows.filter((item) => item.debt > 0).map((item) => item.client || "Клієнт не вказаний")).size;

  return `
    <section class="panel finance-workspace-panel">
      <div class="finance-workspace-top">
        <div>
          <span class="section-kicker">Робочий розділ</span>
          <h2>${currentMeta.title}</h2>
          <p>${currentMeta.subtitle}</p>
        </div>
        <div class="finance-workspace-actions">
          <button class="secondary" type="button" data-finance-back-overview>${icon("calendar")} Повернутись до огляду</button>
          ${isSalary
            ? `<button class="primary" type="button" data-finance-salary-open>${icon("check")} Нарахувати зарплату</button>`
            : !isReports
              ? `<button class="primary" type="button" data-finance-work-action="${workspaceAction}">${workspaceActionLabel}</button>`
              : ""}
        </div>
      </div>

      <div class="finance-workspace-metrics">
        ${financeWorkspaceSummary(isCases ? "Справ" : isClients ? "Клієнтів" : "Записів", isCases ? rows.length : isClients ? debtClientCount : isSalary ? currentSalaryRows.length : isReports ? REPORT_ROWS.length : visibleOperations.length, "у цьому розділі")}
        ${financeWorkspaceSummary(isSalary ? "Ставка" : "Надходження", isSalary ? currencyText(currentSalaryTotals.base) : currencyText(income), isSalary ? "за вибраним фільтром" : "за вибраний період")}
        ${financeWorkspaceSummary(isSalary ? "Бонуси" : "Витрати", isSalary ? currencyText(currentSalaryTotals.bonus) : currencyText(expenses), isSalary ? "премії та доплати" : "за вибраний період")}
        ${financeWorkspaceSummary(isSalary ? "До виплати" : "Борг", isSalary ? currencyText(currentSalaryTotals.total) : currencyText(totals.debt), isSalary ? "поточний фонд" : "поточний контроль")}
      </div>

      ${isSalary
        ? financeSalaryWorkspace(state, icon, currencyText)
        : isReports
          ? financeReportsWorkspace(icon, totals, currencyText)
          : isCases
            ? financeCaseWorkspace(state, rows, currencyText, badge, icon)
            : isClients
              ? financeClientWorkspace(state, rows, currencyText, icon)
              : `
                <div class="finance-workspace-table is-operations ${isPayments ? "is-payments" : ""} ${state.financeOperationMenuId ? "has-open-menu" : ""}">
                  ${isPayments ? financePaymentModeControl(state) : ""}
                  ${financeOperationFilters(state, operations, icon)}
                  <div class="finance-operation-head is-tree">
                    <span>Клієнт</span><span>Справа</span><span>Дата</span><span>Тип</span><span>Назва / Опис</span><span>Сума</span><span>Статус</span><span>Спосіб оплати</span><span></span>
                  </div>
                  <div class="finance-operation-list is-tree">${visibleOperations.length ? operationRows(pageOperations, badge, icon, { menuId: state.financeOperationMenuId, selectedId: state.selectedFinanceOperationId, caseTree: true }) : `<div class="finance-operation-empty">${currentMeta.empty}</div>`}</div>
                  ${financePaginationHtml(operationPagination, financeOperationPaginationLabel(state.financeTab))}
                </div>
              `}
    </section>
  `;
}

function ensureFinanceFolder(item, caseFolders) {
  const folders = caseFolders(item);
  let folder = folders.find((entry) => entry.name === "Фінансові документи");
  if (!folder) {
    folder = { name: "Фінансові документи", updated: new Date().toLocaleDateString("uk-UA"), files: [] };
    folders.unshift(folder);
  }
  return folder;
}

function addFinanceDocument(ctx, item, action, amount, title, date, comment, apiDocument = null) {
  const { caseFolders, makeDocumentId } = ctx;
  const config = FINANCE_ACTIONS[action];
  const today = new Date().toLocaleDateString("uk-UA");
  const type = action === "invoice" ? "Рахунок" : "Акт";
  const documentId = apiDocument?.documentId || apiDocument?.id || makeDocumentId();
  const documentData = apiDocument
    ? {
      ...apiDocument,
      documentId,
      name: apiDocument.name || `${type}: ${title} · №${item.id}.docx`,
      type: apiDocument.type || type,
      status: apiDocument.status || (action === "invoice" ? "Подано" : "Чернетка"),
      submitted: date,
      responseDue: apiDocument.responseDue && apiDocument.responseDue !== "-" ? financeDate(apiDocument.responseDue) : "-",
      source: "Фінанси",
      added: today
    }
    : {
      documentId,
      name: `${type}: ${title} · №${item.id}.docx`,
      type,
      status: action === "invoice" ? "Подано" : "Чернетка",
      submitted: date,
      responseDue: "-",
      comment: `${comment || config.hint} Сума: ${new Intl.NumberFormat("uk-UA").format(amount)} грн.`,
      source: "Фінанси",
      added: today
    };
  const folder = ensureFinanceFolder(item, caseFolders);
  item.documents = (item.documents || []).filter((doc) => doc.documentId !== documentId);
  folder.files = (folder.files || []).filter((file) => file.documentId !== documentId);
  item.documents.unshift(documentData);
  folder.files.unshift({ ...documentData, updated: today });
  folder.updated = today;
  return documentData;
}

function removeFinanceDocumentFromCase(ctx, item, operation) {
  if (!item || !["Рахунок", "Акт"].includes(operation?.type)) return;
  const { caseFolders } = ctx;
  const documentId = operation.documentId || (operation.id?.startsWith("document-") ? operation.id.replace("document-", "") : "");
  const folders = caseFolders(item);
  const financeFolder = folders.find((folder) => folder.name === "Фінансові документи");
  const comparableTitle = String(operation.title || "").toLowerCase();
  const matchesDocument = (doc = {}) => {
    const id = String(doc.documentId || doc.id || "");
    const name = String(doc.name || doc.title || "").toLowerCase();
    return Boolean(documentId && id === String(documentId))
      || Boolean(operation.type === "Рахунок" && comparableTitle && name.includes(comparableTitle))
      || Boolean(operation.type === "Акт" && operation.id?.startsWith("document-") && id === operation.id.replace("document-", ""));
  };
  item.documents = (item.documents || []).filter((doc) => !matchesDocument(doc));
  if (financeFolder) {
    financeFolder.files = (financeFolder.files || []).filter((file) => !matchesDocument(file));
    financeFolder.updated = new Date().toLocaleDateString("uk-UA");
  }
}

function openFinanceActionDialog(ctx, action, operationId = "", options = {}) {
  const { state, caseById, clientById } = ctx;
  const config = FINANCE_ACTIONS[action];
  const form = document.querySelector("#finance-action-form");
  if (!config || !form) return;
  const operation = operationId ? findFinanceOperation(state, operationId) : null;
  const lockCase = Boolean(operation || options.lockCase);
  const showActionPicker = Boolean(options.showActionPicker && !operation);
  const selected = caseById(operation?.caseId || options.caseId || state.selectedFinanceCaseId) || state.cases[0];
  form.reset();
  form.elements.operationId.value = operation?.id || "";
  const actionMode = document.querySelector("#finance-action-mode");
  if (actionMode) actionMode.hidden = !showActionPicker;
  const deleteButton = document.querySelector("#finance-action-delete");
  if (deleteButton) {
    deleteButton.hidden = !operation;
    deleteButton.dataset.financeOperationDelete = operation?.id || "";
  }
  document.querySelector("#finance-action-case").innerHTML = state.cases.map((item) => {
    const client = clientById(item.clientId)?.name || "Клієнт не вказаний";
    return `<option value="${item.id}">№${item.id} · ${client}</option>`;
  }).join("");
  form.elements.caseId.value = operation?.caseId || selected?.id || state.cases[0]?.id || "";
  const caseField = form.querySelector(".finance-action-case-field");
  caseField?.classList.toggle("is-locked", lockCase);
  const selectedCase = caseById(form.elements.caseId.value);
  const selectedCaseClient = selectedCase ? clientById(selectedCase.clientId)?.name : "";
  const caseSummary = document.querySelector("#finance-action-case-summary");
  if (caseSummary) {
    caseSummary.textContent = selectedCase
      ? `№${selectedCase.id} · ${selectedCaseClient || "Клієнт не вказаний"}`
      : "Справу не вибрано";
  }
  form.elements.title.value = operation?.title || config.defaultTitle;
  form.elements.date.value = operation ? (dateFromAny(operation.date)?.toISOString().slice(0, 10) || isoToday()) : isoToday();
  setupFinanceCustomSelects(form);
  setFinanceActionMode(ctx, action, operation);
  document.querySelector("#finance-action-dialog").showModal();
}

async function applyFinanceAction(ctx, formData) {
  const {
    state,
    caseById,
    clientById,
    caseFinance,
    formatDate,
    currencyText,
    renderAll,
    switchView,
    showToast
  } = ctx;
  const action = formData.get("action");
  const config = FINANCE_ACTIONS[action];
  const item = caseById(formData.get("caseId"));
  const operationId = formData.get("operationId");
  const amount = Math.max(0, Number(formData.get("amount")) || 0);
  if (!config || !item || !amount) return;

  const finance = caseFinance(item);
  const dateIso = formData.get("date") || isoToday();
  const date = financeDate(dateIso);
  const title = formData.get("title") || config.defaultTitle;
  const status = formData.get("status") || config.status;
  const method = formData.get("method") || config.method;
  const rawComment = formData.get("comment") || "";
  const documentNumber = String(formData.get("documentNumber") || "").trim();
  const documentDue = String(formData.get("documentDue") || "").trim();
  const workPeriod = String(formData.get("workPeriod") || "").trim();
  const documentTemplate = String(formData.get("documentTemplate") || "").trim();
  const documentMeta = [];
  if (action === "invoice" || action === "act") {
    if (documentNumber) documentMeta.push(`Номер документа: ${documentNumber}`);
    if (action === "invoice" && documentDue) documentMeta.push(`Строк оплати: ${formatDate(documentDue)}`);
    if (action === "act" && workPeriod) documentMeta.push(`Період робіт: ${workPeriod}`);
    if (documentTemplate) documentMeta.push(`Шаблон: ${documentTemplate}`);
  }
  const comment = [rawComment, ...documentMeta].filter(Boolean).join("\n");
  const documentTitle = documentNumber ? `${documentNumber}: ${title}` : title;
  const today = new Date().toLocaleDateString("uk-UA");
  const client = clientById(item.clientId)?.name || "Клієнт не вказаний";
  const operation = {
    id: `finance-${Date.now()}`,
    date,
    type: config.operationType,
    title,
    caseId: item.id,
    client,
    amount: action === "expense" ? -amount : action === "act" ? 0 : amount,
    status,
    method,
    comment,
    documentNumber,
    documentDue,
    workPeriod,
    documentTemplate,
    custom: true
  };
  let apiResult = null;
  if (shouldUseApi(state)) {
    try {
      if (operationId) {
        await deleteFinanceOperationFromApi(operationId);
        state.financeOperations = (state.financeOperations || []).filter((item) => item.id !== operationId);
      }
      apiResult = await saveFinanceOperationToApi({
        ...operation,
        action,
        date: dateIso,
        amount,
        documentNumber,
        documentDue,
        workPeriod,
        documentTemplate,
        comment
      });
      Object.assign(operation, normalizeFinanceOperation(apiResult.operation || operation));
    } catch (_error) {
      showToast("Не вдалося зберегти фінансову операцію в базі.", "danger");
      return;
    }
  }

  state.financeOperations = state.financeOperations || [];
  if (operationId) state.financeOperations = state.financeOperations.filter((item) => item.id !== operationId);
  state.financeOperations.unshift(operation);

  if (action === "income") {
    const nextPaid = finance.paid + amount;
    const nextTotal = Math.max(finance.total, nextPaid);
    item.totalFee = nextTotal;
    item.income = nextTotal;
    item.paid = Math.min(nextPaid, nextTotal);
    item.debt = Math.max(nextTotal - item.paid, 0);
    item.firstPaymentDate = item.firstPaymentDate || formatDate(dateIso);
  }

  if (action === "invoice") {
    item.totalFee = finance.total + amount;
    item.income = item.totalFee;
    item.paid = finance.paid;
    item.debt = Math.max(item.totalFee - item.paid, 0);
    item.nextPaymentDue = item.nextPaymentDue || formatDate(documentDue || dateIso);
    operation.documentId = addFinanceDocument(ctx, item, action, amount, documentTitle, date, comment, apiResult?.document)?.documentId || operation.documentId || "";
  }

  if (action === "expense") {
    item.expenses = (item.expenses || 0) + amount;
  }

  if (action === "act") {
    operation.documentId = addFinanceDocument(ctx, item, action, amount, documentTitle, date, comment, apiResult?.document)?.documentId || operation.documentId || "";
  }

  item.financeComment = comment || item.financeComment || "";
  item.history.unshift({
    date: today,
    text: `${config.title}: ${title} на ${currencyText(amount)}.`
  });
  if (apiResult?.case) Object.assign(item, normalizeCase(apiResult.case));
  state.selectedCaseId = item.id;
  state.selectedFinanceCaseId = item.id;
  state.financeTab = config.tab;
  if (config.tab === "payments") state.financePaymentMode = action === "expense" ? "expense" : "income";
  state.documentCaseFilter = item.id;
  document.querySelector("#finance-action-dialog")?.close();
  renderAll();
  switchView("finance");
  showToast(action === "invoice" || action === "act"
    ? `${config.title} створено і додано до документів справи.`
    : `${config.title} збережено у фінансах справи.`);
}

async function deleteFinanceOperation(ctx, operationId) {
  const { state, caseById, renderAll, switchView, showToast } = ctx;
  const operation = findFinanceOperation(state, operationId);
  if (!operation) return;
  const item = caseById(operation.caseId);

  if (operation.generated && item) {
    const amount = Math.abs(Number(operation.amount) || 0);
    if (operation.id.startsWith("case-income-")) {
      item.paid = Math.max(0, (Number(item.paid) || 0) - amount);
      item.debt = Math.max((Number(item.income || item.totalFee) || 0) - item.paid, 0);
    } else if (operation.id.startsWith("case-invoice-")) {
      item.totalFee = Number(item.paid) || 0;
      item.income = item.totalFee;
      item.debt = 0;
      item.nextPaymentDue = "";
    }
    if (!(await saveFinanceCaseState(ctx, item))) return;
  } else if (shouldUseApi(state)) {
    try {
      const result = await deleteFinanceOperationFromApi(operation.id);
      if (result?.case && item) Object.assign(item, normalizeCase(result.case));
    } catch (_error) {
      showToast("Не вдалося видалити фінансову операцію з бази.", "danger");
      return;
    }
  } else if (item) {
    const amount = Math.abs(Number(operation.amount) || 0);
    if (operation.type === "Надходження") {
      item.paid = Math.max(0, (Number(item.paid) || 0) - amount);
      item.debt = Math.max((Number(item.income || item.totalFee) || 0) - item.paid, 0);
    }
    if (operation.type === "Рахунок") {
      item.totalFee = Math.max(Number(item.paid) || 0, (Number(item.income || item.totalFee) || 0) - amount);
      item.income = item.totalFee;
      item.debt = Math.max(item.totalFee - (Number(item.paid) || 0), 0);
    }
  }

  removeFinanceDocumentFromCase(ctx, item, operation);
  state.financeOperations = (state.financeOperations || []).filter((item) => item.id !== operation.id);
  state.financeOperationMenuId = "";
  document.querySelector("#finance-action-dialog")?.close();
  renderAll();
  switchView("finance");
  showToast("Фінансову операцію видалено.");
}

function bindFinanceActionDialog(ctx) {
  const form = document.querySelector("#finance-action-form");
  if (!form || form.dataset.bound === "true") return;
  form.dataset.bound = "true";
  form.addEventListener("submit", (event) => {
    if (event.submitter?.value === "cancel") return;
    event.preventDefault();
    applyFinanceAction(ctx, new FormData(event.currentTarget));
  });
  document.querySelector("#finance-action-delete")?.addEventListener("click", (event) => {
    const operationId = event.currentTarget.dataset.financeOperationDelete;
    if (operationId) deleteFinanceOperation(ctx, operationId);
  });
  form.querySelectorAll("[data-finance-action-choice]").forEach((button) => {
    button.addEventListener("click", () => setFinanceActionMode(ctx, button.dataset.financeActionChoice || "income"));
  });
  form.elements.date?.addEventListener("change", () => {
    const action = form.elements.action?.value;
    if (action === "invoice" && !form.elements.documentDue.value) {
      form.elements.documentDue.value = addDaysIso(form.elements.date.value || isoToday(), 7);
    }
    if (action === "act" && !form.elements.workPeriod.value) {
      form.elements.workPeriod.value = workPeriodLabel(form.elements.date.value || isoToday());
    }
  });
}

function salaryDateInput(value) {
  const date = dateFromAny(value);
  if (!date) return isoToday();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function openSalaryDialog(ctx, salaryId = "") {
  const { state } = ctx;
  const form = document.querySelector("#salary-form");
  if (!form) return;
  const employees = salaryEmployeeOptions(state);
  const row = salaryId ? findSalaryRow(state, salaryId) : null;
  form.reset();
  document.querySelector("#salary-employee").innerHTML = employees.map((employee) => (
    `<option value="${employee.name}" data-role="${employee.role}">${employee.name} · ${employee.role}</option>`
  )).join("");
  form.elements.salaryId.value = row?.id || "";
  form.elements.employee.value = row?.name || employees[0]?.name || "";
  form.elements.base.value = row?.base ?? 45000;
  form.elements.bonus.value = row?.bonus ?? 0;
  form.elements.date.value = row ? salaryDateInput(row.date) : isoToday();
  form.elements.status.value = row?.status || "Готово";
  form.elements.comment.value = row?.comment || "";
  setupFinanceCustomSelects(form);
  form.querySelectorAll(".salary-select-field > select").forEach(syncFinanceCustomSelect);
  document.querySelector("#salary-dialog-title").textContent = row ? "Редагувати зарплату" : "Нарахувати зарплату";
  document.querySelector("#salary-submit").textContent = row ? "Зберегти зміни" : "Додати зарплату";
  document.querySelector("#salary-dialog").showModal();
}

function applySalary(ctx, formData) {
  const { state, currencyText, renderAll, switchView, showToast } = ctx;
  const employee = formData.get("employee");
  const employeeMeta = salaryEmployeeOptions(state).find((item) => item.name === employee);
  const base = Math.max(0, Number(formData.get("base")) || 0);
  const bonus = Math.max(0, Number(formData.get("bonus")) || 0);
  const total = base + bonus;
  if (!employee || !total) return;

  const dateIso = formData.get("date") || isoToday();
  const status = formData.get("status") || "Готово";
  const salaryId = formData.get("salaryId");
  const previousRow = salaryId ? findSalaryRow(state, salaryId) : null;
  const nextId = previousRow?.custom ? previousRow.id : `salary-${Date.now()}`;
  const row = {
    id: nextId,
    name: employee,
    role: employeeMeta?.role || "Співробітник",
    base,
    bonus,
    total,
    status,
    date: financeDate(dateIso),
    comment: formData.get("comment") || "",
    custom: true
  };

  state.salaryRows = state.salaryRows || [];
  state.deletedSalaryIds = state.deletedSalaryIds || [];
  if (salaryId) {
    state.salaryRows = state.salaryRows.filter((item) => item.id !== salaryId && item.id !== nextId);
    if (previousRow && !previousRow.custom && !state.deletedSalaryIds.includes(previousRow.id)) {
      state.deletedSalaryIds.push(previousRow.id);
    }
  }
  state.salaryRows.unshift(row);
  state.financeOperations = state.financeOperations || [];
  state.financeOperations = state.financeOperations.filter((item) => item.salaryRowId !== salaryId && item.salaryRowId !== row.id);
  state.financeOperations.unshift({
    id: `finance-salary-${Date.now()}`,
    date: row.date,
    type: "Витрата",
    title: `Зарплата: ${row.name}`,
    caseId: "",
    client: row.name,
    amount: -total,
    status: status === "Очікує" ? "Очікується" : "Оплачено",
    method: "Зарплата",
    custom: true,
    salary: true,
    salaryRowId: row.id
  });

  state.financeTab = "salary";
  state.salaryFilter = row.name;
  state.salaryMenuId = "";
  document.querySelector("#salary-dialog")?.close();
  renderAll();
  switchView("finance");
  showToast(salaryId ? `Зарплату для ${row.name} оновлено: ${currencyText(total)}.` : `Зарплату для ${row.name} додано: ${currencyText(total)}.`);
}

function deleteSalary(ctx, salaryId) {
  const { state, renderAll, switchView, showToast } = ctx;
  const row = findSalaryRow(state, salaryId);
  if (!row) return;
  state.salaryRows = (state.salaryRows || []).filter((item) => item.id !== salaryId);
  state.deletedSalaryIds = state.deletedSalaryIds || [];
  if (!row.custom && !state.deletedSalaryIds.includes(row.id)) {
    state.deletedSalaryIds.push(row.id);
  }
  state.financeOperations = (state.financeOperations || []).filter((item) => item.salaryRowId !== salaryId);
  state.salaryMenuId = "";
  renderAll();
  switchView("finance");
  showToast(`Нарахування для ${row.name} видалено.`, "danger");
}

function exportSalaryRows(ctx, rows, filename = "salary-statement.csv") {
  const lines = [
    "Співробітник,Роль,Ставка,Бонус,До виплати,Дата,Статус,Коментар",
    ...rows.map((row) => [
      row.name,
      row.role,
      row.base,
      row.bonus,
      row.total,
      row.date,
      row.status,
      row.comment || ""
    ].join(","))
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
  ctx.showToast("Зарплатну відомість підготовлено до експорту.");
}

function bindSalaryDialog(ctx) {
  const form = document.querySelector("#salary-form");
  if (!form || form.dataset.bound === "true") return;
  form.dataset.bound = "true";
  form.addEventListener("submit", (event) => {
    if (event.submitter?.value === "cancel") return;
    event.preventDefault();
    applySalary(ctx, new FormData(event.currentTarget));
  });
}

function exportFinanceReport(ctx, totals, operations) {
  const lines = [
    "Показник,Значення",
    `Загальний дохід,${totals.income}`,
    `Витрати,${totals.expenses}`,
    `Чистий прибуток,${totals.profit}`,
    `Очікувані надходження,${totals.expected}`,
    `Заборгованість клієнтів,${totals.debt}`,
    "",
    "Дата,Тип,Назва,Справа,Клієнт,Сума,Статус,Спосіб оплати",
    ...operations.map((item) => [
      item.date,
      item.type,
      item.title,
      item.caseId ? `№${item.caseId}` : "—",
      item.client,
      item.amount,
      item.status,
      item.method
    ].join(","))
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "finance-report.csv";
  link.click();
  URL.revokeObjectURL(link.href);
  ctx.showToast("Фінансовий звіт сформовано.");
}

export function renderFinanceScreen(ctx) {
  const {
    state,
    $,
    icon,
    badge,
    currencyText,
    openFinanceDialog,
    showToast
  } = ctx;
  state.financeTab = state.financeTab || "overview";
  state.financePaymentMode = state.financePaymentMode || "all";
  state.financeDateStart = state.financeDateStart || DEFAULT_START;
  state.financeDateEnd = state.financeDateEnd || DEFAULT_END;
  state.financeChartScale = state.financeChartScale || "days";
  state.financeDatePickerOpen = Boolean(state.financeDatePickerOpen);
  bindFinanceActionDialog(ctx);
  bindSalaryDialog(ctx);

  const rows = financeRows(ctx);
  const operationsInRange = financeOperations(state).filter((item) => inDateRange(item.date, state.financeDateStart, state.financeDateEnd));
  const tabOperations = operationsInRange.filter((item) => operationMatchesTab(item, state.financeTab));
  const modeOperations = state.financeTab === "payments"
    ? tabOperations.filter((item) => operationMatchesPaymentMode(item, state.financePaymentMode))
    : tabOperations;
  const visibleOperations = modeOperations.filter((item) => operationMatchesFinanceFilters(item, state));
  const recentPagination = state.financeTab === "overview"
    ? paginateFinanceItems(state, "overviewRecent", operationsInRange, FINANCE_PAGE_SIZE)
    : null;
  const recentOperations = recentPagination?.items || [];
  const selectedRecentOperation = recentOperations.find((item) => item.id === state.selectedFinanceOperationId);
  const totals = financeTotals(rows, operationsInRange, state);
  const insights = financeInsightsFromData(rows, operationsInRange);
  const debtRows = rows.filter((item) => item.debt > 0).slice(0, 4);
  const selectedCaseId = state.selectedFinanceCaseId || rows[0]?.id;
  const hasFinanceData = operationsInRange.length > 0 || rows.some((item) => item.total > 0 || item.paid > 0 || item.debt > 0);
  const hasFinanceTotals = totals.income > 0 || totals.expenses > 0 || totals.profit > 0 || totals.expected > 0 || totals.debt > 0;
  const demoFinanceView = state.demoDataStatus?.enabled !== false && hasFinanceData;
  const realLineChart = financeLineChartData(operationsInRange, state.financeDateStart, state.financeDateEnd, state.financeChartScale);
  const showDemoFinanceCharts = demoFinanceView && hasFinanceTotals && !realLineChart.hasData;
  const showRealFinanceChart = realLineChart.hasData || showDemoFinanceCharts;
  const lineData = showDemoFinanceCharts ? FINANCE_LINE : realLineChart.values;
  const lineMax = showDemoFinanceCharts ? 100 : realLineChart.max;
  const lineAxis = showDemoFinanceCharts ? ["0", "200k", "400k", "600k", "800k"] : realLineChart.axis.map((value) => currencyText(value));
  const lineLabels = showDemoFinanceCharts ? chartDates : realLineChart.labels;
  const cashflowData = demoFinanceView ? CASHFLOW : CASHFLOW.map(([label]) => [label, 0, 0]);
  const hasIncomeStructure = insights.incomeStructure.length > 0;
  const accountBalance = totals.profit;
  const cashBalance = 0;
  const availableBalance = Math.max(0, totals.profit);
  const emptyKpiDetail = "даних ще немає";
  const financeTrend = (value, trend, detail) => value > 0 && hasFinanceTotals
    ? { trend, detail }
    : { trend: "Без даних", detail: emptyKpiDetail };
  const financeKpis = [
    { title: "Загальний дохід", value: currencyText(totals.income), ...financeTrend(totals.income, "+12%"), iconName: "briefcase", tone: "blue" },
    { title: "Витрати", value: currencyText(totals.expenses), ...financeTrend(totals.expenses, "+8%"), trendTone: totals.expenses > 0 ? "danger" : "", iconName: "file", tone: "red" },
    { title: "Чистий прибуток", value: currencyText(totals.profit), ...financeTrend(totals.profit, "+15%"), iconName: "check", tone: "green" },
    { title: "Очікувані надходження", value: currencyText(totals.expected), ...financeTrend(totals.expected, "порівняно з попер. періодом"), iconName: "clock", tone: "amber" },
    { title: "Заборгованість клієнтів", value: currencyText(totals.debt), ...financeTrend(totals.debt, "порівняно з попер. періодом"), iconName: "mail", tone: "red" }
  ];

  $("#finance").innerHTML = `
    <div class="finance-screen finance-reference">
      <div class="finance-top-row">
        <div></div>
        <div class="analytics-date-wrap finance-date-wrap">
          <button class="analytics-date-range finance-date-range" type="button" data-finance-date-toggle aria-expanded="${state.financeDatePickerOpen}">
            <span>${financeDate(state.financeDateStart)} - ${financeDate(state.financeDateEnd)}</span>
            ${icon("calendar")}
          </button>
          ${state.financeDatePickerOpen ? `
            <div class="analytics-date-popover finance-date-popover">
              <label>Початок
                <input type="date" data-finance-date-start value="${state.financeDateStart}">
              </label>
              <label>Кінець
                <input type="date" data-finance-date-end value="${state.financeDateEnd}">
              </label>
              <div>
                <button class="secondary" type="button" data-finance-date-preset>1-15 травня</button>
                <button class="primary" type="button" data-finance-date-apply>Застосувати</button>
              </div>
            </div>
          ` : ""}
        </div>
        <button class="secondary" type="button" data-export-finance>${icon("file")} Експорт звіту</button>
      </div>

      <nav class="finance-tabs" aria-label="Розділи фінансів">
        ${FINANCE_TABS.map(([tab, label]) => `
          <button class="${state.financeTab === tab ? "active" : ""}" type="button" data-finance-tab="${tab}">${label}</button>
        `).join("")}
      </nav>

      ${state.financeTab === "overview" ? `
      <section class="finance-kpi-grid">
        ${financeKpis.map((item) => kpiCard(item, icon)).join("")}
      </section>

      <section class="finance-dashboard-layout">
        <div class="finance-main-column">
          <div class="finance-main-grid">
            <article class="panel finance-chart-card finance-line-card">
              <div class="analytics-card-head">
                <h2>Динаміка доходів та витрат</h2>
                <label class="finance-filter-field finance-chart-scale-field">
                  <select data-finance-chart-scale aria-label="Масштаб графіка">
                    <option value="days" ${state.financeChartScale === "days" ? "selected" : ""}>По днях</option>
                    <option value="weeks" ${state.financeChartScale === "weeks" ? "selected" : ""}>По тижнях</option>
                  </select>
                </label>
              </div>
              <div class="analytics-legend">
                <span class="blue">Дохід</span>
                <span class="red">Витрати</span>
                <span class="green">Прибуток</span>
              </div>
              ${showRealFinanceChart ? `
                <svg class="finance-line-chart" viewBox="0 0 620 250" role="img" aria-label="Динаміка доходів та витрат">
                  <g class="grid-lines">
                    ${[0, 1, 2, 3, 4].map((line) => `<line x1="40" y1="${25 + line * 45}" x2="600" y2="${25 + line * 45}"></line>`).join("")}
                  </g>
                  ${lineAxis.map((value, index) => `<text x="10" y="${212 - index * 45}">${value}</text>`).join("")}
                  <polyline class="line blue-line" points="${linePoints(lineData.income, lineMax)}" transform="translate(40 25)"></polyline>
                  <polyline class="line red-line" points="${linePoints(lineData.expenses, lineMax)}" transform="translate(40 25)"></polyline>
                  <polyline class="line green-line" points="${linePoints(lineData.profit, lineMax)}" transform="translate(40 25)"></polyline>
                  ${lineLabels.map((date, index) => {
                    const step = lineLabels.length <= 1 ? 0 : 560 / (lineLabels.length - 1);
                    const shouldShow = lineLabels.length <= 8 || index === 0 || index === lineLabels.length - 1 || index % Math.ceil(lineLabels.length / 7) === 0;
                    const anchor = index === 0 ? "start" : index === lineLabels.length - 1 ? "end" : "middle";
                    const x = index === lineLabels.length - 1 ? 600 : 42 + Math.round(index * step);
                    return shouldShow ? `<text class="axis" x="${x}" y="238" text-anchor="${anchor}">${date}</text>` : "";
                  }).join("")}
                </svg>
              ` : `
                <div class="finance-chart-empty">
                  <strong>Фінансової динаміки ще немає</strong>
                  <span>Додайте кілька платежів у різні дні, і CRM побудує реальну картину без демо-графіка.</span>
                </div>
              `}
            </article>

            <article class="panel finance-chart-card">
              <h2>Структура доходів</h2>
                <div class="finance-donut-wrap">
                <div class="finance-income-donut${hasIncomeStructure ? "" : " is-empty"}" ${financeDonutStyle(insights.incomeStructure)}></div>
                <div class="finance-donut-legend">
                  ${hasIncomeStructure ? insights.incomeStructure.map(([label, amount, color]) => `
                    <div><span style="--legend-color:${color}">${label}</span><strong>${amount}</strong></div>
                  `).join("") : `<p class="finance-empty-note">Доходів за вибраний період ще немає.</p>`}
                </div>
              </div>
            </article>
          </div>

          <article class="panel finance-operations-card">
            <div class="toolbar">
              <h2>Останні фінансові операції <small>Фінанси по справах</small></h2>
              <span class="muted">${operationsInRange.length} записів</span>
            </div>
            <div class="finance-operation-head is-readonly is-tree">
              <span>Клієнт</span><span>Справа</span><span>Дата</span><span>Тип</span><span>Назва / Опис</span><span>Сума</span><span>Статус</span><span>Спосіб оплати</span>
            </div>
            <div class="finance-operation-list is-readonly is-tree">${operationRows(recentOperations, badge, icon, { showActions: false, clickable: true, selectedId: state.selectedFinanceOperationId, caseTree: true })}</div>
            ${financePaginationHtml(recentPagination, "операцій")}
            <button class="case-link-button finance-view-all" type="button" data-finance-all-operations>Переглянути всі операції</button>
          </article>

          <section class="finance-bottom-grid">
            <article class="panel finance-chart-card">
              <h2>Доходи по справах (топ 5)</h2>
              <div class="finance-mini-bars">${barRows(insights.incomeByCase) || `<p class="finance-empty-note">Оплат по справах ще немає.</p>`}</div>
            </article>
            <article class="panel finance-chart-card">
              <h2>Витрати по категоріях</h2>
              <div class="finance-mini-bars">${expenseRows(insights.expenseCategories) || `<p class="finance-empty-note">Витрат за період ще немає.</p>`}</div>
            </article>
            <article class="panel finance-chart-card">
              <h2>Прогноз грошового потоку</h2>
              ${showDemoFinanceCharts ? `
                <div class="finance-cashflow-legend">
                  <span class="green">Очікувані надходження</span>
                  <span class="red">Очікувані витрати</span>
                </div>
                <div class="finance-cashflow-chart">
                  ${cashflowData.map(([label, income, expense]) => `
                    <div>
                      <span class="green" style="height:${income}%"></span>
                      <span class="red" style="height:${expense}%"></span>
                      <em>${label}</em>
                    </div>
                  `).join("")}
                </div>
              ` : `
                <div class="finance-chart-empty is-compact">
                  <strong>Прогноз ще не сформовано</strong>
                  <span>Очікувані надходження та витрати з'являться після рахунків, актів і платежів.</span>
                </div>
              `}
            </article>
          </section>
        </div>

        <aside class="finance-right-column">
          ${financeOperationDetailCard(selectedRecentOperation, icon, badge, currencyText)}
          <article class="panel finance-status-card">
            <h2>Фінансовий стан</h2>
            ${[
              ["Всього на рахунках", currencyText(accountBalance)],
              ["Готівка в касі", currencyText(cashBalance)],
              ["Заборгованість клієнтів", currencyText(totals.debt)]
            ].map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`).join("")}
            <div class="available"><span>Доступно до використання</span><strong>${currencyText(availableBalance)}</strong></div>
          </article>

          <article class="panel finance-debt-card">
            <h2>Заборгованість клієнтів</h2>
            <p class="muted">Всього: ${currencyText(totals.debt)}</p>
            ${debtRows.map((item, index) => `
              <button type="button" data-finance-open-case="${item.id}">
                <span>${item.client}</span>
                <strong>${currencyText(item.debt)}</strong>
                <small>${index === 0 ? "15 днів прострочки" : index === 1 ? "7 днів прострочки" : index === 2 ? "3 дні прострочки" : "Без прострочки"}</small>
              </button>
            `).join("")}
            <button class="case-link-button finance-all-debts" type="button" data-finance-all-debts>Переглянути всі борги</button>
          </article>

          <article class="panel finance-quick-card">
            <h2>Швидкі дії</h2>
            <button type="button" data-finance-quick-action>${icon("check")} Нова фінансова дія</button>
            <button type="button" data-finance-payments>${icon("briefcase")} Перейти до всіх платежів</button>
          </article>
        </aside>
      </section>
      ` : financeWorkspace(ctx, rows, modeOperations, visibleOperations, totals)}
    </div>
  `;
  setupFinanceCustomSelects($("#finance"));
  if (financeOutsideMenuHandler) {
    document.removeEventListener("click", financeOutsideMenuHandler);
  }
  financeOutsideMenuHandler = (event) => {
    const financeRoot = $("#finance");
    if (!financeRoot?.classList.contains("active")) return;
    if (!state.financeOperationMenuId && !state.salaryMenuId) return;
    if (event.target.closest("[data-finance-operation-menu], [data-salary-menu], .finance-operation-menu")) return;
    state.financeOperationMenuId = "";
    state.salaryMenuId = "";
    rerender();
  };
  document.addEventListener("click", financeOutsideMenuHandler);

  const rerender = () => renderFinanceScreen(ctx);

  document.querySelectorAll("[data-finance-tab]").forEach((button) => button.addEventListener("click", () => {
    state.financeTab = button.dataset.financeTab;
    if (state.financeTab === "payments") state.financePaymentMode = "all";
    state.financeQuery = "";
    state.financeOperationClientFilter = "all";
    state.financeOperationCaseFilter = "all";
    state.financeCaseQuery = "";
    state.financeCaseStatusFilter = "all";
    state.financeClientDebtQuery = "";
    state.financeClientDebtStatusFilter = "all";
    resetFinancePage(state);
    rerender();
  }));
  document.querySelector("[data-finance-date-toggle]")?.addEventListener("click", () => {
    state.financeDatePickerOpen = !state.financeDatePickerOpen;
    rerender();
  });
  document.querySelector("[data-finance-date-start]")?.addEventListener("change", (event) => {
    state.financeDateStart = event.currentTarget.value || DEFAULT_START;
  });
  document.querySelector("[data-finance-date-end]")?.addEventListener("change", (event) => {
    state.financeDateEnd = event.currentTarget.value || DEFAULT_END;
  });
  document.querySelector("[data-finance-date-preset]")?.addEventListener("click", () => {
    state.financeDateStart = DEFAULT_START;
    state.financeDateEnd = DEFAULT_END;
    state.financeDatePickerOpen = false;
    showToast("Період фінансів повернуто до 1-15 травня.", "warning");
    rerender();
  });
  document.querySelector("[data-finance-date-apply]")?.addEventListener("click", () => {
    if (dateFromAny(state.financeDateStart) > dateFromAny(state.financeDateEnd)) {
      [state.financeDateStart, state.financeDateEnd] = [state.financeDateEnd, state.financeDateStart];
    }
    state.financeDatePickerOpen = false;
    resetFinancePage(state);
    showToast("Період фінансів застосовано.");
    rerender();
  });
  document.querySelectorAll("[data-export-finance]").forEach((button) => button.addEventListener("click", () => {
    exportFinanceReport(ctx, totals, visibleOperations);
  }));
  document.querySelector("[data-finance-operation-search]")?.addEventListener("input", (event) => {
    state.financeQuery = event.currentTarget.value;
    resetFinancePage(state);
    rerender();
  });
  document.querySelector("[data-finance-operation-client]")?.addEventListener("change", (event) => {
    state.financeOperationClientFilter = event.currentTarget.value || "all";
    const selectedOperation = tabOperations.find((item) => item.caseId === state.financeOperationCaseFilter);
    if (state.financeOperationClientFilter !== "all" && selectedOperation?.client !== state.financeOperationClientFilter) {
      state.financeOperationCaseFilter = "all";
    }
    resetFinancePage(state);
    rerender();
  });
  document.querySelector("[data-finance-operation-case]")?.addEventListener("change", (event) => {
    state.financeOperationCaseFilter = event.currentTarget.value || "all";
    resetFinancePage(state);
    rerender();
  });
  document.querySelector("[data-finance-operation-reset]")?.addEventListener("click", () => {
    state.financeQuery = "";
    state.financeOperationClientFilter = "all";
    state.financeOperationCaseFilter = "all";
    resetFinancePage(state);
    rerender();
  });
  document.querySelector("[data-finance-case-search]")?.addEventListener("input", (event) => {
    state.financeCaseQuery = event.currentTarget.value;
    resetFinancePage(state, "cases");
    rerender();
  });
  document.querySelector("[data-finance-case-status]")?.addEventListener("change", (event) => {
    state.financeCaseStatusFilter = event.currentTarget.value || "all";
    resetFinancePage(state, "cases");
    rerender();
  });
  document.querySelector("[data-finance-case-reset]")?.addEventListener("click", () => {
    state.financeCaseQuery = "";
    state.financeCaseStatusFilter = "all";
    resetFinancePage(state, "cases");
    rerender();
  });
  document.querySelector("[data-finance-client-debt-search]")?.addEventListener("input", (event) => {
    state.financeClientDebtQuery = event.currentTarget.value;
    resetFinancePage(state, "clients");
    rerender();
  });
  document.querySelector("[data-finance-client-debt-status]")?.addEventListener("change", (event) => {
    state.financeClientDebtStatusFilter = event.currentTarget.value || "all";
    resetFinancePage(state, "clients");
    rerender();
  });
  document.querySelector("[data-finance-client-debt-reset]")?.addEventListener("click", () => {
    state.financeClientDebtQuery = "";
    state.financeClientDebtStatusFilter = "all";
    resetFinancePage(state, "clients");
    rerender();
  });
  document.querySelectorAll("[data-finance-payment-mode]").forEach((button) => button.addEventListener("click", () => {
    state.financePaymentMode = button.dataset.financePaymentMode || "all";
    state.financeQuery = "";
    state.financeOperationClientFilter = "all";
    state.financeOperationCaseFilter = "all";
    resetFinancePage(state, "payments");
    rerender();
  }));
  document.querySelectorAll("[data-finance-page]").forEach((button) => button.addEventListener("click", () => {
    const key = button.dataset.financePageKey || state.financeTab || "overview";
    financePageState(state)[key] = Number(button.dataset.financePage) || 1;
    rerender();
  }));
  document.querySelectorAll("[data-finance-open-case]").forEach((button) => button.addEventListener("click", () => {
    openFinanceCase(ctx, button.dataset.financeOpenCase);
  }));
  document.querySelectorAll("[data-finance-work-case]").forEach((button) => button.addEventListener("click", () => {
    openFinanceCase(ctx, button.dataset.financeWorkCase);
  }));
  const openOperationInPayments = (operationId) => {
    const operation = findFinanceOperation(state, operationId);
    if (!operation) return;
    state.financeTab = "payments";
    state.financePaymentMode = "all";
    state.financeQuery = operation.title || "";
    state.financeOperationClientFilter = operation.client || "all";
    state.financeOperationCaseFilter = operation.caseId || "all";
    state.financeOperationMenuId = "";
    state.selectedFinanceOperationId = operation.id;
    showToast("Операцію відкрито у вкладці платежів.");
    rerender();
  };
  document.querySelectorAll("[data-finance-select-operation]").forEach((row) => {
    row.addEventListener("click", (event) => {
      if (event.target.closest("button")) return;
      state.selectedFinanceOperationId = row.dataset.financeSelectOperation;
      rerender();
    });
    row.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      state.selectedFinanceOperationId = row.dataset.financeSelectOperation;
      rerender();
    });
  });
  document.querySelectorAll("[data-finance-open-operation]").forEach((target) => {
    if (target.tagName === "BUTTON") {
      target.addEventListener("click", () => openOperationInPayments(target.dataset.financeOpenOperation));
      return;
    }
    target.addEventListener("dblclick", (event) => {
      if (event.target.closest("button")) return;
      openOperationInPayments(target.dataset.financeOpenOperation);
    });
  });
  document.querySelectorAll("[data-finance-operation-menu]").forEach((button) => button.addEventListener("click", () => {
    state.financeOperationMenuId = state.financeOperationMenuId === button.dataset.financeOperationMenu ? "" : button.dataset.financeOperationMenu;
    rerender();
  }));
  document.querySelectorAll("[data-finance-operation-edit]").forEach((button) => button.addEventListener("click", () => {
    const operation = findFinanceOperation(state, button.dataset.financeOperationEdit);
    state.financeOperationMenuId = "";
    if (!operation) return;
    state.selectedFinanceCaseId = operation.caseId;
    if (operation.generated) {
      openFinanceDialog(operation.caseId);
      return;
    }
    openFinanceActionDialog(ctx, financeActionForOperation(operation), operation.id);
  }));
  document.querySelectorAll("[data-finance-operation-document]").forEach((button) => button.addEventListener("click", () => {
    openFinanceOperationDocument(ctx, button.dataset.financeOperationDocument);
  }));
  document.querySelectorAll("[data-finance-operation-delete]").forEach((button) => button.addEventListener("click", () => {
    deleteFinanceOperation(ctx, button.dataset.financeOperationDelete);
  }));
  document.querySelector("[data-finance-back-overview]")?.addEventListener("click", () => {
    state.financeTab = "overview";
    rerender();
  });
  document.querySelectorAll("[data-finance-work-action]").forEach((button) => button.addEventListener("click", () => {
    openFinanceActionDialog(ctx, button.dataset.financeWorkAction);
  }));
  document.querySelectorAll("[data-finance-salary-open]").forEach((button) => button.addEventListener("click", () => {
    openSalaryDialog(ctx);
  }));
  document.querySelector("[data-salary-filter]")?.addEventListener("change", (event) => {
    state.salaryFilter = event.currentTarget.value;
    state.salaryMenuId = "";
    resetFinancePage(state, "salary");
    rerender();
  });
  document.querySelectorAll("[data-salary-menu]").forEach((button) => button.addEventListener("click", () => {
    state.salaryMenuId = state.salaryMenuId === button.dataset.salaryMenu ? "" : button.dataset.salaryMenu;
    rerender();
  }));
  document.querySelectorAll("[data-salary-edit]").forEach((button) => button.addEventListener("click", () => {
    state.salaryMenuId = "";
    openSalaryDialog(ctx, button.dataset.salaryEdit);
  }));
  document.querySelectorAll("[data-salary-delete]").forEach((button) => button.addEventListener("click", () => {
    deleteSalary(ctx, button.dataset.salaryDelete);
  }));
  document.querySelectorAll("[data-salary-export-row]").forEach((button) => button.addEventListener("click", () => {
    const row = findSalaryRow(state, button.dataset.salaryExportRow);
    state.salaryMenuId = "";
    if (row) exportSalaryRows(ctx, [row], `salary-${row.name.replaceAll(" ", "-")}.csv`);
    rerender();
  }));
  document.querySelector("[data-finance-salary-export]")?.addEventListener("click", () => {
    exportSalaryRows(ctx, filteredSalaryRows(state));
  });
  document.querySelector("[data-finance-all-operations]")?.addEventListener("click", () => {
    state.financeTab = "payments";
    state.financePaymentMode = "all";
    state.financeQuery = "";
    state.financeOperationClientFilter = "all";
    state.financeOperationCaseFilter = "all";
    showToast("Відкрито вкладку платежів.");
    rerender();
  });
  document.querySelector("[data-finance-all-debts]")?.addEventListener("click", () => {
    state.financeTab = "clients";
    state.financeClientDebtQuery = "";
    state.financeClientDebtStatusFilter = "all";
    resetFinancePage(state, "clients");
    showToast("Показано клієнтів із заборгованістю.", "warning");
    rerender();
  });
  document.querySelector("[data-finance-quick-action]")?.addEventListener("click", () => {
    openFinanceActionDialog(ctx, "income", "", { showActionPicker: true });
  });
  document.querySelector("[data-finance-payments]")?.addEventListener("click", () => {
    state.financeTab = "payments";
    state.financePaymentMode = "all";
    state.financeQuery = "";
    state.financeOperationClientFilter = "all";
    state.financeOperationCaseFilter = "all";
    rerender();
  });
  document.querySelector("[data-finance-chart-scale]")?.addEventListener("change", (event) => {
    state.financeChartScale = event.currentTarget.value || "days";
    showToast("Масштаб графіка змінено.");
    rerender();
  });
}
