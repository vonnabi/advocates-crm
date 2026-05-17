function documentRows(ctx) {
  const { state, clientById, caseFolders, findFolderFileByDocument } = ctx;
  return state.cases.flatMap((item) => {
    const client = clientById(item.clientId);
    const linkedDocumentIds = new Set(item.documents.map((doc) => doc.documentId).filter(Boolean));
    const proceduralRows = item.documents.map((doc, docIndex) => {
      const linked = findFolderFileByDocument(item, doc);
      return {
        ...doc,
        key: `${item.id}|procedural:${docIndex}`,
        encoded: `procedural:${docIndex}`,
        caseId: item.id,
        caseTitle: item.title,
        client: client?.name || "Клієнт не вказаний",
        responsible: doc.responsible || item.responsible || client?.manager || "Не вказано",
        casePriority: item.priority,
        folderName: linked?.folder?.name || "Процесуальні документи",
        sourceLabel: doc.source || linked?.file?.source || "CRM",
        docIndex
      };
    });
    const folderRows = caseFolders(item).flatMap((folder, folderIndex) =>
      folder.files
        .map((file, fileIndex) => ({ folder, folderIndex, file, fileIndex }))
        .filter(({ file }) => !file.documentId || !linkedDocumentIds.has(file.documentId))
        .map(({ folder, folderIndex, file, fileIndex }) => ({
          ...file,
          key: `${item.id}|folder:${folderIndex}:${fileIndex}`,
          encoded: `folder:${folderIndex}:${fileIndex}`,
          caseId: item.id,
          caseTitle: item.title,
          client: client?.name || "Клієнт не вказаний",
          responsible: file.responsible || item.responsible || client?.manager || "Не вказано",
          casePriority: item.priority,
          folderName: folder.name,
          sourceLabel: file.source || "Папка справи",
          folderIndex,
          fileIndex
        }))
    );
    return [...proceduralRows, ...folderRows];
  });
}

