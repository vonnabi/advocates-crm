import { saveClientCommunicationToApi, saveClientToApi, shouldUseApi } from "../api.js";
import { normalizeClient, normalizeClientCommunication } from "../state.js";

export function renderClientsScreen(ctx) {
  const { state, $, icon, openClientDialog } = ctx;
  const selected = clientById(ctx, state.selectedClientId) || state.clients[0];
  const totalClients = state.clients.length;
  const managerOptions = uniqueClientOptions(state.clients.map((client) => client.manager));
  $("#clients").innerHTML = `
    <div class="toolbar clients-toolbar">
      <div class="left">
        <label class="search-control">${icon("search")}<input id="client-filter" type="search" placeholder="Пошук клієнта..." /></label>
        <button class="secondary icon-text" id="client-filter-toggle" type="button" aria-expanded="false" aria-controls="client-filter-panel">${icon("filter")}Фільтри</button>
        <select id="client-date-filter" data-client-select aria-label="Сортування клієнтів">
          <option value="added">Дата додавання</option>
          <option value="lastContact">Останній контакт</option>
          <option value="name">ПІБ клієнта</option>
        </select>
        <button class="ghost" id="client-reset-filter">Скинути</button>
      </div>
      <button class="primary" id="add-client">+ Додати клієнта</button>
    </div>
    <div class="clients-filter-panel" id="client-filter-panel" hidden>
      <label>Статус
        <select id="client-status-filter" data-client-select>
          <option value="all">Всі статуси</option>
          <option value="Активний">Активний</option>
          <option value="Постійний клієнт">Постійний клієнт</option>
          <option value="Новий">Новий</option>
          <option value="Не турбувати">Не турбувати</option>
        </select>
      </label>
      <label>Джерело
        <select id="client-source-filter" data-client-select>
          <option value="all">Всі джерела</option>
          <option value="Вручну">Вручну</option>
          <option value="Рекомендація">Рекомендація</option>
          <option value="Сайт">Сайт</option>
          <option value="Instagram">Instagram</option>
          <option value="Telegram">Telegram</option>
          <option value="Повторне звернення">Повторне звернення</option>
        </select>
      </label>
      <label>Відповідальний
        <select id="client-manager-filter" data-client-select>
          <option value="all">Всі відповідальні</option>
          ${managerOptions.map((manager) => `<option value="${escapeHtml(manager)}">${escapeHtml(manager)}</option>`).join("")}
        </select>
      </label>
    </div>
    <div class="clients-layout">
      <div class="clients-left">
        <div class="panel table-wrap clients-table-card">
          <h2 data-clients-count>Клієнти (${totalClients})</h2>
          <table class="clients-table">
            <thead>
              <tr><th><input type="checkbox" data-select-client-page aria-label="Обрати всіх клієнтів" /></th><th><span class="client-title-head"><span class="client-title-label">ПІБ клієнта</span><span class="tasks-bulk-bar clients-bulk-bar" data-client-bulk-bar aria-label="Масові дії клієнтів"></span></span></th><th>Телефон</th><th>Email</th><th>Суть звернення</th><th>Дата додавання</th><th>Telegram / Дії</th></tr>
            </thead>
            <tbody id="clients-table"></tbody>
          </table>
          <div class="table-footer">
            <span data-clients-footer-range>Показано 0 - 0 з 0 клієнтів</span>
            <div class="pagination" data-clients-pagination></div>
          </div>
        </div>
        <div class="panel client-profile-card" id="client-profile"></div>
      </div>
      <aside class="clients-side">
        <div class="panel side-card">
          <h2>${icon("telegram")} Telegram та розсилка</h2>
          <div class="telegram-connect">
            <h3>Підключення Telegram</h3>
            <p class="muted">Підключіть свій Telegram-акаунт для спілкування з клієнтами та розсилки повідомлень.</p>
            <div class="side-row telegram-connection-row">
              <span class="status-line telegram-status-icon" title="Telegram активний" aria-label="Telegram активний">${icon("telegram")}</span>
              <button class="secondary" type="button" data-client-telegram-settings>Налаштування</button>
            </div>
          </div>
        </div>
        <div class="panel side-card" data-client-mailing-panel>
          <h2>Інформаційна розсилка</h2>
          <div class="mailing-grid">
            <div><span class="muted">Одержувачі</span><strong data-client-mailing-recipient-count>${clientCountLabel(totalClients)}</strong></div>
            <div class="client-select-field">
              <span class="muted">Тип розсилки</span>
              <select data-client-select aria-label="Тип розсилки">
                <option value="info">Інформаційна</option>
                <option value="legal">Юридичне повідомлення</option>
                <option value="reminder">Нагадування</option>
              </select>
            </div>
          </div>
          <label class="message-label"><span class="muted">Повідомлення</span><textarea id="client-mailing-text" rows="8">${state.mailingText}</textarea></label>
          <p class="muted">Кількість символів: <span id="client-mailing-count">0</span></p>
          <h3>Попередній перегляд</h3>
          <div class="message-preview" id="client-mailing-preview"></div>
          <button class="primary full-width icon-text" type="button" data-client-mailing-action>${icon("telegram")} Надіслати розсилку</button>
        </div>
      </aside>
    </div>
  `;
  renderClientRows(ctx);
  if (selected) {
    renderClientProfile(ctx, selected.id);
  } else {
    $("#client-profile").innerHTML = `<h2 class="profile-section-title">${icon("telegram")} Профіль клієнта</h2><p class="muted">Клієнтів не знайдено.</p>`;
  }
  bindClientMailingPreview(ctx);
  $("#client-date-filter").value = state.clientSort || "added";
  $("#client-status-filter").value = state.clientStatusFilter || "all";
  $("#client-source-filter").value = state.clientSourceFilter || "all";
  $("#client-manager-filter").value = state.clientManagerFilter || "all";
  setupClientScreenSelects($("#clients"));
  $("#add-client").addEventListener("click", () => openClientDialog());
  $("#client-filter").addEventListener("input", () => {
    state.clientPage = 1;
    renderClientRows(ctx);
  });
  $("#client-filter-toggle").addEventListener("click", () => {
    const panel = $("#client-filter-panel");
    const nextOpen = panel.hidden;
    panel.hidden = !nextOpen;
    $("#client-filter-toggle").setAttribute("aria-expanded", String(nextOpen));
  });
  $("#client-date-filter").addEventListener("change", () => {
    state.clientSort = $("#client-date-filter").value || "added";
    state.clientPage = 1;
    renderClientRows(ctx);
  });
  $("#client-status-filter").addEventListener("change", () => {
    state.clientStatusFilter = $("#client-status-filter").value || "all";
    state.clientPage = 1;
    renderClientRows(ctx);
  });
  $("#client-source-filter").addEventListener("change", () => {
    state.clientSourceFilter = $("#client-source-filter").value || "all";
    state.clientPage = 1;
    renderClientRows(ctx);
  });
  $("#client-manager-filter").addEventListener("change", () => {
    state.clientManagerFilter = $("#client-manager-filter").value || "all";
    state.clientPage = 1;
    renderClientRows(ctx);
  });
  $("#client-reset-filter").addEventListener("click", () => {
    $("#client-filter").value = "";
    state.clientSort = "added";
    state.clientStatusFilter = "all";
    state.clientSourceFilter = "all";
    state.clientManagerFilter = "all";
    $("#client-date-filter").value = state.clientSort;
    $("#client-status-filter").value = state.clientStatusFilter;
    $("#client-source-filter").value = state.clientSourceFilter;
    $("#client-manager-filter").value = state.clientManagerFilter;
    syncClientScreenCustomSelects($("#clients"));
    state.clientPage = 1;
    renderClientRows(ctx);
  });
}

