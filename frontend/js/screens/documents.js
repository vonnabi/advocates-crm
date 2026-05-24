import { deleteDocumentFromApi, saveDocumentToApi, saveMailingCampaignToApi, sendMailingCampaignInApi, shouldUseApi } from "../api.js";
import { normalizeDocument } from "../state.js";

const CASE_DOCUMENT_FOLDER_NAMES = ["Позови", "Клопотання", "Запити", "Відповіді та ухвали", "Інші документи"];
const PROCEDURAL_DOCUMENT_FOLDERS = new Set(["Позови", "Клопотання", "Запити", "Відповіді та ухвали"]);
const TECHNICAL_DOCUMENT_TYPES = new Set(["doc", "docx", "pdf", "txt", "rtf", "odt", "google docs", "google drive", "crm файл"]);

function inferCaseDocumentFolder(doc = {}, fallback = "Інші документи") {
  if (fallback && !CASE_DOCUMENT_FOLDER_NAMES.includes(fallback)) return fallback;
  const haystack = [doc.type, doc.name, doc.folder, fallback].map((value) => String(value || "").toLowerCase()).join(" ");
  if (/клопотан|клопа/.test(haystack)) return "Клопотання";
  if (/адвокатськ.*запит|запит|витребуван/.test(haystack)) return "Запити";
  if (/ухвал|відповід|рішенн|постанова/.test(haystack)) return "Відповіді та ухвали";
  if (/позов|позовн|заява/.test(haystack)) return "Позови";
  return CASE_DOCUMENT_FOLDER_NAMES.includes(fallback) ? "Інші документи" : fallback || "Інші документи";
}

function inferCaseDocumentType(doc = {}, folderName = "") {
  const folder = inferCaseDocumentFolder(doc, folderName);
  const rawType = String(doc.type || "").trim();
  const normalizedType = rawType.toLowerCase();
  if (folder === "Позови") return "Позов";
  if (folder === "Клопотання") return "Клопотання";
  if (folder === "Запити") return "Запит";
  if (folder === "Відповіді та ухвали") {
    const haystack = [rawType, doc.name, doc.folder, folderName].map((value) => String(value || "").toLowerCase()).join(" ");
    return /ухвал/.test(haystack) ? "Ухвала" : "Відповідь";
  }
  if (rawType && rawType !== "Документ" && !TECHNICAL_DOCUMENT_TYPES.has(normalizedType)) return rawType;
  return "Інший документ";
}

function isProceduralCaseDocument(doc = {}, folderName = "") {
  const type = String(doc.type || "").trim().toLowerCase();
  if (TECHNICAL_DOCUMENT_TYPES.has(type)) return false;
  const folder = folderName || doc.folder || doc.folderName || "";
  if (PROCEDURAL_DOCUMENT_FOLDERS.has(folder)) return true;
  const haystack = [doc.type, doc.name, folder].map((value) => String(value || "").toLowerCase()).join(" ");
  return /позов|позовн|клопотан|адвокатськ.*запит|запит|ухвал|відповід|рішенн|постанова|пояснен|скарг|заява/.test(haystack);
}

function documentRows(ctx) {
  const { state, clientById, caseFolders, findFolderFileByDocument } = ctx;
  const flattenFolderFiles = (folders = [], path = []) => folders.flatMap((folder, folderIndex) => {
    const folderPath = [...path, folderIndex];
    const files = (folder.files || []).map((file, fileIndex) => ({
      folder,
      folderIndex: folderPath[0],
      folderPath,
      file,
      fileIndex
    }));
    return [...files, ...flattenFolderFiles(folder.children || [], folderPath)];
  });
  return state.cases.flatMap((item) => {
    const client = clientById(item.clientId);
    const linkedDocumentIds = new Set(item.documents.map((doc) => doc.documentId).filter(Boolean));
    const proceduralRows = item.documents.map((doc, docIndex) => {
      const linked = findFolderFileByDocument(item, doc);
      const folderName = inferCaseDocumentFolder(doc, linked?.folder?.name || doc.folder);
      return {
        ...doc,
        key: `${item.id}|procedural:${docIndex}`,
        encoded: `procedural:${docIndex}`,
        caseId: item.id,
        caseTitle: item.title,
        clientId: String(item.clientId || client?.id || ""),
        client: client?.name || "Клієнт не вказаний",
        court: item.court || "",
        authorityType: item.authorityType || "",
        authorityAddress: item.authorityAddress || "",
        authorityContact: item.authorityContact || "",
        authorityEmail: item.authorityEmail || "",
        responsible: doc.responsible || item.responsible || client?.manager || "Не вказано",
        casePriority: item.priority,
        type: inferCaseDocumentType(doc, folderName),
        folderName,
        sourceLabel: doc.source || linked?.file?.source || "CRM",
        docIndex
      };
    });
    const folderRows = flattenFolderFiles(caseFolders(item))
      .filter(({ file }) => !file.documentId || !linkedDocumentIds.has(file.documentId))
      .map(({ folder, folderIndex, folderPath, file, fileIndex }) => ({
        ...file,
        key: folderPath.length > 1
          ? `${item.id}|folderPath:${folderPath.join(".")}:${fileIndex}`
          : `${item.id}|folder:${folderIndex}:${fileIndex}`,
        encoded: folderPath.length > 1
          ? `folderPath:${folderPath.join(".")}:${fileIndex}`
          : `folder:${folderIndex}:${fileIndex}`,
        caseId: item.id,
        caseTitle: item.title,
        clientId: String(item.clientId || client?.id || ""),
        client: client?.name || "Клієнт не вказаний",
        court: item.court || "",
        authorityType: item.authorityType || "",
        authorityAddress: item.authorityAddress || "",
        authorityContact: item.authorityContact || "",
        authorityEmail: item.authorityEmail || "",
        responsible: file.responsible || item.responsible || client?.manager || "Не вказано",
        casePriority: item.priority,
        folderName: inferCaseDocumentFolder(file, folder.name),
        sourceLabel: file.source || "Папка справи",
        folderIndex,
        folderPath,
        fileIndex
      }))
      .map((row) => ({ ...row, type: inferCaseDocumentType(row, row.folderName) }));
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
  "Очікує е-підпис",
  "Підписано КЕП",
  "Відхилено підпис",
  "Підпис прострочено",
  "Отримано",
  "Готово"
];

const E_SIGN_STATUSES = new Set(["Очікує е-підпис", "Підписано КЕП", "Відхилено підпис", "Підпис прострочено"]);

function documentStatusIconName(status) {
  const icons = {
    "Чернетка": "edit",
    "Не подано": "clock",
    "В роботі": "refresh",
    "Подано": "fileUp",
    "Відповідь очікується": "bell",
    "Потрібно перевірити": "search",
    "Очікує е-підпис": "signature",
    "Підписано КЕП": "signature",
    "Відхилено підпис": "x",
    "Підпис прострочено": "warning",
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
    "Очікує е-підпис": "doc-sign-waiting",
    "Підписано КЕП": "doc-signed",
    "Відхилено підпис": "doc-sign-rejected",
    "Підпис прострочено": "doc-sign-expired",
    "Отримано": "doc-received",
    "Готово": "doc-ready"
  };
  return tones[status] || "doc-default";
}

function sortedUnique(values = []) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), "uk"));
}

function optionHtml(value, label, selectedValue) {
  const selected = String(selectedValue || "all") === String(value) ? "selected" : "";
  return `<option value="${escapeHtml(value)}" ${selected}>${escapeHtml(label)}</option>`;
}

function resetDocumentArchiveFilterScope(state) {
  state.documentArchiveScope = "cases";
  state.documentArchiveClientId = "all";
  state.documentArchiveCaseId = "all";
  state.documentArchiveFolder = "";
  state.selectedDocumentKey = "";
  state.selectedDocumentKeys = [];
}

function closeDocumentFilterSelectMenus(root, except = null) {
  root.querySelectorAll(".document-custom-select.is-open").forEach((selectShell) => {
    if (selectShell === except) return;
    selectShell.classList.remove("is-open");
    selectShell.querySelector(".document-custom-select-button")?.setAttribute("aria-expanded", "false");
    const menu = selectShell.querySelector(".document-custom-select-menu");
    if (menu) menu.hidden = true;
  });
}

function syncDocumentFilterCustomSelect(select) {
  const shell = select.nextElementSibling?.classList?.contains("document-custom-select")
    ? select.nextElementSibling
    : null;
  if (!shell) return;
  const selected = select.selectedOptions?.[0] || select.options[0];
  const buttonText = shell.querySelector("[data-document-select-value]");
  const menu = shell.querySelector(".document-custom-select-menu");
  if (buttonText) buttonText.textContent = selected?.textContent || "";
  if (!menu) return;
  menu.innerHTML = [...select.options].map((option) => `
    <button class="document-custom-select-option ${option.value === select.value ? "is-selected" : ""}" type="button" role="option" data-value="${escapeHtml(option.value)}" aria-selected="${option.value === select.value ? "true" : "false"}">
      <span aria-hidden="true">✓</span>
      <strong>${escapeHtml(option.textContent || "")}</strong>
    </button>
  `).join("");
}

function setupDocumentFilterCustomSelects(root) {
  root.querySelectorAll(".documents-filter-field > select").forEach((select) => {
    select.classList.add("document-native-select");
    select.tabIndex = -1;
    select.setAttribute("aria-hidden", "true");
    let shell = select.nextElementSibling?.classList?.contains("document-custom-select")
      ? select.nextElementSibling
      : null;
    if (!shell) {
      shell = document.createElement("div");
      shell.className = "document-custom-select documents-filter-select";
      shell.innerHTML = `
        <button class="document-custom-select-button" type="button" aria-haspopup="listbox" aria-expanded="false">
          <span data-document-select-value></span>
          <span class="document-custom-select-chevron" aria-hidden="true"></span>
        </button>
        <div class="document-custom-select-menu" role="listbox" hidden></div>
      `;
      select.insertAdjacentElement("afterend", shell);
      shell.querySelector(".document-custom-select-button")?.addEventListener("click", () => {
        const isOpen = shell.classList.contains("is-open");
        closeDocumentFilterSelectMenus(root, isOpen ? null : shell);
        shell.classList.toggle("is-open", !isOpen);
        shell.querySelector(".document-custom-select-button")?.setAttribute("aria-expanded", String(!isOpen));
        const menu = shell.querySelector(".document-custom-select-menu");
        if (menu) menu.hidden = isOpen;
      });
      shell.querySelector(".document-custom-select-menu")?.addEventListener("click", (event) => {
        const optionButton = event.target.closest(".document-custom-select-option");
        if (!optionButton) return;
        select.value = optionButton.dataset.value || "";
        select.dispatchEvent(new Event("change", { bubbles: true }));
        syncDocumentFilterCustomSelect(select);
        closeDocumentFilterSelectMenus(root);
      });
    }
    syncDocumentFilterCustomSelect(select);
  });
  if (!root.dataset.documentFilterCustomSelectsBound) {
    root.dataset.documentFilterCustomSelectsBound = "true";
    root.addEventListener("click", (event) => {
      if (event.target.closest(".document-custom-select")) return;
      closeDocumentFilterSelectMenus(root);
    });
    root.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeDocumentFilterSelectMenus(root);
    });
  }
}