function documentDueState(ctx, doc = {}) {
  const { parseDisplayDate } = ctx;
  const iso = parseDisplayDate?.(doc.responseDue);
  const waiting = ["Відповідь очікується", "Очікується", "Подано", "В роботі", "Потрібно перевірити"].includes(doc.status);
  if (!iso || !waiting) return { label: "Без строку", tone: "muted", days: Infinity, overdue: false };
  const dueDate = new Date(`${iso}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.ceil((dueDate - today) / 86400000);
  if (days < 0) return { label: `Просрочено на ${Math.abs(days)} дн.`, tone: "red", days, overdue: true };
  if (days === 0) return { label: "Відповідь сьогодні", tone: "amber", days, overdue: false };
  if (days <= 3) return { label: `Залишилось ${days} дн.`, tone: "amber", days, overdue: false };
  return { label: `Залишилось ${days} дн.`, tone: "green", days, overdue: false };
}

function documentCompactStatus(status) {
  const labels = {
    "Відповідь очікується": "Очікується",
    "Потрібно перевірити": "Перевірити"
  };
  return labels[status] || status || "Без статусу";
}

const DOCUMENT_STATUS_OPTIONS = [
  "Чернетка",
  "Не подано",
  "В роботі",
  "Подано",
  "Відповідь очікується",
  "Потрібно перевірити",
  "Отримано",
  "Готово"
];

function documentStatusIconName(status) {
  const icons = {
    "Чернетка": "edit",
    "Не подано": "clock",
    "В роботі": "refresh",
    "Подано": "fileUp",
    "Відповідь очікується": "bell",
    "Потрібно перевірити": "search",
    "Отримано": "file",
    "Готово": "check"
  };
  return icons[status] || "file";
}

function documentStatusUiTone(status) {
  const tones = {
    "Чернетка": "doc-draft",
    "Не подано": "doc-not-submitted",
    "В роботі": "doc-in-work",
    "Подано": "doc-submitted",
    "Відповідь очікується": "doc-waiting",
    "Потрібно перевірити": "doc-review",
    "Отримано": "doc-received",
    "Готово": "doc-ready"
  };
  return tones[status] || "doc-default";
}

function filteredDocuments(ctx, rows) {
  const { state } = ctx;
  const query = (state.documentQuery || "").trim().toLowerCase();
  return rows.filter((doc) => {
    const matchesQuery = !query || [
      doc.name,
      doc.caseId,
      doc.caseTitle,
      doc.client,
      doc.folderName,
      doc.responsible,
      doc.status,
      doc.type
    ].some((value) => String(value || "").toLowerCase().includes(query));
    const matchesStatus = (state.documentStatusFilter || "all") === "all" || doc.status === state.documentStatusFilter;
    const matchesCase = (state.documentCaseFilter || "all") === "all" || doc.caseId === state.documentCaseFilter;
    const matchesType = (state.documentTypeFilter || "all") === "all" || (doc.type || "Інше") === state.documentTypeFilter;
    const matchesClient = (state.documentClientFilter || "all") === "all" || doc.client === state.documentClientFilter;
    const matchesDue = (state.documentDueFilter || "all") === "all" || documentDueState(ctx, doc).overdue;
    const quickFilter = state.documentQuickFilter || "all";
    const matchesQuick =
      quickFilter === "all" ||
      (quickFilter === "submitted" && ["Подано", "Відповідь очікується", "Отримано"].includes(doc.status)) ||
      (quickFilter === "overdue" && documentDueState(ctx, doc).overdue) ||
      (quickFilter === "drafts" && ["Чернетка", "Не подано"].includes(doc.status)) ||
      (quickFilter === "ai" && ["Позов", "Адвокатський запит", "Доказ"].includes(doc.type || ""));
    return matchesQuery && matchesStatus && matchesCase && matchesType && matchesClient && matchesDue && matchesQuick;
  });
}

function openCaseFromDocuments(ctx, caseId) {
  const { state, renderCases, switchView } = ctx;
  state.selectedCaseId = caseId;
  state.caseScreen = "detail";
  state.openCaseSection = "documents";
  renderCases();
  switchView("cases");
}

function payloadFromKey(key) {
  const [caseId, encoded] = key.split("|");
  return { caseId, encoded };
}

function folderKey(caseId, folderName) {
  return `${caseId}|${folderName}`;
}

function activeArchiveSelection(ctx, rows) {
  const { state, caseFolders } = ctx;
  const selectedCaseId = state.documentArchiveCaseId || "all";
  const selectedCase = selectedCaseId === "all" ? null : state.cases.find((item) => item.id === selectedCaseId);
  const folders = selectedCase ? caseFolders(selectedCase) : [];
  const selectedFolderName = state.documentArchiveFolder || "";
  const selectedFolder = selectedFolderName ? folders.find((folder) => folder.name === selectedFolderName) || null : null;
  const visibleRows = rows.filter((doc) => {
    if (!selectedCase) return true;
    if (doc.caseId !== selectedCase.id) return false;
    if (!selectedFolder) return true;
    return doc.folderName === selectedFolder.name;
  });
  return { selectedCase, selectedFolder, visibleRows, isAll: selectedCaseId === "all" };
}

export function renderDocumentsScreen(ctx) {
  const {
    state,
    $,
    icon,
    badge,
    actionMenu,
    bindActionMenus,
    documentStatusTone,
    advocatePhoto,
    caseFolders,
    getDocumentPayload,
    openStoredDocument,
    openDocumentDialog,
    openFolderDialog,
    openDeleteDocumentConfirm,
    bindViewLinks,
    formatDate,
    showToast
  } = ctx;
  const rows = documentRows(ctx).map((doc) => ({ ...doc, dueState: documentDueState(ctx, doc) }));
  const documentKeys = new Set(rows.map((doc) => doc.key));
  state.selectedDocumentKeys = (state.selectedDocumentKeys || []).filter((key) => documentKeys.has(key));
  const statuses = [...new Set(rows.map((doc) => doc.status).filter(Boolean))];
  const types = [...new Set(rows.map((doc) => doc.type || "Інше").filter(Boolean))];
  const clients = [...new Set(rows.map((doc) => doc.client).filter(Boolean))];
  const filtered = filteredDocuments(ctx, rows);
  const archive = activeArchiveSelection(ctx, filtered);
  const tableRows = archive.visibleRows;
  const tableRowKeys = new Set(tableRows.map((doc) => doc.key));
  state.selectedDocumentKeys = (state.selectedDocumentKeys || []).filter((key) => tableRowKeys.has(key));
  const selectedDocumentSet = new Set(state.selectedDocumentKeys || []);
  const selectedDocumentsCount = selectedDocumentSet.size;
  const allDocumentsSelected = Boolean(tableRows.length && selectedDocumentsCount === tableRows.length);
  const someDocumentsSelected = Boolean(selectedDocumentsCount && selectedDocumentsCount < tableRows.length);
  if (tableRows.length && !tableRows.some((doc) => doc.key === state.selectedDocumentKey)) {
    state.selectedDocumentKey = tableRows[0].key;
  }
  if (!tableRows.length && !filtered.some((doc) => doc.key === state.selectedDocumentKey)) {
    state.selectedDocumentKey = filtered[0]?.key || "";
  }
  const selected = tableRows.find((doc) => doc.key === state.selectedDocumentKey) || tableRows[0] || filtered[0] || rows[0];
  const selectedSubmittedIso = selected ? ctx.parseDisplayDate?.(selected.submitted) || "" : "";
  const selectedResponseDueIso = selected ? ctx.parseDisplayDate?.(selected.responseDue) || "" : "";
  const selectedCase = archive.selectedCase?.id || selected?.caseId || state.selectedCaseId || state.cases[0]?.id || "";
  const selectedFolders = selectedCase ? caseFolders(ctx.caseById(selectedCase)) : [];
  const selectedFolderIndex = archive.selectedFolder
    ? selectedFolders.findIndex((folder) => folder.name === archive.selectedFolder.name)
    : -1;
  const submittedCount = rows.filter((doc) => ["Подано", "Відповідь очікується", "Отримано"].includes(doc.status)).length;
  const draftCount = rows.filter((doc) => ["Чернетка", "Не подано"].includes(doc.status)).length;
  const overdueCount = rows.filter((doc) => doc.dueState.overdue).length;
  const aiReadyCount = rows.filter((doc) => ["Позов", "Адвокатський запит", "Доказ"].includes(doc.type || "")).length;
  const quickFilter = state.documentQuickFilter || "all";
  const hasManualDocumentFilters =
    Boolean((state.documentQuery || "").trim()) ||
    (state.documentStatusFilter || "all") !== "all" ||
    (state.documentTypeFilter || "all") !== "all" ||
    (state.documentClientFilter || "all") !== "all" ||
    (state.documentDueFilter || "all") !== "all" ||
    (state.documentCaseFilter || "all") !== "all" ||
    !archive.isAll;
  const allKpiActive = quickFilter === "all" && !hasManualDocumentFilters;
  const archiveTitle = archive.isAll ? "Усі документи" : archive.selectedFolder?.name || "Усі документи справи";
  const archiveSubtitle = archive.isAll
    ? "Архів по всіх справах"
    : `№${archive.selectedCase?.id || selectedCase} · ${archive.selectedCase?.title || "Архів документів"}`;
  const documentsNode = $("#documents");

  documentsNode.innerHTML = `
    <div class="documents-screen">
      <div class="documents-toolbar panel">
        <div>
          <h2>Документи</h2>
          <p>Файли, процесуальні документи та матеріали по всіх справах</p>
        </div>
        <div class="documents-toolbar-actions">
          <button class="secondary" type="button" data-documents-template ${selectedCase ? "" : "disabled"}>${icon("file")} Створити Word</button>
          <button class="secondary" type="button" data-documents-ai ${selected ? "" : "disabled"}>${icon("search")} AI аналіз</button>
          <button class="secondary" type="button" data-documents-add-folder ${selectedCase ? "" : "disabled"}>${icon("file")} Створити папку</button>
          <button class="primary" type="button" data-documents-add ${selectedCase ? "" : "disabled"}>${icon("file")} Додати документ</button>
        </div>
      </div>

      <div class="documents-kpi-grid">
        <button class="panel documents-kpi-card ${allKpiActive ? "active" : ""}" type="button" data-document-kpi="all"><span>${icon("file")}</span><div><strong>${rows.length}</strong><em>Усього документів</em></div></button>
        <button class="panel documents-kpi-card ${quickFilter === "submitted" ? "active" : ""}" type="button" data-document-kpi="submitted"><span class="green">${icon("check")}</span><div><strong>${submittedCount}</strong><em>Подано / отримано</em></div></button>
        <button class="panel documents-kpi-card ${quickFilter === "overdue" ? "active" : ""}" type="button" data-document-kpi="overdue"><span class="red">${icon("bell")}</span><div><strong>${overdueCount}</strong><em>Без відповіді в строк</em></div></button>
        <button class="panel documents-kpi-card ${quickFilter === "drafts" ? "active" : ""}" type="button" data-document-kpi="drafts"><span class="amber">${icon("edit")}</span><div><strong>${draftCount}</strong><em>Чернетки та не подано</em></div></button>
        <button class="panel documents-kpi-card ${quickFilter === "ai" ? "active" : ""}" type="button" data-document-kpi="ai"><span class="violet">${icon("search")}</span><div><strong>${aiReadyCount}</strong><em>Готово для AI/Word</em></div></button>
      </div>

      <div class="documents-filters panel">
        <input type="search" data-document-query placeholder="Пошук документа, справи, клієнта..." value="${state.documentQuery || ""}">
        <select data-document-status>
          <option value="all">Всі статуси</option>
          ${statuses.map((status) => `<option value="${status}" ${state.documentStatusFilter === status ? "selected" : ""}>${status}</option>`).join("")}
        </select>
        <select data-document-type>
          <option value="all">Всі типи</option>
          ${types.map((type) => `<option value="${type}" ${state.documentTypeFilter === type ? "selected" : ""}>${type}</option>`).join("")}
        </select>
        <select data-document-client>
          <option value="all">Всі клієнти</option>
          ${clients.map((client) => `<option value="${client}" ${state.documentClientFilter === client ? "selected" : ""}>${client}</option>`).join("")}
        </select>
        <select data-document-case>
          <option value="all">Всі справи</option>
          ${state.cases.map((item) => `<option value="${item.id}" ${state.documentCaseFilter === item.id ? "selected" : ""}>№${item.id}</option>`).join("")}
        </select>
        <button class="secondary ${state.documentDueFilter === "overdue" ? "active" : ""}" type="button" data-document-due-filter>${icon("bell")} Без відповіді</button>
        <button class="secondary documents-filter-reset" type="button" data-document-reset ${quickFilter === "all" && !hasManualDocumentFilters ? "disabled" : ""}>Скинути</button>
      </div>

      <div class="documents-layout">
        <aside class="documents-archive panel">
          <div class="documents-archive-head">
            <h3>Архів справ</h3>
            <span>${state.cases.length} справ</span>
          </div>
          <div class="documents-tree">
            <button class="documents-all-node ${archive.isAll ? "active" : ""}" type="button" data-document-all-node>
              <span>${icon("file")}</span>
              <strong>Усі документи</strong>
              <em>${filtered.length}</em>
            </button>
            ${state.cases.map((item) => {
              const client = ctx.clientById(item.clientId);
              const folders = caseFolders(item);
              const caseRows = filtered.filter((doc) => doc.caseId === item.id);
              const isOpen = archive.selectedCase?.id === item.id;
              return `
                <div class="documents-tree-case ${isOpen ? "open" : ""}">
                  <button class="documents-case-node ${isOpen && !archive.selectedFolder ? "active" : ""}" type="button" data-document-case-node="${item.id}">
                    <span>${icon("briefcase")}</span>
                    <strong>№${item.id}</strong>
                    <em>${caseRows.length}</em>
                    <b class="documents-case-arrow">›</b>
                    <small>${item.title}</small>
                    <small class="documents-case-client">${client?.name || "Клієнт не вказаний"}</small>
                  </button>
                  ${isOpen ? `<div class="documents-folder-list">
                    ${folders.map((folder) => {
                      const count = filtered.filter((doc) => doc.caseId === item.id && doc.folderName === folder.name).length;
                      const active = archive.selectedCase?.id === item.id && archive.selectedFolder?.name === folder.name;
                      return `
                        <button class="documents-folder-node ${active ? "active" : ""}" type="button" data-document-folder-node="${folderKey(item.id, folder.name)}">
                          ${icon("file")}
                          <span>${folder.name}</span>
                          <em>${count}</em>
                        </button>
                      `;
                    }).join("") || `<p class="documents-tree-empty">Папок ще немає</p>`}
                  </div>` : ""}
                </div>
              `;
            }).join("")}
          </div>
        </aside>

        <section class="panel table-wrap documents-table-card">
          <div class="documents-folder-head">
            <div>
              <h3>${archiveTitle}</h3>
              <p>${archiveSubtitle}</p>
            </div>
            <div class="documents-folder-head-actions">
              <span>${tableRows.length} документів</span>
              ${!archive.isAll ? `<button class="secondary" type="button" data-documents-add-current>${icon("file")} Додати</button>` : ""}
              ${archive.selectedFolder && selectedFolderIndex >= 0 ? `<button class="secondary" type="button" data-documents-edit-folder>${icon("edit")} Папка</button>` : ""}
            </div>
          </div>
          <table class="documents-table">
            <thead>
              <tr>
                <th><span class="document-title-head"><input type="checkbox" data-select-document-page aria-label="Вибрати всі документи в списку" ${allDocumentsSelected ? "checked" : ""} /><span class="document-title-label">Документ</span><span class="tasks-bulk-bar documents-bulk-bar ${selectedDocumentsCount ? "active" : ""}" aria-label="Масові дії документів"><em>${selectedDocumentsCount}</em><button class="task-bulk-icon bulk-work" type="button" data-document-bulk-action="work" data-tooltip="В роботу" aria-label="Позначити документи в роботі">${icon("refresh")}</button><button class="task-bulk-icon bulk-done" type="button" data-document-bulk-action="submitted" data-tooltip="Подано" aria-label="Позначити документи поданими">${icon("check")}</button><button class="task-bulk-icon bulk-planner" type="button" data-document-bulk-action="received" data-tooltip="Отримано" aria-label="Позначити документи отриманими">${icon("file")}</button><button class="task-bulk-icon bulk-delete" type="button" data-document-bulk-action="delete" data-tooltip="Видалити вибрані" aria-label="Видалити вибрані документи">${icon("trash")}</button><button class="task-bulk-icon bulk-clear" type="button" data-document-bulk-action="clear" data-tooltip="Скинути вибір" aria-label="Скинути вибір документів">×</button></span></span></th>
                <th>Справа</th>
                <th>Папка</th>
                <th>Статус</th>
                <th>Строк</th>
                <th>Джерело</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${tableRows.map((doc) => `
                <tr class="${doc.key === state.selectedDocumentKey ? "selected" : ""}" data-document-row="${doc.key}" tabindex="0" aria-selected="${doc.key === state.selectedDocumentKey}">
                  <td>
                    <div class="document-title-cell">
                      <input type="checkbox" data-select-document-row="${doc.key}" ${selectedDocumentSet.has(doc.key) ? "checked" : ""} aria-label="Вибрати документ" />
                      <button class="document-title-button" type="button" data-select-document="${doc.key}">
                        ${icon("file")}
                        <span><strong>${doc.name}</strong><small>${doc.type || "Документ"}</small></span>
                      </button>
                    </div>
                  </td>
                  <td><button class="case-link-button" type="button" data-open-document-case="${doc.caseId}">№${doc.caseId}</button><small>${doc.client}</small></td>
                  <td>${doc.folderName}</td>
                  <td>
                    <span class="document-status-icon ${documentStatusUiTone(doc.status)}" data-tooltip="${doc.status || "Без статусу"}" tabindex="0" role="img" aria-label="Статус: ${doc.status || "Без статусу"}">
                      ${icon(documentStatusIconName(doc.status))}
                    </span>
                  </td>
                  <td><span class="documents-due ${doc.dueState.tone}">${doc.responseDue || "-"}<small>${doc.dueState.label}</small></span></td>
                  <td>${doc.sourceLabel}</td>
                  <td>
                    <div class="documents-row-actions">
                      ${actionMenu([
                        { label: "Відкрити", icon: "eye", attrs: { "data-view-global-document": doc.key, "aria-label": "Відкрити документ" } },
                        { label: "Редагувати", icon: "edit", attrs: { "data-edit-global-document": doc.key, "aria-label": "Редагувати документ" } },
                        { label: "Видалити", icon: "trash", danger: true, attrs: { "data-delete-global-document": doc.key, "aria-label": "Видалити документ" } }
                      ], { label: "Дії документа" })}
                    </div>
                  </td>
                </tr>
              `).join("") || `<tr><td class="empty-cell documents-empty-table-cell" colspan="7">
                <div>
                  <strong>У цій папці документів немає</strong>
                  <span>${archive.selectedFolder ? "Додайте перший документ одразу в цю папку." : "Оберіть папку або додайте документ до справи."}</span>
                  <button class="secondary" type="button" data-documents-add-empty ${selectedCase ? "" : "disabled"}>${icon("file")} Додати документ</button>
                </div>
              </td></tr>`}
            </tbody>
          </table>
        </section>

        <aside class="documents-side panel">
          ${selected ? `
            <div class="documents-side-head">
              <span>${icon("file")}</span>
              <div>
                <h3>${selected.name}</h3>
                <p>№${selected.caseId} · ${selected.client}</p>
              </div>
            </div>
            <div class="documents-status-line">
              <span>Статус</span>
              <details class="document-status-picker ${documentStatusUiTone(selected.status)}" data-document-status-menu>
                <summary>
                  <span>${icon(documentStatusIconName(selected.status))}</span>
                  <strong>${selected.status || "Без статусу"}</strong>
                  <i>⌄</i>
                </summary>
                <div>
                  ${DOCUMENT_STATUS_OPTIONS.map((status) => `
                    <button class="${documentStatusUiTone(status)} ${selected.status === status ? "active" : ""}" type="button" data-document-status-pick="${selected.key}" data-document-status-value="${status}">
                      <span>${icon(documentStatusIconName(status))}</span>
                      <strong>${status}</strong>
                      ${selected.status === status ? `<em>${icon("check")}</em>` : ""}
                    </button>
                  `).join("")}
                </div>
              </details>
            </div>
            <dl class="documents-meta">
              <div><dt>Тип</dt><dd>${selected.type || "Не вказано"}</dd></div>
              <div><dt>Папка</dt><dd>${selected.folderName}</dd></div>
              <div><dt>Відповідальний</dt><dd class="documents-responsible">${advocatePhoto?.(selected.responsible, "mini") || ""}${selected.responsible}</dd></div>
              <div>
                <dt>Дата подання</dt>
                <dd>
                  <input class="documents-date-input" type="date" value="${selectedSubmittedIso}" data-document-date-change="${selected.key}" data-document-date-field="submitted" aria-label="Дата подання документа" />
                </dd>
              </div>
              <div>
                <dt>Строк відповіді</dt>
                <dd>
                  <input class="documents-date-input" type="date" value="${selectedResponseDueIso}" data-document-date-change="${selected.key}" data-document-date-field="responseDue" aria-label="Строк відповіді документа" />
                </dd>
              </div>
              <div><dt>Контроль</dt><dd>${badge(selected.dueState.label, selected.dueState.tone === "muted" ? "blue" : selected.dueState.tone)}</dd></div>
              <div><dt>Джерело</dt><dd>${selected.sourceLabel}</dd></div>
            </dl>
            <p class="documents-comment">${selected.comment || "Коментар по документу ще не додано."}</p>
            <div class="documents-side-actions">
              <button class="primary" type="button" data-view-global-document="${selected.key}">${icon("eye")} Відкрити</button>
              <button class="secondary" type="button" data-edit-global-document="${selected.key}">${icon("edit")} Редагувати</button>
              <button class="secondary" type="button" data-open-document-case="${selected.caseId}">${icon("briefcase")} Справа</button>
              <button class="secondary" type="button" data-documents-ai>${icon("search")} AI перевірка</button>
            </div>
            <div class="documents-ai-card">
              <strong>AI / Word</strong>
              <span>Можна створити чернетку, перевірити реквізити, знайти пропущені додатки і зберегти результат у справу.</span>
            </div>
            <div class="documents-history-card">
              <strong>Останні дії</strong>
              ${(ctx.caseById(selected.caseId)?.history || []).slice(0, 3).map((item) => `<p><span>${item.date}</span>${item.text}</p>`).join("") || `<p><span>Сьогодні</span>Дій по документу ще немає.</p>`}
            </div>
            <div class="documents-folder-summary">
              <strong>${selectedFolders.length}</strong>
              <span>папок у справі</span>
            </div>
          ` : `
            <div class="documents-empty-side">
              ${icon("file")}
              <h3>Документ не вибрано</h3>
              <p>Додайте документ до справи або змініть фільтри.</p>
            </div>
          `}
        </aside>
      </div>
    </div>
  `;

  bindActionMenus?.(documentsNode);
  const selectDocumentPageCheckbox = documentsNode.querySelector("[data-select-document-page]");
  if (selectDocumentPageCheckbox) selectDocumentPageCheckbox.indeterminate = someDocumentsSelected;

  const openDocumentForArchive = () => {
    if (!selectedCase) return;
    openDocumentDialog(selectedCase, null, "documents");
    if (selectedFolderIndex >= 0) {
      const folderSelect = $("#document-folder");
      if (folderSelect) folderSelect.value = String(selectedFolderIndex);
    }
  };

  documentsNode.querySelector("[data-documents-add]")?.addEventListener("click", openDocumentForArchive);
  documentsNode.querySelector("[data-documents-add-current]")?.addEventListener("click", openDocumentForArchive);
  documentsNode.querySelector("[data-documents-add-empty]")?.addEventListener("click", openDocumentForArchive);
  documentsNode.querySelector("[data-documents-add-folder]")?.addEventListener("click", () => {
    if (!selectedCase) return;
    openFolderDialog(selectedCase, null, "documents");
  });
  documentsNode.querySelector("[data-documents-edit-folder]")?.addEventListener("click", () => {
    if (!selectedCase || selectedFolderIndex < 0) return;
    openFolderDialog(selectedCase, selectedFolderIndex, "documents");
  });
  documentsNode.querySelectorAll("[data-documents-template]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!selectedCase) return;
      showToast?.("Шаблон Word підготовлено як демо-дію. Наступний етап — генерація .docx через backend.", "info");
    });
  });
  documentsNode.querySelectorAll("[data-documents-ai]").forEach((button) => {
    button.addEventListener("click", () => {
      showToast?.("AI перевірка документа буде підключена після API для документів.", "info");
    });
  });
  const updateDocumentStatus = (key, nextStatus) => {
    const { caseId, encoded } = payloadFromKey(key);
    const payload = getDocumentPayload(caseId, encoded);
    const today = new Date().toLocaleDateString("uk-UA");
    const update = (target) => {
      if (!target) return;
      target.status = nextStatus;
      target.updated = today;
      if (nextStatus === "Подано" && (!target.submitted || target.submitted === "-")) {
        target.submitted = today;
      }
    };
    update(payload.doc);
    update(payload.file);
    update(payload.linked?.file);
    payload.item?.history?.unshift({
      date: today,
      text: `Статус документа «${payload.doc?.name || payload.file?.name || "Документ"}» змінено на «${nextStatus}».`
    });
    state.selectedDocumentKey = key;
    renderDocumentsScreen(ctx);
    showToast?.("Статус документа оновлено.");
  };
  documentsNode.querySelectorAll("[data-document-status-pick]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      updateDocumentStatus(button.dataset.documentStatusPick, button.dataset.documentStatusValue);
    });
  });
  documentsNode.querySelector("[data-document-status-change]")?.addEventListener("change", (event) => {
    updateDocumentStatus(event.currentTarget.dataset.documentStatusChange, event.currentTarget.value);
  });
  documentsNode.querySelectorAll("[data-document-date-change]").forEach((input) => {
    input.addEventListener("change", (event) => {
      const { caseId, encoded } = payloadFromKey(event.currentTarget.dataset.documentDateChange);
      const payload = getDocumentPayload(caseId, encoded);
      const field = event.currentTarget.dataset.documentDateField;
      const today = new Date().toLocaleDateString("uk-UA");
      const nextValue = event.currentTarget.value ? formatDate(event.currentTarget.value) : "-";
      const update = (target) => {
        if (!target) return;
        target[field] = nextValue;
        target.updated = today;
      };
      update(payload.doc);
      update(payload.file);
      update(payload.linked?.file);
      payload.item?.history?.unshift({
        date: today,
        text: `${field === "submitted" ? "Дату подання" : "Строк відповіді"} документа «${payload.doc?.name || payload.file?.name || "Документ"}» змінено.`
      });
      state.selectedDocumentKey = event.currentTarget.dataset.documentDateChange;
      renderDocumentsScreen(ctx);
      showToast?.(field === "submitted" ? "Дату подання оновлено." : "Строк відповіді оновлено.");
    });
  });
  documentsNode.querySelectorAll("[data-document-kpi]").forEach((button) => {
    button.addEventListener("click", () => {
      state.documentQuickFilter = button.dataset.documentKpi || "all";
      state.documentQuery = "";
      state.documentStatusFilter = "all";
      state.documentTypeFilter = "all";
      state.documentClientFilter = "all";
      state.documentDueFilter = "all";
      state.documentCaseFilter = "all";
      state.documentArchiveCaseId = "all";
      state.documentArchiveFolder = "";
      state.selectedDocumentKey = "";
      state.selectedDocumentKeys = [];
      renderDocumentsScreen(ctx);
    });
  });
  documentsNode.querySelector("[data-document-query]")?.addEventListener("input", (event) => {
    state.documentQuery = event.currentTarget.value;
    state.documentQuickFilter = "all";
    state.documentArchiveCaseId = "all";
    state.documentArchiveFolder = "";
    state.selectedDocumentKeys = [];
    renderDocumentsScreen(ctx);
    const input = documentsNode.querySelector("[data-document-query]");
    input?.focus();
    input?.setSelectionRange(state.documentQuery.length, state.documentQuery.length);
  });
  documentsNode.querySelector("[data-document-status]")?.addEventListener("change", (event) => {
    state.documentQuickFilter = "all";
    state.documentStatusFilter = event.currentTarget.value;
    state.selectedDocumentKeys = [];
    renderDocumentsScreen(ctx);
  });
  documentsNode.querySelector("[data-document-type]")?.addEventListener("change", (event) => {
    state.documentQuickFilter = "all";
    state.documentTypeFilter = event.currentTarget.value;
    state.selectedDocumentKeys = [];
    renderDocumentsScreen(ctx);
  });
  documentsNode.querySelector("[data-document-client]")?.addEventListener("change", (event) => {
    state.documentQuickFilter = "all";
    state.documentClientFilter = event.currentTarget.value;
    state.documentCaseFilter = "all";
    state.documentArchiveCaseId = "all";
    state.documentArchiveFolder = "";
    state.selectedDocumentKey = "";
    state.selectedDocumentKeys = [];
    renderDocumentsScreen(ctx);
  });
  documentsNode.querySelector("[data-document-case]")?.addEventListener("change", (event) => {
    state.documentQuickFilter = "all";
    state.documentCaseFilter = event.currentTarget.value;
    if (event.currentTarget.value !== "all") {
      state.documentArchiveCaseId = event.currentTarget.value;
      state.documentArchiveFolder = "";
    } else {
      state.documentArchiveCaseId = "all";
      state.documentArchiveFolder = "";
    }
    state.selectedDocumentKeys = [];
    renderDocumentsScreen(ctx);
  });
  documentsNode.querySelector("[data-document-due-filter]")?.addEventListener("click", () => {
    state.documentQuickFilter = "all";
    state.documentDueFilter = state.documentDueFilter === "overdue" ? "all" : "overdue";
    state.selectedDocumentKeys = [];
    renderDocumentsScreen(ctx);
  });
  documentsNode.querySelector("[data-document-reset]")?.addEventListener("click", () => {
    state.documentQuickFilter = "all";
    state.documentQuery = "";
    state.documentStatusFilter = "all";
    state.documentTypeFilter = "all";
    state.documentClientFilter = "all";
    state.documentDueFilter = "all";
    state.documentCaseFilter = "all";
    state.documentArchiveCaseId = "all";
    state.documentArchiveFolder = "";
    state.selectedDocumentKey = "";
    state.selectedDocumentKeys = [];
    renderDocumentsScreen(ctx);
  });
  documentsNode.querySelector("[data-select-document-page]")?.addEventListener("click", (event) => event.stopPropagation());
  documentsNode.querySelector("[data-select-document-page]")?.addEventListener("change", (event) => {
    state.selectedDocumentKeys = event.currentTarget.checked ? tableRows.map((doc) => doc.key) : [];
    renderDocumentsScreen(ctx);
  });
  documentsNode.querySelectorAll("[data-select-document-row]").forEach((input) => {
    input.addEventListener("click", (event) => event.stopPropagation());
    input.addEventListener("change", () => {
      const next = new Set(state.selectedDocumentKeys || []);
      if (input.checked) next.add(input.dataset.selectDocumentRow);
      else next.delete(input.dataset.selectDocumentRow);
      state.selectedDocumentKeys = [...next].filter((key) => tableRowKeys.has(key));
      renderDocumentsScreen(ctx);
    });
  });
  documentsNode.querySelectorAll("[data-document-bulk-action]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const action = button.dataset.documentBulkAction;
      if (action === "clear") {
        state.selectedDocumentKeys = [];
        renderDocumentsScreen(ctx);
        showToast?.("Вибір документів скинуто.");
        return;
      }
      const selectedKeys = state.selectedDocumentKeys || [];
      if (!selectedKeys.length) return;
      const today = new Date().toLocaleDateString("uk-UA");
      if (action === "delete") {
        const payloads = selectedKeys.map((key) => {
          const { caseId, encoded } = payloadFromKey(key);
          return getDocumentPayload(caseId, encoded);
        });
        const deletedNames = [];
        payloads.forEach((payload) => {
          if (!payload?.item) return;
          const documentsToDelete = new Set([payload.doc].filter(Boolean));
          const filesToDelete = new Set([payload.file, payload.linked?.file].filter(Boolean));
          deletedNames.push(payload.doc?.name || payload.file?.name || "Документ");
          payload.item.documents = (payload.item.documents || []).filter((doc) => !documentsToDelete.has(doc));
          caseFolders(payload.item).forEach((folder) => {
            folder.files = (folder.files || []).filter((file) => !filesToDelete.has(file));
            folder.updated = today;
          });
          payload.item.history?.unshift({
            date: today,
            text: `Масово видалено документ: ${payload.doc?.name || payload.file?.name || "Документ"}.`
          });
        });
        state.selectedDocumentKeys = [];
        state.selectedDocumentKey = "";
        renderDocumentsScreen(ctx);
        showToast?.(`Видалено ${deletedNames.length} документів.`, "danger");
        return;
      }
      const statusByAction = {
        work: "В роботі",
        submitted: "Подано",
        received: "Отримано"
      };
      const nextStatus = statusByAction[action];
      selectedKeys.forEach((key) => {
        const { caseId, encoded } = payloadFromKey(key);
        const payload = getDocumentPayload(caseId, encoded);
        const update = (target) => {
          if (!target) return;
          target.status = nextStatus;
          target.updated = today;
          if (nextStatus === "Подано" && (!target.submitted || target.submitted === "-")) {
            target.submitted = today;
          }
        };
        update(payload.doc);
        update(payload.file);
        update(payload.linked?.file);
        payload.item?.history?.unshift({
          date: today,
          text: `Масово змінено статус документа «${payload.doc?.name || payload.file?.name || "Документ"}» на «${nextStatus}».`
        });
      });
      state.selectedDocumentKeys = [];
      renderDocumentsScreen(ctx);
      showToast?.(`Оновлено ${selectedKeys.length} документів.`);
    });
  });
  documentsNode.querySelectorAll("[data-select-document]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedDocumentKey = button.dataset.selectDocument;
      renderDocumentsScreen(ctx);
    });
  });
  documentsNode.querySelectorAll("[data-document-row]").forEach((row) => {
    const selectRow = () => {
      state.selectedDocumentKey = row.dataset.documentRow;
      renderDocumentsScreen(ctx);
    };
    row.addEventListener("click", (event) => {
      if (event.target.closest("button, a, input, select, textarea, .row-action-menu-wrap")) return;
      selectRow();
    });
    row.addEventListener("keydown", (event) => {
      if (!["Enter", " "].includes(event.key)) return;
      event.preventDefault();
      selectRow();
    });
    row.addEventListener("dblclick", (event) => {
      if (event.target.closest("button, a, input, select, textarea, .row-action-menu-wrap")) return;
      const { caseId, encoded } = payloadFromKey(row.dataset.documentRow);
      const payload = getDocumentPayload(caseId, encoded);
      openStoredDocument(payload.file || payload.doc, {
        caseId,
        editContext: payload,
        folderName: payload.folder?.name || payload.linked?.folder?.name,
        returnView: "documents"
      });
    });
  });
  documentsNode.querySelector("[data-document-all-node]")?.addEventListener("click", () => {
    state.documentArchiveCaseId = "all";
    state.documentArchiveFolder = "";
    state.documentCaseFilter = "all";
    state.selectedDocumentKey = "";
    state.selectedDocumentKeys = [];
    renderDocumentsScreen(ctx);
  });
  documentsNode.querySelectorAll("[data-document-case-node]").forEach((button) => {
    button.addEventListener("click", () => {
      state.documentArchiveCaseId = button.dataset.documentCaseNode;
      state.documentArchiveFolder = "";
      state.documentCaseFilter = "all";
      state.selectedDocumentKey = "";
      state.selectedDocumentKeys = [];
      renderDocumentsScreen(ctx);
    });
  });
  documentsNode.querySelectorAll("[data-document-folder-node]").forEach((button) => {
    button.addEventListener("click", () => {
      const [caseId, ...folderParts] = button.dataset.documentFolderNode.split("|");
      state.documentArchiveCaseId = caseId;
      state.documentArchiveFolder = folderParts.join("|");
      state.documentCaseFilter = "all";
      state.selectedDocumentKey = "";
      state.selectedDocumentKeys = [];
      renderDocumentsScreen(ctx);
    });
  });
  documentsNode.querySelectorAll("[data-open-document-case]").forEach((button) => {
    button.addEventListener("click", () => openCaseFromDocuments(ctx, button.dataset.openDocumentCase));
  });
  documentsNode.querySelectorAll("[data-view-global-document]").forEach((button) => {
    button.addEventListener("click", () => {
      const { caseId, encoded } = payloadFromKey(button.dataset.viewGlobalDocument);
      const payload = getDocumentPayload(caseId, encoded);
      openStoredDocument(payload.file || payload.doc, {
        caseId,
        editContext: payload,
        folderName: payload.folder?.name || payload.linked?.folder?.name,
        returnView: "documents"
      });
    });
  });
  documentsNode.querySelectorAll("[data-edit-global-document]").forEach((button) => {
    button.addEventListener("click", () => {
      const { caseId, encoded } = payloadFromKey(button.dataset.editGlobalDocument);
      openDocumentDialog(caseId, getDocumentPayload(caseId, encoded), "documents");
    });
  });
  documentsNode.querySelectorAll("[data-delete-global-document]").forEach((button) => {
    button.addEventListener("click", () => {
      const { caseId, encoded } = payloadFromKey(button.dataset.deleteGlobalDocument);
      const payload = getDocumentPayload(caseId, encoded);
      if (payload.source === "procedural") {
        openDeleteDocumentConfirm({ caseId, docIndex: payload.docIndex, type: "procedural", returnView: "documents" });
        return;
      }
      openDeleteDocumentConfirm({
        caseId,
        folderIndex: payload.folderIndex,
        fileIndex: payload.fileIndex,
        type: "folderFile",
        returnView: "documents"
      });
    });
  });
  bindViewLinks?.();
}
