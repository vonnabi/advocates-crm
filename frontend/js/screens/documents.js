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
          folderName: folder.name,
          sourceLabel: file.source || "Папка справи",
          folderIndex,
          fileIndex
        }))
    );
    return [...proceduralRows, ...folderRows];
  });
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
      doc.status,
      doc.type
    ].some((value) => String(value || "").toLowerCase().includes(query));
    const matchesStatus = (state.documentStatusFilter || "all") === "all" || doc.status === state.documentStatusFilter;
    const matchesCase = (state.documentCaseFilter || "all") === "all" || doc.caseId === state.documentCaseFilter;
    return matchesQuery && matchesStatus && matchesCase;
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

export function renderDocumentsScreen(ctx) {
  const {
    state,
    $,
    icon,
    badge,
    documentStatusTone,
    caseFolders,
    getDocumentPayload,
    openStoredDocument,
    openDocumentDialog,
    openFolderDialog,
    openDeleteDocumentConfirm,
    bindViewLinks
  } = ctx;
  const rows = documentRows(ctx);
  const statuses = [...new Set(rows.map((doc) => doc.status).filter(Boolean))];
  const filtered = filteredDocuments(ctx, rows);
  if (!filtered.some((doc) => doc.key === state.selectedDocumentKey)) {
    state.selectedDocumentKey = filtered[0]?.key || "";
  }
  const selected = filtered.find((doc) => doc.key === state.selectedDocumentKey) || filtered[0] || rows[0];
  const selectedCase = selected?.caseId || state.selectedCaseId || state.cases[0]?.id || "";
  const selectedFolders = selectedCase ? caseFolders(ctx.caseById(selectedCase)) : [];
  const documentsNode = $("#documents");

  documentsNode.innerHTML = `
    <div class="documents-screen">
      <div class="documents-toolbar panel">
        <div>
          <h2>Документи</h2>
          <p>Файли, процесуальні документи та матеріали по всіх справах</p>
        </div>
        <div class="documents-toolbar-actions">
          <button class="secondary" type="button" data-documents-add-folder ${selectedCase ? "" : "disabled"}>${icon("file")} Створити папку</button>
          <button class="primary" type="button" data-documents-add ${selectedCase ? "" : "disabled"}>${icon("file")} Додати документ</button>
        </div>
      </div>

      <div class="documents-filters panel">
        <input type="search" data-document-query placeholder="Пошук документа, справи, клієнта..." value="${state.documentQuery || ""}">
        <select data-document-status>
          <option value="all">Всі статуси</option>
          ${statuses.map((status) => `<option value="${status}" ${state.documentStatusFilter === status ? "selected" : ""}>${status}</option>`).join("")}
        </select>
        <select data-document-case>
          <option value="all">Всі справи</option>
          ${state.cases.map((item) => `<option value="${item.id}" ${state.documentCaseFilter === item.id ? "selected" : ""}>№${item.id}</option>`).join("")}
        </select>
      </div>

      <div class="documents-layout">
        <section class="panel table-wrap documents-table-card">
          <table class="documents-table">
            <thead>
              <tr>
                <th>Документ</th>
                <th>Справа</th>
                <th>Папка</th>
                <th>Статус</th>
                <th>Джерело</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${filtered.map((doc) => `
                <tr class="${doc.key === state.selectedDocumentKey ? "selected" : ""}" data-document-row="${doc.key}">
                  <td>
                    <button class="document-title-button" type="button" data-select-document="${doc.key}">
                      ${icon("file")}
                      <span><strong>${doc.name}</strong><small>${doc.type || "Документ"}</small></span>
                    </button>
                  </td>
                  <td><button class="case-link-button" type="button" data-open-document-case="${doc.caseId}">№${doc.caseId}</button><small>${doc.client}</small></td>
                  <td>${doc.folderName}</td>
                  <td>${badge(doc.status || "Без статусу", documentStatusTone(doc.status))}</td>
                  <td>${doc.sourceLabel}</td>
                  <td>
                    <div class="documents-row-actions">
                      <button type="button" data-view-global-document="${doc.key}" title="Відкрити документ" aria-label="Відкрити документ">${icon("eye")}</button>
                      <button type="button" data-edit-global-document="${doc.key}" title="Редагувати документ" aria-label="Редагувати документ">${icon("edit")}</button>
                      <button class="danger-icon" type="button" data-delete-global-document="${doc.key}" title="Видалити документ" aria-label="Видалити документ">${icon("trash")}</button>
                    </div>
                  </td>
                </tr>
              `).join("") || `<tr><td class="empty-cell" colspan="6">Документів за цими фільтрами немає</td></tr>`}
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
            <div class="documents-status-line">${badge(selected.status || "Без статусу", documentStatusTone(selected.status))}</div>
            <dl class="documents-meta">
              <div><dt>Тип</dt><dd>${selected.type || "Не вказано"}</dd></div>
              <div><dt>Папка</dt><dd>${selected.folderName}</dd></div>
              <div><dt>Дата подання</dt><dd>${selected.submitted || "-"}</dd></div>
              <div><dt>Строк відповіді</dt><dd>${selected.responseDue || "-"}</dd></div>
              <div><dt>Джерело</dt><dd>${selected.sourceLabel}</dd></div>
            </dl>
            <p class="documents-comment">${selected.comment || "Коментар по документу ще не додано."}</p>
            <div class="documents-side-actions">
              <button class="primary" type="button" data-view-global-document="${selected.key}">${icon("eye")} Відкрити</button>
              <button class="secondary" type="button" data-edit-global-document="${selected.key}">${icon("edit")} Редагувати</button>
              <button class="secondary" type="button" data-open-document-case="${selected.caseId}">${icon("briefcase")} Справа</button>
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

  documentsNode.querySelector("[data-documents-add]")?.addEventListener("click", () => {
    if (!selectedCase) return;
    openDocumentDialog(selectedCase, null, "documents");
  });
  documentsNode.querySelector("[data-documents-add-folder]")?.addEventListener("click", () => {
    if (!selectedCase) return;
    openFolderDialog(selectedCase, null, "documents");
  });
  documentsNode.querySelector("[data-document-query]")?.addEventListener("input", (event) => {
    state.documentQuery = event.currentTarget.value;
    renderDocumentsScreen(ctx);
  });
  documentsNode.querySelector("[data-document-status]")?.addEventListener("change", (event) => {
    state.documentStatusFilter = event.currentTarget.value;
    renderDocumentsScreen(ctx);
  });
  documentsNode.querySelector("[data-document-case]")?.addEventListener("change", (event) => {
    state.documentCaseFilter = event.currentTarget.value;
    renderDocumentsScreen(ctx);
  });
  documentsNode.querySelectorAll("[data-select-document]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedDocumentKey = button.dataset.selectDocument;
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
      openStoredDocument(payload.file || payload.doc);
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
