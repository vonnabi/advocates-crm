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
  showToast
}) {
  function openClientDialog(clientId = null) {
    const form = $("#client-form");
    form.reset();
    form.elements.clientId.value = "";
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

  function openStoredDocument(documentData) {
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

  function openDocumentDialog(caseId, editContext = null) {
    const form = $("#document-form");
    form.reset();
    form.elements.caseId.value = caseId;
    const item = caseById(caseId);
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

  function openTaskDialog(caseId, taskIndex = null, returnView = null) {
    const form = $("#task-form");
    form.reset();
    form.dataset.originalCaseId = caseId || "";
    $("#task-case-select").innerHTML = state.cases.map((item) => `<option value="${item.id}">№${item.id} · ${item.title}</option>`).join("");
    form.elements.caseId.value = caseId;
    form.elements.taskIndex.value = "";
    state.taskDialogReturnView = returnView || ($("#tasks")?.classList.contains("active") ? "tasks" : "cases");
    form.elements.showInCalendar.checked = true;
    $("#task-dialog-title").textContent = "Нова задача";
    $("#task-submit-button").textContent = "Додати задачу";
    if (taskIndex !== null) {
      const task = caseById(caseId)?.tasks[taskIndex];
      if (!task) return;
      form.elements.taskIndex.value = taskIndex;
      form.elements.title.value = task.title;
      form.elements.status.value = task.status;
      form.elements.responsible.value = task.responsible || caseById(caseId)?.responsible || "Іваненко А.Ю.";
      form.elements.due.value = parseDisplayDate(task.due);
      form.elements.showInCalendar.checked = Boolean(task.showInCalendar);
      $("#task-dialog-title").textContent = "Редагувати задачу";
      $("#task-submit-button").textContent = "Зберегти задачу";
    }
    $("#task-dialog").showModal();
  }

  function openEventDialog(context = {}, actionIndex = null) {
    const form = $("#event-form");
    form.reset();
    $("#event-client").innerHTML = state.clients.map((client) => `<option value="${client.id}">${client.name}</option>`).join("");
    $("#event-case").innerHTML = state.cases.map((item) => `<option value="${item.id}">№${item.id} · ${item.title}</option>`).join("");
    form.elements.caseId.value = context.caseId || state.selectedCaseId || state.cases[0]?.id || "";
    form.elements.actionIndex.value = "";
    form.elements.eventId.value = "";
    $("#event-dialog h2").textContent = "Нова подія";
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
    }
    $("#event-case").onchange = (event) => {
      const selectedCase = caseById(event.currentTarget.value);
      if (selectedCase) form.elements.client.value = selectedCase.clientId;
    };
    $("#event-dialog").showModal();
  }

  function openFolderDialog(caseId, folderIndex = null) {
    const form = $("#folder-form");
    form.reset();
    form.elements.caseId.value = caseId;
    form.elements.folderIndex.value = "";
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
    openEventDialog,
    openFolderDialog,
    openDeleteDocumentConfirm
  };
}