export function renderClientRows(ctx) {
  const { state, $, icon, actionMenu, bindActionMenus, openClientDialog, openDeleteDocumentConfirm } = ctx;
  const query = $("#client-filter")?.value || "";
  const selectedClientSet = new Set((state.selectedClientKeys || []).map(String));
  const filteredClients = state.clients
    .filter((client) => clientMatchesSearch(client, query))
    .filter((client) => state.clientStatusFilter === "all" || !state.clientStatusFilter || client.status === state.clientStatusFilter)
    .filter((client) => state.clientSourceFilter === "all" || !state.clientSourceFilter || client.source === state.clientSourceFilter)
    .filter((client) => state.clientManagerFilter === "all" || !state.clientManagerFilter || client.manager === state.clientManagerFilter)
    .sort((a, b) => compareClients(a, b, state.clientSort || "added"));
  const pageSize = Number(state.clientPageSize || 10);
  const pageCount = Math.max(1, Math.ceil(filteredClients.length / pageSize));
  state.clientPage = Math.min(Math.max(1, Number(state.clientPage || 1)), pageCount);
  const pageStart = (state.clientPage - 1) * pageSize;
  const visibleClients = filteredClients.slice(pageStart, pageStart + pageSize);
  const rows = visibleClients
    .map((client) => `
      <tr>
        <td><input type="checkbox" data-select-client-row="${client.id}" ${selectedClientSet.has(String(client.id)) ? "checked" : ""} aria-label="Обрати ${client.name}" /></td>
        <td>
          <div class="client-name-cell">
            <a href="#" data-open-client="${client.id}">${client.name}</a>
          </div>
        </td>
        <td>${client.phone}</td>
        <td>${client.email}</td>
        <td>${(client.request || "").slice(0, 44)}...</td>
        <td>${client.added}</td>
        <td class="clients-telegram-actions">
          <div class="clients-telegram-actions-inner">
          <span class="telegram-icon${client.telegram ? " telegram-icon-active" : ""}" title="${client.telegram ? "Telegram активний" : "Telegram не заповнено"}">${icon("telegram")}</span>
          ${actionMenu([
            { label: "Відкрити", icon: "eye", attrs: { "data-open-client": client.id } },
            { label: "Редагувати", icon: "edit", attrs: { "data-edit-client-row": client.id, "aria-label": `Редагувати ${client.name}` } },
            { label: "Видалити клієнта", icon: "trash", danger: true, attrs: { "data-delete-client": client.id, "aria-label": `Видалити ${client.name}` } }
          ], { label: "Дії клієнта", className: "clients-actions-menu" })}
          </div>
        </td>
      </tr>
    `)
    .join("");
  $("#clients-table").innerHTML = rows || `<tr><td colspan="7">Клієнтів не знайдено</td></tr>`;
  updateClientFooter(ctx, filteredClients, pageStart, pageSize, pageCount);
  updateClientBulkHeader(ctx, visibleClients);
  bindActionMenus?.($("#clients-table"));
  const pageCheckbox = document.querySelector("[data-select-client-page]");
  if (pageCheckbox) {
    pageCheckbox.onclick = (event) => event.stopPropagation();
    pageCheckbox.onchange = (event) => {
      const visibleIds = visibleClients.map((client) => String(client.id));
      const next = new Set((state.selectedClientKeys || []).map(String));
      visibleIds.forEach((id) => {
        if (event.currentTarget.checked) next.add(id);
        else next.delete(id);
      });
      state.selectedClientKeys = [...next];
      renderClientRows(ctx);
    };
  }
  document.querySelectorAll("[data-client-page]").forEach((button) => {
    button.addEventListener("click", () => {
      state.clientPage = Number(button.dataset.clientPage || 1);
      renderClientRows(ctx);
    });
  });
  document.querySelectorAll("[data-select-client-row]").forEach((input) => {
    input.addEventListener("click", (event) => event.stopPropagation());
    input.addEventListener("change", () => {
      const next = new Set((state.selectedClientKeys || []).map(String));
      if (input.checked) next.add(input.dataset.selectClientRow);
      else next.delete(input.dataset.selectClientRow);
      state.selectedClientKeys = [...next];
      renderClientRows(ctx);
    });
  });
  document.querySelectorAll("[data-client-bulk-action]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      handleClientBulkAction(ctx, button.dataset.clientBulkAction);
    });
  });
  document.querySelectorAll("[data-open-client]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      renderClientProfile(ctx, link.dataset.openClient);
    });
  });
  document.querySelectorAll("[data-edit-client-row]").forEach((button) => {
    button.addEventListener("click", () => openClientDialog(button.dataset.editClientRow));
  });
  document.querySelectorAll("[data-delete-client]").forEach((button) => {
    button.addEventListener("click", () => {
      openDeleteDocumentConfirm({ type: "client", clientId: Number(button.dataset.deleteClient), returnView: "clients" });
    });
  });
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function uniqueClientOptions(values = []) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "uk"));
}

