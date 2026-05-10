let state;
let $;
let icon;
let badge;
let statusTone;
let semanticTone;
let currency;
let currencyText;
let documentActionButtons;
let documentStatusControl;
let documentStatusTone;
let taskTone;
let advocatePhoto;
let clientById;
let caseById;
let openClientDialog;
let openCaseDialog;
let openEssenceDialog;
let openAuthorityDialog;
let openFinanceDialog;
let openDocumentDialog;
let openTaskDialog;
let openEventDialog;
let openFolderDialog;
let openDeleteDocumentConfirm;
let getDocumentPayload;
let openStoredDocument;
let syncNavigationState;

function applyContext(ctx) {
  ({
    state,
    $,
    icon,
    badge,
    statusTone,
    semanticTone,
    currency,
    currencyText,
    documentActionButtons,
    documentStatusControl,
    documentStatusTone,
    taskTone,
    advocatePhoto,
    clientById,
    caseById,
    openClientDialog,
    openCaseDialog,
    openEssenceDialog,
    openAuthorityDialog,
    openFinanceDialog,
    openDocumentDialog,
    openTaskDialog,
    openEventDialog,
    openFolderDialog,
    openDeleteDocumentConfirm,
    getDocumentPayload,
    openStoredDocument,
    syncNavigationState
  } = ctx);
}

export function renderCasesScreen(ctx) {
  applyContext(ctx);
  renderCases();
}

export function renderCaseListScreen(ctx) {
  applyContext(ctx);
  renderCaseList();
}

export function renderCaseProfileScreen(ctx, id) {
  applyContext(ctx);
  renderCaseProfile(id);
}

function renderCases() {
  const selected = caseById(state.selectedCaseId) || state.cases[0];
  $("#cases").innerHTML = `
    <div class="case-reference-screen" id="case-detail"></div>
  `;
  if (state.caseScreen === "detail") {
    renderCaseProfile(selected.id);
    syncNavigationState();
    return;
  }
  renderCaseList();
  syncNavigationState();
}

function caseDocumentsCount(item) {
  return caseFolders(item).reduce((sum, folder) => sum + folder.files.length, 0);
}

function caseFinancialStatus(item) {
  if (item.debt > 0) return badge("Є борг", "red");
  if (item.income > 0) return badge("Оплачено", "green");
  return badge("Не виставлено", "blue");
}

export function caseFinance(item) {
  const total = item.totalFee ?? item.income ?? 0;
  const debt = item.debt ?? 0;
  const paid = item.paid ?? Math.max(total - debt, 0);
  return { total, paid, debt };
}

function financePercent(item) {
  const finance = caseFinance(item);
  if (!finance.total) return 0;
  return Math.min(100, Math.round((finance.paid / finance.total) * 100));
}

function caseFinanceSummary(item) {
  const finance = caseFinance(item);
  const isPaid = finance.total > 0 && finance.debt === 0;
  return `
    <div class="case-finance-summary">
      <strong>${currencyText(finance.total)}</strong>
      <span>оплачено ${currencyText(finance.paid)}</span>
      <span class="${finance.debt ? "debt" : "paid"}">${isPaid ? "оплачено повністю" : `борг ${currencyText(finance.debt)}`}</span>
    </div>
  `;
}

function caseFinanceBlock(item) {
  const finance = caseFinance(item);
  const percent = financePercent(item);
  return `
    <article class="case-card case-finance-card">
      <div class="case-card-title">
        <span>8. ФІНАНСИ СПРАВИ</span>
        <button class="case-row-icon" data-edit-finance="${item.id}" title="Редагувати фінанси">${icon("edit")}</button>
      </div>
      <div class="case-finance-grid">
        <div class="case-finance-metric">
          <span>Сума договору</span>
          <strong>${currency(finance.total)}</strong>
        </div>
        <div class="case-finance-metric">
          <span>Оплачено</span>
          <strong>${currency(finance.paid)}</strong>
        </div>
        <div class="case-finance-metric ${finance.debt ? "debt" : "paid"}">
          <span>Борг</span>
          <strong>${currency(finance.debt)}</strong>
        </div>
        <div class="case-finance-metric">
          <span>Перша оплата</span>
          <strong>${item.firstPaymentDate || "Не вказано"}</strong>
        </div>
        <div class="case-finance-metric">
          <span>Наступна оплата</span>
          <strong>${item.nextPaymentDue || "Не вказано"}</strong>
        </div>
      </div>
      <div class="case-finance-progress" aria-label="Оплата ${percent}%">
        <span style="width:${percent}%"></span>
      </div>
      <div class="case-finance-note">
        <span>Оплачено ${percent}%</span>
        <p>${item.financeComment || "Коментар по оплаті ще не додано."}</p>
      </div>
    </article>
  `;
}

function priorityTone(priority) {
  return semanticTone(priority);
}

function caseMaterialBadges(item) {
  const documents = caseDocumentsCount(item);
  const events = caseProceduralItems(item).length;
  return `
    <span class="case-material-badge blue">Док ${documents}</span>
    <span class="case-material-badge amber">Зад ${item.tasks.length}</span>
    <span class="case-material-badge violet">Под ${events}</span>
  `;
}

