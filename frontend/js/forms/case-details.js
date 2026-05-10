function moneyValue(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
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

  $("#authority-form").addEventListener("submit", (event) => {
    if (event.submitter?.value === "cancel") return;
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const item = caseById(form.get("caseId"));
    if (!item) return;
    item.court = form.get("court") || "Не вказано";
    item.authorityType = form.get("authorityType") || "";
    item.authorityAddress = form.get("authorityAddress") || "";
    item.authorityContact = form.get("authorityContact") || "";
    item.history.unshift({
      date: new Date().toLocaleDateString("uk-UA"),
      text: "Оновлено орган звернення по справі."
    });
    state.selectedCaseId = item.id;
    state.caseScreen = "detail";
    $("#authority-dialog").close();
    renderAll();
    switchView("cases");
    showToast("Орган звернення збережено.");
  });

  $("#finance-form").addEventListener("submit", (event) => {
    if (event.submitter?.value === "cancel") return;
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const item = caseById(form.get("caseId"));
    if (!item) return;
    const total = moneyValue(form.get("totalFee"));
    const paid = Math.min(moneyValue(form.get("paid")), total);
    const firstPaymentDate = form.get("firstPaymentDate");
    const nextPaymentDue = form.get("nextPaymentDue");
    item.totalFee = total;
    item.income = total;
    item.paid = paid;
    item.debt = Math.max(total - paid, 0);
    item.firstPaymentDate = firstPaymentDate ? formatDate(firstPaymentDate) : "";
    item.nextPaymentDue = nextPaymentDue ? formatDate(nextPaymentDue) : "";
    item.financeComment = form.get("financeComment") || "";
    item.history.unshift({
      date: new Date().toLocaleDateString("uk-UA"),
      text: `Оновлено фінанси справи: сума ${currency(total)}, оплачено ${currency(paid)}, борг ${currency(item.debt)}.`
    });
    state.selectedCaseId = item.id;
    $("#finance-dialog").close();
    renderAll();
    switchView("cases");
    showToast("Фінанси справи оновлено.");
  });
}