function normalizeSearch(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function digitsOnly(value = "") {
  return String(value).replace(/\D/g, "");
}

function clientSearchHaystack(client = {}) {
  return normalizeSearch([
    client.name,
    client.phone,
    client.email,
    client.address,
    client.telegramUsername,
    client.request,
    client.status,
    client.source,
    client.manager,
    client.notes
  ].filter(Boolean).join(" "));
}

function clientMatchesSearch(client, query) {
  const cleanQuery = normalizeSearch(query);
  if (!cleanQuery) return true;
  const haystack = clientSearchHaystack(client);
  const queryDigits = digitsOnly(cleanQuery);
  const phoneDigits = digitsOnly(client.phone);
  return cleanQuery.split(" ").filter(Boolean).every((token) => {
    const tokenDigits = digitsOnly(token);
    return haystack.includes(token) || (tokenDigits && phoneDigits.includes(tokenDigits)) || (queryDigits.length >= 3 && phoneDigits.includes(queryDigits));
  });
}

function dateOrder(value = "") {
  const [day, month, year] = String(value || "").split(".");
  if (!day || !month || !year) return 0;
  return new Date(Number(year), Number(month) - 1, Number(day)).getTime();
}

function compareClients(a, b, sortKey) {
  if (sortKey === "name") return String(a.name || "").localeCompare(String(b.name || ""), "uk");
  if (sortKey === "lastContact") return dateOrder(b.lastContact) - dateOrder(a.lastContact);
  return dateOrder(b.added) - dateOrder(a.added);
}

function closeClientScreenSelects(root = document, except = null) {
  root.querySelectorAll(".client-screen-select.is-open").forEach((selectShell) => {
    if (selectShell === except) return;
    selectShell.classList.remove("is-open");
    selectShell.querySelector(".client-screen-select-button")?.setAttribute("aria-expanded", "false");
    const menu = selectShell.querySelector(".client-screen-select-menu");
    if (menu) menu.hidden = true;
  });
}

function syncClientScreenCustomSelect(select) {
  const shell = select.nextElementSibling?.classList?.contains("client-screen-select")
    ? select.nextElementSibling
    : null;
  if (!shell) return;
  const selected = select.selectedOptions?.[0] || select.options[0];
  const buttonText = shell.querySelector("[data-client-select-value]");
  const menu = shell.querySelector(".client-screen-select-menu");
  if (buttonText) buttonText.textContent = selected?.textContent || "";
  if (!menu) return;
  menu.innerHTML = [...select.options].filter((option) => !option.hidden).map((option) => `
    <button class="client-screen-select-option ${option.value === select.value ? "is-selected" : ""}" type="button" role="option" data-value="${escapeHtml(option.value)}" aria-selected="${option.value === select.value ? "true" : "false"}">
      <span aria-hidden="true">✓</span>
      <strong>${escapeHtml(option.textContent || "")}</strong>
    </button>
  `).join("");
}

function syncClientScreenCustomSelects(root = document) {
  root.querySelectorAll("select[data-client-select]").forEach(syncClientScreenCustomSelect);
}

function setupClientScreenSelects(root = document) {
  root.querySelectorAll("select[data-client-select]").forEach((select) => {
    select.classList.add("client-native-select");
    select.tabIndex = -1;
    select.setAttribute("aria-hidden", "true");
    let shell = select.nextElementSibling?.classList?.contains("client-screen-select")
      ? select.nextElementSibling
      : null;
    if (!shell) {
      shell = document.createElement("div");
      shell.className = "client-screen-select";
      shell.innerHTML = `
        <button class="client-screen-select-button" type="button" aria-haspopup="listbox" aria-expanded="false">
          <span data-client-select-value></span>
          <span class="client-screen-select-chevron" aria-hidden="true"></span>
        </button>
        <div class="client-screen-select-menu" role="listbox" hidden></div>
      `;
      select.insertAdjacentElement("afterend", shell);
      shell.querySelector(".client-screen-select-button")?.addEventListener("click", () => {
        const isOpen = shell.classList.contains("is-open");
        closeClientScreenSelects(root, isOpen ? null : shell);
        shell.classList.toggle("is-open", !isOpen);
        shell.querySelector(".client-screen-select-button")?.setAttribute("aria-expanded", String(!isOpen));
        const menu = shell.querySelector(".client-screen-select-menu");
        if (menu) menu.hidden = isOpen;
      });
      shell.querySelector(".client-screen-select-menu")?.addEventListener("click", (event) => {
        const optionButton = event.target.closest(".client-screen-select-option");
        if (!optionButton) return;
        select.value = optionButton.dataset.value || "";
        select.dispatchEvent(new Event("change", { bubbles: true }));
        syncClientScreenCustomSelect(select);
        closeClientScreenSelects(root);
      });
    }
    if (!select.dataset.clientScreenSelectSyncBound) {
      select.dataset.clientScreenSelectSyncBound = "true";
      select.addEventListener("change", () => syncClientScreenCustomSelect(select));
    }
    syncClientScreenCustomSelect(select);
  });
  if (!root.dataset.clientScreenSelectsBound) {
    root.dataset.clientScreenSelectsBound = "true";
    root.addEventListener("click", (event) => {
      if (event.target.closest(".client-screen-select")) return;
      closeClientScreenSelects(root);
    });
    root.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeClientScreenSelects(root);
    });
  }
}