function casePreviewDocuments(item) {
  const rows = caseFolders(item).flatMap((folder, folderIndex) =>
    folder.files.map((file, fileIndex) => ({ folder, folderIndex, file, fileIndex }))
  );
  if (!rows.length) return `<p class="preview-empty">Документів поки немає</p>`;
  return rows.map(({ folder, folderIndex, file, fileIndex }) => `
    <div class="preview-list-row preview-document-row">
      <div>
        <div class="preview-document-title">${icon("file")}<strong>${file.name}</strong></div>
        <span class="preview-document-meta">${folder.name} ${badge(file.status || "Без статусу", documentStatusTone(file.status))}</span>
      </div>
      <div class="folder-actions preview-row-actions">
        <button type="button" data-preview-view-document="${item.id}|folder:${folderIndex}:${fileIndex}" title="Посмотреть">${icon("eye")}</button>
        <button type="button" data-preview-edit-document="${item.id}|folder:${folderIndex}:${fileIndex}" title="Редактировать">${icon("edit")}</button>
        <button type="button" class="danger-icon" data-preview-delete-document="${item.id}|${folderIndex}:${fileIndex}" title="Удалить">${icon("trash")}</button>
      </div>
    </div>
  `).join("");
}

function casePreviewTasks(item) {
  if (!item.tasks.length) return `<p class="preview-empty">Задач поки немає</p>`;
  return item.tasks.map((task) => `
    <div class="preview-list-row">
      <div>
        <strong>${task.title}</strong>
        <span>${task.due || "Без строку"} · ${task.responsible || item.responsible}</span>
      </div>
      ${badge(task.status, taskTone(task.status))}
    </div>
  `).join("");
}

function casePreviewHistory(item) {
  if (!item.history.length) return `<p class="preview-empty">Історії поки немає</p>`;
  return item.history.map((entry) => `
    <div class="preview-list-row">
      <div>
        <strong>${entry.date}</strong>
        <span>${entry.text}</span>
      </div>
    </div>
  `).join("");
}

function casePreviewFinance(item) {
  const finance = caseFinance(item);
  const percent = financePercent(item);
  return `
    <div class="preview-finance-card">
      <div class="preview-finance-row">
        <span>Сума договору</span>
        <strong>${currency(finance.total)}</strong>
      </div>
      <div class="preview-finance-row">
        <span>Оплачено</span>
        <strong>${currency(finance.paid)}</strong>
      </div>
      <div class="preview-finance-row debt">
        <span>Борг</span>
        <strong>${currency(finance.debt)}</strong>
      </div>
      <div class="preview-finance-row">
        <span>Перша оплата</span>
        <strong>${item.firstPaymentDate || "Не вказано"}</strong>
      </div>
      <div class="preview-finance-row">
        <span>Наступна оплата</span>
        <strong>${item.nextPaymentDue || "Не вказано"}</strong>
      </div>
      <div class="preview-finance-progress"><span style="width:${percent}%"></span></div>
      <div class="preview-finance-footer">
        <small>Оплачено ${percent}%</small>
        <button type="button" class="preview-finance-edit" data-preview-finance="${item.id}" title="Редагувати фінанси">${icon("edit")}</button>
      </div>
    </div>
  `;
}

function financePreviewStatus(item) {
  const finance = caseFinance(item);
  if (!finance.total) return { text: "Фінанси не заповнено", tone: "neutral" };
  if (finance.debt > 0) return { text: "Є борг", tone: "debt" };
  return { text: "Оплачено повністю", tone: "paid" };
}

function casePreviewCard(item) {
  const client = clientById(item.clientId);
  const finance = caseFinance(item);
  const financeStatus = financePreviewStatus(item);
  return `
    <article class="case-card case-preview-card">
      <div class="case-preview-head">
        <h3 class="case-preview-title">Картка справи</h3>
        ${badge(item.status, semanticTone(item.status))}
      </div>
      <div class="case-preview-meta">
        <span class="case-preview-number">№${item.id}</span>
        <span class="muted">відкрито ${item.opened}</span>
      </div>
      <div class="case-preview-rows">
        <div><span>Клієнт</span><strong>${client?.name || "Не вказано"}</strong></div>
        <div><span>Тип</span><strong>${item.type}</strong></div>
        <div><span>Етап</span><strong>${item.stage}</strong></div>
        <div><span>Відповідальний</span><strong>${item.responsible}</strong></div>
        <div><span>Суд / орган</span><strong>${item.court}</strong></div>
        <div><span>Дедлайн</span><strong>${item.deadline}</strong></div>
        <div><span>Пріоритет</span>${badge(item.priority, priorityTone(item.priority))}</div>
      </div>
      <div class="case-preview-summary">
        <h2>${item.title}</h2>
        <p>${item.description}</p>
      </div>
      <div class="case-preview-links">
        <button type="button" data-preview-open="${item.id}" class="case-preview-open"><span>${icon("eye")}</span><strong>Відкрити картку</strong></button>
        <details class="case-preview-accordion finance-preview-line">
          <summary><span>›</span><strong>Фінанси</strong><em class="finance-status-pill ${financeStatus.tone}">${financeStatus.text}</em></summary>
          ${casePreviewFinance(item)}
        </details>
        <details class="case-preview-accordion">
          <summary><span>›</span><strong>Документи</strong><em>${caseDocumentsCount(item)}</em></summary>
          <div class="preview-list">${casePreviewDocuments(item)}</div>
        </details>
        <details class="case-preview-accordion">
          <summary><span>›</span><strong>Задачі</strong><em>${item.tasks.length}</em></summary>
          <div class="preview-list">${casePreviewTasks(item)}</div>
        </details>
        <details class="case-preview-accordion">
          <summary><span>›</span><strong>Історія справи</strong><em>${item.history.length}</em></summary>
          <div class="preview-list">${casePreviewHistory(item)}</div>
        </details>
      </div>
    </article>
  `;
}

