const STATUS_ROWS = [
  ["В роботі", 96, 45, "#1f7ae0"],
  ["Підготовка", 28, 13, "#27ae6f"],
  ["Судовий розгляд", 38, 18, "#f59e0b"],
  ["Очікування рішення", 22, 10, "#7c5ce8"],
  ["Завершені", 18, 8, "#9aa7b7"],
  ["Інші", 6, 6, "#c8d1dc"]
];

const TYPE_ROWS = [
  ["Цивільні справи", 42, "#1f7ae0"],
  ["Кримінальні справи", 28, "#27ae6f"],
  ["Адміністративні справи", 20, "#f59e0b"],
  ["Господарські справи", 15, "#7c5ce8"],
  ["Сімейні справи", 10, "#1f7ae0"],
  ["Трудові спори", 7, "#9aa7b7"],
  ["Інші", 6, "#64748b"]
];

const PRACTICE_ROWS = [
  ["Сімейне право", 32, "#1f7ae0"],
  ["Цивільне право", 28, "#27ae6f"],
  ["Кримінальне право", 22, "#f59e0b"],
  ["Військове право", 18, "#7c5ce8"],
  ["Адміністративне право", 12, "#1f7ae0"],
  ["Трудове право", 8, "#9aa7b7"],
  ["Інші", 8, "#64748b"]
];

const LAWYERS = [
  ["Іваненко А.Ю.", 80],
  ["Петренко М.С.", 75],
  ["Коваленко О.В.", 72],
  ["Шевченко І.А.", 65],
  ["Бондаренко Д.В.", 58]
];

const LINE_SERIES = {
  newCases: [20, 21, 25, 21, 19, 22, 29, 24, 26, 21, 27, 31, 32, 24, 28],
  closedCases: [14, 11, 10, 14, 12, 15, 17, 16, 17, 14, 17, 17, 17, 15, 18],
  inWork: [40, 42, 52, 47, 49, 50, 66, 58, 57, 50, 59, 63, 62, 56, 66]
};