function filteredDocuments(ctx, rows) {
  const { state } = ctx;
  const query = (state.documentQuery || "").trim().toLowerCase();
  return rows.filter((doc) => {
    const dueState = documentDueState(ctx, doc);
    const matchesQuery = !query || [
      doc.name,
      doc.caseId,
      doc.caseTitle,
      doc.client,
      doc.folderName,
      doc.responsible,
      doc.status,
      doc.type,
      doc.sourceLabel,
      doc.comment,
      doc.submitted,
      doc.responseDue,
      dueState.label,
      doc.court,
      doc.authorityType,
      doc.authorityAddress,
      doc.authorityContact,
      doc.authorityEmail
    ].some((value) => String(value || "").toLowerCase().includes(query));
    const matchesStatus = (state.documentStatusFilter || "all") === "all" || doc.status === state.documentStatusFilter;
    const matchesCase = (state.documentCaseFilter || "all") === "all" || doc.caseId === state.documentCaseFilter;
    const matchesType = (state.documentTypeFilter || "all") === "all" || (doc.type || "Інше") === state.documentTypeFilter;
    const matchesClient = (state.documentClientFilter || "all") === "all" || doc.clientId === String(state.documentClientFilter);
    const matchesDue = (state.documentDueFilter || "all") === "all" || dueState.overdue;
    const quickFilter = state.documentQuickFilter || "all";
    const matchesQuick =
      quickFilter === "all" ||
      (quickFilter === "submitted" && ["Подано", "Відповідь очікується", "Отримано"].includes(doc.status)) ||
      (quickFilter === "overdue" && dueState.overdue) ||
      (quickFilter === "drafts" && ["Чернетка", "Не подано"].includes(doc.status)) ||
      (quickFilter === "esign" && E_SIGN_STATUSES.has(doc.status)) ||
      (quickFilter === "ai" && ["Позов", "Запит", "Клопотання", "Доказ"].includes(doc.type || ""));
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

function folderDocumentCount(folder = {}) {
  return (folder.files || []).length + (folder.children || []).reduce((sum, child) => sum + folderDocumentCount(child), 0);
}

function makeDocumentCopyName(name = "Документ") {
  const clean = String(name || "Документ").trim() || "Документ";
  const match = clean.match(/^(.*?)(\.[A-Za-zА-Яа-яІіЇїЄєҐґ0-9]+)$/);
  if (match) return `${match[1]} - копія${match[2]}`;
  return `${clean} - копія`;
}

function findCaseFolderByName(folders = [], name = "") {
  for (const folder of folders) {
    if (folder.name === name) return folder;
    const nested = findCaseFolderByName(folder.children || [], name);
    if (nested) return nested;
  }
  return null;
}

function activeArchiveSelection(ctx, rows) {
  const { state, caseFolders } = ctx;
  const selectedClientId = state.documentArchiveClientId || "all";
  const selectedCaseId = state.documentArchiveCaseId || "all";
  const selectedCase = selectedCaseId === "all" ? null : state.cases.find((item) => item.id === selectedCaseId);
  const selectedClient = selectedClientId === "all" ? null : state.clients.find((client) => String(client.id) === String(selectedClientId));
  const folders = selectedCase ? caseFolders(selectedCase) : [];
  const selectedFolderName = state.documentArchiveFolder || "";
  const selectedFolder = selectedFolderName ? findCaseFolderByName(folders, selectedFolderName) : null;
  const visibleRows = rows.filter((doc) => {
    if (selectedClient && !selectedCase && doc.client !== selectedClient.name) return false;
    if (!selectedCase) return true;
    if (doc.caseId !== selectedCase.id) return false;
    if (!selectedFolder) return true;
    return doc.folderName === selectedFolder.name;
  });
  return { selectedClient, selectedCase, selectedFolder, visibleRows, isAll: selectedClientId === "all" && selectedCaseId === "all" };
}

function archiveFolderId(name = "Архів") {
  return String(name)
    .trim()
    .toLowerCase()
    .replace(/[^a-zа-яіїєґ0-9]+/giu, "-")
    .replace(/^-+|-+$/g, "")
    || `archive-${Date.now()}`;
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function ensureDocumentStorageArchive(state) {
  if (!Array.isArray(state.documentArchiveFolders)) {
    state.documentArchiveFolders = [
      { id: "finished", name: "Завершені документи", documents: [], children: [] },
      { id: "saved", name: "На зберіганні", documents: [], children: [] }
    ];
  }
  const normalize = (folders) => folders.forEach((folder) => {
    if (!Array.isArray(folder.documents)) folder.documents = [];
    if (!Array.isArray(folder.children)) folder.children = [];
    normalize(folder.children);
  });
  normalize(state.documentArchiveFolders);
  if (!state.documentStorageArchiveFolderId) state.documentStorageArchiveFolderId = "all";
  return state.documentArchiveFolders;
}

function documentArchiveCount(folders = []) {
  return folders.reduce((sum, folder) => sum + (folder.documents || []).length + documentArchiveCount(folder.children || []), 0);
}

function findArchiveFolder(folders = [], id, parent = null) {
  for (const folder of folders) {
    if (folder.id === id) return { folder, parent };
    const nested = findArchiveFolder(folder.children || [], id, folder);
    if (nested) return nested;
  }
  return null;
}

function removeArchiveFolder(folders = [], id) {
  const index = folders.findIndex((folder) => folder.id === id);
  if (index >= 0) {
    folders.splice(index, 1);
    return true;
  }
  return folders.some((folder) => removeArchiveFolder(folder.children || [], id));
}

function archiveFolderExists(folders = [], id) {
  return Boolean(findArchiveFolder(folders, id));
}

export function archiveDocumentInStorage(ctx, key, options = {}) {
  const { state, caseById, clientById, getDocumentPayload, renderAll, showToast } = ctx;
  const { folderId = "", newFolderName = "", comment = "", render = true, notify = true } = options;
  const { caseId, encoded } = payloadFromKey(key);
  const payload = getDocumentPayload(caseId, encoded);
  const item = caseById(caseId);
  const source = payload.file || payload.doc;
  if (!item || !source) return false;
  const folders = ensureDocumentStorageArchive(state);
  let folder = folderId ? findArchiveFolder(folders, folderId)?.folder : findArchiveFolder(folders, "saved")?.folder || folders[0];
  if (newFolderName) {
    const name = String(newFolderName || "").trim() || "Нова папка архіву";
    let id = archiveFolderId(name);
    if (archiveFolderExists(folders, id)) id = `${id}-${Date.now()}`;
    const nextFolder = { id, name, createdAt: new Date().toLocaleDateString("uk-UA"), documents: [], children: [] };
    if (folder) folder.children.unshift(nextFolder);
    else folders.unshift(nextFolder);
    folder = nextFolder;
  }
  if (!folder) {
    folder = { id: "saved", name: "На зберіганні", documents: [], children: [] };
    folders.unshift(folder);
  }
  if (!Array.isArray(folder.documents)) folder.documents = [];
  const archivedAt = new Date().toLocaleDateString("uk-UA");
  const client = clientById?.(item.clientId);
  const folderName = payload.folder?.name || payload.linked?.folder?.name || source.folder || source.folderName || "Процесуальні документи";
  const archivePayload = {
    sourceKey: key,
    documentId: source.documentId || source.id || "",
    name: source.name,
    type: source.type,
    caseId: item.id,
    caseTitle: item.title,
    client: client?.name || "",
    folderName,
    archivedAt,
    comment: comment || source.comment || ""
  };
  const existing = folder.documents.find((archiveDoc) =>
    archiveDoc.sourceKey === key || archivePayload.documentId && archiveDoc.documentId === archivePayload.documentId
  );
  if (existing) Object.assign(existing, archivePayload);
  else folder.documents.unshift(archivePayload);
  state.documentArchiveScope = "storage";
  state.documentStorageArchiveFolderId = folder.id;
  state.selectedDocumentKey = key;
  if (render) renderAll?.();
  if (notify) showToast?.("Документ додано в архів.");
  return true;
}

export function openDocumentArchiveDialog(ctx, key) {
  const { state, $, caseById, clientById, getDocumentPayload, showToast } = ctx;
  const archiveDialog = $("#document-archive-dialog");
  const archiveForm = $("#document-archive-form");
  const archiveSelect = $("#document-archive-dialog-folder");
  const archiveTarget = archiveDialog?.querySelector("[data-document-archive-target]");
  if (!archiveDialog || !archiveForm || !archiveSelect) return;
  const { caseId, encoded } = payloadFromKey(key);
  const payload = getDocumentPayload(caseId, encoded);
  const item = caseById(caseId);
  const doc = payload.file || payload.doc;
  if (!doc || !item) return;
  const folders = ensureDocumentStorageArchive(state);
  const fillArchiveDialogFolders = () => {
    if (!archiveSelect.value && folders[0]) archiveSelect.value = findArchiveFolder(folders, "saved")?.folder?.id || folders[0].id;
    const picker = archiveDialog.querySelector('[data-document-archive-picker="archive-dialog"]');
    if (!picker) return;
    picker.innerHTML = renderArchivePickerTree(folders, archiveSelect.value, escapeHtml) || `<p>Архівних папок ще немає.</p>`;
    picker.querySelectorAll("[data-document-archive-pick]").forEach((button) => {
      button.addEventListener("click", () => {
        archiveSelect.value = button.dataset.documentArchivePick || "";
        fillArchiveDialogFolders();
      });
    });
  };
  archiveForm.reset();
  archiveForm.elements.documentKey.value = key;
  archiveSelect.value = findArchiveFolder(folders, "saved")?.folder?.id || folders[0]?.id || "";
  fillArchiveDialogFolders();
  if (archiveTarget) {
    const client = clientById?.(item.clientId);
    archiveTarget.innerHTML = `
      <span aria-hidden="true">DOC</span>
      <div>
        <strong>${escapeHtml(doc.name || "Документ")}</strong>
        <small>№${escapeHtml(item.id)} · ${escapeHtml(client?.name || "Клієнт не вказаний")}</small>
      </div>
    `;
  }
  archiveForm.onkeydown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      archiveDialog.close();
      return;
    }
    if (event.key !== "Enter" || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.target?.matches?.("textarea, button, [role='button']")) return;
    event.preventDefault();
    archiveForm.requestSubmit();
  };
  archiveForm.onsubmit = (event) => {
    if (event.submitter?.value === "cancel") return;
    event.preventDefault();
    const data = new FormData(archiveForm);
    const ok = archiveDocumentInStorage(ctx, data.get("documentKey"), {
      folderId: data.get("archiveFolderId"),
      newFolderName: data.get("newArchiveFolderName"),
      comment: data.get("archiveComment")
    });
    if (!ok) {
      showToast?.("Не вдалося додати документ в архів.", "danger");
      return;
    }
    archiveDialog.close();
  };
  const archiveClose = $("#document-archive-close");
  const archiveCancel = $("#document-archive-cancel");
  if (archiveClose) archiveClose.onclick = () => archiveDialog.close();
  if (archiveCancel) archiveCancel.onclick = () => archiveDialog.close();
  archiveDialog.showModal();
}

function renderArchivePickerTree(folders = [], selectedId = "", escapeHtml, depth = 0) {
  return folders.map((folder) => `
    <button class="document-archive-picker-node ${selectedId === folder.id ? "active" : ""}" type="button" data-document-archive-pick="${escapeHtml(folder.id)}" style="--level:${depth}">
      <span aria-hidden="true">›</span>
      <i class="folder-icon" aria-hidden="true"></i>
      <strong>${escapeHtml(folder.name)}</strong>
      <em>${(folder.documents || []).length}</em>
    </button>
    ${renderArchivePickerTree(folder.children || [], selectedId, escapeHtml, depth + 1)}
  `).join("");
}

export async function copyDocumentInCase(ctx, key) {
  const {
    state,
    caseById,
    caseFolders,
    getDocumentPayload,
    renderAll,
    openDocumentDialog,
    showToast
  } = ctx;
  const { caseId, encoded } = payloadFromKey(key);
  const payload = getDocumentPayload(caseId, encoded);
  const item = caseById(caseId);
  const source = payload.file || payload.doc;
  if (!item || !source) return;
  const folders = caseFolders(item);
  const sourceFolder = payload.folder || payload.linked?.folder || findCaseFolderByName(folders, source.folder || source.folderName);
  const targetFolder = sourceFolder || folders[0];
  if (!targetFolder) {
    showToast?.("Оберіть справу з папкою для копії документа.", "warning");
    return;
  }
  const today = new Date().toLocaleDateString("uk-UA");
  const copyName = makeDocumentCopyName(source.name);
  let saved = null;
  if (shouldUseApi(state)) {
    try {
      saved = normalizeDocument(await saveDocumentToApi({
        caseId: item.id,
        name: copyName,
        type: source.type || "Інше",
        folder: targetFolder.name,
        status: source.status || "Чернетка",
        submitted: source.submitted || "-",
        responseDue: source.responseDue || "-",
        comment: source.comment || "",
        content: source.content || "",
        url: source.url || "",
        responsible: source.responsible || item.responsible,
        history: [{ date: today, text: `Створено копію документа: ${source.name}.` }]
      }));
    } catch (_error) {
      showToast?.("Не вдалося створити копію документа у базі.", "danger");
      return;
    }
  }
  const documentId = saved?.documentId || saved?.id || `copy-${Date.now()}`;
  const copyDoc = {
    ...source,
    ...saved,
    id: saved?.id,
    documentId,
    name: saved?.name || copyName,
    folder: saved?.folder || targetFolder.name,
    fileName: "",
    fileObject: null,
    fileUrl: saved?.fileUrl || "",
    onlyOfficeCallbackUrl: saved?.onlyOfficeCallbackUrl || "",
    added: today,
    updated: today,
    history: saved?.history || [{ date: today, text: `Створено копію документа: ${source.name}.` }]
  };
  if (isProceduralCaseDocument(copyDoc, targetFolder.name)) item.documents.unshift(copyDoc);
  targetFolder.files.unshift({
    id: copyDoc.id,
    documentId,
    name: copyDoc.name,
    type: copyDoc.type,
    folder: copyDoc.folder,
    status: copyDoc.status,
    submitted: copyDoc.submitted,
    responseDue: copyDoc.responseDue,
    comment: copyDoc.comment,
    content: copyDoc.content,
    updated: today,
    fileName: copyDoc.fileName,
    fileObject: null,
    fileUrl: copyDoc.fileUrl || "",
    onlyOfficeCallbackUrl: copyDoc.onlyOfficeCallbackUrl || "",
    url: copyDoc.url || ""
  });
  targetFolder.updated = today;
  item.history.unshift({ date: today, text: `Скопійовано документ: ${source.name}.` });
  state.selectedCaseId = item.id;
  state.openCaseSection = "documents";
  state.documentArchiveScope = "cases";
  state.documentArchiveClientId = String(item.clientId || "all");
  state.documentArchiveCaseId = item.id;
  state.documentArchiveFolder = targetFolder.name;
  const targetFolderIndex = folders.findIndex((folder) => folder === targetFolder);
  const selectedCopyEncoded = isProceduralCaseDocument(copyDoc, targetFolder.name)
    ? "procedural:0"
    : `folder:${Math.max(targetFolderIndex, 0)}:0`;
  state.selectedDocumentKey = `${item.id}|${selectedCopyEncoded}`;
  renderAll?.();
  openDocumentDialog?.(item.id, getDocumentPayload(item.id, selectedCopyEncoded), "documents");
  showToast?.("Копію документа створено.");
}

function documentSendAuthorities(state) {
  const rows = new Map();
  (state.cases || []).forEach((item) => {
    const name = String(item.court || "").trim();
    if (!name || name === "Не вказано") return;
    const entry = {
      name,
      type: String(item.authorityType || "").trim(),
      address: String(item.authorityAddress || "").trim(),
      contact: String(item.authorityContact || "").trim(),
      phone: String(item.authorityContact || "").trim(),
      email: String(item.authorityEmail || "").trim(),
      caseId: item.id
    };
    const key = [entry.name, entry.type, entry.address, entry.contact, entry.email].join("|").toLowerCase();
    if (!rows.has(key)) rows.set(key, entry);
  });
  return [...rows.values()].sort((a, b) => a.name.localeCompare(b.name, "uk"));
}

function documentSendContactLabel(source = {}, channel = "") {
  if (!source) return "";
  const telegram = source.telegramUsername || source.telegram || "";
  const email = source.email || "";
  const phone = source.phone || source.contact || source.whatsapp || "";
  if (channel === "Telegram") return telegram ? `Telegram: ${telegram}` : "Telegram не заповнений";
  if (channel === "Email") return email ? `Email: ${email}` : "Email не заповнений";
  if (channel === "SMS") return phone ? `Телефон: ${phone}` : "Телефон не заповнений";
  return [telegram && `Telegram: ${telegram}`, email && `Email: ${email}`, phone && `Телефон: ${phone}`].filter(Boolean).join(" · ");
}

function closeDocumentSendSelectMenus(form, except = null) {
  form.querySelectorAll(".document-custom-select.is-open").forEach((selectShell) => {
    if (selectShell === except) return;
    selectShell.classList.remove("is-open");
    selectShell.querySelector(".document-custom-select-button")?.setAttribute("aria-expanded", "false");
    const menu = selectShell.querySelector(".document-custom-select-menu");
    if (menu) menu.hidden = true;
  });
}

function syncDocumentSendCustomSelect(select) {
  const shell = select.nextElementSibling?.classList?.contains("document-custom-select")
    ? select.nextElementSibling
    : null;
  if (!shell) return;
  const selected = select.selectedOptions?.[0] || select.options[0];
  const buttonText = shell.querySelector("[data-document-select-value]");
  const menu = shell.querySelector(".document-custom-select-menu");
  if (buttonText) buttonText.textContent = selected?.textContent || "";
  if (!menu) return;
  menu.innerHTML = [...select.options].map((option) => `
    <button class="document-custom-select-option ${option.value === select.value ? "is-selected" : ""}" type="button" role="option" data-value="${escapeHtml(option.value)}" aria-selected="${option.value === select.value ? "true" : "false"}">
      <span aria-hidden="true">✓</span>
      <strong>${escapeHtml(option.textContent || "")}</strong>
    </button>
  `).join("");
}

function setupDocumentSendCustomSelects(form) {
  form.querySelectorAll(".document-editor-field > select").forEach((select) => {
    select.classList.add("document-native-select");
    select.tabIndex = -1;
    select.setAttribute("aria-hidden", "true");
    let shell = select.nextElementSibling?.classList?.contains("document-custom-select")
      ? select.nextElementSibling
      : null;
    if (!shell) {
      shell = document.createElement("div");
      shell.className = "document-custom-select";
      shell.innerHTML = `
        <button class="document-custom-select-button" type="button" aria-haspopup="listbox" aria-expanded="false">
          <span data-document-select-value></span>
          <span class="document-custom-select-chevron" aria-hidden="true"></span>
        </button>
        <div class="document-custom-select-menu" role="listbox" hidden></div>
      `;
      select.insertAdjacentElement("afterend", shell);
      shell.querySelector(".document-custom-select-button")?.addEventListener("click", () => {
        const isOpen = shell.classList.contains("is-open");
        closeDocumentSendSelectMenus(form, isOpen ? null : shell);
        shell.classList.toggle("is-open", !isOpen);
        shell.querySelector(".document-custom-select-button")?.setAttribute("aria-expanded", String(!isOpen));
        const menu = shell.querySelector(".document-custom-select-menu");
        if (menu) menu.hidden = isOpen;
      });
      shell.querySelector(".document-custom-select-menu")?.addEventListener("click", (event) => {
        const optionButton = event.target.closest(".document-custom-select-option");
        if (!optionButton) return;
        select.value = optionButton.dataset.value || "";
        select.dispatchEvent(new Event("change", { bubbles: true }));
        syncDocumentSendCustomSelect(select);
        closeDocumentSendSelectMenus(form);
      });
    }
    if (!select.dataset.documentSendSelectSyncBound) {
      select.dataset.documentSendSelectSyncBound = "true";
      select.addEventListener("change", () => syncDocumentSendCustomSelect(select));
    }
    syncDocumentSendCustomSelect(select);
  });
  if (!form.dataset.documentSendCustomSelectsBound) {
    form.dataset.documentSendCustomSelectsBound = "true";
    form.addEventListener("click", (event) => {
      if (event.target.closest(".document-custom-select")) return;
      closeDocumentSendSelectMenus(form);
    });
    form.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeDocumentSendSelectMenus(form);
    });
  }
}

