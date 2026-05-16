export const DEMO_START = "2024-05-01";
export const DEMO_END = "2024-05-15";

const typeColors = ["#1f7ae0", "#27ae6f", "#f59e0b", "#7c5ce8", "#64748b", "#9aa7b7"];

export function dateFromAny(value) {
  if (!value) return null;
  const clean = String(value).split(" ")[0];
  if (clean === "-") return null;
  if (clean.includes("-")) {
    const [year, month, day] = clean.split("-").map(Number);
    return new Date(year, month - 1, day);
  }
  const [day, month, year] = clean.split(".").map(Number);
  return new Date(year, month - 1, day);
}

export function formatDisplayDate(value) {
  const date = dateFromAny(value);
  if (!date) return "15.05.2024";
  return `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")}.${date.getFullYear()}`;
}

export function isInRange(value, startIso = DEMO_START, endIso = DEMO_END) {
  const date = dateFromAny(value);
  const start = dateFromAny(startIso);
  const end = dateFromAny(endIso);
  if (!date || !start || !end) return true;
  return date >= start && date <= end;
}

export function caseFinancials(item) {
  const total = Number(item.totalFee ?? item.income ?? 0);
  const debt = Number(item.debt ?? 0);
  const paid = Number(item.paid ?? Math.max(total - debt, 0));
  return {
    total,
    paid: Math.max(0, paid),
    debt: Math.max(0, debt),
    percent: total ? Math.round((Math.max(0, paid) / total) * 100) : 0
  };
}

export function clientName(state, item) {
  return state.clients.find((client) => client.id === Number(item.clientId))?.name || "Клієнт не вказаний";
}

function caseExpense(item) {
  if (item.expenses) return Number(item.expenses);
  const docs = item.documents?.length || 0;
  const tasks = item.tasks?.length || 0;
  const priority = item.priority === "Високий" ? 900 : item.priority === "Середній" ? 600 : 400;
  return Math.round((docs * 450 + tasks * 300 + priority) / 50) * 50;
}

export function financeRowsFromCases(state) {
  return state.cases.map((item) => {
    const finance = caseFinancials(item);
    return {
      ...item,
      client: clientName(state, item),
      total: finance.total,
      paid: finance.paid,
      debt: finance.debt,
      percent: finance.percent,
      financeStatus: finance.debt > 0 ? "Є борг" : finance.total > 0 ? "Оплачено" : "Не виставлено"
    };
  });
}

export function buildFinanceOperations(state) {
  const custom = state.financeOperations || [];
  const customIncomeByCase = new Map();
  const customExpenseByCase = new Map();
  const customInvoiceByCase = new Map();
  custom.forEach((operation) => {
    if (!operation.caseId) return;
    if (operation.type === "Надходження") {
      customIncomeByCase.set(operation.caseId, (customIncomeByCase.get(operation.caseId) || 0) + Math.max(0, operation.amount || 0));
    }
    if (operation.type === "Витрата") {
      customExpenseByCase.set(operation.caseId, (customExpenseByCase.get(operation.caseId) || 0) + Math.abs(operation.amount || 0));
    }
    if (operation.type === "Рахунок") {
      customInvoiceByCase.set(operation.caseId, (customInvoiceByCase.get(operation.caseId) || 0) + Math.max(0, operation.amount || 0));
    }
  });
  const generated = state.cases.flatMap((item) => {
    const finance = caseFinancials(item);
    const generatedPaid = Math.max(0, finance.paid - (customIncomeByCase.get(item.id) || 0));
    const generatedExpense = Math.max(0, caseExpense(item) - (customExpenseByCase.get(item.id) || 0));
    const generatedDebt = Math.max(0, finance.debt - (customInvoiceByCase.get(item.id) || 0));
    const client = clientName(state, item);
    const rows = [];
    if (generatedPaid > 0) {
      rows.push({
        id: `case-income-${item.id}`,
        date: formatDisplayDate(item.opened),
        type: "Надходження",
        title: "Оплата за правову допомогу",
        caseId: item.id,
        client,
        amount: generatedPaid,
        status: finance.debt > 0 ? "Частково" : "Оплачено",
        method: finance.debt > 0 ? "Часткова оплата" : "Банківський переказ",
        generated: true
      });
    }
    if (generatedExpense > 0) {
      rows.push({
        id: `case-expense-${item.id}`,
        date: formatDisplayDate(item.opened),
        type: "Витрата",
        title: "Судові та супровідні витрати",
        caseId: item.id,
        client,
        amount: -generatedExpense,
        status: "Оплачено",
        method: "Картка",
        generated: true
      });
    }
    if (generatedDebt > 0) {
      rows.push({
        id: `case-invoice-${item.id}`,
        date: formatDisplayDate(item.deadline),
        type: "Рахунок",
        title: "Очікувана оплата по справі",
        caseId: item.id,
        client,
        amount: generatedDebt,
        status: "Очікується",
        method: "Рахунок",
        generated: true
      });
    }
    return rows;
  });

  return [...generated, ...custom].sort((a, b) => {
    const left = dateFromAny(b.date)?.getTime() || 0;
    const right = dateFromAny(a.date)?.getTime() || 0;
    return left - right;
  });
}