function renderCaseList() {
  const selectedPageSize = $("#case-page-size")?.value || String(state.casePageSize || 6);
  const activeFilterId = document.activeElement?.id;
  const cursorPosition = activeFilterId === "case-search" ? $("#case-search")?.selectionStart : null;
  const selectedStatus = $("#case-status-filter")?.value || "";
  const selectedType = $("#case-type-filter")?.value || "";
  const selectedResponsible = $("#case-responsible-filter")?.value || "";
  const query = ($("#case-search")?.value || "").toLowerCase();
  const filteredCases = state.cases
    .filter((item) => {
      const client = clientById(item.clientId);
      const text = `${item.id} ${client?.name} ${item.title} ${item.type} ${item.status} ${item.court} ${item.responsible}`.toLowerCase();
      return (!query || text.includes(query))
        && (!selectedStatus || item.status === selectedStatus)
        && (!selectedType || item.type === selectedType)
        && (!selectedResponsible || item.responsible === selectedResponsible);
    });
  const pageSize = selectedPageSize === "all" ? Math.max(filteredCases.length, 1) : Number(selectedPageSize);
  const totalPages = Math.max(1, Math.ceil(filteredCases.length / pageSize));
  state.casePage = Math.min(Math.max(1, state.casePage || 1), totalPages);
  const pageStart = (state.casePage - 1) * pageSize;
  const pageCases = filteredCases.slice(pageStart, pageStart + pageSize);
  const selected = pageCases.find((item) => item.id === state.selectedCaseId) || pageCases[0] || filteredCases[0] || state.cases[0];
  if (selected) state.selectedCaseId = selected.id;
  const rows = pageCases
    .map((item) => {
      const client = clientById(item.clientId);
      return `<tr class="${item.id === selected.id ? "selected" : ""}" data-preview-case="${item.id}">
        <td>
          <div class="case-number-cell">
            <a href="#" data-open-case="${item.id}">№${item.id}</a>
            <span class="case-row-actions">
              <button type="button" data-open-case="${item.id}" title="Посмотреть" aria-label="Посмотреть справу">${icon("eye")}</button>
              <button type="button" data-edit-case-row="${item.id}" title="Редактировать" aria-label="Редактировать справу">${icon("edit")}</button>
              <button type="button" class="danger-icon" data-delete-case="${item.id}" title="Удалить" aria-label="Удалить справу">${icon("trash")}</button>
            </span>
          </div>
          <span>${item.opened}</span>
        </td>
        <td><strong>${client?.name || "Не вказано"}</strong><span>${item.responsible}</span></td>
        <td><strong>${item.title}</strong><span>${item.type}</span></td>
        <td>${item.stage}</td>
        <td><div class="case-materials">${caseMaterialBadges(item)}</div></td>
        <td>${item.deadline}</td>
        <td>${badge(item.priority, priorityTone(item.priority))}</td>
        <td>${badge(item.status, statusTone(item.status))}</td>
        <td>${caseFinanceSummary(item)}</td>
      </tr>`;
    }).join("");
  const urgentCases = state.cases.filter((item) => item.priority === "Високий" || item.status === "Терміново").length;
  const totalTasks = state.cases.reduce((sum, item) => sum + item.tasks.length, 0);
  const totalDebt = state.cases.reduce((sum, item) => sum + item.debt, 0);
  $("#case-detail").innerHTML = `
    <div class="case-list-screen">
      <div class="case-list-head">
        <div class="case-list-global-search">
          <input id="case-search" value="${$("#case-search")?.value || ""}" placeholder="Пошук клієнта, справи, події..." />
          <button class="icon-button" type="button">${icon("filter")}</button>
          <button class="primary" id="create-case-from-list">+ Додати справу</button>
        </div>
      </div>
      <div class="case-kpi-grid">
        <article><span>Усього справ</span><strong>${state.cases.length}</strong></article>
        <article><span>Термінові</span><strong>${urgentCases}</strong></article>
        <article><span>Задач по справах</span><strong>${totalTasks}</strong></article>
        <article><span>Борг по справах</span><strong>${currency(totalDebt)}</strong></article>
      </div>
      <div class="case-list-toolbar">
        <input id="case-list-search-secondary" value="${$("#case-search")?.value || ""}" placeholder="Пошук справи..." />
        <select id="case-status-filter">
          <option value="">Всі статуси</option>
          ${[...new Set(state.cases.map((item) => item.status))].map((status) => `<option value="${status}" ${status === selectedStatus ? "selected" : ""}>${status}</option>`).join("")}
        </select>
        <select id="case-type-filter">
          <option value="">Всі типи</option>
          ${[...new Set(state.cases.map((item) => item.type))].map((type) => `<option value="${type}" ${type === selectedType ? "selected" : ""}>${type}</option>`).join("")}
        </select>
        <select id="case-responsible-filter">
          <option value="">Всі адвокати</option>
          ${[...new Set(state.cases.map((item) => item.responsible).filter(Boolean))].map((responsible) => `<option value="${responsible}" ${responsible === selectedResponsible ? "selected" : ""}>${responsible}</option>`).join("")}
        </select>
      </div>
      <div class="case-list-layout">
        <article class="case-card case-list-card">
          <div class="table-wrap">
            <table class="case-list-table">
              <thead>
                <tr>
                  <th>Номер</th>
                  <th>Клієнт</th>
                  <th>Назва</th>
                  <th>Етап</th>
                  <th>Матеріали</th>
                  <th>Дедлайн</th>
                  <th>Пріоритет</th>
                  <th>Статус</th>
                  <th>Фінанси</th>
                </tr>
              </thead>
              <tbody>${rows || `<tr><td colspan="9">Справ не знайдено</td></tr>`}</tbody>
            </table>
          </div>
          <div class="case-pagination">
            <div class="case-pagination-left">
              <span>Показано ${filteredCases.length ? pageStart + 1 : 0}-${Math.min(pageStart + pageSize, filteredCases.length)} з ${filteredCases.length}</span>
              <select id="case-page-size">
                ${[6, 10, 20, 30].map((size) => `<option value="${size}" ${String(size) === selectedPageSize ? "selected" : ""}>${size} на сторінці</option>`).join("")}
                <option value="all" ${selectedPageSize === "all" ? "selected" : ""}>Усі справи</option>
              </select>
            </div>
            <div ${selectedPageSize === "all" ? "hidden" : ""}>
              <button type="button" data-case-page="${state.casePage - 1}" ${state.casePage === 1 ? "disabled" : ""}>‹</button>
              ${Array.from({ length: totalPages }, (_, index) => `<button type="button" class="${index + 1 === state.casePage ? "active" : ""}" data-case-page="${index + 1}">${index + 1}</button>`).join("")}
              <button type="button" data-case-page="${state.casePage + 1}" ${state.casePage === totalPages ? "disabled" : ""}>›</button>
            </div>
          </div>
        </article>
        ${selected ? casePreviewCard(selected) : ""}
      </div>
    </div>
  `;
  $("#create-case-from-list")?.addEventListener("click", () => openCaseDialog());
  $("#case-list-search-secondary")?.addEventListener("input", (event) => {
    $("#case-search").value = event.currentTarget.value;
    state.casePage = 1;
    renderCaseList();
  });
  ["#case-search", "#case-status-filter", "#case-type-filter", "#case-responsible-filter", "#case-page-size"].forEach((selector) => {
    $(selector)?.addEventListener("input", () => {
      if (selector === "#case-page-size") state.casePageSize = $("#case-page-size").value;
      state.casePage = 1;
      renderCaseList();
    });
    $(selector)?.addEventListener("change", () => {
      if (selector === "#case-page-size") state.casePageSize = $("#case-page-size").value;
      state.casePage = 1;
      renderCaseList();
    });
  });
  if (activeFilterId) {
    const activeFilter = document.getElementById(activeFilterId);
    activeFilter?.focus();
    if (activeFilterId === "case-search" && cursorPosition !== null) {
      activeFilter.setSelectionRange(cursorPosition, cursorPosition);
    }
  }
  document.querySelectorAll("[data-open-case]").forEach((node) => node.addEventListener("click", (event) => {
    event.preventDefault();
    state.caseScreen = "detail";
    renderCaseProfile(node.dataset.openCase);
  }));
  document.querySelectorAll("[data-preview-open]").forEach((node) => node.addEventListener("click", () => {
    state.caseScreen = "detail";
    renderCaseProfile(node.dataset.previewOpen);
  }));
  document.querySelectorAll("[data-preview-finance]").forEach((node) => node.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    openFinanceDialog(node.dataset.previewFinance);
  }));
  document.querySelectorAll("[data-preview-view-document]").forEach((node) => node.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const [caseId, encoded] = node.dataset.previewViewDocument.split("|");
    const payload = getDocumentPayload(caseId, encoded);
    openStoredDocument(payload.file || payload.doc);
  }));
  document.querySelectorAll("[data-preview-edit-document]").forEach((node) => node.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const [caseId, encoded] = node.dataset.previewEditDocument.split("|");
    openDocumentDialog(caseId, getDocumentPayload(caseId, encoded));
  }));
  document.querySelectorAll("[data-preview-delete-document]").forEach((node) => node.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const [caseId, encoded] = node.dataset.previewDeleteDocument.split("|");
    const [folderIndex, fileIndex] = encoded.split(":").map(Number);
    openDeleteDocumentConfirm({ caseId, folderIndex, fileIndex, type: "folder" });
  }));
  document.querySelectorAll("[data-edit-case-row]").forEach((node) => node.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    openCaseDialog(node.dataset.editCaseRow);
  }));
  document.querySelectorAll("[data-delete-case]").forEach((node) => node.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    openDeleteDocumentConfirm({ caseId: node.dataset.deleteCase, type: "case" });
  }));
  document.querySelectorAll("[data-preview-case]").forEach((node) => node.addEventListener("click", (event) => {
    event.preventDefault();
    if (event.target.closest("a,button")) return;
    state.selectedCaseId = node.dataset.previewCase;
    renderCaseList();
  }));
  document.querySelectorAll("[data-case-page]").forEach((node) => node.addEventListener("click", () => {
    state.casePage = Number(node.dataset.casePage);
    renderCaseList();
  }));
}