function clientCountLabel(count) {
  const value = Number(count || 0);
  if (value === 1) return "1 клієнт";
  const mod10 = value % 10;
  const mod100 = value % 100;
  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return `${value} клієнти`;
  return `${value} клієнтів`;
}

function updateClientFooter(ctx, filteredClients, pageStart, pageSize, pageCount) {
  const { state } = ctx;
  const totalClients = state.clients.length;
  const filteredTotal = filteredClients.length;
  const from = filteredTotal ? pageStart + 1 : 0;
  const to = filteredTotal ? Math.min(pageStart + pageSize, filteredTotal) : 0;
  const countNode = document.querySelector("[data-clients-count]");
  if (countNode) countNode.textContent = `Клієнти (${totalClients})`;
  const recipientNode = document.querySelector("[data-client-mailing-recipient-count]");
  if (recipientNode) recipientNode.textContent = clientCountLabel(totalClients);
  const rangeNode = document.querySelector("[data-clients-footer-range]");
  if (rangeNode) {
    const filterSuffix = filteredTotal === totalClients ? "" : `, знайдено ${filteredTotal}`;
    rangeNode.textContent = `Показано ${from} - ${to} з ${clientCountLabel(totalClients)}${filterSuffix}`;
  }
  const pagination = document.querySelector("[data-clients-pagination]");
  if (!pagination) return;
  if (pageCount <= 1 || !filteredTotal) {
    pagination.innerHTML = "";
    return;
  }
  const current = Number(state.clientPage || 1);
  const pages = new Set([1, pageCount, current, current - 1, current + 1].filter((page) => page >= 1 && page <= pageCount));
  const pageItems = [...pages].sort((a, b) => a - b);
  const buttons = [];
  let previous = 0;
  pageItems.forEach((page) => {
    if (previous && page - previous > 1) buttons.push(`<span>...</span>`);
    buttons.push(`<button class="page ${page === current ? "active" : ""}" type="button" data-client-page="${page}">${page}</button>`);
    previous = page;
  });
  pagination.innerHTML = `
    <button class="ghost" type="button" data-client-page="${Math.max(1, current - 1)}" ${current === 1 ? "disabled" : ""}>‹</button>
    ${buttons.join("")}
    <button class="ghost" type="button" data-client-page="${Math.min(pageCount, current + 1)}" ${current === pageCount ? "disabled" : ""}>›</button>
  `;
}