function documentSendContact(state, client, authority, channel, mode, manual = "") {
  if (mode === "manual") return manual.trim();
  const source = mode === "authority" ? authority || {} : client || {};
  if (channel === "Telegram") return source.telegramUsername || source.telegram || "";
  if (channel === "Email") return source.email || "";
  if (channel === "SMS") return source.phone || source.contact || source.whatsapp || "";
  return "";
}

function absoluteDocumentUrl(value = "") {
  const url = String(value || "").trim();
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  try {
    return new URL(url, window.location.origin).href;
  } catch (_error) {
    return url;
  }
}

function documentSendMessage(doc, item, contact, channel) {
  const documentUrl = absoluteDocumentUrl(doc.fileUrl || doc.url);
  const fileLine = documentUrl
    ? `Посилання на документ: ${documentUrl}`
    : "Документ буде доступний у CRM.";
  return [
    `Надсилаємо документ: ${doc.name}`,
    item ? `Справа: №${item.id}` : "",
    fileLine,
    contact ? `Отримувач (${channel}): ${contact}` : ""
  ].filter(Boolean).join("\n");
}

export function openDocumentSendDialog(ctx, key) {
  const { state, caseById, clientById, getDocumentPayload, showToast } = ctx;
  const dialog = document.querySelector("#document-send-dialog");
  const form = document.querySelector("#document-send-form");
  if (!dialog || !form) return;
  const { caseId, encoded } = payloadFromKey(key);
  const payload = getDocumentPayload(caseId, encoded);
  const item = caseById(caseId);
  const doc = payload.file || payload.doc;
  if (!doc || !item) return;
  const clients = state.clients || [];
  const client = clientById(item.clientId);
  const authorities = documentSendAuthorities(state);
  form.reset();
  form.elements.documentKey.value = key;
  form.elements.channel.value = "Telegram";
  form.elements.recipientMode.value = "client";
  document.querySelector("#document-send-name").textContent = doc.name || "Документ";
  const clientField = form.querySelector("[data-document-send-client]");
  const manualField = form.querySelector("[data-document-send-manual]");
  const authorityField = form.querySelector("[data-document-send-authority]");
  const clientSelect = form.elements.clientRecipient;
  const authoritySelect = form.elements.authorityRecipient;
  const clientContact = document.querySelector("#document-send-client-contact");
  const authorityContact = document.querySelector("#document-send-authority-contact");
  const preview = document.querySelector("#document-send-recipient-preview");
  if (clientSelect) {
    clientSelect.innerHTML = clients.length
      ? clients.map((recipient) => {
        const meta = [recipient.email, recipient.phone || recipient.whatsapp].filter(Boolean).join(" · ");
        return `<option value="${recipient.id}">${escapeHtml(recipient.name || "Клієнт")}${meta ? ` — ${escapeHtml(meta)}` : ""}</option>`;
      }).join("")
      : `<option value="">Клієнтів ще немає</option>`;
    clientSelect.value = String(client?.id || clients[0]?.id || "");
  }
  if (authoritySelect) {
    authoritySelect.innerHTML = authorities.length
      ? authorities.map((authority, index) => {
        const meta = [authority.type, authority.email || authority.contact].filter(Boolean).join(" · ");
        return `<option value="${index}">${escapeHtml(authority.name)}${meta ? ` — ${escapeHtml(meta)}` : ""}</option>`;
      }).join("")
      : `<option value="">Органів ще немає</option>`;
    const currentIndex = authorities.findIndex((authority) => authority.caseId === item.id || authority.name === item.court);
    authoritySelect.value = String(Math.max(currentIndex, 0));
  }
  const sync = () => {
    const channel = form.elements.channel.value;
    const mode = form.elements.recipientMode.value;
    const manual = form.elements.manualRecipient.value;
    const selectedClient = clientById(form.elements.clientRecipient?.value) || client;
    const authority = authorities[Number(form.elements.authorityRecipient?.value || 0)];
    const contact = documentSendContact(state, selectedClient, authority, channel, mode, manual);
    if (clientField) clientField.hidden = mode !== "client";
    if (manualField) manualField.hidden = mode !== "manual";
    if (authorityField) authorityField.hidden = mode !== "authority";
    if (clientContact) clientContact.textContent = documentSendContactLabel(selectedClient, channel);
    if (authorityContact) authorityContact.textContent = documentSendContactLabel(authority, channel);
    if (preview) {
      const label = mode === "client"
        ? selectedClient?.name || "Клієнт"
        : mode === "authority"
          ? authority?.name || "Орган"
          : "Ручний отримувач";
      preview.textContent = contact ? `${label}: ${contact}` : `${label}: контакт для ${channel} не заповнений`;
    }
    if (!form.elements.message.value.trim()) {
      form.elements.message.value = documentSendMessage(doc, item, contact, channel);
    }
  };
  form.elements.channel.onchange = () => {
    form.elements.message.value = "";
    sync();
  };
  form.elements.recipientMode.onchange = () => {
    form.elements.message.value = "";
    sync();
  };
  if (clientSelect) {
    clientSelect.onchange = () => {
      form.elements.message.value = "";
      sync();
    };
  }
  if (authoritySelect) {
    authoritySelect.onchange = () => {
      form.elements.message.value = "";
      sync();
    };
  }
  form.elements.manualRecipient.oninput = sync;
  form.onsubmit = async (event) => {
    event.preventDefault();
    const channel = form.elements.channel.value;
    const mode = form.elements.recipientMode.value;
    const selectedClient = clientById(form.elements.clientRecipient?.value) || client;
    const authority = authorities[Number(form.elements.authorityRecipient?.value || 0)];
    const contact = documentSendContact(state, selectedClient, authority, channel, mode, form.elements.manualRecipient.value);
    if (!contact) {
      showToast?.(`Заповніть контакт для ${channel}.`, "warning");
      return;
    }
    const message = form.elements.message.value.trim() || documentSendMessage(doc, item, contact, channel);
    const campaign = {
      title: `Документ: ${doc.name}`,
      status: "Готова к отправке",
      meta: `${channel} · ${mode === "client" ? selectedClient?.name || "клієнт" : mode === "authority" ? authority?.name || "орган" : contact}`,
      createdAt: new Date().toLocaleString("uk-UA"),
      text: message,
      channels: { Telegram: channel === "Telegram", SMS: channel === "SMS", Email: channel === "Email" },
      sendMode: "now",
      recipientMode: mode === "client" ? "manual" : "external",
      manualClientIds: mode === "client" && selectedClient?.id ? [selectedClient.id] : [],
      filters: [],
      recipientCount: 1,
      documentId: doc.documentId || doc.id || "",
      documentName: doc.name,
      documentUrl: absoluteDocumentUrl(doc.fileUrl || doc.url),
      externalRecipient: mode === "client" ? "" : contact,
      externalRecipientName: mode === "authority" ? authority?.name || "" : ""
    };
    try {
      let saved = shouldUseApi(state) && mode === "client"
        ? await saveMailingCampaignToApi(campaign)
        : { ...campaign, id: `document-send-${Date.now()}`, status: "Відправлено" };
      if (shouldUseApi(state) && mode === "client" && saved?.id) {
        const response = await sendMailingCampaignInApi(saved.id);
        saved = response?.campaign || saved;
      }
      state.mailingCampaigns.unshift(saved);
      state.mailingMainTab = "campaigns";
      dialog.close();
      showToast?.(`Документ відправлено через ${channel}.`);
    } catch (_error) {
      showToast?.("Не вдалося відправити документ.", "danger");
    }
  };
  document.querySelector("#document-send-close").onclick = () => dialog.close();
  document.querySelector("#document-send-cancel").onclick = () => dialog.close();
  form.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      dialog.close();
    }
  }, { once: true });
  setupDocumentSendCustomSelects(form);
  sync();
  dialog.showModal();
}

