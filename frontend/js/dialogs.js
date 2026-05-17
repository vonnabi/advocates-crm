import { deleteCaseFromApi, deleteClientFromApi, deleteDocumentFromApi, deleteEventFromApi, deleteTaskFromApi, shouldUseApi } from "./api.js";

const DIALOG_CLOSE_BUTTONS = [
  ["#client-dialog-close", "#client-dialog"],
  ["#case-dialog-close", "#case-dialog"],
  ["#essence-dialog-close", "#essence-dialog"],
  ["#authority-dialog-close", "#authority-dialog"],
  ["#finance-dialog-close", "#finance-dialog"],
  ["#finance-action-dialog-close", "#finance-action-dialog"],
  ["#salary-dialog-close", "#salary-dialog"],
  ["#document-dialog-close", "#document-dialog"],
  ["#document-preview-close", "#document-preview-dialog"],
  ["#task-dialog-close", "#task-dialog"],
  ["#subtask-dialog-close", "#subtask-dialog"],
  ["#event-dialog-close", "#event-dialog"],
  ["#folder-dialog-close", "#folder-dialog"]
];

function closeDeleteDocumentConfirm({ state, $ }) {
  state.pendingDocumentDelete = null;
  $("#delete-document-dialog").close();
}

async function confirmDelete(ctx) {
  const { state, $, caseById, caseFolders, caseProceduralItems, calendarEntries, renderAll, switchView, showToast } = ctx;
  const pending = state.pendingDocumentDelete;
  if (!pending) return;
  const item = caseById(pending.caseId);
  const today = new Date().toLocaleDateString("uk-UA");
  let deleted;
  const documentApiId = (document) => {
    const id = document?.id || document?.documentId;
    const number = Number(id);
    return Number.isInteger(number) && number > 0 ? number : "";
  };
  if (pending.type === "client") {
    const clientId = Number(pending.clientId);
    const clientIndex = state.clients.findIndex((client) => client.id === clientId);
    if (clientIndex < 0) return;
    if (shouldUseApi(state)) {
      try {
        await deleteClientFromApi(clientId);
      } catch (_error) {
        showToast("Не вдалося видалити клієнта з бази.", "danger");
        return;
      }
    }
    deleted = state.clients.splice(clientIndex, 1)[0];
    const deletedCaseIds = new Set(state.cases.filter((caseItem) => caseItem.clientId === clientId).map((caseItem) => caseItem.id));
    if (deletedCaseIds.size) {
      state.cases = state.cases.filter((caseItem) => !deletedCaseIds.has(caseItem.id));
      state.events = state.events.filter((event) => event.clientId !== clientId && !deletedCaseIds.has(event.caseId));
    }
    state.selectedClientId = state.clients[0]?.id || 0;
    state.selectedCaseId = state.cases[0]?.id || "";
    state.caseScreen = "list";
  } else if (pending.type === "case") {
    const caseIndex = state.cases.findIndex((caseItem) => caseItem.id === pending.caseId);
    if (caseIndex < 0) return;
    if (shouldUseApi(state)) {
      try {
        await deleteCaseFromApi(pending.caseId);
      } catch (_error) {
        showToast("Не вдалося видалити справу з бази.", "danger");
        return;
      }
    }
    deleted = state.cases.splice(caseIndex, 1)[0];
    state.selectedCaseId = state.cases[0]?.id || "";
    state.caseScreen = "list";
  } else if (pending.type === "procedural") {
    const doc = item.documents[pending.docIndex];
    const apiId = documentApiId(doc);
    if (shouldUseApi(state) && apiId) {
      try {
        await deleteDocumentFromApi(apiId);
      } catch (_error) {
        showToast("Не вдалося видалити документ з бази.", "danger");
        return;
      }
    }
    deleted = item.documents.splice(pending.docIndex, 1)[0];
    if (deleted?.documentId) {
      caseFolders(item).forEach((folder) => {
        folder.files = (folder.files || []).filter((file) => file.documentId !== deleted.documentId);
      });
    }
  } else if (pending.type === "folder") {
    const folders = caseFolders(item);
    const folder = folders[pending.folderIndex];
    if (shouldUseApi(state)) {
      const ids = (folder?.files || []).map((file) => {
        const linkedDoc = item.documents.find((doc) => doc.documentId && doc.documentId === file.documentId);
        return documentApiId(file) || documentApiId(linkedDoc);
      }).filter(Boolean);
      try {
        await Promise.all([...new Set(ids)].map((id) => deleteDocumentFromApi(id)));
      } catch (_error) {
        showToast("Не вдалося видалити документи папки з бази.", "danger");
        return;
      }
    }
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
    const task = item.tasks[pending.taskIndex];
    if (shouldUseApi(state) && task?.id) {
      try {
        await deleteTaskFromApi(task.id);
      } catch (_error) {
        showToast("Не вдалося видалити задачу з бази.", "danger");
        return;
      }
    }
    deleted = item.tasks.splice(pending.taskIndex, 1)[0];
  } else if (pending.type === "proceduralAction") {
    item.proceduralActions = caseProceduralItems(item);
    deleted = item.proceduralActions.splice(pending.actionIndex, 1)[0];
  } else if (pending.type === "calendarEvent") {
    const eventIndex = state.events.findIndex((event) => `event-${event.id}` === pending.eventId);
    if (eventIndex < 0) return;
    if (shouldUseApi(state)) {
      try {
        await deleteEventFromApi(state.events[eventIndex].id);
      } catch (_error) {
        showToast("Не вдалося видалити подію з бази.", "danger");
        return;
      }
    }
    deleted = state.events.splice(eventIndex, 1)[0];
    state.selectedEventId = calendarEntries()[0]?.id || "";
  } else {
    const folder = caseFolders(item)[pending.folderIndex];
    const file = folder?.files[pending.fileIndex];
    const linkedDoc = item.documents.find((doc) => doc.documentId && doc.documentId === file?.documentId);
    const apiId = documentApiId(file) || documentApiId(linkedDoc);
    if (shouldUseApi(state) && apiId) {
      try {
        await deleteDocumentFromApi(apiId);
      } catch (_error) {
        showToast("Не вдалося видалити документ з бази.", "danger");
        return;
      }
    }
    deleted = folder.files.splice(pending.fileIndex, 1)[0];
    if (linkedDoc) {
      item.documents = item.documents.filter((doc) => doc !== linkedDoc);
    }
    folder.updated = today;
  }
  if (pending.type !== "case" && pending.type !== "calendarEvent" && pending.type !== "client") {
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
  showToast(
    pending.type === "case"
      ? "Справу видалено."
      : pending.type === "calendarEvent"
        ? "Подію видалено з календаря."
        : pending.type === "client"
          ? `Клієнта ${deleted.name} видалено.`
          : "Елемент видалено.",
    "danger"
  );
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
