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
  $("#event-form").addEventListener("submit", (event) => {
    if (event.submitter?.value === "cancel") return;
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const date = form.get("date");
    const due = form.get("due");
    const eventId = form.get("eventId");
    const actionIndex = form.get("actionIndex") === "" ? null : Number(form.get("actionIndex"));
    const nextId = Math.max(...state.events.map((item) => item.id)) + 1;
    const selectedCaseId = form.get("caseId");
    const caseItem = selectedCaseId
      ? caseById(selectedCaseId)
      : state.cases.find((item) => item.clientId === Number(form.get("client"))) || state.cases[0];
    const status = form.get("status") || "Заплановано";

    if (eventId) {
      const target = state.events.find((item) => `event-${item.id}` === eventId);
      if (!target) return;
      target.day = Number(date.split("-")[2]);
      target.date = date;
      target.time = form.get("time");
      target.endTime = form.get("endTime");
      target.title = form.get("title");
      target.type = form.get("type");
      target.clientId = Number(form.get("client"));
      target.caseId = caseItem.id;
      target.authority = form.get("authority");
      target.location = form.get("location");
      target.responsible = form.get("responsible");
      target.recurrence = form.get("recurrence");
      target.reminderBefore = form.get("reminderBefore");
      target.reminderChannels = form.get("reminderChannels");
      target.reminderRecipients = form.get("reminderRecipients");
      target.description = form.get("description");
      target.status = status;
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
      action.initiator = form.get("responsible") || "Адвокат";
      action.initiated = formatDate(date);
      action.time = form.get("time");
      action.due = due ? formatDate(due) : `${formatDate(date)} ${form.get("time")}`;
      action.status = status;
      action.tone = status === "Заплановано" ? "blue" : status === "В процесі" ? "amber" : "";
      action.description = form.get("description");
      caseItem.history.unshift({
        date: new Date().toLocaleDateString("uk-UA"),
        text: `Оновлено процесуальну дію: ${form.get("title")}.`
      });
      state.selectedCaseId = caseItem.id;
      $("#event-dialog").close();
      renderAll();
      switchView("cases");
      showToast("Процесуальну дію оновлено.");
      return;
    }

    state.events.push({
      id: nextId,
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
      reminderBefore: form.get("reminderBefore"),
      reminderChannels: form.get("reminderChannels"),
      reminderRecipients: form.get("reminderRecipients"),
      reminderLog: [],
      description: form.get("description"),
      status
    });

    if (selectedCaseId) {
      caseItem.proceduralActions = caseProceduralItems(caseItem);
      caseItem.proceduralActions.unshift({
        action: form.get("title"),
        initiator: form.get("responsible") || "Адвокат",
        initiated: formatDate(date),
        time: form.get("time"),
        due: due ? formatDate(due) : `${formatDate(date)} ${form.get("time")}`,
        status,
        tone: semanticTone(status),
        description: form.get("description")
      });
      caseItem.history.unshift({
        date: new Date().toLocaleDateString("uk-UA"),
        text: `Додано процесуальну дію: ${form.get("title")}.`
      });
    }

    state.selectedEventId = `event-${nextId}`;
    state.selectedCaseId = caseItem.id;
    state.openCaseSection = "events";
    $("#event-dialog").close();
    renderAll();
    switchView(selectedCaseId ? "cases" : "calendar");
    showToast(selectedCaseId ? "Процесуальну дію додано." : "Подію додано до календаря.");
  });
}
