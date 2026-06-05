import { deleteCaseFromApi, saveCaseToApi, saveTaskToApi, shouldUseApi } from "../api.js";
import { setupScreenCustomSelects } from "../custom-selects.js";
import { normalizeCase, normalizeTask } from "../state.js";
import { copyDocumentInCase, openDocumentArchiveDialog, openDocumentSendDialog } from "./documents.js";
import { inferCaseDocumentFolder } from "../case-documents.js";
import { formatDate } from "../ui.js";

let currentContext;
let state;
let $;
let icon;
let actionMenu;
let bindActionMenus;
let badge;
let statusTone;
let semanticTone;
let currency;
let currencyText;
let documentActionButtons;
let documentStatusControl;
let documentStatusTone;
let taskTone;
let advocatePhoto;
let clientById;
let caseById;
let openClientDialog;
let openCaseDialog;
let openEssenceDialog;
let openAuthorityDialog;
let openFinanceDialog;
let openDocumentDialog;
let openTaskDialog;
let openEventDialog;
let openFolderDialog;
let openDeleteDocumentConfirm;
let getDocumentPayload;
let openStoredDocument;
let exportStoredDocument;
let openOfficeEditor;
let renderAll;
let syncNavigationState;
let showToast;

const completedCaseStatuses = new Set(["Завершено", "Закрито", "Архів"]);
const caseESignStatuses = new Set(["Очікує е-підпис", "Підписано КЕП", "Відхилено підпис", "Підпис прострочено"]);
const proceduralDocumentFolders = new Set(["Позови", "Клопотання", "Запити", "Відповіді та ухвали"]);
const technicalDocumentTypes = new Set(["doc", "docx", "pdf", "txt", "rtf", "odt", "google docs", "google drive", "crm файл"]);
const demoCaseYear = new Date().getFullYear();

function isDemoCaseNumber(value) {
  const text = String(value || "");
  return text.startsWith(`${demoCaseYear}/`) || text.startsWith("2024/");
}

function demoDisplayDate(dayMonth) {
  return `${dayMonth}.${demoCaseYear}`;
}

function isCaseCompleted(item) {
  return completedCaseStatuses.has(item?.status);
}

function isProceduralCaseDocument(doc = {}, folderName = "") {
  const type = String(doc.type || "").trim().toLowerCase();
  if (technicalDocumentTypes.has(type)) return false;
  const folder = folderName || doc.folder || doc.folderName || "";
  if (proceduralDocumentFolders.has(folder)) return true;
  const haystack = [doc.type, doc.name, folder].map((value) => String(value || "").toLowerCase()).join(" ");
  return /позов|позовн|клопотан|адвокатськ.*запит|запит|ухвал|відповід|рішенн|постанова|пояснен|скарг|заява/.test(haystack);
}

function applyContext(ctx) {
  currentContext = ctx;
  ({
    state,
    $,
    icon,
    actionMenu,
    bindActionMenus,
    badge,
    statusTone,
    semanticTone,
    currency,
    currencyText,
    documentActionButtons,
    documentStatusControl,
    documentStatusTone,
    taskTone,
    advocatePhoto,
    clientById,
    caseById,
    openClientDialog,
    openCaseDialog,
    openEssenceDialog,
    openAuthorityDialog,
    openFinanceDialog,
    openDocumentDialog,
    openTaskDialog,
    openEventDialog,
    openFolderDialog,
    openDeleteDocumentConfirm,
    getDocumentPayload,
    openStoredDocument,
    exportStoredDocument,
    openOfficeEditor,
    renderAll,
    syncNavigationState,
    showToast
  } = ctx);
}

export function renderCasesScreen(ctx) {
  applyContext(ctx);
  renderCases();
}

export function renderCaseListScreen(ctx) {
  applyContext(ctx);
  renderCaseList();
}

export function renderCaseProfileScreen(ctx, id) {
  applyContext(ctx);
  renderCaseProfile(id);
}

function renderCases() {
  const selected = caseById(state.selectedCaseId) || state.cases[0];
  $("#cases").innerHTML = `
    <div class="case-reference-screen" id="case-detail"></div>
  `;
  if (state.caseScreen === "detail" && selected) {
    renderCaseProfile(selected.id);
    syncNavigationState();
    return;
  }
  if (!selected) state.caseScreen = "list";
  renderCaseList();
  syncNavigationState();
}

function caseDocumentsCount(item) {
  return caseFolders(item).reduce((sum, folder) => sum + folder.files.length, 0);
}

function caseFinancialStatus(item) {
  if (item.debt > 0) return badge("Є борг", "red");
  if (item.income > 0) return badge("Оплачено", "green");
  return badge("Не виставлено", "blue");
}

export function caseFinance(item) {
  const total = item.totalFee ?? item.income ?? 0;
  const debt = item.debt ?? 0;
  const paid = item.paid ?? Math.max(total - debt, 0);
  return { total, paid, debt };
}

function financePercent(item) {
  const finance = caseFinance(item);
  if (!finance.total) return 0;
  return Math.min(100, Math.round((finance.paid / finance.total) * 100));
}

function caseFinanceSummary(item) {
  const finance = caseFinance(item);
  const isPaid = finance.total > 0 && finance.debt === 0;
  return `
    <div class="case-finance-summary">
      <strong>${currencyText(finance.total)}</strong>
      <span>оплачено ${currencyText(finance.paid)}</span>
      <span class="${finance.debt ? "debt" : "paid"}">${isPaid ? "оплачено повністю" : `борг ${currencyText(finance.debt)}`}</span>
    </div>
  `;
}

function caseFinanceBlock(item) {
  const finance = caseFinance(item);
  const percent = financePercent(item);
  return `
    <article class="case-card case-finance-card">
      <div class="case-card-title">
        <span>8. ФІНАНСИ СПРАВИ</span>
        ${editOnlyMenu("data-edit-finance", item.id, "Редагувати фінанси")}
      </div>
      <div class="case-finance-grid">
        <div class="case-finance-metric">
          <span>Сума договору</span>
          <strong>${currency(finance.total)}</strong>
        </div>
        <div class="case-finance-metric">
          <span>Оплачено</span>
          <strong>${currency(finance.paid)}</strong>
        </div>
        <div class="case-finance-metric ${finance.debt ? "debt" : "paid"}">
          <span>Борг</span>
          <strong>${currency(finance.debt)}</strong>
        </div>
        <div class="case-finance-metric">
          <span>Перша оплата</span>
          <strong>${item.firstPaymentDate || "Не вказано"}</strong>
        </div>
        <div class="case-finance-metric">
          <span>Наступна оплата</span>
          <strong>${item.nextPaymentDue || "Не вказано"}</strong>
        </div>
      </div>
      <div class="case-finance-progress" aria-label="Оплата ${percent}%">
        <span style="width:${percent}%"></span>
      </div>
      <div class="case-finance-note">
        <span>Оплачено ${percent}%</span>
        <p>${item.financeComment || "Коментар по оплаті ще не додано."}</p>
      </div>
    </article>
  `;
}

function priorityTone(priority) {
  return semanticTone(priority);
}

function caseStatusIconName(status) {
  const icons = {
    "В роботі": "refresh",
    "Очікує відповідь": "clock",
    "Терміново": "bell",
    "Завершено": "check",
    "Архів": "file",
    "Закрито": "check"
  };
  return icons[status] || "briefcase";
}

function caseStatusUiTone(status) {
  const tones = {
    "В роботі": "case-work",
    "Очікує відповідь": "case-waiting",
    "Терміново": "case-urgent",
    "Завершено": "case-completed",
    "Архів": "case-archive",
    "Закрито": "case-completed"
  };
  return tones[status] || "case-default";
}

function casePriorityIconName() {
  return "bell";
}

function casePriorityUiTone(priority) {
  const tones = {
    "Високий": "case-urgent",
    "Середній": "case-waiting",
    "Низький": "case-low",
    "Плановий": "case-planned"
  };
  return tones[priority] || "case-default";
}

function uniqueCaseOptions(baseOptions, currentValue) {
  return [...new Set([currentValue, ...baseOptions].filter(Boolean))];
}

function casePillPicker(item, type) {
  const isPriority = type === "priority";
  const value = isPriority ? item.priority : item.status;
  const options = isPriority
    ? uniqueCaseOptions(["Високий", "Середній", "Низький", "Плановий"], value)
    : uniqueCaseOptions(["В роботі", "Очікує відповідь", "Терміново", "Завершено", "Архів"], value);
  const tone = isPriority ? casePriorityUiTone(value) : caseStatusUiTone(value);
  const iconName = isPriority ? casePriorityIconName(value) : caseStatusIconName(value);
  const label = isPriority ? `${value} пріоритет` : value;
  const actionAttr = isPriority ? "data-case-priority-value" : "data-case-status-value";
  return `
    <details class="case-pill-picker ${tone}">
      <summary class="case-preview-pill" aria-label="${isPriority ? "Змінити пріоритет справи" : "Змінити статус справи"}">
        ${icon(iconName)}
        <strong>${label}</strong>
        <i>⌄</i>
      </summary>
      <div>
        ${options.map((option) => {
          const optionTone = isPriority ? casePriorityUiTone(option) : caseStatusUiTone(option);
          const optionIcon = isPriority ? casePriorityIconName(option) : caseStatusIconName(option);
          return `
            <button type="button" class="${optionTone} ${option === value ? "active" : ""}" ${actionAttr}="${option}" data-case-pill-case="${item.id}">
              <span>${icon(optionIcon)}</span>
              <strong>${isPriority ? `${option} пріоритет` : option}</strong>
              <em>${option === value ? "✓" : ""}</em>
            </button>
          `;
        }).join("")}
      </div>
    </details>
  `;
}

function caseTableStatusIcon(label, iconName, toneClass, kind = "Статус") {
  return `
    <span class="case-status-icon ${toneClass}" data-tooltip="${label || "Не вказано"}" tabindex="0" role="img" aria-label="${kind}: ${label || "Не вказано"}">
      ${icon(iconName)}
    </span>
    <span class="sr-only">${label || "Не вказано"}</span>
  `;
}

