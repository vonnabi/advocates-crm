export function createDialogOpeners({
  state,
  $,
  clientById,
  caseById,
  caseFinance,
  caseFolders,
  caseProceduralItems,
  calendarEntries,
  calendarEventMeta,
  renderAll,
  switchView,
  showToast
}) {
  function escapeHtml(value = "") {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function openClientDialog(clientId = null) {
    const form = $("#client-form");
    form.reset();
    form.elements.clientId.value = "";
    form.elements.showPhoto.checked = false;
    form.elements.photoUrl.value = "";
    $("#client-dialog-title").textContent = "Новий клієнт";

    if (clientId !== null && clientId !== undefined) {
      const client = clientById(clientId);
      if (!client) {
        $("#client-dialog").showModal();
        return;
      }
      form.elements.clientId.value = client.id;
      form.elements.name.value = client.name;
      form.elements.phone.value = client.phone;
      form.elements.email.value = client.email;
      form.elements.address.value = client.address || "";
      form.elements.telegramUsername.value = client.telegramUsername || "";
      form.elements.showPhoto.checked = Boolean(client.showPhoto && client.photoUrl);
      form.elements.photoUrl.value = client.photoUrl || "";
      form.elements.request.value = client.request;
      form.elements.status.value = client.status;
      form.elements.source.value = client.source;
      form.elements.manager.value = client.manager;
      $("#client-dialog-title").textContent = "Редагувати клієнта";
    }

    $("#client-dialog").showModal();
  }

  function parseDisplayDate(displayDate) {
    if (!displayDate || displayDate === "Не вказано") return "";
    const [day, month, yearWithTime] = displayDate.split(".");
    const year = yearWithTime?.split(" ")[0];
    if (!day || !month || !year) return "";
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  function openCaseDialog(caseId = null) {
    const form = $("#case-form");
    form.reset();
    $("#case-client").innerHTML = state.clients.map((client) => `<option value="${client.id}">${client.name}</option>`).join("");
    form.elements.caseId.value = "";
    form.elements.stage.value = "Первинна консультація";
    $("#case-dialog-title").textContent = "Нова справа";
    $("#case-submit-button").textContent = "Створити справу";

    if (caseId !== null && caseId !== undefined) {
      const item = caseById(caseId);
      if (!item) {
        $("#case-dialog").showModal();
        return;
      }
      form.elements.caseId.value = item.id;
      form.elements.clientId.value = item.clientId;
      form.elements.title.value = item.title;
      form.elements.type.value = item.type;
      form.elements.stage.value = item.stage;
      form.elements.status.value = item.status;
      form.elements.deadline.value = parseDisplayDate(item.deadline);
      form.elements.priority.value = item.priority;
      form.elements.responsible.value = item.responsible;
      $("#case-dialog-title").textContent = "Редагувати справу";
      $("#case-submit-button").textContent = "Зберегти справу";
    }

    $("#case-dialog").showModal();
  }

  function openEssenceDialog(caseId) {
    const item = caseById(caseId);
    if (!item) return;
    const form = $("#essence-form");
    form.reset();
    form.elements.caseId.value = item.id;
    form.elements.description.value = item.description || "";
    $("#essence-dialog").showModal();
  }

  function openAuthorityDialog(caseId) {
    const item = caseById(caseId);
    if (!item) return;
    const form = $("#authority-form");
    form.reset();
    form.elements.caseId.value = item.id;
    form.elements.court.value = item.court === "Не вказано" ? "" : item.court;
    form.elements.authorityType.value = item.authorityType || "";
    form.elements.authorityAddress.value = item.authorityAddress || "";
    form.elements.authorityContact.value = item.authorityContact || "";
    $("#authority-dialog").showModal();
  }

  function openFinanceDialog(caseId) {
    const item = caseById(caseId);
    if (!item) return;
    const form = $("#finance-form");
    const finance = caseFinance(item);
    form.reset();
    form.elements.caseId.value = item.id;
    form.elements.totalFee.value = finance.total || "";
    form.elements.paid.value = finance.paid || "";
    form.elements.firstPaymentDate.value = parseDisplayDate(item.firstPaymentDate);
    form.elements.nextPaymentDue.value = parseDisplayDate(item.nextPaymentDue);
    form.elements.financeComment.value = item.financeComment || "";
    $("#finance-dialog").showModal();
  }

  function findFolderFileByDocument(item, doc) {
    const folders = caseFolders(item);
    if (doc?.documentId) {
      for (let folderIndex = 0; folderIndex < folders.length; folderIndex += 1) {
        const fileIndex = folders[folderIndex].files.findIndex((file) => file.documentId === doc.documentId);
        if (fileIndex >= 0) return { folder: folders[folderIndex], folderIndex, file: folders[folderIndex].files[fileIndex], fileIndex };
      }
    }
    for (let folderIndex = 0; folderIndex < folders.length; folderIndex += 1) {
      const fileIndex = folders[folderIndex].files.findIndex((file) => file.name === doc?.name);
      if (fileIndex >= 0) return { folder: folders[folderIndex], folderIndex, file: folders[folderIndex].files[fileIndex], fileIndex };
    }
    return null;
  }

  function getDocumentPayload(caseId, encoded) {
    const item = caseById(caseId);
    const [source, first, second] = encoded.split(":");
    if (source === "procedural") {
      const docIndex = Number(first);
      return { item, source, docIndex, doc: item.documents[docIndex], linked: findFolderFileByDocument(item, item.documents[docIndex]) };
    }
    const folderIndex = Number(first);
    const fileIndex = Number(second);
    const folder = caseFolders(item)[folderIndex];
    const file = folder?.files[fileIndex];
    const docIndex = file?.documentId
      ? item.documents.findIndex((doc) => doc.documentId === file.documentId)
      : item.documents.findIndex((doc) => doc.name === file?.name);
    return { item, source, folderIndex, fileIndex, folder, file, docIndex, doc: item.documents[docIndex] };
  }

  function openDocumentFile(documentData) {
    if (!documentData) return;
    if (documentData.url) {
      window.open(documentData.url, "_blank", "noopener");
      return;
    }
    if (documentData.fileObject) {
      window.open(URL.createObjectURL(documentData.fileObject), "_blank", "noopener");
      return;
    }
    showToast(`Для документа «${documentData.name}» пока нет файла или ссылки.`, "warning");
  }

  function openStoredDocument(documentData, previewContext = {}) {
    if (!documentData) return;
    const dialog = $("#document-preview-dialog");
    const content = $("#document-preview-content");
    const title = $("#document-preview-title");
    const fileButton = $("#document-preview-file");
    const editButton = $("#document-preview-edit");
    const caseButton = $("#document-preview-case");
    if (!dialog || !content || !title || !fileButton || !editButton || !caseButton) {
      openDocumentFile(documentData);
      return;
    }
    const item = previewContext.caseId ? caseById(previewContext.caseId) : previewContext.item || null;
    const client = item ? clientById(item.clientId) : null;
    const folderName = previewContext.folderName || previewContext.editContext?.folder?.name || previewContext.editContext?.linked?.folder?.name || "Не вказано";
    const hasFile = Boolean(documentData.url || documentData.fileObject);
    const fileName = documentData.fileName || (documentData.fileObject && documentData.fileObject.name) || "";
    const source = documentData.source || (documentData.url ? "Посилання" : fileName ? "Файл" : "Опис без файлу");
    title.textContent = documentData.name || "Документ";
    content.innerHTML = `
      <div class="document-preview-hero ${hasFile ? "has-file" : ""}">
        <span aria-hidden="true">${hasFile ? "PDF" : "DOC"}</span>
        <div>
          <strong>${escapeHtml(documentData.name || "Документ")}</strong>
          <p>${escapeHtml(item ? `№${item.id} · ${client?.name || "Клієнт не вказаний"}` : "Документ без прив'язки до справи")}</p>
        </div>
      </div>
      <dl class="document-preview-meta">
        <div><dt>Справа</dt><dd>${escapeHtml(item ? `№${item.id}` : "Не вказано")}</dd></div>
        <div><dt>Клієнт</dt><dd>${escapeHtml(client?.name || "Не вказано")}</dd></div>
        <div><dt>Папка</dt><dd>${escapeHtml(folderName)}</dd></div>
        <div><dt>Тип</dt><dd>${escapeHtml(documentData.type || "Не вказано")}</dd></div>
        <div><dt>Статус</dt><dd>${escapeHtml(documentData.status || "Без статусу")}</dd></div>
        <div><dt>Дата подання</dt><dd>${escapeHtml(documentData.submitted || "-")}</dd></div>
        <div><dt>Строк відповіді</dt><dd>${escapeHtml(documentData.responseDue || "-")}</dd></div>
        <div><dt>Джерело</dt><dd>${escapeHtml(source)}</dd></div>
      </dl>
      <div class="document-preview-file-state ${hasFile ? "ready" : "empty"}">
        <strong>${hasFile ? "Файл готовий до відкриття" : "Файл ще не додано"}</strong>
        <span>${escapeHtml(hasFile ? (fileName || documentData.url || "Документ має посилання або файл") : "Додайте файл або посилання, щоб кнопка відкривала реальний PDF, Word чи скан.")}</span>
      </div>
      <div class="document-preview-comment">
        <strong>Коментар</strong>
        <p>${escapeHtml(documentData.comment || "Коментар по документу ще не додано.")}</p>
      </div>
    `;
    fileButton.disabled = !hasFile;
    fileButton.textContent = hasFile ? "Відкрити файл" : "Файл не додано";
    fileButton.onclick = () => openDocumentFile(documentData);
    editButton.disabled = !previewContext.caseId || !previewContext.editContext;
    editButton.textContent = hasFile ? "Редагувати" : "Додати файл";
    editButton.onclick = () => {
      if (!previewContext.caseId || !previewContext.editContext) return;
      dialog.close();
      openDocumentDialog(previewContext.caseId, previewContext.editContext, previewContext.returnView || "documents");
    };
    caseButton.disabled = !item;
    caseButton.onclick = () => {
      if (!item) return;
      dialog.close();
      state.selectedCaseId = item.id;
      state.caseScreen = "detail";
      state.openCaseSection = "documents";
      renderAll?.();
      switchView?.("cases");
    };
    dialog.showModal();
  }

  function openDocumentDialog(caseId, editContext = null, returnView = null) {
    const form = $("#document-form");
    form.reset();
    form.elements.caseId.value = caseId;
    const item = caseById(caseId);
    state.documentDialogReturnView = returnView || ($("#documents")?.classList.contains("active") ? "documents" : "cases");
    $("#document-folder").innerHTML = [
      ...caseFolders(item).map((folder, index) => `<option value="${index}">${folder.name}</option>`),
      `<option value="__new__">+ Создать новую папку</option>`
    ].join("");
    form.elements.editSource.value = "";
    form.elements.docIndex.value = "";
    form.elements.folderIndex.value = "";
    form.elements.fileIndex.value = "";
    $("#document-dialog-title").textContent = "Новий документ";
    $("#document-submit-button").textContent = "Додати документ";

    if (editContext) {
      const data = editContext.file || editContext.doc;
      const linked = editContext.linked || (editContext.doc ? findFolderFileByDocument(item, editContext.doc) : null);
      form.elements.editSource.value = editContext.source;
      form.elements.docIndex.value = editContext.docIndex ?? "";
      form.elements.folderIndex.value = editContext.folderIndex ?? linked?.folderIndex ?? "";
      form.elements.fileIndex.value = editContext.fileIndex ?? linked?.fileIndex ?? "";
      form.elements.name.value = data?.name || "";
      form.elements.url.value = data?.url || "";
      form.elements.type.value = data?.type || "Інше";
      form.elements.submitted.value = parseDisplayDate(data?.submitted);
      form.elements.responseDue.value = parseDisplayDate(data?.responseDue);
      form.elements.status.value = data?.status || "Чернетка";
      form.elements.comment.value = data?.comment || "";
      form.elements.folder.value = String(editContext.folderIndex ?? linked?.folderIndex ?? 0);
      $("#document-dialog-title").textContent = "Редагувати документ";
      $("#document-submit-button").textContent = "Зберегти документ";
    }
    $("#document-dialog").showModal();
  }

  function taskPriority(task = {}) {
    if (task.priority) return task.priority;
    if (["Терміново", "Срочно"].includes(task.status)) return "Високий";
    if (["Не терміново", "Не срочно"].includes(task.status)) return "Низький";
    return "Середній";
  }

  function setCoexecutorChecks(form, values = []) {
    const normalized = Array.isArray(values)
      ? values
      : String(values || "").split(",").map((value) => value.trim()).filter(Boolean);
    form.querySelectorAll('input[name="coexecutors"]').forEach((input) => {
      input.checked = normalized.includes(input.value);
    });
    syncCoexecutorSummary(form);
  }

  function syncCoexecutorSummary(form) {
    const selected = [...form.querySelectorAll('input[name="coexecutors"]:checked')].map((input) => input.value);
    const summary = form.querySelector("[data-coexecutors-summary]");
    if (!summary) return;
    summary.textContent = selected.length
      ? selected.length === 1
        ? selected[0]
        : `Обрано: ${selected.length}`
      : "Не обрано";
  }

  function subtaskStatusTone(status = "") {
    const text = String(status).toLowerCase();
    if (text.includes("викон")) return "green";
    if (text.includes("перевір") || text.includes("очіку")) return "amber";
    if (text.includes("робот") || text.includes("нов")) return "blue";
    return "blue";
  }

  function updateSubtaskStatusTone(select) {
    if (!select) return;
    select.className = `task-status-select task-subtask-status-select tone-${subtaskStatusTone(select.value)}`;
  }

  function subtaskEditorRow(subtask = {}) {
    const title = escapeHtml(subtask.title || "");
    const status = subtask.status || "Нова";
    return `
      <div class="task-subtask-editor-row">
        <input name="subtaskTitle" value="${title}" placeholder="Назва підзадачі" />
        <select name="subtaskStatus" class="task-status-select task-subtask-status-select tone-${subtaskStatusTone(status)}">
          ${["Нова", "В роботі", "На перевірці", "Очікує", "Виконано"].map((item) => `<option value="${item}" ${status === item ? "selected" : ""}>${item}</option>`).join("")}
        </select>
        <button type="button" data-remove-subtask-row aria-label="Видалити підзадачу">×</button>
      </div>
    `;
  }

  function renderTaskSubtaskEditor(form, subtasks = []) {
    const editor = form.querySelector("#task-subtasks-editor");
    if (!editor) return;
    editor.innerHTML = subtasks.length
      ? subtasks.map((subtask) => subtaskEditorRow(subtask)).join("")
      : `<p class="task-subtasks-editor-empty">Підзадач ще немає. Додайте першу підзадачу нижче.</p>`;
  }

  function defaultTaskSubtasks(task = {}) {
    return [
      { title: "Перевірити вихідні матеріали", status: task.status === "Виконано" ? "Виконано" : "В роботі" },
      { title: "Підготувати результат по задачі", status: task.status === "Виконано" ? "Виконано" : "Нова" }
    ];
  }

  function appendSubtaskRow(form, subtask = { status: "Нова" }) {
    const editor = form.querySelector("#task-subtasks-editor");
    if (!editor) return;
    editor.querySelector(".task-subtasks-editor-empty")?.remove();
    editor.insertAdjacentHTML("beforeend", subtaskEditorRow(subtask));
    editor.querySelector(".task-subtask-editor-row:last-child input")?.focus();
  }

  function openSubtaskDialog(caseId, taskIndex, subtaskIndex = null, returnView = null) {
    const item = caseById(caseId);
    const task = item?.tasks?.[taskIndex];
    if (!item || !task) return;
    const form = $("#subtask-form");
    form.reset();
    state.taskDialogReturnView = returnView || ($("#tasks")?.classList.contains("active") ? "tasks" : "cases");
    form.elements.caseId.value = caseId;
    form.elements.taskIndex.value = taskIndex;
    form.elements.subtaskIndex.value = subtaskIndex === null || subtaskIndex === undefined ? "" : subtaskIndex;
    form.elements.status.value = "Нова";
    form.elements.responsible.value = task.responsible || item.responsible || "Іваненко А.Ю.";
    form.elements.due.value = parseDisplayDate(task.due);
    $("#subtask-parent-title").textContent = task.title || "Основна задача";
    $("#subtask-parent-case").textContent = `№${item.id} · ${item.title}`;
    $("#subtask-dialog-title").textContent = "Додати підзадачу";
    $("#subtask-submit-button").textContent = "Додати підзадачу";

    if (subtaskIndex !== null && subtaskIndex !== undefined) {
      const subtasks = task.subtasks?.length ? task.subtasks : defaultTaskSubtasks(task);
      const subtask = subtasks[Number(subtaskIndex)];
      if (!subtask) return;
      form.elements.title.value = subtask.title || "";
      form.elements.status.value = subtask.status || "Нова";
      form.elements.responsible.value = subtask.responsible || task.responsible || item.responsible || "Іваненко А.Ю.";
      form.elements.due.value = parseDisplayDate(subtask.due);
      $("#subtask-dialog-title").textContent = "Редагувати підзадачу";
      $("#subtask-submit-button").textContent = "Зберегти підзадачу";
    }

    updateSubtaskStatusTone(form.elements.status);
    form.elements.status.onchange = () => updateSubtaskStatusTone(form.elements.status);
    $("#subtask-dialog").showModal();
    form.elements.title.focus();
  }

  function openTaskDialog(caseId, taskIndex = null, returnView = null, options = {}) {
    const form = $("#task-form");
    form.reset();
    const subtaskMode = options.subtaskMode || "";
    form.dataset.originalCaseId = caseId || "";
    $("#task-case-select").innerHTML = state.cases.map((item) => `<option value="${item.id}">№${item.id} · ${item.title}</option>`).join("");
    form.elements.caseId.value = caseId;
    form.elements.taskIndex.value = "";
    state.taskDialogReturnView = returnView || ($("#tasks")?.classList.contains("active") ? "tasks" : "cases");
    form.elements.showInCalendar.checked = true;
    form.elements.plannerManual.checked = returnView === "planner";
    form.elements.plannerImportant.checked = false;
    form.elements.priority.value = "Середній";
    form.elements.status.value = returnView === "planner" ? "Заплановано" : "Нова";
    form.elements.responsible.value = caseById(caseId)?.responsible || "Іваненко А.Ю.";
    form.elements.reminderEnabled.checked = returnView === "planner";
    form.elements.reminderBefore.value = "За 1 день";
    form.elements.reminderChannel.value = "CRM";
    form.elements.plannerDate.value = "";
    form.elements.plannerTime.value = "";
    setCoexecutorChecks(form, []);
    renderTaskSubtaskEditor(form, []);
    form.querySelector("#task-add-subtask").onclick = () => appendSubtaskRow(form);
    form.querySelector("#task-subtasks-editor").onclick = (event) => {
      const button = event.target.closest("[data-remove-subtask-row]");
      if (!button) return;
      button.closest(".task-subtask-editor-row")?.remove();
      if (!form.querySelector(".task-subtask-editor-row")) renderTaskSubtaskEditor(form, []);
    };
    form.querySelector("#task-subtasks-editor").onchange = (event) => {
      if (event.target.matches('select[name="subtaskStatus"]')) updateSubtaskStatusTone(event.target);
    };
    form.querySelector(".task-coexecutors-picker")?.removeAttribute("open");
    form.querySelector(".task-coexecutors-menu").onchange = () => syncCoexecutorSummary(form);
    $("#task-dialog-title").textContent = "Нова задача";
    $("#task-submit-button").textContent = "Додати задачу";
    if (taskIndex !== null) {
      const task = caseById(caseId)?.tasks[taskIndex];
      if (!task) return;
      form.elements.taskIndex.value = taskIndex;
      form.elements.title.value = task.title;
      form.elements.description.value = task.description || "";
      form.elements.status.value = task.status;
      form.elements.priority.value = taskPriority(task);
      form.elements.responsible.value = task.responsible || caseById(caseId)?.responsible || "Іваненко А.Ю.";
      form.elements.due.value = parseDisplayDate(task.due);
      form.elements.plannerDate.value = task.plannerDate || parseDisplayDate(task.plannerDateText || "");
      form.elements.plannerTime.value = task.plannerTime || "";
      setCoexecutorChecks(form, task.coexecutors || []);
      renderTaskSubtaskEditor(form, task.subtasks || defaultTaskSubtasks(task));
      form.elements.showInCalendar.checked = Boolean(task.showInCalendar);
      form.elements.plannerManual.checked = Boolean(task.plannerManual);
      form.elements.plannerImportant.checked = Boolean(task.plannerImportant);
      form.elements.reminderEnabled.checked = Boolean(task.reminderEnabled);
      form.elements.reminderBefore.value = task.reminderBefore || "За 1 день";
      form.elements.reminderChannel.value = task.reminderChannel || "CRM";
      form.elements.comment.value = task.comment || "";
      $("#task-dialog-title").textContent = subtaskMode === "new"
        ? "Додати підзадачу"
        : subtaskMode === "edit"
          ? "Редагувати підзадачу"
          : "Редагувати задачу";
      $("#task-submit-button").textContent = subtaskMode ? "Зберегти підзадачі" : "Зберегти задачу";
      if (subtaskMode === "new") appendSubtaskRow(form);
    }
    $("#task-dialog").showModal();
  }

  function openEventDialog(context = {}, actionIndex = null) {
    const form = $("#event-form");
    form.reset();
    $("#event-client").innerHTML = state.clients.map((client) => `<option value="${client.id}">${client.name}</option>`).join("");
    $("#event-case").innerHTML = state.cases.map((item) => `<option value="${item.id}">№${item.id} · ${item.title}</option>`).join("");
    const initialCaseId = context.caseId || state.selectedCaseId || state.cases[0]?.id || "";
    const initialCase = caseById(initialCaseId);
    form.elements.caseId.value = initialCaseId;
    form.elements.actionIndex.value = "";
    form.elements.eventId.value = "";
    form.elements.date.value = state.calendarDate || "2024-05-15";
    form.elements.time.value = "09:00";
    form.elements.endTime.value = "10:00";
    form.elements.status.value = "Заплановано";
    form.elements.type.value = "Судове засідання";
    form.elements.authority.value = initialCase?.court === "Не вказано" ? "" : initialCase?.court || "";
    form.elements.location.value = initialCase?.authorityAddress || "";
    form.elements.responsible.value = initialCase?.responsible || "Іваненко А.Ю.";
    form.elements.recurrence.value = "Не повторювати";
    form.elements.reminderBefore.value = "За 1 день";
    form.elements.reminderChannels.value = "CRM + Telegram + SMS";
    form.elements.reminderRecipients.value = "Відповідальний юрист + клієнт";
    $("#event-dialog h2").textContent = "Нова подія";
    $("#event-submit-button").textContent = "Додати подію";
    if (context.clientId) {
      form.elements.client.value = context.clientId;
    } else {
      const selectedCase = caseById(form.elements.caseId.value);
      if (selectedCase) form.elements.client.value = selectedCase.clientId;
    }
    if (context.eventId) {
      const sourceEvent = calendarEntries().find((item) => item.id === context.eventId);
      if (!sourceEvent || sourceEvent.source === "task") return;
      const meta = calendarEventMeta(sourceEvent);
      form.elements.eventId.value = sourceEvent.id;
      form.elements.title.value = sourceEvent.title || "";
      form.elements.type.value = sourceEvent.type || "Судове засідання";
      form.elements.date.value = sourceEvent.date || "";
      form.elements.time.value = sourceEvent.time || "09:00";
      form.elements.endTime.value = meta.endTime || "";
      form.elements.status.value = sourceEvent.status || "Заплановано";
      form.elements.client.value = sourceEvent.clientId;
      form.elements.caseId.value = sourceEvent.caseId;
      form.elements.authority.value = sourceEvent.authority || "";
      form.elements.location.value = sourceEvent.location || "";
      form.elements.responsible.value = meta.responsible;
      form.elements.recurrence.value = meta.recurrence;
      form.elements.reminderBefore.value = meta.reminderBefore;
      form.elements.reminderChannels.value = meta.reminderChannels;
      form.elements.reminderRecipients.value = meta.reminderRecipients;
      form.elements.description.value = sourceEvent.description || "";
      $("#event-dialog h2").textContent = "Редагувати подію";
      $("#event-submit-button").textContent = "Зберегти подію";
    }
    if (actionIndex !== null && context.caseId) {
      const action = caseProceduralItems(caseById(context.caseId))[actionIndex];
      if (!action || Array.isArray(action)) return;
      form.elements.actionIndex.value = actionIndex;
      form.elements.title.value = action.action || "";
      form.elements.date.value = parseDisplayDate(action.initiated);
      form.elements.time.value = action.time || "09:00";
      form.elements.due.value = parseDisplayDate(action.due);
      form.elements.status.value = action.status || "Заплановано";
      form.elements.description.value = action.description || "";
      $("#event-dialog h2").textContent = "Редагувати процесуальну дію";
      $("#event-submit-button").textContent = "Зберегти дію";
    }
    $("#event-case").onchange = (event) => {
      const selectedCase = caseById(event.currentTarget.value);
      if (!selectedCase) return;
      form.elements.client.value = selectedCase.clientId;
      form.elements.authority.value = selectedCase.court === "Не вказано" ? "" : selectedCase.court || "";
      form.elements.location.value = selectedCase.authorityAddress || "";
      form.elements.responsible.value = selectedCase.responsible || form.elements.responsible.value;
    };
    $("#event-client").onchange = (event) => {
      const clientCase = state.cases.find((item) => item.clientId === Number(event.currentTarget.value));
      if (clientCase) {
        form.elements.caseId.value = clientCase.id;
        form.elements.authority.value = clientCase.court === "Не вказано" ? "" : clientCase.court || "";
        form.elements.location.value = clientCase.authorityAddress || "";
        form.elements.responsible.value = clientCase.responsible || form.elements.responsible.value;
      }
    };
    $("#event-dialog").showModal();
  }

  function openFolderDialog(caseId, folderIndex = null, returnView = null) {
    const form = $("#folder-form");
    form.reset();
    form.elements.caseId.value = caseId;
    form.elements.folderIndex.value = "";
    state.folderDialogReturnView = returnView || ($("#documents")?.classList.contains("active") ? "documents" : "cases");
    $("#folder-dialog-title").textContent = "Нова папка";
    $("#folder-submit-button").textContent = "Створити папку";
    if (folderIndex !== null) {
      const folder = caseFolders(caseById(caseId))[folderIndex];
      if (!folder) return;
      form.elements.folderIndex.value = folderIndex;
      form.elements.name.value = folder.name;
      $("#folder-dialog-title").textContent = "Редагувати папку";
      $("#folder-submit-button").textContent = "Зберегти папку";
    }
    $("#folder-dialog").showModal();
  }

  function openDeleteDocumentConfirm(payload) {
    const item = caseById(payload.caseId);
    if (payload.type === "client") {
      const client = state.clients.find((clientItem) => clientItem.id === Number(payload.clientId));
      if (!client) return;
      const relatedCases = state.cases.filter((caseItem) => caseItem.clientId === client.id);
      state.pendingDocumentDelete = payload;
      $("#delete-document-title").textContent = "Видалити клієнта?";
      $("#delete-document-text").textContent = relatedCases.length
        ? `Клієнт «${client.name}» має ${relatedCases.length} пов'язані справи. Разом із клієнтом буде видалено ці демо-справи та події.`
        : `Ви впевнені, що хочете видалити клієнта «${client.name}»?`;
      $("#delete-document-confirm").textContent = "Так, видалити";
      $("#delete-document-dialog").showModal();
      return;
    }
    if (payload.type === "case") {
      if (!item) return;
      state.pendingDocumentDelete = payload;
      $("#delete-document-title").textContent = "Удалить справу?";
      $("#delete-document-text").textContent = `Вы уверены, что хотите удалить справу №${item.id} «${item.title}»?`;
      $("#delete-document-confirm").textContent = "Да, удалить";
      $("#delete-document-dialog").showModal();
      return;
    }
    if (payload.type === "folder") {
      const folder = caseFolders(item)[payload.folderIndex];
      if (!folder) return;
      state.pendingDocumentDelete = payload;
      $("#delete-document-title").textContent = "Удалить папку?";
      $("#delete-document-text").textContent = `Вы уверены, что хотите удалить папку «${folder.name}» и ${folder.files.length} файл(ов) внутри?`;
      $("#delete-document-confirm").textContent = "Да, удалить";
      $("#delete-document-dialog").showModal();
      return;
    }
    if (payload.type === "task") {
      const task = item.tasks[payload.taskIndex];
      if (!task) return;
      state.pendingDocumentDelete = payload;
      $("#delete-document-title").textContent = "Удалить задачу?";
      $("#delete-document-text").textContent = `Вы уверены, что хотите удалить задачу «${task.title}»?`;
      $("#delete-document-confirm").textContent = "Да, удалить";
      $("#delete-document-dialog").showModal();
      return;
    }
    if (payload.type === "proceduralAction") {
      const action = caseProceduralItems(item)[payload.actionIndex];
      if (!action || Array.isArray(action)) return;
      state.pendingDocumentDelete = payload;
      $("#delete-document-title").textContent = "Удалить процессуальную дію?";
      $("#delete-document-text").textContent = `Вы уверены, что хотите удалить процессуальную дію «${action.action}»?`;
      $("#delete-document-confirm").textContent = "Да, удалить";
      $("#delete-document-dialog").showModal();
      return;
    }
    if (payload.type === "calendarEvent") {
      const eventItem = state.events.find((event) => `event-${event.id}` === payload.eventId);
      if (!eventItem) return;
      state.pendingDocumentDelete = payload;
      $("#delete-document-title").textContent = "Удалить подію?";
      $("#delete-document-text").textContent = `Вы уверены, что хотите удалить подію «${eventItem.title}»?`;
      $("#delete-document-confirm").textContent = "Да, удалить";
      $("#delete-document-dialog").showModal();
      return;
    }
    const file = payload.type === "procedural"
      ? item.documents[payload.docIndex]
      : caseFolders(item)[payload.folderIndex]?.files[payload.fileIndex];
    if (!file) return;
    state.pendingDocumentDelete = payload;
    $("#delete-document-title").textContent = "Удалить документ?";
    $("#delete-document-text").textContent = `Вы уверены, что хотите удалить документ «${file.name}»?`;
    $("#delete-document-confirm").textContent = "Да, удалить";
    $("#delete-document-dialog").showModal();
  }

  return {
    openClientDialog,
    parseDisplayDate,
    openCaseDialog,
    openEssenceDialog,
    openAuthorityDialog,
    openFinanceDialog,
    findFolderFileByDocument,
    getDocumentPayload,
    openStoredDocument,
    openDocumentDialog,
    openTaskDialog,
    openSubtaskDialog,
    openEventDialog,
    openFolderDialog,
    openDeleteDocumentConfirm
  };
}
