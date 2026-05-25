import { saveDocumentToApi, shouldUseApi, uploadDocumentFileToApi } from "../api.js";
import { normalizeDocument } from "../state.js";

const CASE_DOCUMENT_FOLDER_NAMES = ["Позови", "Клопотання", "Запити", "Відповіді та ухвали", "Інші документи"];
const PROCEDURAL_DOCUMENT_FOLDERS = new Set(["Позови", "Клопотання", "Запити", "Відповіді та ухвали"]);
const TECHNICAL_DOCUMENT_TYPES = new Set(["doc", "docx", "pdf", "txt", "rtf", "odt", "google docs", "google drive", "crm файл"]);

function inferCaseDocumentFolder(doc = {}, fallback = "Інші документи") {
  const haystack = [doc.type, doc.name, doc.folder, fallback].map((value) => String(value || "").toLowerCase()).join(" ");
  if (/клопотан|клопа/.test(haystack)) return "Клопотання";
  if (/адвокатськ.*запит|запит|витребуван/.test(haystack)) return "Запити";
  if (/ухвал|відповід|рішенн|постанова/.test(haystack)) return "Відповіді та ухвали";
  if (/позов|позовн|заява/.test(haystack)) return "Позови";
  if (fallback && !CASE_DOCUMENT_FOLDER_NAMES.includes(fallback)) return fallback;
  return CASE_DOCUMENT_FOLDER_NAMES.includes(fallback) ? "Інші документи" : fallback || "Інші документи";
}

function isProceduralCaseDocument(doc = {}, folderName = "") {
  const type = String(doc.type || "").trim().toLowerCase();
  if (TECHNICAL_DOCUMENT_TYPES.has(type)) return false;
  const folder = folderName || doc.folder || doc.folderName || "";
  if (PROCEDURAL_DOCUMENT_FOLDERS.has(folder)) return true;
  const haystack = [doc.type, doc.name, folder].map((value) => String(value || "").toLowerCase()).join(" ");
  return /позов|позовн|клопотан|адвокатськ.*запит|запит|ухвал|відповід|рішенн|постанова|пояснен|скарг|заява/.test(haystack);
}

function findOrCreateCaseFolder(folders = [], name = "Інші документи", today = "") {
  let folder = folders.find((entry) => entry.name === name);
  if (!folder) {
    folder = { name, updated: today, files: [], children: [] };
    folders.push(folder);
  }
  if (!Array.isArray(folder.files)) folder.files = [];
  if (!Array.isArray(folder.children)) folder.children = [];
  return folder;
}

function findOrCreateCaseSubfolder(parent, name = "Нова підпапка", today = "") {
  if (!parent) return null;
  if (!Array.isArray(parent.children)) parent.children = [];
  const cleanName = String(name || "").trim();
  if (!cleanName) return parent;
  let folder = parent.children.find((entry) => entry.name === cleanName);
  if (!folder) {
    folder = { name: cleanName, updated: today, files: [], children: [] };
    parent.children.push(folder);
  }
  if (!Array.isArray(folder.files)) folder.files = [];
  if (!Array.isArray(folder.children)) folder.children = [];
  return folder;
}