const dates = Array.from({ length: 15 }, (_, index) => `${String(index + 1).padStart(2, "0")}.05`);
const defaultStart = "2024-05-01";
const defaultEnd = "2024-05-15";
function linePoints(values, max = 80, width = 560, height = 190) {
  const step = width / (values.length - 1);
  return values.map((value, index) => `${Math.round(index * step)},${Math.round(height - (value / max) * height)}`).join(" ");
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

function formatIsoDate(iso) {
  const [year, month, day] = String(iso || defaultStart).split("-");
  return `${day}.${month}.${year}`;
}

function inRange(dateValue, startIso, endIso) {
  const date = dateFromAny(dateValue);
  const start = dateFromAny(startIso);
  const end = dateFromAny(endIso);
  if (!date || !start || !end) return true;
  return date >= start && date <= end;
}

function updateRangeFromPeriod(state) {
  if (state.analyticsPeriod === "month" || state.analyticsPeriod === "custom") {
    state.analyticsDateStart = state.analyticsDateStart || defaultStart;
    state.analyticsDateEnd = state.analyticsDateEnd || defaultEnd;
    return;
  }
  if (state.analyticsPeriod === "30") {
    state.analyticsDateStart = "2024-04-16";
    state.analyticsDateEnd = defaultEnd;
    return;
  }
  if (state.analyticsPeriod === "year") {
    state.analyticsDateStart = "2024-01-01";
    state.analyticsDateEnd = "2024-12-31";
  }
}

function filterCases(state) {
  const start = state.analyticsDateStart || defaultStart;
  const end = state.analyticsDateEnd || defaultEnd;
  return state.cases.filter((item) => {
    const matchesCase = state.analyticsCaseFilter === "all" || item.id === state.analyticsCaseFilter;
    const matchesResponsible = state.analyticsResponsible === "all" || item.responsible === state.analyticsResponsible;
    const matchesType = state.analyticsTypeFilter === "all" || item.type === state.analyticsTypeFilter;
    const matchesPriority = state.analyticsPriorityFilter === "all" || item.priority === state.analyticsPriorityFilter;
    const matchesDate = inRange(item.opened, start, end);
    const status = state.analyticsStatus || "all";
    const matchesStatus = status === "all"
      || (status === "active" && item.status !== "Завершено")
      || (status === "urgent" && (item.priority === "Високий" || item.status === "Терміново"))
      || (status === "debt" && item.debt > 0);
    return matchesCase && matchesResponsible && matchesType && matchesPriority && matchesDate && matchesStatus;
  });
}

function scaledValue(value, ratio) {
  return ratio > 0 ? Math.max(1, Math.round(value * ratio)) : 0;
}

function scaleRows(rows, ratio) {
  const scaled = rows.map(([label, value, percentOrColor, maybeColor]) => {
    const amount = scaledValue(value, ratio);
    const color = maybeColor || percentOrColor;
    return [label, amount, color];
  });
  const total = scaled.reduce((sum, row) => sum + row[1], 0);
  return scaled.map(([label, value, color]) => [label, value, total ? Math.round((value / total) * 100) : 0, color]);
}

function scaleBarRows(rows, ratio) {
  return rows.map(([label, value, color]) => [label, scaledValue(value, ratio), color]);
}

function scaledLine(values, ratio) {
  return values.map((value) => scaledValue(value, ratio));
}

function analyticsStats(state, cases) {
  const ratio = state.cases.length ? cases.length / state.cases.length : 0;
  const paid = cases.reduce((sum, item) => sum + (item.income || 0), 0);
  const debt = cases.reduce((sum, item) => sum + (item.debt || 0), 0);
  const active = cases.filter((item) => item.status !== "Завершено").length;
  const high = cases.filter((item) => item.priority === "Високий").length;
  return {
    ratio,
    totalCases: scaledValue(128, ratio),
    newCases: scaledValue(31, ratio),
    finishedCases: scaledValue(18, ratio),
    inWork: scaledValue(96, ratio),
    avgDays: cases.length ? 45 : 0,
    success: cases.length ? Math.max(48, 72 - Math.max(0, 2 - active) * 4 + high) : 0,
    paid,
    debt,
    profit: Math.max(0, paid - debt)
  };
}

function exportAnalytics(ctx, stats) {
  const csv = [
    "Показник,Значення",
    `Всього справ,${stats.totalCases}`,
    `Нові справи,${stats.newCases}`,
    `Завершені справи,${stats.finishedCases}`,
    `В роботі,${stats.inWork}`,
    `Середній час ведення справи,${stats.avgDays} днів`,
    `Успішні справи,${stats.success}%`
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "analytics-report.csv";
  link.click();
  URL.revokeObjectURL(link.href);
  ctx.showToast("Звіт аналітики сформовано.");
}

function kpiCard({ title, value, trend, iconName, tone }, icon) {
  return `
    <article class="analytics-kpi-card">
      <span>${title}</span>
      <strong>${value}</strong>
      <em class="${trend.startsWith("-") ? "down" : ""}">${trend}</em>
      <small>порівняно з попер. періодом</small>
      <i class="${tone}">${icon(iconName)}</i>
    </article>
  `;
}

function horizontalRows(rows, max = Math.max(1, ...rows.map((row) => row[1]))) {
  return rows.map(([label, value, color]) => `
    <div class="analytics-hbar">
      <span>${label}</span>
      <em><i style="width:${Math.round((value / max) * 100)}%; background:${color}"></i></em>
      <strong>${value}</strong>
    </div>
  `).join("");
}

function renderDonutLegend(rows) {
  return rows.map(([label, value, percent, color]) => `
    <div class="analytics-donut-legend">
      <span style="--legend-color:${color}">${label}</span>
      <strong>${value} (${percent}%)</strong>
    </div>
  `).join("");
}

export function renderAnalyticsScreen(ctx) {
  const { state, $, icon, advocatePhoto, showToast } = ctx;
  state.analyticsTab = state.analyticsTab || "overview";
  state.analyticsCaseFilter = state.analyticsCaseFilter || "all";
  state.analyticsTypeFilter = state.analyticsTypeFilter || "all";
  state.analyticsPriorityFilter = state.analyticsPriorityFilter || "all";
  state.analyticsDateStart = state.analyticsDateStart || defaultStart;
  state.analyticsDateEnd = state.analyticsDateEnd || defaultEnd;
  state.analyticsDatePickerOpen = Boolean(state.analyticsDatePickerOpen);
  const filteredCases = filterCases(state);
  const stats = analyticsStats(state, filteredCases);
  const statusRows = scaleRows(STATUS_ROWS, stats.ratio);
  const typeRows = scaleBarRows(TYPE_ROWS, stats.ratio);
  const practiceRows = scaleBarRows(PRACTICE_ROWS, stats.ratio);
  const lines = {
    newCases: scaledLine(LINE_SERIES.newCases, stats.ratio),
    closedCases: scaledLine(LINE_SERIES.closedCases, stats.ratio),
    inWork: scaledLine(LINE_SERIES.inWork, stats.ratio)
  };
  const currency = (value) => `${new Intl.NumberFormat("uk-UA").format(value)} грн`;
  const caseTypes = [...new Set(state.cases.map((item) => item.type).filter(Boolean))];
  const responsibles = [...new Set(state.cases.map((item) => item.responsible).filter(Boolean))];
  const activeTabLabel = {
    overview: "Загальна аналітика",
    cases: "Справи",
    finance: "Фінанси",
    clients: "Клієнти",
    efficiency: "Ефективність",
    reports: "Детальні звіти"
  }[state.analyticsTab];

  $("#analytics").innerHTML = `
    <div class="analytics-screen analytics-reference">
      <div class="analytics-top-row">
        <div></div>
        <div class="analytics-date-wrap">
          <button class="analytics-date-range" type="button" data-analytics-date-toggle aria-expanded="${state.analyticsDatePickerOpen}">
            <span>${formatIsoDate(state.analyticsDateStart)} - ${formatIsoDate(state.analyticsDateEnd)}</span>
            ${icon("calendar")}
          </button>
          ${state.analyticsDatePickerOpen ? `
            <div class="analytics-date-popover">
              <label>Початок
                <input type="date" data-analytics-date-start value="${state.analyticsDateStart}">
              </label>
              <label>Кінець
                <input type="date" data-analytics-date-end value="${state.analyticsDateEnd}">
              </label>
              <div>
                <button class="secondary" type="button" data-analytics-date-preset>1-15 травня</button>
                <button class="primary" type="button" data-analytics-date-apply>Застосувати</button>
              </div>
            </div>
          ` : ""}
        </div>
        <button class="secondary" type="button" data-export-analytics>${icon("file")} Експорт звіту</button>
      </div>

      <section class="panel analytics-filter-card">
        <label>Період
          <select data-analytics-period>
            <option value="custom" ${state.analyticsPeriod === "custom" ? "selected" : ""}>Користувацький період</option>
            <option value="month" ${state.analyticsPeriod === "month" ? "selected" : ""}>Поточний місяць</option>
            <option value="30" ${state.analyticsPeriod === "30" ? "selected" : ""}>Останні 30 днів</option>
            <option value="year" ${state.analyticsPeriod === "year" ? "selected" : ""}>Рік</option>
          </select>
        </label>
        <label>За справами
          <select data-analytics-case>
            <option value="all">Всі справи</option>
            ${state.cases.map((item) => `<option value="${item.id}" ${state.analyticsCaseFilter === item.id ? "selected" : ""}>№${item.id}</option>`).join("")}
          </select>
        </label>
        <label>За адвокатом
          <select data-analytics-responsible>
            <option value="all">Всі адвокати</option>
            ${responsibles.map((name) => `<option value="${name}" ${state.analyticsResponsible === name ? "selected" : ""}>${name}</option>`).join("")}
          </select>
        </label>
        <label>За статусом справи
          <select data-analytics-status>
            <option value="all">Всі статуси</option>
            <option value="active" ${state.analyticsStatus === "active" ? "selected" : ""}>Активні</option>
            <option value="urgent" ${state.analyticsStatus === "urgent" ? "selected" : ""}>Високий пріоритет</option>
            <option value="debt" ${state.analyticsStatus === "debt" ? "selected" : ""}>Є борг</option>
          </select>
        </label>
        <label>За типом справи
          <select data-analytics-type>
            <option value="all">Всі типи</option>
            ${caseTypes.map((type) => `<option value="${type}" ${state.analyticsTypeFilter === type ? "selected" : ""}>${type}</option>`).join("")}
          </select>
        </label>
        <label>За пріоритетом
          <select data-analytics-priority>
            <option value="all">Всі пріоритети</option>
            <option value="Високий" ${state.analyticsPriorityFilter === "Високий" ? "selected" : ""}>Високий</option>
            <option value="Середній" ${state.analyticsPriorityFilter === "Середній" ? "selected" : ""}>Середній</option>
            <option value="Низький" ${state.analyticsPriorityFilter === "Низький" ? "selected" : ""}>Низький</option>
          </select>
        </label>
        <button class="primary" type="button" data-apply-analytics>Застосувати фільтри</button>
        <button class="secondary" type="button" data-reset-analytics>Скинути</button>
      </section>

      <nav class="analytics-tabs" aria-label="Розділи аналітики">
        ${[
          ["overview", "Загальна аналітика"],
          ["cases", "Справи"],
          ["finance", "Фінанси"],
          ["clients", "Клієнти"],
          ["efficiency", "Ефективність"],
          ["reports", "Детальні звіти"]
        ].map(([tab, label]) => `<button class="${state.analyticsTab === tab ? "active" : ""}" type="button" data-analytics-tab="${tab}">${label}</button>`).join("")}
      </nav>

      <section class="analytics-kpi-grid">
        ${[
          { title: "Всього справ", value: stats.totalCases, trend: "+12%", iconName: "briefcase", tone: "blue" },
          { title: "Нові справи", value: stats.newCases, trend: "+6%", iconName: "calendar", tone: "green" },
          { title: "Завершені справи", value: stats.finishedCases, trend: "+20%", iconName: "check", tone: "violet" },
          { title: "В роботі", value: stats.inWork, trend: "+8%", iconName: "search", tone: "amber" },
          { title: "Середній час ведення справи", value: `${stats.avgDays} днів`, trend: "-5%", iconName: "clock", tone: "gray" },
          { title: "% успішних справ", value: `${stats.success}%`, trend: "+7%", iconName: "check", tone: "green" }
        ].map((item) => kpiCard(item, icon)).join("")}
      </section>

      <section class="analytics-dashboard-grid">
        <article class="panel analytics-chart-card analytics-line-card">
          <div class="analytics-card-head">
            <h2>Динаміка справ</h2>
            <select><option>По днях</option><option>По тижнях</option></select>
          </div>
          <div class="analytics-legend">
            <span class="blue">Нові справи</span>
            <span class="green">Завершені справи</span>
            <span class="amber">В роботі</span>
          </div>
          <svg class="analytics-line-chart" viewBox="0 0 620 250" role="img" aria-label="Динаміка справ по днях">
            <g class="grid-lines">
              ${[0, 1, 2, 3, 4].map((line) => `<line x1="40" y1="${25 + line * 45}" x2="600" y2="${25 + line * 45}"></line>`).join("")}
            </g>
            ${[0, 20, 40, 60, 80].map((value, index) => `<text x="12" y="${212 - index * 45}">${value}</text>`).join("")}
            <polyline class="line blue-line" points="${linePoints(lines.newCases)}" transform="translate(40 25)"></polyline>
            <polyline class="line green-line" points="${linePoints(lines.closedCases)}" transform="translate(40 25)"></polyline>
            <polyline class="line amber-line" points="${linePoints(lines.inWork)}" transform="translate(40 25)"></polyline>
            ${dates.filter((_, index) => index % 2 === 0).map((date, index) => `<text class="axis" x="${42 + index * 80}" y="238">${date}</text>`).join("")}
          </svg>
        </article>

        <article class="panel analytics-chart-card">
          <h2>Справи за статусами</h2>
          <div class="analytics-donut-wrap">
            <div class="analytics-status-donut"></div>
            <div>${renderDonutLegend(statusRows)}</div>
          </div>
        </article>

        <article class="panel analytics-chart-card">
          <div class="analytics-card-head">
            <h2>Справи за типами</h2>
            <select><option>За кількістю</option><option>За сумою</option></select>
          </div>
          <div class="analytics-hbar-list">${horizontalRows(typeRows)}</div>
        </article>

        <article class="panel analytics-chart-card">
          <div class="analytics-card-head">
            <h2>Ефективність адвокатів</h2>
            <select><option>За успішними справами</option><option>За навантаженням</option></select>
          </div>
          <div class="analytics-lawyer-list">
            ${LAWYERS.map(([name, percent], index) => `
              <div class="analytics-lawyer-row">
                <span>${index + 1}</span>
                ${advocatePhoto(name, "small")}
                <strong>${name}</strong>
                <em><i style="width:${percent}%"></i></em>
                <b>${percent}%</b>
              </div>
            `).join("")}
          </div>
          <button class="secondary analytics-view-all" type="button" data-analytics-details>Переглянути всіх</button>
        </article>

        <article class="panel analytics-chart-card analytics-finance-card">
          <div class="analytics-card-head">
            <h2>Фінансові показники</h2>
            <select><option>За період</option><option>За місяць</option></select>
          </div>
          <div class="analytics-finance-summary">
            <div><span>Дохід</span><strong>${currency(stats.paid)}</strong><em>+15%</em></div>
            <div><span>Витрати</span><strong>${currency(stats.debt)}</strong><em class="danger">+7%</em></div>
            <div><span>Чистий прибуток</span><strong>${currency(stats.profit)}</strong><em>+18%</em></div>
          </div>
          <div class="analytics-column-chart">
            ${[
              ["01-05.05", 82, 32, 58],
              ["06-10.05", 88, 34, 64],
              ["11-15.05", 95, 42, 68]
            ].map(([label, income, expense, profit]) => `
              <div class="analytics-column-group">
                <span style="height:${income}%"></span>
                <span class="red" style="height:${expense}%"></span>
                <span class="green" style="height:${profit}%"></span>
                <em>${label}</em>
              </div>
            `).join("")}
          </div>
        </article>

        <article class="panel analytics-chart-card">
          <div class="analytics-card-head">
            <h2>Топ практик <small>(${activeTabLabel.toLowerCase()})</small></h2>
            <select><option>За кількістю</option><option>За доходом</option></select>
          </div>
          <div class="analytics-hbar-list">${horizontalRows(practiceRows)}</div>
        </article>
      </section>
    </div>
  `;

  const rerender = () => renderAnalyticsScreen(ctx);
  document.querySelector("[data-analytics-period]")?.addEventListener("change", (event) => {
    state.analyticsPeriod = event.currentTarget.value;
  });
  document.querySelector("[data-analytics-case]")?.addEventListener("change", (event) => {
    state.analyticsCaseFilter = event.currentTarget.value;
  });
  document.querySelector("[data-analytics-responsible]")?.addEventListener("change", (event) => {
    state.analyticsResponsible = event.currentTarget.value;
  });
  document.querySelector("[data-analytics-status]")?.addEventListener("change", (event) => {
    state.analyticsStatus = event.currentTarget.value;
  });
  document.querySelector("[data-analytics-type]")?.addEventListener("change", (event) => {
    state.analyticsTypeFilter = event.currentTarget.value;
  });
  document.querySelector("[data-analytics-priority]")?.addEventListener("change", (event) => {
    state.analyticsPriorityFilter = event.currentTarget.value;
  });
  document.querySelector("[data-apply-analytics]")?.addEventListener("click", () => {
    updateRangeFromPeriod(state);
    state.analyticsDatePickerOpen = false;
    showToast("Фільтри аналітики застосовано.");
    rerender();
  });
  document.querySelector("[data-reset-analytics]")?.addEventListener("click", () => {
    state.analyticsPeriod = "custom";
    state.analyticsCaseFilter = "all";
    state.analyticsResponsible = "all";
    state.analyticsStatus = "all";
    state.analyticsTypeFilter = "all";
    state.analyticsPriorityFilter = "all";
    state.analyticsDateStart = defaultStart;
    state.analyticsDateEnd = defaultEnd;
    state.analyticsDatePickerOpen = false;
    showToast("Фільтри аналітики скинуто.", "warning");
    rerender();
  });
  document.querySelector("[data-analytics-date-toggle]")?.addEventListener("click", () => {
    state.analyticsDatePickerOpen = !state.analyticsDatePickerOpen;
    rerender();
  });
  document.querySelector("[data-analytics-date-start]")?.addEventListener("change", (event) => {
    state.analyticsDateStart = event.currentTarget.value || defaultStart;
    state.analyticsPeriod = "custom";
  });
  document.querySelector("[data-analytics-date-end]")?.addEventListener("change", (event) => {
    state.analyticsDateEnd = event.currentTarget.value || defaultEnd;
    state.analyticsPeriod = "custom";
  });
  document.querySelector("[data-analytics-date-preset]")?.addEventListener("click", () => {
    state.analyticsDateStart = defaultStart;
    state.analyticsDateEnd = defaultEnd;
    state.analyticsPeriod = "custom";
    showToast("Період аналітики повернуто до 1-15 травня.", "warning");
    rerender();
  });
  document.querySelector("[data-analytics-date-apply]")?.addEventListener("click", () => {
    if (dateFromAny(state.analyticsDateStart) > dateFromAny(state.analyticsDateEnd)) {
      [state.analyticsDateStart, state.analyticsDateEnd] = [state.analyticsDateEnd, state.analyticsDateStart];
    }
    state.analyticsPeriod = "custom";
    state.analyticsDatePickerOpen = false;
    showToast("Період аналітики застосовано.");
    rerender();
  });
  document.querySelectorAll("[data-analytics-tab]").forEach((button) => button.addEventListener("click", () => {
    state.analyticsTab = button.dataset.analyticsTab;
    rerender();
  }));
  document.querySelector("[data-export-analytics]")?.addEventListener("click", () => exportAnalytics(ctx, stats));
  document.querySelector("[data-analytics-details]")?.addEventListener("click", () => showToast("Детальний рейтинг адвокатів відкрито як прототипну дію.", "warning"));
}
