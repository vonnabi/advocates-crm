import {
  buildFinanceOperations,
  caseFinancials,
  clientName,
  dateFromAny,
  DEMO_END,
  financeRowsFromCases,
  financeTotalsFromData,
  formatDisplayDate,
  osintSummaryFromData
} from "../derived-data.js?v=live-demo-1";
import { escapeHtml } from "../ui.js";

const dashboardToday = dateFromAny(DEMO_END);
const closedStatuses = new Set(["Закрито", "Завершено", "Архів"]);
const doneTaskStatuses = new Set(["Готово", "Виконано", "Завершено"]);

function timeToMinutes(value = "00:00") {
  const [hours = 0, minutes = 0] = String(value).split(":").map(Number);
  return hours * 60 + minutes;
}

function dateTimeValue(date, time) {
  const parsed = dateFromAny(date);
  return (parsed?.getTime() || 0) + timeToMinutes(time) * 60000;
}

function isSameDay(left, right) {
  return Boolean(left && right && left.toDateString() === right.toDateString());
}

function allDashboardTasks(state) {
  return state.cases.flatMap((item) => (item.tasks || []).map((task, index) => ({
    ...task,
    key: `${item.id}:${index}`,
    caseId: item.id,
    caseTitle: item.title,
    client: clientName(state, item),
    casePriority: item.priority,
    caseStatus: item.status,
    dueDate: dateFromAny(task.due)
  })));
}

function isTaskDone(task) {
  return doneTaskStatuses.has(task.status);
}

function taskUrgencyTone(task) {
  if (!isTaskDone(task) && task.dueDate && task.dueDate < dashboardToday) return "red";
  if (["Срочно", "Терміново"].includes(task.status) || task.casePriority === "Високий") return "red";
  if (task.casePriority === "Середній" || task.status === "Очікує") return "amber";
  return "green";
}

function dashboardStatusIconName(label = "", tone = "", kind = "Статус") {
  const text = String(label).toLowerCase();
  if (kind === "Пріоритет") return "bell";
  if (text.includes("заплан")) return "calendar";
  if (text.includes("не термін") || text.includes("не срочно")) return "clock";
  if (text.includes("очіку")) return "clock";
  if (text.includes("робот") || text.includes("процес")) return "refresh";
  if (text.includes("готов") || text.includes("викон")) return "check";
  if (text.includes("термін") || text.includes("срочно") || tone === "red") return "bell";
  if (text.includes("простр")) return "warning";
  return "tag";
}

function dashboardIconTone(label = "", fallbackTone = "", kind = "Статус") {
  const text = String(label).toLowerCase();
  if (kind === "Пріоритет") {
    if (text.includes("висок")) return "red";
    if (text.includes("серед")) return "amber";
    if (text.includes("низьк")) return "green";
    if (text.includes("планов")) return "blue";
  }
  if (text.includes("не термін") || text.includes("не срочно")) return "green";
  if (text.includes("термін") || text.includes("срочно") || text.includes("простр")) return "red";
  if (text.includes("очіку") || text.includes("серед")) return "amber";
  if (text.includes("робот")) return "blue";
  if (text.includes("готов") || text.includes("викон") || text.includes("заплан")) return "green";
  if (fallbackTone) return fallbackTone;
  return "blue";
}

function dashboardStatusIcon(label, icon, tone = "", kind = "Статус") {
  const text = label || "Без статусу";
  const resolvedTone = dashboardIconTone(text, tone, kind);
  return `
    <span class="dashboard-status-icon ${resolvedTone}" data-tooltip="${text}" tabindex="0" role="img" aria-label="${kind}: ${text}">
      ${icon(dashboardStatusIconName(text, resolvedTone, kind))}
    </span>
    <span class="sr-only">${text}</span>
  `;
}

function kpiCard({ label, value, hint, iconName, tone = "blue", trend = "", view = "" }, icon) {
  const link = view ? ` data-view-link="${view}" aria-label="Відкрити розділ: ${label}"` : "";
  return `
    <button class="dashboard-kpi-card" type="button"${link}>
      <span>${label}</span>
      <strong>${value}</strong>
      ${trend ? `<em class="${trend.startsWith("-") ? "down" : ""}">${trend}</em>` : ""}
      <small>${hint}</small>
      <i class="${tone}">${icon(iconName)}</i>
    </button>
  `;
}

function progress(percent) {
  const value = Math.max(0, Math.min(100, Number(percent) || 0));
  return `<div class="dashboard-progress" style="--progress:${value}%"><span></span></div>`;
}