function caseActionRows(item) {
  if (!item.tasks.length) {
    return `<tr><td colspan="6" class="empty-cell">Запланованих дій поки немає</td></tr>`;
  }
  return item.tasks.map((task, index) => `<tr class="task-action-row ${task.status === "Виконано" ? "task-done-row" : ""}">
    <td><input type="checkbox" data-toggle-task-done="${index}" aria-label="${task.title}" ${task.status === "Виконано" ? "checked" : ""} /></td>
    <td>
      <span class="row-title-with-actions">
        <span class="row-title-text">${task.title}</span>
        <span class="hover-row-actions">
          <button class="case-row-icon" data-edit-task="${index}" title="Редагувати задачу">${icon("edit")}</button>
          <button class="case-row-icon danger-icon" data-delete-task="${index}" title="Видалити задачу">${icon("trash")}</button>
        </span>
      </span>
      ${task.reminder ? `<span class="task-reminder-note">нагадування увімкнено</span>` : ""}
    </td>
    <td>${badge(task.status, taskTone(task.status))}</td>
    <td>${task.due}</td>
    <td>${task.responsible || item.responsible}</td>
    <td>
      <div class="task-row-actions">
        <button class="case-row-icon ${task.reminder ? "active" : ""}" data-toggle-task-reminder="${index}" title="Нагадування">${icon("bell")}</button>
      </div>
    </td>
  </tr>`).join("");
}

