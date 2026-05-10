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
  $("#document-form").addEventListener("submit", (event) => {
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
      const update = (target) => {
        if (!target) return;
        target.documentId = documentId;
        target.name = name;
        target.type = form.get("type");
        target.status = form.get("status");
        target.submitted = submitted;
        target.responseDue = responseDue;
        target.comment = form.get("comment");
        target.fileName = nextFileName;
        target.fileObject = nextFileObject;
        target.url = nextUrl;
        target.source = nextSource;
        target.updated = today;
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
      switchView("cases");
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
    const documentId = makeDocumentId();
    item.documents.unshift({
      documentId,
      name,
      type: form.get("type"),
      status: form.get("status"),
      submitted,
      responseDue,
      comment: form.get("comment"),
      fileName,
      fileObject: fileName ? file : null,
      url,
      source,
      added: today
    });
    targetFolder.files.unshift({
      documentId,
      name,
      type: form.get("type"),
      status: form.get("status"),
      submitted,
      responseDue,
      comment: form.get("comment"),
      updated: today,
      fileName,
      fileObject: fileName ? file : null,
      url
    });
    targetFolder.updated = today;
    item.history.unshift({
      date: today,
      text: `Додано документ: ${name} у папку «${targetFolder.name}».`
    });
    state.selectedCaseId = item.id;
    state.openCaseSection = "documents";
    $("#document-dialog").close();
    renderAll();
    switchView("cases");
    showToast("Документ додано до справи.");
  });
}
