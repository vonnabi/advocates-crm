import { deleteCaseFromApi, deleteClientFromApi, deleteDocumentFromApi, deleteEventFromApi, deleteTaskFromApi, saveArchiveFoldersToApi, saveCaseToApi, shouldUseApi } from "./api.js";
import { normalizeCase } from "./state.js";

const SNAPSHOT_STORAGE_KEY = "advocates-crm-snapshot";

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
  ["#document-export-close", "#document-export-dialog"],
  ["#office-editor-close", "#office-editor-dialog"],
  ["#task-dialog-close", "#task-dialog"],
  ["#subtask-dialog-close", "#subtask-dialog"],
  ["#event-dialog-close", "#event-dialog"],
  ["#folder-dialog-close", "#folder-dialog"]
];

function closeDeleteDocumentConfirm({ state, $ }) {
  state.pendingDocumentDelete = null;
  $("#delete-document-dialog").close();
}

function findArchiveFolderById(folders = [], id) {
  for (const folder of folders || []) {
    if (folder.id === id) return folder;
    const nested = findArchiveFolderById(folder.children || [], id);
    if (nested) return nested;
  }
  return null;
}

function folderByPath(folders = [], path = []) {
  let list = folders;
  let current = null;
  for (const index of path || []) {
    current = list?.[Number(index)];
    if (!current) return null;
    list = current.children || [];
  }
  return current;
}

function removeDocumentEverywhere(item, caseFolders, documentId, fallbackName = "") {
  const comparableId = String(documentId || "");
  const comparableName = String(fallbackName || "").trim().toLowerCase();
  const matches = (entry = {}) => {
    const entryId = String(entry.documentId || entry.id || "");
    const entryName = String(entry.name || entry.title || "").trim().toLowerCase();
    return Boolean(comparableId && entryId === comparableId)
      || Boolean(comparableName && entryName === comparableName);
  };
  item.documents = (item.documents || []).filter((doc) => !matches(doc));
  const cleanFolders = (folders = []) => folders.forEach((folder) => {
    folder.files = (folder.files || []).filter((file) => !matches(file));
    cleanFolders(folder.children || []);
  });
  cleanFolders(caseFolders(item));
}

function removeFinanceOperationsForDocuments(state, documents = [], fallbackNames = []) {
  const documentIds = new Set(documents
    .map((document) => String(document?.documentId || document?.id || "").trim())
    .filter(Boolean));
  const names = new Set([
    ...documents.map((document) => String(document?.name || document?.title || "").trim().toLowerCase()),
    ...fallbackNames.map((name) => String(name || "").trim().toLowerCase())
  ].filter(Boolean));
  state.financeOperations = (state.financeOperations || []).filter((operation = {}) => {
    const operationDocumentId = String(operation.documentId || "").trim();
    if (operationDocumentId && documentIds.has(operationDocumentId)) return false;
    if (operation.id?.startsWith("document-") && documentIds.has(operation.id.replace("document-", ""))) return false;
    const operationTitle = String(operation.title || "").trim().toLowerCase();
    const operationType = String(operation.type || "").trim().toLowerCase();
    if (!operationTitle || !["рахунок", "акт"].includes(operationType)) return true;
    return ![...names].some((name) => name.includes(operationTitle));
  });
}

function findDocumentInFolders(folders = [], documentId = "", fallbackName = "") {
  const comparableId = String(documentId || "");
  const comparableName = String(fallbackName || "").trim().toLowerCase();
  for (const folder of folders) {
    const file = (folder.files || []).find((entry) => {
      const entryId = String(entry.documentId || entry.id || "");
      const entryName = String(entry.name || entry.title || "").trim().toLowerCase();
      return Boolean(comparableId && entryId === comparableId)
        || Boolean(comparableName && entryName === comparableName);
    });
    if (file) return { folder, file };
    const nested = findDocumentInFolders(folder.children || [], documentId, fallbackName);
    if (nested) return nested;
  }
  return null;
}