function caseDeadlineChip(item) {
  return `
    <span class="case-deadline-chip">
      ${icon("calendar")}
      <strong>${item.deadline || "Без строку"}</strong>
    </span>
  `;
}

function escapeAttribute(value = "") {
  return String(value).replaceAll("&", "&amp;").replaceAll("\"", "&quot;").replaceAll("<", "&lt;");
}

function clientInitials(name = "") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  return `${parts[0]?.[0] || "К"}${parts[1]?.[0] || ""}`.toUpperCase();
}

function clientShortName(name = "") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "Клієнт не вказаний";
  const [surname, ...rest] = parts;
  const initials = rest.map((part) => `${part[0]}.`).join("");
  return initials ? `${surname} ${initials}` : surname;
}

function caseDateValue(value = "") {
  const [day, month, year] = String(value).split(".").map(Number);
  if (!day || !month || !year) return 0;
  return new Date(year, month - 1, day).getTime();
}

function caseClientCell(client, casesCount = 1) {
  const hasPhoto = Boolean(client?.showPhoto && client?.photoUrl);
  const photoStyle = hasPhoto ? ` style="--client-photo: url('${escapeAttribute(client.photoUrl)}')"` : "";
  const name = client?.name || "Клієнт не вказаний";
  return `
    <div class="case-client-cell">
      <span class="client-avatar case-client-avatar ${hasPhoto ? "has-client-photo" : ""}"${photoStyle}>${hasPhoto ? "" : clientInitials(name)}</span>
      <span class="case-client-text">
        <strong>${clientShortName(name)}${casesCount > 1 ? `<em>${casesCount}</em>` : ""}</strong>
        <span>${icon("phone")}<em>${client?.phone || "Телефон не вказано"}</em></span>
      </span>
    </div>
  `;
}

function editOnlyMenu(dataAttr, value, label = "Редагувати") {
  return actionMenu([
    { label, icon: "edit", attrs: { [dataAttr]: value } }
  ], { label: "Дії" });
}

function isUrgentTask(task = {}) {
  return ["Терміново", "Срочно"].includes(task.status) || task.priority === "Високий";
}

function isNonUrgentTask(task = {}) {
  return ["Не терміново", "Не срочно"].includes(task.status) || task.priority === "Низький";
}

function documentMenu(items, label = "Дії документа") {
  return actionMenu(items, { label });
}

function caseMaterialBadges(item) {
  const documents = caseDocumentsCount(item);
  const events = caseProceduralItems(item).length;
  return `
    <span class="case-material-badge blue" data-tooltip="Документи">${icon("file")}<strong>${documents}</strong></span>
    <span class="case-material-badge amber" data-tooltip="Задачі">${icon("check")}<strong>${item.tasks.length}</strong></span>
    <span class="case-material-badge violet" data-tooltip="Події">${icon("calendar")}<strong>${events}</strong></span>
  `;
}

function casePreviewDocuments(item, mode = "accordion") {
  const rows = caseFolders(item).flatMap((folder, folderIndex) =>
    folder.files.map((file, fileIndex) => ({ folder, folderIndex, file, fileIndex }))
  );
  if (!rows.length) return `<p class="preview-empty">Документів поки немає</p>`;
  return rows.map(({ folder, folderIndex, file, fileIndex }) => `
    <div class="preview-list-row preview-document-row ${mode === "stat" ? "case-stat-action-row" : ""}" ${mode === "stat" ? `tabindex="0" data-stat-doc="${item.id}|folder:${folderIndex}:${fileIndex}"` : ""}>
      <div>
        <div class="preview-document-title">${icon("file")}<strong>${file.name}</strong></div>
        <span class="preview-document-meta">${folder.name} ${badge(file.status || "Без статусу", documentStatusTone(file.status))}</span>
      </div>
      ${mode === "stat" ? `
        <div class="case-stat-row-actions" aria-label="Дії документа">
          <button type="button" data-stat-open-document="${item.id}|folder:${folderIndex}:${fileIndex}" aria-label="Відкрити документ">${icon("eye")}</button>
          <button type="button" data-stat-edit-document="${item.id}|folder:${folderIndex}:${fileIndex}" aria-label="Редагувати документ">${icon("edit")}</button>
          <button type="button" data-stat-delete-document="${item.id}|${folderIndex}:${fileIndex}" aria-label="Видалити документ" class="danger-icon">${icon("trash")}</button>
        </div>
      ` : `<div class="folder-actions preview-row-actions">
        ${documentMenu([
          { label: "Відкрити", icon: "eye", attrs: { "data-preview-view-document": `${item.id}|folder:${folderIndex}:${fileIndex}` } },
          { label: "Редагувати", icon: "edit", attrs: { "data-preview-edit-document": `${item.id}|folder:${folderIndex}:${fileIndex}` } },
          { label: "Видалити", icon: "trash", danger: true, attrs: { "data-preview-delete-document": `${item.id}|${folderIndex}:${fileIndex}` } }
        ])}
      </div>`}
    </div>
  `).join("");
}

function casePreviewTasks(item, mode = "accordion") {
  if (!item.tasks.length) return `<p class="preview-empty">Задач поки немає</p>`;
  return item.tasks.map((task, index) => `
    <div class="preview-list-row ${mode === "stat" ? "case-stat-action-row" : ""}" ${mode === "stat" ? `tabindex="0" data-stat-task="${item.id}|${index}"` : ""}>
      <div>
        <strong>${task.title}</strong>
        <span>${task.due || "Без строку"} · ${task.responsible || item.responsible}</span>
      </div>
      ${badge(task.status, taskTone(task.status))}
      ${mode === "stat" ? `
        <div class="case-stat-row-actions" aria-label="Дії задачі">
          <button type="button" data-stat-open-task="${item.id}|${index}" aria-label="Відкрити задачу">${icon("eye")}</button>
          <button type="button" data-stat-edit-task="${item.id}|${index}" aria-label="Редагувати задачу">${icon("edit")}</button>
          <button type="button" data-stat-delete-task="${item.id}|${index}" aria-label="Видалити задачу" class="danger-icon">${icon("trash")}</button>
        </div>
      ` : ""}
    </div>
  `).join("");
}

function casePreviewEvents(item, mode = "accordion") {
  const rows = caseProceduralItems(item);
  if (!rows.length) return `<p class="preview-empty">Подій поки немає</p>`;
  return rows.map((row, index) => {
    const action = Array.isArray(row) ? row[0] : row.action;
    const due = Array.isArray(row) ? row[3] : row.due;
    const status = Array.isArray(row) ? row[4] : row.status;
    return `
      <div class="preview-list-row ${mode === "stat" ? "case-stat-action-row" : ""}" ${mode === "stat" ? `tabindex="0" data-stat-event="${item.id}|${index}"` : ""}>
        <div>
          <strong>${action || "Подія без назви"}</strong>
          <span>${due || "Без дати"}</span>
        </div>
        ${badge(status || "Не розпочато", semanticTone(status))}
        ${mode === "stat" ? `
          <div class="case-stat-row-actions" aria-label="Дії події">
            <button type="button" data-stat-open-event="${item.id}|${index}" aria-label="Відкрити подію">${icon("eye")}</button>
            <button type="button" data-stat-edit-event="${item.id}|${index}" aria-label="Редагувати подію">${icon("edit")}</button>
            <button type="button" data-stat-delete-event="${item.id}|${index}" aria-label="Видалити подію" class="danger-icon">${icon("trash")}</button>
          </div>
        ` : ""}
      </div>
    `;
  }).join("");
}

function casePreviewHistory(item) {
  if (!item.history.length) return `<p class="preview-empty">Історії поки немає</p>`;
  return item.history.map((entry) => `
    <div class="preview-list-row">
      <div>
        <strong>${entry.date}</strong>
        <span>${entry.text}</span>
      </div>
    </div>
  `).join("");
}

function casePreviewFinance(item) {
  const finance = caseFinance(item);
  const percent = financePercent(item);
  return `
    <div class="preview-finance-card">
      <div class="preview-finance-row">
        <span>Сума договору</span>
        <strong>${currency(finance.total)}</strong>
      </div>
      <div class="preview-finance-row">
        <span>Оплачено</span>
        <strong>${currency(finance.paid)}</strong>
      </div>
      <div class="preview-finance-row debt">
        <span>Борг</span>
        <strong>${currency(finance.debt)}</strong>
      </div>
      <div class="preview-finance-row">
        <span>Перша оплата</span>
        <strong>${item.firstPaymentDate || "Не вказано"}</strong>
      </div>
      <div class="preview-finance-row">
        <span>Наступна оплата</span>
        <strong>${item.nextPaymentDue || "Не вказано"}</strong>
      </div>
      <div class="preview-finance-progress"><span style="width:${percent}%"></span></div>
      <div class="preview-finance-footer">
        <small>Оплачено ${percent}%</small>
        ${editOnlyMenu("data-preview-finance", item.id, "Редагувати фінанси")}
      </div>
    </div>
  `;
}

function financePreviewStatus(item) {
  const finance = caseFinance(item);
  if (!finance.total) return { text: "Фінанси не заповнено", tone: "neutral" };
  if (finance.debt > 0) return { text: "Є борг", tone: "debt" };
  return { text: "Оплачено повністю", tone: "paid" };
}

