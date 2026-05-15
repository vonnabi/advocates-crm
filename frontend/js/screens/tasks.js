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
    openDeleteDocumentConfirm,
    renderAll,
    renderCases,
    switchView,
    bindViewLinks,
    syncNavigationState,
    showToast
  } = ctx);
}

function deriveTaskPriority(task = {}) {
  if (task.priority) return task.priority;
  if (["Терміново", "Срочно"].includes(task.status)) return "Високий";
  if (task.status === "Не срочно") return "Низький";
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
  const progress = task.completed ? 100 : task.status === "В роботі" ? 60 : task.status === "Очікує" ? 35 : 20;
  const dueIso = parseDisplayDate(task.dueText);
  const plannerDate = dueIso ? formatDate(dueIso) : "Не заплановано";
  const dueStatus = task.overdue ? "Просрочено" : "Завтра";
  const detailTab = state.taskDetailTab || "info";
  const plannerLabel = task.plannerIncluded
    ? `${task.plannerReason || "Заплановано"}<br>${plannerDate}`
    : "Не заплановано";
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
          <strong class="planner-connected"><span class="event-dot ${task.plannerIncluded ? "court" : ""}"></span>${plannerLabel}</strong>
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
  const plannedCount = tasks.filter((task) => task.plannerIncluded && !task.completed).length;
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
              <option value="Плановий" ${state.taskPriorityFilter === "Плановий" ? "selected" : ""}>Плановий</option>
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
          ${tasks.filter((task) => task.plannerIncluded && !task.completed).slice(0, 3).map((task) => `<div><time>${task.dueText}</time><strong>${task.title}</strong><span>№${task.caseId} · ${task.plannerReason || "Планер"}</span></div>`).join("")}
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
      const source = sourceTask(task);
      if (!source) return;
      source.status = task.completed ? "В роботі" : "Виконано";
      renderAll();
      switchView("tasks");
    });
  });
  document.querySelectorAll("[data-plan-task]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const task = tasks.find((item) => item.key === button.dataset.planTask);
      const source = sourceTask(task);
      if (!source) return;
      source.plannerManual = !task.plannerManual;
      if (source.plannerManual) source.plannerSuppressed = false;
      renderAll();
      switchView("tasks");
      showToast(source.plannerManual ? "Задачу додано в Планер." : "Задачу прибрано з ручного плану.");
    });
  });
  document.querySelectorAll("[data-important-task]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const task = tasks.find((item) => item.key === button.dataset.importantTask);
      const source = sourceTask(task);
      if (!source) return;
      source.plannerImportant = !task.plannerImportant;
      if (source.plannerImportant) source.plannerSuppressed = false;
      renderAll();
      switchView("tasks");
      showToast(source.plannerImportant ? "Задачу позначено важливою." : "Важливість задачі знято.");
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
