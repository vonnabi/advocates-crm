import { saveTaskToApi, shouldUseApi } from "../api.js";
import { normalizeTask } from "../state.js";

let state;
let $;
let icon;
let actionMenu;
let bindActionMenus;
let badge;
let riskTone;
let taskTone;
let documentStatusTone;
let formatDate;
let advocatePhoto;
let clientById;
let caseById;
let parseDisplayDate;
let openTaskDialog;
let openSubtaskDialog;
let openDeleteDocumentConfirm;
let renderAll;
let renderCases;
let switchView;
let bindViewLinks;
let syncNavigationState;
let showToast;

function applyContext(ctx) {
  ({
    state,
    $,
    icon,
    actionMenu,
    bindActionMenus,
    badge,
    riskTone,
    taskTone,
    documentStatusTone,
    formatDate,
    advocatePhoto,
    clientById,
    caseById,
    parseDisplayDate,
    openTaskDialog,
    openSubtaskDialog,
    openDeleteDocumentConfirm,
    renderAll,
    renderCases,
    switchView,
    bindViewLinks,
    syncNavigationState,
    showToast
  } = ctx);
}

function displayRelativeDate(daysFromToday = 0) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  return `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")}.${date.getFullYear()}`;
}

function deriveTaskPriority(task = {}) {
  if (task.priority) return task.priority;
  if (["Терміново", "Срочно"].includes(task.status)) return "Високий";
  if (["Не терміново", "Не срочно"].includes(task.status)) return "Низький";
  return "Середній";
}

function getTaskDueDate(task = {}) {
  const dueIso = parseDisplayDate(task.due || task.dueText);
  return dueIso ? new Date(`${dueIso}T00:00:00`) : null;
}

function daysUntilTaskDue(dueDate) {
  if (!dueDate) return Infinity;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((dueDate - today) / 86400000);
}

function plannerAutoReason(priority, overdue, daysUntilDue) {
  if (overdue) return "Просрочено";
  if (priority === "Високий") return "Високий пріоритет";
  if (daysUntilDue === 0) return "Дедлайн сьогодні";
  if (daysUntilDue === 1) return "Дедлайн завтра";
  if (priority === "Середній" && daysUntilDue <= 3) return "Дедлайн до 3 днів";
  return "";
}

function sourceTask(task) {
  return task ? caseById(task.caseId)?.tasks?.[task.taskIndex] : null;
}

async function persistTask(task, source = sourceTask(task)) {
  if (!source || !shouldUseApi(state)) return source;
  if (!source.id) return source;
  const caseItem = caseById(task.caseId);
  const saved = normalizeTask(await saveTaskToApi({
    ...source,
    caseId: task.caseId,
    clientId: caseItem?.clientId || task.clientId
  }));
  Object.assign(source, saved);
  return source;
}

function taskCoexecutors(task = {}) {
  if (Array.isArray(task.coexecutors)) return task.coexecutors.filter(Boolean);
  return String(task.coexecutors || "").split(",").map((value) => value.trim()).filter(Boolean);
}

function taskReminderLabel(task = {}) {
  if (!task.reminderEnabled) return "Без нагадування";
  return `${task.reminderBefore || "За 1 день"} · ${task.reminderChannel || "CRM"}`;
}

function taskSubtasks(task = {}, fallbackResponsible = "") {
  if (Array.isArray(task.subtasks)) return task.subtasks;
  return [
    { title: "Перевірити вихідні матеріали", responsible: fallbackResponsible, due: task.dueText || task.due || "Не вказано", status: task.completed ? "Виконано" : "В роботі" },
    { title: "Підготувати результат по задачі", responsible: fallbackResponsible, due: task.plannerDateText || task.dueText || "Не вказано", status: task.completed ? "Виконано" : "Нова" }
  ];
}

function taskProgress(task = {}, subtasks = []) {
  if (task.completed) return 100;
  if (subtasks.length) {
    return Math.max(10, Math.round((subtasks.filter((subtask) => subtask.status === "Виконано").length / subtasks.length) * 100));
  }
  if (task.status === "В роботі") return 60;
  if (task.status === "Очікує") return 35;
  return 20;
}

const TASK_STATUS_OPTIONS = [
  "Нова",
  "Заплановано",
  "Очікує",
  "В роботі",
  "На перевірці",
  "Перенесено",
  "Просрочено",
  "Скасовано",
  "Терміново",
  "Не терміново",
  "Виконано"
];

function taskStatusIconName(status) {
  const icons = {
    "Нова": "tag",
    "Заплановано": "calendar",
    "Очікує": "clock",
    "В роботі": "refresh",
    "На перевірці": "search",
    "Перенесено": "calendar",
    "Просрочено": "warning",
    "Скасовано": "trash",
    "Терміново": "bell",
    "Не терміново": "clock",
    "Виконано": "check"
  };
  return icons[status] || "tag";
}