export function caseProceduralItems(item) {
  if (Array.isArray(item.proceduralActions)) return item.proceduralActions;
  if (!String(item.id).startsWith("2024/")) return [];
  return [
    ["Подано адміністративний позов", "Адвокат", "15.05.2024", "20.05.2024", "В процесі", "amber"],
    ["Клопотання про забезпечення позову", "Адвокат", "16.05.2024", "19.05.2024", "Не розпочато", ""],
    ["Отримання витребуваних документів", "Суд", "17.05.2024", "27.05.2024", "Не розпочато", ""],
    ["Судове засідання", "Суд", "-", "10.06.2024", "Заплановано", "blue"]
  ];
}

function caseProceduralRows(item) {
  const rows = caseProceduralItems(item);
  if (!rows.length) {
    return `<tr><td colspan="5" class="empty-cell">Процесуальних дій поки немає</td></tr>`;
  }
  return rows.map((row, index) => {
    const action = Array.isArray(row) ? row[0] : row.action;
    const initiator = Array.isArray(row) ? row[1] : row.initiator;
    const initiated = Array.isArray(row) ? row[2] : row.initiated;
    const due = Array.isArray(row) ? row[3] : row.due;
    const status = Array.isArray(row) ? row[4] : row.status;
    const tone = semanticTone(status);
    return `<tr class="procedural-action-row">
    <td>
      <span class="row-title-with-actions">
        <span class="row-title-text">${action}</span>
        <span class="hover-row-actions procedural-row-actions">
          <button class="case-row-icon" data-edit-procedural-action="${index}" title="Редагувати процесуальну дію">${icon("edit")}</button>
          <button class="case-row-icon danger-icon" data-delete-procedural-action="${index}" title="Видалити процесуальну дію">${icon("trash")}</button>
        </span>
      </span>
    </td>
    <td>${initiator || "-"}</td>
    <td>${initiated || "-"}</td>
    <td>${due || "-"}</td>
    <td><span class="dot-status ${tone || ""}">${status || "Не розпочато"}</span></td>
  </tr>`;
  }).join("");
}

function caseDocumentRows(item) {
  if (!item.documents.length) {
    return `<tr><td colspan="4" class="empty-cell">Процесуальних документів поки немає</td></tr>`;
  }
  return item.documents.map((doc, docIndex) => `<tr class="procedural-doc-row">
    <td>
      <span class="procedural-doc-name">
        <span class="procedural-doc-title">${doc.name}</span>
        <span class="procedural-actions">
          ${documentActionButtons("procedural", docIndex)}
          <button type="button" class="danger-icon" data-delete-procedural-doc="${docIndex}" title="Удалить" aria-label="Удалить документ">${icon("trash")}</button>
        </span>
      </span>
    </td>
    <td>${doc.submitted || "-"}</td>
    <td>${doc.responseDue || "-"}</td>
    <td>${badge(doc.status, documentStatusTone(doc.status))}</td>
  </tr>`).join("");
}