export function setupDocumentForm({
  state,
  $,
  caseById,
  caseFolders,
  findFolderFileByDocument,
  makeDocumentId,
  formatDate,
  renderAll,
  switchView,
  openOfficeEditor,
  showToast
}) {
  function numericId(value) {
    const number = Number(value);
    return Number.isInteger(number) && number > 0 ? number : "";
  }

  function escapeHtml(value = "") {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function archiveFolderId(name = "Архів") {
    return String(name)
      .trim()
      .toLowerCase()
      .replace(/[^a-zа-яіїєґ0-9]+/giu, "-")
      .replace(/^-+|-+$/g, "")
      || `archive-${Date.now()}`;
  }

  function ensureArchiveFolders() {
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
    return state.documentArchiveFolders;
  }

  function findArchiveFolderById(folders, id) {
    for (const folder of folders) {
      if (folder.id === id) return folder;
      const nested = findArchiveFolderById(folder.children || [], id);
      if (nested) return nested;
    }
    return null;
  }

  function resolveArchiveFolder(form, today) {
    const selected = form.get("archiveFolderId");
    const newFolderName = String(form.get("newArchiveFolderName") || "").trim();
    const folders = ensureArchiveFolders();
    if (selected && !newFolderName) return findArchiveFolderById(folders, selected);
    if (!selected && !newFolderName) return null;
    const name = newFolderName || "Нова папка архіву";
    let id = archiveFolderId(name);
    if (findArchiveFolderById(folders, id)) id = `${id}-${Date.now()}`;
    const folder = { id, name, createdAt: today, documents: [], children: [] };
    const parent = selected ? findArchiveFolderById(folders, selected) : null;
    if (parent) parent.children.unshift(folder);
    else folders.unshift(folder);
    return folder;
  }

  function addDocumentToArchive(folder, doc, item, today, comment = "") {
    if (!folder || !doc) return;
    if (!Array.isArray(folder.documents)) folder.documents = [];
    const sourceKey = item?.id ? `${item.id}|procedural:0` : "";
    const existing = folder.documents.find((archiveDoc) => archiveDoc.documentId && archiveDoc.documentId === doc.documentId);
    const payload = {
      sourceKey,
      documentId: doc.documentId,
      name: doc.name,
      type: doc.type,
      caseId: item?.id || "",
      caseTitle: item?.title || "",
      client: doc.client || "",
      folderName: doc.folder,
      archivedAt: today,
      comment
    };
    if (existing) Object.assign(existing, payload);
    else folder.documents.unshift(payload);
    state.documentArchiveScope = "storage";
    state.documentStorageArchiveFolderId = folder.id;
  }

  function removeDocumentFromArchive(documentId) {
    if (!documentId) return;
    const walk = (folders = []) => folders.forEach((folder) => {
      folder.documents = (folder.documents || []).filter((archiveDoc) => String(archiveDoc.documentId || "") !== String(documentId));
      walk(folder.children || []);
    });
    walk(ensureArchiveFolders());
  }

  function syncArchivedDocumentCopies(doc) {
    if (!doc?.documentId) return;
    const walk = (folders = []) => folders.forEach((folder) => {
      (folder.documents || []).forEach((archiveDoc) => {
        if (String(archiveDoc.documentId || "") !== String(doc.documentId)) return;
        archiveDoc.name = doc.name;
        archiveDoc.type = doc.type;
        archiveDoc.caseId = doc.caseId || archiveDoc.caseId || "";
        archiveDoc.caseTitle = doc.caseTitle || archiveDoc.caseTitle || "";
        archiveDoc.folderName = doc.folder || archiveDoc.folderName || "";
        archiveDoc.status = doc.status || archiveDoc.status || "";
      });
      walk(folder.children || []);
    });
    walk(ensureArchiveFolders());
  }

  function removeCaseDocumentCopies(caseItem, documentId, docIndex, linked) {
    if (!caseItem) return;
    if (documentId) {
      caseItem.documents = (caseItem.documents || []).filter((doc) => String(doc.documentId || doc.id || "") !== String(documentId));
      caseFolders(caseItem).forEach((folder) => {
        folder.files = (folder.files || []).filter((file) => String(file.documentId || file.id || "") !== String(documentId));
      });
      return;
    }
    if (docIndex >= 0) caseItem.documents.splice(docIndex, 1);
    if (linked?.folder && linked.fileIndex >= 0) linked.folder.files.splice(linked.fileIndex, 1);
  }

  function upsertCaseDocumentCopy(caseItem, doc, folder) {
    if (!caseItem || !doc || !folder) return;
    if (!Array.isArray(caseItem.documents)) caseItem.documents = [];
    if (!Array.isArray(folder.files)) folder.files = [];
    const documentId = doc.documentId || doc.id;
    const existingDoc = documentId
      ? caseItem.documents.find((itemDoc) => String(itemDoc.documentId || itemDoc.id || "") === String(documentId))
      : null;
    const shouldTrackProcedural = isProceduralCaseDocument(doc, folder.name);
    if (existingDoc && shouldTrackProcedural) Object.assign(existingDoc, doc);
    else if (existingDoc && !shouldTrackProcedural) {
      caseItem.documents = caseItem.documents.filter((itemDoc) => itemDoc !== existingDoc);
    } else if (shouldTrackProcedural) caseItem.documents.unshift(doc);
    const existingFile = documentId
      ? folder.files.find((file) => String(file.documentId || file.id || "") === String(documentId))
      : null;
    const folderFile = {
      id: doc.id,
      documentId,
      name: doc.name,
      type: doc.type,
      folder: doc.folder,
      status: doc.status,
      submitted: doc.submitted,
      responseDue: doc.responseDue,
      comment: doc.comment,
      content: doc.content,
      updated: doc.updated,
      fileName: doc.fileName,
      fileObject: doc.fileObject || null,
      fileUrl: doc.fileUrl || "",
      onlyOfficeCallbackUrl: doc.onlyOfficeCallbackUrl || "",
      url: doc.url || ""
    };
    if (existingFile) Object.assign(existingFile, folderFile);
    else folder.files.unshift(folderFile);
  }

  function safeFileName(value = "document") {
    return String(value || "document")
      .trim()
      .replace(/[\\/:*?"<>|]+/g, "-")
      .replace(/\s+/g, " ")
      .slice(0, 90) || "document";
  }

  function documentBaseName(value = "document") {
    return safeFileName(value || "document").replace(/\.(docx?|rtf|txt|pdf)$/i, "");
  }

  function documentBodyText({ item, name, type, folder, status, submitted, responseDue, comment, content }) {
    return [
      name || "Документ",
      "",
      `Справа: ${item ? `№${item.id}` : "Не вказано"}`,
      `Папка: ${folder || "Не вказано"}`,
      `Тип: ${type || "Не вказано"}`,
      `Статус: ${status || "Без статусу"}`,
      `Дата подання: ${submitted || "-"}`,
      `Строк відповіді: ${responseDue || "-"}`,
      "",
      content || comment || "Текст документа ще не заповнено."
    ].join("\n");
  }

  function buildDocumentHtml({ item, name, type, folder, status, submitted, responseDue, comment, content }) {
    const body = content || comment || "Текст документа ще не заповнено.";
    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(name || "Документ")}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #111827; line-height: 1.45; }
    h1 { font-size: 20px; margin: 0 0 12px; }
    .meta { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
    .meta td { border: 1px solid #d9e2ef; padding: 7px 9px; font-size: 12px; }
    .meta td:first-child { width: 170px; color: #5b6b82; font-weight: 700; }
    .content { white-space: pre-wrap; font-size: 14px; }
  </style>
</head>
<body>
  <h1>${escapeHtml(name || "Документ")}</h1>
  <table class="meta">
    <tr><td>Справа</td><td>${escapeHtml(item ? `№${item.id}` : "Не вказано")}</td></tr>
    <tr><td>Папка</td><td>${escapeHtml(folder || "Не вказано")}</td></tr>
    <tr><td>Тип</td><td>${escapeHtml(type || "Не вказано")}</td></tr>
    <tr><td>Статус</td><td>${escapeHtml(status || "Без статусу")}</td></tr>
    <tr><td>Дата подання</td><td>${escapeHtml(submitted || "-")}</td></tr>
    <tr><td>Строк відповіді</td><td>${escapeHtml(responseDue || "-")}</td></tr>
  </table>
  <div class="content">${escapeHtml(body)}</div>
</body>
</html>`;
  }

  function makeDocumentBlob(payload) {
    return new Blob(["\ufeff", buildDocumentHtml(payload)], { type: "application/msword;charset=utf-8" });
  }

  function crc32(bytes) {
    let crc = -1;
    for (const byte of bytes) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit += 1) {
        crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
      }
    }
    return (crc ^ -1) >>> 0;
  }

  function bytesFromString(value) {
    return new TextEncoder().encode(value);
  }

  function numberBytes(value, length) {
    return Array.from({ length }, (_, index) => (value >>> (index * 8)) & 0xff);
  }

  function zipStore(entries) {
    const chunks = [];
    const central = [];
    let offset = 0;
    entries.forEach(({ name, content }) => {
      const nameBytes = bytesFromString(name);
      const dataBytes = typeof content === "string" ? bytesFromString(content) : content;
      const checksum = crc32(dataBytes);
      const localHeader = new Uint8Array([
        ...numberBytes(0x04034b50, 4), ...numberBytes(20, 2), ...numberBytes(0, 2),
        ...numberBytes(0, 2), ...numberBytes(0, 2), ...numberBytes(0, 2),
        ...numberBytes(checksum, 4), ...numberBytes(dataBytes.length, 4),
        ...numberBytes(dataBytes.length, 4), ...numberBytes(nameBytes.length, 2),
        ...numberBytes(0, 2)
      ]);
      chunks.push(localHeader, nameBytes, dataBytes);
      central.push({ checksum, dataBytes, nameBytes, offset });
      offset += localHeader.length + nameBytes.length + dataBytes.length;
    });
    const centralStart = offset;
    central.forEach(({ checksum, dataBytes, nameBytes, offset: localOffset }) => {
      const header = new Uint8Array([
        ...numberBytes(0x02014b50, 4), ...numberBytes(20, 2), ...numberBytes(20, 2),
        ...numberBytes(0, 2), ...numberBytes(0, 2), ...numberBytes(0, 2),
        ...numberBytes(0, 2), ...numberBytes(checksum, 4),
        ...numberBytes(dataBytes.length, 4), ...numberBytes(dataBytes.length, 4),
        ...numberBytes(nameBytes.length, 2), ...numberBytes(0, 2),
        ...numberBytes(0, 2), ...numberBytes(0, 2), ...numberBytes(0, 2),
        ...numberBytes(0, 4), ...numberBytes(localOffset, 4)
      ]);
      chunks.push(header, nameBytes);
      offset += header.length + nameBytes.length;
    });
    const centralSize = offset - centralStart;
    chunks.push(new Uint8Array([
      ...numberBytes(0x06054b50, 4), ...numberBytes(0, 2), ...numberBytes(0, 2),
      ...numberBytes(entries.length, 2), ...numberBytes(entries.length, 2),
      ...numberBytes(centralSize, 4), ...numberBytes(centralStart, 4),
      ...numberBytes(0, 2)
    ]));
    return new Blob(chunks, { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  }

  function makeDocxBlob(payload) {
    const paragraphs = documentBodyText(payload).split("\n").map((line) => (
      `<w:p><w:r><w:t xml:space="preserve">${escapeHtml(line)}</w:t></w:r></w:p>`
    )).join("");
    return zipStore([
      {
        name: "[Content_Types].xml",
        content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
          + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
          + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
          + '<Default Extension="xml" ContentType="application/xml"/>'
          + '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
          + "</Types>"
      },
      {
        name: "_rels/.rels",
        content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
          + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
          + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
          + "</Relationships>"
      },
      {
        name: "word/document.xml",
        content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
          + '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
          + `<w:body>${paragraphs}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>`
          + '<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body>'
          + "</w:document>"
      }
    ]);
  }

  function rtfEscape(value = "") {
    return String(value).replace(/[\\{}]/g, "\\$&").replace(/[^\x00-\x7f]/g, (char) => {
      const code = char.charCodeAt(0);
      return `\\u${code > 32767 ? code - 65536 : code}?`;
    }).replace(/\n/g, "\\par\n");
  }

  function makeRtfBlob(payload) {
    const body = rtfEscape(documentBodyText(payload));
    return new Blob([`{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Arial;}}\\fs24 ${body}}`], { type: "application/rtf" });
  }

  function makeTextBlob(payload) {
    return new Blob(["\ufeff", documentBodyText(payload)], { type: "text/plain;charset=utf-8" });
  }

  function pdfEscape(value = "") {
    return String(value).replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
  }

  function makePdfBlob(payload) {
    const lines = documentBodyText(payload)
      .normalize("NFKD")
      .replace(/[^\x20-\x7E\n]/g, "?")
      .split("\n")
      .slice(0, 42);
    const stream = [
      "BT",
      "/F1 12 Tf",
      "50 790 Td",
      "16 TL",
      ...lines.map((line) => `(${pdfEscape(line.slice(0, 96))}) Tj T*`),
      "ET"
    ].join("\n");
    const objects = [
      "<< /Type /Catalog /Pages 2 0 R >>",
      "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
      `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`
    ];
    let pdf = "%PDF-1.4\n";
    const offsets = [0];
    objects.forEach((object, index) => {
      offsets.push(pdf.length);
      pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    });
    const xrefOffset = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    offsets.slice(1).forEach((offset) => {
      pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
    });
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    return new Blob([pdf], { type: "application/pdf" });
  }

  function makeDocumentFile(payload, format = "docx") {
    const normalizedFormat = ["docx", "doc", "rtf", "txt", "pdf"].includes(format) ? format : "docx";
    const baseName = documentBaseName(payload.name || "document");
    if (normalizedFormat === "docx") {
      return new File([makeDocxBlob(payload)], `${baseName}.docx`, { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    }
    if (normalizedFormat === "rtf") {
      return new File([makeRtfBlob(payload)], `${baseName}.rtf`, { type: "application/rtf" });
    }
    if (normalizedFormat === "txt") {
      return new File([makeTextBlob(payload)], `${baseName}.txt`, { type: "text/plain" });
    }
    if (normalizedFormat === "pdf") {
      return new File([makePdfBlob(payload)], `${baseName}.pdf`, { type: "application/pdf" });
    }
    return new File([makeDocumentBlob(payload)], `${baseName}.doc`, { type: "application/msword" });
  }

  async function uploadSavedFileIfNeeded(savedDocument, file) {
    if (!savedDocument?.id || !file?.name) return savedDocument;
    return normalizeDocument(await uploadDocumentFileToApi(savedDocument.id, file));
  }

  const documentForm = $("#document-form");
  const documentDialog = $("#document-dialog");
  const closeDocumentDialog = () => {
    if (documentDialog?.open) documentDialog.close();
  };
  $("#document-cancel-button")?.addEventListener("click", closeDocumentDialog);
  documentForm.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeDocumentDialog();
      return;
    }
    if (event.key !== "Enter" || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target;
    if (target?.matches?.("textarea, select, button, [role='button']")) return;
    event.preventDefault();
    documentForm.requestSubmit($("#document-submit-button"));
  });

  documentForm.addEventListener("submit", async (event) => {
    if (event.submitter?.value === "cancel") return;
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const targetMode = form.get("documentTargetMode") || "case";
    const editSource = form.get("editSource");
    const item = caseById(form.get("caseId"));
    if (!item && (targetMode !== "archive" || editSource)) {
      showToast("Оберіть справу, до якої потрібно додати документ.", "warning");
      return;
    }
    const file = form.get("file");
    const fileName = file && file.name ? file.name : "";
    const url = form.get("url");
    const name = form.get("name") || fileName || "Новий документ";
    const today = new Date().toLocaleDateString("uk-UA");
    const folders = item ? caseFolders(item) : [];
    const selectedFolder = form.get("folder");
    const source = fileName && url
      ? "Файл + Google посилання"
      : fileName
        ? "Файл з комп'ютера"
        : url
          ? "Google посилання"
          : "ONLYOFFICE";
    const submitted = form.get("submitted") ? formatDate(form.get("submitted")) : "-";
    const responseDue = form.get("responseDue") ? formatDate(form.get("responseDue")) : "-";
    const content = form.get("content") || "";
    const documentSourceMode = form.get("documentSourceMode") || (fileName ? "upload" : url ? "google" : "onlyoffice");
    const onlyOfficeCreateFormat = form.get("onlyOfficeCreateFormat") || "docx";
    const folderSelectElement = event.currentTarget.elements.folder;
    const folderValue = folderSelectElement?.value || "";
    if (documentSourceMode === "upload" && !fileName && !form.get("editSource")) {
      showToast("Оберіть файл з комп'ютера або змініть спосіб додавання документа.", "warning");
      return;
    }
    if (documentSourceMode === "google" && !url) {
      showToast("Додайте посилання на Google Doc або Drive.", "warning");
      return;
    }

    if (!editSource && targetMode === "archive") {
      const targetArchiveFolder = resolveArchiveFolder(form, today);
      if (!targetArchiveFolder) {
        showToast("Оберіть папку архіву або створіть нову.", "warning");
        return;
      }
      const localDocumentId = makeDocumentId();
      const documentCopyPayload = {
        item: null,
        name,
        type: form.get("type"),
        folder: targetArchiveFolder.name,
        status: form.get("status"),
        submitted,
        responseDue,
        comment: form.get("comment"),
        content
      };
      const uploadFile = fileName ? file : documentSourceMode === "onlyoffice" ? makeDocumentFile(documentCopyPayload, onlyOfficeCreateFormat) : null;
      let savedDocument = null;
      if (documentSourceMode === "onlyoffice" && shouldUseApi(state) && item) {
        try {
          savedDocument = normalizeDocument(await saveDocumentToApi({
            caseId: item.id,
            documentId: localDocumentId,
            name,
            type: form.get("type"),
            folder: targetArchiveFolder.name,
            status: form.get("status"),
            submitted,
            responseDue,
            comment: form.get("comment"),
            content,
            url,
            responsible: item.responsible,
            history: [{ date: today, text: `Створено архівний документ: ${name}.` }]
          }));
          savedDocument = await uploadSavedFileIfNeeded(savedDocument, uploadFile);
        } catch (_error) {
          showToast("Не вдалося створити файл для ONLYOFFICE у базі.", "danger");
          return;
        }
        item.documents.unshift(savedDocument);
      }
      const createdDocument = {
        ...savedDocument,
        id: savedDocument?.id,
        documentId: savedDocument?.documentId || savedDocument?.id || localDocumentId,
        name: savedDocument?.name || name,
        type: savedDocument?.type || form.get("type"),
        folder: savedDocument?.folder || targetArchiveFolder.name,
        status: savedDocument?.status || form.get("status"),
        submitted: savedDocument?.submitted || submitted,
        responseDue: savedDocument?.responseDue || responseDue,
        comment: savedDocument?.comment || form.get("comment"),
        content,
        fileName: savedDocument?.fileName || uploadFile?.name || fileName,
        fileObject: fileName ? file : uploadFile || null,
        fileUrl: savedDocument?.fileUrl || "",
        onlyOfficeCallbackUrl: savedDocument?.onlyOfficeCallbackUrl || "",
        url: savedDocument?.url || url,
        source: savedDocument?.source || source,
        added: today
      };
      addDocumentToArchive(targetArchiveFolder, createdDocument, savedDocument ? item : null, today, form.get("comment"));
      $("#document-dialog").close();
      renderAll();
      switchView("documents");
      if (documentSourceMode === "onlyoffice" && typeof openOfficeEditor === "function") {
        openOfficeEditor(createdDocument, { returnView: "documents" });
        showToast(createdDocument.fileUrl ? "Документ створено в архіві і відкрито в ONLYOFFICE." : "Документ створено в архіві. Для редагування в ONLYOFFICE потрібен серверний файл.");
        return;
      }
      showToast("Документ додано в архів.");
      return;
    }

    if (editSource) {
      const targetMode = form.get("documentTargetMode") || "case";
      const originalItem = caseById(form.get("originalCaseId")) || item;
      const docIndex = form.get("docIndex") === "" ? -1 : Number(form.get("docIndex"));
      const folderIndex = form.get("folderIndex") === "" ? -1 : Number(form.get("folderIndex"));
      const fileIndex = form.get("fileIndex") === "" ? -1 : Number(form.get("fileIndex"));
      const originalFolders = originalItem ? caseFolders(originalItem) : [];
      const doc = originalItem?.documents?.[docIndex];
      const linked = doc ? findFolderFileByDocument(originalItem, doc) : (
        folderIndex >= 0 ? { folder: originalFolders[folderIndex], folderIndex, file: originalFolders[folderIndex]?.files?.[fileIndex], fileIndex } : null
      );
      const folderFile = folderIndex >= 0 ? originalFolders[folderIndex]?.files[fileIndex] : linked?.file;
      const existingDocumentId = doc?.documentId || folderFile?.documentId || doc?.id || folderFile?.id || "";
      const documentId = existingDocumentId || makeDocumentId();
      const previousFileName = doc?.fileName || folderFile?.fileName || "";
      const previousFileObject = doc?.fileObject || folderFile?.fileObject || null;
      const previousUrl = doc?.url || folderFile?.url || "";
      const nextFileName = fileName || previousFileName;
      const nextFileObject = fileName ? file : previousFileObject;
      const nextUrl = url || previousUrl;
      const nextSource = fileName
        ? (nextUrl ? "Файл + Google посилання" : "Файл з комп'ютера")
        : nextUrl
          ? (nextFileName ? "Файл + Google посилання" : "Google посилання")
          : "ONLYOFFICE";
      const selectedFolderName = folders[Number(folderValue)]?.name;
      const folderName = inferCaseDocumentFolder(
        { name, type: form.get("type"), folder: selectedFolderName || linked?.folder?.name },
        selectedFolderName || linked?.folder?.name
      );
      const documentCopyPayload = {
        item,
        name,
        type: form.get("type"),
        folder: folderName,
        status: form.get("status"),
        submitted,
        responseDue,
        comment: form.get("comment"),
        content
      };
      const shouldGenerateOnlyOfficeFile = documentSourceMode === "onlyoffice" && !fileName && !nextFileName;
      const generatedUploadFile = shouldGenerateOnlyOfficeFile ? makeDocumentFile(documentCopyPayload, onlyOfficeCreateFormat) : null;
      let savedDocument = null;
      let targetArchiveFolder = null;
      if (targetMode === "archive") {
        targetArchiveFolder = resolveArchiveFolder(form, today);
        if (!targetArchiveFolder) {
          showToast("Оберіть папку архіву або створіть нову.", "warning");
          return;
        }
      }
      if (shouldUseApi(state)) {
        try {
          savedDocument = normalizeDocument(await saveDocumentToApi({
            id: doc?.id || folderFile?.id || numericId(documentId),
            documentId,
            caseId: item.id,
            name,
            type: form.get("type"),
            folder: folderName,
            status: form.get("status"),
            submitted,
            responseDue,
            comment: form.get("comment"),
            content,
            url: nextUrl,
            responsible: doc?.responsible || folderFile?.responsible || item.responsible,
            history: [
              { date: today, text: `Оновлено документ: ${name}.` },
              ...(doc?.history || folderFile?.history || [])
            ]
          }));
          savedDocument = await uploadSavedFileIfNeeded(
            savedDocument,
            fileName ? file : generatedUploadFile
          );
        } catch (_error) {
          showToast("Не вдалося зберегти документ у базі.", "danger");
          return;
        }
      }
      const updatedDocument = {
        ...(doc || folderFile || {}),
        ...savedDocument,
        id: savedDocument?.id || doc?.id || folderFile?.id,
        documentId: savedDocument?.documentId || savedDocument?.id || documentId,
        caseId: item.id,
        caseTitle: item.title || "",
        name: savedDocument?.name || name,
        type: savedDocument?.type || form.get("type"),
        folder: savedDocument?.folder || folderName,
        status: savedDocument?.status || form.get("status"),
        submitted: savedDocument?.submitted || submitted,
        responseDue: savedDocument?.responseDue || responseDue,
        comment: savedDocument?.comment || form.get("comment"),
        content: savedDocument?.content || content,
        fileName: savedDocument?.fileName || nextFileName || generatedUploadFile?.name || "",
        fileObject: nextFileObject || generatedUploadFile || null,
        fileUrl: savedDocument?.fileUrl || doc?.fileUrl || folderFile?.fileUrl || "",
        onlyOfficeCallbackUrl: savedDocument?.onlyOfficeCallbackUrl || doc?.onlyOfficeCallbackUrl || folderFile?.onlyOfficeCallbackUrl || "",
        url: savedDocument?.url || nextUrl,
        source: nextSource,
        added: doc?.added || today,
        updated: today,
        history: savedDocument?.history || doc?.history || folderFile?.history || []
      };
      const targetFolder = findOrCreateCaseFolder(folders, folderName, today);
      removeCaseDocumentCopies(originalItem, existingDocumentId, docIndex, linked);
      upsertCaseDocumentCopy(item, updatedDocument, targetFolder);
      targetFolder.updated = today;
      syncArchivedDocumentCopies(updatedDocument);
      if (targetMode === "archive") {
        addDocumentToArchive(targetArchiveFolder, updatedDocument, item, today, form.get("comment"));
      } else {
        removeDocumentFromArchive(updatedDocument.documentId);
      }
      item.history.unshift({
        date: today,
        text: targetMode === "archive"
          ? `Оновлено документ і додано в архів: ${name}.`
          : `Оновлено документ: ${name}.`
      });
      state.selectedCaseId = item.id;
      state.openCaseSection = "documents";
      state.documentArchiveScope = targetMode === "archive" ? "storage" : "cases";
      if (targetMode === "archive") state.documentStorageArchiveFolderId = targetArchiveFolder.id;
      else {
        state.documentArchiveClientId = String(item.clientId || "all");
        state.documentArchiveCaseId = item.id;
        state.documentArchiveFolder = targetFolder.name;
      }
      $("#document-dialog").close();
      renderAll();
      switchView(state.documentDialogReturnView || "cases");
      showToast(targetMode === "archive" ? "Документ оновлено і додано в архів." : "Документ оновлено.");
      return;
    }

    let targetFolder = folders[Number(folderValue)] || folders[Number(selectedFolder)] || folders[0];
    const requestedSubfolderName = String(form.get("newFolderName") || "").trim();
    if (folderValue === "__new__" || selectedFolder === "__new__") {
      const folderName = requestedSubfolderName || "Нова папка";
      targetFolder = { name: folderName, updated: today, files: [], children: [] };
      folders.push(targetFolder);
      state.openFolderIndex = folders.length - 1;
    } else {
      const inferredFolderName = inferCaseDocumentFolder(
        { name, type: form.get("type"), folder: targetFolder?.name },
        targetFolder?.name
      );
      targetFolder = findOrCreateCaseFolder(folders, inferredFolderName, today);
      if (requestedSubfolderName) {
        targetFolder = findOrCreateCaseSubfolder(targetFolder, requestedSubfolderName, today);
      }
      state.openFolderIndex = folders.findIndex((folder) => folder === targetFolder);
    }
    const documentCopyPayload = {
      item,
      name,
      type: form.get("type"),
      folder: targetFolder?.name || "Процесуальні документи",
      status: form.get("status"),
      submitted,
      responseDue,
      comment: form.get("comment"),
      content
    };
    const uploadFile = fileName ? file : documentSourceMode === "onlyoffice" ? makeDocumentFile(documentCopyPayload, onlyOfficeCreateFormat) : null;
    const localDocumentId = makeDocumentId();
    let savedDocument = null;
    if (shouldUseApi(state)) {
      try {
        savedDocument = normalizeDocument(await saveDocumentToApi({
          caseId: item.id,
          documentId: localDocumentId,
          name,
          type: form.get("type"),
          folder: targetFolder.name,
          status: form.get("status"),
          submitted,
          responseDue,
          comment: form.get("comment"),
          content,
          url,
          responsible: item.responsible,
          history: [{ date: today, text: `Додано документ: ${name} у папку «${targetFolder.name}».` }]
        }));
        savedDocument = await uploadSavedFileIfNeeded(savedDocument, uploadFile);
      } catch (_error) {
        showToast("Не вдалося створити документ у базі.", "danger");
        return;
      }
    }
    const documentId = savedDocument?.documentId || savedDocument?.id || localDocumentId;
    const createdDocument = {
      ...savedDocument,
      id: savedDocument?.id,
      documentId,
      name: savedDocument?.name || name,
      type: savedDocument?.type || form.get("type"),
      folder: savedDocument?.folder || targetFolder.name,
      status: savedDocument?.status || form.get("status"),
      submitted: savedDocument?.submitted || submitted,
      responseDue: savedDocument?.responseDue || responseDue,
      comment: savedDocument?.comment || form.get("comment"),
      content: savedDocument?.content || content,
      fileName: savedDocument?.fileName || uploadFile?.name || fileName,
      fileObject: fileName ? file : uploadFile || null,
      fileUrl: savedDocument?.fileUrl || "",
      onlyOfficeCallbackUrl: savedDocument?.onlyOfficeCallbackUrl || "",
      url: savedDocument?.url || url,
      source,
      added: today
    };
    const shouldTrackProcedural = isProceduralCaseDocument(createdDocument, targetFolder.name);
    if (shouldTrackProcedural) item.documents.unshift(createdDocument);
    const createdFolderFile = {
      id: savedDocument?.id,
      documentId,
      name: savedDocument?.name || name,
      type: savedDocument?.type || form.get("type"),
      folder: savedDocument?.folder || targetFolder.name,
      status: savedDocument?.status || form.get("status"),
      submitted: savedDocument?.submitted || submitted,
      responseDue: savedDocument?.responseDue || responseDue,
      comment: savedDocument?.comment || form.get("comment"),
      content: savedDocument?.content || content,
      updated: today,
      fileName: savedDocument?.fileName || uploadFile?.name || fileName,
      fileObject: fileName ? file : uploadFile || null,
      fileUrl: savedDocument?.fileUrl || "",
      onlyOfficeCallbackUrl: savedDocument?.onlyOfficeCallbackUrl || "",
      url: savedDocument?.url || url
    };
    targetFolder.files.unshift(createdFolderFile);
    targetFolder.updated = today;
    item.history.unshift({
      date: today,
      text: `Додано документ: ${name} у папку «${targetFolder.name}».`
    });
    state.selectedCaseId = item.id;
    state.openCaseSection = "documents";
    state.documentArchiveScope = "cases";
    state.documentArchiveClientId = String(item.clientId || "all");
    state.documentArchiveCaseId = item.id;
    state.documentArchiveFolder = targetFolder.name;
    const folderIndex = folders.findIndex((folder) => folder === targetFolder);
    state.selectedDocumentKey = shouldTrackProcedural
      ? `${item.id}|procedural:0`
      : `${item.id}|folder:${Math.max(folderIndex, 0)}:0`;
    $("#document-dialog").close();
    renderAll();
    switchView(state.documentDialogReturnView || "cases");
    if (documentSourceMode === "onlyoffice" && typeof openOfficeEditor === "function") {
      openOfficeEditor(createdDocument, { caseId: item.id, returnView: state.documentDialogReturnView || "documents" });
      showToast("Документ створено в CRM і відкрито в ONLYOFFICE.");
      return;
    }
    showToast("Документ додано до справи.");
  });
}