function flattenStorageArchiveRows(folders = [], rows = []) {
  const byKey = new Map(rows.map((doc) => [doc.key, doc]));
  const byDocumentId = new Map(rows.filter((doc) => doc.documentId).map((doc) => [String(doc.documentId), doc]));
  const walk = (items = [], depth = 0, parentNames = []) => items.flatMap((folder) => {
    const path = [...parentNames, folder.name].filter(Boolean).join(" / ");
    const documents = (folder.documents || []).map((archiveDoc, index) => {
      const linked = archiveDoc.sourceKey ? byKey.get(archiveDoc.sourceKey) : null;
      const documentId = archiveDoc.documentId ? String(archiveDoc.documentId) : "";
      const byId = documentId ? byDocumentId.get(documentId) : null;
      const base = linked || byId || {};
      return {
        ...archiveDoc,
        ...base,
        key: linked?.key || byId?.key || `storage:${folder.id}:${index}`,
        caseId: archiveDoc.caseId || base.caseId || "",
        caseTitle: archiveDoc.caseTitle || base.caseTitle || "",
        client: archiveDoc.client || base.client || "Без справи",
        folderName: path || folder.name || "Архів",
        sourceLabel: base.sourceLabel || archiveDoc.source || "Архів",
        type: archiveDoc.type || base.type || "Документ",
        status: archiveDoc.status || base.status || "В архіві",
        responseDue: archiveDoc.responseDue || base.responseDue || "",
        submitted: archiveDoc.submitted || base.submitted || "",
        dueState: base.dueState || { label: "Архів", tone: "muted", days: Infinity, overdue: false },
        archivedAt: archiveDoc.archivedAt || "",
        storageFolderId: folder.id,
        storageDepth: depth
      };
    });
    return [
      ...documents,
      ...walk(folder.children || [], depth + 1, [...parentNames, folder.name])
    ];
  });
  return walk(folders);
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
    exportStoredDocument,
    openOfficeEditor,
    openDocumentDialog,
    openFolderDialog,
    openDeleteDocumentConfirm,
    bindViewLinks,
    formatDate,
    showToast
  } = ctx;
  const rows = documentRows(ctx).map((doc) => ({ ...doc, dueState: documentDueState(ctx, doc) }));
  const storageArchiveFolders = ensureDocumentStorageArchive(state);
  const storageArchiveTotal = documentArchiveCount(storageArchiveFolders);
  const storageArchiveActive = state.documentStorageArchiveFolderId || "all";
  const archiveScope = state.documentArchiveScope || "cases";
  const documentKeys = new Set(rows.map((doc) => doc.key));
  state.selectedDocumentKeys = (state.selectedDocumentKeys || []).filter((key) => documentKeys.has(key));
  const statuses = DOCUMENT_STATUS_OPTIONS.filter((status) => rows.some((doc) => doc.status === status));
  const types = sortedUnique(rows.map((doc) => doc.type || "Інше"));
  const clients = state.clients
    .filter((client) => rows.some((doc) => doc.clientId === String(client.id)))
    .sort((a, b) => String(a.name).localeCompare(String(b.name), "uk"));
  const filterCaseOptions = state.cases
    .filter((item) => (state.documentClientFilter || "all") === "all" || String(item.clientId) === String(state.documentClientFilter))
    .sort((a, b) => String(a.id).localeCompare(String(b.id), "uk"));
  const filtered = filteredDocuments(ctx, rows);
  const archive = activeArchiveSelection(ctx, filtered);
  const allStorageRows = flattenStorageArchiveRows(storageArchiveFolders, rows);
  const tableRows = archiveScope === "storage"
    ? allStorageRows.filter((doc) => storageArchiveActive === "all" || doc.storageFolderId === storageArchiveActive)
    : archive.visibleRows;
  const clientArchiveGroups = state.cases.reduce((groups, item) => {
    const client = ctx.clientById(item.clientId);
    const clientId = String(client?.id || item.clientId || "none");
    const clientName = client?.name || "Клієнт не вказаний";
    if (!groups.has(clientId)) {
      groups.set(clientId, { id: clientId, name: clientName, cases: [], count: 0 });
    }
    const group = groups.get(clientId);
    const caseRows = filtered.filter((doc) => doc.caseId === item.id);
    group.count += caseRows.length;
    group.cases.push({ item, client, rows: caseRows, folders: caseFolders(item) });
    return groups;
  }, new Map());
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
  const selectedCaseCandidate = archive.selectedCase?.id || selected?.caseId || state.selectedCaseId || state.cases[0]?.id || "";
  const selectedCaseItem = selectedCaseCandidate ? ctx.caseById(selectedCaseCandidate) : null;
  const selectedCase = selectedCaseItem?.id || "";
  const hasCases = Boolean(state.cases.length);
  const selectedFolders = selectedCaseItem ? caseFolders(selectedCaseItem) : [];
  const selectedFolderIndex = archive.selectedFolder
    ? selectedFolders.findIndex((folder) => folder.name === archive.selectedFolder.name)
    : -1;
  const submittedCount = rows.filter((doc) => ["Подано", "Відповідь очікується", "Отримано"].includes(doc.status)).length;
  const draftCount = rows.filter((doc) => ["Чернетка", "Не подано"].includes(doc.status)).length;
  const overdueCount = rows.filter((doc) => doc.dueState.overdue).length;
  const eSignCount = rows.filter((doc) => E_SIGN_STATUSES.has(doc.status)).length;
  const aiReadyCount = rows.filter((doc) => ["Позов", "Адвокатський запит", "Доказ"].includes(doc.type || "")).length;
  const eSignEnabled = Boolean(state.settingsIntegrations?.["Е-підпис"]);
  const eSignSettings = state.settingsIntegrationSettings?.["Е-підпис"] || {};
  const eSignProvider = eSignSettings.provider || "Вчасно / Дія.Підпис";
  const quickFilter = state.documentQuickFilter || "all";
  const hasManualDocumentFilters =
    Boolean((state.documentQuery || "").trim()) ||
    (state.documentStatusFilter || "all") !== "all" ||
    (state.documentTypeFilter || "all") !== "all" ||
    (state.documentClientFilter || "all") !== "all" ||
    (state.documentDueFilter || "all") !== "all" ||
    (state.documentCaseFilter || "all") !== "all" ||
    archiveScope === "storage" ||
    !archive.isAll;
  const allKpiActive = quickFilter === "all" && !hasManualDocumentFilters;
  const archiveTitle = archiveScope === "storage"
    ? storageArchiveActive === "all"
      ? "Усі архівні"
      : findArchiveFolder(storageArchiveFolders, storageArchiveActive)?.folder?.name || "Архів"
    : archive.isAll
    ? "Усі документи"
    : archive.selectedFolder?.name || (archive.selectedCase ? "Усі документи справи" : archive.selectedClient?.name || "Усі документи");
  const archiveSubtitle = archiveScope === "storage"
    ? storageArchiveActive === "all"
      ? "Самостійний архів без прив'язки до дерева справ"
      : "Папка самостійного архіву"
    : archive.isAll
    ? "Архів по всіх справах"
    : archive.selectedClient && !archive.selectedCase
    ? `Клієнт · ${archive.selectedClient.name}`
    : `№${archive.selectedCase?.id || selectedCase} · ${archive.selectedCase?.title || "Архів документів"}`;
  const documentsNode = $("#documents");
  const renderCaseFolderNodes = (caseItem, folders = [], clientId = "", depth = 0) => folders.map((folder) => {
    const count = filtered.filter((doc) => doc.caseId === caseItem.id && doc.folderName === folder.name).length || folderDocumentCount(folder);
    const active = archiveScope === "cases" && archive.selectedCase?.id === caseItem.id && archive.selectedFolder?.name === folder.name;
    return `
      <button class="documents-folder-node ${active ? "active" : ""}" type="button" data-document-folder-node="${folderKey(caseItem.id, folder.name)}" data-document-folder-case-id="${escapeHtml(caseItem.id)}" data-document-folder-name="${escapeHtml(folder.name)}" data-document-client-id="${clientId}" style="--level:${depth}">
        ${icon("file")}
        <span>${escapeHtml(folder.name)}</span>
        <em>${count}</em>
      </button>
      ${(folder.children || []).length ? renderCaseFolderNodes(caseItem, folder.children || [], clientId, depth + 1) : ""}
    `;
  }).join("");
  const renderStorageTree = (folders = [], depth = 0) => folders.map((folder) => {
    const active = archiveScope === "storage" && storageArchiveActive === folder.id;
    const docs = folder.documents || [];
    const nested = folder.children || [];
    return `
      <div class="documents-storage-folder ${active ? "open" : ""}">
        <div class="documents-storage-folder-row ${active ? "active" : ""}" style="--level:${depth}">
          <button class="documents-storage-folder-main" type="button" data-document-storage-folder="${folder.id}">
            <span class="documents-storage-folder-arrow">›</span>
            <i class="folder-icon" aria-hidden="true"></i>
            <strong>${escapeHtml(folder.name)}</strong>
            <em>${documentArchiveCount([folder])}</em>
          </button>
          ${actionMenu([
            { label: "Перейменувати", icon: "edit", attrs: { "data-archive-folder-rename": folder.id } },
            { label: "Додати підпапку", icon: "file", attrs: { "data-archive-folder-add-child": folder.id } },
            { label: "Видалити", icon: "trash", danger: true, attrs: { "data-archive-folder-delete": folder.id } }
          ], { label: "Дії папки архіву" })}
        </div>
        ${active ? `<div class="documents-folder-list documents-storage-doc-list">
          ${docs.map((doc) => `
            <button class="documents-folder-node" type="button" data-document-storage-doc="${doc.sourceKey || ""}">
              ${icon("file")}
              <span>${escapeHtml(doc.name)}</span>
              <em>№${doc.caseId || "-"}</em>
            </button>
          `).join("") || `<p class="documents-tree-empty">Документів у цій папці ще немає</p>`}
        </div>` : ""}
        ${nested.length ? `<div class="documents-storage-children">${renderStorageTree(nested, depth + 1)}</div>` : ""}
      </div>
    `;
  }).join("");

  documentsNode.innerHTML = `
    <div class="documents-screen">
      <div class="documents-toolbar panel">
        <div>
          <h2>Документи</h2>
          <p>Файли, процесуальні документи та матеріали по всіх справах</p>
        </div>
        <div class="documents-toolbar-actions">
          <button class="secondary" type="button" data-documents-ai ${selected ? "" : "disabled"}>${icon("search")} AI аналіз</button>
          <button class="secondary" type="button" data-documents-add-folder ${selectedCase ? "" : "disabled"}>${icon("file")} Створити папку</button>
          <button class="primary" type="button" data-documents-add ${hasCases ? "" : "disabled"}>${icon("file")} Додати документ</button>
        </div>
      </div>

      <div class="documents-kpi-grid">
        <button class="panel documents-kpi-card ${allKpiActive ? "active" : ""}" type="button" data-document-kpi="all"><span>${icon("file")}</span><div><strong>${rows.length}</strong><em>Усього документів</em></div></button>
        <button class="panel documents-kpi-card ${quickFilter === "submitted" ? "active" : ""}" type="button" data-document-kpi="submitted"><span class="green">${icon("check")}</span><div><strong>${submittedCount}</strong><em>Подано / отримано</em></div></button>
        <button class="panel documents-kpi-card ${quickFilter === "overdue" ? "active" : ""}" type="button" data-document-kpi="overdue"><span class="red">${icon("bell")}</span><div><strong>${overdueCount}</strong><em>Без відповіді в строк</em></div></button>
        <button class="panel documents-kpi-card ${quickFilter === "drafts" ? "active" : ""}" type="button" data-document-kpi="drafts"><span class="amber">${icon("edit")}</span><div><strong>${draftCount}</strong><em>Чернетки та не подано</em></div></button>
        <button class="panel documents-kpi-card ${quickFilter === "esign" ? "active" : ""}" type="button" data-document-kpi="esign"><span class="violet">${icon("signature")}</span><div><strong>${eSignCount}</strong><em>Електронний підпис</em></div></button>
        <button class="panel documents-kpi-card ${quickFilter === "ai" ? "active" : ""}" type="button" data-document-kpi="ai"><span class="violet">${icon("search")}</span><div><strong>${aiReadyCount}</strong><em>Готово для AI/Word</em></div></button>
      </div>

      <section class="panel documents-esign-overview">
        <div class="documents-esign-title">
          <span>${icon("signature")}</span>
          <div>
            <h3>Електронний підпис</h3>
            <p>Чернетка майбутнього сценарію: CRM готує документ, провайдер підписує КЕП, статус повертається у справу.</p>
          </div>
        </div>
        <div class="documents-esign-steps">
          <span class="active">1. Обрати документ</span>
          <span>2. Надіслати клієнту</span>
          <span>3. Отримати КЕП</span>
          <span>4. Зберегти в архів</span>
        </div>
        <div class="documents-esign-provider">
          ${badge(eSignEnabled ? "Підключено" : "Не підключено", eSignEnabled ? "green" : "amber")}
          <strong>${eSignProvider}</strong>
          <em>${eSignEnabled ? "Дані провайдера збережені в інтеграціях." : "Після вибору провайдера тут буде бойова відправка і перевірка статусу."}</em>
        </div>
      </section>

      <div class="documents-filters panel">
        <label class="documents-filter-field documents-filter-search">Пошук
          <input type="search" data-document-query placeholder="Документ, справа, клієнт, папка, орган..." value="${escapeHtml(state.documentQuery || "")}">
        </label>
        <label class="documents-filter-field">Статус
          <select data-document-status>
            ${optionHtml("all", "Всі статуси", state.documentStatusFilter)}
            ${statuses.map((status) => optionHtml(status, status, state.documentStatusFilter)).join("")}
          </select>
        </label>
        <label class="documents-filter-field">Тип
          <select data-document-type>
            ${optionHtml("all", "Всі типи", state.documentTypeFilter)}
            ${types.map((type) => optionHtml(type, type, state.documentTypeFilter)).join("")}
          </select>
        </label>
        <label class="documents-filter-field">Клієнт
          <select data-document-client>
            ${optionHtml("all", "Всі клієнти", state.documentClientFilter)}
            ${clients.map((client) => optionHtml(client.id, client.name, state.documentClientFilter)).join("")}
          </select>
        </label>
        <label class="documents-filter-field">Справа
          <select data-document-case>
            ${optionHtml("all", "Всі справи", state.documentCaseFilter)}
            ${filterCaseOptions.map((item) => optionHtml(item.id, `№${item.id} · ${item.title}`, state.documentCaseFilter)).join("")}
          </select>
        </label>
        <button class="secondary documents-filter-toggle ${state.documentDueFilter === "overdue" ? "active" : ""}" type="button" data-document-due-filter>${icon("bell")} Без відповіді</button>
        <button class="secondary documents-filter-reset" type="button" data-document-reset ${quickFilter === "all" && !hasManualDocumentFilters ? "disabled" : ""}>Скинути</button>
      </div>

      <div class="documents-layout">
        <div class="documents-left-rail">
          <aside class="documents-archive panel">
            <div class="documents-archive-head">
              <h3>Архів справ</h3>
              <span>${state.cases.length} справ</span>
            </div>
            <div class="documents-tree">
              <button class="documents-all-node ${archiveScope === "cases" && archive.isAll ? "active" : ""}" type="button" data-document-all-node>
                <span>${icon("file")}</span>
                <strong>Усі документи</strong>
                <em>${filtered.length}</em>
              </button>
              ${[...clientArchiveGroups.values()].map((group) => {
                const clientOpen = archiveScope === "cases" && (
                  String(state.documentArchiveClientId || "all") === group.id ||
                  group.cases.some(({ item }) => archive.selectedCase?.id === item.id)
                );
                return `
                  <div class="documents-tree-client ${clientOpen ? "open" : ""}">
                    <button class="documents-client-node ${archiveScope === "cases" && clientOpen && !archive.selectedCase ? "active" : ""}" type="button" data-document-client-node="${group.id}">
                      <span>${icon("briefcase")}</span>
                      <strong>${escapeHtml(group.name)}</strong>
                      <em>${group.count}</em>
                      <b class="documents-client-arrow">›</b>
                      <small>${group.cases.length} справ</small>
                    </button>
                    ${clientOpen ? `<div class="documents-client-case-list">
                      ${group.cases.map(({ item, rows: caseRows, folders }) => {
                        const isOpen = archiveScope === "cases" && archive.selectedCase?.id === item.id;
                        return `
                          <div class="documents-tree-case ${isOpen ? "open" : ""}">
                            <button class="documents-case-node ${isOpen && !archive.selectedFolder ? "active" : ""}" type="button" data-document-case-node="${item.id}" data-document-client-id="${group.id}">
                              <span>${icon("file")}</span>
                              <strong>№${item.id}</strong>
                              <em>${caseRows.length}</em>
                              <b class="documents-case-arrow">›</b>
                              <small>${escapeHtml(item.title)}</small>
                            </button>
                            ${isOpen ? `<div class="documents-folder-list">
                              ${renderCaseFolderNodes(item, folders, group.id) || `<p class="documents-tree-empty">Папок ще немає</p>`}
                            </div>` : ""}
                          </div>
                        `;
                      }).join("") || `<p class="documents-tree-empty">Папок ще немає</p>`}
                    </div>` : ""}
                  </div>
                `;
              }).join("")}
            </div>
          </aside>

          <aside class="documents-archive documents-storage-archive panel">
            <div class="documents-archive-head">
              <h3>Архів</h3>
              <span>${storageArchiveTotal} док.</span>
            </div>
            <button class="secondary documents-storage-add-folder" type="button" data-archive-folder-add-root><i class="folder-icon" aria-hidden="true"></i> Додати папку</button>
            <div class="documents-tree">
              <button class="documents-all-node ${archiveScope === "storage" && storageArchiveActive === "all" ? "active" : ""}" type="button" data-document-storage-folder="all">
                <span>${icon("archive")}</span>
                <strong>Усі архівні</strong>
                <em>${storageArchiveTotal}</em>
              </button>
              ${renderStorageTree(storageArchiveFolders) || `<p class="documents-tree-empty">Архівних папок ще немає</p>`}
            </div>
          </aside>
        </div>

        <section class="panel table-wrap documents-table-card">
          <div class="documents-folder-head">
            <div>
              <h3>${archiveTitle}</h3>
              <p>${archiveSubtitle}</p>
            </div>
            <div class="documents-folder-head-actions">
              <span>${tableRows.length} документів</span>
              ${archiveScope === "cases" && archive.selectedCase ? `<button class="secondary" type="button" data-documents-add-current>${icon("file")} Додати</button>` : ""}
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
                        { label: "Копіювати документ", icon: "file", attrs: { "data-copy-global-document": doc.key, "aria-label": "Копіювати документ" } },
                        { label: "Відправити", icon: "telegram", attrs: { "data-send-global-document": doc.key, "aria-label": "Відправити документ" } },
                        { label: E_SIGN_STATUSES.has(doc.status) ? "Перевірити підпис" : "На е-підпис", icon: "signature", attrs: { "data-esign-global-document": doc.key, "aria-label": "Електронний підпис" } },
                        { label: "ONLYOFFICE", icon: "file", attrs: { "data-office-global-document": doc.key, "aria-label": "Відкрити в ONLYOFFICE" } },
                        { label: "Експорт", icon: "fileUp", attrs: { "data-export-global-document": doc.key, "aria-label": "Експортувати документ" } },
                        { label: "Додати в архів", icon: "archive", attrs: { "data-archive-global-document": doc.key, "aria-label": "Додати документ в архів" } },
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
              <button class="secondary documents-action-button" type="button" data-view-global-document="${selected.key}">${icon("eye")} Відкрити</button>
              <button class="secondary documents-action-button" type="button" data-edit-global-document="${selected.key}">${icon("edit")} Редагувати</button>
              <button class="secondary documents-action-button" type="button" data-copy-global-document="${selected.key}">${icon("file")} Копіювати</button>
              <button class="secondary documents-action-button" type="button" data-send-global-document="${selected.key}">${icon("telegram")} Відправити</button>
              <button class="secondary documents-action-button" type="button" data-esign-global-document="${selected.key}">${icon("signature")} ${E_SIGN_STATUSES.has(selected.status) ? "Статус КЕП" : "На підпис"}</button>
              <button class="secondary documents-action-button" type="button" data-office-global-document="${selected.key}">${icon("file")} ONLYOFFICE</button>
              <button class="secondary documents-action-button" type="button" data-export-global-document="${selected.key}">${icon("fileUp")} Експорт</button>
              <button class="secondary documents-action-button" type="button" data-archive-global-document="${selected.key}">${icon("archive")} В архів</button>
              <button class="secondary documents-action-button" type="button" data-open-document-case="${selected.caseId}">${icon("briefcase")} Справа</button>
              <button class="secondary documents-action-button" type="button" data-documents-ai>${icon("search")} AI перевірка</button>
            </div>
            <div class="documents-esign-card ${E_SIGN_STATUSES.has(selected.status) ? "active" : ""}">
              <div>
                <span>${icon("signature")}</span>
                <strong>${E_SIGN_STATUSES.has(selected.status) ? selected.status : "Документ ще не на підписі"}</strong>
              </div>
              <p>${E_SIGN_STATUSES.has(selected.status)
                ? "CRM показує майбутній контроль е-підпису: очікування, перевірка, відмова або готовий підписаний файл."
                : "Натисніть «На підпис», щоб показати замовнику демо-перехід документа в процес КЕП."}</p>
              <small>Провайдер: ${eSignProvider}</small>
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

  setupDocumentFilterCustomSelects(documentsNode);

  const archiveDialog = $("#document-archive-dialog");
  const archiveForm = $("#document-archive-form");
  const archiveTarget = archiveDialog?.querySelector("[data-document-archive-target]");
  const archiveSelect = $("#document-archive-dialog-folder");
  const fillArchiveDialogFolders = () => {
    if (!archiveSelect) return;
    if (!archiveSelect.value && storageArchiveFolders[0]) archiveSelect.value = storageArchiveFolders[0].id;
    const picker = archiveDialog?.querySelector('[data-document-archive-picker="archive-dialog"]');
    if (!picker) return;
    picker.innerHTML = renderArchivePickerTree(storageArchiveFolders, archiveSelect.value, escapeHtml) || `<p>Архівних папок ще немає.</p>`;
    picker.querySelectorAll("[data-document-archive-pick]").forEach((button) => {
      button.addEventListener("click", () => {
        archiveSelect.value = button.dataset.documentArchivePick || "";
        fillArchiveDialogFolders();
      });
    });
  };
  const openArchiveDialog = (key) => {
    const doc = rows.find((row) => row.key === key);
    if (!doc || !archiveDialog || !archiveForm) return;
    archiveForm.reset();
    archiveForm.elements.documentKey.value = key;
    fillArchiveDialogFolders();
    if (archiveTarget) {
      archiveTarget.innerHTML = `
        <span aria-hidden="true">DOC</span>
        <div>
          <strong>${doc.name}</strong>
          <small>№${doc.caseId} · ${doc.client}</small>
        </div>
      `;
    }
    archiveDialog.showModal();
  };
  const addDocumentToStorageArchive = (key, folderId, newFolderName = "", comment = "") => {
    const doc = rows.find((row) => row.key === key);
    if (!doc) return false;
    let folder = findArchiveFolder(storageArchiveFolders, folderId)?.folder || null;
    if (newFolderName) {
      const name = String(newFolderName || "").trim() || "Нова папка архіву";
      let id = archiveFolderId(name);
      if (archiveFolderExists(storageArchiveFolders, id)) id = `${id}-${Date.now()}`;
      const nextFolder = { id, name, createdAt: new Date().toLocaleDateString("uk-UA"), documents: [], children: [] };
      if (folder) folder.children.unshift(nextFolder);
      else storageArchiveFolders.unshift(nextFolder);
      folder = nextFolder;
    }
    if (!folder) return false;
    if (!Array.isArray(folder.documents)) folder.documents = [];
    const archivedAt = new Date().toLocaleDateString("uk-UA");
    const existing = folder.documents.find((archiveDoc) => archiveDoc.sourceKey === key || archiveDoc.documentId && archiveDoc.documentId === doc.documentId);
    const payload = {
      sourceKey: key,
      documentId: doc.documentId,
      name: doc.name,
      type: doc.type,
      caseId: doc.caseId,
      caseTitle: doc.caseTitle,
      client: doc.client,
      folderName: doc.folderName,
      archivedAt,
      comment
    };
    if (existing) Object.assign(existing, payload);
    else folder.documents.unshift(payload);
    state.documentArchiveScope = "storage";
    state.documentStorageArchiveFolderId = folder.id;
    return true;
  };
  if (archiveForm) {
    archiveForm.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        archiveDialog?.close();
        return;
      }
      if (event.key !== "Enter" || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.target?.matches?.("textarea, button, [role='button']")) return;
      event.preventDefault();
      archiveForm.requestSubmit();
    });
    archiveForm.onsubmit = (event) => {
      if (event.submitter?.value === "cancel") return;
      event.preventDefault();
      const data = new FormData(archiveForm);
      const ok = addDocumentToStorageArchive(
        data.get("documentKey"),
        data.get("archiveFolderId"),
        data.get("newArchiveFolderName"),
        data.get("archiveComment")
      );
      if (!ok) {
        showToast("Не вдалося додати документ в архів.", "danger");
        return;
      }
      archiveDialog.close();
      renderDocumentsScreen(ctx);
      showToast("Документ додано в архів.");
    };
  }
  const archiveClose = $("#document-archive-close");
  if (archiveClose) archiveClose.onclick = () => archiveDialog?.close();
  const archiveCancel = $("#document-archive-cancel");
  if (archiveCancel) archiveCancel.onclick = () => archiveDialog?.close();
  const folderDialog = $("#document-archive-folder-dialog");
  const folderForm = $("#document-archive-folder-form");
  const openArchiveFolderDialog = ({ mode = "create", folderId = "", parentId = "" } = {}) => {
    if (!folderDialog || !folderForm) return;
    const existing = folderId ? findArchiveFolder(storageArchiveFolders, folderId)?.folder : null;
    folderForm.reset();
    folderForm.elements.mode.value = mode;
    folderForm.elements.folderId.value = folderId;
    folderForm.elements.parentId.value = parentId;
    folderForm.elements.name.value = existing?.name || "";
    $("#document-archive-folder-title").textContent = mode === "rename" ? "Перейменувати папку" : parentId ? "Нова підпапка" : "Нова папка";
    folderDialog.showModal();
  };
  if (folderForm) {
    folderForm.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        folderDialog?.close();
        return;
      }
      if (event.key !== "Enter" || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.target?.matches?.("textarea, button, [role='button']")) return;
      event.preventDefault();
      folderForm.requestSubmit($("#document-archive-folder-submit"));
    });
    folderForm.onsubmit = (event) => {
      if (event.submitter?.value === "cancel") return;
      event.preventDefault();
      const data = new FormData(folderForm);
      const name = String(data.get("name") || "").trim();
      if (!name) return;
      const mode = data.get("mode");
      const folderId = data.get("folderId");
      const parentId = data.get("parentId");
      if (mode === "rename") {
        const target = findArchiveFolder(storageArchiveFolders, folderId)?.folder;
        if (target) target.name = name;
      } else {
        let id = archiveFolderId(name);
        if (archiveFolderExists(storageArchiveFolders, id)) id = `${id}-${Date.now()}`;
        const folder = { id, name, createdAt: new Date().toLocaleDateString("uk-UA"), documents: [], children: [] };
        const parent = parentId ? findArchiveFolder(storageArchiveFolders, parentId)?.folder : null;
        if (parent) parent.children.unshift(folder);
        else storageArchiveFolders.unshift(folder);
        state.documentStorageArchiveFolderId = folder.id;
      }
      folderDialog.close();
      renderDocumentsScreen(ctx);
      showToast("Архівну папку збережено.");
    };
  }
  const folderClose = $("#document-archive-folder-close");
  if (folderClose) folderClose.onclick = () => folderDialog?.close();
  const folderCancel = $("#document-archive-folder-cancel");
  if (folderCancel) folderCancel.onclick = () => folderDialog?.close();
  const archiveDeleteDialog = $("#archive-folder-delete-dialog");
  const archiveDeleteTitle = $("#archive-folder-delete-title");
  const archiveDeleteText = $("#archive-folder-delete-text");
  const archiveDeleteClose = () => {
    if (archiveDeleteDialog?.open) archiveDeleteDialog.close();
  };
  const archiveDeleteCloseButton = $("#archive-folder-delete-close");
  const archiveDeleteCancelButton = $("#archive-folder-delete-cancel");
  if (archiveDeleteCloseButton) archiveDeleteCloseButton.onclick = archiveDeleteClose;
  if (archiveDeleteCancelButton) archiveDeleteCancelButton.onclick = archiveDeleteClose;
  const openArchiveFolderDeleteDialog = (folderId) => {
    const target = findArchiveFolder(storageArchiveFolders, folderId)?.folder;
    if (!target || !archiveDeleteDialog) return;
    const documentsCount = documentArchiveCount([target]);
    const hasChildren = Boolean((target.children || []).length);
    if (archiveDeleteTitle) archiveDeleteTitle.textContent = `Видалити папку «${target.name}»?`;
    if (archiveDeleteText) {
      archiveDeleteText.textContent = documentsCount || hasChildren
        ? `У папці є ${documentsCount} документів або підпапки. Вони також зникнуть з архівного дерева.`
        : "Папка порожня, її можна безпечно прибрати з архіву.";
    }
    const confirmButton = $("#archive-folder-delete-confirm");
    if (confirmButton) {
      confirmButton.onclick = () => {
        removeArchiveFolder(storageArchiveFolders, folderId);
        if (state.documentStorageArchiveFolderId === folderId || findArchiveFolder([target], state.documentStorageArchiveFolderId)) {
          state.documentStorageArchiveFolderId = "all";
        }
        archiveDeleteDialog.close();
        renderDocumentsScreen(ctx);
        showToast("Архівну папку видалено.");
      };
    }
    archiveDeleteDialog.showModal();
  };

  bindActionMenus?.(documentsNode);
  const selectDocumentPageCheckbox = documentsNode.querySelector("[data-select-document-page]");
  if (selectDocumentPageCheckbox) selectDocumentPageCheckbox.indeterminate = someDocumentsSelected;

  const openDocumentForArchive = () => {
    const targetCase = selectedCase || state.selectedCaseId || state.cases[0]?.id || "";
    if (!targetCase) return;
    openDocumentDialog(targetCase, null, "documents");
    if (selectedCase && selectedFolderIndex >= 0) {
      const folderSelect = $("#document-folder");
      if (folderSelect) {
        folderSelect.value = String(selectedFolderIndex);
        folderSelect.dispatchEvent(new Event("change", { bubbles: true }));
      }
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
  documentsNode.querySelectorAll("[data-documents-ai]").forEach((button) => {
    button.addEventListener("click", () => {
      showToast?.("AI перевірка документа буде підключена після API для документів.", "info");
    });
  });
  const documentApiId = (document) => {
    const id = document?.id || document?.documentId;
    const number = Number(id);
    return Number.isInteger(number) && number > 0 ? number : "";
  };
  const applySavedDocument = (payload, saved) => {
    if (!saved) return;
    const update = (target) => {
      if (!target) return;
      target.id = saved.id || target.id;
      target.documentId = saved.documentId || saved.id || target.documentId;
      target.name = saved.name || target.name;
      target.type = saved.type || target.type;
      target.folder = saved.folder || target.folder;
      target.status = saved.status || target.status;
      target.submitted = saved.submitted || target.submitted;
      target.responseDue = saved.responseDue || target.responseDue;
      target.comment = saved.comment || target.comment;
      target.content = saved.content || target.content;
      target.url = saved.url || target.url;
      target.history = saved.history || target.history || [];
    };
    update(payload.doc);
    update(payload.file);
    update(payload.linked?.file);
  };
  const savePayloadDocument = async (payload) => {
    if (!shouldUseApi(state) || !payload?.item) return null;
    const source = payload.doc || payload.file || payload.linked?.file;
    const saved = normalizeDocument(await saveDocumentToApi({
      ...source,
      id: documentApiId(source),
      caseId: payload.item.id,
      folder: payload.folder?.name || payload.linked?.folder?.name || source?.folder || "Процесуальні документи",
      name: source?.name || "Документ",
      type: source?.type || "Інше",
      status: source?.status || "Чернетка",
      submitted: source?.submitted || "-",
      responseDue: source?.responseDue || "-",
      comment: source?.comment || "",
      url: source?.url || "",
      responsible: source?.responsible || payload.item.responsible,
      history: source?.history || []
    }));
    applySavedDocument(payload, saved);
    return saved;
  };
  const deletePayloadDocument = async (payload) => {
    if (!shouldUseApi(state)) return;
    const source = payload?.doc || payload?.file || payload?.linked?.file;
    const id = documentApiId(source);
    if (id) await deleteDocumentFromApi(id);
  };
  const updateDocumentStatus = async (key, nextStatus) => {
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
    if (shouldUseApi(state)) {
      try {
        await savePayloadDocument(payload);
      } catch (_error) {
        showToast?.("Не вдалося зберегти статус документа в базі.", "danger");
        return;
      }
    }
    state.selectedDocumentKey = key;
    renderDocumentsScreen(ctx);
    showToast?.("Статус документа оновлено.");
  };
  const runESignDemoAction = async (key) => {
    const { caseId, encoded } = payloadFromKey(key);
    const payload = getDocumentPayload(caseId, encoded);
    const currentStatus = payload.doc?.status || payload.file?.status || payload.linked?.file?.status || "";
    let nextStatus = "Очікує е-підпис";
    let message = eSignEnabled
      ? "Документ відправлено на е-підпис."
      : "Демо: документ переведено в очікування е-підпису. Провайдера підключимо в налаштуваннях.";
    if (currentStatus === "Очікує е-підпис") {
      nextStatus = "Підписано КЕП";
      message = "Демо: провайдер повернув підписаний документ.";
    } else if (currentStatus === "Підписано КЕП") {
      showToast?.("Підпис уже отримано. Після API тут буде завантаження підписаного файлу.", "info");
      return;
    } else if (["Відхилено підпис", "Підпис прострочено"].includes(currentStatus)) {
      nextStatus = "Очікує е-підпис";
      message = "Документ повторно поставлено в чергу е-підпису.";
    }
    await updateDocumentStatus(key, nextStatus);
    showToast?.(message, eSignEnabled ? "success" : "info");
  };
  documentsNode.querySelectorAll("[data-document-status-pick]").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.stopPropagation();
      await updateDocumentStatus(button.dataset.documentStatusPick, button.dataset.documentStatusValue);
    });
  });
  documentsNode.querySelectorAll("[data-esign-global-document]").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.stopPropagation();
      await runESignDemoAction(button.dataset.esignGlobalDocument);
    });
  });
  documentsNode.querySelector("[data-document-status-change]")?.addEventListener("change", async (event) => {
    await updateDocumentStatus(event.currentTarget.dataset.documentStatusChange, event.currentTarget.value);
  });
  documentsNode.querySelectorAll("[data-document-date-change]").forEach((input) => {
    input.addEventListener("change", async (event) => {
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
      if (shouldUseApi(state)) {
        try {
          await savePayloadDocument(payload);
        } catch (_error) {
          showToast?.("Не вдалося зберегти дату документа в базі.", "danger");
          return;
        }
      }
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
      state.documentArchiveScope = "cases";
      state.documentArchiveClientId = "all";
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
    resetDocumentArchiveFilterScope(state);
    renderDocumentsScreen(ctx);
    const input = documentsNode.querySelector("[data-document-query]");
    input?.focus();
    input?.setSelectionRange(state.documentQuery.length, state.documentQuery.length);
  });
  documentsNode.querySelector("[data-document-status]")?.addEventListener("change", (event) => {
    state.documentQuickFilter = "all";
    state.documentStatusFilter = event.currentTarget.value;
    resetDocumentArchiveFilterScope(state);
    renderDocumentsScreen(ctx);
  });
  documentsNode.querySelector("[data-document-type]")?.addEventListener("change", (event) => {
    state.documentQuickFilter = "all";
    state.documentTypeFilter = event.currentTarget.value;
    resetDocumentArchiveFilterScope(state);
    renderDocumentsScreen(ctx);
  });
  documentsNode.querySelector("[data-document-client]")?.addEventListener("change", (event) => {
    state.documentQuickFilter = "all";
    state.documentClientFilter = event.currentTarget.value;
    state.documentCaseFilter = "all";
    state.documentArchiveScope = "cases";
    state.documentArchiveClientId = event.currentTarget.value;
    state.documentArchiveCaseId = "all";
    state.documentArchiveFolder = "";
    state.selectedDocumentKey = "";
    state.selectedDocumentKeys = [];
    renderDocumentsScreen(ctx);
  });
  documentsNode.querySelector("[data-document-case]")?.addEventListener("change", (event) => {
    state.documentQuickFilter = "all";
    state.documentCaseFilter = event.currentTarget.value;
    state.documentArchiveScope = "cases";
    if (event.currentTarget.value !== "all") {
      const selectedFilterCase = state.cases.find((item) => item.id === event.currentTarget.value);
      state.documentArchiveClientId = selectedFilterCase ? String(selectedFilterCase.clientId) : "all";
      state.documentArchiveCaseId = event.currentTarget.value;
      state.documentArchiveFolder = "";
    } else {
      state.documentArchiveClientId = "all";
      state.documentArchiveCaseId = "all";
      state.documentArchiveFolder = "";
    }
    state.selectedDocumentKeys = [];
    renderDocumentsScreen(ctx);
  });
  documentsNode.querySelector("[data-document-due-filter]")?.addEventListener("click", () => {
    state.documentQuickFilter = "all";
    state.documentDueFilter = state.documentDueFilter === "overdue" ? "all" : "overdue";
    resetDocumentArchiveFilterScope(state);
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
    state.documentArchiveScope = "cases";
    state.documentArchiveClientId = "all";
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
    button.addEventListener("click", async (event) => {
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
        if (shouldUseApi(state)) {
          try {
            await Promise.all(payloads.map(deletePayloadDocument));
          } catch (_error) {
            showToast?.("Не вдалося видалити вибрані документи з бази.", "danger");
            return;
          }
        }
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
      if (shouldUseApi(state)) {
        try {
          await Promise.all(selectedKeys.map((key) => {
            const { caseId, encoded } = payloadFromKey(key);
            return savePayloadDocument(getDocumentPayload(caseId, encoded));
          }));
        } catch (_error) {
          showToast?.("Не вдалося зберегти масову дію документів у базі.", "danger");
          return;
        }
      }
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
    state.documentArchiveScope = "cases";
    state.documentArchiveClientId = "all";
    state.documentArchiveCaseId = "all";
    state.documentArchiveFolder = "";
    state.documentCaseFilter = "all";
    state.selectedDocumentKey = "";
    state.selectedDocumentKeys = [];
    renderDocumentsScreen(ctx);
  });
  documentsNode.querySelectorAll("[data-document-client-node]").forEach((button) => {
    button.addEventListener("click", () => {
      state.documentArchiveScope = "cases";
      state.documentArchiveClientId = button.dataset.documentClientNode || "all";
      state.documentArchiveCaseId = "all";
      state.documentArchiveFolder = "";
      state.documentCaseFilter = "all";
      state.selectedDocumentKey = "";
      state.selectedDocumentKeys = [];
      renderDocumentsScreen(ctx);
    });
  });
  documentsNode.querySelectorAll("[data-document-case-node]").forEach((button) => {
    button.addEventListener("click", () => {
      state.documentArchiveScope = "cases";
      state.documentArchiveClientId = button.dataset.documentClientId || state.documentArchiveClientId || "all";
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
      const [fallbackCaseId, ...folderParts] = button.dataset.documentFolderNode.split("|");
      const caseId = button.dataset.documentFolderCaseId || fallbackCaseId;
      state.documentArchiveScope = "cases";
      state.documentArchiveClientId = button.dataset.documentClientId || state.documentArchiveClientId || "all";
      state.documentArchiveCaseId = caseId;
      state.documentArchiveFolder = button.dataset.documentFolderName || folderParts.join("|");
      state.documentCaseFilter = "all";
      state.selectedDocumentKey = "";
      state.selectedDocumentKeys = [];
      renderDocumentsScreen(ctx);
    });
  });
  documentsNode.querySelectorAll("[data-document-storage-folder]").forEach((button) => {
    button.addEventListener("click", () => {
      state.documentArchiveScope = "storage";
      state.documentStorageArchiveFolderId = button.dataset.documentStorageFolder || "all";
      state.selectedDocumentKey = "";
      state.selectedDocumentKeys = [];
      renderDocumentsScreen(ctx);
    });
  });
  documentsNode.querySelector("[data-archive-folder-add-root]")?.addEventListener("click", () => {
    openArchiveFolderDialog({ mode: "create" });
  });
  documentsNode.querySelectorAll("[data-archive-folder-add-child]").forEach((button) => {
    button.addEventListener("click", () => {
      openArchiveFolderDialog({ mode: "create", parentId: button.dataset.archiveFolderAddChild });
    });
  });
  documentsNode.querySelectorAll("[data-archive-folder-rename]").forEach((button) => {
    button.addEventListener("click", () => {
      openArchiveFolderDialog({ mode: "rename", folderId: button.dataset.archiveFolderRename });
    });
  });
  documentsNode.querySelectorAll("[data-archive-folder-delete]").forEach((button) => {
    button.addEventListener("click", () => {
      openArchiveFolderDeleteDialog(button.dataset.archiveFolderDelete);
    });
  });
  documentsNode.querySelectorAll("[data-document-storage-doc]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.documentStorageDoc;
      if (!key) return;
      state.documentArchiveScope = "storage";
      state.selectedDocumentKey = key;
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
  documentsNode.querySelectorAll("[data-export-global-document]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const { caseId, encoded } = payloadFromKey(button.dataset.exportGlobalDocument);
      const payload = getDocumentPayload(caseId, encoded);
      exportStoredDocument?.(payload.file || payload.doc, {
        caseId,
        editContext: payload,
        folderName: payload.folder?.name || payload.linked?.folder?.name,
        returnView: "documents"
      });
    });
  });
  documentsNode.querySelectorAll("[data-office-global-document]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const { caseId, encoded } = payloadFromKey(button.dataset.officeGlobalDocument);
      const payload = getDocumentPayload(caseId, encoded);
      openOfficeEditor?.(payload.file || payload.doc, {
        caseId,
        editContext: payload,
        folderName: payload.folder?.name || payload.linked?.folder?.name,
        returnView: "documents"
      });
    });
  });
  documentsNode.querySelectorAll("[data-archive-global-document]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      openArchiveDialog(button.dataset.archiveGlobalDocument);
    });
  });
  documentsNode.querySelectorAll("[data-edit-global-document]").forEach((button) => {
    button.addEventListener("click", () => {
      const { caseId, encoded } = payloadFromKey(button.dataset.editGlobalDocument);
      openDocumentDialog(caseId, getDocumentPayload(caseId, encoded), "documents");
    });
  });
  documentsNode.querySelectorAll("[data-copy-global-document]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      copyDocumentInCase(ctx, button.dataset.copyGlobalDocument);
    });
  });
  documentsNode.querySelectorAll("[data-send-global-document]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      openDocumentSendDialog(ctx, button.dataset.sendGlobalDocument);
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
