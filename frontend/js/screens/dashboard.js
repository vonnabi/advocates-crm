import {
  buildFinanceOperations,
  caseFinancials,
  clientName,
  dateFromAny,
  financeRowsFromCases,
  financeTotalsFromData,
  formatDisplayDate,
  osintSummaryFromData
} from "../derived-data.js";

const dashboardToday = dateFromAny("2024-05-15");
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
    key: `${item.id}-${index}`,
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

function trendText(value) {
  return value >= 0 ? `+${value}%` : `${value}%`;
}

function kpiCard({ label, value, hint, iconName, tone = "blue", trend = "" }, icon) {
  return `
    <article class="dashboard-kpi-card">
      <span>${label}</span>
      <strong>${value}</strong>
      ${trend ? `<em class="${trend.startsWith("-") ? "down" : ""}">${trend}</em>` : ""}
      <small>${hint}</small>
      <i class="${tone}">${icon(iconName)}</i>
    </article>
  `;
}

function progress(percent) {
  const value = Math.max(0, Math.min(100, Number(percent) || 0));
  return `<div class="dashboard-progress" style="--progress:${value}%"><span></span></div>`;
}

function eventRows(ctx, events) {
  const { clientById, badge } = ctx;
  return events.map((event) => {
    const client = clientById(event.clientId);
    return `
      <button class="dashboard-row dashboard-row-button" type="button" data-view-link="calendar">
        <i>${event.time || "10:00"}</i>
        <span>
          <strong>${event.title}</strong>
          <small>${formatDisplayDate(event.date)} · ${client?.name || "Клієнт не вказаний"} · №${event.caseId}</small>
        </span>
        ${badge(event.status)}
      </button>
    `;
  }).join("");
}

function taskRows(tasks, badge) {
  return tasks.map((task) => `
    <button class="dashboard-row dashboard-row-button" type="button" data-view-link="tasks">
      <i>${formatDisplayDate(task.due)}</i>
      <span>
        <strong>${task.title}</strong>
        <small>№${task.caseId} · ${task.client} · ${task.responsible || "Відповідального не вказано"}</small>
      </span>
      ${badge(task.status, taskUrgencyTone(task))}
    </button>
  `).join("");
}

function caseRows(state, cases, currency, badge) {
  return cases.map((item) => {
    const finance = caseFinancials(item);
    return `
      <button class="dashboard-row dashboard-row-button" type="button" data-view-link="cases">
        <i>№${item.id}</i>
        <span>
          <strong>${item.title}</strong>
          <small>${clientName(state, item)} · ${item.responsible} · дедлайн ${formatDisplayDate(item.deadline)}</small>
        </span>
        <b>${finance.debt ? currency(finance.debt) : "Без боргу"}</b>
        ${badge(item.priority)}
      </button>
    `;
  }).join("");
}

function quickButton(view, label, iconName, icon) {
  return `<button class="dashboard-quick-button" type="button" data-view-link="${view}">${icon(iconName)} ${label}</button>`;
}

export function renderDashboardScreen(ctx) {
  const { state, $, badge, currency, icon } = ctx;
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

  $("#dashboard").innerHTML = `
    <div class="dashboard-screen">
      <section class="dashboard-hero panel">
        <div>
          <span>Оперативний центр</span>
          <h2>Справи, задачі, календар і фінанси зведені в один робочий огляд.</h2>
          <p>Дані підтягуються з демо-справ, задач, подій, фінансів та OSINT, щоб дашборд показував реальний стан CRM.</p>
        </div>
        <div class="dashboard-actions">
          <button class="primary" type="button" data-view-link="planner">${icon("refresh")} Синхронізувати план</button>
          <button class="secondary" type="button" data-view-link="cases">${icon("briefcase")} Відкрити справи</button>
        </div>
      </section>

      <section class="dashboard-kpi-grid">
        ${[
          { label: "Активних справ", value: activeCases.length, hint: "у роботі бюро", iconName: "briefcase", tone: "blue", trend: trendText(12) },
          { label: "Задач у планері", value: plannedTasks.length, hint: "автоматично пов'язані з планом", iconName: "calendar", tone: "violet", trend: trendText(8) },
          { label: "Прострочені", value: overdueTasks.length, hint: "потребують контролю сьогодні", iconName: "bell", tone: "red", trend: overdueTasks.length ? "+100%" : "0%" },
          { label: "Борг клієнтів", value: currency(finance.debt), hint: "з усіх активних справ", iconName: "tag", tone: "amber", trend: finance.debt ? "+15%" : "0%" },
          { label: "Telegram", value: telegram, hint: "клієнтів підключено", iconName: "telegram", tone: "green", trend: trendText(10) },
          { label: "OSINT ризики", value: osint.risks, hint: "виявлено у відкритих джерелах", iconName: "search", tone: "red", trend: trendText(20) }
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
                <button class="dashboard-row dashboard-row-button" type="button" data-view-link="tasks">
                  <i>${formatDisplayDate(task.due)}</i>
                  <span>
                    <strong>${task.title}</strong>
                    <small>№${task.caseId} · ${task.client}</small>
                  </span>
                  ${badge(task.status, taskUrgencyTone(task))}
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
              ${taskRows(tasks.filter((task) => !isTaskDone(task)).sort((a, b) => (a.dueDate?.getTime() || 0) - (b.dueDate?.getTime() || 0)).slice(0, 6), badge)}
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
              ${caseRows(state, highRiskCases.length ? highRiskCases : deadlineCases, currency, badge)}
            </div>
          </article>
        </div>

        <aside class="dashboard-side">
          <article class="panel dashboard-card dashboard-finance-card">
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
          </article>

          <article class="panel dashboard-card">
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
                <span><strong>Нових згадок</strong><small>оновлено за демо-період</small></span>
              </div>
              <div class="dashboard-row">
                <i>${osint.risks}</i>
                <span><strong>Виявлено ризиків</strong><small>потрібна перевірка адвоката</small></span>
              </div>
            </div>
            <button class="secondary full" type="button" data-view-link="osint">Відкрити OSINT</button>
          </article>

          <article class="panel dashboard-card">
            <div class="dashboard-card-head">
              <div>
                <h2>Продуктивність</h2>
                <p>Стан виконання задач у демо-CRM</p>
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
              ${quickButton("analytics", "Аналітика", "briefcase", icon)}
            </div>
          </article>
        </aside>
      </section>
    </div>
  `;
}