export function financeTotalsFromData(rows, operations) {
  const income = operations
    .filter((item) => item.type === "Надходження")
    .reduce((sum, item) => sum + Math.max(0, Number(item.amount) || 0), 0);
  const expenses = Math.abs(operations
    .filter((item) => item.type === "Витрата")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0));
  const expected = rows.reduce((sum, item) => sum + item.debt, 0);
  const debt = expected;
  return {
    income,
    expenses,
    profit: Math.max(0, income - expenses),
    expected,
    debt
  };
}

function groupSum(items, getLabel, getValue) {
  const map = new Map();
  items.forEach((item) => {
    const label = getLabel(item);
    map.set(label, (map.get(label) || 0) + getValue(item));
  });
  return [...map.entries()];
}

export function financeInsightsFromData(rows, operations) {
  const positive = operations.filter((item) => item.type === "Надходження");
  const expenses = operations.filter((item) => item.type === "Витрата");
  const incomeTotal = positive.reduce((sum, item) => sum + Math.max(0, item.amount), 0) || 1;
  const expenseTotal = Math.abs(expenses.reduce((sum, item) => sum + item.amount, 0)) || 1;
  const incomeStructure = groupSum(positive, (item) => {
    if (item.title.toLowerCase().includes("консульта")) return "Консультації";
    if (item.status === "Частково") return "Часткові платежі";
    return "Гонорари";
  }, (item) => Math.max(0, item.amount)).map(([label, value], index) => [
    label,
    `${Math.round((value / incomeTotal) * 100)}% (${new Intl.NumberFormat("uk-UA").format(value)} грн)`,
    typeColors[index % typeColors.length]
  ]);
  const incomeByCase = rows
    .filter((item) => item.paid > 0)
    .sort((a, b) => b.paid - a.paid)
    .slice(0, 5)
    .map((item) => [`№${item.id} ${item.client}`, item.paid]);
  const expenseCategories = groupSum(expenses, (item) => {
    if (item.title.toLowerCase().includes("зарплата")) return "Зарплата";
    if (item.title.toLowerCase().includes("поштов")) return "Поштові витрати";
    if (item.title.toLowerCase().includes("суд")) return "Судові витрати";
    return "Супровідні витрати";
  }, (item) => Math.abs(item.amount)).map(([label, value]) => [
    label,
    Math.round((value / expenseTotal) * 100),
    `${new Intl.NumberFormat("uk-UA").format(value)} грн`
  ]);
  return { incomeStructure, incomeByCase, expenseCategories };
}

export function countBy(items, getLabel) {
  const map = new Map();
  items.forEach((item) => {
    const label = getLabel(item) || "Інше";
    map.set(label, (map.get(label) || 0) + 1);
  });
  return [...map.entries()];
}

