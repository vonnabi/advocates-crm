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

function filteredFinanceRows(ctx, rows) {
  const query = (ctx.state.financeQuery || "").trim().toLowerCase();
  return rows.filter((item) => {
    const matchesQuery = !query || [item.id, item.title, item.client, item.responsible]
      .some((value) => String(value || "").toLowerCase().includes(query));
    const status = ctx.state.financeStatusFilter || "all";
    const matchesStatus = status === "all"
      || (status === "debt" && item.debt > 0)
      || (status === "paid" && item.debt === 0 && item.total > 0)
      || (status === "empty" && item.total === 0);
    return matchesQuery && matchesStatus;
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

export function renderFinanceScreen(ctx) {
  const {
    state,
    $,
    icon,
    badge,
    currency,
    caseFinance,
    openFinanceDialog,
    showToast
  } = ctx;
  const rows = financeRows(ctx);
  const filtered = filteredFinanceRows(ctx, rows);
  const income = rows.reduce((sum, item) => sum + item.total, 0);
  const paid = rows.reduce((sum, item) => sum + item.paid, 0);
  const debt = rows.reduce((sum, item) => sum + item.debt, 0);
  const selected = rows.find((item) => item.id === state.selectedFinanceCaseId) || filtered[0] || rows[0];
  const selectedFinance = selected ? caseFinance(selected) : { total: 0, paid: 0, debt: 0 };
  const selectedPercent = selectedFinance.total ? Math.round((selectedFinance.paid / selectedFinance.total) * 100) : 0;

  $("#finance").innerHTML = `
    <div class="finance-screen">
      <div class="grid cols-4">
        <div class="metric"><span>Виставлено</span><strong>${currency(income)}</strong></div>
        <div class="metric"><span>Оплачено</span><strong>${currency(paid)}</strong></div>
        <div class="metric"><span>Борг клієнтів</span><strong>${currency(debt)}</strong></div>
        <div class="metric"><span>Середня оплата</span><strong>${rows.length ? Math.round((paid / Math.max(income, 1)) * 100) : 0}%</strong></div>
      </div>

      <div class="finance-filters panel">
        <input type="search" data-finance-query placeholder="Пошук справи, клієнта, відповідального..." value="${state.financeQuery || ""}">
        <select data-finance-status>
          <option value="all">Усі фінанси</option>
          <option value="debt" ${state.financeStatusFilter === "debt" ? "selected" : ""}>Є борг</option>
          <option value="paid" ${state.financeStatusFilter === "paid" ? "selected" : ""}>Оплачено</option>
          <option value="empty" ${state.financeStatusFilter === "empty" ? "selected" : ""}>Не виставлено</option>
        </select>
        <button class="primary" type="button" data-create-invoice>${icon("file")} Створити рахунок</button>
      </div>

      <div class="finance-layout">
        <section class="panel table-wrap finance-table-card">
          <div class="toolbar"><h2>Фінанси по справах</h2><span class="muted">${filtered.length} записів</span></div>
          <table class="finance-table">
            <thead><tr><th>Справа</th><th>Клієнт</th><th>Оплачено</th><th>Борг</th><th>Прогрес</th><th>Статус</th><th></th></tr></thead>
            <tbody>
              ${filtered.map((item) => `<tr class="${selected?.id === item.id ? "selected" : ""}" data-finance-row="${item.id}">
                <td><button class="case-link-button" type="button" data-select-finance="${item.id}">№${item.id}</button><small>${item.title}</small></td>
                <td>${item.client}</td>
                <td><strong>${currency(item.paid)}</strong><small>з ${currency(item.total)}</small></td>
                <td class="${item.debt ? "debt-text" : "paid-text"}">${currency(item.debt)}</td>
                <td><div class="mini-progress"><span style="width:${item.percent}%"></span></div><small>${item.percent}%</small></td>
                <td>${badge(item.financeStatus, item.debt ? "red" : item.total ? "green" : "blue")}</td>
                <td><button class="secondary compact-button" type="button" data-remind-finance="${item.id}">Нагадати</button></td>
              </tr>`).join("") || `<tr><td class="empty-cell" colspan="7">Фінансових записів не знайдено</td></tr>`}
            </tbody>
          </table>
        </section>

        <aside class="panel finance-side">
          ${selected ? `
            <div class="case-card-title">
              <span>Картка фінансів</span>
              ${badge(selected.debt ? "Є борг" : "Оплачено", selected.debt ? "red" : "green")}
            </div>
            <h3>№${selected.id}</h3>
            <p class="muted">${selected.client}</p>
            <div class="finance-side-metrics">
              <div><span>Договір</span><strong>${currency(selectedFinance.total)}</strong></div>
              <div><span>Оплачено</span><strong>${currency(selectedFinance.paid)}</strong></div>
              <div class="${selectedFinance.debt ? "debt" : "paid"}"><span>Борг</span><strong>${currency(selectedFinance.debt)}</strong></div>
            </div>
            <div class="case-finance-progress"><span style="width:${selectedPercent}%"></span></div>
            <p class="muted">Оплачено ${selectedPercent}%. ${selected.financeComment || "Коментар по оплаті ще не додано."}</p>
            <div class="documents-side-actions">
              <button class="primary" type="button" data-edit-finance-global="${selected.id}">${icon("edit")} Редагувати</button>
              <button class="secondary" type="button" data-open-finance-case="${selected.id}">${icon("briefcase")} Відкрити справу</button>
            </div>
          ` : `<p class="muted">Оберіть справу для перегляду фінансів.</p>`}
        </aside>
      </div>
    </div>
  `;

  document.querySelector("[data-finance-query]")?.addEventListener("input", (event) => {
    state.financeQuery = event.currentTarget.value;
    renderFinanceScreen(ctx);
  });
  document.querySelector("[data-finance-status]")?.addEventListener("change", (event) => {
    state.financeStatusFilter = event.currentTarget.value;
    renderFinanceScreen(ctx);
  });
  document.querySelector("[data-create-invoice]")?.addEventListener("click", () => {
    if (!selected) return;
    state.selectedFinanceCaseId = selected.id;
    openFinanceDialog(selected.id);
  });
  document.querySelectorAll("[data-select-finance]").forEach((button) => button.addEventListener("click", () => {
    state.selectedFinanceCaseId = button.dataset.selectFinance;
    renderFinanceScreen(ctx);
  }));
  document.querySelectorAll("[data-remind-finance]").forEach((button) => button.addEventListener("click", () => {
    const item = rows.find((row) => row.id === button.dataset.remindFinance);
    showToast(`Нагадування по оплаті для справи №${item.id} підготовлено.`, item.debt ? "warning" : "success");
  }));
  document.querySelector("[data-edit-finance-global]")?.addEventListener("click", (event) => openFinanceDialog(event.currentTarget.dataset.editFinanceGlobal));
  document.querySelector("[data-open-finance-case]")?.addEventListener("click", (event) => openFinanceCase(ctx, event.currentTarget.dataset.openFinanceCase));
}