function updateClientBulkHeader(ctx, filteredClients) {
  const { state, icon } = ctx;
  const selected = new Set((state.selectedClientKeys || []).map(String));
  const visibleIds = filteredClients.map((client) => String(client.id));
  const selectedVisible = visibleIds.filter((id) => selected.has(id));
  const checkbox = document.querySelector("[data-select-client-page]");
  if (checkbox) {
    checkbox.checked = Boolean(visibleIds.length) && selectedVisible.length === visibleIds.length;
    checkbox.indeterminate = selectedVisible.length > 0 && selectedVisible.length < visibleIds.length;
  }
  const bulkBar = document.querySelector("[data-client-bulk-bar]");
  if (!bulkBar) return;
  const selectedCount = selected.size;
  bulkBar.classList.toggle("active", Boolean(selectedCount));
  bulkBar.innerHTML = selectedCount ? `
    <em>${selectedCount}</em>
    <button class="task-bulk-icon bulk-work" type="button" data-client-bulk-action="telegram" data-tooltip="Підключити Telegram" aria-label="Підключити Telegram вибраним клієнтам">${icon("telegram")}</button>
    <button class="task-bulk-icon bulk-planner" type="button" data-client-bulk-action="mailing" data-client-mailing-action data-tooltip="Додати в розсилку" aria-label="Додати вибраних клієнтів в розсилку">${icon("mail")}</button>
    <button class="task-bulk-icon bulk-delete" type="button" data-client-bulk-action="delete" data-tooltip="Видалити вибрані" aria-label="Видалити вибраних клієнтів">${icon("trash")}</button>
    <button class="task-bulk-icon bulk-clear" type="button" data-client-bulk-action="clear" data-tooltip="Скинути вибір" aria-label="Скинути вибір клієнтів">×</button>
  ` : "";
}