function casePreviewCard(item) {
  const client = clientById(item.clientId);
  const documentsCount = caseDocumentsCount(item);
  const eventsCount = caseProceduralItems(item).length;
  const financeProgress = financePercent(item);
  return `
    <article class="case-card case-preview-card ${isCaseCompleted(item) ? "case-completed-card" : ""}">
      <div class="case-preview-hero">
        <span class="case-preview-icon">${icon("briefcase")}</span>
        <div>
          <h2>${item.title}</h2>
          <p>№${item.id} · ${client?.name || "Клієнт не вказаний"}</p>
        </div>
      </div>
      <div class="case-preview-pills">
        <div class="case-preview-pill-row">
          <span>Пріоритет</span>
          ${casePillPicker(item, "priority")}
        </div>
        <div class="case-preview-pill-row">
          <span>Статус</span>
          ${casePillPicker(item, "status")}
        </div>
      </div>
      <div class="case-preview-rows">
        <div><span>Клієнт</span><strong>${client?.name || "Не вказано"}</strong></div>
        <div><span>Відповідальний</span><strong class="case-preview-person">${advocatePhoto(item.responsible, "mini")}${item.responsible}</strong></div>
        <div><span>Тип / етап</span><strong>${item.type}<br><em>${item.stage}</em></strong></div>
        <div><span>Відкрито</span><strong>${item.opened}</strong></div>
        <div><span>Дедлайн</span><strong>${item.deadline}</strong></div>
        <div><span>Суд / орган</span><strong>${item.court}</strong></div>
      </div>
      <div class="case-preview-summary">
        <h3>Суть справи</h3>
        <p>${item.description}</p>
      </div>
      <div class="case-preview-links">
        <div class="case-preview-primary-actions">
          <button type="button" data-preview-open="${item.id}" class="case-preview-open"><span>${icon("eye")}</span><strong>Відкрити</strong></button>
          <button type="button" data-edit-case-row="${item.id}" class="case-preview-edit">${icon("edit")} Редагувати</button>
        </div>
        <div class="case-preview-stats">
          <div class="case-preview-stat stat-documents" role="button" tabindex="0" data-case-stat="documents" data-case-stat-case="${item.id}">
            <i>${icon("file")}<strong>${documentsCount}</strong></i><em>Док-ти</em>
          </div>
          <div class="case-preview-stat stat-tasks" role="button" tabindex="0" data-case-stat="tasks" data-case-stat-case="${item.id}">
            <i>${icon("check")}<strong>${item.tasks.length}</strong></i><em>Задачі</em>
          </div>
          <div class="case-preview-stat stat-events" role="button" tabindex="0" data-case-stat="events" data-case-stat-case="${item.id}">
            <i>${icon("calendar")}<strong>${eventsCount}</strong></i><em>Події</em>
          </div>
          <div class="case-preview-stat stat-finance" role="button" tabindex="0" data-case-stat="finance" data-case-stat-case="${item.id}">
            <i>${icon("briefcase")}<strong>${financeProgress}%</strong></i><em>Оплата</em>
          </div>
          <div class="case-stat-popovers">
            <div class="case-stat-popover stat-panel-documents">
              <div class="case-stat-popover-head"><strong>Документи</strong><span>${documentsCount}</span></div>
              <div class="preview-list case-stat-preview-list">${casePreviewDocuments(item, "stat")}</div>
            </div>
            <div class="case-stat-popover stat-panel-tasks">
              <div class="case-stat-popover-head"><strong>Задачі</strong><span>${item.tasks.length}</span></div>
              <div class="preview-list case-stat-preview-list">${casePreviewTasks(item, "stat")}</div>
            </div>
            <div class="case-stat-popover stat-panel-events">
              <div class="case-stat-popover-head"><strong>Події</strong><span>${eventsCount}</span></div>
              <div class="preview-list case-stat-preview-list">${casePreviewEvents(item, "stat")}</div>
            </div>
            <div class="case-stat-popover case-stat-finance-popover stat-panel-finance">
              <div class="case-stat-popover-head"><strong>Оплата</strong><span>${financeProgress}%</span></div>
              ${casePreviewFinance(item)}
            </div>
          </div>
        </div>
        <details class="case-preview-accordion">
          <summary><span>›</span><strong>Історія справи</strong><em>${item.history.length}</em></summary>
          <div class="preview-list">${casePreviewHistory(item)}</div>
        </details>
      </div>
    </article>
  `;
}

