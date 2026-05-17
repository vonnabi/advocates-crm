import { saveDocumentToApi, shouldUseApi } from "../api.js";
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
  showToast
}) {
  function numericId(value) {
    const number = Number(value);
    return Number.isInteger(number) && number > 0 ? number : "";
  }

  $("#document-form").addEventListener("submit", async (event) => {
    if (event.submitter?.value === "cancel") return;
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const item = caseById(form.get("caseId"));
    const file = form.get("file");
    const fileName = file && file.name ? file.name : "";
    const url = form.get("url");
    const name = form.get("name") || fileName || "Новий документ";
    const today = new Date().toLocaleDateString("uk-UA");
    const folders = caseFolders(item);
    const selectedFolder = form.get("folder");
    const editSource = form.get("editSource");
    const source = fileName && url ? "Файл + Google посилання" : fileName ? "Файл з комп'ютера" : url ? "Google посилання" : "Опис без файлу";
    const submitted = form.get("submitted") ? formatDate(form.get("submitted")) : "-";
    const responseDue = form.get("responseDue") ? formatDate(form.get("responseDue")) : "-";

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
          : "Опис без файлу";
      const selectedFolderName = folders[Number(form.get("folder"))]?.name;
      const folderName = folders[folderIndex]?.name || linked?.folder?.name || selectedFolderName || "Процесуальні документи";
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
            url: nextUrl,
            responsible: doc?.responsible || folderFile?.responsible || item.responsible,
            history: [
              { date: today, text: `Оновлено документ: ${name}.` },
              ...(doc?.history || folderFile?.history || [])
            ]
          }));
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
        target.fileName = nextFileName;
        target.fileObject = nextFileObject;
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
          url,
          responsible: item.responsible,
          history: [{ date: today, text: `Додано документ: ${name} у папку «${targetFolder.name}».` }]
        }));
      } catch (_error) {
        showToast("Не вдалося створити документ у базі.", "danger");
        return;
      }
    }
    const documentId = savedDocument?.documentId || savedDocument?.id || localDocumentId;
    item.documents.unshift({
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
      fileName,
      fileObject: fileName ? file : null,
      url: savedDocument?.url || url,
      source,
      added: today
    });
    targetFolder.files.unshift({
      id: savedDocument?.id,
      documentId,
      name: savedDocument?.name || name,
      type: savedDocument?.type || form.get("type"),
      folder: savedDocument?.folder || targetFolder.name,
      status: savedDocument?.status || form.get("status"),
      submitted: savedDocument?.submitted || submitted,
      responseDue: savedDocument?.responseDue || responseDue,
      comment: savedDocument?.comment || form.get("comment"),
      updated: today,
      fileName,
      fileObject: fileName ? file : null,
      url: savedDocument?.url || url
    });
    targetFolder.updated = today;
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
    showToast("Документ додано до справи.");
  });
}
