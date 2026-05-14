const DIALOG_CLOSE_BUTTONS = [
  ["#client-dialog-close", "#client-dialog"],
  ["#case-dialog-close", "#case-dialog"],
  ["#essence-dialog-close", "#essence-dialog"],
  ["#authority-dialog-close", "#authority-dialog"],
  ["#finance-dialog-close", "#finance-dialog"],
  ["#finance-action-dialog-close", "#finance-action-dialog"],
  ["#salary-dialog-close", "#salary-dialog"],
  ["#document-dialog-close", "#document-dialog"],
  ["#task-dialog-close", "#task-dialog"],
  ["#event-dialog-close", "#event-dialog"],
  ["#folder-dialog-close", "#folder-dialog"]
];

function closeDeleteDocumentConfirm({ state, $ }) {
  state.pendingDocumentDelete = null;
  $("#delete-document-dialog").close();
}

function confirmDelete(ctx) {
  const { state, $, caseById, caseFolders, caseProceduralItems, calendarEntries, renderAll, switchView, showToast } = ctx;
  const pending = state.pendingDocumentDelete;
  if (!pending) return;
  const item = caseById(pending.caseId);
  const today = new Date().toLocaleDateString("uk-UA");
  let deleted;
  if (pending.type === "case") {
    const caseIndex = state.cases.findIndex((caseItem) => caseItem.id === pending.caseId);
    deleted = state.cases.splice(caseIndex, 1)[0];
    state.selectedCaseId = state.cases[0]?.id || "";
    state.caseScreen = "list";
  } else if (pending.type === "procedural") {
    deleted = item.documents.splice(pending.docIndex, 1)[0];
  } else if (pending.type === "folder") {
    const folders = caseFolders(item);
    deleted = folders.splice(pending.folderIndex, 1)[0];
    const deletedIds = new Set((deleted?.files || []).map((file) => file.documentId).filter(Boolean));
    if (deletedIds.size) {
      item.documents = item.documents.filter((doc) => !deletedIds.has(doc.documentId));
    }
    if (state.openFolderIndex === pending.folderIndex) {
      state.openFolderIndex = null;
    } else if (state.openFolderIndex > pending.folderIndex) {
      state.openFolderIndex -= 1;
    }
  } else if (pending.type === "task") {
    deleted = item.tasks.splice(pending.taskIndex, 1)[0];
  } else if (pending.type === "proceduralAction") {
    item.proceduralActions = caseProceduralItems(item);
    deleted = item.proceduralActions.splice(pending.actionIndex, 1)[0];
  } else if (pending.type === "calendarEvent") {
    const eventIndex = state.events.findIndex((event) => `event-${event.id}` === pending.eventId);
    deleted = state.events.splice(eventIndex, 1)[0];
    state.selectedEventId = calendarEntries()[0]?.id || "";
  } else {
    const folder = caseFolders(item)[pending.folderIndex];
    deleted = folder.files.splice(pending.fileIndex, 1)[0];
    folder.updated = today;
  }
  if (pending.type !== "case" && pending.type !== "calendarEvent") {
    item.history.unshift({
      date: today,
      text: pending.type === "folder"
        ? `Видалено папку документів: ${deleted.name}.`
        : pending.type === "task"
          ? `Видалено задачу: ${deleted.title}.`
          : pending.type === "proceduralAction"
            ? `Видалено процесуальну дію: ${deleted.action}.`
            : `Видалено документ: ${deleted.name}.`
    });
  }
  const returnView = pending.returnView || "cases";
  state.pendingDocumentDelete = null;
  $("#delete-document-dialog").close();
  renderAll();
  switchView(returnView);
  showToast(pending.type === "case" ? "Справу видалено." : pending.type === "calendarEvent" ? "Подію видалено з календаря." : "Елемент видалено.", "danger");
}

export function setupDialogControls(ctx) {
  const { $ } = ctx;
  DIALOG_CLOSE_BUTTONS.forEach(([buttonSelector, dialogSelector]) => {
    $(buttonSelector)?.addEventListener("click", () => {
      $(dialogSelector)?.close();
    });
  });
  $("#delete-document-close")?.addEventListener("click", () => closeDeleteDocumentConfirm(ctx));
  $("#delete-document-cancel")?.addEventListener("click", () => closeDeleteDocumentConfirm(ctx));
  $("#delete-document-confirm")?.addEventListener("click", () => confirmDelete(ctx));
}
