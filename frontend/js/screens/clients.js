export function renderClientsScreen(ctx) {
  const { state, $, icon, openClientDialog } = ctx;
  const selected = clientById(ctx, state.selectedClientId) || state.clients[0];
  $("#clients").innerHTML = `
    <div class="toolbar clients-toolbar">
      <div class="left">
        <label class="search-control">${icon("search")}<input id="client-filter" type="search" placeholder="Пошук клієнта..." /></label>
        <button class="secondary icon-text">${icon("filter")}Фільтри</button>
        <select id="client-date-filter">
          <option>Дата додавання</option>
          <option>Останній контакт</option>
          <option>ПІБ клієнта</option>
        </select>
        <button class="ghost" id="client-reset-filter">Скинути</button>
      </div>
      <button class="primary" id="add-client">+ Додати клієнта</button>
    </div>
    <div class="clients-layout">
      <div class="clients-left">
        <div class="panel table-wrap clients-table-card">
          <h2>Клієнти (124)</h2>
          <table class="clients-table">
            <thead>
              <tr><th><input type="checkbox" data-select-client-page aria-label="Обрати всіх клієнтів" /></th><th><span class="client-title-head"><span class="client-title-label">ПІБ клієнта</span><span class="tasks-bulk-bar clients-bulk-bar" data-client-bulk-bar aria-label="Масові дії клієнтів"></span></span></th><th>Телефон</th><th>Email</th><th>Суть звернення</th><th>Дата додавання</th><th>Telegram</th><th>Дії</th></tr>
            </thead>
            <tbody id="clients-table"></tbody>
          </table>
          <div class="table-footer">
            <span>Показано 1 - ${state.clients.length} з 124 клієнтів</span>
            <div class="pagination"><button class="ghost">‹</button><button class="page active">1</button><button class="page">2</button><button class="page">3</button><span>...</span><button class="page">16</button><button class="ghost">›</button></div>
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
            <div class="side-row"><span class="status-line">${icon("check")} Telegram підключено</span><button class="secondary">Налаштування</button></div>
          </div>
        </div>
        <div class="panel side-card">
          <h2>Інформаційна розсилка</h2>
          <div class="mailing-grid">
            <div><span class="muted">Одержувачі</span><strong>124 клієнти</strong></div>
            <label><span class="muted">Тип розсилки</span><select><option>Інформаційна</option><option>Юридичне повідомлення</option><option>Нагадування</option></select></label>
          </div>
          <label class="message-label"><span class="muted">Повідомлення</span><textarea id="client-mailing-text" rows="8">${state.mailingText}</textarea></label>
          <p class="muted">Кількість символів: <span id="client-mailing-count">0</span></p>
          <h3>Попередній перегляд</h3>
          <div class="message-preview" id="client-mailing-preview"></div>
          <button class="primary full-width icon-text">${icon("telegram")} Надіслати розсилку</button>
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
  $("#add-client").addEventListener("click", () => openClientDialog());
  $("#client-filter").addEventListener("input", () => renderClientRows(ctx));
  $("#client-reset-filter").addEventListener("click", () => {
    $("#client-filter").value = "";
    renderClientRows(ctx);
  });
}

export function renderClientRows(ctx) {
  const { state, $, icon, actionMenu, bindActionMenus, openClientDialog, openDeleteDocumentConfirm } = ctx;
  const query = ($("#client-filter")?.value || "").toLowerCase();
  const selectedClientSet = new Set((state.selectedClientKeys || []).map(String));
  const filteredClients = state.clients
    .filter((client) => !query || `${client.name} ${client.phone} ${client.email} ${client.request} ${client.telegramUsername} ${client.manager}`.toLowerCase().includes(query));
  const rows = filteredClients
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
        <td>${client.request.slice(0, 44)}...</td>
        <td>${client.added}</td>
        <td>${client.telegram ? `<span class="connected-text">Підключено</span>` : `<span class="telegram-icon">${icon("telegram")}</span>`}</td>
        <td class="clients-row-actions">
          ${actionMenu([
            { label: "Відкрити", icon: "eye", attrs: { "data-open-client": client.id } },
            { label: "Редагувати", icon: "edit", attrs: { "data-edit-client-row": client.id, "aria-label": `Редагувати ${client.name}` } },
            { label: "Видалити клієнта", icon: "trash", danger: true, attrs: { "data-delete-client": client.id, "aria-label": `Видалити ${client.name}` } }
          ], { label: "Дії клієнта", className: "clients-actions-menu" })}
        </td>
      </tr>
    `)
    .join("");
  $("#clients-table").innerHTML = rows || `<tr><td colspan="8">Клієнтів не знайдено</td></tr>`;
  updateClientBulkHeader(ctx, filteredClients);
  bindActionMenus?.($("#clients-table"));
  const pageCheckbox = document.querySelector("[data-select-client-page]");
  if (pageCheckbox) {
    pageCheckbox.onclick = (event) => event.stopPropagation();
    pageCheckbox.onchange = (event) => {
      const visibleIds = filteredClients.map((client) => String(client.id));
      const next = new Set((state.selectedClientKeys || []).map(String));
      visibleIds.forEach((id) => {
        if (event.currentTarget.checked) next.add(id);
        else next.delete(id);
      });
      state.selectedClientKeys = [...next];
      renderClientRows(ctx);
    };
  }
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
    <button class="task-bulk-icon bulk-planner" type="button" data-client-bulk-action="mailing" data-tooltip="Додати в розсилку" aria-label="Додати вибраних клієнтів в розсилку">${icon("mail")}</button>
    <button class="task-bulk-icon bulk-delete" type="button" data-client-bulk-action="delete" data-tooltip="Видалити вибрані" aria-label="Видалити вибраних клієнтів">${icon("trash")}</button>
    <button class="task-bulk-icon bulk-clear" type="button" data-client-bulk-action="clear" data-tooltip="Скинути вибір" aria-label="Скинути вибір клієнтів">×</button>
  ` : "";
}

function handleClientBulkAction(ctx, action) {
  const { state, renderAll, switchView, showToast } = ctx;
  const selectedIds = new Set((state.selectedClientKeys || []).map(String));
  if (action === "clear") {
    state.selectedClientKeys = [];
    renderClientRows(ctx);
    showToast?.("Вибір клієнтів скинуто.");
    return;
  }
  if (!selectedIds.size) return;
  if (action === "telegram") {
    state.clients.forEach((client) => {
      if (!selectedIds.has(String(client.id))) return;
      client.telegram = true;
      client.telegramUsername = client.telegramUsername || `@client_${client.id}`;
    });
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
    const remainingCaseIds = new Set(state.cases.filter((item) => !selectedIds.has(String(item.clientId))).map((item) => item.id));
    const deletedCount = state.clients.filter((client) => selectedIds.has(String(client.id))).length;
    state.clients = state.clients.filter((client) => !selectedIds.has(String(client.id)));
    state.cases = state.cases.filter((item) => !selectedIds.has(String(item.clientId)));
    state.events = state.events.filter((event) => remainingCaseIds.has(event.caseId));
    state.selectedClientKeys = [];
    state.selectedClientId = state.clients[0]?.id || "";
    renderAll?.();
    switchView?.("clients");
    showToast?.(`Видалено ${deletedCount} клієнтів.`, "danger");
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
    </div>
  `;
  const editButton = document.querySelector(`[data-edit-client="${client.id}"]`);
  editButton?.addEventListener("click", () => openClientDialog(client.id));
}

function clientById(ctx, id) {
  return ctx.state.clients.find((client) => client.id === Number(id));
}