function renderCaseList() {
  const selectedPageSize = String(state.casePageSize || 6);
  const activeFilterId = document.activeElement?.id;
  const cursorPosition = ["case-search", "case-list-search-secondary"].includes(activeFilterId) ? document.activeElement?.selectionStart : null;
  const selectedStatus = state.caseStatusFilter || "all";
  const selectedType = state.caseTypeFilter || "all";
  const selectedResponsible = state.caseResponsibleFilter || "all";
  const quickFilter = state.caseQuickFilter || "all";
  const query = (state.caseQuery || "").toLowerCase().trim();
  const filteredCases = state.cases
    .filter((item) => {
      const client = clientById(item.clientId);
      const text = `${item.id} ${client?.name} ${item.title} ${item.type} ${item.status} ${item.court} ${item.responsible}`.toLowerCase();
      const byQuick =
        quickFilter === "all" ||
        (quickFilter === "urgent" && (item.priority === "Високий" || item.status === "Терміново")) ||
        (quickFilter === "tasks" && item.tasks.length > 0) ||
        (quickFilter === "debt" && (item.debt || 0) > 0);
      return (!query || text.includes(query))
        && (selectedStatus === "all" || item.status === selectedStatus)
        && (selectedType === "all" || item.type === selectedType)
        && (selectedResponsible === "all" || item.responsible === selectedResponsible)
        && byQuick;
    });
  const clientCaseCounts = filteredCases.reduce((counts, item) => {
    const key = String(item.clientId ?? "unknown");
    counts.set(key, (counts.get(key) || 0) + 1);
    return counts;
  }, new Map());
  const sortedCases = [...filteredCases].sort((a, b) => {
    const clientA = clientById(a.clientId)?.name || "";
    const clientB = clientById(b.clientId)?.name || "";
    return clientA.localeCompare(clientB, "uk") || caseDateValue(a.opened) - caseDateValue(b.opened) || a.id.localeCompare(b.id, "uk");
  });
  const pageSize = selectedPageSize === "all" ? Math.max(sortedCases.length, 1) : Number(selectedPageSize);
  const totalPages = Math.max(1, Math.ceil(sortedCases.length / pageSize));
  state.casePage = Math.min(Math.max(1, state.casePage || 1), totalPages);
  const pageStart = (state.casePage - 1) * pageSize;
  const pageCases = sortedCases.slice(pageStart, pageStart + pageSize);
  const caseIds = new Set(state.cases.map((item) => item.id));
  state.selectedCaseKeys = (state.selectedCaseKeys || []).filter((id) => caseIds.has(id));
  const selectedCaseSet = new Set(state.selectedCaseKeys || []);
  const selectedPageCount = pageCases.filter((item) => selectedCaseSet.has(item.id)).length;
  const selectedCasesCount = selectedCaseSet.size;
  const allCasesSelected = Boolean(pageCases.length && selectedPageCount === pageCases.length);
  const someCasesSelected = Boolean(selectedPageCount && selectedPageCount < pageCases.length);
  const selected = pageCases.find((item) => item.id === state.selectedCaseId) || pageCases[0] || filteredCases[0] || state.cases[0];
  if (selected) state.selectedCaseId = selected.id;
  const visibleClientKeys = new Set();
  const rows = pageCases
    .map((item) => {
      const client = clientById(item.clientId);
      const clientKey = String(item.clientId ?? "unknown");
      const showClient = !visibleClientKeys.has(clientKey);
      visibleClientKeys.add(clientKey);
      return `<tr class="${item.id === selected.id ? "selected" : ""} ${isCaseCompleted(item) ? "case-completed-row" : ""}" data-preview-case="${item.id}">
        <td>${showClient ? caseClientCell(client, clientCaseCounts.get(clientKey) || 1) : `<span class="case-client-repeat-cell" aria-label="Такий самий клієнт"></span>`}</td>
        <td>
          <div class="case-number-cell">
            <input type="checkbox" data-select-case-row="${item.id}" ${selectedCaseSet.has(item.id) ? "checked" : ""} aria-label="Вибрати справу" />
            <span class="case-number-stack">
              <a href="#" data-open-case="${item.id}">№${item.id}</a>
              <small>${item.opened}</small>
            </span>
          </div>
        </td>
        <td>
          <strong>${item.title}</strong>
          <span>${item.type}</span>
          <div class="case-materials">${caseMaterialBadges(item)}</div>
        </td>
        <td>${item.stage}</td>
        <td>${caseDeadlineChip(item)}</td>
        <td>${caseTableStatusIcon(item.priority, casePriorityIconName(item.priority), casePriorityUiTone(item.priority), "Пріоритет")}</td>
        <td>${caseTableStatusIcon(item.status, caseStatusIconName(item.status), caseStatusUiTone(item.status))}</td>
        <td>${caseFinanceSummary(item)}</td>
        <td class="case-actions-cell">
          <span class="case-row-actions">
            ${actionMenu([
              { label: "Відкрити", icon: "eye", attrs: { "data-open-case": item.id, "aria-label": "Відкрити справу" } },
              { label: "Редагувати", icon: "edit", attrs: { "data-edit-case-row": item.id, "aria-label": "Редагувати справу" } },
              { label: "Видалити", icon: "trash", danger: true, attrs: { "data-delete-case": item.id, "aria-label": "Видалити справу" } }
            ], { label: "Дії справи" })}
          </span>
        </td>
      </tr>`;
    }).join("");
  const urgentCases = state.cases.filter((item) => item.priority === "Високий" || item.status === "Терміново").length;
  const totalTasks = state.cases.reduce((sum, item) => sum + item.tasks.length, 0);
  const totalDebt = state.cases.reduce((sum, item) => sum + item.debt, 0);
  const hasManualCaseFilters = Boolean(query) || selectedStatus !== "all" || selectedType !== "all" || selectedResponsible !== "all";
  const allKpiActive = quickFilter === "all" && !hasManualCaseFilters;
  $("#case-detail").innerHTML = `
    <div class="case-list-screen">
      <div class="case-list-head">
        <div class="case-list-global-search">
          <input id="case-search" value="${state.caseQuery || ""}" placeholder="Пошук клієнта, справи, події..." />
          <button class="icon-button" type="button">${icon("filter")}</button>
          <button class="primary" id="create-case-from-list">+ Додати справу</button>
        </div>
      </div>
      <div class="case-kpi-grid">
        <button class="panel case-kpi-card ${allKpiActive ? "active" : ""}" type="button" data-case-kpi="all"><span>Усього справ</span><strong>${state.cases.length}</strong><i>${icon("briefcase")}</i></button>
        <button class="panel case-kpi-card ${quickFilter === "urgent" ? "active" : ""}" type="button" data-case-kpi="urgent"><span>Термінові</span><strong>${urgentCases}</strong><i class="red">${icon("bell")}</i></button>
        <button class="panel case-kpi-card ${quickFilter === "tasks" ? "active" : ""}" type="button" data-case-kpi="tasks"><span>Задач по справах</span><strong>${totalTasks}</strong><i class="amber">${icon("check")}</i></button>
        <button class="panel case-kpi-card ${quickFilter === "debt" ? "active" : ""}" type="button" data-case-kpi="debt"><span>Борг по справах</span><strong>${currency(totalDebt)}</strong><i class="violet">${icon("briefcase")}</i></button>
      </div>
      <div class="case-list-toolbar">
        <input id="case-list-search-secondary" value="${state.caseQuery || ""}" placeholder="Пошук справи..." />
        <select id="case-status-filter">
          <option value="all">Всі статуси</option>
          ${[...new Set(state.cases.map((item) => item.status))].map((status) => `<option value="${status}" ${status === selectedStatus ? "selected" : ""}>${status}</option>`).join("")}
        </select>
        <select id="case-type-filter">
          <option value="all">Всі типи</option>
          ${[...new Set(state.cases.map((item) => item.type))].map((type) => `<option value="${type}" ${type === selectedType ? "selected" : ""}>${type}</option>`).join("")}
        </select>
        <select id="case-responsible-filter">
          <option value="all">Всі адвокати</option>
          ${[...new Set(state.cases.map((item) => item.responsible).filter(Boolean))].map((responsible) => `<option value="${responsible}" ${responsible === selectedResponsible ? "selected" : ""}>${responsible}</option>`).join("")}
        </select>
      </div>
      <div class="case-list-layout">
        <article class="case-card case-list-card">
          <div class="table-wrap">
            <table class="case-list-table">
              <thead>
                <tr>
                  <th>Клієнт</th>
                  <th><span class="case-title-head"><input type="checkbox" data-select-case-page aria-label="Вибрати всі справи на сторінці" ${allCasesSelected ? "checked" : ""} /><span class="case-title-label">Справа</span><span class="tasks-bulk-bar case-bulk-bar ${selectedCasesCount ? "active" : ""}" aria-label="Масові дії справ"><em>${selectedCasesCount}</em><button class="task-bulk-icon bulk-work" type="button" data-case-bulk-action="work" data-tooltip="В роботу" aria-label="Позначити справи в роботі">${icon("refresh")}</button><button class="task-bulk-icon bulk-planner" type="button" data-case-bulk-action="waiting" data-tooltip="Очікує відповідь" aria-label="Позначити очікування відповіді">${icon("clock")}</button><button class="task-bulk-icon bulk-done" type="button" data-case-bulk-action="urgent" data-tooltip="Терміново" aria-label="Позначити терміновими">${icon("bell")}</button><button class="task-bulk-icon bulk-delete" type="button" data-case-bulk-action="delete" data-tooltip="Видалити вибрані" aria-label="Видалити вибрані справи">${icon("trash")}</button><button class="task-bulk-icon bulk-clear" type="button" data-case-bulk-action="clear" data-tooltip="Скинути вибір" aria-label="Скинути вибір справ">×</button></span></span></th>
                  <th>Назва</th>
                  <th>Етап</th>
                  <th>Дедлайн</th>
                  <th>Пріоритет</th>
                  <th>Статус</th>
                  <th>Фінанси</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>${rows || `<tr><td colspan="9">Справ не знайдено</td></tr>`}</tbody>
            </table>
          </div>
          <div class="case-pagination">
            <div class="case-pagination-left">
              <span>Показано ${sortedCases.length ? pageStart + 1 : 0}-${Math.min(pageStart + pageSize, sortedCases.length)} з ${sortedCases.length} справ</span>
              <select id="case-page-size">
                ${[6, 10, 20, 30].map((size) => `<option value="${size}" ${String(size) === selectedPageSize ? "selected" : ""}>1-${size}</option>`).join("")}
                <option value="all" ${selectedPageSize === "all" ? "selected" : ""}>Усі</option>
              </select>
            </div>
            <div ${selectedPageSize === "all" ? "hidden" : ""}>
              <button type="button" data-case-page="${state.casePage - 1}" ${state.casePage === 1 ? "disabled" : ""}>‹</button>
              ${Array.from({ length: totalPages }, (_, index) => `<button type="button" class="${index + 1 === state.casePage ? "active" : ""}" data-case-page="${index + 1}">${index + 1}</button>`).join("")}
              <button type="button" data-case-page="${state.casePage + 1}" ${state.casePage === totalPages ? "disabled" : ""}>›</button>
            </div>
          </div>
        </article>
        ${selected ? casePreviewCard(selected) : ""}
      </div>
    </div>
  `;
  bindActionMenus?.($("#case-detail"));
  $("#create-case-from-list")?.addEventListener("click", () => openCaseDialog());
  document.querySelectorAll("[data-case-kpi]").forEach((button) => {
    button.addEventListener("click", () => {
      state.caseQuickFilter = button.dataset.caseKpi || "all";
      state.caseQuery = "";
      state.caseStatusFilter = "all";
      state.caseTypeFilter = "all";
      state.caseResponsibleFilter = "all";
      state.selectedCaseKeys = [];
      state.casePage = 1;
      renderCaseList();
    });
  });
  $("#case-list-search-secondary")?.addEventListener("input", (event) => {
    state.caseQuery = event.currentTarget.value;
    state.caseQuickFilter = "all";
    state.selectedCaseKeys = [];
    state.casePage = 1;
    renderCaseList();
  });
  $("#case-search")?.addEventListener("input", (event) => {
    state.caseQuery = event.currentTarget.value;
    state.caseQuickFilter = "all";
    state.selectedCaseKeys = [];
    state.casePage = 1;
    renderCaseList();
  });
  [
    ["#case-status-filter", "caseStatusFilter"],
    ["#case-type-filter", "caseTypeFilter"],
    ["#case-responsible-filter", "caseResponsibleFilter"]
  ].forEach(([selector, stateKey]) => {
    $(selector)?.addEventListener("change", (event) => {
      state[stateKey] = event.currentTarget.value;
      state.caseQuickFilter = "all";
      state.selectedCaseKeys = [];
      state.casePage = 1;
      renderCaseList();
    });
  });
  $("#case-page-size")?.addEventListener("change", (event) => {
    state.casePageSize = event.currentTarget.value;
    state.selectedCaseKeys = [];
    state.casePage = 1;
    renderCaseList();
  });
  setupScreenCustomSelects($("#case-detail"), ".case-list-toolbar select, .case-pagination-left select");
  if (activeFilterId) {
    const activeFilter = document.getElementById(activeFilterId);
    activeFilter?.focus();
    if (["case-search", "case-list-search-secondary"].includes(activeFilterId) && cursorPosition !== null) {
      activeFilter.setSelectionRange(cursorPosition, cursorPosition);
    }
  }
  document.querySelectorAll("[data-open-case]").forEach((node) => node.addEventListener("click", (event) => {
    event.preventDefault();
    state.caseScreen = "detail";
    renderCaseProfile(node.dataset.openCase);
  }));
  document.querySelectorAll("[data-preview-open]").forEach((node) => node.addEventListener("click", () => {
    state.caseScreen = "detail";
    renderCaseProfile(node.dataset.previewOpen);
  }));
  document.querySelectorAll("[data-preview-finance]").forEach((node) => node.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    openFinanceDialog(node.dataset.previewFinance);
  }));
  document.querySelectorAll("[data-preview-add-document]").forEach((node) => node.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    openDocumentDialog(node.dataset.previewAddDocument, null, "cases");
  }));
  document.querySelectorAll("[data-preview-add-task]").forEach((node) => node.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    openTaskDialog(node.dataset.previewAddTask, null, "cases");
  }));
  document.querySelectorAll("[data-preview-add-event]").forEach((node) => node.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const item = caseById(node.dataset.previewAddEvent);
    openEventDialog({ caseId: item.id, clientId: item.clientId });
  }));
  const caseStatTypes = ["documents", "tasks", "events", "finance"];
  const setCaseStatsPanel = (container, type = null) => {
    if (!container) return;
    caseStatTypes.forEach((item) => container.classList.remove(`show-${item}`));
    if (type) container.classList.add(`show-${type}`);
  };
  const closeCaseStatPopovers = (except = null) => {
    const exceptContainer = except?.closest(".case-preview-stats") || null;
    document.querySelectorAll("[data-case-stat].open").forEach((node) => {
      if (node !== except) {
        node.classList.remove("open");
        node.setAttribute("aria-expanded", "false");
      }
    });
    document.querySelectorAll(".case-preview-stats").forEach((container) => {
      if (container !== exceptContainer) setCaseStatsPanel(container);
    });
  };
  const runCaseStatAction = (node) => {
    const item = caseById(node.dataset.caseStatCase);
    if (!item) return;
    if (node.dataset.caseStat === "documents") {
      openDocumentDialog(item.id, null, "cases");
      return;
    }
    if (node.dataset.caseStat === "tasks") {
      openTaskDialog(item.id, null, "cases");
      return;
    }
    if (node.dataset.caseStat === "events") {
      openEventDialog({ caseId: item.id, clientId: item.clientId });
      return;
    }
    if (node.dataset.caseStat === "finance") {
      openFinanceDialog(item.id);
    }
  };
  let caseStatClickTimer = null;
  document.querySelectorAll("[data-case-stat]").forEach((node) => {
    node.setAttribute("aria-expanded", "false");
    node.addEventListener("click", (event) => {
      if (event.target.closest(".case-stat-popover")) return;
      event.preventDefault();
      event.stopPropagation();
      window.clearTimeout(caseStatClickTimer);
      caseStatClickTimer = window.setTimeout(() => {
        const shouldOpen = !node.classList.contains("open");
        const container = node.closest(".case-preview-stats");
        closeCaseStatPopovers(node);
        node.classList.toggle("open", shouldOpen);
        node.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
        setCaseStatsPanel(container, shouldOpen ? node.dataset.caseStat : null);
      }, 190);
    });
    node.addEventListener("dblclick", (event) => {
      if (event.target.closest(".case-stat-popover")) return;
      event.preventDefault();
      event.stopPropagation();
      window.clearTimeout(caseStatClickTimer);
      closeCaseStatPopovers();
      runCaseStatAction(node);
    });
    node.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      node.click();
    });
  });
  $("#case-detail")?.addEventListener("click", (event) => {
    if (!event.target.closest("[data-case-stat], .case-stat-popover")) closeCaseStatPopovers();
  });
  const clearCaseStatRowActions = (except = null) => {
    document.querySelectorAll(".case-stat-action-row.active").forEach((row) => {
      if (row !== except) row.classList.remove("active");
    });
  };
  document.querySelectorAll(".case-stat-action-row").forEach((row) => {
    row.addEventListener("click", (event) => {
      if (event.target.closest(".case-stat-row-actions")) return;
      event.preventDefault();
      event.stopPropagation();
      const shouldActivate = !row.classList.contains("active");
      clearCaseStatRowActions(row);
      row.classList.toggle("active", shouldActivate);
    });
    row.addEventListener("dblclick", (event) => {
      if (event.target.closest(".case-stat-row-actions")) return;
      event.preventDefault();
      event.stopPropagation();
      if (row.dataset.statDoc) {
        const [caseId, encoded] = row.dataset.statDoc.split("|");
        openDocumentDialog(caseId, getDocumentPayload(caseId, encoded));
        return;
      }
      if (row.dataset.statTask) {
        const [caseId, taskIndex] = row.dataset.statTask.split("|");
        openTaskDialog(caseId, Number(taskIndex), "cases");
        return;
      }
      if (row.dataset.statEvent) {
        const [caseId, actionIndex] = row.dataset.statEvent.split("|");
        const caseItem = caseById(caseId);
        openEventDialog({ caseId, clientId: caseItem?.clientId }, Number(actionIndex));
      }
    });
    row.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      row.click();
    });
  });
  document.querySelectorAll("[data-stat-open-document]").forEach((node) => node.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const [caseId, encoded] = node.dataset.statOpenDocument.split("|");
    const payload = getDocumentPayload(caseId, encoded);
    openStoredDocument(payload.file || payload.doc, {
      caseId,
      editContext: payload,
      folderName: payload.folder?.name || payload.linked?.folder?.name,
      returnView: "cases"
    });
  }));
  document.querySelectorAll("[data-stat-edit-document]").forEach((node) => node.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const [caseId, encoded] = node.dataset.statEditDocument.split("|");
    openDocumentDialog(caseId, getDocumentPayload(caseId, encoded));
  }));
  document.querySelectorAll("[data-stat-delete-document]").forEach((node) => node.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const [caseId, encoded] = node.dataset.statDeleteDocument.split("|");
    const [folderIndex, fileIndex] = encoded.split(":").map(Number);
    openDeleteDocumentConfirm({ caseId, folderIndex, fileIndex, type: "folderFile" });
  }));
  document.querySelectorAll("[data-stat-open-task], [data-stat-edit-task]").forEach((node) => node.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const value = node.dataset.statOpenTask || node.dataset.statEditTask;
    const [caseId, taskIndex] = value.split("|");
    openTaskDialog(caseId, Number(taskIndex), "cases");
  }));
  document.querySelectorAll("[data-stat-delete-task]").forEach((node) => node.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const [caseId, taskIndex] = node.dataset.statDeleteTask.split("|");
    openDeleteDocumentConfirm({ caseId, taskIndex: Number(taskIndex), type: "task" });
  }));
  document.querySelectorAll("[data-stat-open-event], [data-stat-edit-event]").forEach((node) => node.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const value = node.dataset.statOpenEvent || node.dataset.statEditEvent;
    const [caseId, actionIndex] = value.split("|");
    const item = caseById(caseId);
    openEventDialog({ caseId, clientId: item?.clientId }, Number(actionIndex));
  }));
  document.querySelectorAll("[data-stat-delete-event]").forEach((node) => node.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const [caseId, actionIndex] = node.dataset.statDeleteEvent.split("|");
    openDeleteDocumentConfirm({ caseId, actionIndex: Number(actionIndex), type: "proceduralAction" });
  }));
  document.querySelectorAll("[data-preview-view-document]").forEach((node) => node.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const [caseId, encoded] = node.dataset.previewViewDocument.split("|");
    const payload = getDocumentPayload(caseId, encoded);
    openStoredDocument(payload.file || payload.doc, {
      caseId,
      editContext: payload,
      folderName: payload.folder?.name || payload.linked?.folder?.name,
      returnView: "cases"
    });
  }));
  document.querySelectorAll("[data-preview-edit-document]").forEach((node) => node.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const [caseId, encoded] = node.dataset.previewEditDocument.split("|");
    openDocumentDialog(caseId, getDocumentPayload(caseId, encoded));
  }));
  document.querySelectorAll("[data-preview-delete-document]").forEach((node) => node.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const [caseId, encoded] = node.dataset.previewDeleteDocument.split("|");
    const [folderIndex, fileIndex] = encoded.split(":").map(Number);
    openDeleteDocumentConfirm({ caseId, folderIndex, fileIndex, type: "folderFile" });
  }));
  document.querySelectorAll("[data-edit-case-row]").forEach((node) => node.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    openCaseDialog(node.dataset.editCaseRow);
  }));
  document.querySelectorAll("[data-delete-case]").forEach((node) => node.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    openDeleteDocumentConfirm({ caseId: node.dataset.deleteCase, type: "case" });
  }));
  document.querySelectorAll("[data-case-priority-value], [data-case-status-value]").forEach((node) => node.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const item = caseById(node.dataset.casePillCase);
    if (!item) return;
    const isPriority = Boolean(node.dataset.casePriorityValue);
    const nextValue = isPriority ? node.dataset.casePriorityValue : node.dataset.caseStatusValue;
    if (!nextValue) return;
    const field = isPriority ? "priority" : "status";
    if (item[field] === nextValue) {
      node.closest("details")?.removeAttribute("open");
      return;
    }
    item[field] = nextValue;
    const today = new Date().toLocaleDateString("uk-UA");
    item.history = [
      { date: today, text: `${isPriority ? "Пріоритет" : "Статус"} справи змінено на "${nextValue}".` },
      ...(item.history || [])
    ];
    renderCaseList();
  }));
  const selectCasePageCheckbox = document.querySelector("[data-select-case-page]");
  if (selectCasePageCheckbox) selectCasePageCheckbox.indeterminate = someCasesSelected;
  document.querySelector("[data-select-case-page]")?.addEventListener("click", (event) => event.stopPropagation());
  document.querySelector("[data-select-case-page]")?.addEventListener("change", (event) => {
    const pageIds = pageCases.map((item) => item.id);
    const next = new Set(state.selectedCaseKeys || []);
    pageIds.forEach((id) => {
      if (event.currentTarget.checked) next.add(id);
      else next.delete(id);
    });
    state.selectedCaseKeys = [...next];
    renderCaseList();
  });
  document.querySelectorAll("[data-select-case-row]").forEach((input) => {
    input.addEventListener("click", (event) => event.stopPropagation());
    input.addEventListener("change", () => {
      const next = new Set(state.selectedCaseKeys || []);
      if (input.checked) next.add(input.dataset.selectCaseRow);
      else next.delete(input.dataset.selectCaseRow);
      state.selectedCaseKeys = [...next];
      renderCaseList();
    });
  });
  document.querySelectorAll("[data-case-bulk-action]").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.stopPropagation();
      const action = button.dataset.caseBulkAction;
      if (action === "clear") {
        state.selectedCaseKeys = [];
        renderCaseList();
        return;
      }
      const selectedIds = new Set(state.selectedCaseKeys || []);
      const selectedCases = state.cases.filter((item) => selectedIds.has(item.id));
      if (!selectedCases.length) return;
      if (action === "delete") {
        if (shouldUseApi(state)) {
          try {
            await Promise.all([...selectedIds].map((id) => deleteCaseFromApi(id)));
          } catch (_error) {
            showToast?.("Не вдалося видалити вибрані справи з бази.", "danger");
            return;
          }
        }
        state.cases = state.cases.filter((item) => !selectedIds.has(item.id));
        state.events = state.events.filter((event) => !selectedIds.has(event.caseId));
        state.selectedCaseKeys = [];
        state.selectedCaseId = state.cases[0]?.id || "";
        state.casePage = 1;
        renderCaseList();
        showToast?.(`Видалено ${selectedCases.length} справ.`, "danger");
        return;
      }
      const nextStatus = {
        work: "В роботі",
        waiting: "Очікує відповідь",
        urgent: "Терміново"
      }[action];
      if (!nextStatus) return;
      const today = new Date().toLocaleDateString("uk-UA");
      selectedCases.forEach((item) => {
        item.status = nextStatus;
        item.history = [
          { date: today, text: `Статус справи змінено на "${nextStatus}" через масову дію.` },
          ...(item.history || [])
        ];
      });
      if (shouldUseApi(state)) {
        try {
          await Promise.all(selectedCases.map(async (item) => {
            Object.assign(item, normalizeCase(await saveCaseToApi(item)));
          }));
        } catch (_error) {
          showToast?.("Не вдалося зберегти статус справ у базі.", "danger");
          return;
        }
      }
      state.selectedCaseKeys = [];
      renderCaseList();
    });
  });
  document.querySelectorAll("[data-preview-case]").forEach((node) => node.addEventListener("click", (event) => {
    event.preventDefault();
    if (event.target.closest("a,button")) return;
    state.selectedCaseId = node.dataset.previewCase;
    renderCaseList();
  }));
  document.querySelectorAll("[data-case-page]").forEach((node) => node.addEventListener("click", () => {
    state.casePage = Number(node.dataset.casePage);
    state.selectedCaseKeys = [];
    renderCaseList();
  }));
}

