import { saveCaseToApi, shouldUseApi } from "../api.js";
import { normalizeCase } from "../state.js";

export function setupCaseForm({ state, $, caseById, formatDate, renderAll, switchView, showToast }) {
  $("#case-form").addEventListener("submit", async (event) => {
    if (event.submitter?.value === "cancel") return;
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const caseId = form.get("caseId");
    const deadline = form.get("deadline");

    if (caseId) {
      const item = caseById(caseId);
      item.clientId = Number(form.get("clientId"));
      item.title = form.get("title");
      item.type = form.get("type");
      item.stage = form.get("stage") || "Первинна консультація";
      item.status = form.get("status");
      item.priority = form.get("priority");
      item.responsible = form.get("responsible");
      item.deadline = deadline ? formatDate(deadline) : "Не вказано";
      item.history.unshift({
        date: new Date().toLocaleDateString("uk-UA"),
        text: "Дані справи оновлено."
      });
      if (shouldUseApi(state)) {
        try {
          Object.assign(item, normalizeCase(await saveCaseToApi(item)));
        } catch (_error) {
          showToast("Не вдалося зберегти справу в базі.", "danger");
          return;
        }
      }
      state.selectedCaseId = item.id;
      state.caseScreen = "list";
      $("#case-dialog").close();
      renderAll();
      switchView("cases");
      showToast("Справу оновлено.");
      return;
    }

    const currentYear = new Date().getFullYear();
    const nextNumber = String(state.cases.length + 1112).padStart(4, "0");
    const nextId = `${currentYear}/${nextNumber}`;
    const newCase = {
      id: nextId,
      clientId: Number(form.get("clientId")),
      title: form.get("title"),
      type: form.get("type"),
      status: form.get("status"),
      stage: form.get("stage") || "Первинна консультація",
      priority: form.get("priority"),
      responsible: form.get("responsible"),
      court: "Не вказано",
      authorityType: "",
      authorityAddress: "",
      authorityContact: "",
      authorityEmail: "",
      opened: new Date().toLocaleDateString("uk-UA"),
      deadline: deadline ? formatDate(deadline) : "Не вказано",
      debt: 0,
      income: 0,
      description: "Опис справи буде додано пізніше.",
      documents: [],
      proceduralActions: [],
      folders: [],
      tasks: [],
      history: [
        {
          date: new Date().toLocaleDateString("uk-UA"),
          text: "Справу створено в CRM."
        }
      ]
    };
    let savedCase = newCase;
    if (shouldUseApi(state)) {
      try {
        savedCase = normalizeCase(await saveCaseToApi({ ...newCase, id: "" }));
      } catch (_error) {
        showToast("Не вдалося створити справу в базі.", "danger");
        return;
      }
    }
    state.cases.unshift(savedCase);
    state.selectedCaseId = savedCase.id;
    state.caseScreen = "detail";
    $("#case-dialog").close();
    renderAll();
    switchView("cases");
    showToast("Нову справу створено.");
  });
}