function eventRows(ctx, events) {
  const { clientById, icon } = ctx;
  return events.map((event) => {
    const client = clientById(event.clientId);
    return `
      <button class="dashboard-row dashboard-row-button" type="button" data-dashboard-event="event-${event.id}">
        <i>${event.time || "10:00"}</i>
        <span>
          <strong>${escapeHtml(event.title)}</strong>
          <small>${formatDisplayDate(event.date)} · ${escapeHtml(client?.name || "Клієнт не вказаний")} · №${event.caseId}</small>
        </span>
        ${dashboardStatusIcon(event.status, icon)}
      </button>
    `;
  }).join("");
}

function taskRows(tasks, icon) {
  return tasks.map((task) => `
    <button class="dashboard-row dashboard-row-button" type="button" data-dashboard-task="${task.key}">
      <i>${formatDisplayDate(task.due)}</i>
      <span>
        <strong>${escapeHtml(task.title)}</strong>
        <small>№${task.caseId} · ${escapeHtml(task.client)} · ${escapeHtml(task.responsible || "Відповідального не вказано")}</small>
      </span>
      ${dashboardStatusIcon(task.status, icon, taskUrgencyTone(task))}
    </button>
  `).join("");
}

function caseRows(state, cases, currency, icon) {
  return cases.map((item) => {
    const finance = caseFinancials(item);
    return `
      <button class="dashboard-row dashboard-row-button" type="button" data-dashboard-case="${item.id}">
        <i>№${item.id}</i>
        <span>
          <strong>${escapeHtml(item.title)}</strong>
          <small>${escapeHtml(clientName(state, item))} · ${escapeHtml(item.responsible)} · дедлайн ${escapeHtml(item.deadline || "Без строку")}</small>
        </span>
        <b>${finance.debt ? currency(finance.debt) : "Без боргу"}</b>
        ${dashboardStatusIcon(item.priority, icon, "", "Пріоритет")}
      </button>
    `;
  }).join("");
}

function quickButton(view, label, iconName, icon) {
  return `<button class="dashboard-quick-button" type="button" data-view-link="${view}">${icon(iconName)} ${label}</button>`;
}

function resetTaskFilters(state) {
  state.taskQuery = "";
  state.taskTab = "all";
  state.taskQuickFilter = "all";
  state.taskStatusFilter = "all";
  state.taskPriorityFilter = "all";
  state.taskCaseFilter = "all";
  state.taskResponsibleFilter = "all";
  state.selectedTaskKeys = [];
}

function resetCalendarFilters(state) {
  state.calendarQuery = "";
  state.calendarFilter = "all";
  state.calendarClientFilter = "all";
  state.calendarCaseFilter = "all";
  state.calendarResponsibleFilter = "all";
  state.calendarStatusFilter = "all";
  state.calendarAuthorityFilter = "";
  state.calendarOverdueOnly = false;
}

function bindDashboardDeepLinks(ctx) {
  const { state, renderCalendar, renderCases, renderTasks, switchView } = ctx;

  document.querySelectorAll("[data-dashboard-event]").forEach((button) => {
    button.addEventListener("click", () => {
      const eventId = button.dataset.dashboardEvent;
      const rawEvent = state.events.find((event) => `event-${event.id}` === eventId);
      resetCalendarFilters(state);
      state.selectedEventId = eventId;
      state.calendarDate = rawEvent?.date || state.calendarDate;
      state.calendarMode = "list";
      renderCalendar?.();
      switchView?.("calendar");
    });
  });

  document.querySelectorAll("[data-dashboard-task]").forEach((button) => {
    button.addEventListener("click", () => {
      resetTaskFilters(state);
      state.selectedTaskKey = button.dataset.dashboardTask;
      state.taskDetailOpen = true;
      state.taskDetailTab = "info";
      renderTasks?.();
      switchView?.("tasks");
    });
  });

  document.querySelectorAll("[data-dashboard-case]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedCaseId = button.dataset.dashboardCase;
      state.caseScreen = "detail";
      state.selectedCaseKeys = [];
      renderCases?.();
      switchView?.("cases");
    });
  });

  document.querySelector("[data-dismiss-hero]")?.addEventListener("click", () => {
    try { localStorage.setItem("crmDashboardHeroDismissed", "1"); } catch (_e) { /* ignore */ }
    renderDashboardScreen(ctx);
  });
}

