import { createInitialState } from "./js/state.js";
import {
  renderClientProfile as renderClientProfileScreen,
  renderClientRows as renderClientRowsScreen,
  renderClientsScreen
} from "./js/screens/clients.js";
import {
  addDays,
  advocatePhoto,
  badge,
  calendarTimeTone,
  calendarTitle,
  calendarToday,
  calendarViewDays,
  currency,
  currencyText,
  dateFromIso,
  documentActionButtons,
  documentStatusControl,
  documentStatusTone,
  formatDate,
  icon,
  isoFromDate,
  makeDocumentId,
  monthNames,
  riskTone,
  semanticTone,
  statusTone,
  taskTone,
  todayIso,
  weekDayNames
} from "./js/ui.js";

const state = await createInitialState();

const NAV_STORAGE_KEY = "advocates-crm-navigation";

const titles = {
  dashboard: "Дашборд",
  cases: "Справи",
  clients: "База клієнтів",
  tasks: "Задачі",
  calendar: "Календар",
  planner: "Планер",
  documents: "Документи",
  mailings: "Розсилка",
  ai: "AI помічники",
  finance: "Фінанси",
  analytics: "Аналітика",
  osint: "OSINT",
  settings: "Налаштування"
};

const $ = (selector) => document.querySelector(selector);
const viewNodes = [...document.querySelectorAll(".view")];
const navNodes = [...document.querySelectorAll(".nav-item")];
const DEMO_URL = "https://vonnabi.github.io/advocates-crm/";

function showToast(message, type = "success") {
  const stack = $("#toast-stack");
  if (!stack || !message) return;
  const node = document.createElement("div");
  node.className = `toast ${type}`;
  node.textContent = message;
  stack.append(node);
  [...stack.children].slice(0, -3).forEach((item) => item.remove());
  requestAnimationFrame(() => node.classList.add("visible"));
  window.setTimeout(() => {
    node.classList.remove("visible");
    node.addEventListener("transitionend", () => node.remove(), { once: true });
  }, 2800);
}

function closeTopbarPanels() {
  [
    ["#notifications-toggle", "#notifications-menu"],
    ["#admin-profile-toggle", "#admin-profile-menu"]
  ].forEach(([toggleSelector, panelSelector]) => {
    const toggle = $(toggleSelector);
    const panel = $(panelSelector);
    if (!toggle || !panel) return;
    toggle.classList.remove("active");
    toggle.setAttribute("aria-expanded", "false");
    panel.classList.remove("open");
    panel.hidden = true;
  });
}

function toggleTopbarPanel(toggleSelector, panelSelector) {
  const toggle = $(toggleSelector);
  const panel = $(panelSelector);
  if (!toggle || !panel) return;
  const willOpen = panel.hidden;
  closeTopbarPanels();
  panel.hidden = !willOpen;
  panel.classList.toggle("open", willOpen);
  toggle.classList.toggle("active", willOpen);
  toggle.setAttribute("aria-expanded", String(willOpen));
}

function markNotificationRead() {
  const badge = $("#notifications-count");
  if (!badge) return;
  const nextCount = Math.max(Number(badge.textContent) - 1, 0);
  badge.textContent = String(nextCount);
  badge.classList.toggle("empty", nextCount === 0);
}

function toggleSidebar() {
  const collapsed = document.body.classList.toggle("sidebar-collapsed");
  saveNavigationState();
  showToast(collapsed ? "Бокове меню згорнуто." : "Бокове меню розгорнуто.");
}

async function copyDemoLink() {
  try {
    await navigator.clipboard.writeText(DEMO_URL);
    showToast("Ссылка для заказчика скопирована.");
  } catch (error) {
    window.prompt("Скопируйте ссылку для заказчика:", DEMO_URL);
  }
}

function clientById(id) {
  return state.clients.find((client) => client.id === Number(id));
}

function caseById(id) {
  return state.cases.find((item) => item.id === id);
}

function screenContext() {
  return {
    state,
    $,
    icon,
    badge,
    statusTone,
    advocatePhoto,
    openClientDialog
  };
}

function allCaseTasks() {
  const tasks = state.cases.flatMap((item) => {
    const client = clientById(item.clientId);
    return item.tasks.map((task, index) => {
      const dueIso = parseDisplayDate(task.due);
      const dueDate = dueIso ? new Date(`${dueIso}T00:00:00`) : null;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const completed = task.status === "Виконано";
      const overdue = Boolean(dueDate && dueDate < today && !completed);
      const responsible = task.responsible || item.responsible || client?.manager || "Не вказано";
      return {
        ...task,
        key: `${item.id}:${index}`,
        caseId: item.id,
        taskIndex: index,
        caseTitle: item.title,
        caseType: item.type,
        clientName: client?.name || "Клієнт не вказаний",
        responsible,
        dueText: task.due || "Не вказано",
        overdue,
        completed,
        priority: task.status === "Терміново" || task.status === "Срочно" ? "Високий" : task.status === "Не срочно" ? "Низький" : "Середній"
      };
    });
  });
  const existingKeys = new Set(tasks.map((task) => task.key));
  state.taskOrder = state.taskOrder.filter((key) => existingKeys.has(key));
  tasks.forEach((task) => {
    if (!state.taskOrder.includes(task.key)) state.taskOrder.push(task.key);
  });
  return tasks.sort((a, b) => state.taskOrder.indexOf(a.key) - state.taskOrder.indexOf(b.key));
}

function renderDashboard() {
  const activeCases = state.cases.filter((item) => item.status !== "Закрито").length;
  const debt = state.cases.reduce((sum, item) => sum + item.debt, 0);
  const income = state.cases.reduce((sum, item) => sum + item.income, 0);
  const telegram = state.clients.filter((client) => client.telegram).length;

  $("#dashboard").innerHTML = `
    <div class="grid cols-4">
      <div class="metric"><span>Клієнтів у базі</span><strong>${state.clients.length}</strong></div>
      <div class="metric"><span>Активних справ</span><strong>${activeCases}</strong></div>
      <div class="metric"><span>Telegram підключено</span><strong>${telegram}</strong></div>
      <div class="metric"><span>Заборгованість</span><strong>${currency(debt)}</strong></div>
    </div>
    <div class="layout" style="margin-top:16px">
      <div class="panel">
        <div class="toolbar">
          <h2>Найближчі події</h2>
          <button class="secondary" data-view-link="calendar">Відкрити календар</button>
        </div>
        <div class="list">
          ${state.events.slice(0, 5).map((event) => {
            const client = clientById(event.clientId);
            return `<div class="list-item">
              <strong>${event.time} · ${event.title}</strong>
              <p class="muted">${event.date} · ${client.name} · Справа №${event.caseId}</p>
              ${badge(event.status)}
            </div>`;
          }).join("")}
        </div>
      </div>
      <div class="panel">
        <h2>Фінансовий зріз</h2>
        <div class="profile">
          <div class="profile-line"><span>Дохід по активних справах</span><strong>${currency(income)}</strong></div>
          <div class="profile-line"><span>Очікується оплата</span><strong>${currency(debt)}</strong></div>
          <div class="profile-line"><span>Маржинальність демо</span><strong>68%</strong></div>
          <button class="primary" data-view-link="finance">Перейти до фінансів</button>
        </div>
      </div>
    </div>
  `;
}

function renderClients() {
  renderClientsScreen(screenContext());
}

function renderClientRows() {
  renderClientRowsScreen(screenContext());
}

function renderClientProfile(id) {
  renderClientProfileScreen(screenContext(), id);
}