function caseActionRows(item, filter = "all") {
  if (!item.tasks.length) {
    return `<tr><td colspan="6" class="empty-cell">Запланованих дій поки немає</td></tr>`;
  }
  const filteredTasks = item.tasks
    .map((task, index) => ({ task, index }))
    .filter(({ task }) => {
      if (filter === "urgent") return isUrgentTask(task);
      if (filter === "not-urgent") return isNonUrgentTask(task);
      return true;
    });
  if (!filteredTasks.length) {
    const label = filter === "urgent" ? "термінових" : filter === "not-urgent" ? "нетермінових" : "запланованих";
    return `<tr><td colspan="6" class="empty-cell">У цій справі немає ${label} дій</td></tr>`;
  }
  return filteredTasks.map(({ task, index }) => `<tr class="task-action-row ${task.status === "Виконано" ? "task-done-row" : ""}">
    <td><input type="checkbox" data-toggle-task-done="${index}" aria-label="${task.title}" ${task.status === "Виконано" ? "checked" : ""} /></td>
    <td>
      <span class="row-title-with-actions">
        <span class="row-title-text">${task.title}</span>
        <span class="hover-row-actions">
          ${actionMenu([
            { label: "Редагувати", icon: "edit", attrs: { "data-edit-task": index } },
            { label: "Видалити", icon: "trash", danger: true, attrs: { "data-delete-task": index } }
          ], { label: "Дії задачі" })}
        </span>
      </span>
      ${task.reminder ? `<span class="task-reminder-note">нагадування увімкнено</span>` : ""}
    </td>
    <td>${badge(task.status, taskTone(task.status))}</td>
    <td>${task.due}</td>
    <td>${task.responsible || item.responsible}</td>
    <td>
      <div class="task-row-actions">
        <button class="case-row-icon ${task.reminder ? "active" : ""}" data-toggle-task-reminder="${index}" title="Нагадування">${icon("bell")}</button>
      </div>
    </td>
  </tr>`).join("");
}