export function analyticsSummaryFromCases(state, cases) {
  const allTasks = cases.flatMap((item) => item.tasks || []);
  const completed = cases.filter((item) => ["Завершено", "Закрито"].includes(item.status)).length;
  const inWork = cases.filter((item) => !["Завершено", "Закрито"].includes(item.status)).length;
  const finance = cases.reduce((totals, item) => {
    const row = caseFinancials(item);
    return {
      paid: totals.paid + row.paid,
      debt: totals.debt + row.debt
    };
  }, { paid: 0, debt: 0 });
  const openedDates = cases.map((item) => dateFromAny(item.opened)).filter(Boolean);
  const deadlineDates = cases.map((item) => dateFromAny(item.deadline)).filter(Boolean);
  const avgDays = cases.length
    ? Math.round(cases.reduce((sum, item) => {
      const start = dateFromAny(item.opened);
      const end = dateFromAny(item.deadline);
      return sum + (start && end ? Math.max(1, Math.round((end - start) / 86400000)) : 1);
    }, 0) / cases.length)
    : 0;
  const urgentTasks = allTasks.filter((task) => ["Срочно", "Терміново"].includes(task.status)).length;
  const success = cases.length ? Math.max(0, Math.min(100, Math.round(((cases.length - cases.filter((item) => item.debt > 0).length) / cases.length) * 100))) : 0;
  return {
    totalCases: cases.length,
    newCases: openedDates.length,
    finishedCases: completed,
    inWork,
    avgDays,
    success,
    paid: finance.paid,
    debt: finance.debt,
    profit: Math.max(0, finance.paid - finance.debt),
    urgentTasks,
    firstDate: openedDates[0],
    lastDate: deadlineDates.at(-1)
  };
}

export function rowsWithPercent(rows, colors = typeColors) {
  const total = rows.reduce((sum, [, value]) => sum + value, 0);
  return rows.map(([label, value], index) => [
    label,
    value,
    total ? Math.round((value / total) * 100) : 0,
    colors[index % colors.length]
  ]);
}

export function analyticsLineSeries(cases) {
  const labels = Array.from({ length: 15 }, (_, index) => `${String(index + 1).padStart(2, "0")}.05`);
  const opened = labels.map((label) => cases.filter((item) => String(item.opened || "").startsWith(label)).length);
  const deadlines = labels.map((label) => cases.filter((item) => String(item.deadline || "").startsWith(label)).length);
  const active = labels.map((label, index) => {
    const day = index + 1;
    return cases.filter((item) => {
      const openedDay = dateFromAny(item.opened)?.getDate() || 1;
      const deadlineDay = dateFromAny(item.deadline)?.getDate() || 31;
      return openedDay <= day && deadlineDay >= day;
    }).length;
  });
  const scale = Math.max(1, ...opened, ...deadlines, ...active);
  return {
    labels,
    max: Math.max(5, scale),
    newCases: opened,
    closedCases: deadlines,
    inWork: active
  };
}

export function osintSummaryFromData(state) {
  const sources = state.osintSources || [];
  const checks = state.osintChecks || [];
  const activeChecks = checks.filter((item) => item.status !== "Звіт готовий");
  const risks = checks.reduce((sum, item) => sum + (item.risks?.length || 0), 0)
    + state.cases.filter((item) => item.priority === "Високий" || item.debt > 0).length;
  const mentions = state.cases.reduce((sum, item) => (
    sum + (item.history?.length || 0) + (item.documents?.length || 0) + (item.tasks?.length || 0)
  ), 0);
  const documents = state.cases.reduce((sum, item) => sum + (item.documents?.length || 0), 0);
  return {
    collected: mentions * 120 + documents * 30 + checks.length * 55,
    mentions,
    analyzedCases: new Set(checks.map((item) => item.caseId)).size,
    risks,
    monitoring: activeChecks.length,
    sources: sources.filter((item) => item.enabled !== false).length || 6
  };
}