function renderCases() {
  const selected = caseById(state.selectedCaseId) || state.cases[0];
  $("#cases").innerHTML = `
    <div class="case-reference-screen" id="case-detail"></div>
  `;
  if (state.caseScreen === "detail") {
    renderCaseProfile(selected.id);
    syncNavigationState();
    return;
  }
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

function caseFinance(item) {
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
        <button class="case-row-icon" data-edit-finance="${item.id}" title="Редагувати фінанси">${icon("edit")}</button>
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

function caseMaterialBadges(item) {
  const documents = caseDocumentsCount(item);
  const events = caseProceduralItems(item).length;
  return `
    <span class="case-material-badge blue">Док ${documents}</span>
    <span class="case-material-badge amber">Зад ${item.tasks.length}</span>
    <span class="case-material-badge violet">Под ${events}</span>
  `;
}

function casePreviewDocuments(item) {
  const rows = caseFolders(item).flatMap((folder, folderIndex) =>
    folder.files.map((file, fileIndex) => ({ folder, folderIndex, file, fileIndex }))
  );
  if (!rows.length) return `<p class="preview-empty">Документів поки немає</p>`;
  return rows.map(({ folder, folderIndex, file, fileIndex }) => `
    <div class="preview-list-row preview-document-row">
      <div>
        <div class="preview-document-title">${icon("file")}<strong>${file.name}</strong></div>
        <span class="preview-document-meta">${folder.name} ${badge(file.status || "Без статусу", documentStatusTone(file.status))}</span>
      </div>
      <div class="folder-actions preview-row-actions">
        <button type="button" data-preview-view-document="${item.id}|folder:${folderIndex}:${fileIndex}" title="Посмотреть">${icon("eye")}</button>
        <button type="button" data-preview-edit-document="${item.id}|folder:${folderIndex}:${fileIndex}" title="Редактировать">${icon("edit")}</button>
        <button type="button" class="danger-icon" data-preview-delete-document="${item.id}|${folderIndex}:${fileIndex}" title="Удалить">${icon("trash")}</button>
      </div>
    </div>
  `).join("");
}

function casePreviewTasks(item) {
  if (!item.tasks.length) return `<p class="preview-empty">Задач поки немає</p>`;
  return item.tasks.map((task) => `
    <div class="preview-list-row">
      <div>
        <strong>${task.title}</strong>
        <span>${task.due || "Без строку"} · ${task.responsible || item.responsible}</span>
      </div>
      ${badge(task.status, taskTone(task.status))}
    </div>
  `).join("");
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
        <button type="button" class="preview-finance-edit" data-preview-finance="${item.id}" title="Редагувати фінанси">${icon("edit")}</button>
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
  const finance = caseFinance(item);
  const financeStatus = financePreviewStatus(item);
  return `
    <article class="case-card case-preview-card">
      <div class="case-preview-head">
        <h3 class="case-preview-title">Картка справи</h3>
        ${badge(item.status, semanticTone(item.status))}
      </div>
      <div class="case-preview-meta">
        <span class="case-preview-number">№${item.id}</span>
        <span class="muted">відкрито ${item.opened}</span>
      </div>
      <div class="case-preview-rows">
        <div><span>Клієнт</span><strong>${client?.name || "Не вказано"}</strong></div>
        <div><span>Тип</span><strong>${item.type}</strong></div>
        <div><span>Етап</span><strong>${item.stage}</strong></div>
        <div><span>Відповідальний</span><strong>${item.responsible}</strong></div>
        <div><span>Суд / орган</span><strong>${item.court}</strong></div>
        <div><span>Дедлайн</span><strong>${item.deadline}</strong></div>
        <div><span>Пріоритет</span>${badge(item.priority, priorityTone(item.priority))}</div>
      </div>
      <div class="case-preview-summary">
        <h2>${item.title}</h2>
        <p>${item.description}</p>
      </div>
      <div class="case-preview-links">
        <button type="button" data-preview-open="${item.id}" class="case-preview-open"><span>${icon("eye")}</span><strong>Відкрити картку</strong></button>
        <details class="case-preview-accordion finance-preview-line">
          <summary><span>›</span><strong>Фінанси</strong><em class="finance-status-pill ${financeStatus.tone}">${financeStatus.text}</em></summary>
          ${casePreviewFinance(item)}
        </details>
        <details class="case-preview-accordion">
          <summary><span>›</span><strong>Документи</strong><em>${caseDocumentsCount(item)}</em></summary>
          <div class="preview-list">${casePreviewDocuments(item)}</div>
        </details>
        <details class="case-preview-accordion">
          <summary><span>›</span><strong>Задачі</strong><em>${item.tasks.length}</em></summary>
          <div class="preview-list">${casePreviewTasks(item)}</div>
        </details>
        <details class="case-preview-accordion">
          <summary><span>›</span><strong>Історія справи</strong><em>${item.history.length}</em></summary>
          <div class="preview-list">${casePreviewHistory(item)}</div>
        </details>
      </div>
    </article>
  `;
}

function renderCaseList() {
  const selectedPageSize = $("#case-page-size")?.value || String(state.casePageSize || 6);
  const activeFilterId = document.activeElement?.id;
  const cursorPosition = activeFilterId === "case-search" ? $("#case-search")?.selectionStart : null;
  const selectedStatus = $("#case-status-filter")?.value || "";
  const selectedType = $("#case-type-filter")?.value || "";
  const selectedResponsible = $("#case-responsible-filter")?.value || "";
  const query = ($("#case-search")?.value || "").toLowerCase();
  const filteredCases = state.cases
    .filter((item) => {
      const client = clientById(item.clientId);
      const text = `${item.id} ${client?.name} ${item.title} ${item.type} ${item.status} ${item.court} ${item.responsible}`.toLowerCase();
      return (!query || text.includes(query))
        && (!selectedStatus || item.status === selectedStatus)
        && (!selectedType || item.type === selectedType)
        && (!selectedResponsible || item.responsible === selectedResponsible);
    });
  const pageSize = selectedPageSize === "all" ? Math.max(filteredCases.length, 1) : Number(selectedPageSize);
  const totalPages = Math.max(1, Math.ceil(filteredCases.length / pageSize));
  state.casePage = Math.min(Math.max(1, state.casePage || 1), totalPages);
  const pageStart = (state.casePage - 1) * pageSize;
  const pageCases = filteredCases.slice(pageStart, pageStart + pageSize);
  const selected = pageCases.find((item) => item.id === state.selectedCaseId) || pageCases[0] || filteredCases[0] || state.cases[0];
  if (selected) state.selectedCaseId = selected.id;
  const rows = pageCases
    .map((item) => {
      const client = clientById(item.clientId);
      return `<tr class="${item.id === selected.id ? "selected" : ""}" data-preview-case="${item.id}">
        <td>
          <div class="case-number-cell">
            <a href="#" data-open-case="${item.id}">№${item.id}</a>
            <span class="case-row-actions">
              <button type="button" data-open-case="${item.id}" title="Посмотреть" aria-label="Посмотреть справу">${icon("eye")}</button>
              <button type="button" data-edit-case-row="${item.id}" title="Редактировать" aria-label="Редактировать справу">${icon("edit")}</button>
              <button type="button" class="danger-icon" data-delete-case="${item.id}" title="Удалить" aria-label="Удалить справу">${icon("trash")}</button>
            </span>
          </div>
          <span>${item.opened}</span>
        </td>
        <td><strong>${client?.name || "Не вказано"}</strong><span>${item.responsible}</span></td>
        <td><strong>${item.title}</strong><span>${item.type}</span></td>
        <td>${item.stage}</td>
        <td><div class="case-materials">${caseMaterialBadges(item)}</div></td>
        <td>${item.deadline}</td>
        <td>${badge(item.priority, priorityTone(item.priority))}</td>
        <td>${badge(item.status, statusTone(item.status))}</td>
        <td>${caseFinanceSummary(item)}</td>
      </tr>`;
    }).join("");
  const urgentCases = state.cases.filter((item) => item.priority === "Високий" || item.status === "Терміново").length;
  const totalTasks = state.cases.reduce((sum, item) => sum + item.tasks.length, 0);
  const totalDebt = state.cases.reduce((sum, item) => sum + item.debt, 0);
  $("#case-detail").innerHTML = `
    <div class="case-list-screen">
      <div class="case-list-head">
        <div class="case-list-global-search">
          <input id="case-search" value="${$("#case-search")?.value || ""}" placeholder="Пошук клієнта, справи, події..." />
          <button class="icon-button" type="button">${icon("filter")}</button>
          <button class="primary" id="create-case-from-list">+ Додати справу</button>
        </div>
      </div>
      <div class="case-kpi-grid">
        <article><span>Усього справ</span><strong>${state.cases.length}</strong></article>
        <article><span>Термінові</span><strong>${urgentCases}</strong></article>
        <article><span>Задач по справах</span><strong>${totalTasks}</strong></article>
        <article><span>Борг по справах</span><strong>${currency(totalDebt)}</strong></article>
      </div>
      <div class="case-list-toolbar">
        <input id="case-list-search-secondary" value="${$("#case-search")?.value || ""}" placeholder="Пошук справи..." />
        <select id="case-status-filter">
          <option value="">Всі статуси</option>
          ${[...new Set(state.cases.map((item) => item.status))].map((status) => `<option value="${status}" ${status === selectedStatus ? "selected" : ""}>${status}</option>`).join("")}
        </select>
        <select id="case-type-filter">
          <option value="">Всі типи</option>
          ${[...new Set(state.cases.map((item) => item.type))].map((type) => `<option value="${type}" ${type === selectedType ? "selected" : ""}>${type}</option>`).join("")}
        </select>
        <select id="case-responsible-filter">
          <option value="">Всі адвокати</option>
          ${[...new Set(state.cases.map((item) => item.responsible).filter(Boolean))].map((responsible) => `<option value="${responsible}" ${responsible === selectedResponsible ? "selected" : ""}>${responsible}</option>`).join("")}
        </select>
      </div>
      <div class="case-list-layout">
        <article class="case-card case-list-card">
          <div class="table-wrap">
            <table class="case-list-table">
              <thead>
                <tr>
                  <th>Номер</th>
                  <th>Клієнт</th>
                  <th>Назва</th>
                  <th>Етап</th>
                  <th>Матеріали</th>
                  <th>Дедлайн</th>
                  <th>Пріоритет</th>
                  <th>Статус</th>
                  <th>Фінанси</th>
                </tr>
              </thead>
              <tbody>${rows || `<tr><td colspan="9">Справ не знайдено</td></tr>`}</tbody>
            </table>
          </div>
          <div class="case-pagination">
            <div class="case-pagination-left">
              <span>Показано ${filteredCases.length ? pageStart + 1 : 0}-${Math.min(pageStart + pageSize, filteredCases.length)} з ${filteredCases.length}</span>
              <select id="case-page-size">
                ${[6, 10, 20, 30].map((size) => `<option value="${size}" ${String(size) === selectedPageSize ? "selected" : ""}>${size} на сторінці</option>`).join("")}
                <option value="all" ${selectedPageSize === "all" ? "selected" : ""}>Усі справи</option>
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
  $("#create-case-from-list")?.addEventListener("click", () => openCaseDialog());
  $("#case-list-search-secondary")?.addEventListener("input", (event) => {
    $("#case-search").value = event.currentTarget.value;
    state.casePage = 1;
    renderCaseList();
  });
  ["#case-search", "#case-status-filter", "#case-type-filter", "#case-responsible-filter", "#case-page-size"].forEach((selector) => {
    $(selector)?.addEventListener("input", () => {
      if (selector === "#case-page-size") state.casePageSize = $("#case-page-size").value;
      state.casePage = 1;
      renderCaseList();
    });
    $(selector)?.addEventListener("change", () => {
      if (selector === "#case-page-size") state.casePageSize = $("#case-page-size").value;
      state.casePage = 1;
      renderCaseList();
    });
  });
  if (activeFilterId) {
    const activeFilter = document.getElementById(activeFilterId);
    activeFilter?.focus();
    if (activeFilterId === "case-search" && cursorPosition !== null) {
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
  document.querySelectorAll("[data-preview-view-document]").forEach((node) => node.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const [caseId, encoded] = node.dataset.previewViewDocument.split("|");
    const payload = getDocumentPayload(caseId, encoded);
    openStoredDocument(payload.file || payload.doc);
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
    openDeleteDocumentConfirm({ caseId, folderIndex, fileIndex, type: "folder" });
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
  document.querySelectorAll("[data-preview-case]").forEach((node) => node.addEventListener("click", (event) => {
    event.preventDefault();
    if (event.target.closest("a,button")) return;
    state.selectedCaseId = node.dataset.previewCase;
    renderCaseList();
  }));
  document.querySelectorAll("[data-case-page]").forEach((node) => node.addEventListener("click", () => {
    state.casePage = Number(node.dataset.casePage);
    renderCaseList();
  }));
}

function caseActionRows(item) {
  if (!item.tasks.length) {
    return `<tr><td colspan="6" class="empty-cell">Запланованих дій поки немає</td></tr>`;
  }
  return item.tasks.map((task, index) => `<tr class="task-action-row ${task.status === "Виконано" ? "task-done-row" : ""}">
    <td><input type="checkbox" data-toggle-task-done="${index}" aria-label="${task.title}" ${task.status === "Виконано" ? "checked" : ""} /></td>
    <td>
      <span class="row-title-with-actions">
        <span class="row-title-text">${task.title}</span>
        <span class="hover-row-actions">
          <button class="case-row-icon" data-edit-task="${index}" title="Редагувати задачу">${icon("edit")}</button>
          <button class="case-row-icon danger-icon" data-delete-task="${index}" title="Видалити задачу">${icon("trash")}</button>
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

function caseProceduralItems(item) {
  if (Array.isArray(item.proceduralActions)) return item.proceduralActions;
  if (!String(item.id).startsWith("2024/")) return [];
  return [
    ["Подано адміністративний позов", "Адвокат", "15.05.2024", "20.05.2024", "В процесі", "amber"],
    ["Клопотання про забезпечення позову", "Адвокат", "16.05.2024", "19.05.2024", "Не розпочато", ""],
    ["Отримання витребуваних документів", "Суд", "17.05.2024", "27.05.2024", "Не розпочато", ""],
    ["Судове засідання", "Суд", "-", "10.06.2024", "Заплановано", "blue"]
  ];
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
          <button class="case-row-icon" data-edit-procedural-action="${index}" title="Редагувати процесуальну дію">${icon("edit")}</button>
          <button class="case-row-icon danger-icon" data-delete-procedural-action="${index}" title="Видалити процесуальну дію">${icon("trash")}</button>
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
  if (!item.documents.length) {
    return `<tr><td colspan="4" class="empty-cell">Процесуальних документів поки немає</td></tr>`;
  }
  return item.documents.map((doc, docIndex) => `<tr class="procedural-doc-row">
    <td>
      <span class="procedural-doc-name">
        <span class="procedural-doc-title">${doc.name}</span>
        <span class="procedural-actions">
          ${documentActionButtons("procedural", docIndex)}
          <button type="button" class="danger-icon" data-delete-procedural-doc="${docIndex}" title="Удалить" aria-label="Удалить документ">${icon("trash")}</button>
        </span>
      </span>
    </td>
    <td>${doc.submitted || "-"}</td>
    <td>${doc.responseDue || "-"}</td>
    <td>${badge(doc.status, documentStatusTone(doc.status))}</td>
  </tr>`).join("");
}

function caseFolders(item) {
  if (!item.folders) {
    if (!String(item.id).startsWith("2024/")) {
      item.folders = [];
      return item.folders;
    }
    item.folders = [
      {
        name: "Позови",
        updated: "17.05.2024",
        files: [
          { name: "Адміністративний позов.docx", status: "Чернетка", updated: "17.05.2024" },
          { name: "Додатки до позову.pdf", status: "Готово", updated: "17.05.2024" },
          { name: "Квитанція судового збору.pdf", status: "Потрібно перевірити", updated: "16.05.2024" }
        ]
      },
      {
        name: "Клопотання",
        updated: "16.05.2024",
        files: [
          { name: "Клопотання про забезпечення позову.docx", status: "В роботі", updated: "16.05.2024" },
          { name: "Проєкт додатків.docx", status: "Чернетка", updated: "16.05.2024" }
        ]
      },
      {
        name: "Запити",
        updated: "17.05.2024",
        files: [
          { name: "Запит документів до ТЦК.docx", status: "Подано", updated: "17.05.2024" },
          { name: "Адвокатський запит до ВЛК.docx", status: "Чернетка", updated: "16.05.2024" },
          { name: "Вхідний опис документів.pdf", status: "Отримано", updated: "15.05.2024" },
          { name: "Поштова квитанція.pdf", status: "Отримано", updated: "17.05.2024" }
        ]
      },
      {
        name: "Відповіді та ухвали",
        updated: "15.05.2024",
        files: [{ name: "Ухвала про відкриття провадження.pdf", status: "Отримано", updated: "15.05.2024" }]
      },
      {
        name: "Інші документи",
        updated: "12.05.2024",
        files: [
          { name: "Паспорт клієнта.pdf", status: "Отримано", updated: "12.05.2024" },
          { name: "ІПН клієнта.pdf", status: "Отримано", updated: "12.05.2024" }
        ]
      }
    ];
  }
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
            <button type="button" data-edit-folder="${index}" title="Редактировать папку" aria-label="Редактировать папку">${icon("edit")}</button>
            <button type="button" class="danger-icon" data-delete-folder="${index}" title="Удалить папку" aria-label="Удалить папку">${icon("trash")}</button>
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
              ${documentActionButtons("folder", index, fileIndex)}
              <button type="button" class="danger-icon" data-delete-folder-file="${index}:${fileIndex}" title="Удалить" aria-label="Удалить документ">${icon("trash")}</button>
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
          <div class="case-card-title"><span>1. КЛІЄНТ</span><button class="case-row-icon" data-edit-client-row="${client.id}" title="Редагувати клієнта">${icon("edit")}</button></div>
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
          <div class="case-card-title"><span>2. СУТЬ СПРАВИ</span><button class="case-row-icon" data-edit-case-section="${item.id}" title="Редагувати суть справи">${icon("edit")}</button></div>
          <p>${item.description}</p>
        </article>
        <article class="case-card">
          <div class="case-card-title"><span>3. ОРГАН, ДО ЯКОГО ЗВЕРНЕННЯ</span><button class="case-row-icon" data-edit-authority="${item.id}" title="Редагувати орган">${icon("edit")}</button></div>
          <div class="authority-box">
            <div class="authority-icon">▥</div>
            <strong>${item.court}</strong>
          </div>
          <p class="muted">Тип органу: ${item.authorityType || "Не вказано"}</p>
          <p class="muted">Адреса: ${item.authorityAddress || "Не вказано"}</p>
          <p class="muted">Контакт: ${item.authorityContact || "Не вказано"}</p>
        </article>
      </section>
      <section class="case-main-column">
        <article class="case-card">
          <h3>4. ЗАПЛАНОВАНІ ДІЇ</h3>
          <div class="case-tabs"><button class="active">Всі</button><button>Срочні</button><button>Не срочні</button></div>
          <div class="case-table-wrap">
            <table class="case-inner-table case-actions-table"><tbody>${caseActionRows(item)}</tbody></table>
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
  document.querySelectorAll("[data-toggle-task-done]").forEach((input) => input.addEventListener("change", () => {
    const task = item.tasks[Number(input.dataset.toggleTaskDone)];
    if (!task) return;
    task.status = input.checked ? "Виконано" : "Очікує";
    item.history.unshift({
      date: new Date().toLocaleDateString("uk-UA"),
      text: input.checked ? `Задачу виконано: ${task.title}.` : `Задачу повернуто в роботу: ${task.title}.`
    });
    renderCaseProfile(item.id);
  }));
  document.querySelectorAll("[data-toggle-task-reminder]").forEach((button) => button.addEventListener("click", (event) => {
    event.stopPropagation();
    const task = item.tasks[Number(button.dataset.toggleTaskReminder)];
    if (!task) return;
    task.reminder = !task.reminder;
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
    openDeleteDocumentConfirm({ caseId: item.id, folderIndex, fileIndex, type: "folder" });
  }));
  document.querySelectorAll("[data-delete-procedural-doc]").forEach((button) => button.addEventListener("click", (event) => {
    event.stopPropagation();
    openDeleteDocumentConfirm({ caseId: item.id, docIndex: Number(button.dataset.deleteProceduralDoc), type: "procedural" });
  }));
  document.querySelectorAll("[data-view-document]").forEach((button) => button.addEventListener("click", (event) => {
    event.stopPropagation();
    const payload = getDocumentPayload(item.id, button.dataset.viewDocument);
    openStoredDocument(payload.file || payload.doc);
  }));
  document.querySelectorAll("[data-edit-document]").forEach((button) => button.addEventListener("click", (event) => {
    event.stopPropagation();
    openDocumentDialog(item.id, getDocumentPayload(item.id, button.dataset.editDocument));
  }));
  document.querySelector(`[data-edit-finance="${item.id}"]`)?.addEventListener("click", () => openFinanceDialog(item.id));
  document.querySelectorAll(`[data-edit-case-section="${item.id}"]`).forEach((button) => button.addEventListener("click", () => openEssenceDialog(item.id)));
  document.querySelector(`[data-edit-authority="${item.id}"]`)?.addEventListener("click", () => openAuthorityDialog(item.id));
  document.querySelector(`[data-edit-client-row="${client.id}"]`)?.addEventListener("click", () => openClientDialog(client.id));
  syncNavigationState();
}

function eventClass(event) {
  if (event.source === "task") return "task";
  if (event.type.includes("Зустр") || event.type.includes("Консульта")) return "meeting";
  if (event.type.includes("Суд")) return "court";
  if (event.type.includes("строк")) return "deadline";
  if (event.type.includes("документ") || event.type.includes("Документ")) return "doc";
  if (event.type.includes("Ожид") || event.type.includes("Очіку")) return "waiting";
  return "other";
}

function calendarEventTypes() {
  return [
    "Судове засідання",
    "Зустріч з клієнтом",
    "Консультація",
    "Підготовка документа",
    "Крайній строк",
    "Ожидання відповіді від органу",
    "Внутрішня задача",
    "Інше"
  ];
}

function calendarStatuses() {
  return ["Заплановано", "Очікує виконання", "Виконано", "Перенесено", "Скасовано", "Просрочено"];
}

function responsibleNames() {
  return [...new Set([
    ...state.cases.map((item) => item.responsible),
    ...state.cases.flatMap((item) => item.tasks.map((task) => task.responsible)),
    "Іваненко А.Ю.",
    "Мельник Н.П.",
    "Кравчук А.В.",
    "Петренко С.В."
  ].filter(Boolean))];
}

function addMinutesToTime(time, minutes) {
  const [hour = 9, minute = 0] = String(time || "09:00").split(":").map(Number);
  const date = new Date(2024, 0, 1, hour, minute + minutes);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function calendarEventMeta(event) {
  const caseItem = caseById(event.caseId);
  return {
    client: clientById(event.clientId),
    caseItem,
    authority: event.authority || caseItem?.court || "Не вказано",
    location: event.location || event.authorityAddress || caseItem?.authorityAddress || event.description || "Не вказано",
    responsible: event.responsible || caseItem?.responsible || "Іваненко А.Ю.",
    endTime: event.endTime || addMinutesToTime(event.time, event.type?.includes("Суд") ? 90 : 60),
    recurrence: event.recurrence || "Не повторювати",
    reminderBefore: event.reminderBefore || "За 1 день",
    reminderChannels: event.reminderChannels || (event.source === "task" ? "CRM" : "CRM + Telegram + SMS"),
    reminderRecipients: event.reminderRecipients || "Відповідальний юрист + клієнт"
  };
}

function calendarReminderRows(event) {
  const meta = calendarEventMeta(event);
  const channels = String(meta.reminderChannels).split("+").map((item) => item.trim());
  const beforeOptions = channels.length > 2 ? [meta.reminderBefore, "За 1 день", "За 1 годину"] : channels.map(() => meta.reminderBefore);
  return channels.map((channel, index) => ({
    channel,
    before: beforeOptions[index] || meta.reminderBefore,
    recipient: meta.reminderRecipients,
    scheduledAt: reminderScheduledAt(event, beforeOptions[index] || meta.reminderBefore),
    status: event.source === "task" ? "Очікує" : "Увімкнено"
  }));
}

function reminderOffsetHours(before) {
  if (before.includes("1 год")) return 1;
  if (before.includes("3 год")) return 3;
  if (before.includes("1 день")) return 24;
  if (before.includes("3 д")) return 72;
  if (before.includes("7 д")) return 168;
  return 24;
}

function reminderScheduledAt(event, before) {
  const [year, month, day] = String(event.date).split("-").map(Number);
  const [hour = 9, minute = 0] = String(event.time || "09:00").split(":").map(Number);
  const date = new Date(year, month - 1, day, hour - reminderOffsetHours(before), minute);
  return `${date.toLocaleDateString("uk-UA")} о ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function eventTimeLeftLabel(event) {
  const now = dateFromIso(calendarToday);
  const eventDate = dateFromIso(event.date);
  const diffHours = Math.ceil((eventDate - now) / 3600000);
  const diffDays = Math.ceil((eventDate - now) / 86400000);
  if (diffHours < 0) return "Просрочено";
  if (diffHours <= 24) return diffHours <= 1 ? "Менше години" : `Через ${diffHours} год.`;
  return diffDays === 1 ? "Через 1 день" : `Через ${diffDays} дні`;
}

function taskCalendarEntries() {
  return state.cases.flatMap((item) => item.tasks.map((task, index) => {
    const date = parseDisplayDate(task.due);
    if (!task.showInCalendar || !date) return null;
    const client = clientById(item.clientId);
    const [, month, day] = date.split("-");
    return {
      id: `task-${item.id}-${index}`,
      source: "task",
      taskIndex: index,
      day: Number(day),
      date,
      time: task.due?.match(/\d{1,2}:\d{2}/)?.[0] || "09:00",
      title: task.title,
      type: "Внутрішня задача",
      clientId: item.clientId,
      caseId: item.id,
      description: `Задача по справі №${item.id}. Відповідальний: ${task.responsible || item.responsible}.`,
      status: task.status,
      month
    };
  }).filter(Boolean));
}

function calendarEntries() {
  return [
    ...state.events.map((event) => ({ ...event, id: `event-${event.id}`, source: "event", month: event.date.slice(5, 7) })),
    ...taskCalendarEntries()
  ];
}

function renderCalendar() {
  const entries = calendarEntries();
  const mode = state.calendarMode || "month";
  const activeDate = dateFromIso(state.calendarDate || calendarToday);
  const query = (state.calendarQuery || "").toLowerCase().trim();
  const filter = state.calendarFilter || "all";
  const clientFilter = state.calendarClientFilter || "all";
  const caseFilter = state.calendarCaseFilter || "all";
  const responsibleFilter = state.calendarResponsibleFilter || "all";
  const statusFilter = state.calendarStatusFilter || "all";
  const authorityFilter = (state.calendarAuthorityFilter || "").toLowerCase().trim();
  const filtered = entries.filter((event) => {
    const meta = calendarEventMeta(event);
    const byQuery = !query || [event.title, event.type, event.status, event.description, meta.client?.name, meta.caseItem?.title, event.caseId, meta.authority, meta.location]
      .some((value) => String(value || "").toLowerCase().includes(query));
    const byFilter =
      filter === "all" ||
      (filter === "task" && event.source === "task") ||
      (filter === "event" && event.source === "event") ||
      (filter === "court" && event.type.includes("Суд")) ||
      (filter === "deadline" && event.type.includes("строк")) ||
      event.type === filter;
    const byClient = clientFilter === "all" || String(event.clientId) === clientFilter;
    const byCase = caseFilter === "all" || event.caseId === caseFilter;
    const byResponsible = responsibleFilter === "all" || meta.responsible === responsibleFilter;
    const byStatus = statusFilter === "all" || event.status === statusFilter;
    const byAuthority = !authorityFilter || meta.authority.toLowerCase().includes(authorityFilter);
    const byOverdue = !state.calendarOverdueOnly || event.status === "Просрочено" || dateFromIso(event.date) < dateFromIso(calendarToday);
    return byQuery && byFilter && byClient && byCase && byResponsible && byStatus && byAuthority && byOverdue;
  });
  const calendarDays = calendarViewDays(activeDate, mode);
  const visibleIso = new Set(calendarDays.map((cell) => cell.iso));
  const visibleEvents = mode === "list"
    ? [...filtered].sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
    : filtered.filter((event) => visibleIso.has(event.date));
  const upcoming = [...filtered].sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)).slice(0, 4);
  const selected = visibleEvents.find((event) => event.id === state.selectedEventId) || visibleEvents[0] || filtered.find((event) => event.id === state.selectedEventId) || filtered[0] || entries[0];
  const gridStyle = `--calendar-columns:${mode === "day" ? 1 : 7};`;
  const pickerYears = Array.from({ length: 11 }, (_, index) => activeDate.getFullYear() - 5 + index);
  const caseOptions = state.cases.map((item) => `<option value="${item.id}" ${caseFilter === item.id ? "selected" : ""}>№${item.id}</option>`).join("");
  const clientOptions = state.clients.map((client) => `<option value="${client.id}" ${clientFilter === String(client.id) ? "selected" : ""}>${client.name}</option>`).join("");
  const responsibleOptions = responsibleNames().map((name) => `<option value="${name}" ${responsibleFilter === name ? "selected" : ""}>${name}</option>`).join("");
  $("#calendar").innerHTML = `
    <div class="calendar-screen">
      <div class="calendar-toolbar">
        <button class="primary" id="add-event">+ Додати подію</button>
        <div class="calendar-mode-group">
          <button class="secondary ${mode === "day" ? "active" : ""}" data-calendar-mode="day">День</button>
          <button class="secondary ${mode === "week" ? "active" : ""}" data-calendar-mode="week">Тиждень</button>
          <button class="secondary ${mode === "month" ? "active" : ""}" data-calendar-mode="month">Місяць</button>
          <button class="secondary ${mode === "list" ? "active" : ""}" data-calendar-mode="list">Список</button>
        </div>
        <button class="secondary" data-calendar-today>Сьогодні</button>
        <div class="calendar-arrows"><button class="secondary" data-calendar-step="-1">‹</button><button class="secondary" data-calendar-step="1">›</button></div>
        <div class="calendar-date-picker">
          <button type="button" class="calendar-title-button" data-calendar-picker>${calendarTitle(activeDate, mode)} <span>⌄</span></button>
          ${state.calendarPickerOpen ? `<div class="calendar-picker-menu">
            <div class="calendar-picker-column">
              <span>Місяць</span>
              ${monthNames.map((name, index) => `<button type="button" class="${index === activeDate.getMonth() ? "active" : ""}" data-calendar-month="${index}">${name}</button>`).join("")}
            </div>
            <div class="calendar-picker-column year-column">
              <span>Рік</span>
              ${pickerYears.map((year) => `<button type="button" class="${year === activeDate.getFullYear() ? "active" : ""}" data-calendar-year="${year}">${year}</button>`).join("")}
            </div>
          </div>` : ""}
        </div>
        <input id="calendar-search" type="search" value="${state.calendarQuery || ""}" placeholder="Пошук подій, справ, клієнтів..." />
      </div>
      <div class="calendar-filter-panel">
        <select id="calendar-filter" aria-label="Фільтр подій">
          <option value="all" ${filter === "all" ? "selected" : ""}>Усі події</option>
          <option value="task" ${filter === "task" ? "selected" : ""}>Задачі</option>
          <option value="event" ${filter === "event" ? "selected" : ""}>Події</option>
          <option value="court" ${filter === "court" ? "selected" : ""}>Судові</option>
          <option value="deadline" ${filter === "deadline" ? "selected" : ""}>Дедлайни</option>
          ${calendarEventTypes().map((type) => `<option value="${type}" ${filter === type ? "selected" : ""}>${type}</option>`).join("")}
        </select>
        <select id="calendar-client-filter" aria-label="Фільтр клієнтів"><option value="all">Усі клієнти</option>${clientOptions}</select>
        <select id="calendar-case-filter" aria-label="Фільтр справ"><option value="all">Усі справи</option>${caseOptions}</select>
        <select id="calendar-responsible-filter" aria-label="Фільтр відповідальних"><option value="all">Усі відповідальні</option>${responsibleOptions}</select>
        <select id="calendar-status-filter" aria-label="Фільтр статусів"><option value="all">Усі статуси</option>${calendarStatuses().map((status) => `<option value="${status}" ${statusFilter === status ? "selected" : ""}>${status}</option>`).join("")}</select>
        <input id="calendar-authority-filter" value="${state.calendarAuthorityFilter || ""}" placeholder="Орган / суд / ТЦК" />
        <label class="calendar-overdue-filter"><input id="calendar-overdue-filter" type="checkbox" ${state.calendarOverdueOnly ? "checked" : ""} /> Просрочені</label>
      </div>
      <div class="calendar-layout">
        <div class="calendar-left-stack">
          <div class="panel calendar-main-card">
            ${mode === "list" ? `
            <div class="calendar-list-view">
              ${visibleEvents.map((event) => {
                const meta = calendarEventMeta(event);
                return `<button type="button" class="calendar-list-row ${event.id === selected?.id ? "selected" : ""}" data-event="${event.id}">
                  <span class="event-dot ${eventClass(event)}"></span>
                  <time><strong>${formatDate(event.date)}</strong><em>${event.time} - ${meta.endTime}</em></time>
                  <span><strong>${event.title}</strong><em>${event.type} · ${event.status}</em></span>
                  <span><strong>${meta.client?.name || "Клієнт не вказаний"}</strong><em>№${event.caseId}</em></span>
                  <span><strong>${meta.authority}</strong><em>${meta.responsible}</em></span>
                  ${badge(eventTimeLeftLabel(event), calendarTimeTone(eventTimeLeftLabel(event)))}
                </button>`;
              }).join("") || `<p class="muted">Подій за цими фільтрами немає.</p>`}
            </div>
            ` : `
            <div class="calendar-weekdays ${mode}-view" style="${gridStyle}">
              ${(mode === "day" ? [calendarDays[0]?.weekday || "День"] : weekDayNames).map((name) => `<span>${name}</span>`).join("")}
            </div>
            <div class="calendar-grid ${mode}-view" style="${gridStyle}">
              ${calendarDays.map((cell) => {
                const events = filtered.filter((event) => event.date === cell.iso);
                return `<div class="day ${cell.current ? "" : "muted-day"}">
                  <div class="day-num">${cell.day}</div>
                ${events.map((event) => {
                  const client = clientById(event.clientId);
                  const eventSubline = event.caseId ? `Справа №${event.caseId}` : client?.name || "Клієнт";
                  return `<button class="event-chip ${eventClass(event)} ${event.id === selected?.id ? "selected" : ""}" data-event="${event.id}"><strong>${event.time}</strong> ${event.title}<br><span>${eventSubline}</span></button>`;
                }).join("")}
              </div>`;
            }).join("")}
            </div>
            `}
            <div class="calendar-legend">
              <span><i class="meeting"></i>Зустрічі</span>
              <span><i class="court"></i>Суд</span>
              <span><i class="doc"></i>Документи</span>
              <span><i class="deadline"></i>Кінцевий термін</span>
              <span><i class="waiting"></i>Очікування відповіді</span>
              <span><i class="other"></i>Інше</span>
            </div>
          </div>
          <div class="panel calendar-events-list">
            <div class="calendar-events-head"><h2>Найближчі події</h2><button class="ghost">Показати всі</button></div>
            ${upcoming.map((event) => {
              const client = clientById(event.clientId);
              const leftLabel = eventTimeLeftLabel(event);
              return `<button type="button" class="upcoming-event-row" data-event="${event.id}">
                <span class="event-dot ${eventClass(event)}"></span>
                <span class="upcoming-event-main"><strong>${event.title}${event.caseId ? ` у справі №${event.caseId}` : ""}</strong><em>Клієнт: ${client?.name || "Не вказано"}</em></span>
                <time>${formatDate(event.date)}</time>
                <span class="upcoming-event-time">${event.time}</span>
                ${badge(leftLabel, calendarTimeTone(leftLabel))}
              </button>`;
            }).join("") || `<p class="muted">Подій за цими фільтрами немає.</p>`}
          </div>
        </div>
        <aside class="calendar-side">
          <div class="panel" id="event-card"></div>
          <div class="panel calendar-reminders">
            <div class="calendar-reminders-head"><h2>Нагадування</h2><button class="ghost">+ Додати нагадування</button></div>
            ${selected ? calendarReminderRows(selected).map((row) => `<div class="reminder-row">${icon(row.channel === "SMS" ? "mail" : row.channel === "CRM" ? "bell" : "telegram")}<div><strong>${row.channel}</strong><span>${row.before} до події (${row.scheduledAt})</span></div><em class="reminder-status">${row.status}</em></div>`).join("") : `<p class="muted">Виберіть подію, щоб побачити нагадування.</p>`}
          </div>
          <div class="panel calendar-reminders active-reminders">
            <h2>Нагадування активні</h2>
            <p class="muted">${selected ? `Для події «${selected.title}» активні канали сповіщень.` : "Ви будете отримувати сповіщення згідно з налаштуваннями."}</p>
            <div class="active-reminder-icons"><span>${icon("telegram")} Telegram</span><span>${icon("mail")} SMS</span></div>
          </div>
        </aside>
      </div>
    </div>
  `;
  renderEventCard(selected?.id);
  $("#add-event").addEventListener("click", openEventDialog);
  document.querySelectorAll("[data-event]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedEventId = button.dataset.event;
      renderCalendar();
    });
  });
  document.querySelectorAll("[data-calendar-mode]").forEach((button) => button.addEventListener("click", () => {
    state.calendarMode = button.dataset.calendarMode;
    state.calendarPickerOpen = false;
    renderCalendar();
  }));
  document.querySelector("[data-calendar-today]")?.addEventListener("click", () => {
    state.calendarDate = todayIso();
    state.calendarPickerOpen = false;
    renderCalendar();
  });
  document.querySelectorAll("[data-calendar-step]").forEach((button) => button.addEventListener("click", () => {
    const direction = Number(button.dataset.calendarStep);
    const current = dateFromIso(state.calendarDate || calendarToday);
    if (state.calendarMode === "day") {
      state.calendarDate = isoFromDate(addDays(current, direction));
    } else if (state.calendarMode === "week") {
      state.calendarDate = isoFromDate(addDays(current, direction * 7));
    } else {
      state.calendarDate = isoFromDate(new Date(current.getFullYear(), current.getMonth() + direction, Math.min(current.getDate(), 28)));
    }
    state.calendarPickerOpen = false;
    renderCalendar();
  }));
  document.querySelector("[data-calendar-picker]")?.addEventListener("click", () => {
    state.calendarPickerOpen = !state.calendarPickerOpen;
    renderCalendar();
  });
  document.querySelectorAll("[data-calendar-month]").forEach((button) => button.addEventListener("click", () => {
    const current = dateFromIso(state.calendarDate || calendarToday);
    state.calendarDate = isoFromDate(new Date(current.getFullYear(), Number(button.dataset.calendarMonth), Math.min(current.getDate(), 28)));
    state.calendarPickerOpen = false;
    renderCalendar();
  }));
  document.querySelectorAll("[data-calendar-year]").forEach((button) => button.addEventListener("click", () => {
    const current = dateFromIso(state.calendarDate || calendarToday);
    state.calendarDate = isoFromDate(new Date(Number(button.dataset.calendarYear), current.getMonth(), Math.min(current.getDate(), 28)));
    state.calendarPickerOpen = false;
    renderCalendar();
  }));
  $("#calendar-search")?.addEventListener("input", (event) => {
    state.calendarQuery = event.currentTarget.value;
    renderCalendar();
    requestAnimationFrame(() => {
      const input = $("#calendar-search");
      if (!input) return;
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    });
  });
  $("#calendar-filter")?.addEventListener("change", (event) => {
    state.calendarFilter = event.currentTarget.value;
    renderCalendar();
  });
  $("#calendar-client-filter")?.addEventListener("change", (event) => {
    state.calendarClientFilter = event.currentTarget.value;
    renderCalendar();
  });
  $("#calendar-case-filter")?.addEventListener("change", (event) => {
    state.calendarCaseFilter = event.currentTarget.value;
    renderCalendar();
  });
  $("#calendar-responsible-filter")?.addEventListener("change", (event) => {
    state.calendarResponsibleFilter = event.currentTarget.value;
    renderCalendar();
  });
  $("#calendar-status-filter")?.addEventListener("change", (event) => {
    state.calendarStatusFilter = event.currentTarget.value;
    renderCalendar();
  });
  $("#calendar-authority-filter")?.addEventListener("input", (event) => {
    state.calendarAuthorityFilter = event.currentTarget.value;
    renderCalendar();
    requestAnimationFrame(() => {
      const input = $("#calendar-authority-filter");
      if (!input) return;
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    });
  });
  $("#calendar-overdue-filter")?.addEventListener("change", (event) => {
    state.calendarOverdueOnly = event.currentTarget.checked;
    renderCalendar();
  });
}

function renderEventCard(id) {
  const event = calendarEntries().find((item) => item.id === id) || calendarEntries()[0];
  if (!event) {
    $("#event-card").innerHTML = `<h2>Подія</h2><p class="muted">Подій поки немає.</p>`;
    return;
  }
  const { client, caseItem, authority, location, responsible, endTime, recurrence, reminderBefore, reminderChannels } = calendarEventMeta(event);
  const orderedEvents = [...calendarEntries()].sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  const eventIndex = Math.max(0, orderedEvents.findIndex((item) => item.id === event.id));
  const previousEvent = orderedEvents[(eventIndex - 1 + orderedEvents.length) % orderedEvents.length];
  const nextEvent = orderedEvents[(eventIndex + 1) % orderedEvents.length];
  state.selectedEventId = event.id;
  $("#event-card").innerHTML = `
    <div class="event-card-head">
      <h2>Подія</h2>
      <div class="event-card-nav">
        <button class="ghost" type="button" data-event-nav="${previousEvent?.id || event.id}" title="Попередня подія">‹</button>
        <button class="ghost" type="button" data-event-nav="${nextEvent?.id || event.id}" title="Наступна подія">›</button>
        <div class="event-more-wrap">
          <button class="ghost" type="button" data-event-more title="Дії">⋮</button>
          <div class="event-more-menu" hidden>
            <button type="button" data-reschedule-calendar-event="${event.id}">${icon("calendar")} Перенести</button>
            <button type="button" data-complete-calendar-event="${event.id}">${icon("check")} Виконано</button>
            <button type="button" data-send-calendar-reminder="${event.id}">${icon("bell")} Нагадати зараз</button>
            <button type="button" data-open-calendar-case="${event.caseId}">${icon("eye")} Відкрити справу</button>
          </div>
        </div>
      </div>
    </div>
    <div class="event-card-title">
      <span class="event-dot ${eventClass(event)}"></span>
      <strong>${event.title}</strong>
      ${badge(event.source === "task" ? "Задача" : event.type, eventClass(event) === "court" ? "green" : eventClass(event) === "deadline" ? "red" : "blue")}
    </div>
    <div class="event-profile">
      <div class="event-info-list">
        <div class="event-info-row">${icon("calendar")}<span><strong>${formatDate(event.date)}</strong></span></div>
        <div class="event-info-row">${icon("clock")}<span><strong>${event.time} - ${endTime}</strong></span></div>
        <div class="event-info-row">${icon("building")}<span><strong>${authority}</strong><em>${location}</em></span></div>
        <div class="event-info-row">${icon("briefcase")}<span><strong>Справа №${event.caseId}</strong><em>${caseItem?.title || "Без назви справи"}</em></span></div>
        <div class="event-info-row">${icon("user")}<span><strong>Клієнт: ${client?.name || "Не вказано"}</strong></span></div>
        <div class="event-info-row">${icon("user")}<span><strong>Відповідальний: ${responsible}</strong></span></div>
        <div class="event-info-row">${icon("bell")}<span><strong>${reminderBefore} · ${reminderChannels}</strong><em>${recurrence} · ${event.status}</em></span></div>
      </div>
      <p class="muted event-description">${event.description || "Опис події ще не додано."}</p>
      <div class="event-card-actions" id="event-card-actions">
        <button class="secondary" data-edit-calendar-event="${event.id}">${icon("edit")} Редагувати</button>
        <button class="secondary danger" data-delete-calendar-event="${event.id}">${icon("trash")} Видалити</button>
      </div>
    </div>
  `;
  document.querySelector("[data-open-calendar-case]")?.addEventListener("click", () => {
    if (!caseItem) return;
    state.selectedCaseId = caseItem.id;
    state.caseScreen = "detail";
    renderCases();
    switchView("cases");
  });
  document.querySelectorAll("[data-event-nav]").forEach((button) => button.addEventListener("click", () => {
    state.selectedEventId = button.dataset.eventNav;
    renderCalendar();
  }));
  document.querySelector("[data-event-more]")?.addEventListener("click", () => {
    const menu = document.querySelector(".event-more-menu");
    if (!menu) return;
    menu.hidden = !menu.hidden;
  });
  document.querySelector("[data-edit-calendar-event]")?.addEventListener("click", () => {
    if (event.source === "task") {
      openTaskDialog(event.caseId, event.taskIndex, "calendar");
      return;
    }
    openEventDialog({ eventId: event.id });
  });
  document.querySelector("[data-reschedule-calendar-event]")?.addEventListener("click", () => {
    if (event.source === "task") {
      openTaskDialog(event.caseId, event.taskIndex, "calendar");
      return;
    }
    openEventDialog({ eventId: event.id });
  });
  document.querySelector("[data-complete-calendar-event]")?.addEventListener("click", () => {
    if (event.source === "task") return;
    const target = state.events.find((item) => `event-${item.id}` === event.id);
    if (!target) return;
    target.status = "Виконано";
    renderCalendar();
  });
  document.querySelector("[data-send-calendar-reminder]")?.addEventListener("click", () => {
    if (event.source === "task") return;
    const target = state.events.find((item) => `event-${item.id}` === event.id);
    if (!target) return;
    target.reminderLog = [
      { date: new Date().toLocaleString("uk-UA"), text: "Нагадування відправлено вручну через CRM." },
      ...(target.reminderLog || [])
    ];
    renderCalendar();
  });
  document.querySelector("[data-delete-calendar-event]")?.addEventListener("click", () => {
    if (event.source === "task") {
      openDeleteDocumentConfirm({ type: "task", caseId: event.caseId, taskIndex: event.taskIndex, returnView: "calendar" });
      return;
    }
    openDeleteDocumentConfirm({ type: "calendarEvent", eventId: event.id, returnView: "calendar" });
  });
}

function taskCard(task) {
  if (!task) {
    return `
      <aside class="panel task-side-card empty">
        <h2>Задача</h2>
        <p class="muted">Оберіть задачу зі списку, щоб побачити деталі.</p>
      </aside>
    `;
  }
  const caseItem = caseById(task.caseId);
  const progress = task.completed ? 100 : task.status === "В роботі" ? 60 : task.status === "Очікує" ? 35 : 20;
  const dueIso = parseDisplayDate(task.dueText);
  const plannerDate = dueIso ? formatDate(dueIso) : "Не заплановано";
  const dueStatus = task.overdue ? "Просрочено" : "Завтра";
  const detailTab = state.taskDetailTab || "info";
  const taskSubtasks = [
    { title: "Перевірити вихідні документи", responsible: task.responsible, due: task.dueText, status: task.completed ? "Виконано" : "В роботі" },
    { title: "Підготувати короткий проєкт рішення", responsible: "Петренко С.В.", due: plannerDate, status: "Очікує" },
    { title: "Узгодити результат з відповідальним адвокатом", responsible: task.responsible, due: plannerDate, status: "Нова" }
  ];
  const taskFiles = [
    ...(caseItem?.documents || []).slice(0, 3).map((document) => ({
      name: `${document.name}.docx`,
      meta: `${document.status || "Без статусу"} · ${document.submitted || "дата не вказана"}`,
      tone: documentStatusTone(document.status)
    })),
    { name: "Коментар до задачі.pdf", meta: "Файл задачі · чернетка", tone: "blue" }
  ].slice(0, 4);
  const taskHistory = [
    { date: task.dueText, text: `Дедлайн задачі встановлено для ${task.responsible}.` },
    { date: "15.05.2024 09:30", text: "Задачу додано до планера." },
    ...(caseItem?.history || []).slice(0, 2)
  ];
  const detailPanels = {
    info: `
      <div class="task-detail-info">
        <div>
          <span>Справа</span>
          <strong><a href="#" data-open-task-case="${task.caseId}">№${task.caseId}</a><br>${caseItem?.clientId ? clientById(caseItem.clientId)?.name || task.clientName : task.clientName}</strong>
        </div>
        <div>
          <span>Відповідальний</span>
          <strong class="advocate-person">${advocatePhoto(task.responsible)}${task.responsible}</strong>
        </div>
        <div><span>Дедлайн</span><strong>${task.dueText}<br><em>${dueStatus}</em></strong></div>
        <div>
          <span>Статус</span>
          <select class="task-status-select" data-task-status-change="${task.key}">
            ${["Нова", "Очікує", "В роботі", "Заплановано", "Виконано"].map((status) => `<option value="${status}" ${task.status === status ? "selected" : ""}>${status}</option>`).join("")}
          </select>
        </div>
        <div>
          <span>Пов'язана з планером</span>
          <strong class="planner-connected"><span class="event-dot court"></span>${task.showInCalendar ? `Заплановано на ${plannerDate}<br>${task.dueText?.match(/\d{1,2}:\d{2}/)?.[0] || "09:00"} - 10:30` : "Не заплановано"}</strong>
        </div>
      </div>
      <h3>Опис</h3>
      <p>${task.caseTitle}. ${task.description || "Контроль виконання задачі та пов'язаних матеріалів по справі."}</p>
      <div class="task-progress">
        <div><strong>Прогрес виконання</strong><span>${progress}%</span></div>
        <i style="--progress:${progress}%"></i>
      </div>
    `,
    subtasks: `
      <div class="task-subtask-list">
        ${taskSubtasks.map((subtask, index) => `
          <label class="task-subtask-row">
            <input type="checkbox" ${subtask.status === "Виконано" ? "checked" : ""} />
            <span>
              <strong>${subtask.title}</strong>
              <em>${subtask.responsible} · ${subtask.due}</em>
            </span>
            ${badge(subtask.status, taskTone(subtask.status))}
          </label>
        `).join("")}
      </div>
      <button class="secondary task-inline-add" data-edit-task-global="${task.key}">+ Додати підзадачу</button>
    `,
    files: `
      <div class="task-file-list">
        ${taskFiles.map((file) => `
          <div class="task-file-row">
            ${icon("file")}
            <span><strong>${file.name}</strong><em>${file.meta}</em></span>
            ${badge(file.meta.includes("чернетка") ? "Чернетка" : "Файл", file.tone)}
          </div>
        `).join("")}
      </div>
      <button class="secondary task-inline-add" data-edit-task-global="${task.key}">+ Прикріпити файл</button>
    `,
    history: `
      <div class="task-history-list">
        ${taskHistory.map((item) => `
          <div class="task-history-row">
            <i></i>
            <span>${item.date}</span>
            <strong>${item.text}</strong>
          </div>
        `).join("")}
      </div>
    `
  };
  return `
    <aside class="panel task-side-card">
      <div class="task-side-head">
        <div>
          <h2>${task.title}</h2>
          <span>№${task.caseId}</span>
        </div>
        <button class="ghost task-side-close" type="button" aria-label="Закрити">×</button>
      </div>
      <div class="task-detail-priority">${badge(`${task.priority} пріоритет`, riskTone(task.priority))}</div>
      <div class="task-detail-tabs">
        <button class="${detailTab === "info" ? "active" : ""}" data-task-detail-tab="info">Інформація</button>
        <button class="${detailTab === "subtasks" ? "active" : ""}" data-task-detail-tab="subtasks">Підзадачі <span>${taskSubtasks.length}</span></button>
        <button class="${detailTab === "files" ? "active" : ""}" data-task-detail-tab="files">Файли</button>
        <button class="${detailTab === "history" ? "active" : ""}" data-task-detail-tab="history">Історія</button>
      </div>
      <div class="task-detail-panel">${detailPanels[detailTab] || detailPanels.info}</div>
      <div class="task-side-actions">
        <button class="secondary task-action-line" data-open-task-case="${task.caseId}">${icon("file")} Відкрити справу</button>
        <button class="secondary task-action-line" data-edit-task-global="${task.key}">+ Додати підзадачу</button>
        <button class="secondary task-action-line" data-edit-task-global="${task.key}">${icon("calendar")} Перенести дедлайн</button>
        <button class="secondary task-action-line" data-edit-task-global="${task.key}">${icon("tag")} Змінити пріоритет</button>
        <button class="secondary danger task-action-line" data-toggle-side-task="${task.key}">${icon("bell")} Позначити як важливе в планері</button>
      </div>
    </aside>
  `;
}

function renderTasks() {
  const tasks = allCaseTasks();
  const query = (state.taskQuery || "").toLowerCase().trim();
  const tab = state.taskTab || "all";
  const filtered = tasks.filter((task) => {
    const byQuery = !query || [task.title, task.caseId, task.caseTitle, task.clientName, task.responsible].some((value) => String(value).toLowerCase().includes(query));
    const byStatus = state.taskStatusFilter === "all" || task.status === state.taskStatusFilter;
    const byPriority = state.taskPriorityFilter === "all" || task.priority === state.taskPriorityFilter;
    const byCase = state.taskCaseFilter === "all" || task.caseId === state.taskCaseFilter;
    const byResponsible = state.taskResponsibleFilter === "all" || task.responsible === state.taskResponsibleFilter;
    const byTab =
      tab === "all" ||
      (tab === "mine" && task.responsible === "Іваненко А.Ю.") ||
      (tab === "overdue" && task.overdue) ||
      (tab === "done" && task.completed) ||
      (tab === "cases" && task.caseId);
    return byQuery && byStatus && byPriority && byCase && byResponsible && byTab;
  });
  if (state.taskDetailOpen && !filtered.some((task) => task.key === state.selectedTaskKey)) {
    state.taskDetailOpen = false;
    state.selectedTaskKey = "";
  }
  const selected = state.taskDetailOpen ? (filtered.find((task) => task.key === state.selectedTaskKey) || null) : null;
  const taskPageSize = state.taskPageSize === "all" ? filtered.length || 1 : Number(state.taskPageSize || 25);
  const taskTotalPages = Math.max(1, Math.ceil(filtered.length / taskPageSize));
  state.taskPage = Math.min(Math.max(1, Number(state.taskPage || 1)), taskTotalPages);
  const taskStart = (state.taskPage - 1) * taskPageSize;
  const pageTasks = filtered.slice(taskStart, taskStart + taskPageSize);
  const urgentCount = tasks.filter((task) => ["Терміново", "Срочно"].includes(task.status)).length;
  const overdueCount = tasks.filter((task) => task.overdue).length;
  const doneCount = tasks.filter((task) => task.completed).length;
  const plannedCount = tasks.filter((task) => task.showInCalendar).length;
  const inWorkCount = tasks.filter((task) => task.status === "В роботі").length;
  const completion = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;
  const responsibleOptions = [...new Set(tasks.map((task) => task.responsible).filter(Boolean))];
  const highPriority = tasks.filter((task) => task.priority === "Високий").length;
  const mediumPriority = tasks.filter((task) => task.priority === "Середній").length;
  const lowPriority = tasks.filter((task) => task.priority === "Низький").length;
  const plannedPriority = plannedCount;
  const priorityTotal = Math.max(1, highPriority + mediumPriority + lowPriority + plannedPriority);
  const priorityPct = (value) => Math.round((value / priorityTotal) * 100);
  const highPct = priorityPct(highPriority);
  const mediumPct = priorityPct(mediumPriority);
  const lowPct = priorityPct(lowPriority);
  const plannedPct = Math.max(0, 100 - highPct - mediumPct - lowPct);
  $("#tasks").innerHTML = `
    <div class="tasks-screen">
      <div class="tasks-page-head">
        <div>
          <h2>Задачі</h2>
          <p>Управління задачами та контроль виконання</p>
        </div>
        <div class="tasks-head-actions">
          <button class="primary" id="task-create-from-section">+ Додати задачу</button>
          <button class="secondary sync-planner-button" id="task-sync-planner">${icon("refresh")} Синхронізувати з планером</button>
        </div>
      </div>
      <div class="tasks-tabs" role="tablist">
        <button class="${tab === "all" ? "active" : ""}" data-task-tab="all">Всі задачі</button>
        <button class="${tab === "mine" ? "active" : ""}" data-task-tab="mine">Мої задачі</button>
        <button class="${tab === "cases" ? "active" : ""}" data-task-tab="cases">По справах</button>
        <button class="${tab === "overdue" ? "active" : ""}" data-task-tab="overdue">Просрочені</button>
        <button class="${tab === "done" ? "active" : ""}" data-task-tab="done">Завершені</button>
      </div>
      <div class="tasks-workspace ${selected ? "has-task-detail" : "is-full"}">
        <div class="tasks-main-column">
          <div class="tasks-kpi-grid">
            <article><div><span>Всього задач</span><strong>${tasks.length}</strong><em>+12% порівняно з попер. періодом</em></div><i>${icon("calendar")}</i></article>
            <article><div><span>Виконано</span><strong>${doneCount}</strong><em>${completion}%</em></div><i class="green">${icon("check")}</i></article>
            <article><div><span>В роботі</span><strong>${inWorkCount}</strong><em>${tasks.length ? Math.round((inWorkCount / tasks.length) * 100) : 0}%</em></div><i class="amber">${icon("search")}</i></article>
            <article><div><span>Просрочені</span><strong>${overdueCount}</strong><em>${tasks.length ? Math.round((overdueCount / tasks.length) * 100) : 0}%</em></div><i class="red">${icon("bell")}</i></article>
            <article><div><span>Заплановано в планері</span><strong>${plannedCount}</strong><em>${tasks.length ? Math.round((plannedCount / tasks.length) * 100) : 0}%</em></div><i class="violet">${icon("calendar")}</i></article>
          </div>
          <div class="tasks-toolbar">
            <input id="task-search" value="${state.taskQuery || ""}" type="search" placeholder="Пошук задачі, клієнта, справи..." />
            <select id="task-priority-filter">
              <option value="all">Всі пріоритети</option>
              <option value="Високий" ${state.taskPriorityFilter === "Високий" ? "selected" : ""}>Високий</option>
              <option value="Середній" ${state.taskPriorityFilter === "Середній" ? "selected" : ""}>Середній</option>
              <option value="Низький" ${state.taskPriorityFilter === "Низький" ? "selected" : ""}>Низький</option>
            </select>
            <select id="task-status-filter">
              <option value="all">Всі статуси</option>
              ${["Очікує", "В роботі", "Терміново", "Срочно", "Не срочно", "Виконано"].map((status) => `<option value="${status}" ${state.taskStatusFilter === status ? "selected" : ""}>${status}</option>`).join("")}
            </select>
            <select id="task-case-filter">
              <option value="all">Всі справи</option>
              ${state.cases.map((item) => `<option value="${item.id}" ${state.taskCaseFilter === item.id ? "selected" : ""}>№${item.id}</option>`).join("")}
            </select>
            <select id="task-responsible-filter">
              <option value="all">Всі відповідальні</option>
              ${responsibleOptions.map((name) => `<option value="${name}" ${state.taskResponsibleFilter === name ? "selected" : ""}>${name}</option>`).join("")}
            </select>
            <button class="secondary">${icon("filter")} Фільтри</button>
          </div>
          <div class="panel tasks-list-card">
          <table class="tasks-table">
            <thead>
              <tr><th><span class="task-title-head"><span></span><input type="checkbox" aria-label="Вибрати всі задачі" /><span>Задача</span></span></th><th>Пріоритет</th><th>Справа</th><th>Відповідальний</th><th>Дедлайн</th><th>Статус</th><th></th></tr>
            </thead>
            <tbody>
              ${pageTasks.map((task) => `
                <tr class="${task.key === selected?.key ? "selected" : ""} ${task.completed ? "task-done-row" : ""}" data-task-key="${task.key}" data-task-drop="${task.key}">
                  <td>
                    <div class="task-title-cell">
                      <span class="task-drag-handle" draggable="true" data-task-drag="${task.key}" title="Перемістити задачу" aria-label="Перемістити задачу"></span>
                      <input type="checkbox" data-toggle-task-global="${task.key}" ${task.completed ? "checked" : ""} aria-label="Виконати задачу" />
                      <div>
                        <strong>${task.title}</strong>
                        <span>${task.caseTitle}</span>
                      </div>
                    </div>
                  </td>
                  <td>${badge(task.priority, riskTone(task.priority))}</td>
                  <td><a href="#" data-open-task-case="${task.caseId}">№${task.caseId}</a><span>${task.clientName}</span></td>
                  <td><span class="task-assignee">${advocatePhoto(task.responsible, "mini")}${task.responsible}</span></td>
                  <td class="${task.overdue ? "danger-text" : ""}">${task.dueText}<span>${task.overdue ? "Просрочено" : "За планом"}</span></td>
                  <td>${badge(task.overdue ? "Просрочено" : task.status, task.overdue ? "red" : taskTone(task.status))}</td>
                  <td>
                    <div class="case-row-actions task-list-actions">
                      <button type="button" data-edit-task-global="${task.key}" title="Редагувати">${icon("edit")}</button>
                      <button type="button" class="danger-icon" data-delete-task-global="${task.key}" title="Видалити">${icon("trash")}</button>
                    </div>
                  </td>
                </tr>
              `).join("") || `<tr><td colspan="7" class="empty-cell">Задач за цими фільтрами немає</td></tr>`}
            </tbody>
          </table>
          <div class="tasks-pagination">
            <label>Показати
              <select id="task-page-size">
                ${[6, 10, 25, 50].map((size) => `<option value="${size}" ${String(state.taskPageSize) === String(size) ? "selected" : ""}>${size}</option>`).join("")}
                <option value="all" ${state.taskPageSize === "all" ? "selected" : ""}>Усі</option>
              </select>
            </label>
            <em>${filtered.length ? `${taskStart + 1}-${Math.min(taskStart + pageTasks.length, filtered.length)} з ${filtered.length}` : "0 з 0"}</em>
            <div>
              <button class="secondary" data-task-page="prev" ${state.taskPage <= 1 ? "disabled" : ""}>‹</button>
              ${Array.from({ length: Math.min(taskTotalPages, 5) }, (_, index) => index + 1).map((page) => `<button class="secondary ${state.taskPage === page ? "active" : ""}" data-task-page="${page}">${page}</button>`).join("")}
              <button class="secondary" data-task-page="next" ${state.taskPage >= taskTotalPages ? "disabled" : ""}>›</button>
            </div>
          </div>
        </div>
        </div>
        ${selected ? taskCard(selected) : ""}
      </div>
      <div class="tasks-bottom-grid">
        <article class="panel task-sync-card">
          <h2>Як працює синхронізація з планером</h2>
          <div>
            <span>${icon("calendar")}<strong>Створіть задачу</strong><em>Додайте задачу з пріоритетом та дедлайном</em></span>
            <span>${icon("check")}<strong>Встановіть пріоритет</strong><em>Задачі сортуються за рівнем важливості</em></span>
            <span>${icon("bell")}<strong>Додано в планер</strong><em>Найважливіші задачі потрапляють в план дня</em></span>
            <span>${icon("calendar")}<strong>Контролюйте</strong><em>Відстежуйте прогрес виконання</em></span>
          </div>
        </article>
        <article class="panel task-priority-card">
          <h2>Розподіл задач за пріоритетами</h2>
          <div class="priority-card-body">
            <div class="priority-donut" style="--high:${highPct}; --medium:${mediumPct}; --low:${lowPct}; --planned:${plannedPct};"></div>
            <div class="priority-legend">
              <p><span class="red-dot"></span><strong>Високий</strong><em>${highPriority} задач (${highPct}%)</em></p>
              <p><span class="amber-dot"></span><strong>Середній</strong><em>${mediumPriority} задач (${mediumPct}%)</em></p>
              <p><span class="yellow-dot"></span><strong>Низький</strong><em>${lowPriority} задач (${lowPct}%)</em></p>
              <p><span class="green-dot"></span><strong>Плановий</strong><em>${plannedPriority} задач (${plannedPct}%)</em></p>
            </div>
          </div>
        </article>
        <article class="panel task-plan-card">
          <h2>Задачі в планері на завтра</h2>
          ${tasks.filter((task) => task.showInCalendar && !task.completed).slice(0, 3).map((task) => `<div><time>${task.dueText}</time><strong>${task.title}</strong><span>№${task.caseId}</span></div>`).join("")}
          <button class="ghost" data-view-link="planner">Відкрити планер</button>
        </article>
      </div>
    </div>
  `;

  document.querySelectorAll("[data-task-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      state.taskTab = button.dataset.taskTab;
      state.taskPage = 1;
      renderTasks();
    });
  });
  $("#task-search")?.addEventListener("input", (event) => {
    state.taskQuery = event.currentTarget.value;
    state.taskPage = 1;
    renderTasks();
    requestAnimationFrame(() => {
      const input = $("#task-search");
      if (!input) return;
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    });
  });
  $("#task-status-filter")?.addEventListener("change", (event) => {
    state.taskStatusFilter = event.currentTarget.value;
    state.taskPage = 1;
    renderTasks();
  });
  $("#task-case-filter")?.addEventListener("change", (event) => {
    state.taskCaseFilter = event.currentTarget.value;
    state.taskPage = 1;
    renderTasks();
  });
  $("#task-priority-filter")?.addEventListener("change", (event) => {
    state.taskPriorityFilter = event.currentTarget.value;
    state.taskPage = 1;
    renderTasks();
  });
  $("#task-responsible-filter")?.addEventListener("change", (event) => {
    state.taskResponsibleFilter = event.currentTarget.value;
    state.taskPage = 1;
    renderTasks();
  });
  $("#task-page-size")?.addEventListener("change", (event) => {
    state.taskPageSize = event.currentTarget.value === "all" ? "all" : Number(event.currentTarget.value);
    state.taskPage = 1;
    renderTasks();
  });
  document.querySelectorAll("[data-task-page]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.taskPage === "prev") {
        state.taskPage = Math.max(1, Number(state.taskPage || 1) - 1);
      } else if (button.dataset.taskPage === "next") {
        state.taskPage = Number(state.taskPage || 1) + 1;
      } else {
        state.taskPage = Number(button.dataset.taskPage);
      }
      renderTasks();
    });
  });
  $("#task-create-from-section")?.addEventListener("click", () => openTaskDialog(state.selectedCaseId || state.cases[0]?.id, null, "tasks"));
  $("#task-sync-planner")?.addEventListener("click", () => showToast("Задачі синхронізовано з планером."));
  document.querySelectorAll("[data-task-key]").forEach((row) => {
    row.addEventListener("click", () => {
      if (state.selectedTaskKey !== row.dataset.taskKey) state.taskDetailTab = "info";
      state.selectedTaskKey = row.dataset.taskKey;
      state.taskDetailOpen = true;
      renderTasks();
      scrollTaskDetailIntoView();
    });
  });
  document.querySelector(".task-side-close")?.addEventListener("click", () => {
    state.taskDetailOpen = false;
    renderTasks();
  });
  document.querySelectorAll("[data-task-detail-tab]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      state.taskDetailTab = button.dataset.taskDetailTab;
      renderTasks();
    });
  });
  document.querySelectorAll("[data-task-drag]").forEach((handle) => {
    handle.addEventListener("click", (event) => event.stopPropagation());
    handle.addEventListener("dragstart", (event) => {
      event.stopPropagation();
      state.dragTaskKey = handle.dataset.taskDrag;
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", state.dragTaskKey);
      handle.closest("tr")?.classList.add("dragging");
    });
    handle.addEventListener("dragend", () => {
      handle.closest("tr")?.classList.remove("dragging");
      document.querySelectorAll(".task-drop-target").forEach((row) => row.classList.remove("task-drop-target"));
      state.dragTaskKey = "";
    });
  });
  document.querySelectorAll("[data-task-drop]").forEach((row) => {
    row.addEventListener("dragover", (event) => {
      if (!state.dragTaskKey || state.dragTaskKey === row.dataset.taskDrop) return;
      event.preventDefault();
      row.classList.add("task-drop-target");
    });
    row.addEventListener("dragleave", () => row.classList.remove("task-drop-target"));
    row.addEventListener("drop", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const fromKey = state.dragTaskKey || event.dataTransfer.getData("text/plain");
      const toKey = row.dataset.taskDrop;
      row.classList.remove("task-drop-target");
      if (!fromKey || !toKey || fromKey === toKey) return;
      const fromIndex = state.taskOrder.indexOf(fromKey);
      const toIndex = state.taskOrder.indexOf(toKey);
      if (fromIndex < 0 || toIndex < 0) return;
      state.taskOrder.splice(fromIndex, 1);
      state.taskOrder.splice(toIndex, 0, fromKey);
      state.dragTaskKey = "";
      renderTasks();
    });
  });
  document.querySelectorAll("[data-edit-task-global]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const task = tasks.find((item) => item.key === button.dataset.editTaskGlobal);
      if (task) openTaskDialog(task.caseId, task.taskIndex, "tasks");
    });
  });
  document.querySelectorAll("[data-delete-task-global]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const task = tasks.find((item) => item.key === button.dataset.deleteTaskGlobal);
      if (task) openDeleteDocumentConfirm({ type: "task", caseId: task.caseId, taskIndex: task.taskIndex, returnView: "tasks" });
    });
  });
  document.querySelectorAll("[data-toggle-task-global]").forEach((input) => {
    input.addEventListener("click", (event) => event.stopPropagation());
    input.addEventListener("change", () => {
      const task = tasks.find((item) => item.key === input.dataset.toggleTaskGlobal);
      const source = task && caseById(task.caseId)?.tasks[task.taskIndex];
      if (!source) return;
      source.status = input.checked ? "Виконано" : "В роботі";
      renderAll();
      switchView("tasks");
    });
  });
  document.querySelectorAll("[data-toggle-side-task]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const task = tasks.find((item) => item.key === button.dataset.toggleSideTask);
      const source = task && caseById(task.caseId)?.tasks[task.taskIndex];
      if (!source) return;
      source.status = task.completed ? "В роботі" : "Виконано";
      renderAll();
      switchView("tasks");
    });
  });
  document.querySelectorAll("[data-task-status-change]").forEach((select) => {
    select.addEventListener("change", () => {
      const task = tasks.find((item) => item.key === select.dataset.taskStatusChange);
      const source = task && caseById(task.caseId)?.tasks[task.taskIndex];
      if (!source) return;
      source.status = select.value;
      renderAll();
      switchView("tasks");
    });
  });
  document.querySelectorAll("[data-open-task-case]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      state.selectedCaseId = button.dataset.openTaskCase;
      state.caseScreen = "detail";
      renderCases();
      switchView("cases");
    });
  });
  bindViewLinks();
  syncNavigationState();
}

function scrollTaskDetailIntoView() {
  if (!window.matchMedia("(max-width: 1180px)").matches) return;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const card = document.querySelector("#tasks .task-side-card:not(.empty)");
      if (!card) return;
      const top = card.getBoundingClientRect().top + window.scrollY - 12;
      window.scrollTo({ top: Math.max(0, top), behavior: reducedMotion ? "auto" : "smooth" });
    });
  });
}

function renderPlanner() {
  const tasks = allCaseTasks();
  const todayItems = tasks
    .filter((task) => !task.completed)
    .sort((a, b) => {
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
      return a.dueText.localeCompare(b.dueText);
    })
    .slice(0, 6);
  const team = ["Іваненко А.Ю.", "Мельник Н.П.", "Кравчук А.В.", "Петренко С.В."];
  $("#planner").innerHTML = `
    <div class="tasks-screen">
      <div class="case-kpi-grid">
        <article><span>У плані на день</span><strong>${todayItems.length}</strong></article>
        <article><span>Просрочені</span><strong>${tasks.filter((task) => task.overdue).length}</strong></article>
        <article><span>Високий пріоритет</span><strong>${tasks.filter((task) => task.priority === "Високий").length}</strong></article>
        <article><span>З календаря</span><strong>${calendarEntries().length}</strong></article>
      </div>
      <div class="tasks-layout">
        <div class="panel tasks-list-card">
          <div class="toolbar">
            <h2>Робочий план юриста</h2>
            <button class="primary" data-view-link="tasks">Відкрити задачі</button>
          </div>
          <div class="list">
            ${todayItems.map((task) => `
              <div class="list-item">
                <strong>${task.dueText} · ${task.title}</strong>
                <p class="muted">№${task.caseId} · ${task.clientName} · ${task.responsible}</p>
                ${badge(task.overdue ? "Просрочено" : task.status, task.overdue ? "red" : taskTone(task.status))}
              </div>
            `).join("") || `<div class="list-item"><strong>План чистий</strong><p class="muted">Немає задач для автоматичного плану.</p></div>`}
          </div>
        </div>
        <aside class="panel task-side-card">
          <h2>Плани команди</h2>
          <div class="profile">
            ${team.map((name) => {
              const count = tasks.filter((task) => task.responsible === name && !task.completed).length;
              const overdue = tasks.filter((task) => task.responsible === name && task.overdue).length;
              return `<div class="profile-line"><span>${name}</span><strong>${count} задач${overdue ? ` · ${overdue} проср.` : ""}</strong></div>`;
            }).join("")}
          </div>
          <button class="secondary" data-view-link="calendar">Відкрити календар</button>
        </aside>
      </div>
    </div>
  `;
  bindViewLinks();
}

function setMailingTab(tab, remember = true) {
  if (remember && tab !== state.mailingMainTab) {
    state.previousMailingTab = state.mailingMainTab;
  }
  state.mailingMainTab = tab;
}

function renderMailings() {
  if (!state.mailingTemplates.length) {
    state.mailingTemplates = [
      { title: "Нагадування про подію", type: "Нагадування", text: "Шановний {{client_name}}, нагадуємо про заплановану подію у вашій справі." },
      { title: "Юридичне повідомлення", type: "Юридичне повідомлення", text: "Шановний {{client_name}}, повідомляємо важливу інформацію щодо вашого звернення." }
    ];
  }
  const recipientMode = state.mailingRecipientMode || "segment";
  const manualRecipients = state.clients.filter((client) => state.mailingManualClientIds.includes(client.id));
  const recipients = recipientMode === "all" ? 1245 : recipientMode === "manual" ? manualRecipients.length : Math.max(120, 386 - Math.max(0, 3 - state.mailingFilters.length) * 58);
  const telegramDelivered = 317;
  const smsDelivered = Math.round(recipients * 0.62);
  const emailDelivered = Math.round(recipients * 0.48);
  const estimatedTelegram = Math.round(recipients * 0.82);
  const totalMessages = (state.mailingChannels.Telegram ? estimatedTelegram : 0) + (state.mailingChannels.SMS ? smsDelivered : 0) + (state.mailingChannels.Email ? emailDelivered : 0);
  const mainTab = state.mailingMainTab || "new";
  const editorChannel = state.mailingEditorChannel || "Telegram";
  const previewChannel = state.mailingPreviewChannel || editorChannel;
  const filterOptions = ["Статус клиента: Новый", "Статус клиента: Активный", "Статус клиента: Постоянный", "Telegram: Подключен", "SMS: Доступен", "Email: Заполнен", "Источник: Сайт", "Источник: Рекомендация", "Ответственный: Іваненко А.Ю.", "Клиенты с активными делами", "Есть согласие на рассылку"];
  const availableFilters = filterOptions.filter((filter) => !state.mailingFilters.includes(filter));
  const campaignFilter = state.mailingCampaignFilter || "all";
  const campaignQuery = String(state.mailingCampaignQuery || "").trim().toLowerCase();
  const baseCampaignRows = state.mailingCampaigns.length ? state.mailingCampaigns : [{ title: "Нагадування про консультацію", status: "Відправлено", meta: "Telegram + SMS · 124 отримувачі", sample: true }];
  const campaignRows = baseCampaignRows.filter((item) => {
    if (campaignFilter === "all") return true;
    if (campaignFilter === "scheduled") return item.status === "Запланирована";
    if (campaignFilter === "test") return item.status === "Тест отправлен";
    return item.status !== "Запланирована" && item.status !== "Тест отправлен";
  }).filter((item) => {
    if (!campaignQuery) return true;
    return `${item.title} ${item.status} ${item.meta || ""} ${item.createdAt || ""}`.toLowerCase().includes(campaignQuery);
  });
  $("#mailings").innerHTML = `
    <div class="mailing-screen">
      <div class="mailing-actionbar">
        <div class="mailing-tabs">
          <button class="${mainTab === "new" ? "active" : ""}" data-mailing-main-tab="new">${icon("telegram")} Новая рассылка</button>
          <button class="${mainTab === "campaigns" ? "active" : ""}" data-mailing-main-tab="campaigns">${icon("file")} Мои рассылки</button>
          <button class="${mainTab === "templates" ? "active" : ""}" data-mailing-main-tab="templates">${icon("calendar")} Шаблоны сообщений</button>
          <button class="${mainTab === "automation" ? "active" : ""}" data-mailing-main-tab="automation">${icon("filter")} Автоматизация</button>
        </div>
        <div class="mailing-top-actions">
          <button class="secondary" data-mailing-action="test">${icon("telegram")} Тестовая отправка</button>
          <button class="primary" data-mailing-action="schedule">${icon("calendar")} Запланировать рассылку</button>
        </div>
      </div>
      ${state.mailingStatusNotice ? `<div class="mailing-notice">${state.mailingStatusNotice}</div>` : ""}
      ${mainTab === "campaigns" ? `<section class="panel mailing-section"><div class="mailing-section-head"><h2>Мои рассылки</h2><div class="mailing-section-actions"><button type="button" class="secondary" data-export-mailings>${icon("file")} Экспорт CSV</button><button type="button" class="primary" data-new-mailing>${icon("telegram")} Новая рассылка</button></div></div><div class="mailing-list-tools"><div class="mailing-filter-tabs">${[{ id: "all", label: "Все" }, { id: "scheduled", label: "Запланированные" }, { id: "test", label: "Тестовые" }, { id: "ready", label: "Готовые" }].map((item) => `<button type="button" class="${campaignFilter === item.id ? "active" : ""}" data-campaign-filter="${item.id}">${item.label}</button>`).join("")}</div><label class="mailing-search">${icon("search")}<input type="search" value="${state.mailingCampaignQuery}" placeholder="Поиск по рассылкам..." data-campaign-search /></label></div>${campaignRows.length ? campaignRows.map((item) => { const sourceIndex = state.mailingCampaigns.indexOf(item); const rowIndex = sourceIndex >= 0 ? sourceIndex : 0; return `<div class="mailing-history-row"><span class="event-dot court"></span><div><strong>${item.title}</strong><em>${item.meta || item.createdAt}</em></div>${badge(item.status, semanticTone(item.status))}<div class="mailing-row-actions"><button type="button" class="secondary" data-edit-mailing-campaign="${rowIndex}">${icon("edit")} Редактировать</button><button type="button" class="secondary danger-text" data-delete-mailing-campaign="${rowIndex}">${icon("trash")} Удалить</button></div></div>`; }).join("") : `<p class="muted">По этому запросу рассылок не найдено.</p>`}</section>` : ""}
      ${mainTab === "templates" ? `<section class="panel mailing-section"><h2>Шаблоны сообщений</h2>${state.mailingTemplates.map((item, index) => `<div class="template-library-row"><div><strong>${item.title}</strong><em>${item.text}</em></div><span>${item.type}</span><div class="mailing-row-actions"><button type="button" class="secondary" data-use-template="${index}">${icon("check")} Использовать</button><button type="button" class="secondary" data-edit-template="${index}">${icon("edit")} Редактировать</button><button type="button" class="secondary danger-text" data-delete-template="${index}">${icon("trash")} Удалить</button></div></div>`).join("")}</section>` : ""}
      ${mainTab === "automation" ? `<section class="panel mailing-section"><h2>Автоматизация</h2><div class="automation-grid">${state.mailingAutomationRules.map((rule, index) => `<article class="automation-rule ${rule.enabled ? "enabled" : ""}"><label><input type="checkbox" data-toggle-automation="${index}" ${rule.enabled ? "checked" : ""} /><span><strong>${rule.title}</strong><em>${rule.description}</em></span></label><select data-automation-channel="${index}">${["Telegram", "SMS", "Email", "Все каналы"].map((channel) => `<option ${rule.channel === channel ? "selected" : ""}>${channel}</option>`).join("")}</select>${badge(rule.enabled ? "Включено" : "Выключено", rule.enabled ? "green" : "red")}</article>`).join("")}</div></section>` : ""}
      ${mainTab === "new" ? `
      <div class="mailing-layout">
        <div class="mailing-left-stack">
          <section class="panel mailing-section mailing-recipients-section">
            <h2>1. Получатели</h2>
            <div class="recipient-mode-grid">
              <button class="${recipientMode === "all" ? "selected" : ""}" data-recipient-mode="all">${icon("filter")}<span><strong>Все клиенты</strong><em>1245 клиентов</em></span></button>
              <button class="${recipientMode === "segment" ? "selected" : ""}" data-recipient-mode="segment">${icon("check")}<span><strong>Сегмент клиентов</strong><em>Выбрано ${recipients} клиентов</em></span></button>
              <button class="${recipientMode === "manual" ? "selected" : ""}" data-recipient-mode="manual">${icon("user")}<span><strong>Выбор вручную</strong><em>Выбрано ${manualRecipients.length} клиентов</em></span></button>
            </div>
            ${recipientMode === "manual" ? `<div class="manual-recipient-box">
              <h3>Выберите клиентов</h3>
              <div class="manual-recipient-list">
                ${state.clients.map((client) => `<label>
                  <input type="checkbox" data-manual-recipient="${client.id}" ${state.mailingManualClientIds.includes(client.id) ? "checked" : ""} />
                  <span><strong>${client.name}</strong><em>${client.phone} · ${client.telegram ? "Telegram подключен" : "Telegram нет"}</em></span>
                </label>`).join("")}
              </div>
            </div>` : ""}
            ${recipientMode !== "manual" ? `
            <div class="segment-filter-box">
              <h3>Фильтры сегмента</h3>
              <div class="segment-chips">
                ${state.mailingFilters.map((filter, index) => `<span>${filter} <button data-remove-mailing-filter="${index}">×</button></span>`).join("") || `<em class="muted">Фильтры не выбраны</em>`}
              </div>
              <div class="segment-add-wrap">
                <button class="secondary segment-add" data-add-mailing-filter>+ Добавить фильтр</button>
                ${state.mailingFilterMenuOpen ? `<div class="segment-filter-menu">
                  ${availableFilters.length ? availableFilters.map((filter) => `<button type="button" data-select-mailing-filter="${filter}">${filter}</button>`).join("") : `<span>Все фильтры уже добавлены</span>`}
                </div>` : ""}
              </div>
            </div>
            ` : ""}
            <div class="coverage-row">
              <span class="coverage-user">${icon("user")}<strong>Всего клиентов</strong><em>${recipients}</em></span>
              <span class="coverage-telegram">${icon("telegram")}<strong>Telegram</strong><em>${estimatedTelegram} (82%)</em></span>
              <span class="coverage-sms">${icon("message")}<strong>SMS</strong><em>${smsDelivered} (62%)</em></span>
              <span class="coverage-email">${icon("mail")}<strong>Email</strong><em>${emailDelivered} (48%)</em></span>
            </div>
          </section>
          <section class="panel mailing-section">
            <h2>2. Содержание сообщения</h2>
            <div class="message-channel-tabs">
              ${["Telegram", "SMS", "Email"].map((channel) => `<button class="${editorChannel === channel ? "active" : ""}" data-message-channel="${channel}">${icon(channel === "Telegram" ? "telegram" : "mail")} ${channel}</button>`).join("")}
            </div>
            <div class="message-editor-grid">
              <div class="message-editor">
                <div class="editor-toolbar">
                  <button type="button" data-wrap-mailing="**">B</button><button type="button" data-wrap-mailing="_">I</button><button type="button" data-wrap-mailing="__">U</button><button type="button" data-insert-mailing="1. Пункт рассылки&#10;2. Следующий пункт">≡</button><button type="button" data-insert-mailing="- Пункт рассылки">•</button><button type="button" data-mail-var="{{unsubscribe_link}}">${icon("tag")}</button><button type="button" data-mail-var="🙂">☺</button>
                  <button type="button" class="variables-button" data-mail-var="{{client_name}}">Переменные⌄</button>
                </div>
                <textarea id="mailing-text" rows="10">${state.mailingText}</textarea>
              </div>
              <aside class="variables-panel">
                <h3>Доступные переменные</h3>
                ${["{{client_name}} — Имя клиента", "{{company_name}} — Назва компанії", "{{phone}} — Телефон клиента", "{{manager_name}} — Ваш менеджер", "{{current_date}} — Поточна дата", "{{unsubscribe_link}} — Посилання для відписки"].map((item) => {
                  const [key, text] = item.split(" — ");
                  return `<p><button data-mail-var="${key}">${key}</button> — ${text}</p>`;
                }).join("")}
              </aside>
            </div>
            <div class="message-footer-row">
              <span>Количество символов: <strong id="mailing-char-count">0</strong> (Telegram до 4096)</span>
              <button class="secondary" data-save-mailing-template>${icon("file")} Зберегти як шаблон</button>
            </div>
          </section>
          <section class="panel mailing-section send-settings-section">
            <h2>3. Настройки отправки</h2>
            <div class="send-settings-grid">
              <div>
                <h3>Способ отправки</h3>
                ${["Telegram", "SMS", "Email"].map((channel) => `<label><input type="checkbox" data-mailing-channel-toggle="${channel}" ${state.mailingChannels[channel] ? "checked" : ""} /> ${channel}</label>`).join("")}
              </div>
              <div>
                <h3>Дата и время отправки</h3>
                <label><input type="radio" name="send-time" value="now" ${state.mailingSendMode !== "later" ? "checked" : ""} /> Отправить сейчас</label>
                <label><input type="radio" name="send-time" value="later" ${state.mailingSendMode === "later" ? "checked" : ""} /> Запланировать на позже</label>
                ${state.mailingSendMode === "later" ? `<div class="mailing-schedule-fields">
                  <input type="date" value="${state.mailingScheduleDate}" data-mailing-schedule-date />
                  <input type="time" value="${state.mailingScheduleTime}" data-mailing-schedule-time />
                </div>` : ""}
              </div>
              <div>
                <h3>Дополнительные настройки</h3>
                <label><input type="checkbox" /> Отправить в нерабочее время</label>
                <label><input type="checkbox" checked /> Пропускать отписанных клиентов</label>
              </div>
            </div>
            <div class="test-send-box">
              <h3>Тестовые получатели</h3>
              <div class="test-contact-grid">
                ${state.mailingTestContacts.map((contact, index) => `<label>
                  <input type="checkbox" data-test-contact="${index}" ${contact.enabled ? "checked" : ""} />
                  ${icon(contact.channel === "Telegram" ? "telegram" : contact.channel === "SMS" ? "message" : "mail")}
                  <span><strong>${contact.channel}</strong><em>${contact.value}</em></span>
                </label>`).join("")}
              </div>
            </div>
          </section>
        </div>
        <aside class="mailing-right-stack">
          <section class="panel mailing-preview-card">
            <h2>Предпросмотр сообщения</h2>
            <div class="preview-tabs">${["Telegram", "SMS", "Email"].map((channel) => `<button class="${previewChannel === channel ? "active" : ""}" data-preview-channel="${channel}">${channel}</button>`).join("")}</div>
            <div class="telegram-preview">
              <div class="telegram-preview-head"><button type="button" data-preview-action="back">←</button><strong>${previewChannel === "Email" ? "Advocates Bureau" : previewChannel === "SMS" ? "SMS Alpha" : "Advocates Bureau"}<span>${previewChannel === "Telegram" ? "бот" : previewChannel}</span></strong><em><button type="button" data-preview-action="send">${icon(previewChannel === "Telegram" ? "telegram" : "mail")}</button><button type="button" data-preview-action="menu">⋮</button></em></div>
              <div class="telegram-preview-body">
                <div class="telegram-bubble ${previewChannel.toLowerCase()}-bubble" id="mail-preview"></div>
              </div>
            </div>
          </section>
          <section class="panel forecast-card">
            <h2>Прогноз результатов</h2>
            <div class="forecast-row"><span>Всего получателей</span><strong>${recipients}</strong></div>
            <div class="forecast-row green"><span>Telegram доставлено</span><strong>~ ${estimatedTelegram} (82%)</strong></div>
            <div class="forecast-row green"><span>SMS доставлено</span><strong>~ ${smsDelivered} (62%)</strong></div>
            <div class="forecast-row green"><span>Email доставлено</span><strong>~ ${emailDelivered} (48%)</strong></div>
            <div class="forecast-total"><span>Ориентировочный охват</span><strong>~ ${totalMessages} сообщений</strong></div>
          </section>
          <section class="panel mailing-tips-card">
            <h2>Советы</h2>
            <p>✓ Лучшее время для рассылки в Telegram: 10:00 – 12:00 и 18:00 – 20:00</p>
            <p>✓ Персонализируйте сообщения с помощью переменных</p>
            <p>✓ Тестируйте рассылку перед отправкой</p>
          </section>
        </aside>
      </div>
      ` : ""}
    </div>
  `;
  const textarea = $("#mailing-text");
  const preview = $("#mail-preview");
  const charCount = $("#mailing-char-count");
  const update = () => {
    if (!textarea || !preview || !charCount) return;
    state.mailingText = textarea.value;
    charCount.textContent = textarea.value.length;
    const previewText = textarea.value
      .replace("Шановний {{client_name}}!", "Шановні клієнти!")
      .replaceAll("{{client_name}}", "Петренко Іван Миколайович");
    preview.textContent = previewChannel === "SMS" ? previewText.slice(0, 180) : previewChannel === "Email" ? `Тема: Важливе повідомлення від Advocates Bureau\n\n${previewText}` : previewText;
  };
  textarea?.addEventListener("input", update);
  document.querySelectorAll("[data-mailing-main-tab]").forEach((button) => button.addEventListener("click", () => {
    setMailingTab(button.dataset.mailingMainTab);
    renderMailings();
  }));
  document.querySelector("[data-new-mailing]")?.addEventListener("click", () => {
    setMailingTab("new");
    state.mailingStatusNotice = "Создайте новую рассылку: выберите получателей, текст и настройки отправки.";
    renderMailings();
  });
  document.querySelectorAll("[data-campaign-filter]").forEach((button) => button.addEventListener("click", () => {
    state.mailingCampaignFilter = button.dataset.campaignFilter;
    renderMailings();
  }));
  document.querySelector("[data-campaign-search]")?.addEventListener("input", (event) => {
    state.mailingCampaignQuery = event.target.value;
    renderMailings();
  });
  document.querySelector("[data-export-mailings]")?.addEventListener("click", () => {
    const rows = campaignRows.map((item) => [item.title, item.status, item.meta || "", item.createdAt || ""]);
    const csv = [["Название", "Статус", "Каналы и получатели", "Дата создания"], ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replaceAll("\"", "\"\"")}"`).join(","))
      .join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "mailings.csv";
    link.click();
    URL.revokeObjectURL(link.href);
    state.mailingStatusNotice = `Экспортировано строк: ${rows.length}.`;
    renderMailings();
    showToast(`CSV экспортирован: ${rows.length} строк.`);
  });
  document.querySelectorAll("[data-recipient-mode]").forEach((button) => button.addEventListener("click", () => {
    state.mailingRecipientMode = button.dataset.recipientMode;
    state.mailingStatusNotice = button.dataset.recipientMode === "manual" ? "Ручной выбор открыт: отметьте нужных клиентов в списке ниже." : "";
    renderMailings();
  }));
  document.querySelectorAll("[data-manual-recipient]").forEach((input) => input.addEventListener("change", () => {
    const clientId = Number(input.dataset.manualRecipient);
    if (input.checked) {
      state.mailingManualClientIds = [...new Set([...state.mailingManualClientIds, clientId])];
    } else {
      state.mailingManualClientIds = state.mailingManualClientIds.filter((id) => id !== clientId);
    }
    state.mailingStatusNotice = `Выбрано вручную: ${state.mailingManualClientIds.length} клиентов.`;
    renderMailings();
  }));
  document.querySelectorAll("[data-remove-mailing-filter]").forEach((button) => button.addEventListener("click", () => {
    state.mailingFilters.splice(Number(button.dataset.removeMailingFilter), 1);
    state.mailingFilterMenuOpen = false;
    renderMailings();
  }));
  document.querySelector("[data-add-mailing-filter]")?.addEventListener("click", () => {
    state.mailingFilterMenuOpen = !state.mailingFilterMenuOpen;
    renderMailings();
  });
  document.querySelectorAll("[data-select-mailing-filter]").forEach((button) => button.addEventListener("click", () => {
    state.mailingFilters.push(button.dataset.selectMailingFilter);
    state.mailingFilterMenuOpen = false;
    renderMailings();
  }));
  document.querySelectorAll("[data-message-channel]").forEach((button) => button.addEventListener("click", () => {
    state.mailingEditorChannel = button.dataset.messageChannel;
    state.mailingPreviewChannel = button.dataset.messageChannel;
    renderMailings();
  }));
  document.querySelectorAll("[data-preview-channel]").forEach((button) => button.addEventListener("click", () => {
    state.mailingPreviewChannel = button.dataset.previewChannel;
    renderMailings();
  }));
  document.querySelectorAll("[data-mail-var]").forEach((button) => button.addEventListener("click", () => {
    if (!textarea) return;
    const value = button.dataset.mailVar;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    textarea.value = `${textarea.value.slice(0, start)}${value}${textarea.value.slice(end)}`;
    textarea.focus();
    textarea.setSelectionRange(start + value.length, start + value.length);
    update();
  }));
  document.querySelectorAll("[data-insert-mailing]").forEach((button) => button.addEventListener("click", () => {
    if (!textarea) return;
    const value = button.dataset.insertMailing;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    textarea.value = `${textarea.value.slice(0, start)}${value}${textarea.value.slice(end)}`;
    textarea.focus();
    textarea.setSelectionRange(start + value.length, start + value.length);
    update();
  }));
  document.querySelectorAll("[data-wrap-mailing]").forEach((button) => button.addEventListener("click", () => {
    if (!textarea) return;
    const marker = button.dataset.wrapMailing;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = textarea.value.slice(start, end) || "текст";
    textarea.value = `${textarea.value.slice(0, start)}${marker}${selected}${marker}${textarea.value.slice(end)}`;
    update();
  }));
  document.querySelector("[data-save-mailing-template]")?.addEventListener("click", () => {
    state.mailingTemplates.unshift({ title: `Шаблон ${state.mailingTemplates.length + 1}`, type: state.mailingEditorChannel, text: state.mailingText });
    state.mailingStatusNotice = "Шаблон сохранён и доступен во вкладке «Шаблоны сообщений».";
    renderMailings();
    showToast("Шаблон сохранён.");
  });
  document.querySelectorAll("[data-use-template]").forEach((button) => button.addEventListener("click", () => {
    const template = state.mailingTemplates[Number(button.dataset.useTemplate)];
    if (!template) return;
    state.mailingText = template.text;
    setMailingTab("new");
    state.mailingStatusNotice = `Шаблон «${template.title}» вставлен в редактор.`;
    renderMailings();
    showToast("Шаблон вставлен в редактор.");
  }));
  document.querySelectorAll("[data-edit-template]").forEach((button) => button.addEventListener("click", () => {
    const template = state.mailingTemplates[Number(button.dataset.editTemplate)];
    if (!template) return;
    state.mailingText = template.text;
    state.mailingEditorChannel = template.type === "Нагадування" || template.type === "Юридичне повідомлення" ? "Telegram" : template.type;
    state.mailingPreviewChannel = state.mailingEditorChannel;
    setMailingTab("new");
    state.mailingStatusNotice = `Шаблон «${template.title}» открыт для редактирования. После правок сохраните его как новый шаблон.`;
    renderMailings();
    showToast("Шаблон открыт для редактирования.");
  }));
  document.querySelectorAll("[data-delete-template]").forEach((button) => button.addEventListener("click", () => {
    const index = Number(button.dataset.deleteTemplate);
    const [removed] = state.mailingTemplates.splice(index, 1);
    state.mailingStatusNotice = removed ? `Шаблон «${removed.title}» удалён.` : "";
    renderMailings();
    if (removed) showToast("Шаблон удалён.", "danger");
  }));
  document.querySelectorAll("[data-toggle-automation]").forEach((input) => input.addEventListener("change", () => {
    const rule = state.mailingAutomationRules[Number(input.dataset.toggleAutomation)];
    if (!rule) return;
    rule.enabled = input.checked;
    state.mailingStatusNotice = `Автоматизация «${rule.title}» ${rule.enabled ? "включена" : "выключена"}.`;
    renderMailings();
    showToast(rule.enabled ? "Автоматизация включена." : "Автоматизация выключена.", rule.enabled ? "success" : "warning");
  }));
  document.querySelectorAll("[data-automation-channel]").forEach((select) => select.addEventListener("change", () => {
    const rule = state.mailingAutomationRules[Number(select.dataset.automationChannel)];
    if (!rule) return;
    rule.channel = select.value;
    state.mailingStatusNotice = `Для автоматизации «${rule.title}» выбран канал: ${rule.channel}.`;
    renderMailings();
  }));
  document.querySelectorAll("[data-edit-mailing-campaign]").forEach((button) => button.addEventListener("click", () => {
    const campaign = state.mailingCampaigns[Number(button.dataset.editMailingCampaign)];
    if (!campaign) {
      state.mailingStatusNotice = "Это пример рассылки. Создайте новую рассылку, и её можно будет редактировать.";
      renderMailings();
      showToast("Примерную рассылку нельзя редактировать.", "warning");
      return;
    }
    state.mailingText = campaign.text || state.mailingText;
    state.mailingChannels = { ...state.mailingChannels, ...(campaign.channels || {}) };
    state.mailingSendMode = campaign.sendMode || "now";
    state.mailingScheduleDate = campaign.scheduleDate || state.mailingScheduleDate;
    state.mailingScheduleTime = campaign.scheduleTime || state.mailingScheduleTime;
    setMailingTab("new");
    state.mailingStatusNotice = `Рассылка «${campaign.title}» открыта для редактирования.`;
    renderMailings();
    showToast("Рассылка открыта для редактирования.");
  }));
  document.querySelectorAll("[data-delete-mailing-campaign]").forEach((button) => button.addEventListener("click", () => {
    const index = Number(button.dataset.deleteMailingCampaign);
    if (!state.mailingCampaigns[index]) {
      state.mailingStatusNotice = "Примерную рассылку удалить нельзя. Она исчезнет, когда появятся ваши рассылки.";
      renderMailings();
      showToast("Примерную рассылку нельзя удалить.", "warning");
      return;
    }
    const [removed] = state.mailingCampaigns.splice(index, 1);
    state.mailingStatusNotice = `Рассылка «${removed.title}» удалена.`;
    renderMailings();
    showToast("Рассылка удалена.", "danger");
  }));
  document.querySelectorAll("[data-mailing-channel-toggle]").forEach((input) => input.addEventListener("change", () => {
    state.mailingChannels[input.dataset.mailingChannelToggle] = input.checked;
    renderMailings();
  }));
  document.querySelectorAll("[data-test-contact]").forEach((input) => input.addEventListener("change", () => {
    const contact = state.mailingTestContacts[Number(input.dataset.testContact)];
    if (!contact) return;
    contact.enabled = input.checked;
    state.mailingStatusNotice = `Тестовый контакт ${contact.channel} ${contact.enabled ? "включён" : "выключен"}.`;
    renderMailings();
  }));
  document.querySelectorAll('input[name="send-time"]').forEach((input) => input.addEventListener("change", () => {
    state.mailingSendMode = input.value;
    renderMailings();
  }));
  document.querySelector("[data-mailing-schedule-date]")?.addEventListener("change", (event) => {
    state.mailingScheduleDate = event.target.value;
  });
  document.querySelector("[data-mailing-schedule-time]")?.addEventListener("change", (event) => {
    state.mailingScheduleTime = event.target.value;
  });
  document.querySelectorAll("[data-mailing-action]").forEach((button) => button.addEventListener("click", () => {
    const action = button.dataset.mailingAction;
    const enabledChannels = Object.entries(state.mailingChannels).filter(([, enabled]) => enabled).map(([name]) => name);
    const enabledTestContacts = state.mailingTestContacts.filter((contact) => contact.enabled);
    if (mainTab !== "new") {
      setMailingTab("new");
      state.mailingStatusNotice = "Сначала проверьте новую рассылку: действия отправки доступны из формы создания.";
      renderMailings();
      showToast("Открыл форму новой рассылки.", "warning");
      return;
    }
    if (!state.mailingText.trim()) {
      state.mailingStatusNotice = "Добавьте текст сообщения перед отправкой.";
      renderMailings();
      showToast("Добавьте текст сообщения.", "warning");
      return;
    }
    if (!enabledChannels.length) {
      state.mailingStatusNotice = "Выберите хотя бы один канал отправки: Telegram, SMS или Email.";
      renderMailings();
      showToast("Выберите канал отправки.", "warning");
      return;
    }
    if (!recipients) {
      state.mailingStatusNotice = "Выберите получателей перед отправкой рассылки.";
      renderMailings();
      showToast("Выберите получателей.", "warning");
      return;
    }
    if (action === "test" && !enabledTestContacts.length) {
      state.mailingStatusNotice = "Выберите хотя бы один тестовый контакт для тестовой отправки.";
      renderMailings();
      showToast("Выберите тестовый контакт.", "warning");
      return;
    }
    if (action === "schedule" && state.mailingSendMode === "later" && (!state.mailingScheduleDate || !state.mailingScheduleTime)) {
      state.mailingStatusNotice = "Укажите дату и время для запланированной рассылки.";
      renderMailings();
      showToast("Укажите дату и время отправки.", "warning");
      return;
    }
    const title = action === "test" ? "Тестовая отправка" : "Информационное сообщение клиентам";
    const plannedAt = state.mailingSendMode === "later" ? `${formatDate(state.mailingScheduleDate)} ${state.mailingScheduleTime}` : "сейчас";
    const status = action === "test" ? "Тест отправлен" : state.mailingSendMode === "later" ? "Запланирована" : "Готова к отправке";
    const testMeta = enabledTestContacts.map((contact) => `${contact.channel}: ${contact.value}`).join(" · ");
    state.mailingCampaigns.unshift({ title, status, meta: action === "test" ? testMeta : `${enabledChannels.join(" + ")} · ${recipients} получателей · ${plannedAt}`, createdAt: new Date().toLocaleString("uk-UA"), text: state.mailingText, channels: { ...state.mailingChannels }, sendMode: state.mailingSendMode, scheduleDate: state.mailingScheduleDate, scheduleTime: state.mailingScheduleTime });
    setMailingTab("campaigns");
    state.mailingStatusNotice = action === "test" ? `Тестовая отправка создана: ${testMeta}.` : `Рассылка добавлена во вкладку «Мои рассылки»: ${plannedAt}.`;
    renderMailings();
    showToast(action === "test" ? "Тестовая отправка создана." : "Рассылка добавлена в «Мои рассылки».");
  }));
  document.querySelectorAll("[data-preview-action]").forEach((button) => button.addEventListener("click", () => {
    const messages = {
      back: "Предпросмотр открыт: стрелка возвращает к списку сообщений в полной версии.",
      send: "Быстрая тестовая отправка доступна через кнопку «Тестовая отправка» сверху.",
      menu: "Меню предпросмотра: здесь будут действия копирования и открытия канала."
    };
    state.mailingStatusNotice = messages[button.dataset.previewAction];
    renderMailings();
  }));
  update();
  syncNavigationState();
}

