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

const FINANCE_ACTIONS = {
  income: {
    tab: "income",
    title: "Додати надходження",
    hint: "Платіж зменшить борг по вибраній справі і з'явиться у фінансових операціях.",
    operationType: "Надходження",
    defaultTitle: "Оплата за правову допомогу",
    status: "Оплачено",
    method: "Банківський переказ",
    submit: "Зберегти надходження"
  },
  expense: {
    tab: "expenses",
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
  { name: "Іваненко А.Ю.", role: "Адвокат", base: 80000, bonus: 12000, total: 92000, status: "Готово", date: "15.05.2024", comment: "Ставка та бонус за закриті задачі" },
  { name: "Мельник Н.П.", role: "Адвокат", base: 62000, bonus: 8000, total: 70000, status: "Готово", date: "15.05.2024", comment: "Ставка за травень" },
  { name: "Кравчук А.В.", role: "Помічник", base: 34000, bonus: 3500, total: 37500, status: "Очікує", date: "15.05.2024", comment: "Потребує підтвердження" },
  { name: "Петренко С.В.", role: "Юрист", base: 48000, bonus: 6000, total: 54000, status: "Готово", date: "15.05.2024", comment: "Ставка за травень" }
];

const SALARY_MONTHS = ["Черв", "Лип", "Серп", "Вер", "Жов", "Лис", "Гру", "Січ", "Лют", "Бер", "Квіт", "Трав"];

const REPORT_ROWS = [
  ["Фінансовий звіт за період", "Доходи, витрати, прибуток і борги", "CSV"],
  ["Звіт по заборгованості", "Клієнти, суми боргу і прострочки", "PDF"],
  ["Реєстр рахунків та актів", "Документи, статуси і пов'язані справи", "XLSX"]
];

function isoToday() {
  return "2024-05-15";
}

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
  if (!caseId) return;
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

function financeOperations(state) {
  state.financeOperations = state.financeOperations || [];
  return [...state.financeOperations, ...FINANCE_OPERATIONS];
}

function salaryRows(state) {
  state.salaryRows = state.salaryRows || [];
  state.deletedSalaryIds = state.deletedSalaryIds || [];
  const deleted = new Set(state.deletedSalaryIds);
  const baseRows = SALARY_ROWS.map((row, index) => ({
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

function salaryTotals(rows) {
  return rows.reduce((totals, row) => ({
    base: totals.base + row.base,
    bonus: totals.bonus + row.bonus,
    total: totals.total + row.total
  }), { base: 0, bonus: 0, total: 0 });
}

function salaryHistoryValues(rows) {
  const average = rows.length ? Math.round(rows.reduce((sum, row) => sum + row.total, 0) / rows.length) : 0;
  const fallback = average || 45000;
  return SALARY_MONTHS.map((month, index) => ({
    month,
    value: Math.round(fallback * (0.88 + ((index % 5) * 0.04)))
  }));
}

function salaryEmployeeOptions(state) {
  const employees = new Map();
  [...(state.settingsUsers || []), ...salaryRows(state), ...SALARY_ROWS].forEach((item) => {
    const name = item.name;
    const role = item.role || "Співробітник";
    if (name && !employees.has(name)) employees.set(name, role);
  });
  return [...employees.entries()].map(([name, role]) => ({ name, role }));
}

function operationMatchesTab(operation, tab) {
  if (tab === "income") return operation.type === "Надходження";
  if (tab === "expenses") return operation.type === "Витрата";
  if (tab === "payments") return ["Надходження", "Витрата"].includes(operation.type);
  if (tab === "invoices") return operation.type === "Рахунок";
  if (tab === "acts") return operation.type === "Акт";
  if (tab === "clients") return operation.status === "Частково" || operation.status === "Очікується";
  return true;
}

function financeTotals(rows, operations, state) {
  const isDefaultRange = (state.financeDateStart || DEFAULT_START) === DEFAULT_START
    && (state.financeDateEnd || DEFAULT_END) === DEFAULT_END;
  const dynamicIncome = operations.filter((item) => item.custom && item.type === "Надходження").reduce((sum, item) => sum + item.amount, 0);
  const dynamicExpenses = Math.abs(operations.filter((item) => item.custom && item.type === "Витрата").reduce((sum, item) => sum + item.amount, 0));
  const dynamicExpected = operations.filter((item) => item.custom && item.type === "Рахунок").reduce((sum, item) => sum + item.amount, 0);
  if (isDefaultRange) {
    const income = 1245000 + dynamicIncome;
    const expenses = 320000 + dynamicExpenses;
    return {
      income,
      expenses,
      profit: Math.max(0, 925000 + dynamicIncome - dynamicExpenses),
      expected: 340500 + dynamicExpected,
      debt: Math.max(215300 + dynamicExpected - dynamicIncome, rows.reduce((sum, item) => sum + item.debt, 0))
    };
  }
  const income = operations.filter((item) => item.type === "Надходження").reduce((sum, item) => sum + Math.max(item.amount, 0), 0);
  const expenses = Math.abs(operations.filter((item) => item.type === "Витрата").reduce((sum, item) => sum + item.amount, 0));
  const expected = operations.filter((item) => item.type === "Рахунок").reduce((sum, item) => sum + item.amount, 0);
  return {
    income,
    expenses,
    profit: Math.max(0, income - expenses),
    expected,
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
  return operations.map((item) => {
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
    const caseCell = item.caseId
      ? `<button class="case-link-button" type="button" data-finance-open-case="${item.caseId}">№${item.caseId}</button>`
      : `<span class="muted">Без справи</span>`;
    return `
      <div class="finance-operation-row">
        <span>${item.date}</span>
        <strong class="${item.type === "Витрата" ? "danger" : "success"}">${item.type}</strong>
        <span>${item.title}</span>
        ${caseCell}
        <span>${item.client}</span>
        <b class="${item.amount < 0 ? "danger" : ""}">${amountText}</b>
        ${badge(item.status, statusTone)}
        <span>${item.method}</span>
        <button class="icon-button finance-row-menu" type="button" data-finance-row-action="${item.caseId}" title="Дії">⋮</button>
      </div>
    `;
  }).join("");
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

function financeCaseWorkspace(rows, currencyText, badge) {
  return `
    <div class="finance-workspace-table case-finance-workspace">
      <div class="finance-workspace-head">
        <span>Справа</span><span>Клієнт</span><span>Договір</span><span>Оплачено</span><span>Борг</span><span>Статус</span><span></span>
      </div>
      ${rows.map((item) => `
        <div class="finance-workspace-row">
          <button class="case-link-button" type="button" data-finance-open-case="${item.id}">№${item.id}</button>
          <span>${item.client}</span>
          <strong>${currencyText(item.total)}</strong>
          <span>${currencyText(item.paid)}</span>
          <b class="${item.debt ? "danger" : ""}">${currencyText(item.debt)}</b>
          ${badge(item.financeStatus, item.debt ? "red" : "green")}
          <button class="secondary compact" type="button" data-finance-work-case="${item.id}">Відкрити</button>
        </div>
      `).join("")}
    </div>
  `;
}

function financeClientWorkspace(rows, currencyText) {
  const debtRows = rows.filter((item) => item.debt > 0);
  if (!debtRows.length) {
    return `<div class="finance-operation-empty">Активних боргів немає.</div>`;
  }
  return `
    <div class="finance-workspace-cards">
      ${debtRows.map((item) => `
        <button class="finance-client-card" type="button" data-finance-open-case="${item.id}">
          <span>${item.client}</span>
          <strong>${currencyText(item.debt)}</strong>
          <small>Справа №${item.id}</small>
        </button>
      `).join("")}
    </div>
  `;
}

function financeSalaryWorkspace(state, icon, currencyText) {
  const rows = filteredSalaryRows(state);
  const employees = salaryEmployeeOptions(state);
  const totals = salaryTotals(rows);
  const history = salaryHistoryValues(rows);
  const historyMax = Math.max(...history.map((item) => item.value), 1);
  const selectedEmployee = state.salaryFilter || "all";
  return `
    <div class="salary-toolbar">
      <label>Співробітник
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

    <div class="finance-workspace-table salary-workspace">
      <div class="finance-workspace-head">
        <span>Співробітник</span><span>Роль</span><span>Ставка</span><span>Бонус</span><span>До виплати</span><span>Дата</span><span>Статус</span><span></span>
      </div>
      ${rows.length ? rows.map((row) => `
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
            <button class="icon-button finance-row-menu" type="button" aria-label="Дії зарплати" data-salary-menu="${row.id}">⋮</button>
            ${state.salaryMenuId === row.id ? `
              <div class="salary-row-menu">
                <button type="button" data-salary-edit="${row.id}">${icon("edit")} Редагувати</button>
                <button type="button" data-salary-export-row="${row.id}">${icon("file")} Експорт</button>
                <button class="danger" type="button" data-salary-delete="${row.id}">${icon("trash")} Видалити</button>
              </div>
            ` : ""}
          </div>
        </div>
      `).join("") : `<div class="finance-operation-empty">Для обраного співробітника нарахувань немає.</div>`}
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
              ? `<button class="primary" type="button" data-finance-work-action="${currentMeta.action}">${currentMeta.actionLabel}</button>`
              : ""}
        </div>
      </div>

      <div class="finance-workspace-metrics">
        ${financeWorkspaceSummary("Записів", isCases ? rows.length : isClients ? rows.filter((item) => item.debt > 0).length : isSalary ? currentSalaryRows.length : isReports ? REPORT_ROWS.length : visibleOperations.length, "у цьому розділі")}
        ${financeWorkspaceSummary(isSalary ? "Ставка" : "Надходження", isSalary ? currencyText(currentSalaryTotals.base) : currencyText(income), isSalary ? "за вибраним фільтром" : "за вибраний період")}
        ${financeWorkspaceSummary(isSalary ? "Бонуси" : "Витрати", isSalary ? currencyText(currentSalaryTotals.bonus) : currencyText(expenses), isSalary ? "премії та доплати" : "за вибраний період")}
        ${financeWorkspaceSummary(isSalary ? "До виплати" : "Борг", isSalary ? currencyText(currentSalaryTotals.total) : currencyText(totals.debt), isSalary ? "поточний фонд" : "поточний контроль")}
      </div>

      ${isSalary
        ? financeSalaryWorkspace(state, icon, currencyText)
        : isReports
          ? financeReportsWorkspace(icon, totals, currencyText)
          : isCases
            ? financeCaseWorkspace(rows, currencyText, badge)
            : isClients
              ? financeClientWorkspace(rows, currencyText)
              : `
                <div class="finance-workspace-table">
                  <div class="finance-operation-head">
                    <span>Дата</span><span>Тип</span><span>Назва / Опис</span><span>Справа</span><span>Клієнт</span><span>Сума</span><span>Статус</span><span>Спосіб оплати</span><span></span>
                  </div>
                  <div class="finance-operation-list">${visibleOperations.length ? operationRows(visibleOperations, badge) : `<div class="finance-operation-empty">${currentMeta.empty}</div>`}</div>
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

function addFinanceDocument(ctx, item, action, amount, title, date, comment) {
  const { caseFolders, makeDocumentId } = ctx;
  const config = FINANCE_ACTIONS[action];
  const today = new Date().toLocaleDateString("uk-UA");
  const type = action === "invoice" ? "Рахунок" : "Акт";
  const documentId = makeDocumentId();
  const name = `${type}: ${title} · №${item.id}.docx`;
  const documentData = {
    documentId,
    name,
    type,
    status: action === "invoice" ? "Подано" : "Чернетка",
    submitted: date,
    responseDue: "-",
    comment: `${comment || config.hint} Сума: ${new Intl.NumberFormat("uk-UA").format(amount)} грн.`,
    source: "Фінанси",
    added: today
  };
  const folder = ensureFinanceFolder(item, caseFolders);
  item.documents.unshift(documentData);
  folder.files.unshift({ ...documentData, updated: today });
  folder.updated = today;
  return documentData;
}

function openFinanceActionDialog(ctx, action) {
  const { state, caseById, clientById, currencyText } = ctx;
  const config = FINANCE_ACTIONS[action];
  const form = document.querySelector("#finance-action-form");
  if (!config || !form) return;
  const selected = caseById(state.selectedFinanceCaseId) || state.cases[0];
  const selectedDebt = selected?.debt || selected?.income || 20000;
  form.reset();
  form.elements.action.value = action;
  document.querySelector("#finance-action-title").textContent = config.title;
  document.querySelector("#finance-action-hint").textContent = config.hint;
  document.querySelector("#finance-action-submit").textContent = config.submit;
  document.querySelector("#finance-action-case").innerHTML = state.cases.map((item) => {
    const client = clientById(item.clientId)?.name || "Клієнт не вказаний";
    return `<option value="${item.id}">№${item.id} · ${client}</option>`;
  }).join("");
  form.elements.caseId.value = selected?.id || state.cases[0]?.id || "";
  form.elements.title.value = config.defaultTitle;
  form.elements.amount.value = action === "expense" ? 5000 : selectedDebt;
  form.elements.date.value = isoToday();
  form.elements.status.value = config.status;
  form.elements.method.value = config.method;
  form.elements.comment.value = action === "invoice"
    ? `Рахунок буде додано у документи справи. Поточний борг: ${currencyText(selected?.debt || 0)}.`
    : "";
  document.querySelector("#finance-action-dialog").showModal();
}

function applyFinanceAction(ctx, formData) {
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
  const amount = Math.max(0, Number(formData.get("amount")) || 0);
  if (!config || !item || !amount) return;

  const finance = caseFinance(item);
  const dateIso = formData.get("date") || isoToday();
  const date = financeDate(dateIso);
  const title = formData.get("title") || config.defaultTitle;
  const status = formData.get("status") || config.status;
  const method = formData.get("method") || config.method;
  const comment = formData.get("comment") || "";
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
    custom: true
  };

  state.financeOperations = state.financeOperations || [];
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
    item.nextPaymentDue = item.nextPaymentDue || formatDate(dateIso);
    addFinanceDocument(ctx, item, action, amount, title, date, comment);
  }

  if (action === "expense") {
    item.expenses = (item.expenses || 0) + amount;
  }

  if (action === "act") {
    addFinanceDocument(ctx, item, action, amount, title, date, comment);
  }

  item.financeComment = comment || item.financeComment || "";
  item.history.unshift({
    date: today,
    text: `${config.title}: ${title} на ${currencyText(amount)}.`
  });
  state.selectedCaseId = item.id;
  state.selectedFinanceCaseId = item.id;
  state.financeTab = config.tab;
  state.documentCaseFilter = item.id;
  document.querySelector("#finance-action-dialog")?.close();
  renderAll();
  switchView("finance");
  showToast(action === "invoice" || action === "act"
    ? `${config.title} створено і додано до документів справи.`
    : `${config.title} збережено у фінансах справи.`);
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
  state.financeDateStart = state.financeDateStart || DEFAULT_START;
  state.financeDateEnd = state.financeDateEnd || DEFAULT_END;
  state.financeDatePickerOpen = Boolean(state.financeDatePickerOpen);
  bindFinanceActionDialog(ctx);
  bindSalaryDialog(ctx);

  const rows = financeRows(ctx);
  const operationsInRange = financeOperations(state).filter((item) => inDateRange(item.date, state.financeDateStart, state.financeDateEnd));
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

      ${state.financeTab === "overview" ? `
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
      ` : financeWorkspace(ctx, rows, operationsInRange, visibleOperations, totals)}
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
  document.querySelectorAll("[data-export-finance]").forEach((button) => button.addEventListener("click", () => {
    exportFinanceReport(ctx, totals, visibleOperations);
  }));
  document.querySelectorAll("[data-finance-open-case]").forEach((button) => button.addEventListener("click", () => {
    openFinanceCase(ctx, button.dataset.financeOpenCase);
  }));
  document.querySelectorAll("[data-finance-work-case]").forEach((button) => button.addEventListener("click", () => {
    openFinanceCase(ctx, button.dataset.financeWorkCase);
  }));
  document.querySelectorAll("[data-finance-row-action]").forEach((button) => button.addEventListener("click", () => {
    state.selectedFinanceCaseId = button.dataset.financeRowAction;
    openFinanceDialog(button.dataset.financeRowAction);
  }));
  document.querySelector("[data-finance-back-overview]")?.addEventListener("click", () => {
    state.financeTab = "overview";
    rerender();
  });
  document.querySelectorAll("[data-finance-work-action]").forEach((button) => button.addEventListener("click", () => {
    state.selectedFinanceCaseId = selectedCaseId;
    openFinanceActionDialog(ctx, button.dataset.financeWorkAction);
  }));
  document.querySelectorAll("[data-finance-salary-open]").forEach((button) => button.addEventListener("click", () => {
    openSalaryDialog(ctx);
  }));
  document.querySelector("[data-salary-filter]")?.addEventListener("change", (event) => {
    state.salaryFilter = event.currentTarget.value;
    state.salaryMenuId = "";
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
    openFinanceActionDialog(ctx, "income");
  });
  document.querySelector("[data-finance-add-expense]")?.addEventListener("click", () => {
    state.selectedFinanceCaseId = selectedCaseId;
    openFinanceActionDialog(ctx, "expense");
  });
  document.querySelector("[data-finance-invoice]")?.addEventListener("click", () => {
    state.selectedFinanceCaseId = selectedCaseId;
    openFinanceActionDialog(ctx, "invoice");
  });
  document.querySelector("[data-finance-act]")?.addEventListener("click", () => {
    state.selectedFinanceCaseId = selectedCaseId;
    openFinanceActionDialog(ctx, "act");
  });
  document.querySelector("[data-finance-payments]")?.addEventListener("click", () => {
    state.financeTab = "payments";
    rerender();
  });
  document.querySelector("[data-finance-chart-scale]")?.addEventListener("change", () => showToast("Масштаб графіка змінено."));
}
