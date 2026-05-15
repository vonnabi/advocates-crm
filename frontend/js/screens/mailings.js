export function setMailingTab(ctx, tab, remember = true) {
  const { state } = ctx;
  if (remember && tab !== state.mailingMainTab) {
    state.previousMailingTab = state.mailingMainTab;
  }
  state.mailingMainTab = tab;
}

export function renderMailingsScreen(ctx) {
  const { state, $, icon, badge, actionMenu, bindActionMenus, semanticTone, formatDate, showToast, syncNavigationState } = ctx;
  const setTab = (tab, remember = true) => setMailingTab(ctx, tab, remember);
  const rerender = () => renderMailingsScreen(ctx);
  if (!state.mailingTemplates.length) {
    state.mailingTemplates = [
      { title: "Нагадування про подію", type: "Нагадування", text: "Шановний {{client_name}}, нагадуємо про заплановану подію у вашій справі." },
      { title: "Юридичне повідомлення", type: "Юридичне повідомлення", text: "Шановний {{client_name}}, повідомляємо важливу інформацію щодо вашого звернення." }
    ];
  }
  const recipientMode = state.mailingRecipientMode || "segment";
  const manualRecipients = state.clients.filter((client) => state.mailingManualClientIds.includes(client.id));
  const recipients = recipientMode === "all" ? 1245 : recipientMode === "manual" ? manualRecipients.length : Math.max(120, 386 - Math.max(0, 3 - state.mailingFilters.length) * 58);
  const telegramDelivered = 317;
  const smsDelivered = Math.round(recipients * 0.62);
  const emailDelivered = Math.round(recipients * 0.48);
  const estimatedTelegram = Math.round(recipients * 0.82);
  const totalMessages = (state.mailingChannels.Telegram ? estimatedTelegram : 0) + (state.mailingChannels.SMS ? smsDelivered : 0) + (state.mailingChannels.Email ? emailDelivered : 0);
  const mainTab = state.mailingMainTab || "new";
  const editorChannel = state.mailingEditorChannel || "Telegram";
  const previewChannel = state.mailingPreviewChannel || editorChannel;
  const filterOptions = ["Статус клиента: Новый", "Статус клиента: Активный", "Статус клиента: Постоянный", "Telegram: Подключен", "SMS: Доступен", "Email: Заполнен", "Источник: Сайт", "Источник: Рекомендация", "Ответственный: Іваненко А.Ю.", "Клиенты с активными делами", "Есть согласие на рассылку"];
  const availableFilters = filterOptions.filter((filter) => !state.mailingFilters.includes(filter));
  const campaignFilter = state.mailingCampaignFilter || "all";
  const campaignQuery = String(state.mailingCampaignQuery || "").trim().toLowerCase();
  const baseCampaignRows = state.mailingCampaigns.length ? state.mailingCampaigns : [{ title: "Нагадування про консультацію", status: "Відправлено", meta: "Telegram + SMS · 124 отримувачі", sample: true }];
  const campaignRows = baseCampaignRows.filter((item) => {
    if (campaignFilter === "all") return true;
    if (campaignFilter === "scheduled") return item.status === "Запланирована";
    if (campaignFilter === "test") return item.status === "Тест отправлен";
    return item.status !== "Запланирована" && item.status !== "Тест отправлен";
  }).filter((item) => {
    if (!campaignQuery) return true;
    return `${item.title} ${item.status} ${item.meta || ""} ${item.createdAt || ""}`.toLowerCase().includes(campaignQuery);
  });
  $("#mailings").innerHTML = `
    <div class="mailing-screen">
      <div class="mailing-actionbar">
        <div class="mailing-tabs">
          <button class="${mainTab === "new" ? "active" : ""}" data-mailing-main-tab="new">${icon("telegram")} Новая рассылка</button>
          <button class="${mainTab === "campaigns" ? "active" : ""}" data-mailing-main-tab="campaigns">${icon("file")} Мои рассылки</button>
          <button class="${mainTab === "templates" ? "active" : ""}" data-mailing-main-tab="templates">${icon("calendar")} Шаблоны сообщений</button>
          <button class="${mainTab === "automation" ? "active" : ""}" data-mailing-main-tab="automation">${icon("filter")} Автоматизация</button>
        </div>
        <div class="mailing-top-actions">
          <button class="secondary" data-mailing-action="test">${icon("telegram")} Тестовая отправка</button>
          <button class="primary" data-mailing-action="schedule">${icon("calendar")} Запланировать рассылку</button>
        </div>
      </div>
      ${state.mailingStatusNotice ? `<div class="mailing-notice">${state.mailingStatusNotice}</div>` : ""}
      ${mainTab === "campaigns" ? `<section class="panel mailing-section"><div class="mailing-section-head"><h2>Мои рассылки</h2><div class="mailing-section-actions"><button type="button" class="secondary" data-export-mailings>${icon("file")} Экспорт CSV</button><button type="button" class="primary" data-new-mailing>${icon("telegram")} Новая рассылка</button></div></div><div class="mailing-list-tools"><div class="mailing-filter-tabs">${[{ id: "all", label: "Все" }, { id: "scheduled", label: "Запланированные" }, { id: "test", label: "Тестовые" }, { id: "ready", label: "Готовые" }].map((item) => `<button type="button" class="${campaignFilter === item.id ? "active" : ""}" data-campaign-filter="${item.id}">${item.label}</button>`).join("")}</div><label class="mailing-search">${icon("search")}<input type="search" value="${state.mailingCampaignQuery}" placeholder="Поиск по рассылкам..." data-campaign-search /></label></div>${campaignRows.length ? campaignRows.map((item) => { const sourceIndex = state.mailingCampaigns.indexOf(item); const rowIndex = sourceIndex >= 0 ? sourceIndex : 0; return `<div class="mailing-history-row"><span class="event-dot court"></span><div><strong>${item.title}</strong><em>${item.meta || item.createdAt}</em></div>${badge(item.status, semanticTone(item.status))}<div class="mailing-row-actions">${actionMenu([{ label: "Редактировать", icon: "edit", attrs: { "data-edit-mailing-campaign": rowIndex } }, { label: "Удалить", icon: "trash", danger: true, attrs: { "data-delete-mailing-campaign": rowIndex } }], { label: "Дії рассылки" })}</div></div>`; }).join("") : `<p class="muted">По этому запросу рассылок не найдено.</p>`}</section>` : ""}
      ${mainTab === "templates" ? `<section class="panel mailing-section"><h2>Шаблоны сообщений</h2>${state.mailingTemplates.map((item, index) => `<div class="template-library-row"><div><strong>${item.title}</strong><em>${item.text}</em></div><span>${item.type}</span><div class="mailing-row-actions">${actionMenu([{ label: "Использовать", icon: "check", attrs: { "data-use-template": index } }, { label: "Редактировать", icon: "edit", attrs: { "data-edit-template": index } }, { label: "Удалить", icon: "trash", danger: true, attrs: { "data-delete-template": index } }], { label: "Дії шаблона" })}</div></div>`).join("")}</section>` : ""}
      ${mainTab === "automation" ? `<section class="panel mailing-section"><h2>Автоматизация</h2><div class="automation-grid">${state.mailingAutomationRules.map((rule, index) => `<article class="automation-rule ${rule.enabled ? "enabled" : ""}"><label><input type="checkbox" data-toggle-automation="${index}" ${rule.enabled ? "checked" : ""} /><span><strong>${rule.title}</strong><em>${rule.description}</em></span></label><select data-automation-channel="${index}">${["Telegram", "SMS", "Email", "Все каналы"].map((channel) => `<option ${rule.channel === channel ? "selected" : ""}>${channel}</option>`).join("")}</select>${badge(rule.enabled ? "Включено" : "Выключено", rule.enabled ? "green" : "red")}</article>`).join("")}</div></section>` : ""}
      ${mainTab === "new" ? `
      <div class="mailing-layout">
        <div class="mailing-left-stack">
          <section class="panel mailing-section mailing-recipients-section">
            <h2>1. Получатели</h2>
            <div class="recipient-mode-grid">
              <button class="${recipientMode === "all" ? "selected" : ""}" data-recipient-mode="all">${icon("filter")}<span><strong>Все клиенты</strong><em>1245 клиентов</em></span></button>
              <button class="${recipientMode === "segment" ? "selected" : ""}" data-recipient-mode="segment">${icon("check")}<span><strong>Сегмент клиентов</strong><em>Выбрано ${recipients} клиентов</em></span></button>
              <button class="${recipientMode === "manual" ? "selected" : ""}" data-recipient-mode="manual">${icon("user")}<span><strong>Выбор вручную</strong><em>Выбрано ${manualRecipients.length} клиентов</em></span></button>
            </div>
            ${recipientMode === "manual" ? `<div class="manual-recipient-box">
              <h3>Выберите клиентов</h3>
              <div class="manual-recipient-list">
                ${state.clients.map((client) => `<label>
                  <input type="checkbox" data-manual-recipient="${client.id}" ${state.mailingManualClientIds.includes(client.id) ? "checked" : ""} />
                  <span><strong>${client.name}</strong><em>${client.phone} · ${client.telegram ? "Telegram подключен" : "Telegram нет"}</em></span>
                </label>`).join("")}
              </div>
            </div>` : ""}
            ${recipientMode !== "manual" ? `
            <div class="segment-filter-box">
              <h3>Фильтры сегмента</h3>
              <div class="segment-chips">
                ${state.mailingFilters.map((filter, index) => `<span>${filter} <button data-remove-mailing-filter="${index}">×</button></span>`).join("") || `<em class="muted">Фильтры не выбраны</em>`}
              </div>
              <div class="segment-add-wrap">
                <button class="secondary segment-add" data-add-mailing-filter>+ Добавить фильтр</button>
                ${state.mailingFilterMenuOpen ? `<div class="segment-filter-menu">
                  ${availableFilters.length ? availableFilters.map((filter) => `<button type="button" data-select-mailing-filter="${filter}">${filter}</button>`).join("") : `<span>Все фильтры уже добавлены</span>`}
                </div>` : ""}
              </div>
            </div>
            ` : ""}
            <div class="coverage-row">
              <span class="coverage-user">${icon("user")}<strong>Всего клиентов</strong><em>${recipients}</em></span>
              <span class="coverage-telegram">${icon("telegram")}<strong>Telegram</strong><em>${estimatedTelegram} (82%)</em></span>
              <span class="coverage-sms">${icon("message")}<strong>SMS</strong><em>${smsDelivered} (62%)</em></span>
              <span class="coverage-email">${icon("mail")}<strong>Email</strong><em>${emailDelivered} (48%)</em></span>
            </div>
          </section>
          <section class="panel mailing-section">
            <h2>2. Содержание сообщения</h2>
            <div class="message-channel-tabs">
              ${["Telegram", "SMS", "Email"].map((channel) => `<button class="${editorChannel === channel ? "active" : ""}" data-message-channel="${channel}">${icon(channel === "Telegram" ? "telegram" : "mail")} ${channel}</button>`).join("")}
            </div>
            <div class="message-editor-grid">
              <div class="message-editor">
                <div class="editor-toolbar">
                  <button type="button" data-wrap-mailing="**">B</button><button type="button" data-wrap-mailing="_">I</button><button type="button" data-wrap-mailing="__">U</button><button type="button" data-insert-mailing="1. Пункт рассылки&#10;2. Следующий пункт">≡</button><button type="button" data-insert-mailing="- Пункт рассылки">•</button><button type="button" data-mail-var="{{unsubscribe_link}}">${icon("tag")}</button><button type="button" data-mail-var="🙂">☺</button>
                  <button type="button" class="variables-button" data-mail-var="{{client_name}}">Переменные⌄</button>
                </div>
                <textarea id="mailing-text" rows="10">${state.mailingText}</textarea>
              </div>
              <aside class="variables-panel">
                <h3>Доступные переменные</h3>
                ${["{{client_name}} — Имя клиента", "{{company_name}} — Назва компанії", "{{phone}} — Телефон клиента", "{{manager_name}} — Ваш менеджер", "{{current_date}} — Поточна дата", "{{unsubscribe_link}} — Посилання для відписки"].map((item) => {
                  const [key, text] = item.split(" — ");
                  return `<p><button data-mail-var="${key}">${key}</button> — ${text}</p>`;
                }).join("")}
              </aside>
            </div>
            <div class="message-footer-row">
              <span>Количество символов: <strong id="mailing-char-count">0</strong> (Telegram до 4096)</span>
              <button class="secondary" data-save-mailing-template>${icon("file")} Зберегти як шаблон</button>
            </div>
          </section>
          <section class="panel mailing-section send-settings-section">
            <h2>3. Настройки отправки</h2>
            <div class="send-settings-grid">
              <div>
                <h3>Способ отправки</h3>
                ${["Telegram", "SMS", "Email"].map((channel) => `<label><input type="checkbox" data-mailing-channel-toggle="${channel}" ${state.mailingChannels[channel] ? "checked" : ""} /> ${channel}</label>`).join("")}
              </div>
              <div>
                <h3>Дата и время отправки</h3>
                <label><input type="radio" name="send-time" value="now" ${state.mailingSendMode !== "later" ? "checked" : ""} /> Отправить сейчас</label>
                <label><input type="radio" name="send-time" value="later" ${state.mailingSendMode === "later" ? "checked" : ""} /> Запланировать на позже</label>
                ${state.mailingSendMode === "later" ? `<div class="mailing-schedule-fields">
                  <input type="date" value="${state.mailingScheduleDate}" data-mailing-schedule-date />
                  <input type="time" value="${state.mailingScheduleTime}" data-mailing-schedule-time />
                </div>` : ""}
              </div>
              <div>
                <h3>Дополнительные настройки</h3>
                <label><input type="checkbox" /> Отправить в нерабочее время</label>
                <label><input type="checkbox" checked /> Пропускать отписанных клиентов</label>
              </div>
            </div>
            <div class="test-send-box">
              <h3>Тестовые получатели</h3>
              <div class="test-contact-grid">
                ${state.mailingTestContacts.map((contact, index) => `<label>
                  <input type="checkbox" data-test-contact="${index}" ${contact.enabled ? "checked" : ""} />
                  ${icon(contact.channel === "Telegram" ? "telegram" : contact.channel === "SMS" ? "message" : "mail")}
                  <span><strong>${contact.channel}</strong><em>${contact.value}</em></span>
                </label>`).join("")}
              </div>
            </div>
          </section>
        </div>
        <aside class="mailing-right-stack">
          <section class="panel mailing-preview-card">
            <h2>Предпросмотр сообщения</h2>
            <div class="preview-tabs">${["Telegram", "SMS", "Email"].map((channel) => `<button class="${previewChannel === channel ? "active" : ""}" data-preview-channel="${channel}">${channel}</button>`).join("")}</div>
            <div class="telegram-preview">
              <div class="telegram-preview-head"><button type="button" data-preview-action="back">←</button><strong>${previewChannel === "Email" ? "Advocates Bureau" : previewChannel === "SMS" ? "SMS Alpha" : "Advocates Bureau"}<span>${previewChannel === "Telegram" ? "бот" : previewChannel}</span></strong><em><button type="button" data-preview-action="send">${icon(previewChannel === "Telegram" ? "telegram" : "mail")}</button><button type="button" data-preview-action="menu">⋮</button></em></div>
              <div class="telegram-preview-body">
                <div class="telegram-bubble ${previewChannel.toLowerCase()}-bubble" id="mail-preview"></div>
              </div>
            </div>
          </section>
          <section class="panel forecast-card">
            <h2>Прогноз результатов</h2>
            <div class="forecast-row"><span>Всего получателей</span><strong>${recipients}</strong></div>
            <div class="forecast-row green"><span>Telegram доставлено</span><strong>~ ${estimatedTelegram} (82%)</strong></div>
            <div class="forecast-row green"><span>SMS доставлено</span><strong>~ ${smsDelivered} (62%)</strong></div>
            <div class="forecast-row green"><span>Email доставлено</span><strong>~ ${emailDelivered} (48%)</strong></div>
            <div class="forecast-total"><span>Ориентировочный охват</span><strong>~ ${totalMessages} сообщений</strong></div>
          </section>
          <section class="panel mailing-tips-card">
            <h2>Советы</h2>
            <p>✓ Лучшее время для рассылки в Telegram: 10:00 – 12:00 и 18:00 – 20:00</p>
            <p>✓ Персонализируйте сообщения с помощью переменных</p>
            <p>✓ Тестируйте рассылку перед отправкой</p>
          </section>
        </aside>
      </div>
      ` : ""}
    </div>
  `;
  const textarea = $("#mailing-text");
  const preview = $("#mail-preview");
  const charCount = $("#mailing-char-count");
  bindActionMenus?.($("#mailings"));
  const update = () => {
    if (!textarea || !preview || !charCount) return;
    state.mailingText = textarea.value;
    charCount.textContent = textarea.value.length;
    const previewText = textarea.value
      .replace("Шановний {{client_name}}!", "Шановні клієнти!")
      .replaceAll("{{client_name}}", "Петренко Іван Миколайович");
    preview.textContent = previewChannel === "SMS" ? previewText.slice(0, 180) : previewChannel === "Email" ? `Тема: Важливе повідомлення від Advocates Bureau\n\n${previewText}` : previewText;
  };
  textarea?.addEventListener("input", update);
  document.querySelectorAll("[data-mailing-main-tab]").forEach((button) => button.addEventListener("click", () => {
    setTab(button.dataset.mailingMainTab);
    rerender();
  }));
  document.querySelector("[data-new-mailing]")?.addEventListener("click", () => {
    setTab("new");
    state.mailingStatusNotice = "Создайте новую рассылку: выберите получателей, текст и настройки отправки.";
    rerender();
  });
  document.querySelectorAll("[data-campaign-filter]").forEach((button) => button.addEventListener("click", () => {
    state.mailingCampaignFilter = button.dataset.campaignFilter;
    rerender();
  }));
  document.querySelector("[data-campaign-search]")?.addEventListener("input", (event) => {
    state.mailingCampaignQuery = event.target.value;
    rerender();
  });
  document.querySelector("[data-export-mailings]")?.addEventListener("click", () => {
    const rows = campaignRows.map((item) => [item.title, item.status, item.meta || "", item.createdAt || ""]);
    const csv = [["Название", "Статус", "Каналы и получатели", "Дата создания"], ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replaceAll("\"", "\"\"")}"`).join(","))
      .join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "mailings.csv";
    link.click();
    URL.revokeObjectURL(link.href);
    state.mailingStatusNotice = `Экспортировано строк: ${rows.length}.`;
    rerender();
    showToast(`CSV экспортирован: ${rows.length} строк.`);
  });
  document.querySelectorAll("[data-recipient-mode]").forEach((button) => button.addEventListener("click", () => {
    state.mailingRecipientMode = button.dataset.recipientMode;
    state.mailingStatusNotice = button.dataset.recipientMode === "manual" ? "Ручной выбор открыт: отметьте нужных клиентов в списке ниже." : "";
    rerender();
  }));
  document.querySelectorAll("[data-manual-recipient]").forEach((input) => input.addEventListener("change", () => {
    const clientId = Number(input.dataset.manualRecipient);
    if (input.checked) {
      state.mailingManualClientIds = [...new Set([...state.mailingManualClientIds, clientId])];
    } else {
      state.mailingManualClientIds = state.mailingManualClientIds.filter((id) => id !== clientId);
    }
    state.mailingStatusNotice = `Выбрано вручную: ${state.mailingManualClientIds.length} клиентов.`;
    rerender();
  }));
  document.querySelectorAll("[data-remove-mailing-filter]").forEach((button) => button.addEventListener("click", () => {
    state.mailingFilters.splice(Number(button.dataset.removeMailingFilter), 1);
    state.mailingFilterMenuOpen = false;
    rerender();
  }));
  document.querySelector("[data-add-mailing-filter]")?.addEventListener("click", () => {
    state.mailingFilterMenuOpen = !state.mailingFilterMenuOpen;
    rerender();
  });
  document.querySelectorAll("[data-select-mailing-filter]").forEach((button) => button.addEventListener("click", () => {
    state.mailingFilters.push(button.dataset.selectMailingFilter);
    state.mailingFilterMenuOpen = false;
    rerender();
  }));
  document.querySelectorAll("[data-message-channel]").forEach((button) => button.addEventListener("click", () => {
    state.mailingEditorChannel = button.dataset.messageChannel;
    state.mailingPreviewChannel = button.dataset.messageChannel;
    rerender();
  }));
  document.querySelectorAll("[data-preview-channel]").forEach((button) => button.addEventListener("click", () => {
    state.mailingPreviewChannel = button.dataset.previewChannel;
    rerender();
  }));
  document.querySelectorAll("[data-mail-var]").forEach((button) => button.addEventListener("click", () => {
    if (!textarea) return;
    const value = button.dataset.mailVar;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    textarea.value = `${textarea.value.slice(0, start)}${value}${textarea.value.slice(end)}`;
    textarea.focus();
    textarea.setSelectionRange(start + value.length, start + value.length);
    update();
  }));
  document.querySelectorAll("[data-insert-mailing]").forEach((button) => button.addEventListener("click", () => {
    if (!textarea) return;
    const value = button.dataset.insertMailing;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    textarea.value = `${textarea.value.slice(0, start)}${value}${textarea.value.slice(end)}`;
    textarea.focus();
    textarea.setSelectionRange(start + value.length, start + value.length);
    update();
  }));
  document.querySelectorAll("[data-wrap-mailing]").forEach((button) => button.addEventListener("click", () => {
    if (!textarea) return;
    const marker = button.dataset.wrapMailing;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = textarea.value.slice(start, end) || "текст";
    textarea.value = `${textarea.value.slice(0, start)}${marker}${selected}${marker}${textarea.value.slice(end)}`;
    update();
  }));
  document.querySelector("[data-save-mailing-template]")?.addEventListener("click", () => {
    state.mailingTemplates.unshift({ title: `Шаблон ${state.mailingTemplates.length + 1}`, type: state.mailingEditorChannel, text: state.mailingText });
    state.mailingStatusNotice = "Шаблон сохранён и доступен во вкладке «Шаблоны сообщений».";
    rerender();
    showToast("Шаблон сохранён.");
  });
  document.querySelectorAll("[data-use-template]").forEach((button) => button.addEventListener("click", () => {
    const template = state.mailingTemplates[Number(button.dataset.useTemplate)];
    if (!template) return;
    state.mailingText = template.text;
    setTab("new");
    state.mailingStatusNotice = `Шаблон «${template.title}» вставлен в редактор.`;
    rerender();
    showToast("Шаблон вставлен в редактор.");
  }));
  document.querySelectorAll("[data-edit-template]").forEach((button) => button.addEventListener("click", () => {
    const template = state.mailingTemplates[Number(button.dataset.editTemplate)];
    if (!template) return;
    state.mailingText = template.text;
    state.mailingEditorChannel = template.type === "Нагадування" || template.type === "Юридичне повідомлення" ? "Telegram" : template.type;
    state.mailingPreviewChannel = state.mailingEditorChannel;
    setTab("new");
    state.mailingStatusNotice = `Шаблон «${template.title}» открыт для редактирования. После правок сохраните его как новый шаблон.`;
    rerender();
    showToast("Шаблон открыт для редактирования.");
  }));
  document.querySelectorAll("[data-delete-template]").forEach((button) => button.addEventListener("click", () => {
    const index = Number(button.dataset.deleteTemplate);
    const [removed] = state.mailingTemplates.splice(index, 1);
    state.mailingStatusNotice = removed ? `Шаблон «${removed.title}» удалён.` : "";
    rerender();
    if (removed) showToast("Шаблон удалён.", "danger");
  }));
  document.querySelectorAll("[data-toggle-automation]").forEach((input) => input.addEventListener("change", () => {
    const rule = state.mailingAutomationRules[Number(input.dataset.toggleAutomation)];
    if (!rule) return;
    rule.enabled = input.checked;
    state.mailingStatusNotice = `Автоматизация «${rule.title}» ${rule.enabled ? "включена" : "выключена"}.`;
    rerender();
    showToast(rule.enabled ? "Автоматизация включена." : "Автоматизация выключена.", rule.enabled ? "success" : "warning");
  }));
  document.querySelectorAll("[data-automation-channel]").forEach((select) => select.addEventListener("change", () => {
    const rule = state.mailingAutomationRules[Number(select.dataset.automationChannel)];
    if (!rule) return;
    rule.channel = select.value;
    state.mailingStatusNotice = `Для автоматизации «${rule.title}» выбран канал: ${rule.channel}.`;
    rerender();
  }));
  document.querySelectorAll("[data-edit-mailing-campaign]").forEach((button) => button.addEventListener("click", () => {
    const campaign = state.mailingCampaigns[Number(button.dataset.editMailingCampaign)];
    if (!campaign) {
      state.mailingStatusNotice = "Это пример рассылки. Создайте новую рассылку, и её можно будет редактировать.";
      rerender();
      showToast("Примерную рассылку нельзя редактировать.", "warning");
      return;
    }
    state.mailingText = campaign.text || state.mailingText;
    state.mailingChannels = { ...state.mailingChannels, ...(campaign.channels || {}) };
    state.mailingSendMode = campaign.sendMode || "now";
    state.mailingScheduleDate = campaign.scheduleDate || state.mailingScheduleDate;
    state.mailingScheduleTime = campaign.scheduleTime || state.mailingScheduleTime;
    setTab("new");
    state.mailingStatusNotice = `Рассылка «${campaign.title}» открыта для редактирования.`;
    rerender();
    showToast("Рассылка открыта для редактирования.");
  }));
  document.querySelectorAll("[data-delete-mailing-campaign]").forEach((button) => button.addEventListener("click", () => {
    const index = Number(button.dataset.deleteMailingCampaign);
    if (!state.mailingCampaigns[index]) {
      state.mailingStatusNotice = "Примерную рассылку удалить нельзя. Она исчезнет, когда появятся ваши рассылки.";
      rerender();
      showToast("Примерную рассылку нельзя удалить.", "warning");
      return;
    }
    const [removed] = state.mailingCampaigns.splice(index, 1);
    state.mailingStatusNotice = `Рассылка «${removed.title}» удалена.`;
    rerender();
    showToast("Рассылка удалена.", "danger");
  }));
  document.querySelectorAll("[data-mailing-channel-toggle]").forEach((input) => input.addEventListener("change", () => {
    state.mailingChannels[input.dataset.mailingChannelToggle] = input.checked;
    rerender();
  }));
  document.querySelectorAll("[data-test-contact]").forEach((input) => input.addEventListener("change", () => {
    const contact = state.mailingTestContacts[Number(input.dataset.testContact)];
    if (!contact) return;
    contact.enabled = input.checked;
    state.mailingStatusNotice = `Тестовый контакт ${contact.channel} ${contact.enabled ? "включён" : "выключен"}.`;
    rerender();
  }));
  document.querySelectorAll('input[name="send-time"]').forEach((input) => input.addEventListener("change", () => {
    state.mailingSendMode = input.value;
    rerender();
  }));
  document.querySelector("[data-mailing-schedule-date]")?.addEventListener("change", (event) => {
    state.mailingScheduleDate = event.target.value;
  });
  document.querySelector("[data-mailing-schedule-time]")?.addEventListener("change", (event) => {
    state.mailingScheduleTime = event.target.value;
  });
  document.querySelectorAll("[data-mailing-action]").forEach((button) => button.addEventListener("click", () => {
    const action = button.dataset.mailingAction;
    const enabledChannels = Object.entries(state.mailingChannels).filter(([, enabled]) => enabled).map(([name]) => name);
    const enabledTestContacts = state.mailingTestContacts.filter((contact) => contact.enabled);
    if (mainTab !== "new") {
      setTab("new");
      state.mailingStatusNotice = "Сначала проверьте новую рассылку: действия отправки доступны из формы создания.";
      rerender();
      showToast("Открыл форму новой рассылки.", "warning");
      return;
    }
    if (!state.mailingText.trim()) {
      state.mailingStatusNotice = "Добавьте текст сообщения перед отправкой.";
      rerender();
      showToast("Добавьте текст сообщения.", "warning");
      return;
    }
    if (!enabledChannels.length) {
      state.mailingStatusNotice = "Выберите хотя бы один канал отправки: Telegram, SMS или Email.";
      rerender();
      showToast("Выберите канал отправки.", "warning");
      return;
    }
    if (!recipients) {
      state.mailingStatusNotice = "Выберите получателей перед отправкой рассылки.";
      rerender();
      showToast("Выберите получателей.", "warning");
      return;
    }
    if (action === "test" && !enabledTestContacts.length) {
      state.mailingStatusNotice = "Выберите хотя бы один тестовый контакт для тестовой отправки.";
      rerender();
      showToast("Выберите тестовый контакт.", "warning");
      return;
    }
    if (action === "schedule" && state.mailingSendMode === "later" && (!state.mailingScheduleDate || !state.mailingScheduleTime)) {
      state.mailingStatusNotice = "Укажите дату и время для запланированной рассылки.";
      rerender();
      showToast("Укажите дату и время отправки.", "warning");
      return;
    }
    const title = action === "test" ? "Тестовая отправка" : "Информационное сообщение клиентам";
    const plannedAt = state.mailingSendMode === "later" ? `${formatDate(state.mailingScheduleDate)} ${state.mailingScheduleTime}` : "сейчас";
    const status = action === "test" ? "Тест отправлен" : state.mailingSendMode === "later" ? "Запланирована" : "Готова к отправке";
    const testMeta = enabledTestContacts.map((contact) => `${contact.channel}: ${contact.value}`).join(" · ");
    state.mailingCampaigns.unshift({ title, status, meta: action === "test" ? testMeta : `${enabledChannels.join(" + ")} · ${recipients} получателей · ${plannedAt}`, createdAt: new Date().toLocaleString("uk-UA"), text: state.mailingText, channels: { ...state.mailingChannels }, sendMode: state.mailingSendMode, scheduleDate: state.mailingScheduleDate, scheduleTime: state.mailingScheduleTime });
    setTab("campaigns");
    state.mailingStatusNotice = action === "test" ? `Тестовая отправка создана: ${testMeta}.` : `Рассылка добавлена во вкладку «Мои рассылки»: ${plannedAt}.`;
    rerender();
    showToast(action === "test" ? "Тестовая отправка создана." : "Рассылка добавлена в «Мои рассылки».");
  }));
  document.querySelectorAll("[data-preview-action]").forEach((button) => button.addEventListener("click", () => {
    const messages = {
      back: "Предпросмотр открыт: стрелка возвращает к списку сообщений в полной версии.",
      send: "Быстрая тестовая отправка доступна через кнопку «Тестовая отправка» сверху.",
      menu: "Меню предпросмотра: здесь будут действия копирования и открытия канала."
    };
    state.mailingStatusNotice = messages[button.dataset.previewAction];
    rerender();
  }));
  update();
  syncNavigationState();
}
