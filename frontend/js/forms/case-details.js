import { saveCaseToApi, shouldUseApi } from "../api.js";
import { normalizeCase } from "../state.js";

function moneyValue(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function collectCaseParties(formElement) {
  return [...formElement.querySelectorAll("[data-case-party-row]")].map((row) => ({
    name: row.querySelector('[name="partyName"]')?.value.trim() || "",
    status: row.querySelector('[name="partyStatus"]')?.value.trim() || "",
    address: row.querySelector('[name="partyAddress"]')?.value.trim() || "",
    contact: row.querySelector('[name="partyContact"]')?.value.trim() || "",
    email: row.querySelector('[name="partyEmail"]')?.value.trim() || ""
  })).filter((party) => Object.values(party).some(Boolean));
}

export function setupCaseDetailForms({ state, $, caseById, formatDate, currency, renderAll, switchView, showToast }) {
  $("#essence-form").addEventListener("submit", (event) => {
    if (event.submitter?.value === "cancel") return;
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const item = caseById(form.get("caseId"));
    if (!item) return;
    item.description = form.get("description") || "Опис справи буде додано пізніше.";
    item.history.unshift({
      date: new Date().toLocaleDateString("uk-UA"),
      text: "Оновлено суть справи."
    });
    state.selectedCaseId = item.id;
    state.caseScreen = "detail";
    $("#essence-dialog").close();
    renderAll();
    switchView("cases");
    showToast("Суть справи збережено.");
  });

  $("#authority-form").addEventListener("submit", async (event) => {
    if (event.submitter?.value === "cancel") return;
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const item = caseById(form.get("caseId"));
    if (!item) return;
    item.parties = collectCaseParties(event.currentTarget);
    const firstParty = item.parties[0] || {};
    item.court = firstParty.name || "Не вказано";
    item.authorityType = firstParty.status || "";
    item.authorityAddress = firstParty.address || "";
    item.authorityContact = firstParty.contact || "";
    item.authorityEmail = firstParty.email || "";
    item.history.unshift({
      date: new Date().toLocaleDateString("uk-UA"),
      text: "Оновлено сторони по справі."
    });
    if (shouldUseApi(state)) {
      try {
        Object.assign(item, normalizeCase(await saveCaseToApi(item)));
      } catch (_error) {
        showToast("Не вдалося зберегти сторони по справі в базі.", "danger");
        return;
      }
    }
    state.selectedCaseId = item.id;
    state.caseScreen = "detail";
    $("#authority-dialog").close();
    renderAll();
    switchView("cases");
    showToast("Сторони по справі збережено.");
  });

  $("#finance-form").addEventListener("submit", async (event) => {
    if (event.submitter?.value === "cancel") return;
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const item = caseById(form.get("caseId"));
    if (!item) return;
    const shouldClear = event.submitter?.value === "delete";
    const total = shouldClear ? 0 : moneyValue(form.get("totalFee"));
    const paid = shouldClear ? 0 : Math.min(moneyValue(form.get("paid")), total);
    const firstPaymentDate = shouldClear ? "" : form.get("firstPaymentDate");
    const nextPaymentDue = shouldClear ? "" : form.get("nextPaymentDue");
    item.totalFee = total;
    item.income = total;
    item.paid = paid;
    item.debt = Math.max(total - paid, 0);
    item.firstPaymentDate = firstPaymentDate ? formatDate(firstPaymentDate) : "";
    item.nextPaymentDue = nextPaymentDue ? formatDate(nextPaymentDue) : "";
    item.financeComment = shouldClear ? "" : form.get("financeComment") || "";
    item.history.unshift({
      date: new Date().toLocaleDateString("uk-UA"),
      text: shouldClear
        ? "Очищено фінанси справи."
        : `Оновлено фінанси справи: сума ${currency(total)}, оплачено ${currency(paid)}, борг ${currency(item.debt)}.`
    });
    if (shouldUseApi(state)) {
      try {
        Object.assign(item, normalizeCase(await saveCaseToApi(item)));
      } catch (_error) {
        showToast("Не вдалося зберегти фінанси справи в базі.", "danger");
        return;
      }
    }
    state.selectedCaseId = item.id;
    $("#finance-dialog").close();
    renderAll();
    switchView("cases");
    showToast(shouldClear ? "Фінанси справи очищено." : "Фінанси справи оновлено.");
  });
}
