const DEFAULT_START = "2024-05-01";
const DEFAULT_END = "2024-05-15";

const FINANCE_TABS = [
  ["overview", "Огляд"],
  ["income", "Надходження"],
  ["expenses", "Витрати"],
  ["cases", "Справа"],
  ["clients", "Клієнти"],
  ["invoices", "Рахунки"],
  ["acts", "Акти"],
  ["payments", "Платежі"],
  ["salary", "Зарплата"],
  ["reports", "Звіти"]
];

const FINANCE_OPERATIONS = [
  {
    date: "15.05.2024",
    type: "Надходження",
    title: "Оплата за правову допомогу",
    caseId: "2024/12345",
    client: "Петренко Микола",
    amount: 50000,
    status: "Оплачено",
    method: "Банківський переказ"
  },
  {
    date: "14.05.2024",
    type: "Витрата",
    title: "Судовий збір",
    caseId: "2024/5678",
    client: "ТОВ «Будівельник»",
    amount: -5368,
    status: "Оплачено",
    method: "Картка"
  },
  {
    date: "14.05.2024",
    type: "Надходження",
    title: "Оплата за консультацію",
    caseId: "2024/4321",
    client: "Коваленко Ольга",
    amount: 10000,
    status: "Оплачено",
    method: "Готівка"
  },
  {
    date: "13.05.2024",
    type: "Витрата",
    title: "Поштові витрати",
    caseId: "2024/9999",
    client: "Іванов Іван",
    amount: -350,
    status: "Оплачено",
    method: "Готівка"
  },
  {
    date: "13.05.2024",
    type: "Надходження",
    title: "Оплата за правову допомогу",
    caseId: "2024/4321",
    client: "ТОВ «Альфа»",
    amount: 75000,
    status: "Частково",
    method: "Банківський переказ"
  }
];

const INCOME_STRUCTURE = [
  ["Гонорари", "60% (747 000 грн)", "#1f7ae0"],
  ["Фіксовані платежі", "20% (249 000 грн)", "#27ae6f"],
  ["Супутні послуги", "10% (124 000 грн)", "#f59e0b"],
  ["Судові витрати відшкодовано", "5% (62 000 грн)", "#7c5ce8"],
  ["Інше", "5% (63 000 грн)", "#9aa7b7"]
];

const INCOME_BY_CASE = [
  ["№2024/1234 Петренко М.М.", 150000],
  ["№2024/5678 ТОВ «Будівельник»", 120000],
  ["№2024/9012 Коваленко О.В.", 80000],
  ["№2024/1357 ТОВ «Альфа»", 75000],
  ["№2024/2468 Іванов І.І.", 60000]
];

