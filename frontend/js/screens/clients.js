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
              <tr><th><input type="checkbox" aria-label="Обрати всіх клієнтів" /></th><th>ПІБ клієнта</th><th>Телефон</th><th>Email</th><th>Суть звернення</th><th>Дата додавання</th><th>Telegram</th></tr>
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
  renderClientProfile(ctx, selected.id);
  bindClientMailingPreview(ctx);
  $("#add-client").addEventListener("click", () => openClientDialog());
  $("#client-filter").addEventListener("input", () => renderClientRows(ctx));
  $("#client-reset-filter").addEventListener("click", () => {
    $("#client-filter").value = "";
    renderClientRows(ctx);
  });
}

export function renderClientRows(ctx) {
  const { state, $, icon, openClientDialog } = ctx;
  const query = ($("#client-filter")?.value || "").toLowerCase();
  const rows = state.clients
    .filter((client) => !query || `${client.name} ${client.phone} ${client.email} ${client.request} ${client.telegramUsername} ${client.manager}`.toLowerCase().includes(query))
    .map((client) => `
      <tr>
        <td><input type="checkbox" aria-label="Обрати ${client.name}" /></td>
        <td>
          <div class="client-name-cell">
            <a href="#" data-client="${client.id}">${client.name}</a>
            <button class="edit-icon-button" data-edit-client-row="${client.id}" title="Редагувати клієнта" aria-label="Редагувати ${client.name}">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M16.9 3.7a2.1 2.1 0 0 1 3 3L8.4 18.2l-4.1 1.2 1.2-4.1L16.9 3.7Z"></path>
                <path d="m15.5 5.1 3.4 3.4"></path>
              </svg>
            </button>
          </div>
        </td>
        <td>${client.phone}</td>
        <td>${client.email}</td>
        <td>${client.request.slice(0, 44)}...</td>
        <td>${client.added}</td>
        <td>${client.telegram ? `<span class="connected-text">Підключено</span>` : `<span class="telegram-icon">${icon("telegram")}</span>`}</td>
      </tr>
    `)
    .join("");
  $("#clients-table").innerHTML = rows || `<tr><td colspan="7">Клієнтів не знайдено</td></tr>`;
  document.querySelectorAll("[data-client]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      renderClientProfile(ctx, link.dataset.client);
    });
  });
  document.querySelectorAll("[data-edit-client-row]").forEach((button) => {
    button.addEventListener("click", () => openClientDialog(button.dataset.editClientRow));
  });
}

function bindClientMailingPreview(ctx) {
  const { state, $ } = ctx;
  const textarea = $("#client-mailing-text");
  const preview = $("#client-mailing-preview");
  const count = $("#client-mailing-count");
  const update = () => {
    state.mailingText = textarea.value;
    preview.textContent = textarea.value.replaceAll("{{client_name}}", state.clients[0].name);
    count.textContent = textarea.value.length;
  };
  textarea.addEventListener("input", update);
  update();
}

export function renderClientProfile(ctx, id) {
  const { state, $, icon, badge, statusTone, advocatePhoto, openClientDialog } = ctx;
  const client = clientById(ctx, id);
  state.selectedClientId = client.id;
  const relatedCases = state.cases.filter((item) => item.clientId === client.id);
  $("#client-profile").innerHTML = `
    <h2 class="profile-section-title">${icon("telegram")} Профіль клієнта</h2>
    <div class="profile-shell">
      <div class="profile-card-head">
        <div class="client-title">
          <div class="avatar large">${icon("user")}</div>
          <div>
            <strong>${client.name}</strong>
            ${badge(client.status, statusTone(client.status))}
          </div>
        </div>
        <button class="secondary outline-blue" data-edit-client="${client.id}">Редагувати</button>
      </div>
      <div class="profile-screenshot-grid">
        <div class="profile-contact-list">
          <div class="contact-row">${icon("phone")}<strong>${client.phone}</strong><span class="contact-icons">${icon("phone")}${icon("telegram")}</span></div>
          <div class="contact-row">${icon("mail")}<strong>${client.email}</strong><span class="contact-icons">${icon("mail")}</span></div>
          <div class="contact-row">${icon("telegram")}<strong>${client.telegramUsername || "Telegram не вказано"}</strong><span class="contact-icons">${icon("telegram")}</span></div>
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