function taskStatusUiTone(status) {
  const tones = {
    "Нова": "task-new",
    "Заплановано": "task-planned",
    "Очікує": "task-waiting",
    "В роботі": "task-work",
    "На перевірці": "task-review",
    "Перенесено": "task-moved",
    "Просрочено": "task-overdue",
    "Скасовано": "task-cancelled",
    "Терміново": "task-urgent",
    "Не терміново": "task-low",
    "Виконано": "task-done"
  };
  return tones[status] || "task-default";
}

function renderTaskSubtasksMenu(task = {}) {
  const subtasks = taskSubtasks(task, task.responsible);
  const doneCount = subtasks.filter((subtask) => subtask.status === "Виконано").length;
  return `
    <details class="task-subtasks-popover" data-task-subtasks-menu>
      <summary>
        ${icon("check")}
        <span>Підзадачі: ${subtasks.length}</span>
        <em>${subtasks.length ? `${doneCount}/${subtasks.length}` : "0"}</em>
      </summary>
      <div class="task-subtasks-menu">
        ${subtasks.length ? subtasks.map((subtask, subtaskIndex) => `
          <div class="task-subtasks-menu-row">
            <span>
              <strong>${subtask.title}</strong>
              <small>${subtask.responsible || task.responsible || "Не вказано"} · ${subtask.due || task.dueText || "Не вказано"}</small>
            </span>
            ${badge(subtask.status || "Нова", taskTone(subtask.status || "Нова"))}
            <div class="task-subtasks-actions">
              ${actionMenu([
                { label: "Редагувати підзадачу", icon: "edit", attrs: { "data-edit-subtask-task": task.key, "data-subtask-index": subtaskIndex } },
                { label: "Видалити підзадачу", icon: "trash", danger: true, attrs: { "data-delete-subtask-task": task.key, "data-subtask-index": subtaskIndex } }
              ], { label: "Дії підзадачі", triggerAttr: "data-subtask-action-menu-trigger" })}
            </div>
          </div>
        `).join("") : `<p class="task-subtasks-empty">Підзадач поки немає</p>`}
        <button class="task-subtasks-new" type="button" data-new-subtask-task="${task.key}">+ Додати підзадачу</button>
      </div>
    </details>
  `;
}

function syncPlannerQueue(tasks = allCaseTasks()) {
  let changed = 0;
  tasks.forEach((task) => {
    const source = sourceTask(task);
    if (!source) return;
    const nextReason = task.plannerAutoReason || "";
    if ((source.plannerAutoReason || "") !== nextReason) changed += 1;
    source.plannerAutoReason = nextReason;
  });
  return {
    changed,
    planned: tasks.filter((task) => task.plannerIncluded && !task.completed).length
  };
}

export function renderTasksScreen(ctx) {
  applyContext(ctx);
  renderTasks();
}