export function caseFolders(item) {
  if (!item.folders) {
    if (!String(item.id).startsWith("2024/")) {
      item.folders = [];
      return item.folders;
    }
    item.folders = [
      {
        name: "Позови",
        updated: "17.05.2024",
        files: [
          { name: "Адміністративний позов.docx", status: "Чернетка", updated: "17.05.2024" },
          { name: "Додатки до позову.pdf", status: "Готово", updated: "17.05.2024" },
          { name: "Квитанція судового збору.pdf", status: "Потрібно перевірити", updated: "16.05.2024" }
        ]
      },
      {
        name: "Клопотання",
        updated: "16.05.2024",
        files: [
          { name: "Клопотання про забезпечення позову.docx", status: "В роботі", updated: "16.05.2024" },
          { name: "Проєкт додатків.docx", status: "Чернетка", updated: "16.05.2024" }
        ]
      },
      {
        name: "Запити",
        updated: "17.05.2024",
        files: [
          { name: "Запит документів до ТЦК.docx", status: "Подано", updated: "17.05.2024" },
          { name: "Адвокатський запит до ВЛК.docx", status: "Чернетка", updated: "16.05.2024" },
          { name: "Вхідний опис документів.pdf", status: "Отримано", updated: "15.05.2024" },
          { name: "Поштова квитанція.pdf", status: "Отримано", updated: "17.05.2024" }
        ]
      },
      {
        name: "Відповіді та ухвали",
        updated: "15.05.2024",
        files: [{ name: "Ухвала про відкриття провадження.pdf", status: "Отримано", updated: "15.05.2024" }]
      },
      {
        name: "Інші документи",
        updated: "12.05.2024",
        files: [
          { name: "Паспорт клієнта.pdf", status: "Отримано", updated: "12.05.2024" },
          { name: "ІПН клієнта.pdf", status: "Отримано", updated: "12.05.2024" }
        ]
      }
    ];
  }
  return item.folders;
}

function caseFolderRows(item) {
  if (!caseFolders(item).length) {
    return `<tr><td colspan="3" class="empty-cell">Папок і файлів поки немає</td></tr>`;
  }
  return caseFolders(item).map((folder, index) => {
    const isOpen = state.openFolderIndex === index;
    const folderRow = `<tr class="folder-row ${isOpen ? "open" : ""}">
      <td>
        <div class="folder-row-content">
          <button class="folder-cell folder-open-button" data-toggle-folder="${index}">
            <span class="folder-caret">${isOpen ? "⌄" : "›"}</span><span class="folder-icon"></span><span class="folder-title-text">${folder.name}</span>
          </button>
          <span class="folder-row-actions">
            <button type="button" data-edit-folder="${index}" title="Редактировать папку" aria-label="Редактировать папку">${icon("edit")}</button>
            <button type="button" class="danger-icon" data-delete-folder="${index}" title="Удалить папку" aria-label="Удалить папку">${icon("trash")}</button>
          </span>
        </div>
      </td>
      <td>${folder.files.length}</td>
      <td>${folder.updated}</td>
    </tr>`;
    const fileRows = isOpen ? `<tr class="folder-files-row"><td colspan="3">
      <div class="folder-files-list">
        ${folder.files.map((file, fileIndex) => `<div class="folder-file-row">
          <div class="folder-file-name">
            <div class="folder-file-title">
              ${icon("file")}
              <span>${file.name}</span>
            </div>
            <div class="folder-actions">
              ${documentActionButtons("folder", index, fileIndex)}
              <button type="button" class="danger-icon" data-delete-folder-file="${index}:${fileIndex}" title="Удалить" aria-label="Удалить документ">${icon("trash")}</button>
            </div>
          </div>
          <div class="folder-status-cell">${documentStatusControl(file.status)}</div>
          <div class="folder-updated-cell">${file.updated}</div>
        </div>`).join("")}
      </div>
    </td></tr>` : "";
    return folderRow + fileRows;
  }).join("");
}

