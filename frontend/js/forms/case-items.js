import { saveCaseToApi, saveTaskToApi, shouldUseApi } from "../api.js";
import { normalizeCase, normalizeTask } from "../state.js";

export function setupCaseItemForms({ state, $, caseById, caseFolders, formatDate, renderAll, switchView, showToast }) {
  function defaultSubtasksForTask(task = {}, fallbackResponsible = "") {
    return [
      { title: "Перевірити вихідні матеріали", responsible: fallbackResponsible, due: task.due || "Не вказано", status: task.completed ? "Виконано" : "В роботі" },
      { title: "Підготувати результат по задачі", responsible: fallbackResponsible, due: task.plannerDateText || task.due || "Не вказано", status: task.completed ? "Виконано" : "Нова" }
    ];
  }

  function taskPayloadFromForm(form, due, existing = {}) {
    const title = form.get("title");
    const priority = form.get("priority") || "Середній";
    const plannerManual = Boolean(form.get("plannerManual"));
    const plannerImportant = Boolean(form.get("plannerImportant"));
    const coexecutors = form.getAll("coexecutors").filter(Boolean);
    const reminderEnabled = Boolean(form.get("reminderEnabled"));
    const plannerDate = form.get("plannerDate");
    const plannerTime = form.get("plannerTime");
    const comment = String(form.get("comment") || "").trim();
    const today = new Date().toLocaleDateString("uk-UA");
    const comments = [...(existing.comments || [])];
    if (comment && comment !== existing.comment && !comments.some((item) => item.text === comment)) {
      comments.unshift({
        author: form.get("responsible") || "Іваненко А.Ю.",
        date: today,
        text: comment
      });
    }
    const responsible = form.get("responsible") || existing.responsible || "Іваненко А.Ю.";
    const dueText = due ? formatDate(due) : "Не вказано";
    const subtaskStatuses = form.getAll("subtaskStatus");
    const formSubtasks = form.getAll("subtaskTitle")
      .map((value, index) => {
        const subtaskTitle = String(value || "").trim();
        if (!subtaskTitle) return null;
        const previous = existing.subtasks?.[index] || {};
        return {
          ...previous,
          title: subtaskTitle,
          status: subtaskStatuses[index] || previous.status || "Нова",
          responsible,
          due: dueText
        };
      })
      .filter(Boolean);
    const fallbackSubtasks = [
      { title: "Перевірити вихідні матеріали", status: "В роботі", responsible, due: dueText },
      { title: "Підготувати результат по задачі", status: "Нова", responsible, due: dueText }
    ];
    return {
      ...existing,
      title,
      status: form.get("status"),
      priority,
      responsible,
      due: dueText,
      description: String(form.get("description") || "").trim(),
      coexecutors,
      showInCalendar: Boolean(form.get("showInCalendar") && due),
      plannerManual,
      plannerImportant,
      plannerDate,
      plannerDateText: plannerDate ? formatDate(plannerDate) : "",
      plannerTime,
      reminderEnabled,
      reminderBefore: form.get("reminderBefore") || "За 1 день",
      reminderChannel: form.get("reminderChannel") || "CRM",
      comment,
      comments,
      subtasks: formSubtasks.length ? formSubtasks : existing.subtasks || fallbackSubtasks,
      files: existing.files || [],
      history: [
        {
          date: today,
          text: existing.title ? `Оновлено задачу: ${title}.` : `Створено задачу: ${title}.`
        },
        ...(existing.history || [])
      ]
    };
  }

  $("#task-form").addEventListener("submit", async (event) => {
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
      let nextTask = {
        ...taskPayloadFromForm(form, due, task),
        caseId: item.id,
        clientId: item.clientId
      };
      if (shouldUseApi(state)) {
        try {
          nextTask = normalizeTask(await saveTaskToApi(nextTask));
        } catch (_error) {
          showToast("Не вдалося зберегти задачу в базі.", "danger");
          return;
        }
      }
      item.tasks[taskIndex] = nextTask;
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
    let nextTask = {
      ...taskPayloadFromForm(form, due),
      caseId: item.id,
      clientId: item.clientId
    };
    if (shouldUseApi(state)) {
      try {
        nextTask = normalizeTask(await saveTaskToApi(nextTask));
      } catch (_error) {
        showToast("Не вдалося створити задачу в базі.", "danger");
        return;
      }
    }
    item.tasks.unshift(nextTask);
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

  $("#subtask-form").addEventListener("submit", async (event) => {
    if (event.submitter?.value === "cancel") return;
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const item = caseById(form.get("caseId"));
    const taskIndex = Number(form.get("taskIndex"));
    const subtaskIndex = form.get("subtaskIndex") === "" ? null : Number(form.get("subtaskIndex"));
    const task = item?.tasks?.[taskIndex];
    if (!item || !task) return;
    const title = String(form.get("title") || "").trim();
    if (!title) return;
    const due = form.get("due");
    const responsible = form.get("responsible") || task.responsible || item.responsible || "Іваненко А.Ю.";
    const subtasks = task.subtasks?.length
      ? [...task.subtasks]
      : defaultSubtasksForTask(task, task.responsible || item.responsible || responsible);
    const previous = subtaskIndex === null ? {} : subtasks[subtaskIndex] || {};
    const payload = {
      ...previous,
      title,
      status: form.get("status") || previous.status || "Нова",
      responsible,
      due: due ? formatDate(due) : previous.due || task.due || "Не вказано"
    };
    const nextSubtasks = [...subtasks];
    if (subtaskIndex === null) {
      nextSubtasks.push(payload);
    } else {
      nextSubtasks[subtaskIndex] = payload;
    }
    let nextTask = {
      ...task,
      caseId: item.id,
      clientId: item.clientId,
      subtasks: nextSubtasks,
      history: [
        {
          date: new Date().toLocaleDateString("uk-UA"),
          text: subtaskIndex === null ? `Додано підзадачу: ${title}.` : `Оновлено підзадачу: ${title}.`
        },
        ...(task.history || [])
      ]
    };
    if (shouldUseApi(state)) {
      try {
        nextTask = normalizeTask(await saveTaskToApi(nextTask));
      } catch (_error) {
        showToast("Не вдалося зберегти підзадачу в базі.", "danger");
        return;
      }
    }
    Object.assign(task, nextTask);
    item.history.unshift({
      date: new Date().toLocaleDateString("uk-UA"),
      text: subtaskIndex === null ? `Додано підзадачу: ${title}.` : `Оновлено підзадачу: ${title}.`
    });
    state.selectedCaseId = item.id;
    $("#subtask-dialog").close();
    renderAll();
    switchView(state.taskDialogReturnView || "tasks");
    showToast(subtaskIndex === null ? "Підзадачу додано." : "Підзадачу оновлено.");
  });

  $("#folder-form").addEventListener("submit", async (event) => {
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
      if (shouldUseApi(state)) {
        try {
          Object.assign(item, normalizeCase(await saveCaseToApi(item)));
        } catch (_error) {
          showToast("Не вдалося зберегти папку в базі.", "danger");
          return;
        }
      }
      state.selectedCaseId = item.id;
      $("#folder-dialog").close();
      renderAll();
      switchView(state.folderDialogReturnView || "cases");
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
    if (shouldUseApi(state)) {
      try {
        Object.assign(item, normalizeCase(await saveCaseToApi(item)));
      } catch (_error) {
        showToast("Не вдалося зберегти папку в базі.", "danger");
        return;
      }
    }
    state.selectedCaseId = item.id;
    $("#folder-dialog").close();
    renderAll();
    switchView(state.folderDialogReturnView || "cases");
    showToast("Папку створено.");
  });
}