export function allCaseTasks(ctx = null) {
  if (ctx) applyContext(ctx);
  const tasks = state.cases.flatMap((item) => {
    const client = clientById(item.clientId);
    return item.tasks.map((task, index) => {
      const dueDate = getTaskDueDate(task);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const completed = task.status === "Виконано";
      const overdue = Boolean(dueDate && dueDate < today && !completed);
      const responsible = task.responsible || item.responsible || client?.manager || "Не вказано";
      const priority = deriveTaskPriority(task);
      const daysUntilDue = daysUntilTaskDue(dueDate);
      const autoReason = plannerAutoReason(priority, overdue, daysUntilDue);
      const manualReason = task.plannerManual ? "Додано вручну" : "";
      const importantReason = task.plannerImportant ? "Важлива задача" : "";
      const plannerSuppressed = Boolean(task.plannerSuppressed && !task.plannerManual && !task.plannerImportant);
      const coexecutors = taskCoexecutors(task);
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
        daysUntilDue,
        priority,
        coexecutors,
        teamTask: coexecutors.length > 0,
        reminderLabel: taskReminderLabel(task),
        plannerDateText: task.plannerDateText || (task.plannerDate ? formatDate(task.plannerDate) : ""),
        plannerAutoReason: autoReason,
        plannerReason: manualReason || importantReason || autoReason || "",
        plannerIncluded: Boolean(!plannerSuppressed && (task.plannerManual || task.plannerImportant || autoReason)),
        plannerManual: Boolean(task.plannerManual),
        plannerImportant: Boolean(task.plannerImportant),
        plannerSuppressed
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
  const subtasks = taskSubtasks(task, task.responsible);
  const progress = taskProgress(task, subtasks);
  const dueIso = parseDisplayDate(task.dueText);
  const plannerDate = task.plannerDateText || (dueIso ? formatDate(dueIso) : "Не заплановано");
  const dueStatus = task.overdue ? "Просрочено" : task.daysUntilDue === 0 ? "Сьогодні" : task.daysUntilDue === 1 ? "Завтра" : "За планом";
  const detailTab = state.taskDetailTab || "info";
  const plannerLabel = task.plannerIncluded
    ? `${task.plannerReason || "Заплановано"}<br>${plannerDate}`
    : "Не заплановано";
  const coexecutors = taskCoexecutors(task);
  const taskFiles = [
    ...(task.files || []).map((file) => ({
      name: file.name,
      meta: file.meta || file.status || "Файл задачі",
      tone: documentStatusTone(file.status)
    })),
    ...(caseItem?.documents || []).slice(0, 3).map((document) => ({
      name: `${document.name}.docx`,
      meta: `${document.status || "Без статусу"} · ${document.submitted || "дата не вказана"}`,
      tone: documentStatusTone(document.status)
    })),
    { name: "Матеріали задачі.pdf", meta: "Файл задачі · чернетка", tone: "blue" }
  ].slice(0, 4);
  const taskHistory = [
    ...(task.history || []),
    { date: task.dueText, text: `Дедлайн задачі встановлено для ${task.responsible}.` },
    ...(task.plannerIncluded ? [{ date: plannerDate, text: `Задачу додано до планера: ${task.plannerReason || "ручне планування"}.` }] : []),
    ...(caseItem?.history || []).slice(0, 2)
  ];
  const taskComments = task.comments || (task.comment ? [{ author: task.responsible, date: task.dueText, text: task.comment }] : []);
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
        <div>
          <span>Співвиконавці</span>
          <strong>${coexecutors.length ? coexecutors.map((name) => `<em class="task-chip">${name}</em>`).join("") : "Не призначено"}</strong>
        </div>
        <div><span>Дедлайн</span><strong>${task.dueText}<br><em>${dueStatus}</em></strong></div>
        <div>
          <span>Статус</span>
          <details class="task-status-picker ${taskStatusUiTone(task.status)}" data-task-status-menu>
            <summary>
              <span>${icon(taskStatusIconName(task.status))}</span>
              <strong>${task.status || "Без статусу"}</strong>
              <i>⌄</i>
            </summary>
            <div>
              ${TASK_STATUS_OPTIONS.map((status) => `
                <button class="${taskStatusUiTone(status)} ${task.status === status ? "active" : ""}" type="button" data-task-status-pick="${task.key}" data-task-status-value="${status}">
                  <span>${icon(taskStatusIconName(status))}</span>
                  <strong>${status}</strong>
                  ${task.status === status ? `<em>${icon("check")}</em>` : ""}
                </button>
              `).join("")}
            </div>
          </details>
        </div>
        <div>
          <span>Пов'язана з планером</span>
          <strong class="planner-connected"><span class="event-dot ${task.plannerIncluded ? "court" : ""}"></span>${plannerLabel}</strong>
        </div>
        <div>
          <span>Нагадування</span>
          <strong>${task.reminderLabel}</strong>
        </div>
      </div>
      <h3>Опис</h3>
      <p>${task.caseTitle}. ${task.description || "Контроль виконання задачі та пов'язаних матеріалів по справі."}</p>
      ${task.comment ? `<h3>Коментар</h3><p>${task.comment}</p>` : ""}
      <div class="task-progress">
        <div><strong>Прогрес виконання</strong><span>${progress}%</span></div>
        <i style="--progress:${progress}%"></i>
      </div>
    `,
    subtasks: `
      <div class="task-subtask-list">
        ${subtasks.length ? subtasks.map((subtask, subtaskIndex) => `
          <label class="task-subtask-row">
            <input type="checkbox" data-toggle-subtask-task="${task.key}" data-subtask-index="${subtaskIndex}" ${subtask.status === "Виконано" ? "checked" : ""} />
            <span>
              <strong>${subtask.title}</strong>
              <em>${subtask.responsible} · ${subtask.due}</em>
            </span>
            ${badge(subtask.status, taskTone(subtask.status))}
          </label>
        `).join("") : `<p class="task-subtasks-side-empty">Підзадач поки немає. Додайте першу, щоб розбити роботу на кроки.</p>`}
      </div>
      <button class="secondary task-inline-add" data-new-subtask-task="${task.key}">+ Додати підзадачу</button>
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
    `,
    comments: `
      <div class="task-history-list task-comments-list">
        ${taskComments.map((item) => `
          <div class="task-history-row">
            <i></i>
            <span>${item.date || "Сьогодні"} · ${item.author || task.responsible}</span>
            <strong>${item.text}</strong>
          </div>
        `).join("") || `<p class="muted">Коментарів по задачі ще немає.</p>`}
      </div>
      <button class="secondary task-inline-add" data-edit-task-global="${task.key}">+ Додати коментар</button>
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
        <button class="${detailTab === "subtasks" ? "active" : ""}" data-task-detail-tab="subtasks">Підзадачі <span>${subtasks.length}</span></button>
        <button class="${detailTab === "files" ? "active" : ""}" data-task-detail-tab="files">Файли</button>
        <button class="${detailTab === "comments" ? "active" : ""}" data-task-detail-tab="comments">Коментарі <span>${taskComments.length}</span></button>
        <button class="${detailTab === "history" ? "active" : ""}" data-task-detail-tab="history">Історія</button>
      </div>
      <div class="task-detail-panel">${detailPanels[detailTab] || detailPanels.info}</div>
      <div class="task-side-actions">
        <button class="secondary task-action-line" data-open-task-case="${task.caseId}">${icon("file")} Відкрити справу</button>
        <button class="secondary task-action-line" data-edit-task-global="${task.key}">+ Додати підзадачу</button>
        <button class="secondary task-action-line" data-edit-task-global="${task.key}">${icon("calendar")} Перенести дедлайн</button>
        <button class="secondary task-action-line" data-edit-task-global="${task.key}">${icon("tag")} Змінити пріоритет</button>
        <button class="secondary task-action-line" data-plan-task="${task.key}">${icon("calendar")} ${task.plannerManual ? "Прибрати з Планера" : "Додати в Планер"}</button>
        <button class="secondary task-action-line" data-important-task="${task.key}">${icon("bell")} ${task.plannerImportant ? "Зняти важливість" : "Позначити як важливу"}</button>
        <button class="secondary danger task-action-line" data-toggle-side-task="${task.key}">${icon("check")} ${task.completed ? "Повернути в роботу" : "Позначити виконаною"}</button>
      </div>
    </aside>
  `;
}

function renderTasks() {
  const tasks = allCaseTasks();
  const query = (state.taskQuery || "").toLowerCase().trim();
  const tab = state.taskTab || "all";
  const quickFilter = state.taskQuickFilter || "all";
  const filtered = tasks.filter((task) => {
    const byQuery = !query || [
      task.title,
      task.caseId,
      task.caseTitle,
      task.clientName,
      task.responsible,
      task.description,
      task.comment,
      ...taskCoexecutors(task)
    ].some((value) => String(value).toLowerCase().includes(query));
    const byStatus = state.taskStatusFilter === "all" || task.status === state.taskStatusFilter;
    const byPriority = state.taskPriorityFilter === "all" || task.priority === state.taskPriorityFilter;
    const byCase = state.taskCaseFilter === "all" || task.caseId === state.taskCaseFilter;
    const byResponsible = state.taskResponsibleFilter === "all" || task.responsible === state.taskResponsibleFilter;
    const byTab =
      tab === "all" ||
      (tab === "mine" && task.responsible === "Іваненко А.Ю.") ||
      (tab === "team" && task.teamTask) ||
      (tab === "overdue" && task.overdue) ||
      (tab === "done" && task.completed) ||
      (tab === "cases" && task.caseId);
    const byQuick =
      quickFilter === "all" ||
      (quickFilter === "done" && task.completed) ||
      (quickFilter === "work" && task.status === "В роботі") ||
      (quickFilter === "overdue" && task.overdue) ||
      (quickFilter === "planner" && (task.plannerIncluded || task.reminderEnabled));
    return byQuery && byStatus && byPriority && byCase && byResponsible && byTab && byQuick;
  });
  const taskKeys = new Set(tasks.map((task) => task.key));
  state.selectedTaskKeys = (state.selectedTaskKeys || []).filter((key) => taskKeys.has(key));
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
  const selectedTaskSet = new Set(state.selectedTaskKeys || []);
  const selectedPageCount = pageTasks.filter((task) => selectedTaskSet.has(task.key)).length;
  const selectedCount = selectedTaskSet.size;
  const allPageSelected = Boolean(pageTasks.length && selectedPageCount === pageTasks.length);
  const somePageSelected = Boolean(selectedPageCount && selectedPageCount < pageTasks.length);
  const urgentCount = tasks.filter((task) => ["Терміново", "Срочно"].includes(task.status)).length;
  const overdueCount = tasks.filter((task) => task.overdue).length;
  const doneCount = tasks.filter((task) => task.completed).length;
  const plannedCount = tasks.filter((task) => task.plannerIncluded && !task.completed).length;
  const teamCount = tasks.filter((task) => task.teamTask).length;
  const reminderCount = tasks.filter((task) => task.reminderEnabled).length;
  const inWorkCount = tasks.filter((task) => task.status === "В роботі").length;
  const completion = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;
  const responsibleOptions = [...new Set(tasks.map((task) => task.responsible).filter(Boolean))];
  const hasManualTaskFilters =
    Boolean(query) ||
    tab !== "all" ||
    (state.taskStatusFilter || "all") !== "all" ||
    (state.taskPriorityFilter || "all") !== "all" ||
    (state.taskCaseFilter || "all") !== "all" ||
    (state.taskResponsibleFilter || "all") !== "all";
  const allKpiActive = quickFilter === "all" && !hasManualTaskFilters;
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
  const bottomPlanItems = tasks
    .filter((task) => task.plannerIncluded && !task.completed)
    .sort((a, b) => String(a.plannerTime || a.dueText).localeCompare(String(b.plannerTime || b.dueText)))
    .slice(0, 3);
  const planTime = (task) => task.plannerTime || String(task.dueText || "").match(/\d{2}:\d{2}/)?.[0] || "09:00";
  const planTone = (task) => task.priority === "Високий" ? "red" : task.priority === "Середній" ? "amber" : task.priority === "Низький" ? "green" : "blue";
  const taskDataHint = tasks.length ? "" : "Без даних";
  const taskPercent = (value) => tasks.length ? `${Math.round((value / tasks.length) * 100)}%` : taskDataHint;
  const plannerPercent = tasks.length ? `${Math.round((plannedCount / tasks.length) * 100)}% у плані` : taskDataHint;
  const syncSteps = [
    { icon: "calendar", title: "Створіть задачу", text: "Додайте задачу з дедлайном" },
    { icon: "check", title: "Встановіть пріоритет", text: "Задачі сортуються за важливістю" },
    { icon: "briefcase", title: "Додано в планер", text: "Важливі задачі йдуть у план" },
    { icon: "calendar", title: "Виконуйте та контролюйте", text: "Відстежуйте прогрес" }
  ];
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
        <button class="${tab === "team" ? "active" : ""}" data-task-tab="team">Командні <span>${teamCount}</span></button>
        <button class="${tab === "cases" ? "active" : ""}" data-task-tab="cases">По справах</button>
        <button class="${tab === "overdue" ? "active" : ""}" data-task-tab="overdue">Просрочені</button>
        <button class="${tab === "done" ? "active" : ""}" data-task-tab="done">Завершені</button>
      </div>
      <div class="tasks-workspace ${selected ? "has-task-detail" : "is-full"}">
        <div class="tasks-main-column">
          <div class="tasks-kpi-grid">
            <button class="panel tasks-kpi-card ${allKpiActive ? "active" : ""}" type="button" data-task-kpi="all"><div><span>Всього задач</span><strong>${tasks.length}</strong><em>${tasks.length ? "поточний список" : taskDataHint}</em></div><i>${icon("calendar")}</i></button>
            <button class="panel tasks-kpi-card ${quickFilter === "done" ? "active" : ""}" type="button" data-task-kpi="done"><div><span>Виконано</span><strong>${doneCount}</strong><em>${tasks.length ? `${completion}%` : taskDataHint}</em></div><i class="green">${icon("check")}</i></button>
            <button class="panel tasks-kpi-card ${quickFilter === "work" ? "active" : ""}" type="button" data-task-kpi="work"><div><span>В роботі</span><strong>${inWorkCount}</strong><em>${taskPercent(inWorkCount)}</em></div><i class="amber">${icon("search")}</i></button>
            <button class="panel tasks-kpi-card ${quickFilter === "overdue" ? "active" : ""}" type="button" data-task-kpi="overdue"><div><span>Просрочені</span><strong>${overdueCount}</strong><em>${taskPercent(overdueCount)}</em></div><i class="red">${icon("warning")}</i></button>
            <button class="panel tasks-kpi-card ${quickFilter === "planner" ? "active" : ""}" type="button" data-task-kpi="planner"><div><span>Планер / нагадування</span><strong>${plannedCount} / ${reminderCount}</strong><em>${plannerPercent}</em></div><i class="violet">${icon("calendar")}</i></button>
          </div>
          <div class="tasks-toolbar">
            <input id="task-search" value="${state.taskQuery || ""}" type="search" placeholder="Пошук задачі, клієнта, справи..." />
            <select id="task-priority-filter">
              <option value="all">Всі пріоритети</option>
              <option value="Високий" ${state.taskPriorityFilter === "Високий" ? "selected" : ""}>Високий</option>
              <option value="Середній" ${state.taskPriorityFilter === "Середній" ? "selected" : ""}>Середній</option>
              <option value="Низький" ${state.taskPriorityFilter === "Низький" ? "selected" : ""}>Низький</option>
              <option value="Плановий" ${state.taskPriorityFilter === "Плановий" ? "selected" : ""}>Плановий</option>
            </select>
            <select id="task-status-filter">
              <option value="all">Всі статуси</option>
              ${["Нова", "Заплановано", "Очікує", "В роботі", "На перевірці", "Перенесено", "Просрочено", "Скасовано", "Терміново", "Не терміново", "Виконано"].map((status) => `<option value="${status}" ${state.taskStatusFilter === status ? "selected" : ""}>${status}</option>`).join("")}
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
              <tr><th><span class="task-title-head"><span></span><input type="checkbox" data-select-task-page aria-label="Вибрати всі задачі на сторінці" ${allPageSelected ? "checked" : ""} /><span>Задача</span><span class="tasks-bulk-bar ${selectedCount ? "active" : ""}" aria-label="Масові дії задач"><em>${selectedCount}</em><button class="task-bulk-icon bulk-done" type="button" data-task-bulk-action="done" data-tooltip="Позначити виконаними" aria-label="Позначити виконаними">${icon("check")}</button><button class="task-bulk-icon bulk-work" type="button" data-task-bulk-action="work" data-tooltip="Повернути в роботу" aria-label="Повернути в роботу">${icon("refresh")}</button><button class="task-bulk-icon bulk-planner" type="button" data-task-bulk-action="planner" data-tooltip="Додати в планер" aria-label="Додати в планер">${icon("calendar")}</button><button class="task-bulk-icon bulk-clear" type="button" data-task-bulk-action="clear" data-tooltip="Скинути вибір" aria-label="Скинути вибір">×</button></span></span></th><th>Пріоритет</th><th>Справа</th><th>Відповідальний</th><th>Дедлайн</th><th>Статус</th><th></th></tr>
            </thead>
            <tbody>
              ${pageTasks.map((task) => `
                <tr class="${task.key === selected?.key ? "selected" : ""} ${task.completed ? "task-done-row" : ""}" data-task-key="${task.key}" data-task-drop="${task.key}">
                  <td>
                    <div class="task-title-cell">
                      <span class="task-drag-handle" draggable="true" data-task-drag="${task.key}" title="Перемістити задачу" aria-label="Перемістити задачу"></span>
                      <input type="checkbox" data-select-task-row="${task.key}" ${selectedTaskSet.has(task.key) ? "checked" : ""} aria-label="Вибрати задачу" />
                      <div>
                        <strong>${task.title}</strong>
                        <span>${task.caseTitle}</span>
                        <div class="task-row-meta">
                          ${renderTaskSubtasksMenu(task)}
                          ${task.teamTask ? `<b>Співвиконавці: ${task.coexecutors.length}</b>` : ""}
                          ${task.reminderEnabled ? `<b>${icon("bell")} ${task.reminderBefore || "Нагадування"}</b>` : ""}
                          ${task.plannerIncluded ? `<b>${icon("calendar")} Планер</b>` : ""}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>${badge(task.priority, riskTone(task.priority))}</td>
                  <td><a href="#" data-open-task-case="${task.caseId}">№${task.caseId}</a><span>${task.clientName}</span></td>
                  <td><span class="task-assignee">${advocatePhoto(task.responsible, "mini")}${task.responsible}</span></td>
                  <td class="${task.overdue ? "danger-text" : ""}">${task.dueText}<span>${task.overdue ? "Просрочено" : "За планом"}</span></td>
                  <td>
                    <span class="task-status-icon ${taskStatusUiTone(task.overdue ? "Просрочено" : task.status)}" data-tooltip="${task.overdue ? "Просрочено" : task.status || "Без статусу"}" tabindex="0" role="img" aria-label="Статус: ${task.overdue ? "Просрочено" : task.status || "Без статусу"}">
                      ${icon(taskStatusIconName(task.overdue ? "Просрочено" : task.status))}
                    </span>
                    <span class="sr-only">${task.status || "Без статусу"}</span>
                  </td>
                  <td>
                    <div class="case-row-actions task-list-actions">
                      ${actionMenu([
                        { label: "Редагувати", icon: "edit", attrs: { "data-edit-task-global": task.key } },
                        { label: "Видалити", icon: "trash", danger: true, attrs: { "data-delete-task-global": task.key } }
                      ], { label: "Дії задачі" })}
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
          <div class="task-sync-flow">
            ${syncSteps.map((step, index) => `
              <span class="task-sync-step">
                <i>${icon(step.icon)}</i>
                <strong>${step.title}</strong>
                <em>${step.text}</em>
              </span>
              ${index < syncSteps.length - 1 ? `<b class="task-sync-arrow">→</b>` : ""}
            `).join("")}
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
          <h2>Задачі в планері на завтра (${displayRelativeDate(1)})</h2>
          <div class="task-plan-list">
            ${bottomPlanItems.map((task) => `
              <div class="task-plan-row ${planTone(task)}">
                <time>${planTime(task)}</time>
                <span>
                  <strong>${task.title}</strong>
                  <em>№${task.caseId}</em>
                </span>
              </div>
            `).join("") || `<p class="muted">Задачі в планері відсутні.</p>`}
          </div>
          <button class="ghost" data-view-link="planner">Відкрити планер</button>
        </article>
      </div>
    </div>
  `;

  const selectPageCheckbox = document.querySelector("[data-select-task-page]");
  if (selectPageCheckbox) selectPageCheckbox.indeterminate = somePageSelected;

  document.querySelectorAll("[data-task-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      state.taskTab = button.dataset.taskTab;
      state.taskQuickFilter = "all";
      state.selectedTaskKeys = [];
      state.taskPage = 1;
      renderTasks();
    });
  });
  document.querySelectorAll("[data-task-kpi]").forEach((button) => {
    button.addEventListener("click", () => {
      state.taskQuickFilter = button.dataset.taskKpi || "all";
      state.taskTab = "all";
      state.taskQuery = "";
      state.taskStatusFilter = "all";
      state.taskPriorityFilter = "all";
      state.taskCaseFilter = "all";
      state.taskResponsibleFilter = "all";
      state.selectedTaskKeys = [];
      state.selectedTaskKey = "";
      state.taskDetailOpen = false;
      state.taskPage = 1;
      renderTasks();
    });
  });
  $("#task-search")?.addEventListener("input", (event) => {
    state.taskQuery = event.currentTarget.value;
    state.taskQuickFilter = "all";
    state.selectedTaskKeys = [];
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
    state.taskQuickFilter = "all";
    state.selectedTaskKeys = [];
    state.taskPage = 1;
    renderTasks();
  });
  $("#task-case-filter")?.addEventListener("change", (event) => {
    state.taskCaseFilter = event.currentTarget.value;
    state.taskQuickFilter = "all";
    state.selectedTaskKeys = [];
    state.taskPage = 1;
    renderTasks();
  });
  $("#task-priority-filter")?.addEventListener("change", (event) => {
    state.taskPriorityFilter = event.currentTarget.value;
    state.taskQuickFilter = "all";
    state.selectedTaskKeys = [];
    state.taskPage = 1;
    renderTasks();
  });
  $("#task-responsible-filter")?.addEventListener("change", (event) => {
    state.taskResponsibleFilter = event.currentTarget.value;
    state.taskQuickFilter = "all";
    state.selectedTaskKeys = [];
    state.taskPage = 1;
    renderTasks();
  });
  $("#task-page-size")?.addEventListener("change", (event) => {
    state.taskPageSize = event.currentTarget.value === "all" ? "all" : Number(event.currentTarget.value);
    state.selectedTaskKeys = [];
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
      state.selectedTaskKeys = [];
      renderTasks();
    });
  });
  document.querySelector("[data-select-task-page]")?.addEventListener("click", (event) => event.stopPropagation());
  document.querySelector("[data-select-task-page]")?.addEventListener("change", (event) => {
    const pageKeys = pageTasks.map((task) => task.key);
    const next = new Set(state.selectedTaskKeys || []);
    pageKeys.forEach((key) => {
      if (event.currentTarget.checked) next.add(key);
      else next.delete(key);
    });
    state.selectedTaskKeys = [...next];
    renderTasks();
  });
  document.querySelectorAll("[data-select-task-row]").forEach((input) => {
    input.addEventListener("click", (event) => event.stopPropagation());
    input.addEventListener("change", () => {
      const next = new Set(state.selectedTaskKeys || []);
      if (input.checked) next.add(input.dataset.selectTaskRow);
      else next.delete(input.dataset.selectTaskRow);
      state.selectedTaskKeys = [...next];
      renderTasks();
    });
  });
  document.querySelectorAll("[data-task-bulk-action]").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.stopPropagation();
      const action = button.dataset.taskBulkAction;
      if (action === "clear") {
        state.selectedTaskKeys = [];
        renderTasks();
        showToast?.("Вибір задач скинуто.");
        return;
      }
      const selectedTasks = tasks.filter((task) => (state.selectedTaskKeys || []).includes(task.key));
      if (!selectedTasks.length) return;
      const today = new Date().toLocaleDateString("uk-UA");
      const changed = [];
      selectedTasks.forEach((task) => {
        const source = sourceTask(task);
        if (!source) return;
        if (button.dataset.taskBulkAction === "done") {
          source.status = "Виконано";
        }
        if (button.dataset.taskBulkAction === "work") {
          source.status = "В роботі";
        }
        if (button.dataset.taskBulkAction === "planner") {
          source.plannerManual = true;
          source.plannerSuppressed = false;
        }
        source.history = [
          { date: today, text: "Застосовано масову дію зі списку задач." },
          ...(source.history || [])
        ];
        changed.push({ task, source });
      });
      if (shouldUseApi(state)) {
        try {
          await Promise.all(changed.map(({ task, source }) => persistTask(task, source)));
        } catch (_error) {
          showToast?.("Не вдалося зберегти масову дію задач у базі.", "danger");
          return;
        }
      }
      const actionMessages = {
        done: "Обрані задачі позначено виконаними.",
        work: "Обрані задачі повернуто в роботу.",
        planner: "Обрані задачі додано в Планер."
      };
      state.selectedTaskKeys = [];
      renderAll();
      switchView("tasks");
      showToast?.(actionMessages[action] || "Масову дію виконано.");
    });
  });
  $("#task-create-from-section")?.addEventListener("click", () => openTaskDialog(state.selectedCaseId || state.cases[0]?.id, null, "tasks"));
  $("#task-sync-planner")?.addEventListener("click", () => {
    const result = syncPlannerQueue(tasks);
    renderAll();
    switchView("tasks");
    showToast(`Планер оновлено: ${result.planned} задач у плані.`);
  });
  document.querySelectorAll("[data-task-key]").forEach((row) => {
    row.addEventListener("click", () => {
      if (state.selectedTaskKey !== row.dataset.taskKey) state.taskDetailTab = "info";
      state.selectedTaskKey = row.dataset.taskKey;
      state.taskDetailOpen = true;
      renderTasks();
      scrollTaskDetailIntoView();
    });
  });
  document.querySelectorAll("[data-task-subtasks-menu]").forEach((details) => {
    details.addEventListener("click", (event) => event.stopPropagation());
    details.addEventListener("toggle", () => {
      if (!details.open) return;
      document.querySelectorAll("[data-task-subtasks-menu]").forEach((other) => {
        if (other !== details) other.open = false;
      });
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
  document.querySelectorAll("[data-edit-subtask-task]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const task = tasks.find((item) => item.key === button.dataset.editSubtaskTask);
      if (task) openSubtaskDialog(task.caseId, task.taskIndex, Number(button.dataset.subtaskIndex), "tasks");
    });
  });
  document.querySelectorAll("[data-new-subtask-task]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const task = tasks.find((item) => item.key === button.dataset.newSubtaskTask);
      if (task) openSubtaskDialog(task.caseId, task.taskIndex, null, "tasks");
    });
  });
  document.querySelectorAll("[data-delete-subtask-task]").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.stopPropagation();
      const task = tasks.find((item) => item.key === button.dataset.deleteSubtaskTask);
      const source = sourceTask(task);
      if (!source) return;
      source.subtasks = taskSubtasks(source, source.responsible);
      source.subtasks.splice(Number(button.dataset.subtaskIndex), 1);
      source.history = [
        { date: new Date().toLocaleDateString("uk-UA"), text: "Видалено підзадачу." },
        ...(source.history || [])
      ];
      if (shouldUseApi(state)) {
        try {
          await persistTask(task, source);
        } catch (_error) {
          showToast?.("Не вдалося видалити підзадачу з бази.", "danger");
          return;
        }
      }
      renderAll();
      switchView("tasks");
      showToast("Підзадачу видалено.");
    });
  });
  document.querySelectorAll("[data-toggle-subtask-task]").forEach((input) => {
    input.addEventListener("click", (event) => event.stopPropagation());
    input.addEventListener("change", async () => {
      const task = tasks.find((item) => item.key === input.dataset.toggleSubtaskTask);
      const source = sourceTask(task);
      if (!source) return;
      source.subtasks = taskSubtasks(source, source.responsible);
      const subtask = source.subtasks[Number(input.dataset.subtaskIndex)];
      if (!subtask) return;
      subtask.status = input.checked ? "Виконано" : "В роботі";
      source.history = [
        { date: new Date().toLocaleDateString("uk-UA"), text: `Оновлено статус підзадачі: ${subtask.title}.` },
        ...(source.history || [])
      ];
      if (shouldUseApi(state)) {
        try {
          await persistTask(task, source);
        } catch (_error) {
          showToast?.("Не вдалося зберегти підзадачу в базі.", "danger");
          return;
        }
      }
      renderAll();
      switchView("tasks");
      showToast(input.checked ? "Підзадачу виконано." : "Підзадачу повернуто в роботу.");
    });
  });
  document.querySelectorAll("[data-toggle-task-global]").forEach((input) => {
    input.addEventListener("click", (event) => event.stopPropagation());
    input.addEventListener("change", async () => {
      const task = tasks.find((item) => item.key === input.dataset.toggleTaskGlobal);
      const source = task && caseById(task.caseId)?.tasks[task.taskIndex];
      if (!source) return;
      source.status = input.checked ? "Виконано" : "В роботі";
      if (shouldUseApi(state)) {
        try {
          await persistTask(task, source);
        } catch (_error) {
          showToast?.("Не вдалося зберегти статус задачі в базі.", "danger");
          return;
        }
      }
      renderAll();
      switchView("tasks");
    });
  });
  document.querySelectorAll("[data-toggle-side-task]").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.stopPropagation();
      const task = tasks.find((item) => item.key === button.dataset.toggleSideTask);
      const source = sourceTask(task);
      if (!source) return;
      source.status = task.completed ? "В роботі" : "Виконано";
      if (shouldUseApi(state)) {
        try {
          await persistTask(task, source);
        } catch (_error) {
          showToast?.("Не вдалося зберегти статус задачі в базі.", "danger");
          return;
        }
      }
      renderAll();
      switchView("tasks");
    });
  });
  document.querySelectorAll("[data-plan-task]").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.stopPropagation();
      const task = tasks.find((item) => item.key === button.dataset.planTask);
      const source = sourceTask(task);
      if (!source) return;
      source.plannerManual = !task.plannerManual;
      if (source.plannerManual) source.plannerSuppressed = false;
      if (shouldUseApi(state)) {
        try {
          await persistTask(task, source);
        } catch (_error) {
          showToast?.("Не вдалося оновити Планер у базі.", "danger");
          return;
        }
      }
      renderAll();
      switchView("tasks");
      showToast(source.plannerManual ? "Задачу додано в Планер." : "Задачу прибрано з ручного плану.");
    });
  });
  document.querySelectorAll("[data-important-task]").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.stopPropagation();
      const task = tasks.find((item) => item.key === button.dataset.importantTask);
      const source = sourceTask(task);
      if (!source) return;
      source.plannerImportant = !task.plannerImportant;
      if (source.plannerImportant) source.plannerSuppressed = false;
      if (shouldUseApi(state)) {
        try {
          await persistTask(task, source);
        } catch (_error) {
          showToast?.("Не вдалося оновити важливість задачі в базі.", "danger");
          return;
        }
      }
      renderAll();
      switchView("tasks");
      showToast(source.plannerImportant ? "Задачу позначено важливою." : "Важливість задачі знято.");
    });
  });
  document.querySelectorAll("[data-task-status-pick]").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.stopPropagation();
      const task = tasks.find((item) => item.key === button.dataset.taskStatusPick);
      const source = task && caseById(task.caseId)?.tasks[task.taskIndex];
      if (!source) return;
      source.status = button.dataset.taskStatusValue;
      if (shouldUseApi(state)) {
        try {
          await persistTask(task, source);
        } catch (_error) {
          showToast?.("Не вдалося зберегти статус задачі в базі.", "danger");
          return;
        }
      }
      renderAll();
      switchView("tasks");
      showToast?.("Статус задачі оновлено.");
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
  bindActionMenus?.($("#tasks"));
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