function renderCaseProfile(id) {
  const item = caseById(id);
  const client = clientById(item.clientId);
  const clientAddress = client.address || "м. Київ, вул. Хрещатик, 10, кв. 5";
  state.selectedCaseId = item.id;
  state.caseScreen = "detail";
  $("#case-detail").innerHTML = `
    <button class="case-back" id="back-to-case-list" type="button">← Назад к списку справ</button>
    <div class="case-detail-head">
      <div>
        <div class="case-title-line">
          <h2>Справа № ${item.id}</h2>
          ${badge(item.status, semanticTone(item.status))}
        </div>
        <div class="case-meta-line">
          <span class="muted">Створено: ${item.opened}</span>
          <span class="muted case-owner">○ Відповідальний: <strong>${item.responsible}</strong></span>
        </div>
      </div>
      <div class="case-detail-actions">
        <button class="primary" id="save-case-current">Зберегти</button>
      </div>
    </div>
    <div class="case-detail-grid">
      <section class="case-stack">
        <article class="case-card">
          <div class="case-card-title"><span>1. КЛІЄНТ</span><button class="case-row-icon" data-edit-client-row="${client.id}" title="Редагувати клієнта">${icon("edit")}</button></div>
          <div class="case-client-box">
            ${advocatePhoto(client.name, "case-profile-photo")}
            <strong>${client.name}</strong>
          </div>
          <div class="case-contact-list">
            <div>${icon("phone")} <span>${client.phone}</span></div>
            <div>${icon("mail")} <span>${client.email}</span></div>
            <div>${icon("tag")} <span>${clientAddress}</span></div>
          </div>
        </article>
        <article class="case-card">
          <div class="case-card-title"><span>2. СУТЬ СПРАВИ</span><button class="case-row-icon" data-edit-case-section="${item.id}" title="Редагувати суть справи">${icon("edit")}</button></div>
          <p>${item.description}</p>
        </article>
        <article class="case-card">
          <div class="case-card-title"><span>3. ОРГАН, ДО ЯКОГО ЗВЕРНЕННЯ</span><button class="case-row-icon" data-edit-authority="${item.id}" title="Редагувати орган">${icon("edit")}</button></div>
          <div class="authority-box">
            <div class="authority-icon">▥</div>
            <strong>${item.court}</strong>
          </div>
          <p class="muted">Тип органу: ${item.authorityType || "Не вказано"}</p>
          <p class="muted">Адреса: ${item.authorityAddress || "Не вказано"}</p>
          <p class="muted">Контакт: ${item.authorityContact || "Не вказано"}</p>
        </article>
      </section>
      <section class="case-main-column">
        <article class="case-card">
          <h3>4. ЗАПЛАНОВАНІ ДІЇ</h3>
          <div class="case-tabs"><button class="active">Всі</button><button>Срочні</button><button>Не срочні</button></div>
          <div class="case-table-wrap">
            <table class="case-inner-table case-actions-table"><tbody>${caseActionRows(item)}</tbody></table>
          </div>
          <button class="case-link-button" data-add-task="${item.id}">+ Додати дію</button>
        </article>
        <article class="case-card">
          <h3>5. ПРОЦЕСУАЛЬНІ ДІЇ ПО СПРАВІ</h3>
          <div class="case-table-wrap">
            <table class="case-inner-table procedural-actions-table">
              <thead><tr><th>Дія</th><th>Ініціатор</th><th>Дата ініціації</th><th>Строк виконання</th><th>Статус</th></tr></thead>
              <tbody>${caseProceduralRows(item)}</tbody>
            </table>
          </div>
          <button class="case-link-button" data-add-event="${item.id}">+ Додати процесуальну дію</button>
        </article>
      </section>
      <section class="case-side-column">
        <article class="case-card scroll-card case-documents-card">
          <h3>6. ПРОЦЕСУАЛЬНІ ДОКУМЕНТИ</h3>
          <div class="case-table-wrap scroll-area">
            <table class="case-inner-table case-documents-table">
              <thead><tr><th>Документ</th><th>Дата подання</th><th>Строк отримання відповіді</th><th>Статус</th></tr></thead>
              <tbody>${caseDocumentRows(item)}</tbody>
            </table>
          </div>
          <button class="case-link-button" data-add-document="${item.id}">+ Додати документ</button>
        </article>
        <article class="case-card scroll-card case-folders-card">
          <h3>7. ДОКУМЕНТИ СПРАВИ</h3>
          <div class="case-table-wrap scroll-area">
            <table class="case-inner-table folders-table">
              <thead><tr><th>Назва</th><th>Файлів</th><th>Оновлено</th></tr></thead>
              <tbody>${caseFolderRows(item)}</tbody>
            </table>
          </div>
          <div class="case-card-actions">
            <button class="case-link-button" data-add-document="${item.id}">+ Створити документ</button>
            <button class="case-link-button" data-add-folder="${item.id}">+ Створити папку</button>
          </div>
        </article>
      </section>
    </div>
    ${caseFinanceBlock(item)}
    <article class="case-card case-history-card">
      <h3>ІСТОРІЯ СПРАВИ</h3>
      <div class="case-history-list">
        ${item.history.map((entry) => `<div class="case-history-row"><span></span><strong>${entry.date}</strong><p>${entry.text}</p></div>`).join("")}
      </div>
    </article>
  `;
  $("#back-to-case-list")?.addEventListener("click", () => {
    state.caseScreen = "list";
    renderCaseList();
    syncNavigationState();
  });
  $("#save-case-current")?.addEventListener("click", () => {
    state.caseScreen = "list";
    renderCaseList();
    syncNavigationState();
  });
  document.querySelectorAll(`[data-add-document="${item.id}"]`).forEach((button) => button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    openDocumentDialog(item.id);
  }));
  document.querySelectorAll(`[data-add-task="${item.id}"]`).forEach((button) => button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    openTaskDialog(item.id);
  }));
  document.querySelectorAll(`[data-add-event="${item.id}"]`).forEach((button) => button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    openEventDialog({ caseId: item.id, clientId: item.clientId });
  }));
  document.querySelectorAll(`[data-add-folder="${item.id}"]`).forEach((button) => button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    openFolderDialog(item.id);
  }));
  document.querySelectorAll("[data-toggle-task-done]").forEach((input) => input.addEventListener("change", () => {
    const task = item.tasks[Number(input.dataset.toggleTaskDone)];
    if (!task) return;
    task.status = input.checked ? "Виконано" : "Очікує";
    item.history.unshift({
      date: new Date().toLocaleDateString("uk-UA"),
      text: input.checked ? `Задачу виконано: ${task.title}.` : `Задачу повернуто в роботу: ${task.title}.`
    });
    renderCaseProfile(item.id);
  }));
  document.querySelectorAll("[data-toggle-task-reminder]").forEach((button) => button.addEventListener("click", (event) => {
    event.stopPropagation();
    const task = item.tasks[Number(button.dataset.toggleTaskReminder)];
    if (!task) return;
    task.reminder = !task.reminder;
    item.history.unshift({
      date: new Date().toLocaleDateString("uk-UA"),
      text: task.reminder ? `Увімкнено нагадування по задачі: ${task.title}.` : `Вимкнено нагадування по задачі: ${task.title}.`
    });
    renderCaseProfile(item.id);
  }));
  document.querySelectorAll("[data-edit-task]").forEach((button) => button.addEventListener("click", (event) => {
    event.stopPropagation();
    openTaskDialog(item.id, Number(button.dataset.editTask));
  }));
  document.querySelectorAll("[data-delete-task]").forEach((button) => button.addEventListener("click", (event) => {
    event.stopPropagation();
    openDeleteDocumentConfirm({ caseId: item.id, taskIndex: Number(button.dataset.deleteTask), type: "task" });
  }));
  document.querySelectorAll("[data-edit-procedural-action]").forEach((button) => button.addEventListener("click", (event) => {
    event.stopPropagation();
    openEventDialog({ caseId: item.id, clientId: item.clientId }, Number(button.dataset.editProceduralAction));
  }));
  document.querySelectorAll("[data-delete-procedural-action]").forEach((button) => button.addEventListener("click", (event) => {
    event.stopPropagation();
    openDeleteDocumentConfirm({ caseId: item.id, actionIndex: Number(button.dataset.deleteProceduralAction), type: "proceduralAction" });
  }));
  document.querySelectorAll("[data-toggle-folder]").forEach((button) => button.addEventListener("click", () => {
    const folderIndex = Number(button.dataset.toggleFolder);
    state.openFolderIndex = state.openFolderIndex === folderIndex ? null : folderIndex;
    renderCaseProfile(item.id);
  }));
  document.querySelectorAll("[data-edit-folder]").forEach((button) => button.addEventListener("click", (event) => {
    event.stopPropagation();
    openFolderDialog(item.id, Number(button.dataset.editFolder));
  }));
  document.querySelectorAll("[data-delete-folder]").forEach((button) => button.addEventListener("click", (event) => {
    event.stopPropagation();
    openDeleteDocumentConfirm({ caseId: item.id, folderIndex: Number(button.dataset.deleteFolder), type: "folder" });
  }));
  document.querySelectorAll("[data-delete-folder-file]").forEach((button) => button.addEventListener("click", (event) => {
    event.stopPropagation();
    const [folderIndex, fileIndex] = button.dataset.deleteFolderFile.split(":").map(Number);
    openDeleteDocumentConfirm({ caseId: item.id, folderIndex, fileIndex, type: "folder" });
  }));
  document.querySelectorAll("[data-delete-procedural-doc]").forEach((button) => button.addEventListener("click", (event) => {
    event.stopPropagation();
    openDeleteDocumentConfirm({ caseId: item.id, docIndex: Number(button.dataset.deleteProceduralDoc), type: "procedural" });
  }));
  document.querySelectorAll("[data-view-document]").forEach((button) => button.addEventListener("click", (event) => {
    event.stopPropagation();
    const payload = getDocumentPayload(item.id, button.dataset.viewDocument);
    openStoredDocument(payload.file || payload.doc);
  }));
  document.querySelectorAll("[data-edit-document]").forEach((button) => button.addEventListener("click", (event) => {
    event.stopPropagation();
    openDocumentDialog(item.id, getDocumentPayload(item.id, button.dataset.editDocument));
  }));
  document.querySelector(`[data-edit-finance="${item.id}"]`)?.addEventListener("click", () => openFinanceDialog(item.id));
  document.querySelectorAll(`[data-edit-case-section="${item.id}"]`).forEach((button) => button.addEventListener("click", () => openEssenceDialog(item.id)));
  document.querySelector(`[data-edit-authority="${item.id}"]`)?.addEventListener("click", () => openAuthorityDialog(item.id));
  document.querySelector(`[data-edit-client-row="${client.id}"]`)?.addEventListener("click", () => openClientDialog(client.id));
  syncNavigationState();
}
