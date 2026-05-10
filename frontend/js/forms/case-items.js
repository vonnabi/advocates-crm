export function setupCaseItemForms({ state, $, caseById, caseFolders, formatDate, renderAll, switchView, showToast }) {
  $("#task-form").addEventListener("submit", (event) => {
    if (event.submitter?.value === "cancel") return;
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const taskIndex = form.get("taskIndex") === "" ? null : Number(form.get("taskIndex"));
    const item = caseById(taskIndex !== null ? event.currentTarget.dataset.originalCaseId : form.get("caseId"));
    const due = form.get("due");
    const title = form.get("title");
    if (taskIndex !== null) {
      const task = item.tasks[taskIndex];
      if (!task) return;
      task.title = title;
      task.status = form.get("status");
      task.responsible = form.get("responsible");
      task.due = due ? formatDate(due) : "Не вказано";
      task.showInCalendar = Boolean(form.get("showInCalendar") && due);
      item.history.unshift({
        date: new Date().toLocaleDateString("uk-UA"),
        text: `Оновлено задачу: ${title}.`
      });
      state.selectedCaseId = item.id;
      $("#task-dialog").close();
      renderAll();
      switchView(state.taskDialogReturnView || "cases");
      showToast("Задачу оновлено.");
      return;
    }
    item.tasks.unshift({
      title,
      status: form.get("status"),
      responsible: form.get("responsible"),
      due: due ? formatDate(due) : "Не вказано",
      showInCalendar: Boolean(form.get("showInCalendar") && due)
    });
    item.history.unshift({
      date: new Date().toLocaleDateString("uk-UA"),
      text: `Додано задачу: ${title}.`
    });
    state.selectedCaseId = item.id;
    state.openCaseSection = "tasks";
    $("#task-dialog").close();
    renderAll();
    switchView(state.taskDialogReturnView || "cases");
    showToast("Задачу додано.");
  });

  $("#folder-form").addEventListener("submit", (event) => {
    if (event.submitter?.value === "cancel") return;
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const item = caseById(form.get("caseId"));
    const name = form.get("name");
    const folderIndex = form.get("folderIndex") === "" ? null : Number(form.get("folderIndex"));
    const folders = caseFolders(item);
    const today = new Date().toLocaleDateString("uk-UA");
    if (folderIndex !== null) {
      const folder = folders[folderIndex];
      if (!folder) return;
      const previousName = folder.name;
      folder.name = name;
      folder.updated = today;
      item.history.unshift({
        date: today,
        text: `Папку документів перейменовано: ${previousName} → ${name}.`
      });
      state.selectedCaseId = item.id;
      $("#folder-dialog").close();
      renderAll();
      switchView("cases");
      showToast("Папку перейменовано.");
      return;
    }
    folders.push({
      name,
      updated: today,
      files: []
    });
    item.history.unshift({
      date: today,
      text: `Створено папку документів: ${name}.`
    });
    state.selectedCaseId = item.id;
    $("#folder-dialog").close();
    renderAll();
    switchView("cases");
    showToast("Папку створено.");
  });
}
