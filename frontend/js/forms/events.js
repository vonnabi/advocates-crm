import { saveCaseToApi, saveEventToApi, shouldUseApi } from "../api.js";
import { normalizeCase, normalizeEvent } from "../state.js";

export function setupEventForm({
  state,
  $,
  caseById,
  caseProceduralItems,
  formatDate,
  semanticTone,
  renderAll,
  switchView,
  showToast
}) {
  $("#event-form").addEventListener("submit", async (event) => {
    if (event.submitter?.value === "cancel") return;
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const date = form.get("date");
    const due = form.get("due");
    const eventId = form.get("eventId");
    const actionIndex = form.get("actionIndex") === "" ? null : Number(form.get("actionIndex"));
    const isCaseProceduralContext = event.currentTarget.dataset.caseProceduralContext === "true";
    const nextId = Math.max(0, ...state.events.map((item) => Number(item.id) || 0)) + 1;
    const selectedCaseId = form.get("caseId");
    const reminderEnabled = Boolean(form.get("reminderEnabled"));
    const caseItem = selectedCaseId
      ? caseById(selectedCaseId)
      : state.cases.find((item) => item.clientId === Number(form.get("client"))) || state.cases[0];
    if (!caseItem) {
      showToast("Спочатку створіть справу, щоб додати подію.", "warning");
      return;
    }
    const status = form.get("status") || "Заплановано";
    const eventPayload = (id = "") => ({
      ...(id ? { id } : {}),
      day: Number(date.split("-")[2]),
      date,
      time: form.get("time"),
      endTime: form.get("endTime"),
      title: form.get("title"),
      type: form.get("type"),
      clientId: Number(form.get("client")),
      caseId: caseItem.id,
      authority: form.get("authority"),
      location: form.get("location"),
      responsible: form.get("responsible"),
      recurrence: form.get("recurrence"),
      reminderEnabled,
      reminderBefore: reminderEnabled ? form.get("reminderBefore") : "",
      reminderChannels: reminderEnabled ? form.get("reminderChannels") : "",
      reminderRecipients: reminderEnabled ? form.get("reminderRecipients") : "",
      description: form.get("description"),
      proceduralAction: Boolean(isCaseProceduralContext && !eventId),
      status
    });

    if (eventId) {
      const target = state.events.find((item) => `event-${item.id}` === eventId);
      if (!target) return;
      const payload = { ...target, ...eventPayload(target.id), reminderLog: target.reminderLog || [] };
      if (shouldUseApi(state)) {
        try {
          Object.assign(target, normalizeEvent(await saveEventToApi(payload)));
        } catch (_error) {
          showToast("Не вдалося зберегти подію в базі.", "danger");
          return;
        }
      } else {
        Object.assign(target, payload);
      }
      state.selectedEventId = eventId;
      state.selectedCaseId = caseItem.id;
      $("#event-dialog").close();
      renderAll();
      switchView("calendar");
      showToast("Подію календаря оновлено.");
      return;
    }

    if (selectedCaseId && actionIndex !== null) {
      caseItem.proceduralActions = caseProceduralItems(caseItem);
      const action = caseItem.proceduralActions[actionIndex];
      if (!action) return;
      action.action = form.get("title");
      action.initiator = form.get("type") || form.get("responsible") || "Адвокат";
      action.initiated = formatDate(date);
      action.time = form.get("time");
      action.due = due ? formatDate(due) : `${formatDate(date)} ${form.get("time")}`;
      action.description = form.get("description");
      caseItem.history.unshift({
        date: new Date().toLocaleDateString("uk-UA"),
        text: `Оновлено процесуальну дію: ${form.get("title")}.`
      });
      if (shouldUseApi(state)) {
        try {
          Object.assign(caseItem, normalizeCase(await saveCaseToApi(caseItem)));
        } catch (_error) {
          showToast("Не вдалося зберегти процесуальну дію в базі.", "danger");
          return;
        }
      }
      state.selectedCaseId = caseItem.id;
      $("#event-dialog").close();
      renderAll();
      switchView("cases");
      showToast("Процесуальну дію оновлено.");
      return;
    }

    let createdEvent = { ...eventPayload(nextId), reminderLog: [] };
    if (shouldUseApi(state)) {
      try {
        const { id: _localId, ...apiPayload } = createdEvent;
        createdEvent = normalizeEvent(await saveEventToApi(apiPayload));
      } catch (_error) {
        showToast("Не вдалося додати подію в базу.", "danger");
        return;
      }
    }
    state.events.push(createdEvent);

    if (isCaseProceduralContext && selectedCaseId) {
      caseItem.proceduralActions = caseProceduralItems(caseItem);
      caseItem.proceduralActions.unshift({
        action: form.get("title"),
        initiator: form.get("type") || form.get("responsible") || "Адвокат",
        initiated: formatDate(date),
        time: form.get("time"),
        due: due ? formatDate(due) : `${formatDate(date)} ${form.get("time")}`,
        description: form.get("description")
      });
      caseItem.history.unshift({
        date: new Date().toLocaleDateString("uk-UA"),
        text: `Додано процесуальну дію: ${form.get("title")}.`
      });
      if (shouldUseApi(state)) {
        try {
          Object.assign(caseItem, normalizeCase(await saveCaseToApi(caseItem)));
        } catch (_error) {
          showToast("Не вдалося зберегти процесуальну дію в базі.", "danger");
          return;
        }
      }
    }

    state.selectedEventId = `event-${createdEvent.id}`;
    state.selectedCaseId = caseItem.id;
    if (isCaseProceduralContext) state.openCaseSection = "events";
    $("#event-dialog").close();
    renderAll();
    switchView(isCaseProceduralContext ? "cases" : "calendar");
    showToast(isCaseProceduralContext ? "Процесуальну дію додано." : "Подію додано до календаря.");
  });
}
