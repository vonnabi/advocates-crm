function countBy(items, getter) {
  return items.reduce((acc, item) => {
    const key = getter(item) || "Не вказано";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function chartRows(map, total) {
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label, value, percent: total ? Math.round((value / total) * 100) : 0 }));
}

function exportAnalytics(ctx, stats) {
  const csv = [
    "Показник,Значення",
    `Справи,${stats.casesCount}`,
    `Клієнти,${stats.clientsCount}`,
    `Задачі,${stats.tasksCount}`,
    `Прострочені задачі,${stats.overdueTasks}`,
    `Борг,${stats.debt}`
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "analytics-report.csv";
  link.click();
  URL.revokeObjectURL(link.href);
  ctx.showToast("Аналітичний CSV звіт сформовано.");
}

export function renderAnalyticsScreen(ctx) {
  const { state, $, badge, currency, allCaseTasks, clientById, semanticTone } = ctx;
  const responsibleOptions = [...new Set(state.cases.map((item) => item.responsible).filter(Boolean))];
  const filteredCases = state.cases.filter((item) => {
    const matchesResponsible = state.analyticsResponsible === "all" || item.responsible === state.analyticsResponsible;
    const status = state.analyticsStatus || "all";
    const matchesStatus = status === "all"
      || (status === "active" && item.status !== "Завершено")
      || (status === "debt" && item.debt > 0)
      || (status === "urgent" && item.priority === "Високий");
    return matchesResponsible && matchesStatus;
  });
  const tasks = allCaseTasks().filter((task) => filteredCases.some((item) => item.id === task.caseId));
  const overdueTasks = tasks.filter((task) => task.status === "Просрочено" || task.status === "Срочно").length;
  const debt = filteredCases.reduce((sum, item) => sum + (item.debt || 0), 0);
  const paid = filteredCases.reduce((sum, item) => sum + (item.income || 0), 0);
  const stats = {
    casesCount: filteredCases.length,
    clientsCount: new Set(filteredCases.map((item) => item.clientId)).size,
    tasksCount: tasks.length,
    overdueTasks,
    debt
  };
  const typeRows = chartRows(countBy(filteredCases, (item) => item.type), filteredCases.length);
  const sourceRows = chartRows(countBy(filteredCases, (item) => clientById(item.clientId)?.source), filteredCases.length);
  const responsibleRows = chartRows(countBy(filteredCases, (item) => item.responsible), filteredCases.length);

  $("#analytics").innerHTML = `
    <div class="analytics-screen">
      <div class="toolbar analytics-toolbar">
        <div class="left">
          <select data-analytics-period>
            <option value="month" ${state.analyticsPeriod === "month" ? "selected" : ""}>Поточний місяць</option>
            <option value="30" ${state.analyticsPeriod === "30" ? "selected" : ""}>Останні 30 днів</option>
            <option value="year" ${state.analyticsPeriod === "year" ? "selected" : ""}>Рік</option>
          </select>
          <select data-analytics-responsible>
            <option value="all">Усі співробітники</option>
            ${responsibleOptions.map((name) => `<option value="${name}" ${state.analyticsResponsible === name ? "selected" : ""}>${name}</option>`).join("")}
          </select>
          <select data-analytics-status>
            <option value="all">Усі справи</option>
            <option value="active" ${state.analyticsStatus === "active" ? "selected" : ""}>Активні</option>
            <option value="urgent" ${state.analyticsStatus === "urgent" ? "selected" : ""}>Високий пріоритет</option>
            <option value="debt" ${state.analyticsStatus === "debt" ? "selected" : ""}>Є борг</option>
          </select>
        </div>
        <button class="secondary" type="button" data-export-analytics>Експорт CSV</button>
      </div>
      <div class="grid cols-4">
        <div class="metric"><span>Справ у вибірці</span><strong>${stats.casesCount}</strong></div>
        <div class="metric"><span>Клієнти</span><strong>${stats.clientsCount}</strong></div>
        <div class="metric"><span>Задачі</span><strong>${stats.tasksCount}</strong></div>
        <div class="metric"><span>Оплата / борг</span><strong>${currency(paid)} / ${currency(debt)}</strong></div>
      </div>
      <div class="analytics-grid">
        <div class="panel analytics-card">
          <h2>Справи за типами</h2>
          ${typeRows.map((row) => `<div class="analytics-bar"><span>${row.label}</span><strong>${row.percent}%</strong><em><i style="width:${row.percent}%"></i></em></div>`).join("")}
        </div>
        <div class="panel analytics-card">
          <h2>Джерела клієнтів</h2>
          ${sourceRows.map((row) => `<div class="analytics-bar"><span>${row.label}</span><strong>${row.percent}%</strong><em><i style="width:${row.percent}%"></i></em></div>`).join("")}
        </div>
        <div class="panel analytics-card">
          <h2>Команда</h2>
          ${responsibleRows.map((row) => `<div class="analytics-bar"><span>${row.label}</span><strong>${row.value}</strong><em><i style="width:${row.percent}%"></i></em></div>`).join("")}
        </div>
      </div>
      <div class="panel analytics-risks">
        <h2>Ризики та контроль</h2>
        <div class="list">
          <div class="list-item">${badge(`${overdueTasks} термінових задач`, semanticTone("Срочно"))}<p class="muted">Потрібно перевірити дедлайни і планер.</p></div>
          <div class="list-item">${badge(`${filteredCases.filter((item) => item.debt > 0).length} справ з боргом`, "red")}<p class="muted">Фінансовий контроль по активних клієнтах.</p></div>
          <div class="list-item">${badge(`${filteredCases.filter((item) => item.priority === "Високий").length} високих пріоритетів`, "amber")}<p class="muted">Справи, які варто тримати в щоденному фокусі.</p></div>
        </div>
      </div>
    </div>
  `;

  document.querySelector("[data-analytics-period]")?.addEventListener("change", (event) => {
    state.analyticsPeriod = event.currentTarget.value;
    renderAnalyticsScreen(ctx);
  });
  document.querySelector("[data-analytics-responsible]")?.addEventListener("change", (event) => {
    state.analyticsResponsible = event.currentTarget.value;
    renderAnalyticsScreen(ctx);
  });
  document.querySelector("[data-analytics-status]")?.addEventListener("change", (event) => {
    state.analyticsStatus = event.currentTarget.value;
    renderAnalyticsScreen(ctx);
  });
  document.querySelector("[data-export-analytics]")?.addEventListener("click", () => exportAnalytics(ctx, stats));
}