function renderAI() {
  const helpers = ["Сімейне право", "Кримінальне право", "Військове право", "Адміністративне право", "Господарське право", "Трудове право"];
  $("#ai").innerHTML = `
    <div class="grid cols-3">
      ${helpers.map((helper) => `<div class="panel">
        <h2>${helper}</h2>
        <p class="muted">Консультації, аналіз документів, підготовка позиції та процесуальних документів.</p>
        ${badge("Активний", "green")}
        <div style="margin-top:14px"><button class="primary">Відкрити консультанта</button></div>
      </div>`).join("")}
    </div>
    <div class="layout" style="margin-top:16px">
      <div class="panel">
        <h2>AI помічник по справі</h2>
        <div class="ai-chat">
          <div class="bubble">Я проаналізував матеріали справи №2024/12345. Основний ризик: потрібно підтвердити дату отримання рішення ТЦК.</div>
          <div class="bubble user">Сформуй план дій і перелік доказів.</div>
          <div class="bubble">План: 1. Витребувати копію рішення. 2. Підготувати адвокатський запит. 3. Сформувати адміністративний позов. 4. Додати медичні та службові документи.</div>
        </div>
      </div>
      <aside class="panel">
        <h2>База знань</h2>
        <div class="list">
          <div class="list-item">Закони та кодекси ${badge("128 файлів", "blue")}</div>
          <div class="list-item">Шаблони документів ${badge("43 шаблони", "green")}</div>
          <div class="list-item">Матеріали справ ${badge("захищено", "amber")}</div>
        </div>
      </aside>
    </div>
  `;
}