export function caseProceduralItems(item) {
  if (Array.isArray(item.proceduralActions)) return item.proceduralActions;
  const savedEvents = state.events
    .filter((event) => event.caseId === item.id && (event.proceduralAction || event.source !== "task"))
    .map((event) => ({
      action: event.title,
      initiator: event.authority || event.responsible || "Адвокат",
      initiated: event.date ? formatDate(event.date) : "-",
      time: event.time || "",
      due: event.date ? `${formatDate(event.date)} ${event.time || ""}`.trim() : "-",
      status: event.status || "Заплановано",
      tone: semanticTone(event.status || "Заплановано"),
      description: event.description || ""
    }));
  if (savedEvents.length) {
    item.proceduralActions = savedEvents;
    return item.proceduralActions;
  }
  if (state.demoDataStatus?.enabled === false) return [];
  if (!isDemoCaseNumber(item.id)) return [];
  item.proceduralActions = [
    {
      action: "Подано адміністративний позов",
      initiator: "Адвокат",
      initiated: demoDisplayDate("15.05"),
      due: demoDisplayDate("20.05"),
      status: "В процесі",
      tone: "amber"
    },
    {
      action: "Клопотання про забезпечення позову",
      initiator: "Адвокат",
      initiated: demoDisplayDate("16.05"),
      due: demoDisplayDate("19.05"),
      status: "Не розпочато"
    },
    {
      action: "Отримання витребуваних документів",
      initiator: "Суд",
      initiated: demoDisplayDate("17.05"),
      due: demoDisplayDate("27.05"),
      status: "Не розпочато"
    },
    {
      action: "Судове засідання",
      initiator: "Суд",
      initiated: "-",
      due: `10.06.${demoCaseYear}`,
      status: "Заплановано",
      tone: "blue"
    }
  ];
  return item.proceduralActions;
}

function caseProceduralRows(item) {
  const rows = caseProceduralItems(item);
  if (!rows.length) {
    return `<tr><td colspan="5" class="empty-cell">Процесуальних дій поки немає</td></tr>`;
  }
  return rows.map((row, index) => {
    const action = Array.isArray(row) ? row[0] : row.action;
    const initiator = Array.isArray(row) ? row[1] : row.initiator;
    const initiated = Array.isArray(row) ? row[2] : row.initiated;
    const due = Array.isArray(row) ? row[3] : row.due;
    const status = Array.isArray(row) ? row[4] : row.status;
    const tone = semanticTone(status);
    return `<tr class="procedural-action-row">
    <td>
      <span class="row-title-with-actions">
        <span class="row-title-text">${action}</span>
        <span class="hover-row-actions procedural-row-actions">
          ${actionMenu([
            { label: "Редагувати", icon: "edit", attrs: { "data-edit-procedural-action": index } },
            { label: "Видалити", icon: "trash", danger: true, attrs: { "data-delete-procedural-action": index } }
          ], { label: "Дії процесуальної дії" })}
        </span>
      </span>
    </td>
    <td>${initiator || "-"}</td>
    <td>${initiated || "-"}</td>
    <td>${due || "-"}</td>
    <td><span class="dot-status ${tone || ""}">${status || "Не розпочато"}</span></td>
  </tr>`;
  }).join("");
}

function caseDocumentRows(item) {
  const proceduralDocuments = item.documents
    .map((doc, docIndex) => ({ doc, docIndex }))
    .filter(({ doc }) => isProceduralCaseDocument(doc, doc.folder || doc.folderName));
  if (!proceduralDocuments.length) {
    return `<tr><td colspan="4" class="empty-cell">Процесуальних документів поки немає</td></tr>`;
  }
  return proceduralDocuments.map(({ doc, docIndex }) => {
    const encoded = `procedural:${docIndex}`;
    const key = `${item.id}|${encoded}`;
    return `<tr class="procedural-doc-row">
      <td>
        <span class="procedural-doc-name">
          <span class="procedural-doc-title">${doc.name}</span>
          <span class="procedural-actions">
            ${documentMenu([
              { label: "Відкрити", icon: "eye", attrs: { "data-view-document": encoded } },
              { label: "Редагувати", icon: "edit", attrs: { "data-edit-document": encoded } },
              { label: "Копіювати документ", icon: "file", attrs: { "data-copy-case-document": key } },
              { label: "Відправити", icon: "telegram", attrs: { "data-send-case-document": key } },
              { label: caseESignStatuses.has(doc.status) ? "Перевірити підпис" : "На е-підпис", icon: "signature", attrs: { "data-esign-case-document": encoded } },
              { label: "ONLYOFFICE", icon: "file", attrs: { "data-office-case-document": encoded } },
              { label: "Експорт", icon: "fileUp", attrs: { "data-export-case-document": encoded } },
              { label: "Додати в архів", icon: "archive", attrs: { "data-archive-case-document": key } },
              { label: "Видалити", icon: "trash", danger: true, attrs: { "data-delete-procedural-doc": docIndex } }
            ])}
          </span>
        </span>
      </td>
      <td>${doc.submitted || "-"}</td>
      <td>${doc.responseDue || "-"}</td>
      <td>${badge(doc.status, documentStatusTone(doc.status))}</td>
    </tr>`;
  }).join("");
}

async function runCaseDocumentESignAction(item, encoded) {
  const payload = getDocumentPayload(item.id, encoded);
  const doc = payload.doc || payload.file;
  if (!doc) return;
  const currentStatus = doc.status || "";
  let nextStatus = "Очікує е-підпис";
  let message = "Документ поставлено в чергу е-підпису.";
  if (currentStatus === "Очікує е-підпис") {
    nextStatus = "Підписано КЕП";
    message = "Демо: провайдер повернув підписаний документ.";
  } else if (currentStatus === "Підписано КЕП") {
    showToast?.("Підпис уже отримано. Після API тут буде завантаження підписаного файлу.", "info");
    return;
  } else if (["Відхилено підпис", "Підпис прострочено"].includes(currentStatus)) {
    nextStatus = "Очікує е-підпис";
    message = "Документ повторно поставлено в чергу е-підпису.";
  }
  const update = (target) => {
    if (target) target.status = nextStatus;
  };
  update(payload.doc);
  update(payload.file);
  update(payload.linked?.file);
  item.history = [
    { date: new Date().toLocaleDateString("uk-UA"), text: `Статус документа «${doc.name || "Документ"}» змінено на «${nextStatus}».` },
    ...(item.history || [])
  ];
  if (shouldUseApi(state)) {
    try {
      Object.assign(item, normalizeCase(await saveCaseToApi(item)));
    } catch (_error) {
      showToast?.("Не вдалося зберегти статус документа в базі.", "danger");
      return;
    }
  }
  renderCaseProfile(item.id);
  showToast?.(message, "info");
}