async function handleClientBulkAction(ctx, action) {
  const { state, renderAll, switchView, showToast, openDeleteDocumentConfirm } = ctx;
  const selectedIds = new Set((state.selectedClientKeys || []).map(String));
  if (action === "clear") {
    state.selectedClientKeys = [];
    renderClientRows(ctx);
    showToast?.("Вибір клієнтів скинуто.");
    return;
  }
  if (!selectedIds.size) return;
  if (action === "telegram") {
    const selectedClients = state.clients.filter((client) => selectedIds.has(String(client.id)));
    selectedClients.forEach((client) => {
      client.telegram = true;
      client.telegramUsername = client.telegramUsername || `@client_${client.id}`;
      client.lastContact = new Date().toLocaleDateString("uk-UA");
      client.communications = [
        {
          date: client.lastContact,
          channel: "Telegram",
          title: "Telegram підключено",
          status: "Підключено",
          author: client.manager
        },
        ...(client.communications || [])
      ];
    });
    if (shouldUseApi(state)) {
      try {
        await Promise.all(selectedClients.map(async (client) => {
          Object.assign(client, normalizeClient(await saveClientToApi(client)));
        }));
      } catch (_error) {
        showToast?.("Не вдалося зберегти Telegram для вибраних клієнтів.", "danger");
        return;
      }
    }
    state.selectedClientKeys = [];
    renderClientRows(ctx);
    showToast?.("Telegram підключено для вибраних клієнтів.");
    return;
  }
  if (action === "mailing") {
    state.mailingRecipientMode = "manual";
    state.mailingManualClientIds = [...selectedIds].map(Number);
    state.mailingMainTab = "new";
    state.selectedClientKeys = [];
    renderAll?.();
    switchView?.("mailings");
    showToast?.("Вибраних клієнтів додано в ручну розсилку.");
    return;
  }
  if (action === "delete") {
    if (typeof openDeleteDocumentConfirm !== "function") {
      showToast?.("Не вдалося відкрити підтвердження видалення.", "danger");
      return;
    }
    openDeleteDocumentConfirm({
      type: "clients",
      clientIds: [...selectedIds].map(Number).filter(Boolean),
      returnView: "clients"
    });
  }
}

function bindClientMailingPreview(ctx) {
  const { state, $ } = ctx;
  const textarea = $("#client-mailing-text");
  const preview = $("#client-mailing-preview");
  const count = $("#client-mailing-count");
  const update = () => {
    state.mailingText = textarea.value;
    preview.textContent = textarea.value.replaceAll("{{client_name}}", state.clients[0]?.name || "Клієнт");
    count.textContent = textarea.value.length;
  };
  textarea.addEventListener("input", update);
  update();
}