function renderFinance() {
  const income = state.cases.reduce((sum, item) => sum + item.income, 0);
  const debt = state.cases.reduce((sum, item) => sum + item.debt, 0);
  const expenses = 18600;
  $("#finance").innerHTML = `
    <div class="grid cols-4">
      <div class="metric"><span>Дохід</span><strong>${currency(income)}</strong></div>
      <div class="metric"><span>Витрати</span><strong>${currency(expenses)}</strong></div>
      <div class="metric"><span>Прибуток</span><strong>${currency(income - expenses)}</strong></div>
      <div class="metric"><span>Борг клієнтів</span><strong>${currency(debt)}</strong></div>
    </div>
    <div class="panel table-wrap" style="margin-top:16px">
      <div class="toolbar"><h2>Фінанси по справах</h2><button class="primary">+ Створити рахунок</button></div>
      <table>
        <thead><tr><th>Справа</th><th>Клієнт</th><th>Оплачено</th><th>Борг</th><th>Статус</th><th>Дія</th></tr></thead>
        <tbody>
          ${state.cases.map((item) => `<tr>
            <td>№${item.id}</td>
            <td>${clientById(item.clientId).name}</td>
            <td>${currency(item.income)}</td>
            <td>${currency(item.debt)}</td>
            <td>${item.debt ? badge("Є борг", "red") : badge("Оплачено", "green")}</td>
            <td><button class="secondary">Нагадати</button></td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderAnalytics() {
  $("#analytics").innerHTML = `
    <div class="toolbar">
      <div class="left">
        <select><option>Останні 30 днів</option><option>Поточний місяць</option><option>Рік</option></select>
        <select><option>Усі співробітники</option><option>Іваненко А.Ю.</option><option>Мельник Н.П.</option></select>
        <select><option>Усі справи</option><option>Активні</option><option>Просрочені</option></select>
      </div>
      <button class="secondary">Експорт PDF</button>
    </div>
    <div class="grid cols-4">
      <div class="metric"><span>Нові клієнти</span><strong>18</strong></div>
      <div class="metric"><span>Закриті справи</span><strong>7</strong></div>
      <div class="metric"><span>Просрочені задачі</span><strong>2</strong></div>
      <div class="metric"><span>Доставка повідомлень</span><strong>94%</strong></div>
    </div>
    <div class="grid cols-3" style="margin-top:16px">
      <div class="panel"><h2>Справи за типами</h2><div class="list"><div class="profile-line"><span>Військові</span><strong>34%</strong></div><div class="profile-line"><span>Сімейні</span><strong>22%</strong></div><div class="profile-line"><span>Господарські</span><strong>18%</strong></div></div></div>
      <div class="panel"><h2>Джерела клієнтів</h2><div class="list"><div class="profile-line"><span>Рекомендації</span><strong>41%</strong></div><div class="profile-line"><span>Сайт</span><strong>27%</strong></div><div class="profile-line"><span>Соцмережі</span><strong>19%</strong></div></div></div>
      <div class="panel"><h2>Ризики</h2><div class="list"><div class="list-item">${badge("2 просрочені задачі")}</div><div class="list-item">${badge("3 клієнти з боргом")}</div><div class="list-item">${badge("1 документ без відповіді")}</div></div></div>
    </div>
  `;
}

function renderOSINT() {
  $("#osint").innerHTML = `
    <div class="grid cols-4">
      <div class="metric"><span>Перевірок</span><strong>12</strong></div>
      <div class="metric"><span>Відкриті ризики</span><strong>3</strong></div>
      <div class="metric"><span>Джерел даних</span><strong>8</strong></div>
      <div class="metric"><span>Звіти</span><strong>5</strong></div>
    </div>
    <div class="layout" style="margin-top:16px">
      <div class="panel">
        <div class="toolbar"><h2>OSINT перевірки</h2><button class="primary">+ Нова перевірка</button></div>
        <div class="list">
          <div class="list-item"><strong>Перевірка контрагента по договору</strong><p class="muted">Справа №2024/5678 · реєстри, судові рішення, борги</p>${badge("В роботі", "blue")}</div>
          <div class="list-item"><strong>Аналіз відкритих джерел клієнта</strong><p class="muted">Справа №2024/9999 · згадки, документи, ризики</p>${badge("Потребує уваги", "amber")}</div>
          <div class="list-item"><strong>Моніторинг судових реєстрів</strong><p class="muted">Автоматична перевірка по активних справах</p>${badge("Активний", "green")}</div>
        </div>
      </div>
      <aside class="panel">
        <h2>Картка перевірки</h2>
        <div class="profile">
          <div class="profile-line"><span>Об'єкт</span><strong>ТОВ / контрагент</strong></div>
          <div class="profile-line"><span>Статус</span>${badge("В роботі", "blue")}</div>
          <div class="profile-line"><span>Пов'язана справа</span><strong>№2024/5678</strong></div>
          <p class="muted">У повній версії тут буде збір відкритих даних, файли перевірки, висновок і історія змін.</p>
        </div>
      </aside>
    </div>
  `;
}

function renderDocuments() {
  const documents = state.cases.flatMap((item) => item.documents.map((doc) => ({ ...doc, caseId: item.id, client: clientById(item.clientId).name })));
  $("#documents").innerHTML = `
    <div class="panel table-wrap">
      <div class="toolbar"><h2>Документи</h2><button class="primary" data-view-link="cases">+ Додати до справи</button></div>
      <table>
        <thead><tr><th>Документ</th><th>Справа</th><th>Клієнт</th><th>Статус</th><th>Джерело</th></tr></thead>
        <tbody>
          ${documents.map((doc) => `<tr><td>${doc.name}</td><td>№${doc.caseId}</td><td>${doc.client}</td><td>${badge(doc.status, documentStatusTone(doc.status))}</td><td>${doc.source || "CRM"}</td></tr>`).join("") || `<tr><td colspan="5">Документів поки немає</td></tr>`}
        </tbody>
      </table>
    </div>
  `;
}

function renderSettings() {
  const users = [
    { name: "Іваненко А.Ю.", role: "Адміністратор", access: "Повний доступ", photo: "І" },
    { name: "Мельник Н.П.", role: "Адвокат", access: "Справи, клієнти, календар", photo: "М" },
    { name: "Кравчук А.В.", role: "Помічник", access: "Задачі та документи", photo: "К" }
  ];
  const integrations = [
    { key: "Telegram", description: "Повідомлення клієнтам, тестові відправки, нагадування" },
    { key: "SMS", description: "Короткі сповіщення про події та дедлайни" },
    { key: "Email", description: "Листи, шаблони та службові повідомлення" },
    { key: "AI", description: "AI помічники, аналіз справ і чернетки документів" }
  ];
  $("#settings").innerHTML = `
    <div class="settings-screen">
      <section class="panel settings-profile-card">
        <div class="settings-section-head">
          <div>
            <h2>Профіль бюро</h2>
            <p class="muted">Основні дані, які використовуються в документах, розсилках і профілі адміністратора.</p>
          </div>
          <button type="button" class="primary" data-save-settings>${icon("check")} Зберегти</button>
        </div>
        <div class="settings-form-grid">
          <label>Назва бюро<input data-bureau-field="name" value="${state.bureauSettings.name}" /></label>
          <label>Email<input data-bureau-field="email" value="${state.bureauSettings.email}" /></label>
          <label>Телефон<input data-bureau-field="phone" value="${state.bureauSettings.phone}" /></label>
          <label>Адреса<input data-bureau-field="address" value="${state.bureauSettings.address}" /></label>
        </div>
      </section>

      <section class="panel settings-users-card">
        <div class="settings-section-head">
          <div>
            <h2>Користувачі</h2>
            <p class="muted">Ролі команди та рівні доступу до CRM.</p>
          </div>
          <button type="button" class="secondary" data-settings-action="invite">+ Запросити</button>
        </div>
        <div class="settings-users-list">
          ${users.map((user) => `<article class="settings-user-row">
            <div class="avatar">${user.photo}</div>
            <div><strong>${user.name}</strong><span>${user.role}</span></div>
            <em>${user.access}</em>
            ${badge(user.role === "Адміністратор" ? "Owner" : "Active", user.role === "Адміністратор" ? "blue" : "green")}
          </article>`).join("")}
        </div>
      </section>

      <section class="panel settings-integrations-card">
        <div class="settings-section-head">
          <div>
            <h2>Інтеграції</h2>
            <p class="muted">Канали, які беруть участь у повідомленнях, календарі та автоматизації.</p>
          </div>
        </div>
        <div class="settings-toggle-list">
          ${integrations.map((item) => `<label class="settings-toggle-row">
            <span>${icon(item.key === "Email" ? "mail" : item.key === "AI" ? "search" : item.key === "SMS" ? "message" : item.key.toLowerCase())}</span>
            <strong>${item.key}<em>${item.description}</em></strong>
            <input type="checkbox" data-settings-integration="${item.key}" ${state.settingsIntegrations[item.key] ? "checked" : ""} />
          </label>`).join("")}
        </div>
      </section>

      <section class="panel settings-notifications-card">
        <div class="settings-section-head">
          <div>
            <h2>Сповіщення</h2>
            <p class="muted">Що показувати у верхньому дзвіночку та оперативних нагадуваннях.</p>
          </div>
        </div>
        <div class="settings-toggle-list compact">
          ${[
            ["deadlines", "Дедлайни та прострочені задачі"],
            ["court", "Судові засідання та події календаря"],
            ["mailings", "Статус розсилок та тестових відправок"]
          ].map(([key, label]) => `<label class="settings-toggle-row">
            <strong>${label}</strong>
            <input type="checkbox" data-settings-notification="${key}" ${state.settingsNotifications[key] ? "checked" : ""} />
          </label>`).join("")}
        </div>
      </section>
    </div>
  `;
  document.querySelector("[data-save-settings]")?.addEventListener("click", () => {
    document.querySelectorAll("[data-bureau-field]").forEach((input) => {
      state.bureauSettings[input.dataset.bureauField] = input.value.trim();
    });
    saveNavigationState();
    showToast("Налаштування бюро збережено.");
  });
  document.querySelector("[data-settings-action='invite']")?.addEventListener("click", () => {
    showToast("Запрошення користувача показано як прототипну дію.", "warning");
  });
  document.querySelectorAll("[data-settings-integration]").forEach((input) => input.addEventListener("change", () => {
    const key = input.dataset.settingsIntegration;
    state.settingsIntegrations[key] = input.checked;
    saveNavigationState();
    showToast(`${key}: ${input.checked ? "увімкнено" : "вимкнено"}.`, input.checked ? "success" : "warning");
  }));
  document.querySelectorAll("[data-settings-notification]").forEach((input) => input.addEventListener("change", () => {
    state.settingsNotifications[input.dataset.settingsNotification] = input.checked;
    saveNavigationState();
    showToast(input.checked ? "Сповіщення увімкнено." : "Сповіщення вимкнено.", input.checked ? "success" : "warning");
  }));
}

function renderAll() {
  const taskBadge = document.querySelector('[data-view="tasks"] .nav-badge');
  if (taskBadge) taskBadge.textContent = allCaseTasks().filter((task) => !task.completed).length;
  renderDashboard();
  renderClients();
  renderCases();
  renderTasks();
  renderCalendar();
  renderPlanner();
  renderDocuments();
  renderMailings();
  renderAI();
  renderFinance();
  renderAnalytics();
  renderOSINT();
  renderSettings();
  bindViewLinks();
  requestAnimationFrame(syncNavigationState);
}

function saveNavigationState() {
  try {
    const payload = {
      currentView: state.currentView,
      viewHistory: state.viewHistory,
      caseScreen: state.caseScreen,
      selectedCaseId: state.selectedCaseId,
      taskDetailOpen: state.taskDetailOpen,
      selectedTaskKey: state.selectedTaskKey,
      mailingMainTab: state.mailingMainTab,
      previousMailingTab: state.previousMailingTab,
      bureauSettings: state.bureauSettings,
      settingsIntegrations: state.settingsIntegrations,
      settingsNotifications: state.settingsNotifications,
      sidebarCollapsed: document.body.classList.contains("sidebar-collapsed")
    };
    localStorage.setItem(NAV_STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    // Navigation persistence is helpful, but the app should still work without storage access.
  }
}

function restoreNavigationState() {
  try {
    const saved = JSON.parse(localStorage.getItem(NAV_STORAGE_KEY) || "{}");
    if (!saved || !saved.currentView || !document.getElementById(saved.currentView)) return;
    state.currentView = saved.currentView;
    state.viewHistory = Array.isArray(saved.viewHistory) ? saved.viewHistory.filter((view) => document.getElementById(view)).slice(-20) : [];
    state.previousView = state.viewHistory.at(-1) || "";
    state.caseScreen = saved.caseScreen === "detail" ? "detail" : "list";
    state.selectedCaseId = caseById(saved.selectedCaseId) ? saved.selectedCaseId : state.selectedCaseId;
    state.taskDetailOpen = Boolean(saved.taskDetailOpen);
    state.selectedTaskKey = saved.selectedTaskKey || "";
    state.mailingMainTab = saved.mailingMainTab || state.mailingMainTab;
    state.previousMailingTab = saved.previousMailingTab || "";
    state.bureauSettings = { ...state.bureauSettings, ...(saved.bureauSettings || {}) };
    state.settingsIntegrations = { ...state.settingsIntegrations, ...(saved.settingsIntegrations || {}) };
    state.settingsNotifications = { ...state.settingsNotifications, ...(saved.settingsNotifications || {}) };
    document.body.classList.toggle("sidebar-collapsed", Boolean(saved.sidebarCollapsed));
  } catch (error) {
    localStorage.removeItem(NAV_STORAGE_KEY);
  }
}

function switchView(view, options = {}) {
  if (!view || !document.getElementById(view)) return;
  const leavingView = state.currentView;
  if (view !== state.currentView && !options.skipHistory) {
    pushViewHistory(state.currentView, view);
  }
  if (leavingView === "mailings" && view !== "mailings") {
    state.previousMailingTab = "";
  }
  state.currentView = view;
  state.previousView = state.viewHistory.at(-1) || "";
  viewNodes.forEach((node) => node.classList.toggle("active", node.id === view));
  navNodes.forEach((node) => node.classList.toggle("active", node.dataset.view === view));
  $("#page-title").textContent = titles[view] || "CRM";
  $("#page-eyebrow").textContent = view === "tasks" ? "Управління задачами та контроль виконання" : "Юридичне бюро";
  document.body.dataset.view = view;
  syncNavigationState();
}

function pushViewHistory(fromView, toView) {
  if (!fromView || fromView === toView) return;
  while (state.viewHistory.at(-1) === toView) {
    state.viewHistory.pop();
  }
  if (state.viewHistory.at(-1) !== fromView) {
    state.viewHistory.push(fromView);
  }
  state.viewHistory = state.viewHistory.slice(-20);
}

function hasInternalBack(view = state.currentView) {
  return (view === "mailings" && Boolean(state.previousMailingTab))
    || (view === "cases" && state.caseScreen === "detail")
    || (view === "tasks" && state.taskDetailOpen);
}

function updateTopbarBack() {
  const backButton = $("#topbar-back");
  if (backButton) {
    const visible = state.viewHistory.length > 0 || hasInternalBack();
    backButton.classList.toggle("visible", visible);
    const label = backTargetLabel();
    backButton.title = label;
    backButton.setAttribute("aria-label", label);
  }
}

function syncNavigationState() {
  updateTopbarBack();
  saveNavigationState();
}

function backTargetLabel() {
  if (state.currentView === "cases" && state.caseScreen === "detail") return "Назад к списку справ";
  if (state.currentView === "tasks" && state.taskDetailOpen) return "Назад к списку задач";
  if (state.currentView === "mailings" && state.previousMailingTab) return "Назад к предыдущей вкладке рассылки";
  const previousTitle = titles[state.viewHistory.at(-1)] || "предыдущему разделу";
  return `Назад к разделу: ${previousTitle}`;
}

function goInternalBack() {
  if (state.currentView === "mailings" && state.previousMailingTab) {
    const targetTab = state.previousMailingTab;
    state.previousMailingTab = "";
    setMailingTab(targetTab, false);
    renderMailings();
    switchView("mailings", { skipHistory: true });
    return true;
  }
  if (state.currentView === "cases" && state.caseScreen === "detail") {
    state.caseScreen = "list";
    state.openCaseSection = "";
    renderCases();
    switchView("cases", { skipHistory: true });
    return true;
  }
  if (state.currentView === "tasks" && state.taskDetailOpen) {
    state.taskDetailOpen = false;
    state.selectedTaskKey = "";
    renderTasks();
    switchView("tasks", { skipHistory: true });
    return true;
  }
  return false;
}

function goBack() {
  const openDialog = document.querySelector("dialog[open]");
  if (openDialog) {
    openDialog.close();
    return;
  }
  if (goInternalBack()) {
    scrollActiveViewTop();
    return;
  }
  const target = state.viewHistory.pop() || "dashboard";
  state.previousView = state.viewHistory.at(-1) || "";
  switchView(target, { skipHistory: true });
  scrollActiveViewTop();
}

function scrollActiveViewTop() {
  requestAnimationFrame(() => {
    document.querySelector(".view.active")?.scrollTo?.({ top: 0, behavior: "smooth" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

function bindViewLinks() {
  document.querySelectorAll("[data-view-link]").forEach((button) => {
    button.addEventListener("click", () => switchView(button.dataset.viewLink));
  });
}

function openClientDialog(clientId = null) {
  const form = $("#client-form");
  form.reset();
  form.elements.clientId.value = "";
  $("#client-dialog-title").textContent = "Новий клієнт";

  if (clientId !== null && clientId !== undefined) {
    const client = clientById(clientId);
    if (!client) {
      $("#client-dialog").showModal();
      return;
    }
    form.elements.clientId.value = client.id;
    form.elements.name.value = client.name;
    form.elements.phone.value = client.phone;
    form.elements.email.value = client.email;
    form.elements.address.value = client.address || "";
    form.elements.telegramUsername.value = client.telegramUsername || "";
    form.elements.request.value = client.request;
    form.elements.status.value = client.status;
    form.elements.source.value = client.source;
    form.elements.manager.value = client.manager;
    $("#client-dialog-title").textContent = "Редагувати клієнта";
  }

  $("#client-dialog").showModal();
}

function parseDisplayDate(displayDate) {
  if (!displayDate || displayDate === "Не вказано") return "";
  const [day, month, yearWithTime] = displayDate.split(".");
  const year = yearWithTime?.split(" ")[0];
  if (!day || !month || !year) return "";
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function openCaseDialog(caseId = null) {
  const form = $("#case-form");
  form.reset();
  $("#case-client").innerHTML = state.clients.map((client) => `<option value="${client.id}">${client.name}</option>`).join("");
  form.elements.caseId.value = "";
  form.elements.stage.value = "Первинна консультація";
  $("#case-dialog-title").textContent = "Нова справа";
  $("#case-submit-button").textContent = "Створити справу";

  if (caseId !== null && caseId !== undefined) {
    const item = caseById(caseId);
    if (!item) {
      $("#case-dialog").showModal();
      return;
    }
    form.elements.caseId.value = item.id;
    form.elements.clientId.value = item.clientId;
    form.elements.title.value = item.title;
    form.elements.type.value = item.type;
    form.elements.stage.value = item.stage;
    form.elements.status.value = item.status;
    form.elements.deadline.value = parseDisplayDate(item.deadline);
    form.elements.priority.value = item.priority;
    form.elements.responsible.value = item.responsible;
    $("#case-dialog-title").textContent = "Редагувати справу";
    $("#case-submit-button").textContent = "Зберегти справу";
  }

  $("#case-dialog").showModal();
}

function openEssenceDialog(caseId) {
  const item = caseById(caseId);
  if (!item) return;
  const form = $("#essence-form");
  form.reset();
  form.elements.caseId.value = item.id;
  form.elements.description.value = item.description || "";
  $("#essence-dialog").showModal();
}

function openAuthorityDialog(caseId) {
  const item = caseById(caseId);
  if (!item) return;
  const form = $("#authority-form");
  form.reset();
  form.elements.caseId.value = item.id;
  form.elements.court.value = item.court === "Не вказано" ? "" : item.court;
  form.elements.authorityType.value = item.authorityType || "";
  form.elements.authorityAddress.value = item.authorityAddress || "";
  form.elements.authorityContact.value = item.authorityContact || "";
  $("#authority-dialog").showModal();
}

function moneyValue(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function openFinanceDialog(caseId) {
  const item = caseById(caseId);
  if (!item) return;
  const form = $("#finance-form");
  const finance = caseFinance(item);
  form.reset();
  form.elements.caseId.value = item.id;
  form.elements.totalFee.value = finance.total || "";
  form.elements.paid.value = finance.paid || "";
  form.elements.firstPaymentDate.value = parseDisplayDate(item.firstPaymentDate);
  form.elements.nextPaymentDue.value = parseDisplayDate(item.nextPaymentDue);
  form.elements.financeComment.value = item.financeComment || "";
  $("#finance-dialog").showModal();
}

function findFolderFileByDocument(item, doc) {
  const folders = caseFolders(item);
  if (doc?.documentId) {
    for (let folderIndex = 0; folderIndex < folders.length; folderIndex += 1) {
      const fileIndex = folders[folderIndex].files.findIndex((file) => file.documentId === doc.documentId);
      if (fileIndex >= 0) return { folder: folders[folderIndex], folderIndex, file: folders[folderIndex].files[fileIndex], fileIndex };
    }
  }
  for (let folderIndex = 0; folderIndex < folders.length; folderIndex += 1) {
    const fileIndex = folders[folderIndex].files.findIndex((file) => file.name === doc?.name);
    if (fileIndex >= 0) return { folder: folders[folderIndex], folderIndex, file: folders[folderIndex].files[fileIndex], fileIndex };
  }
  return null;
}

function getDocumentPayload(caseId, encoded) {
  const item = caseById(caseId);
  const [source, first, second] = encoded.split(":");
  if (source === "procedural") {
    const docIndex = Number(first);
    return { item, source, docIndex, doc: item.documents[docIndex], linked: findFolderFileByDocument(item, item.documents[docIndex]) };
  }
  const folderIndex = Number(first);
  const fileIndex = Number(second);
  const folder = caseFolders(item)[folderIndex];
  const file = folder?.files[fileIndex];
  const docIndex = file?.documentId
    ? item.documents.findIndex((doc) => doc.documentId === file.documentId)
    : item.documents.findIndex((doc) => doc.name === file?.name);
  return { item, source, folderIndex, fileIndex, folder, file, docIndex, doc: item.documents[docIndex] };
}

function openStoredDocument(documentData) {
  if (!documentData) return;
  if (documentData.url) {
    window.open(documentData.url, "_blank", "noopener");
    return;
  }
  if (documentData.fileObject) {
    window.open(URL.createObjectURL(documentData.fileObject), "_blank", "noopener");
    return;
  }
  showToast(`Для документа «${documentData.name}» пока нет файла или ссылки.`, "warning");
}

function openDocumentDialog(caseId, editContext = null) {
  const form = $("#document-form");
  form.reset();
  form.elements.caseId.value = caseId;
  const item = caseById(caseId);
  $("#document-folder").innerHTML = [
    ...caseFolders(item).map((folder, index) => `<option value="${index}">${folder.name}</option>`),
    `<option value="__new__">+ Создать новую папку</option>`
  ].join("");
  form.elements.editSource.value = "";
  form.elements.docIndex.value = "";
  form.elements.folderIndex.value = "";
  form.elements.fileIndex.value = "";
  $("#document-dialog-title").textContent = "Новий документ";
  $("#document-submit-button").textContent = "Додати документ";

  if (editContext) {
    const data = editContext.file || editContext.doc;
    const linked = editContext.linked || (editContext.doc ? findFolderFileByDocument(item, editContext.doc) : null);
    form.elements.editSource.value = editContext.source;
    form.elements.docIndex.value = editContext.docIndex ?? "";
    form.elements.folderIndex.value = editContext.folderIndex ?? linked?.folderIndex ?? "";
    form.elements.fileIndex.value = editContext.fileIndex ?? linked?.fileIndex ?? "";
    form.elements.name.value = data?.name || "";
    form.elements.url.value = data?.url || "";
    form.elements.type.value = data?.type || "Інше";
    form.elements.submitted.value = parseDisplayDate(data?.submitted);
    form.elements.responseDue.value = parseDisplayDate(data?.responseDue);
    form.elements.status.value = data?.status || "Чернетка";
    form.elements.comment.value = data?.comment || "";
    form.elements.folder.value = String(editContext.folderIndex ?? linked?.folderIndex ?? 0);
    $("#document-dialog-title").textContent = "Редагувати документ";
    $("#document-submit-button").textContent = "Зберегти документ";
  }
  $("#document-dialog").showModal();
}

function openTaskDialog(caseId, taskIndex = null, returnView = null) {
  const form = $("#task-form");
  form.reset();
  form.dataset.originalCaseId = caseId || "";
  $("#task-case-select").innerHTML = state.cases.map((item) => `<option value="${item.id}">№${item.id} · ${item.title}</option>`).join("");
  form.elements.caseId.value = caseId;
  form.elements.taskIndex.value = "";
  state.taskDialogReturnView = returnView || ($("#tasks")?.classList.contains("active") ? "tasks" : "cases");
  form.elements.showInCalendar.checked = true;
  $("#task-dialog-title").textContent = "Нова задача";
  $("#task-submit-button").textContent = "Додати задачу";
  if (taskIndex !== null) {
    const task = caseById(caseId)?.tasks[taskIndex];
    if (!task) return;
    form.elements.taskIndex.value = taskIndex;
    form.elements.title.value = task.title;
    form.elements.status.value = task.status;
    form.elements.responsible.value = task.responsible || caseById(caseId)?.responsible || "Іваненко А.Ю.";
    form.elements.due.value = parseDisplayDate(task.due);
    form.elements.showInCalendar.checked = Boolean(task.showInCalendar);
    $("#task-dialog-title").textContent = "Редагувати задачу";
    $("#task-submit-button").textContent = "Зберегти задачу";
  }
  $("#task-dialog").showModal();
}

function openEventDialog(context = {}, actionIndex = null) {
  const form = $("#event-form");
  form.reset();
  $("#event-client").innerHTML = state.clients.map((client) => `<option value="${client.id}">${client.name}</option>`).join("");
  $("#event-case").innerHTML = state.cases.map((item) => `<option value="${item.id}">№${item.id} · ${item.title}</option>`).join("");
  form.elements.caseId.value = context.caseId || state.selectedCaseId || state.cases[0]?.id || "";
  form.elements.actionIndex.value = "";
  form.elements.eventId.value = "";
  $("#event-dialog h2").textContent = "Нова подія";
  if (context.clientId) {
    form.elements.client.value = context.clientId;
  } else {
    const selectedCase = caseById(form.elements.caseId.value);
    if (selectedCase) form.elements.client.value = selectedCase.clientId;
  }
  if (context.eventId) {
    const sourceEvent = calendarEntries().find((item) => item.id === context.eventId);
    if (!sourceEvent || sourceEvent.source === "task") return;
    const meta = calendarEventMeta(sourceEvent);
    form.elements.eventId.value = sourceEvent.id;
    form.elements.title.value = sourceEvent.title || "";
    form.elements.type.value = sourceEvent.type || "Судове засідання";
    form.elements.date.value = sourceEvent.date || "";
    form.elements.time.value = sourceEvent.time || "09:00";
    form.elements.endTime.value = meta.endTime || "";
    form.elements.status.value = sourceEvent.status || "Заплановано";
    form.elements.client.value = sourceEvent.clientId;
    form.elements.caseId.value = sourceEvent.caseId;
    form.elements.authority.value = sourceEvent.authority || "";
    form.elements.location.value = sourceEvent.location || "";
    form.elements.responsible.value = meta.responsible;
    form.elements.recurrence.value = meta.recurrence;
    form.elements.reminderBefore.value = meta.reminderBefore;
    form.elements.reminderChannels.value = meta.reminderChannels;
    form.elements.reminderRecipients.value = meta.reminderRecipients;
    form.elements.description.value = sourceEvent.description || "";
    $("#event-dialog h2").textContent = "Редагувати подію";
  }
  if (actionIndex !== null && context.caseId) {
    const action = caseProceduralItems(caseById(context.caseId))[actionIndex];
    if (!action || Array.isArray(action)) return;
    form.elements.actionIndex.value = actionIndex;
    form.elements.title.value = action.action || "";
    form.elements.date.value = parseDisplayDate(action.initiated);
    form.elements.time.value = action.time || "09:00";
    form.elements.due.value = parseDisplayDate(action.due);
    form.elements.status.value = action.status || "Заплановано";
    form.elements.description.value = action.description || "";
  }
  $("#event-case").onchange = (event) => {
    const selectedCase = caseById(event.currentTarget.value);
    if (selectedCase) form.elements.client.value = selectedCase.clientId;
  };
  $("#event-dialog").showModal();
}

function openFolderDialog(caseId, folderIndex = null) {
  const form = $("#folder-form");
  form.reset();
  form.elements.caseId.value = caseId;
  form.elements.folderIndex.value = "";
  $("#folder-dialog-title").textContent = "Нова папка";
  $("#folder-submit-button").textContent = "Створити папку";
  if (folderIndex !== null) {
    const folder = caseFolders(caseById(caseId))[folderIndex];
    if (!folder) return;
    form.elements.folderIndex.value = folderIndex;
    form.elements.name.value = folder.name;
    $("#folder-dialog-title").textContent = "Редагувати папку";
    $("#folder-submit-button").textContent = "Зберегти папку";
  }
  $("#folder-dialog").showModal();
}

function openDeleteDocumentConfirm(payload) {
  const item = caseById(payload.caseId);
  if (payload.type === "case") {
    if (!item) return;
    state.pendingDocumentDelete = payload;
    $("#delete-document-title").textContent = "Удалить справу?";
    $("#delete-document-text").textContent = `Вы уверены, что хотите удалить справу №${item.id} «${item.title}»?`;
    $("#delete-document-confirm").textContent = "Да, удалить";
    $("#delete-document-dialog").showModal();
    return;
  }
  if (payload.type === "folder") {
    const folder = caseFolders(item)[payload.folderIndex];
    if (!folder) return;
    state.pendingDocumentDelete = payload;
    $("#delete-document-title").textContent = "Удалить папку?";
    $("#delete-document-text").textContent = `Вы уверены, что хотите удалить папку «${folder.name}» и ${folder.files.length} файл(ов) внутри?`;
    $("#delete-document-confirm").textContent = "Да, удалить";
    $("#delete-document-dialog").showModal();
    return;
  }
  if (payload.type === "task") {
    const task = item.tasks[payload.taskIndex];
    if (!task) return;
    state.pendingDocumentDelete = payload;
    $("#delete-document-title").textContent = "Удалить задачу?";
    $("#delete-document-text").textContent = `Вы уверены, что хотите удалить задачу «${task.title}»?`;
    $("#delete-document-confirm").textContent = "Да, удалить";
    $("#delete-document-dialog").showModal();
    return;
  }
  if (payload.type === "proceduralAction") {
    const action = caseProceduralItems(item)[payload.actionIndex];
    if (!action || Array.isArray(action)) return;
    state.pendingDocumentDelete = payload;
    $("#delete-document-title").textContent = "Удалить процессуальную дію?";
    $("#delete-document-text").textContent = `Вы уверены, что хотите удалить процессуальную дію «${action.action}»?`;
    $("#delete-document-confirm").textContent = "Да, удалить";
    $("#delete-document-dialog").showModal();
    return;
  }
  if (payload.type === "calendarEvent") {
    const eventItem = state.events.find((event) => `event-${event.id}` === payload.eventId);
    if (!eventItem) return;
    state.pendingDocumentDelete = payload;
    $("#delete-document-title").textContent = "Удалить подію?";
    $("#delete-document-text").textContent = `Вы уверены, что хотите удалить подію «${eventItem.title}»?`;
    $("#delete-document-confirm").textContent = "Да, удалить";
    $("#delete-document-dialog").showModal();
    return;
  }
  const file = payload.type === "procedural"
    ? item.documents[payload.docIndex]
    : caseFolders(item)[payload.folderIndex]?.files[payload.fileIndex];
  if (!file) return;
  state.pendingDocumentDelete = payload;
  $("#delete-document-title").textContent = "Удалить документ?";
  $("#delete-document-text").textContent = `Вы уверены, что хотите удалить документ «${file.name}»?`;
  $("#delete-document-confirm").textContent = "Да, удалить";
  $("#delete-document-dialog").showModal();
}

function closeDeleteDocumentConfirm() {
  state.pendingDocumentDelete = null;
  $("#delete-document-dialog").close();
}

navNodes.forEach((button) => {
  button.addEventListener("click", () => {
    if (button.dataset.view === "cases") {
      state.caseScreen = "list";
      renderCases();
    }
    switchView(button.dataset.view);
  });
});

$("#topbar-back")?.addEventListener("click", goBack);

document.addEventListener("click", (event) => {
  if (event.target.closest("#notifications-toggle")) {
    event.preventDefault();
    event.stopPropagation();
    toggleTopbarPanel("#notifications-toggle", "#notifications-menu");
    return;
  }
  if (event.target.closest("#admin-profile-toggle")) {
    event.preventDefault();
    event.stopPropagation();
    toggleTopbarPanel("#admin-profile-toggle", "#admin-profile-menu");
  }
});

document.querySelectorAll("[data-notification-view]").forEach((button) => {
  button.addEventListener("click", () => {
    markNotificationRead();
    closeTopbarPanels();
    switchView(button.dataset.notificationView);
    showToast("Відкрито розділ зі сповіщення.");
  });
});

$("[data-clear-notifications]")?.addEventListener("click", () => {
  const badge = $("#notifications-count");
  if (badge) {
    badge.textContent = "0";
    badge.classList.add("empty");
  }
  closeTopbarPanels();
  showToast("Сповіщення позначено як прочитані.");
});

document.querySelectorAll("[data-profile-action]").forEach((button) => {
  button.addEventListener("click", () => {
    const action = button.dataset.profileAction;
    closeTopbarPanels();
    if (action === "settings") {
      switchView("settings");
      return;
    }
    if (action === "team") {
      switchView("settings");
      showToast("Розділ користувачів відкривається в налаштуваннях.");
      return;
    }
    if (action === "demo-link") {
      copyDemoLink();
      return;
    }
    if (action === "open-demo") {
      window.open(DEMO_URL, "_blank", "noopener");
      return;
    }
    if (action === "compact") {
      toggleSidebar();
      return;
    }
    showToast("Вихід з акаунта показано як прототипну дію.", "warning");
  });
});

$(".collapse-menu")?.addEventListener("click", toggleSidebar);
$(".sidebar-restore")?.addEventListener("click", toggleSidebar);

document.addEventListener("click", (event) => {
  if (!event.target.closest(".topbar-menu-wrap")) closeTopbarPanels();
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  const topbarPanelOpen = Boolean(document.querySelector(".topbar-panel:not([hidden])"));
  if (topbarPanelOpen) {
    event.preventDefault();
    closeTopbarPanels();
    return;
  }
  if (event.target?.closest?.("input, textarea, select, dialog")) return;
  if (!state.viewHistory.length && !hasInternalBack()) return;
  event.preventDefault();
  goBack();
});

$("#quick-add-client")?.addEventListener("click", () => openClientDialog());

$("#client-dialog-close").addEventListener("click", () => {
  $("#client-dialog").close();
});

$("#case-dialog-close").addEventListener("click", () => {
  $("#case-dialog").close();
});

$("#essence-dialog-close").addEventListener("click", () => {
  $("#essence-dialog").close();
});

$("#authority-dialog-close").addEventListener("click", () => {
  $("#authority-dialog").close();
});

$("#finance-dialog-close").addEventListener("click", () => {
  $("#finance-dialog").close();
});

$("#document-dialog-close").addEventListener("click", () => {
  $("#document-dialog").close();
});

$("#task-dialog-close").addEventListener("click", () => {
  $("#task-dialog").close();
});

$("#event-dialog-close").addEventListener("click", () => {
  $("#event-dialog").close();
});

$("#folder-dialog-close").addEventListener("click", () => {
  $("#folder-dialog").close();
});

$("#delete-document-close").addEventListener("click", closeDeleteDocumentConfirm);
$("#delete-document-cancel").addEventListener("click", closeDeleteDocumentConfirm);
$("#delete-document-confirm").addEventListener("click", () => {
  const pending = state.pendingDocumentDelete;
  if (!pending) return;
  const item = caseById(pending.caseId);
  const today = new Date().toLocaleDateString("uk-UA");
  let deleted;
  if (pending.type === "case") {
    const caseIndex = state.cases.findIndex((caseItem) => caseItem.id === pending.caseId);
    deleted = state.cases.splice(caseIndex, 1)[0];
    state.selectedCaseId = state.cases[0]?.id || "";
    state.caseScreen = "list";
  } else if (pending.type === "procedural") {
    deleted = item.documents.splice(pending.docIndex, 1)[0];
  } else if (pending.type === "folder") {
    const folders = caseFolders(item);
    deleted = folders.splice(pending.folderIndex, 1)[0];
    const deletedIds = new Set((deleted?.files || []).map((file) => file.documentId).filter(Boolean));
    if (deletedIds.size) {
      item.documents = item.documents.filter((doc) => !deletedIds.has(doc.documentId));
    }
    if (state.openFolderIndex === pending.folderIndex) {
      state.openFolderIndex = null;
    } else if (state.openFolderIndex > pending.folderIndex) {
      state.openFolderIndex -= 1;
    }
  } else if (pending.type === "task") {
    deleted = item.tasks.splice(pending.taskIndex, 1)[0];
  } else if (pending.type === "proceduralAction") {
    item.proceduralActions = caseProceduralItems(item);
    deleted = item.proceduralActions.splice(pending.actionIndex, 1)[0];
  } else if (pending.type === "calendarEvent") {
    const eventIndex = state.events.findIndex((event) => `event-${event.id}` === pending.eventId);
    deleted = state.events.splice(eventIndex, 1)[0];
    state.selectedEventId = calendarEntries()[0]?.id || "";
  } else {
    const folder = caseFolders(item)[pending.folderIndex];
    deleted = folder.files.splice(pending.fileIndex, 1)[0];
    folder.updated = today;
  }
  if (pending.type !== "case" && pending.type !== "calendarEvent") {
    item.history.unshift({
      date: today,
      text: pending.type === "folder"
        ? `Видалено папку документів: ${deleted.name}.`
        : pending.type === "task"
          ? `Видалено задачу: ${deleted.title}.`
          : pending.type === "proceduralAction"
            ? `Видалено процесуальну дію: ${deleted.action}.`
          : `Видалено документ: ${deleted.name}.`
    });
  }
  const returnView = pending.returnView || "cases";
  state.pendingDocumentDelete = null;
  $("#delete-document-dialog").close();
  renderAll();
  switchView(returnView);
  showToast(pending.type === "case" ? "Справу видалено." : pending.type === "calendarEvent" ? "Подію видалено з календаря." : "Елемент видалено.", "danger");
});

$("#client-form").addEventListener("submit", (event) => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const clientId = form.get("clientId");

  if (clientId) {
    const stayInCases = $("#cases")?.classList.contains("active") && state.caseScreen === "detail";
    const client = clientById(clientId);
    client.name = form.get("name");
    client.phone = form.get("phone");
    client.email = form.get("email");
    client.address = form.get("address");
    client.request = form.get("request");
    client.status = form.get("status");
    client.telegramUsername = form.get("telegramUsername");
    client.telegram = Boolean(form.get("telegramUsername"));
    client.consent = form.get("status") !== "Не турбувати";
    client.manager = form.get("manager");
    client.source = form.get("source");
    client.lastContact = new Date().toLocaleDateString("uk-UA");
    client.communications = [
      {
        date: new Date().toLocaleDateString("uk-UA"),
        channel: "CRM",
        title: "Дані клієнта оновлено",
        status: "Оновлено"
      },
      ...client.communications
    ];
    state.selectedClientId = client.id;
    $("#client-dialog").close();
    renderAll();
    switchView(stayInCases ? "cases" : "clients");
    showToast("Дані клієнта оновлено.");
    return;
  }

  const nextId = Math.max(...state.clients.map((client) => client.id)) + 1;
  state.clients.push({
    id: nextId,
    name: form.get("name"),
    phone: form.get("phone"),
    email: form.get("email"),
    address: form.get("address"),
    request: form.get("request"),
    status: form.get("status"),
    telegram: Boolean(form.get("telegramUsername")),
    telegramUsername: form.get("telegramUsername"),
    clientType: "Фізична особа",
    consent: form.get("status") !== "Не турбувати",
    manager: form.get("manager"),
    source: form.get("source"),
    added: new Date().toLocaleDateString("uk-UA"),
    lastContact: new Date().toLocaleDateString("uk-UA"),
    nextAction: "Провести первинну консультацію",
    risk: "Середній",
    notes: "Клієнт доданий вручну. Потрібно уточнити документи, згоду на розсилку та створити справу.",
    communications: [
      { date: new Date().toLocaleDateString("uk-UA"), channel: "CRM", title: "Клієнт доданий до бази", status: "Створено" }
    ]
  });
  state.selectedClientId = nextId;
  $("#client-dialog").close();
  renderAll();
  switchView("clients");
  showToast("Клієнта додано до бази.");
});

$("#case-form").addEventListener("submit", (event) => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const caseId = form.get("caseId");
  const deadline = form.get("deadline");

  if (caseId) {
    const item = caseById(caseId);
    item.clientId = Number(form.get("clientId"));
    item.title = form.get("title");
    item.type = form.get("type");
    item.stage = form.get("stage") || "Первинна консультація";
    item.status = form.get("status");
    item.priority = form.get("priority");
    item.responsible = form.get("responsible");
    item.deadline = deadline ? formatDate(deadline) : "Не вказано";
    item.history.unshift({
      date: new Date().toLocaleDateString("uk-UA"),
      text: "Дані справи оновлено."
    });
    state.selectedCaseId = item.id;
    state.caseScreen = "list";
    $("#case-dialog").close();
    renderAll();
    switchView("cases");
    showToast("Справу оновлено.");
    return;
  }

  const currentYear = new Date().getFullYear();
  const nextNumber = String(state.cases.length + 1112).padStart(4, "0");
  const nextId = `${currentYear}/${nextNumber}`;
  const newCase = {
    id: nextId,
    clientId: Number(form.get("clientId")),
    title: form.get("title"),
    type: form.get("type"),
    status: form.get("status"),
    stage: form.get("stage") || "Первинна консультація",
    priority: form.get("priority"),
    responsible: form.get("responsible"),
    court: "Не вказано",
    authorityType: "",
    authorityAddress: "",
    authorityContact: "",
    opened: new Date().toLocaleDateString("uk-UA"),
    deadline: deadline ? formatDate(deadline) : "Не вказано",
    debt: 0,
    income: 0,
    description: "Опис справи буде додано пізніше.",
    documents: [],
    proceduralActions: [],
    folders: [],
    tasks: [],
    history: [
      {
        date: new Date().toLocaleDateString("uk-UA"),
        text: "Справу створено в CRM."
      }
    ]
  };
  state.cases.unshift(newCase);
  state.selectedCaseId = newCase.id;
  state.caseScreen = "detail";
  $("#case-dialog").close();
  renderAll();
  switchView("cases");
  showToast("Нову справу створено.");
});

$("#essence-form").addEventListener("submit", (event) => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const item = caseById(form.get("caseId"));
  if (!item) return;
  item.description = form.get("description") || "Опис справи буде додано пізніше.";
  item.history.unshift({
    date: new Date().toLocaleDateString("uk-UA"),
    text: "Оновлено суть справи."
  });
  state.selectedCaseId = item.id;
  state.caseScreen = "detail";
  $("#essence-dialog").close();
  renderAll();
  switchView("cases");
  showToast("Суть справи збережено.");
});

$("#authority-form").addEventListener("submit", (event) => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const item = caseById(form.get("caseId"));
  if (!item) return;
  item.court = form.get("court") || "Не вказано";
  item.authorityType = form.get("authorityType") || "";
  item.authorityAddress = form.get("authorityAddress") || "";
  item.authorityContact = form.get("authorityContact") || "";
  item.history.unshift({
    date: new Date().toLocaleDateString("uk-UA"),
    text: "Оновлено орган звернення по справі."
  });
  state.selectedCaseId = item.id;
  state.caseScreen = "detail";
  $("#authority-dialog").close();
  renderAll();
  switchView("cases");
  showToast("Орган звернення збережено.");
});

$("#finance-form").addEventListener("submit", (event) => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const item = caseById(form.get("caseId"));
  if (!item) return;
  const total = moneyValue(form.get("totalFee"));
  const paid = Math.min(moneyValue(form.get("paid")), total);
  const firstPaymentDate = form.get("firstPaymentDate");
  const nextPaymentDue = form.get("nextPaymentDue");
  item.totalFee = total;
  item.income = total;
  item.paid = paid;
  item.debt = Math.max(total - paid, 0);
  item.firstPaymentDate = firstPaymentDate ? formatDate(firstPaymentDate) : "";
  item.nextPaymentDue = nextPaymentDue ? formatDate(nextPaymentDue) : "";
  item.financeComment = form.get("financeComment") || "";
  item.history.unshift({
    date: new Date().toLocaleDateString("uk-UA"),
    text: `Оновлено фінанси справи: сума ${currency(total)}, оплачено ${currency(paid)}, борг ${currency(item.debt)}.`
  });
  state.selectedCaseId = item.id;
  $("#finance-dialog").close();
  renderAll();
  switchView("cases");
  showToast("Фінанси справи оновлено.");
});

$("#document-form").addEventListener("submit", (event) => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const item = caseById(form.get("caseId"));
  const file = form.get("file");
  const fileName = file && file.name ? file.name : "";
  const url = form.get("url");
  const name = form.get("name") || fileName || "Новий документ";
  const today = new Date().toLocaleDateString("uk-UA");
  const folders = caseFolders(item);
  const selectedFolder = form.get("folder");
  const editSource = form.get("editSource");
  const source = fileName && url ? "Файл + Google посилання" : fileName ? "Файл з комп'ютера" : url ? "Google посилання" : "Опис без файлу";
  const submitted = form.get("submitted") ? formatDate(form.get("submitted")) : "-";
  const responseDue = form.get("responseDue") ? formatDate(form.get("responseDue")) : "-";

  if (editSource) {
    const docIndex = form.get("docIndex") === "" ? -1 : Number(form.get("docIndex"));
    const folderIndex = form.get("folderIndex") === "" ? -1 : Number(form.get("folderIndex"));
    const fileIndex = form.get("fileIndex") === "" ? -1 : Number(form.get("fileIndex"));
    const doc = item.documents[docIndex];
    const linked = doc ? findFolderFileByDocument(item, doc) : null;
    const folderFile = folderIndex >= 0 ? folders[folderIndex]?.files[fileIndex] : linked?.file;
    const documentId = doc?.documentId || folderFile?.documentId || makeDocumentId();
    const previousFileName = doc?.fileName || folderFile?.fileName || "";
    const previousFileObject = doc?.fileObject || folderFile?.fileObject || null;
    const previousUrl = doc?.url || folderFile?.url || "";
    const nextFileName = fileName || previousFileName;
    const nextFileObject = fileName ? file : previousFileObject;
    const nextUrl = url || previousUrl;
    const nextSource = fileName
      ? (nextUrl ? "Файл + Google посилання" : "Файл з комп'ютера")
      : nextUrl
        ? (nextFileName ? "Файл + Google посилання" : "Google посилання")
        : "Опис без файлу";
    const update = (target) => {
      if (!target) return;
      target.documentId = documentId;
      target.name = name;
      target.type = form.get("type");
      target.status = form.get("status");
      target.submitted = submitted;
      target.responseDue = responseDue;
      target.comment = form.get("comment");
      target.fileName = nextFileName;
      target.fileObject = nextFileObject;
      target.url = nextUrl;
      target.source = nextSource;
      target.updated = today;
    };
    update(doc);
    update(folderFile);
    if (doc) {
      doc.added = doc.added || today;
    }
    if (folderFile) {
      const changedFolder = folders[folderIndex] || linked?.folder;
      if (changedFolder) changedFolder.updated = today;
    }
    item.history.unshift({
      date: today,
      text: `Оновлено документ: ${name}.`
    });
    state.selectedCaseId = item.id;
    $("#document-dialog").close();
    renderAll();
    switchView("cases");
    showToast("Документ оновлено.");
    return;
  }

  let targetFolder = folders[Number(selectedFolder)] || folders[0];
  if (selectedFolder === "__new__") {
    const folderName = form.get("newFolderName") || "Нова папка";
    targetFolder = { name: folderName, updated: today, files: [] };
    folders.push(targetFolder);
    state.openFolderIndex = folders.length - 1;
  } else {
    state.openFolderIndex = Number(selectedFolder);
  }
  const documentId = makeDocumentId();
  item.documents.unshift({
    documentId,
    name,
    type: form.get("type"),
    status: form.get("status"),
    submitted,
    responseDue,
    comment: form.get("comment"),
    fileName,
    fileObject: fileName ? file : null,
    url,
    source,
    added: today
  });
  targetFolder.files.unshift({
    documentId,
    name,
    type: form.get("type"),
    status: form.get("status"),
    submitted,
    responseDue,
    comment: form.get("comment"),
    updated: today,
    fileName,
    fileObject: fileName ? file : null,
    url
  });
  targetFolder.updated = today;
  item.history.unshift({
    date: today,
    text: `Додано документ: ${name} у папку «${targetFolder.name}».`
  });
  state.selectedCaseId = item.id;
  state.openCaseSection = "documents";
  $("#document-dialog").close();
  renderAll();
  switchView("cases");
  showToast("Документ додано до справи.");
});

$("#task-form").addEventListener("submit", (event) => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const taskIndex = form.get("taskIndex") === "" ? null : Number(form.get("taskIndex"));
  const item = caseById(taskIndex !== null ? event.currentTarget.dataset.originalCaseId : form.get("caseId"));
  const due = form.get("due");
  const title = form.get("title");
  if (taskIndex !== null) {
    const task = item.tasks[taskIndex];
    if (!task) return;
    task.title = title;
    task.status = form.get("status");
    task.responsible = form.get("responsible");
    task.due = due ? formatDate(due) : "Не вказано";
    task.showInCalendar = Boolean(form.get("showInCalendar") && due);
    item.history.unshift({
      date: new Date().toLocaleDateString("uk-UA"),
      text: `Оновлено задачу: ${title}.`
    });
    state.selectedCaseId = item.id;
    $("#task-dialog").close();
    renderAll();
    switchView(state.taskDialogReturnView || "cases");
    showToast("Задачу оновлено.");
    return;
  }
  item.tasks.unshift({
    title,
    status: form.get("status"),
    responsible: form.get("responsible"),
    due: due ? formatDate(due) : "Не вказано",
    showInCalendar: Boolean(form.get("showInCalendar") && due)
  });
  item.history.unshift({
    date: new Date().toLocaleDateString("uk-UA"),
    text: `Додано задачу: ${title}.`
  });
  state.selectedCaseId = item.id;
  state.openCaseSection = "tasks";
  $("#task-dialog").close();
  renderAll();
  switchView(state.taskDialogReturnView || "cases");
  showToast("Задачу додано.");
});

$("#folder-form").addEventListener("submit", (event) => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const item = caseById(form.get("caseId"));
  const name = form.get("name");
  const folderIndex = form.get("folderIndex") === "" ? null : Number(form.get("folderIndex"));
  const folders = caseFolders(item);
  const today = new Date().toLocaleDateString("uk-UA");
  if (folderIndex !== null) {
    const folder = folders[folderIndex];
    if (!folder) return;
    const previousName = folder.name;
    folder.name = name;
    folder.updated = today;
    item.history.unshift({
      date: today,
      text: `Папку документів перейменовано: ${previousName} → ${name}.`
    });
    state.selectedCaseId = item.id;
    $("#folder-dialog").close();
    renderAll();
    switchView("cases");
    showToast("Папку перейменовано.");
    return;
  }
  folders.push({
    name,
    updated: today,
    files: []
  });
  item.history.unshift({
    date: today,
    text: `Створено папку документів: ${name}.`
  });
  state.selectedCaseId = item.id;
  $("#folder-dialog").close();
  renderAll();
  switchView("cases");
  showToast("Папку створено.");
});

$("#event-form").addEventListener("submit", (event) => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const date = form.get("date");
  const due = form.get("due");
  const eventId = form.get("eventId");
  const actionIndex = form.get("actionIndex") === "" ? null : Number(form.get("actionIndex"));
  const nextId = Math.max(...state.events.map((item) => item.id)) + 1;
  const selectedCaseId = form.get("caseId");
  const caseItem = selectedCaseId ? caseById(selectedCaseId) : state.cases.find((item) => item.clientId === Number(form.get("client"))) || state.cases[0];
  const status = form.get("status") || "Заплановано";
  if (eventId) {
    const target = state.events.find((item) => `event-${item.id}` === eventId);
    if (!target) return;
    target.day = Number(date.split("-")[2]);
    target.date = date;
    target.time = form.get("time");
    target.endTime = form.get("endTime");
    target.title = form.get("title");
    target.type = form.get("type");
    target.clientId = Number(form.get("client"));
    target.caseId = caseItem.id;
    target.authority = form.get("authority");
    target.location = form.get("location");
    target.responsible = form.get("responsible");
    target.recurrence = form.get("recurrence");
    target.reminderBefore = form.get("reminderBefore");
    target.reminderChannels = form.get("reminderChannels");
    target.reminderRecipients = form.get("reminderRecipients");
    target.description = form.get("description");
    target.status = status;
    state.selectedEventId = eventId;
    state.selectedCaseId = caseItem.id;
    $("#event-dialog").close();
    renderAll();
    switchView("calendar");
    showToast("Подію календаря оновлено.");
    return;
  }
  if (selectedCaseId && actionIndex !== null) {
    caseItem.proceduralActions = caseProceduralItems(caseItem);
    const action = caseItem.proceduralActions[actionIndex];
    if (!action) return;
    action.action = form.get("title");
    action.initiator = form.get("responsible") || "Адвокат";
    action.initiated = formatDate(date);
    action.time = form.get("time");
    action.due = due ? formatDate(due) : `${formatDate(date)} ${form.get("time")}`;
    action.status = status;
    action.tone = status === "Заплановано" ? "blue" : status === "В процесі" ? "amber" : "";
    action.description = form.get("description");
    caseItem.history.unshift({
      date: new Date().toLocaleDateString("uk-UA"),
      text: `Оновлено процесуальну дію: ${form.get("title")}.`
    });
    state.selectedCaseId = caseItem.id;
    $("#event-dialog").close();
    renderAll();
    switchView("cases");
    showToast("Процесуальну дію оновлено.");
    return;
  }
  state.events.push({
    id: nextId,
    day: Number(date.split("-")[2]),
    date,
    time: form.get("time"),
    endTime: form.get("endTime"),
    title: form.get("title"),
    type: form.get("type"),
    clientId: Number(form.get("client")),
    caseId: caseItem.id,
    authority: form.get("authority"),
    location: form.get("location"),
    responsible: form.get("responsible"),
    recurrence: form.get("recurrence"),
    reminderBefore: form.get("reminderBefore"),
    reminderChannels: form.get("reminderChannels"),
    reminderRecipients: form.get("reminderRecipients"),
    reminderLog: [],
    description: form.get("description"),
    status
  });
  if (selectedCaseId) {
    caseItem.proceduralActions = caseProceduralItems(caseItem);
    caseItem.proceduralActions.unshift({
      action: form.get("title"),
      initiator: form.get("responsible") || "Адвокат",
      initiated: formatDate(date),
      time: form.get("time"),
      due: due ? formatDate(due) : `${formatDate(date)} ${form.get("time")}`,
      status,
      tone: semanticTone(status),
      description: form.get("description")
    });
    caseItem.history.unshift({
      date: new Date().toLocaleDateString("uk-UA"),
      text: `Додано процесуальну дію: ${form.get("title")}.`
    });
  }
  state.selectedEventId = `event-${nextId}`;
  state.selectedCaseId = caseItem.id;
  state.openCaseSection = "events";
  $("#event-dialog").close();
  renderAll();
  switchView(selectedCaseId ? "cases" : "calendar");
  showToast(selectedCaseId ? "Процесуальну дію додано." : "Подію додано до календаря.");
});

$("#global-search")?.addEventListener("input", (event) => {
  const value = event.target.value.trim();
  if (!value) return;
  switchView("clients");
  setTimeout(() => {
    const filter = $("#client-filter");
    if (filter) {
      filter.value = value;
      renderClientRows();
    }
  }, 0);
});

restoreNavigationState();
renderAll();
switchView(state.currentView || "dashboard", { skipHistory: true });