export function renderDashboardScreen(ctx) {
  const { state, $, currency, icon } = ctx;
  const tasks = allDashboardTasks(state);
  const activeCases = state.cases.filter((item) => !closedStatuses.has(item.status));
  const overdueTasks = tasks.filter((task) => !isTaskDone(task) && task.dueDate && task.dueDate < dashboardToday);
  const todayTasks = tasks.filter((task) => task.dueDate && isSameDay(task.dueDate, dashboardToday));
  const plannedTasks = tasks.filter((task) => task.showInCalendar);
  const completedTasks = tasks.filter(isTaskDone);
  const productivity = tasks.length ? Math.round((completedTasks.length / tasks.length) * 100) : 0;
  const tomorrowEvents = [...state.events]
    .filter((event) => dateTimeValue(event.date, event.time) >= dashboardToday.getTime())
    .sort((a, b) => dateTimeValue(a.date, a.time) - dateTimeValue(b.date, b.time))
    .slice(0, 5);
  const deadlineCases = [...activeCases]
    .sort((a, b) => (dateFromAny(a.deadline)?.getTime() || 0) - (dateFromAny(b.deadline)?.getTime() || 0))
    .slice(0, 5);
  const highRiskCases = [...activeCases]
    .filter((item) => item.priority === "Високий" || Number(item.debt || 0) > 0)
    .sort((a, b) => Number(b.debt || 0) - Number(a.debt || 0))
    .slice(0, 4);
  const financeRows = financeRowsFromCases(state);
  const financeOperations = buildFinanceOperations(state);
  const finance = financeTotalsFromData(financeRows, financeOperations);
  const osint = osintSummaryFromData(state);
  const telegram = state.clients.filter((client) => client.telegram).length;
  // Ховаємо панелі, на які роль не має прав (сервер усе одно віддає 403).
  const perms = state.sessionPermissions || {};
  const canSeeFinance = perms.canSeeFinance !== false;
  const canUseOsint = perms.canUseOsint !== false;
  let heroDismissed = false;
  try { heroDismissed = localStorage.getItem("crmDashboardHeroDismissed") === "1"; } catch (_e) { heroDismissed = false; }

  $("#dashboard").innerHTML = `
    <div class="dashboard-screen">
      ${heroDismissed ? "" : `
      <section class="dashboard-hero panel">
        <div>
          <span>Оперативний центр</span>
          <h2>Справи, задачі, календар і фінанси зведені в один робочий огляд.</h2>
          <p>Дані підтягуються зі справ, задач, подій, фінансів та OSINT, щоб дашборд показував реальний стан CRM.</p>
        </div>
        <div class="dashboard-actions">
          <button class="primary" type="button" data-view-link="planner">${icon("refresh")} Синхронізувати план</button>
          <button class="secondary" type="button" data-view-link="cases">${icon("briefcase")} Відкрити справи</button>
        </div>
        <button class="dashboard-hero-close" type="button" data-dismiss-hero aria-label="Сховати підказку" title="Сховати підказку">×</button>
      </section>`}

      <section class="dashboard-kpi-grid">
        ${[
          { label: "Активних справ", value: activeCases.length, hint: "у роботі бюро", iconName: "briefcase", tone: "blue", view: "cases" },
          { label: "Задач у планері", value: plannedTasks.length, hint: "автоматично пов'язані з планом", iconName: "calendar", tone: "violet", view: "planner" },
          { label: "Прострочені", value: overdueTasks.length, hint: "потребують контролю сьогодні", iconName: "bell", tone: "red", view: "tasks" },
          { label: "Борг клієнтів", value: currency(finance.debt), hint: "з усіх активних справ", iconName: "tag", tone: "amber", view: "finance" },
          { label: "Telegram", value: telegram, hint: "клієнтів підключено", iconName: "telegram", tone: "green", view: "clients" },
          { label: "OSINT ризики", value: osint.risks, hint: "виявлено у відкритих джерелах", iconName: "search", tone: "red", view: "osint" }
        ].map((item) => kpiCard(item, icon)).join("")}
      </section>

      <section class="dashboard-layout">
        <div class="dashboard-main">
          <article class="panel dashboard-card">
            <div class="dashboard-card-head">
              <div>
                <h2>Найближчі події</h2>
                <p>Календар і судові події на найближчі дні</p>
              </div>
              <button class="secondary" type="button" data-view-link="calendar">Відкрити календар</button>
            </div>
            <div class="dashboard-list">
              ${tomorrowEvents.length ? eventRows(ctx, tomorrowEvents) : `<p class="dashboard-empty">Немає запланованих подій.</p>`}
            </div>
          </article>

          <article class="panel dashboard-card">
            <div class="dashboard-card-head">
              <div>
                <h2>Задачі під контролем</h2>
                <p>Сьогодні, дедлайни та прострочені задачі</p>
              </div>
              <button class="secondary" type="button" data-view-link="tasks">Відкрити задачі</button>
            </div>
            <div class="dashboard-list dashboard-list-compact">
              ${(todayTasks.length ? todayTasks : overdueTasks).slice(0, 5).map((task) => `
                <button class="dashboard-row dashboard-row-button" type="button" data-dashboard-task="${task.key}">
                  <i>${formatDisplayDate(task.due)}</i>
                  <span>
                    <strong>${escapeHtml(task.title)}</strong>
                    <small>№${task.caseId} · ${escapeHtml(task.client)}</small>
                  </span>
                  ${dashboardStatusIcon(task.status, icon, taskUrgencyTone(task))}
                </button>
              `).join("") || `<p class="dashboard-empty">Критичних задач на сьогодні немає.</p>`}
            </div>
          </article>

          <article class="panel dashboard-card dashboard-deadlines">
            <div class="dashboard-card-head">
              <div>
                <h2>Найближчі дедлайни по справах</h2>
                <p>Підтягується зі справ, задач і календаря</p>
              </div>
              <button class="secondary" type="button" data-view-link="planner">Відкрити планер</button>
            </div>
            <div class="dashboard-list">
              ${taskRows(tasks.filter((task) => !isTaskDone(task)).sort((a, b) => (a.dueDate?.getTime() || 0) - (b.dueDate?.getTime() || 0)).slice(0, 6), icon) || `<p class="dashboard-empty">Найближчих дедлайнів ще немає.</p>`}
            </div>
          </article>

          <article class="panel dashboard-card">
            <div class="dashboard-card-head">
              <div>
                <h2>Справи з ризиками</h2>
                <p>Високий пріоритет, борги та найближчі дедлайни</p>
              </div>
              <button class="secondary" type="button" data-view-link="cases">Переглянути всі</button>
            </div>
            <div class="dashboard-list">
              ${caseRows(state, highRiskCases.length ? highRiskCases : deadlineCases, currency, icon) || `<p class="dashboard-empty">Ризикових справ поки немає.</p>`}
            </div>
          </article>
        </div>

        <aside class="dashboard-side">
          ${canSeeFinance ? `<article class="panel dashboard-card dashboard-finance-card">
            <div class="dashboard-card-head">
              <div>
                <h2>Фінансовий зріз</h2>
                <p>Оплати, борги та очікувані надходження</p>
              </div>
            </div>
            <div class="dashboard-mini-grid">
              <div><span>Надходження</span><strong>${currency(finance.income)}</strong></div>
              <div><span>Витрати</span><strong>${currency(finance.expenses)}</strong></div>
              <div><span>Чистий прибуток</span><strong>${currency(finance.profit)}</strong></div>
              <div class="danger"><span>Борг</span><strong>${currency(finance.debt)}</strong></div>
            </div>
            ${progress(finance.income ? Math.round((finance.profit / finance.income) * 100) : 0)}
            <button class="primary full" type="button" data-view-link="finance">Перейти до фінансів</button>
          </article>` : ""}

          ${canUseOsint ? `<article class="panel dashboard-card">
            <div class="dashboard-card-head">
              <div>
                <h2>OSINT моніторинг</h2>
                <p>Ризики і згадки за активними справами</p>
              </div>
            </div>
            <div class="dashboard-list dashboard-list-compact">
              <div class="dashboard-row">
                <i>${osint.sources}</i>
                <span><strong>Джерел у роботі</strong><small>YouControl, Opendatabot, судові рішення, соцмережі</small></span>
              </div>
              <div class="dashboard-row">
                <i>${osint.mentions}</i>
                <span><strong>Нових згадок</strong><small>оновлено за обраний період</small></span>
              </div>
              <div class="dashboard-row">
                <i>${osint.risks}</i>
                <span><strong>Виявлено ризиків</strong><small>потрібна перевірка адвоката</small></span>
              </div>
            </div>
            <button class="secondary full" type="button" data-view-link="osint">Відкрити OSINT</button>
          </article>` : ""}

          <article class="panel dashboard-card">
            <div class="dashboard-card-head">
              <div>
                <h2>Продуктивність</h2>
                <p>Стан виконання задач у CRM</p>
              </div>
              <strong class="dashboard-percent">${productivity}%</strong>
            </div>
            ${progress(productivity)}
            <div class="dashboard-mini-grid dashboard-mini-grid-three">
              <div><span>Всього</span><strong>${tasks.length}</strong></div>
              <div><span>Виконано</span><strong>${completedTasks.length}</strong></div>
              <div class="danger"><span>Простр.</span><strong>${overdueTasks.length}</strong></div>
            </div>
          </article>

          <article class="panel dashboard-card">
            <div class="dashboard-card-head">
              <div>
                <h2>Швидкі дії</h2>
                <p>Переходи у ключові розділи</p>
              </div>
            </div>
            <div class="dashboard-quick-grid">
              ${quickButton("tasks", "Додати задачу", "check", icon)}
              ${quickButton("calendar", "Подія календаря", "calendar", icon)}
              ${quickButton("documents", "Документи", "file", icon)}
              ${quickButton("analytics", "Аналітика", "chart", icon)}
            </div>
          </article>
        </aside>
      </section>
    </div>
  `;
  bindDashboardDeepLinks(ctx);
}