export function persistSnapshotState(state) {
  if (state.dataSource !== "snapshot") return;
  try {
    const current = JSON.parse(localStorage.getItem(SNAPSHOT_STORAGE_KEY) || "{}");
    localStorage.setItem(SNAPSHOT_STORAGE_KEY, JSON.stringify({
      ...current,
      clients: state.clients || [],
      cases: state.cases || [],
      events: state.events || [],
      financeOperations: state.financeOperations || [],
      finance: state.finance || {},
      mailing: {
        templates: state.mailingTemplates || current.mailing?.templates || [],
        campaigns: state.mailingCampaigns || current.mailing?.campaigns || [],
        automationRules: state.mailingAutomationRules || current.mailing?.automationRules || [],
        testContacts: state.mailingTestContacts || current.mailing?.testContacts || []
      },
      auditLogs: state.auditLogs || current.auditLogs || [],
      updatedAt: new Date().toISOString()
    }));
  } catch (error) {
    console.warn("Snapshot persistence after delete failed.", error);
  }
}

async function confirmDelete(ctx) {
  const { state, $, caseById, caseFolders, caseProceduralItems, calendarEntries, renderAll, switchView, showToast } = ctx;
  const pending = state.pendingDocumentDelete;
  if (!pending) {
    showToast("Немає вибраного елемента для видалення.", "danger");
    return;
  }
  // Standalone (Документообіг) document stored in the archive tree, with no case context.
  if (pending.storageFolderId !== undefined && pending.storageFolderId !== null && pending.storageFolderId !== "") {
    const apiIdOf = (doc) => {
      const number = Number(doc?.id || doc?.documentId);
      return Number.isInteger(number) && number > 0 ? number : "";
    };
    const apiId = apiIdOf(pending.doc) || apiIdOf(pending.file) || apiIdOf({ documentId: pending.documentId });
    if (shouldUseApi(state) && apiId) {
      try {
        await deleteDocumentFromApi(apiId);
      } catch (_error) {
        console.warn("Standalone document API delete failed, removing local copy too.", _error);
      }
    }
    const folder = findArchiveFolderById(state.documentArchiveFolders || [], pending.storageFolderId);
    let removed;
    if (folder && Array.isArray(folder.documents)) {
      const target = pending.doc || pending.file;
      let removeIndex = Number.isInteger(pending.storageIndex) ? pending.storageIndex : -1;
      if (target) {
        const byRef = folder.documents.indexOf(target);
        if (byRef >= 0) {
          removeIndex = byRef;
        } else {
          const tid = String(apiId || target.documentId || target.id || "");
          const tname = String(target.name || target.title || "").trim().toLowerCase();
          const byMatch = folder.documents.findIndex((doc) =>
            (tid && String(doc.id || doc.documentId || "") === tid)
            || (tname && String(doc.name || doc.title || "").trim().toLowerCase() === tname));
          if (byMatch >= 0) removeIndex = byMatch;
        }
      }
      if (removeIndex >= 0 && removeIndex < folder.documents.length) {
        removed = folder.documents.splice(removeIndex, 1)[0];
      }
    }
    if (shouldUseApi(state)) {
      try {
        await saveArchiveFoldersToApi(state.documentArchiveFolders || []);
      } catch (_error) {
        console.warn("Archive folders sync after delete failed.", _error);
      }
    }
    persistSnapshotState(state);
    state.pendingDocumentDelete = null;
    $("#delete-document-dialog").close();
    renderAll();
    switchView(pending.returnView || "documents");
    showToast(removed ? "Документ видалено." : "Документ видалено з бази.", "success");
    return;
  }
  const needsCaseContext = !["client", "clients", "calendarEvent"].includes(pending.type);
  const item = needsCaseContext ? caseById(pending.caseId) : null;
  if (needsCaseContext && !item) {
    showToast("Не вдалося знайти справу для видалення.", "danger");
    return;
  }
  if (item) item.history = item.history || [];
  const today = new Date().toLocaleDateString("uk-UA");
  let deleted;
  let deletedCount = 0;
  const documentApiId = (document) => {
    const id = document?.id || document?.documentId;
    const number = Number(id);
    return Number.isInteger(number) && number > 0 ? number : "";
  };
  const deleteClientsFromState = (clientIds = []) => {
    const idSet = new Set(clientIds.map((id) => String(id)).filter(Boolean));
    const deletedClients = state.clients.filter((client) => idSet.has(String(client.id)));
    const deletedCaseIds = new Set(
      state.cases
        .filter((caseItem) => idSet.has(String(caseItem.clientId)))
        .map((caseItem) => String(caseItem.id))
    );
    state.clients = state.clients.filter((client) => !idSet.has(String(client.id)));
    state.cases = state.cases.filter((caseItem) => !idSet.has(String(caseItem.clientId)));
    state.events = state.events.filter((event) => !idSet.has(String(event.clientId)) && !deletedCaseIds.has(String(event.caseId)));
    state.financeOperations = (state.financeOperations || [])
      .filter((operation) => !idSet.has(String(operation.clientId)) && !deletedCaseIds.has(String(operation.caseId)));
    state.selectedClientKeys = (state.selectedClientKeys || []).filter((id) => !idSet.has(String(id)));
    if (idSet.has(String(state.selectedClientId))) state.selectedClientId = state.clients[0]?.id || 0;
    if (deletedCaseIds.has(String(state.selectedCaseId))) state.selectedCaseId = state.cases[0]?.id || "";
    const pageSize = Number(state.clientPageSize || 10) || 10;
    const maxPage = Math.max(1, Math.ceil((state.clients.length || 0) / pageSize));
    state.clientPage = Math.min(Math.max(1, Number(state.clientPage || 1) || 1), maxPage);
    state.caseScreen = "list";
    return deletedClients;
  };
  try {
  if (pending.type === "client") {
    const clientId = Number(pending.clientId);
    if (!state.clients.some((client) => String(client.id) === String(clientId))) return;
    if (shouldUseApi(state)) {
      try {
        await deleteClientFromApi(clientId);
      } catch (_error) {
        showToast("Не вдалося видалити клієнта з бази.", "danger");
        return;
      }
    }
    const deletedClients = deleteClientsFromState([clientId]);
    deleted = deletedClients[0];
    deletedCount = deletedClients.length;
  } else if (pending.type === "clients") {
    const clientIds = (pending.clientIds || []).map(Number).filter(Boolean);
    if (!clientIds.length) return;
    if (shouldUseApi(state)) {
      try {
        await Promise.all(clientIds.map((clientId) => deleteClientFromApi(clientId)));
      } catch (_error) {
        showToast("Не вдалося видалити вибраних клієнтів з бази.", "danger");
        return;
      }
    }
    const deletedClients = deleteClientsFromState(clientIds);
    deleted = deletedClients[0];
    deletedCount = deletedClients.length;
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
    state.financeOperations = (state.financeOperations || []).filter((operation) => operation.caseId !== pending.caseId);
    state.events = (state.events || []).filter((event) => event.caseId !== pending.caseId);
    state.selectedCaseId = state.cases[0]?.id || "";
    state.caseScreen = "list";
  } else if (pending.type === "procedural") {
    const doc = item.documents[pending.docIndex];
    const apiId = documentApiId(doc);
    if (shouldUseApi(state) && apiId) {
      try {
        await deleteDocumentFromApi(apiId);
      } catch (_error) {
        console.warn("Document API delete failed, removing local copies too.", _error);
      }
    }
    deleted = doc;
    removeFinanceOperationsForDocuments(state, [doc], [pending.documentName]);
    removeDocumentEverywhere(item, caseFolders, apiId || doc?.documentId || doc?.id || pending.documentId, doc?.name || doc?.title || pending.documentName);
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
    removeFinanceOperationsForDocuments(state, deleted?.files || []);
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
    const folder = pending.folderPath?.length
      ? folderByPath(caseFolders(item), pending.folderPath)
      : caseFolders(item)[pending.folderIndex];
    const directMatch = findDocumentInFolders(caseFolders(item), pending.documentId, pending.documentName);
    const file = folder?.files[pending.fileIndex] || directMatch?.file;
    const linkedDoc = item.documents.find((doc) => {
      const docId = String(doc.documentId || doc.id || "");
      return Boolean(docId && docId === String(file?.documentId || file?.id || pending.documentId))
        || Boolean(pending.documentName && String(doc.name || doc.title || "").trim().toLowerCase() === String(pending.documentName).trim().toLowerCase());
    });
    const apiId = documentApiId(file) || documentApiId(linkedDoc);
    if (shouldUseApi(state) && apiId) {
      try {
        await deleteDocumentFromApi(apiId);
      } catch (_error) {
        console.warn("Document API delete failed, removing local copies too.", _error);
      }
    }
    deleted = file || linkedDoc;
    removeFinanceOperationsForDocuments(state, [file, linkedDoc], [pending.documentName]);
    removeDocumentEverywhere(item, caseFolders, apiId || file?.documentId || linkedDoc?.documentId || pending.documentId, file?.name || linkedDoc?.name || pending.documentName);
    (directMatch?.folder || folder || {}).updated = today;
  }
  if (item && pending.type !== "case" && pending.type !== "calendarEvent" && pending.type !== "client" && pending.type !== "clients") {
    const deletedName = deleted?.name || deleted?.title || pending.documentName || "Елемент";
    item.history.unshift({
      date: today,
      text: pending.type === "folder"
        ? `Видалено папку документів: ${deletedName}.`
        : pending.type === "task"
          ? `Видалено задачу: ${deletedName}.`
          : pending.type === "proceduralAction"
            ? `Видалено процесуальну дію: ${deletedName}.`
            : `Видалено документ: ${deletedName}.`
    });
  }
  if (shouldUseApi(state) && ["proceduralAction", "folder", "folderFile"].includes(pending.type)) {
    try {
      Object.assign(item, normalizeCase(await saveCaseToApi(item)));
    } catch (_error) {
      console.warn("Case sync after delete failed.", _error);
    }
  }
  } catch (error) {
    console.error("Delete confirmation failed", error);
    showToast(`Помилка видалення: ${error.message || error}`, "danger");
    return;
  }
  persistSnapshotState(state);
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
        : pending.type === "clients"
          ? `Видалено ${deletedCount} клієнтів.`
          : pending.type === "client"
            ? `Клієнта ${deleted?.name || "клієнта"} видалено.`
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
  const officeDialog = $("#office-editor-dialog");
  const officeFullscreen = $("#office-editor-fullscreen");
  const syncOfficeFullscreen = () => {
    const expanded = officeDialog?.classList.contains("is-fullscreen");
    officeFullscreen?.setAttribute("aria-pressed", expanded ? "true" : "false");
    officeFullscreen?.setAttribute("aria-label", expanded ? "Згорнути редактор" : "На весь екран");
    officeFullscreen?.setAttribute("title", expanded ? "Згорнути редактор" : "На весь екран");
  };
  officeFullscreen?.addEventListener("click", () => {
    officeDialog?.classList.toggle("is-fullscreen");
    syncOfficeFullscreen();
    window.requestAnimationFrame(() => {
      window.dispatchEvent(new Event("resize"));
      window.__crmOnlyOfficeEditor?.resizeEditor?.("100%", "100%");
    });
  });
  officeDialog?.addEventListener("close", () => {
    officeDialog.classList.remove("is-fullscreen");
    syncOfficeFullscreen();
    // Destroy the ONLYOFFICE editor on close so the editing session ends — that is what makes
    // the Document Server post its save-callback and write the edited file back to the CRM.
    // (Previously it was destroyed only on the NEXT open, so edits weren't persisted on close.)
    try { window.__crmOnlyOfficeEditor?.destroyEditor?.(); } catch (_error) { /* already gone */ }
    window.__crmOnlyOfficeEditor = null;
  });
  $("#delete-document-close")?.addEventListener("click", () => closeDeleteDocumentConfirm(ctx));
  $("#delete-document-cancel")?.addEventListener("click", () => closeDeleteDocumentConfirm(ctx));
  const deleteConfirm = $("#delete-document-confirm");
  if (deleteConfirm) {
    deleteConfirm.onclick = async (event) => {
      event.preventDefault();
      if (deleteConfirm.dataset.busy === "true") return;
      deleteConfirm.dataset.busy = "true";
      deleteConfirm.disabled = true;
      try {
        await confirmDelete(ctx);
      } finally {
        deleteConfirm.dataset.busy = "false";
        deleteConfirm.disabled = false;
      }
    };
  }
}
