function filteredChecks(state) {
  const query = (state.osintQuery || "").trim().toLowerCase();
  return state.osintChecks.filter((check) => {
    const matchesQuery = !query || [check.title, check.caseId, check.object, check.status, ...(check.sources || [])]
      .some((value) => String(value || "").toLowerCase().includes(query));
    const matchesStatus = (state.osintStatusFilter || "all") === "all" || check.status === state.osintStatusFilter;
    return matchesQuery && matchesStatus;
  });
}

function openOsintCase(ctx, caseId) {
  const { state, renderCases, switchView } = ctx;
  state.selectedCaseId = caseId;
  state.caseScreen = "detail";
  renderCases();
  switchView("cases");
}

export function renderOSINTScreen(ctx) {
  const { state, $, badge, icon, showToast } = ctx;
  const filtered = filteredChecks(state);
  if (!filtered.some((check) => check.id === state.selectedOsintId)) {
    state.selectedOsintId = filtered[0]?.id || state.osintChecks[0]?.id || "";
  }
  const selected = state.osintChecks.find((check) => check.id === state.selectedOsintId);
  const statuses = [...new Set(state.osintChecks.map((check) => check.status))];

  $("#osint").innerHTML = `
    <div class="osint-screen">
      <div class="grid cols-4">
        <div class="metric"><span>Перевірок</span><strong>${state.osintChecks.length}</strong></div>
        <div class="metric"><span>Відкриті ризики</span><strong>${state.osintChecks.reduce((sum, item) => sum + item.risks.length, 0)}</strong></div>
        <div class="metric"><span>Джерел даних</span><strong>${new Set(state.osintChecks.flatMap((item) => item.sources)).size}</strong></div>
        <div class="metric"><span>Звіти</span><strong>${state.osintChecks.filter((item) => item.status === "Звіт готовий").length}</strong></div>
      </div>
      <div class="osint-filters panel">
        <input data-osint-query placeholder="Пошук перевірки, справи, джерела..." value="${state.osintQuery || ""}">
        <select data-osint-status>
          <option value="all">Усі статуси</option>
          ${statuses.map((status) => `<option value="${status}" ${state.osintStatusFilter === status ? "selected" : ""}>${status}</option>`).join("")}
        </select>
        <button class="primary" type="button" data-create-osint>${icon("search")} Нова перевірка</button>
      </div>
      <div class="layout osint-layout">
        <section class="panel">
          <div class="toolbar"><h2>OSINT перевірки</h2><span class="muted">${filtered.length} записів</span></div>
          <div class="list">
            ${filtered.map((check) => `<button class="list-item osint-check-row ${selected?.id === check.id ? "active" : ""}" type="button" data-select-osint="${check.id}">
              <strong>${check.title}</strong>
              <p class="muted">Справа №${check.caseId} · ${check.sources.join(", ")}</p>
              ${badge(check.status, check.status === "Потребує уваги" ? "amber" : check.status === "Звіт готовий" ? "green" : "blue")}
            </button>`).join("") || `<div class="list-item muted">Перевірок за фільтром не знайдено.</div>`}
          </div>
        </section>
        <aside class="panel osint-side">
          ${selected ? `
            <div class="case-card-title">
              <span>Картка перевірки</span>
              ${badge(selected.status, selected.status === "Потребує уваги" ? "amber" : selected.status === "Звіт готовий" ? "green" : "blue")}
            </div>
            <div class="profile">
              <div class="profile-line"><span>Об'єкт</span><strong>${selected.object}</strong></div>
              <div class="profile-line"><span>Пов'язана справа</span><strong>№${selected.caseId}</strong></div>
              <div class="profile-line"><span>Джерела</span><strong>${selected.sources.length}</strong></div>
            </div>
            <h3>Ризики</h3>
            <div class="list">
              ${selected.risks.length ? selected.risks.map((risk) => `<div class="list-item">${badge("Ризик", "amber")} ${risk}</div>`).join("") : `<div class="list-item">${badge("Без критичних ризиків", "green")}</div>`}
            </div>
            <div class="documents-side-actions">
              <button class="primary" type="button" data-osint-complete="${selected.id}">${icon("check")} Сформувати звіт</button>
              <button class="secondary" type="button" data-open-osint-case="${selected.caseId}">${icon("briefcase")} Відкрити справу</button>
            </div>
          ` : `<p class="muted">Оберіть перевірку зі списку.</p>`}
        </aside>
      </div>
    </div>
  `;

  document.querySelector("[data-osint-query]")?.addEventListener("input", (event) => {
    state.osintQuery = event.currentTarget.value;
    renderOSINTScreen(ctx);
  });
  document.querySelector("[data-osint-status]")?.addEventListener("change", (event) => {
    state.osintStatusFilter = event.currentTarget.value;
    renderOSINTScreen(ctx);
  });
  document.querySelector("[data-create-osint]")?.addEventListener("click", () => {
    const caseId = state.selectedCaseId || state.cases[0]?.id || "";
    const next = {
      id: `osint-${Date.now()}`,
      title: "Нова OSINT перевірка",
      caseId,
      object: "Об'єкт перевірки",
      sources: ["ЄДР", "Судовий реєстр", "Пошук"],
      risks: ["Потрібно заповнити висновок перевірки"],
      status: "В роботі"
    };
    state.osintChecks.unshift(next);
    state.selectedOsintId = next.id;
    showToast("Нову OSINT перевірку створено.");
    renderOSINTScreen(ctx);
  });
  document.querySelectorAll("[data-select-osint]").forEach((button) => button.addEventListener("click", () => {
    state.selectedOsintId = button.dataset.selectOsint;
    renderOSINTScreen(ctx);
  }));
  document.querySelector("[data-osint-complete]")?.addEventListener("click", (event) => {
    const check = state.osintChecks.find((item) => item.id === event.currentTarget.dataset.osintComplete);
    if (!check) return;
    check.status = "Звіт готовий";
    check.risks = check.risks.filter((risk) => !risk.includes("Потрібно заповнити"));
    showToast("OSINT звіт сформовано.");
    renderOSINTScreen(ctx);
  });
  document.querySelector("[data-open-osint-case]")?.addEventListener("click", (event) => openOsintCase(ctx, event.currentTarget.dataset.openOsintCase));
}