export function caseFolders(item) {
  if (!Array.isArray(item.folders)) item.folders = [];
  if (!item.folders.length && state.demoDataStatus?.enabled !== false && isDemoCaseNumber(item.id)) {
    item.folders = [
      {
        name: "Позови",
        updated: demoDisplayDate("17.05"),
        files: [
          { name: "Адміністративний позов.docx", status: "Чернетка", updated: demoDisplayDate("17.05") },
          { name: "Додатки до позову.pdf", status: "Готово", updated: demoDisplayDate("17.05") },
          { name: "Квитанція судового збору.pdf", status: "Потрібно перевірити", updated: demoDisplayDate("16.05") }
        ]
      },
      {
        name: "Клопотання",
        updated: demoDisplayDate("16.05"),
        files: [
          { name: "Клопотання про забезпечення позову.docx", status: "В роботі", updated: demoDisplayDate("16.05") },
          { name: "Проєкт додатків.docx", status: "Чернетка", updated: demoDisplayDate("16.05") }
        ]
      },
      {
        name: "Запити",
        updated: demoDisplayDate("17.05"),
        files: [
          { name: "Запит документів до ТЦК.docx", status: "Подано", updated: demoDisplayDate("17.05") },
          { name: "Адвокатський запит до ВЛК.docx", status: "Чернетка", updated: demoDisplayDate("16.05") },
          { name: "Вхідний опис документів.pdf", status: "Отримано", updated: demoDisplayDate("15.05") },
          { name: "Поштова квитанція.pdf", status: "Отримано", updated: demoDisplayDate("17.05") }
        ]
      },
      {
        name: "Відповіді та ухвали",
        updated: demoDisplayDate("15.05"),
        files: [{ name: "Ухвала про відкриття провадження.pdf", status: "Отримано", updated: demoDisplayDate("15.05") }]
      },
      {
        name: "Інші документи",
        updated: demoDisplayDate("12.05"),
        files: [
          { name: "Паспорт клієнта.pdf", status: "Отримано", updated: demoDisplayDate("12.05") },
          { name: "ІПН клієнта.pdf", status: "Отримано", updated: demoDisplayDate("12.05") }
        ]
      }
    ];
  }
  const folders = item.folders;
  const comparableName = (value = "") => String(value || "").trim().toLowerCase().replace(/\.(docx?|pdf|txt|rtf|odt)$/i, "");
  const hasFileForDocument = (doc, list = folders, expectedFolderName = "") => list.some((folder) =>
    (folder.files || []).some((file) =>
      folder.name === expectedFolderName
        && (doc.documentId && String(file.documentId || file.id || "") === String(doc.documentId) || comparableName(file.name) === comparableName(doc.name))
    ) || hasFileForDocument(doc, folder.children || [], expectedFolderName)
  );
  const findFolderByName = (name, list = folders) => {
    for (const folder of list) {
      if (folder.name === name) return folder;
      const nested = findFolderByName(name, folder.children || []);
      if (nested) return nested;
    }
    return null;
  };
  (item.documents || []).forEach((doc) => {
    const folderName = inferCaseDocumentFolder(doc, doc.folder || doc.folderName || "Інші документи");
    if (hasFileForDocument(doc, folders, folderName)) return;
    folders.forEach((folder) => {
      folder.files = (folder.files || []).filter((file) =>
        !(doc.documentId && String(file.documentId || file.id || "") === String(doc.documentId) || comparableName(file.name) === comparableName(doc.name))
      );
    });
    let folder = findFolderByName(folderName);
    if (!folder) {
      folder = { name: folderName, updated: doc.updated || doc.submitted || demoDisplayDate("15.05"), files: [], children: [] };
      folders.push(folder);
    }
    if (!Array.isArray(folder.files)) folder.files = [];
    if (!Array.isArray(folder.children)) folder.children = [];
    folder.files.unshift({
      id: doc.id,
      documentId: doc.documentId || doc.id || "",
      name: doc.name,
      type: doc.type,
      folder: folder.name,
      status: doc.status,
      submitted: doc.submitted,
      responseDue: doc.responseDue,
      comment: doc.comment,
      content: doc.content,
      updated: doc.updated || doc.submitted || doc.added || "-",
      fileName: doc.fileName || "",
      fileObject: doc.fileObject || null,
      fileUrl: doc.fileUrl || "",
      onlyOfficeCallbackUrl: doc.onlyOfficeCallbackUrl || "",
      url: doc.url || "",
      source: doc.source || "CRM"
    });
  });
  return item.folders;
}

function caseFolderRows(item) {
  if (!caseFolders(item).length) {
    return `<tr><td colspan="3" class="empty-cell">Папок і файлів поки немає</td></tr>`;
  }
  return caseFolders(item).map((folder, index) => {
    const isOpen = state.openFolderIndex === index;
    const folderRow = `<tr class="folder-row ${isOpen ? "open" : ""}">
      <td>
        <div class="folder-row-content">
          <button class="folder-cell folder-open-button" data-toggle-folder="${index}">
            <span class="folder-caret">${isOpen ? "⌄" : "›"}</span><span class="folder-icon"></span><span class="folder-title-text">${folder.name}</span>
          </button>
          <span class="folder-row-actions">
            ${actionMenu([
              { label: "Редагувати", icon: "edit", attrs: { "data-edit-folder": index } },
              { label: "Видалити", icon: "trash", danger: true, attrs: { "data-delete-folder": index } }
            ], { label: "Дії папки" })}
          </span>
        </div>
      </td>
      <td>${folder.files.length}</td>
      <td>${folder.updated}</td>
    </tr>`;
    const fileRows = isOpen ? `<tr class="folder-files-row"><td colspan="3">
      <div class="folder-files-list">
        ${folder.files.map((file, fileIndex) => `<div class="folder-file-row">
          <div class="folder-file-name">
            <div class="folder-file-title">
              ${icon("file")}
              <span>${file.name}</span>
            </div>
            <div class="folder-actions">
              ${(() => {
                const encoded = `folder:${index}:${fileIndex}`;
                const key = `${item.id}|${encoded}`;
                return documentMenu([
                  { label: "Відкрити", icon: "eye", attrs: { "data-view-document": encoded } },
                  { label: "Редагувати", icon: "edit", attrs: { "data-edit-document": encoded } },
                  { label: "Копіювати документ", icon: "file", attrs: { "data-copy-case-document": key } },
                  { label: "Відправити", icon: "telegram", attrs: { "data-send-case-document": key } },
                  { label: caseESignStatuses.has(file.status) ? "Перевірити підпис" : "На е-підпис", icon: "signature", attrs: { "data-esign-case-document": encoded } },
                  { label: "ONLYOFFICE", icon: "file", attrs: { "data-office-case-document": encoded } },
                  { label: "Експорт", icon: "fileUp", attrs: { "data-export-case-document": encoded } },
                  { label: "Додати в архів", icon: "archive", attrs: { "data-archive-case-document": key } },
                  { label: "Видалити", icon: "trash", danger: true, attrs: { "data-delete-folder-file": `${index}:${fileIndex}` } }
                ]);
              })()}
            </div>
          </div>
          <div class="folder-status-cell">${documentStatusControl(file.status)}</div>
          <div class="folder-updated-cell">${file.updated}</div>
        </div>`).join("")}
      </div>
    </td></tr>` : "";
    return folderRow + fileRows;
  }).join("");
}

