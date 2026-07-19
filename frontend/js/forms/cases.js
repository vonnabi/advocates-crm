import { saveCaseToApi, shouldUseApi } from "../api.js";
import { normalizeCase } from "../state.js";

// The API throws an Error whose message is the raw response body (JSON). Pull out
// the human-readable `message` (e.g. a duplicate-number warning), else fall back.
function apiErrorMessage(error, fallback) {
  try {
    const parsed = JSON.parse(error?.message || "");
    if (parsed && parsed.message) return parsed.message;
  } catch (_ignored) { /* not JSON — use the fallback */ }
  return fallback;
}

// A case is referenced elsewhere by its number (caseId). When the number changes,
// repoint the in-memory top-level collections so events/finance stay linked without
// a full reload. Tasks and documents live nested inside the case, so they move with it.
function relinkCaseReferences(state, oldId, newId) {
  if (oldId === newId) return;
  (state.events || []).forEach((event) => {
    if (event.caseId === oldId) event.caseId = newId;
  });
  (state.financeOperations || []).forEach((operation) => {
    if (operation.caseId === oldId) operation.caseId = newId;
  });
}

export function setupCaseForm({ state, $, caseById, formatDate, renderAll, switchView, showToast }) {
  $("#case-form").addEventListener("submit", async (event) => {
    if (event.submitter?.value === "cancel") return;
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const caseId = form.get("caseId");
    const number = String(form.get("number") || "").trim();

    if (caseId) {
      const item = caseById(caseId);
      const previousId = item.id;
      const newNumber = number || item.id;
      item.clientId = Number(form.get("clientId"));
      item.title = form.get("title");
      item.type = form.get("type");
      item.status = form.get("status");
      item.responsible = form.get("responsible");
      item.history.unshift({
        date: new Date().toLocaleDateString("uk-UA"),
        text: "Дані справи оновлено."
      });
      if (shouldUseApi(state)) {
        try {
          // Keep item.id (the original number) as the PUT URL key so the backend
          // finds the case; send the desired number in `number` so it can rename it.
          Object.assign(item, normalizeCase(await saveCaseToApi({ ...item, number: newNumber })));
        } catch (error) {
          showToast(apiErrorMessage(error, "Не вдалося зберегти справу в базі."), "danger");
          return;
        }
      } else {
        item.id = newNumber;
      }
      relinkCaseReferences(state, previousId, item.id);
      state.selectedCaseId = item.id;
      state.caseScreen = "list";
      $("#case-dialog").close();
      renderAll();
      switchView("cases");
      showToast("Справу оновлено.");
      return;
    }

    const currentYear = new Date().getFullYear();
    const existingNumbers = state.cases
      .map((caseItem) => Number(String(caseItem.id).split("/")[1]))
      .filter(Number.isFinite);
    const nextNumber = String((existingNumbers.length ? Math.max(...existingNumbers) : 1111) + 1).padStart(4, "0");
    const nextId = number || `${currentYear}/${nextNumber}`;
    const newCase = {
      id: nextId,
      clientId: Number(form.get("clientId")),
      title: form.get("title"),
      type: form.get("type"),
      status: form.get("status"),
      stage: "",
      priority: "",
      responsible: form.get("responsible"),
      court: "Не вказано",
      authorityType: "",
      authorityAddress: "",
      authorityContact: "",
      authorityEmail: "",
      parties: [],
      opened: new Date().toLocaleDateString("uk-UA"),
      deadline: "",
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
        // Force a POST (create): send the number in `number`, keep `id` empty so
        // saveCaseToApi does not mistake this for an update (PUT) of a case that
        // does not exist yet. The backend accepts any string as the case number.
        savedCase = normalizeCase(await saveCaseToApi({ ...newCase, id: "", number: nextId }));
      } catch (error) {
        showToast(apiErrorMessage(error, "Не вдалося створити справу в базі."), "danger");
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
