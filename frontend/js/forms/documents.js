import { saveDocumentToApi, shouldUseApi, uploadDocumentFileToApi } from "../api.js";
import { normalizeDocument } from "../state.js";

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
    state.documentStorageArchiveFolderId = folder.id;
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

  $("#document-form").addEventListener("submit", async (event) => {
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
      const createdDocument = {
        documentId: localDocumentId,
        name,
        type: form.get("type"),
        folder: targetArchiveFolder.name,
        status: form.get("status"),
        submitted,
        responseDue,
        comment: form.get("comment"),
        content,
        fileName: uploadFile?.name || fileName,
        fileObject: fileName ? file : uploadFile || null,
        fileUrl: "",
        onlyOfficeCallbackUrl: "",
        url,
        source,
        added: today
      };
      addDocumentToArchive(targetArchiveFolder, createdDocument, null, today, form.get("comment"));
      $("#document-dialog").close();
      renderAll();
      switchView("documents");
      showToast("Документ додано в архів.");
      return;
    }

    if (editSource) {
      const docIndex = form.get("docIndex") === "" ? -1 : Number(form.get("docIndex"));
      const folderIndex = form.get("folderIndex") === "" ? -1 : Number(form.get("folderIndex"));
      const fileIndex = form.get("fileIndex") === "" ? -1 : Number(form.get("fileIndex"));
      const doc = item.documents[docIndex];
      const linked = doc ? findFolderFileByDocument(item, doc) : null;
      const folderFile = folderIndex >= 0 ? folders[folderIndex]?.files[fileIndex] : linked?.file;
      const documentId = doc?.documentId || folderFile?.documentId || makeDocumentId();
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
      const selectedFolderName = folders[Number(form.get("folder"))]?.name;
      const folderName = folders[folderIndex]?.name || linked?.folder?.name || selectedFolderName || "Процесуальні документи";
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
      const update = (target) => {
        if (!target) return;
        target.id = savedDocument?.id || target.id;
        target.documentId = savedDocument?.documentId || savedDocument?.id || documentId;
        target.name = savedDocument?.name || name;
        target.type = savedDocument?.type || form.get("type");
        target.folder = savedDocument?.folder || folderName;
        target.status = savedDocument?.status || form.get("status");
        target.submitted = savedDocument?.submitted || submitted;
        target.responseDue = savedDocument?.responseDue || responseDue;
        target.comment = savedDocument?.comment || form.get("comment");
        target.content = savedDocument?.content || content;
        target.fileName = savedDocument?.fileName || nextFileName || generatedUploadFile?.name || "";
        target.fileObject = nextFileObject || generatedUploadFile || null;
        target.fileUrl = savedDocument?.fileUrl || target.fileUrl || "";
        target.onlyOfficeCallbackUrl = savedDocument?.onlyOfficeCallbackUrl || target.onlyOfficeCallbackUrl || "";
        target.url = savedDocument?.url || nextUrl;
        target.source = nextSource;
        target.updated = today;
        target.history = savedDocument?.history || target.history || [];
      };
      update(doc);
      update(folderFile);
      if (doc) {
        doc.added = doc.added || today;
      }
      if (folderFile) {
        const changedFolder = folders[folderIndex] || linked?.folder;
        if (changedFolder) changedFolder.updated = today;
      }
      item.history.unshift({
        date: today,
        text: `Оновлено документ: ${name}.`
      });
      state.selectedCaseId = item.id;
      $("#document-dialog").close();
      renderAll();
      switchView(state.documentDialogReturnView || "cases");
      showToast("Документ оновлено.");
      return;
    }

    let targetFolder = folders[Number(selectedFolder)] || folders[0];
    if (selectedFolder === "__new__") {
      const folderName = form.get("newFolderName") || "Нова папка";
      targetFolder = { name: folderName, updated: today, files: [] };
      folders.push(targetFolder);
      state.openFolderIndex = folders.length - 1;
    } else {
      state.openFolderIndex = Number(selectedFolder);
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
    const targetArchiveFolder = resolveArchiveFolder(form, today);
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
    item.documents.unshift(createdDocument);
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
    addDocumentToArchive(targetArchiveFolder, createdDocument, item, today, form.get("comment"));
    item.history.unshift({
      date: today,
      text: `Додано документ: ${name} у папку «${targetFolder.name}».`
    });
    state.selectedCaseId = item.id;
    state.openCaseSection = "documents";
    state.documentArchiveCaseId = item.id;
    state.documentArchiveFolder = targetFolder.name;
    state.selectedDocumentKey = `${item.id}|procedural:0`;
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