function escapeAttribute(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("\"", "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function clientInitials(name = "") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  return `${parts[0]?.[0] || "К"}${parts[1]?.[0] || ""}`;
}

function clientAvatar(client) {
  const hasPhoto = Boolean(client.showPhoto && client.photoUrl);
  const photoStyle = hasPhoto ? ` style="--client-photo: url('${escapeAttribute(client.photoUrl)}')"` : "";
  return `<div class="client-avatar large ${hasPhoto ? "has-client-photo" : ""}"${photoStyle}>${hasPhoto ? "" : clientInitials(client.name)}</div>`;
}

function communicationTitle(type) {
  return {
    call: ["Телефон", "Зафіксовано телефонний дзвінок", "Контакт"],
    telegram: ["Telegram", "Зафіксовано повідомлення Telegram", "Контакт"],
    sms: ["SMS", "Зафіксовано SMS повідомлення", "Контакт"],
    email: ["Email", "Зафіксовано email лист", "Контакт"]
  }[type] || ["CRM", "Зафіксовано контакт", "Контакт"];
}

async function addClientCommunication(ctx, clientId, type) {
  const { state, renderAll, showToast } = ctx;
  const client = clientById(ctx, clientId);
  if (!client) return;
  const relatedCase = state.cases.find((item) => item.clientId === client.id);
  const [channel, title, status] = communicationTitle(type);
  let communication = {
    clientId: client.id,
    date: new Date().toLocaleDateString("uk-UA"),
    channel,
    title,
    status,
    author: client.manager,
    caseId: relatedCase?.id || ""
  };
  if (shouldUseApi(state)) {
    try {
      communication = normalizeClientCommunication(await saveClientCommunicationToApi(communication));
    } catch (_error) {
      showToast?.("Не вдалося зберегти комунікацію в базі.", "danger");
      return;
    }
  }
  client.communications = [communication, ...(client.communications || [])];
  client.lastContact = communication.date;
  renderAll?.();
  renderClientProfile(ctx, client.id);
  showToast?.(`${channel}: контакт зафіксовано.`);
}

export function renderClientProfile(ctx, id) {
  const { state, $, icon, badge, statusTone, advocatePhoto, openClientDialog } = ctx;
  const client = clientById(ctx, id);
  if (!client) return;
  state.selectedClientId = client.id;
  const relatedCases = state.cases.filter((item) => item.clientId === client.id);
  $("#client-profile").innerHTML = `
    <h2 class="profile-section-title">${icon("telegram")} Профіль клієнта</h2>
    <div class="profile-shell">
      <div class="profile-card-head">
        <div class="client-title">
          ${clientAvatar(client)}
          <div>
            <strong>${client.name}</strong>
            ${badge(client.status, statusTone(client.status))}
          </div>
        </div>
        <button class="secondary outline-blue" data-edit-client="${client.id}">Редагувати</button>
      </div>
      <div class="profile-screenshot-grid">
        <div class="profile-contact-list">
          <div class="contact-row">${icon("phone")}<strong>${client.phone}</strong></div>
          <div class="contact-row">${icon("mail")}<strong>${client.email}</strong></div>
          <div class="contact-row">${icon("telegram")}<strong>${client.telegramUsername || "Telegram не вказано"}</strong></div>
          <div class="contact-row">${icon("calendar")}<strong>Дата додавання: ${client.added}</strong></div>
          <div class="contact-row">${icon("tag")}<strong>Джерело: ${client.source}</strong></div>
        </div>
        <div class="profile-details">
          <h3>Суть звернення</h3>
          <p>${client.request}</p>
          <h3>Додаткові нотатки</h3>
          <p>${client.notes}</p>
          <h3>Відповідальний менеджер</h3>
          <div class="manager-line">${advocatePhoto(client.manager, "mini")}<strong>${client.manager}</strong></div>
          <div class="related-case-strip">${relatedCases.map((item) => badge(`Справа №${item.id}`, statusTone(item.status))).join("")}</div>
        </div>
      </div>
      <div class="client-communication-panel">
        <div class="client-communication-head">
          <div>
            <h3>Комунікації</h3>
            <p>Останні контакти, повідомлення та CRM-нотатки по клієнту.</p>
          </div>
          <div class="client-communication-actions">
            <button class="secondary compact" type="button" data-client-communication="call">${icon("phone")} Дзвінок</button>
            <button class="secondary compact" type="button" data-client-communication="telegram">${icon("telegram")} Telegram</button>
            <button class="secondary compact" type="button" data-client-communication="sms">${icon("mail")} SMS</button>
            <button class="secondary compact" type="button" data-client-communication="email">${icon("mail")} Email</button>
          </div>
        </div>
        <div class="client-communication-list">
          ${(client.communications || []).slice(0, 6).map((item) => `
            <div class="client-communication-row">
              <i>${icon(item.channel === "Telegram" ? "telegram" : item.channel === "Телефон" ? "phone" : "mail")}</i>
              <div>
                <strong>${item.title}</strong>
                <span>${item.channel} · ${item.date || "Без дати"}${item.caseId ? ` · Справа №${item.caseId}` : ""}</span>
              </div>
              <em>${item.status || "Контакт"}</em>
            </div>
          `).join("") || `<p class="muted">Комунікацій поки немає.</p>`}
        </div>
      </div>
    </div>
  `;
  const editButton = document.querySelector(`[data-edit-client="${client.id}"]`);
  editButton?.addEventListener("click", () => openClientDialog(client.id));
  document.querySelectorAll("[data-client-communication]").forEach((button) => {
    button.addEventListener("click", () => addClientCommunication(ctx, client.id, button.dataset.clientCommunication));
  });
}

function clientById(ctx, id) {
  return ctx.state.clients.find((client) => client.id === Number(id));
}