const EXPENSE_CATEGORIES = [
  ["Судові витрати", 45, "144 000 грн"],
  ["Поштові витрати", 20, "64 000 грн"],
  ["Офісні витрати", 15, "48 000 грн"],
  ["Транспортні витрати", 10, "32 000 грн"],
  ["Інше", 10, "32 000 грн"]
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

const chartDates = ["01.05", "03.05", "05.05", "07.05", "09.05", "11.05", "13.05", "15.05"];

function financeRows(ctx) {
  const { state, clientById, caseFinance } = ctx;
  return state.cases.map((item) => {
    const finance = caseFinance(item);
    const percent = finance.total ? Math.round((finance.paid / finance.total) * 100) : 0;
    return {
      ...item,
      client: clientById(item.clientId)?.name || "Клієнт не вказаний",
      total: finance.total,
      paid: finance.paid,
      debt: finance.debt,
      percent,
      financeStatus: finance.debt > 0 ? "Є борг" : finance.total > 0 ? "Оплачено" : "Не виставлено"
    };
  });
}

function openFinanceCase(ctx, caseId) {
  const { state, renderCases, switchView } = ctx;
  state.selectedCaseId = caseId;
  state.caseScreen = "detail";
  state.openCaseSection = "finance";
  renderCases();
  switchView("cases");
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
  const step = width / (values.length - 1);
  return values.map((value, index) => `${Math.round(index * step)},${Math.round(height - (value / max) * height)}`).join(" ");
}

function operationMatchesTab(operation, tab) {
  if (tab === "income") return operation.type === "Надходження";
  if (tab === "expenses") return operation.type === "Витрата";
  if (tab === "payments") return operation.status === "Оплачено" || operation.status === "Частково";
  if (tab === "invoices") return operation.title.toLowerCase().includes("оплата");
  if (tab === "clients") return operation.status === "Частково";
  return true;
}

function financeTotals(rows, operations, state) {
  const isDefaultRange = (state.financeDateStart || DEFAULT_START) === DEFAULT_START
    && (state.financeDateEnd || DEFAULT_END) === DEFAULT_END;
  if (isDefaultRange) {
    return {
      income: 1245000,
      expenses: 320000,
      profit: 925000,
      expected: 340500,
      debt: 215300
    };
  }
  const income = operations.filter((item) => item.amount > 0).reduce((sum, item) => sum + item.amount, 0);
  const expenses = Math.abs(operations.filter((item) => item.amount < 0).reduce((sum, item) => sum + item.amount, 0));
  return {
    income,
    expenses,
    profit: Math.max(0, income - expenses),
    expected: Math.round(income * 0.28),
    debt: rows.reduce((sum, item) => sum + item.debt, 0)
  };
}

function kpiCard({ title, value, trend, iconName, tone, trendTone = "" }, icon) {
  return `
    <article class="finance-kpi-card">
      <span>${title}</span>
      <strong>${value}</strong>
      <em class="${trendTone}">${trend}</em>
      <small>порівняно з попер. періодом</small>
      <i class="${tone}">${icon(iconName)}</i>
    </article>
  `;
}

function operationRows(operations, badge) {
  if (!operations.length) {
    return `<div class="finance-operation-empty">Фінансових операцій за обраний період не знайдено.</div>`;
  }
  return operations.map((item) => `
    <div class="finance-operation-row">
      <span>${item.date}</span>
      <strong class="${item.type === "Витрата" ? "danger" : "success"}">${item.type}</strong>
      <span>${item.title}</span>
      <button class="case-link-button" type="button" data-finance-open-case="${item.caseId}">№${item.caseId}</button>
      <span>${item.client}</span>
      <b class="${item.amount < 0 ? "danger" : ""}">${item.amount < 0 ? "-" : ""}${new Intl.NumberFormat("uk-UA").format(Math.abs(item.amount))} грн</b>
      ${badge(item.status, item.status === "Частково" ? "red" : "green")}
      <span>${item.method}</span>
      <button class="icon-button finance-row-menu" type="button" data-finance-row-action="${item.caseId}" title="Дії">⋮</button>
    </div>
  `).join("");
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
      `№${item.caseId}`,
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
  state.financeDateStart = state.financeDateStart || DEFAULT_START;
  state.financeDateEnd = state.financeDateEnd || DEFAULT_END;
  state.financeDatePickerOpen = Boolean(state.financeDatePickerOpen);

  const rows = financeRows(ctx);
  const operationsInRange = FINANCE_OPERATIONS.filter((item) => inDateRange(item.date, state.financeDateStart, state.financeDateEnd));
  const visibleOperations = operationsInRange.filter((item) => operationMatchesTab(item, state.financeTab));
  const totals = financeTotals(rows, operationsInRange, state);
  const debtRows = rows.filter((item) => item.debt > 0).slice(0, 4);
  const selectedCaseId = state.selectedFinanceCaseId || rows[0]?.id;

  $("#finance").innerHTML = `
    <div class="finance-screen finance-reference">
      <div class="finance-top-row">
        <div></div>
        <div class="analytics-date-wrap">
          <button class="analytics-date-range" type="button" data-finance-date-toggle aria-expanded="${state.financeDatePickerOpen}">
            <span>${financeDate(state.financeDateStart)} - ${financeDate(state.financeDateEnd)}</span>
            ${icon("calendar")}
          </button>
          ${state.financeDatePickerOpen ? `
            <div class="analytics-date-popover">
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

      <section class="finance-kpi-grid">
        ${[
          { title: "Загальний дохід", value: currencyText(totals.income), trend: "+12%", iconName: "briefcase", tone: "blue" },
          { title: "Витрати", value: currencyText(totals.expenses), trend: "+8%", trendTone: "danger", iconName: "file", tone: "red" },
          { title: "Чистий прибуток", value: currencyText(totals.profit), trend: "+15%", iconName: "check", tone: "green" },
          { title: "Очікувані надходження", value: currencyText(totals.expected), trend: "порівняно з попер. періодом", iconName: "clock", tone: "amber" },
          { title: "Заборгованість клієнтів", value: currencyText(totals.debt), trend: "порівняно з попер. періодом", iconName: "mail", tone: "red" }
        ].map((item) => kpiCard(item, icon)).join("")}
      </section>

      <section class="finance-dashboard-layout">
        <div class="finance-main-column">
          <div class="finance-main-grid">
            <article class="panel finance-chart-card finance-line-card">
              <div class="analytics-card-head">
                <h2>Динаміка доходів та витрат</h2>
                <select data-finance-chart-scale><option>По днях</option><option>По тижнях</option></select>
              </div>
              <div class="analytics-legend">
                <span class="blue">Дохід</span>
                <span class="red">Витрати</span>
                <span class="green">Прибуток</span>
              </div>
              <svg class="finance-line-chart" viewBox="0 0 620 250" role="img" aria-label="Динаміка доходів та витрат">
                <g class="grid-lines">
                  ${[0, 1, 2, 3, 4].map((line) => `<line x1="40" y1="${25 + line * 45}" x2="600" y2="${25 + line * 45}"></line>`).join("")}
                </g>
                ${["0", "200k", "400k", "600k", "800k"].map((value, index) => `<text x="10" y="${212 - index * 45}">${value}</text>`).join("")}
                <polyline class="line blue-line" points="${linePoints(FINANCE_LINE.income)}" transform="translate(40 25)"></polyline>
                <polyline class="line red-line" points="${linePoints(FINANCE_LINE.expenses)}" transform="translate(40 25)"></polyline>
                <polyline class="line green-line" points="${linePoints(FINANCE_LINE.profit)}" transform="translate(40 25)"></polyline>
                ${chartDates.map((date, index) => `<text class="axis" x="${42 + index * 78}" y="238">${date}</text>`).join("")}
              </svg>
            </article>

            <article class="panel finance-chart-card">
              <h2>Структура доходів</h2>
              <div class="finance-donut-wrap">
                <div class="finance-income-donut"></div>
                <div class="finance-donut-legend">
                  ${INCOME_STRUCTURE.map(([label, amount, color]) => `
                    <div><span style="--legend-color:${color}">${label}</span><strong>${amount}</strong></div>
                  `).join("")}
                </div>
              </div>
            </article>
          </div>

          <article class="panel finance-operations-card">
            <div class="toolbar">
              <h2>Останні фінансові операції <small>Фінанси по справах</small></h2>
              <span class="muted">${visibleOperations.length} записів</span>
            </div>
            <div class="finance-operation-head">
              <span>Дата</span><span>Тип</span><span>Назва / Опис</span><span>Справа</span><span>Клієнт</span><span>Сума</span><span>Статус</span><span>Спосіб оплати</span><span></span>
            </div>
            <div class="finance-operation-list">${operationRows(visibleOperations, badge)}</div>
            <button class="case-link-button finance-view-all" type="button" data-finance-all-operations>Переглянути всі операції</button>
          </article>

          <section class="finance-bottom-grid">
            <article class="panel finance-chart-card">
              <h2>Доходи по справах (топ 5)</h2>
              <div class="finance-mini-bars">${barRows(INCOME_BY_CASE)}</div>
            </article>
            <article class="panel finance-chart-card">
              <h2>Витрати по категоріях</h2>
              <div class="finance-mini-bars">${expenseRows(EXPENSE_CATEGORIES)}</div>
            </article>
            <article class="panel finance-chart-card">
              <h2>Прогноз грошового потоку</h2>
              <div class="finance-cashflow-legend">
                <span class="green">Очікувані надходження</span>
                <span class="red">Очікувані витрати</span>
              </div>
              <div class="finance-cashflow-chart">
                ${CASHFLOW.map(([label, income, expense]) => `
                  <div>
                    <span class="green" style="height:${income}%"></span>
                    <span class="red" style="height:${expense}%"></span>
                    <em>${label}</em>
                  </div>
                `).join("")}
              </div>
            </article>
          </section>
        </div>

        <aside class="finance-right-column">
          <article class="panel finance-status-card">
            <h2>Фінансовий стан</h2>
            ${[
              ["Всього на рахунках", "540 200 грн"],
              ["Готівка в касі", "28 500 грн"],
              ["Заборгованість клієнтів", currencyText(totals.debt)],
              ["Заборгованість постачальникам", "48 900 грн"]
            ].map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`).join("")}
            <div class="available"><span>Доступно до використання</span><strong>304 800 грн</strong></div>
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
            <button type="button" data-finance-add-income>${icon("check")} Додати надходження</button>
            <button type="button" data-finance-add-expense>${icon("file")} Додати витрату</button>
            <button type="button" data-finance-invoice>${icon("file")} Виставити рахунок клієнту</button>
            <button type="button" data-finance-act>${icon("file")} Створити акт</button>
            <button type="button" data-finance-payments>${icon("briefcase")} Перейти до всіх платежів</button>
          </article>
        </aside>
      </section>
    </div>
  `;

  const rerender = () => renderFinanceScreen(ctx);

  document.querySelectorAll("[data-finance-tab]").forEach((button) => button.addEventListener("click", () => {
    state.financeTab = button.dataset.financeTab;
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
    showToast("Період фінансів застосовано.");
    rerender();
  });
  document.querySelector("[data-export-finance]")?.addEventListener("click", () => exportFinanceReport(ctx, totals, visibleOperations));
  document.querySelectorAll("[data-finance-open-case]").forEach((button) => button.addEventListener("click", () => {
    openFinanceCase(ctx, button.dataset.financeOpenCase);
  }));
  document.querySelectorAll("[data-finance-row-action]").forEach((button) => button.addEventListener("click", () => {
    state.selectedFinanceCaseId = button.dataset.financeRowAction;
    openFinanceDialog(button.dataset.financeRowAction);
  }));
  document.querySelector("[data-finance-all-operations]")?.addEventListener("click", () => {
    state.financeTab = "payments";
    showToast("Відкрито вкладку платежів.");
    rerender();
  });
  document.querySelector("[data-finance-all-debts]")?.addEventListener("click", () => {
    state.financeTab = "clients";
    showToast("Показано клієнтів із заборгованістю.", "warning");
    rerender();
  });
  document.querySelector("[data-finance-add-income]")?.addEventListener("click", () => {
    state.selectedFinanceCaseId = selectedCaseId;
    openFinanceDialog(selectedCaseId);
  });
  document.querySelector("[data-finance-add-expense]")?.addEventListener("click", () => showToast("Форма додавання витрати підготовлена як прототипна дія.", "warning"));
  document.querySelector("[data-finance-invoice]")?.addEventListener("click", () => openFinanceDialog(selectedCaseId));
  document.querySelector("[data-finance-act]")?.addEventListener("click", () => showToast("Акт по вибраній справі сформовано як чернетку."));
  document.querySelector("[data-finance-payments]")?.addEventListener("click", () => {
    state.financeTab = "payments";
    rerender();
  });
  document.querySelector("[data-finance-chart-scale]")?.addEventListener("change", () => showToast("Масштаб графіка змінено."));
}
