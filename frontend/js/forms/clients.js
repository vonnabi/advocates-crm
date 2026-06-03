import { saveClientToApi, shouldUseApi } from "../api.js";
import { normalizeClient } from "../state.js";

export function setupClientForm({ state, $, clientById, renderAll, switchView, showToast }) {
  $("#client-form").addEventListener("submit", async (event) => {
    if (event.submitter?.value === "cancel") return;
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const clientId = form.get("clientId");
    const photoUrl = String(form.get("photoUrl") || "").trim();
    const showPhoto = Boolean(form.get("showPhoto")) && Boolean(photoUrl);

    if (clientId) {
      const stayInCases = $("#cases")?.classList.contains("active") && state.caseScreen === "detail";
      const client = clientById(clientId);
      client.name = form.get("name");
      client.phone = form.get("phone");
      client.email = form.get("email");
      client.address = form.get("address");
      client.request = form.get("request");
      client.status = form.get("status");
      client.telegramUsername = form.get("telegramUsername");
      client.telegram = Boolean(form.get("telegramUsername"));
      client.photoUrl = photoUrl;
      client.showPhoto = showPhoto;
      client.consent = form.get("status") !== "Не турбувати";
      client.manager = form.get("manager");
      client.source = form.get("source");
      client.lastContact = new Date().toLocaleDateString("uk-UA");
      client.communications = [
        {
          date: new Date().toLocaleDateString("uk-UA"),
          channel: "CRM",
          title: "Дані клієнта оновлено",
          status: "Оновлено"
        },
        ...client.communications
      ];
      if (shouldUseApi(state)) {
        try {
          Object.assign(client, normalizeClient(await saveClientToApi(client)));
        } catch (_error) {
          showToast("Не вдалося зберегти клієнта в базі.", "danger");
          return;
        }
      }
      state.selectedClientId = client.id;
      $("#client-dialog").close();
      renderAll();
      switchView(stayInCases ? "cases" : "clients");
      showToast("Дані клієнта оновлено.");
      return;
    }

    const numericClientIds = state.clients
      .map((client) => Number(client.id))
      .filter(Number.isFinite);
    const nextId = (numericClientIds.length ? Math.max(...numericClientIds) : 0) + 1;
    let newClient = {
      id: nextId,
      name: form.get("name"),
      phone: form.get("phone"),
      email: form.get("email"),
      address: form.get("address"),
      request: form.get("request"),
      status: form.get("status"),
      telegram: Boolean(form.get("telegramUsername")),
      telegramUsername: form.get("telegramUsername"),
      photoUrl,
      showPhoto,
      clientType: "Фізична особа",
      consent: form.get("status") !== "Не турбувати",
      manager: form.get("manager"),
      source: form.get("source"),
      added: new Date().toLocaleDateString("uk-UA"),
      lastContact: new Date().toLocaleDateString("uk-UA"),
      nextAction: "Провести первинну консультацію",
      risk: "Середній",
      notes: "Клієнт доданий вручну. Потрібно уточнити документи, згоду на розсилку та створити справу.",
      communications: [
        { date: new Date().toLocaleDateString("uk-UA"), channel: "CRM", title: "Клієнт доданий до бази", status: "Створено" }
      ]
    };
    if (shouldUseApi(state)) {
      try {
        newClient = normalizeClient(await saveClientToApi({ ...newClient, id: "" }));
      } catch (_error) {
        showToast("Не вдалося додати клієнта в базу.", "danger");
        return;
      }
    }
    state.clients.push(newClient);
    state.selectedClientId = newClient.id;
    $("#client-dialog").close();
    renderAll();
    switchView("clients");
    showToast("Клієнта додано до бази.");
  });
}