function renderCaseProfile(id) {
  const item = caseById(id);
  const client = clientById(item.clientId);
  const clientAddress = client.address || "м. Київ, вул. Хрещатик, 10, кв. 5";
  state.selectedCaseId = item.id;
  state.caseScreen = "detail";
  $("#case-detail").innerHTML = `
    <button class="case-back" id="back-to-case-list" type="button">← Назад к списку справ</button>
    <div class="case-detail-head">
      <div>
        <div class="case-title-line">
          <h2>Справа № ${item.id}</h2>
          ${badge(item.status, semanticTone(item.status))}
        </div>
        <div class="case-meta-line">
          <span class="muted">Створено: ${item.opened}</span>
          <span class="muted case-owner">○ Відповідальний: <strong>${item.responsible}</strong></span>
        </div>
      </div>
      <div class="case-detail-actions">
        <button class="primary" id="save-case-current">Зберегти</button>
      </div>
    </div>
    <div class="case-detail-grid">
      <section class="case-stack">
        <article class="case-card">
          <div class="case-card-title"><span>1. КЛІЄНТ</span>${editOnlyMenu("data-edit-client-row", client.id, "Редагувати клієнта")}</div>
          <div class="case-client-box">
            ${advocatePhoto(client.name, "case-profile-photo")}
            <strong>${client.name}</strong>
          </div>
          <div class="case-contact-list">
            <div>${icon("phone")} <span>${client.phone}</span></div>
            <div>${icon("mail")} <span>${client.email}</span></div>
            <div>${icon("tag")} <span>${clientAddress}</span></div>
          </div>
        </article>
        <article class="case-card">
          <div class="case-card-title"><span>2. СУТЬ СПРАВИ</span>${editOnlyMenu("data-edit-case-section", item.id, "Редагувати суть справи")}</div>
          <p>${item.description}</p>
        </article>
        <article class="case-card">
          <div class="case-card-title"><span>3. ОРГАН, ДО ЯКОГО ЗВЕРНЕННЯ</span>${editOnlyMenu("data-edit-authority", item.id, "Редагувати орган")}</div>
          <div class="authority-box">
            <div class="authority-icon">▥</div>
            <strong>${item.court}</strong>
          </div>
          <p class="muted">Тип органу: ${item.authorityType || "Не вказано"}</p>
          <p class="muted">Адреса: ${item.authorityAddress || "Не вказано"}</p>
          <p class="muted">Контакт: ${item.authorityContact || "Не вказано"}</p>
          <p class="muted">Email: ${item.authorityEmail || "Не вказано"}</p>
        </article>
      </section>
      <section class="case-main-column">
        <article class="case-card">
          <h3>4. ЗАПЛАНОВАНІ ДІЇ</h3>
          <div class="case-tabs">
            <button class="${(state.caseActionFilter || "all") === "all" ? "active" : ""}" data-case-action-filter="all">Всі</button>
            <button class="${state.caseActionFilter === "urgent" ? "active" : ""}" data-case-action-filter="urgent">Термінові</button>
            <button class="${state.caseActionFilter === "not-urgent" ? "active" : ""}" data-case-action-filter="not-urgent">Не термінові</button>
          </div>
          <div class="case-table-wrap">
            <table class="case-inner-table case-actions-table"><tbody>${caseActionRows(item, state.caseActionFilter || "all")}</tbody></table>
          </div>
          <button class="case-link-button" data-add-task="${item.id}">+ Додати дію</button>
        </article>
        <article class="case-card">
          <h3>5. ПРОЦЕСУАЛЬНІ ДІЇ ПО СПРАВІ</h3>
          <div class="case-table-wrap">
            <table class="case-inner-table procedural-actions-table">
              <thead><tr><th>Дія</th><th>Ініціатор</th><th>Дата ініціації</th><th>Строк виконання</th><th>Статус</th></tr></thead>
              <tbody>${caseProceduralRows(item)}</tbody>
            </table>
          </div>
          <button class="case-link-button" data-add-event="${item.id}">+ Додати процесуальну дію</button>
        </article>
      </section>
      <section class="case-side-column">
        <article class="case-card scroll-card case-documents-card">
          <h3>6. ПРОЦЕСУАЛЬНІ ДОКУМЕНТИ</h3>
          <div class="case-table-wrap scroll-area">
            <table class="case-inner-table case-documents-table">
              <thead><tr><th>Документ</th><th>Дата подання</th><th>Строк отримання відповіді</th><th>Статус</th></tr></thead>
              <tbody>${caseDocumentRows(item)}</tbody>
            </table>
          </div>
          <button class="case-link-button" data-add-document="${item.id}">+ Додати документ</button>
        </article>
        <article class="case-card scroll-card case-folders-card">
          <h3>7. ДОКУМЕНТИ СПРАВИ</h3>
          <div class="case-table-wrap scroll-area">
            <table class="case-inner-table folders-table">
              <thead><tr><th>Назва</th><th>Файлів</th><th>Оновлено</th></tr></thead>
              <tbody>${caseFolderRows(item)}</tbody>
            </table>
          </div>
          <div class="case-card-actions">
            <button class="case-link-button" data-add-document="${item.id}">+ Створити документ</button>
            <button class="case-link-button" data-add-folder="${item.id}">+ Створити папку</button>
          </div>
        </article>
      </section>
    </div>
    ${caseFinanceBlock(item)}
    <article class="case-card case-history-card">
      <h3>ІСТОРІЯ СПРАВИ</h3>
      <div class="case-history-list">
        ${item.history.map((entry) => `<div class="case-history-row"><span></span><strong>${entry.date}</strong><p>${entry.text}</p></div>`).join("")}
      </div>
    </article>
  `;
  bindActionMenus?.($("#case-detail"));
  $("#back-to-case-list")?.addEventListener("click", () => {
    state.caseScreen = "list";
    renderCaseList();
    syncNavigationState();
  });
  $("#save-case-current")?.addEventListener("click", () => {
    state.caseScreen = "list";
    renderCaseList();
    syncNavigationState();
  });
  document.querySelectorAll("[data-case-action-filter]").forEach((button) => button.addEventListener("click", (event) => {
    event.preventDefault();
    state.caseActionFilter = button.dataset.caseActionFilter || "all";
    renderCaseProfile(item.id);
  }));
  document.querySelectorAll(`[data-add-document="${item.id}"]`).forEach((button) => button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    openDocumentDialog(item.id);
  }));
  document.querySelectorAll(`[data-add-task="${item.id}"]`).forEach((button) => button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    openTaskDialog(item.id);
  }));
  document.querySelectorAll(`[data-add-event="${item.id}"]`).forEach((button) => button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    openEventDialog({ caseId: item.id, clientId: item.clientId });
  }));
  document.querySelectorAll(`[data-add-folder="${item.id}"]`).forEach((button) => button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    openFolderDialog(item.id);
  }));
  document.querySelectorAll("[data-toggle-task-done]").forEach((input) => input.addEventListener("change", async () => {
    const task = item.tasks[Number(input.dataset.toggleTaskDone)];
    if (!task) return;
    task.status = input.checked ? "Виконано" : "Очікує";
    if (shouldUseApi(state) && task.id) {
      try {
        Object.assign(task, normalizeTask(await saveTaskToApi({ ...task, caseId: item.id, clientId: item.clientId })));
      } catch (_error) {
        showToast?.("Не вдалося зберегти статус задачі в базі.", "danger");
        return;
      }
    }
    item.history.unshift({
      date: new Date().toLocaleDateString("uk-UA"),
      text: input.checked ? `Задачу виконано: ${task.title}.` : `Задачу повернуто в роботу: ${task.title}.`
    });
    renderCaseProfile(item.id);
  }));
  document.querySelectorAll("[data-toggle-task-reminder]").forEach((button) => button.addEventListener("click", async (event) => {
    event.stopPropagation();
    const task = item.tasks[Number(button.dataset.toggleTaskReminder)];
    if (!task) return;
    task.reminder = !task.reminder;
    task.reminderEnabled = task.reminder;
    if (shouldUseApi(state) && task.id) {
      try {
        Object.assign(task, normalizeTask(await saveTaskToApi({ ...task, caseId: item.id, clientId: item.clientId })));
      } catch (_error) {
        showToast?.("Не вдалося зберегти нагадування задачі в базі.", "danger");
        return;
      }
    }
    item.history.unshift({
      date: new Date().toLocaleDateString("uk-UA"),
      text: task.reminder ? `Увімкнено нагадування по задачі: ${task.title}.` : `Вимкнено нагадування по задачі: ${task.title}.`
    });
    renderCaseProfile(item.id);
  }));
  document.querySelectorAll("[data-edit-task]").forEach((button) => button.addEventListener("click", (event) => {
    event.stopPropagation();
    openTaskDialog(item.id, Number(button.dataset.editTask));
  }));
  document.querySelectorAll("[data-delete-task]").forEach((button) => button.addEventListener("click", (event) => {
    event.stopPropagation();
    openDeleteDocumentConfirm({ caseId: item.id, taskIndex: Number(button.dataset.deleteTask), type: "task" });
  }));
  document.querySelectorAll("[data-edit-procedural-action]").forEach((button) => button.addEventListener("click", (event) => {
    event.stopPropagation();
    openEventDialog({ caseId: item.id, clientId: item.clientId }, Number(button.dataset.editProceduralAction));
  }));
  document.querySelectorAll("[data-delete-procedural-action]").forEach((button) => button.addEventListener("click", (event) => {
    event.stopPropagation();
    openDeleteDocumentConfirm({ caseId: item.id, actionIndex: Number(button.dataset.deleteProceduralAction), type: "proceduralAction" });
  }));
  document.querySelectorAll("[data-toggle-folder]").forEach((button) => button.addEventListener("click", () => {
    const folderIndex = Number(button.dataset.toggleFolder);
    state.openFolderIndex = state.openFolderIndex === folderIndex ? null : folderIndex;
    renderCaseProfile(item.id);
  }));
  document.querySelectorAll("[data-edit-folder]").forEach((button) => button.addEventListener("click", (event) => {
    event.stopPropagation();
    openFolderDialog(item.id, Number(button.dataset.editFolder));
  }));
  document.querySelectorAll("[data-delete-folder]").forEach((button) => button.addEventListener("click", (event) => {
    event.stopPropagation();
    openDeleteDocumentConfirm({ caseId: item.id, folderIndex: Number(button.dataset.deleteFolder), type: "folder" });
  }));
  document.querySelectorAll("[data-delete-folder-file]").forEach((button) => button.addEventListener("click", (event) => {
    event.stopPropagation();
    const [folderIndex, fileIndex] = button.dataset.deleteFolderFile.split(":").map(Number);
    openDeleteDocumentConfirm({ caseId: item.id, folderIndex, fileIndex, type: "folderFile" });
  }));
  document.querySelectorAll("[data-delete-procedural-doc]").forEach((button) => button.addEventListener("click", (event) => {
    event.stopPropagation();
    openDeleteDocumentConfirm({ caseId: item.id, docIndex: Number(button.dataset.deleteProceduralDoc), type: "procedural" });
  }));
  document.querySelectorAll("[data-view-document]").forEach((button) => button.addEventListener("click", (event) => {
    event.stopPropagation();
    const payload = getDocumentPayload(item.id, button.dataset.viewDocument);
    openStoredDocument(payload.file || payload.doc, {
      caseId: item.id,
      editContext: payload,
      folderName: payload.folder?.name || payload.linked?.folder?.name,
      returnView: "cases"
    });
  }));
  document.querySelectorAll("[data-export-case-document]").forEach((button) => button.addEventListener("click", (event) => {
    event.stopPropagation();
    const payload = getDocumentPayload(item.id, button.dataset.exportCaseDocument);
    exportStoredDocument?.(payload.file || payload.doc, {
      caseId: item.id,
      editContext: payload,
      folderName: payload.folder?.name || payload.linked?.folder?.name,
      returnView: "cases"
    });
  }));
  document.querySelectorAll("[data-office-case-document]").forEach((button) => button.addEventListener("click", (event) => {
    event.stopPropagation();
    const payload = getDocumentPayload(item.id, button.dataset.officeCaseDocument);
    openOfficeEditor?.(payload.file || payload.doc, {
      caseId: item.id,
      editContext: payload,
      folderName: payload.folder?.name || payload.linked?.folder?.name,
      returnView: "cases"
    });
  }));
  document.querySelectorAll("[data-edit-document]").forEach((button) => button.addEventListener("click", (event) => {
    event.stopPropagation();
    openDocumentDialog(item.id, getDocumentPayload(item.id, button.dataset.editDocument));
  }));
  document.querySelectorAll("[data-copy-case-document]").forEach((button) => button.addEventListener("click", (event) => {
    event.stopPropagation();
    copyDocumentInCase(currentContext, button.dataset.copyCaseDocument);
  }));
  document.querySelectorAll("[data-send-case-document]").forEach((button) => button.addEventListener("click", (event) => {
    event.stopPropagation();
    openDocumentSendDialog(currentContext, button.dataset.sendCaseDocument);
  }));
  document.querySelectorAll("[data-esign-case-document]").forEach((button) => button.addEventListener("click", async (event) => {
    event.stopPropagation();
    await runCaseDocumentESignAction(item, button.dataset.esignCaseDocument);
  }));
  document.querySelectorAll("[data-archive-case-document]").forEach((button) => button.addEventListener("click", (event) => {
    event.stopPropagation();
    openDocumentArchiveDialog(currentContext, button.dataset.archiveCaseDocument);
  }));
  document.querySelector(`[data-edit-finance="${item.id}"]`)?.addEventListener("click", () => openFinanceDialog(item.id));
  document.querySelectorAll(`[data-edit-case-section="${item.id}"]`).forEach((button) => button.addEventListener("click", () => openEssenceDialog(item.id)));
  document.querySelector(`[data-edit-authority="${item.id}"]`)?.addEventListener("click", () => openAuthorityDialog(item.id));
  document.querySelector(`[data-edit-client-row="${client.id}"]`)?.addEventListener("click", () => openClientDialog(client.id));
  syncNavigationState();
}
