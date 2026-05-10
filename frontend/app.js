import { createInitialState } from "./js/state.js";
import {
  caseFinance,
  caseFolders,
  caseProceduralItems,
  renderCaseListScreen,
  renderCaseProfileScreen,
  renderCasesScreen
} from "./js/screens/cases.js";
import {
  calendarEntries as calendarEntriesScreen,
  calendarEventMeta as calendarEventMetaScreen,
  calendarEventTypes as calendarEventTypesScreen,
  calendarStatuses as calendarStatusesScreen,
  renderCalendarScreen
} from "./js/screens/calendar.js";
import {
  renderClientProfile as renderClientProfileScreen,
  renderClientRows as renderClientRowsScreen,
  renderClientsScreen
} from "./js/screens/clients.js";
import {
  renderMailingsScreen,
  setMailingTab as setMailingTabScreen
} from "./js/screens/mailings.js";
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
    semanticTone,
    formatDate,
    currency,
    currencyText,
    addDays,
    calendarTimeTone,
    calendarTitle,
    calendarToday,
    calendarViewDays,
    dateFromIso,
    isoFromDate,
    monthNames,
    todayIso,
    weekDayNames,
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
    parseDisplayDate,
    renderCases,
    switchView,
    showToast,
    syncNavigationState
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
  renderCasesScreen(screenContext());
}

function renderCaseList() {
  renderCaseListScreen(screenContext());
}

function renderCaseProfile(id) {
  renderCaseProfileScreen(screenContext(), id);
}

function calendarEventTypes() {
  return calendarEventTypesScreen(screenContext());
}

function calendarStatuses() {
  return calendarStatusesScreen(screenContext());
}

function calendarEventMeta(event) {
  return calendarEventMetaScreen(screenContext(), event);
}

function calendarEntries() {
  return calendarEntriesScreen(screenContext());
}

function renderCalendar() {
  renderCalendarScreen(screenContext());
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
  setMailingTabScreen(screenContext(), tab, remember);
}

function renderMailings() {
  renderMailingsScreen(screenContext());
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
