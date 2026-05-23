import { deleteMailingCampaignFromApi, deleteMailingTemplateFromApi, saveMailingAutomationRuleToApi, saveMailingCampaignToApi, saveMailingTemplateToApi, sendMailingCampaignInApi, shouldUseApi, updateMailingDeliveryInApi } from "../api.js?v=mailings-api-69";

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
  const realDataMode = state.dataSource === "api";
  const persistMailings = shouldUseApi(state);
  if (!realDataMode && !state.mailingTemplates.length) {
    state.mailingTemplates = [
      { title: "Нагадування про подію", type: "Нагадування", text: "Шановний {{client_name}}, нагадуємо про заплановану подію у вашій справі." },
      { title: "Юридичне повідомлення", type: "Юридичне повідомлення", text: "Шановний {{client_name}}, повідомляємо важливу інформацію щодо вашого звернення." }
    ];
  }
  const recipientMode = state.mailingRecipientMode || "segment";
  const manualRecipients = state.clients.filter((client) => state.mailingManualClientIds.includes(client.id));
  const activeMailingFilters = realDataMode && !state.clients.length ? [] : state.mailingFilters;
  const totalClients = realDataMode ? state.clients.length : 1245;
  const demoSegmentRecipients = Math.max(120, 386 - Math.max(0, 3 - activeMailingFilters.length) * 58);
  const segmentRecipients = realDataMode ? totalClients : demoSegmentRecipients;
  const recipients = recipientMode === "all" ? totalClients : recipientMode === "manual" ? manualRecipients.length : segmentRecipients;
  const estimatedTelegram = Math.round(recipients * 0.82);
  const smsDelivered = Math.round(recipients * 0.625);
  const emailDelivered = Math.round(recipients * 0.482);
  const totalMessages = estimatedTelegram + smsDelivered + emailDelivered;
  const metricText = (value) => recipients ? `${value}` : "0";
  const forecastText = (value) => recipients ? `~ ${value}` : "0";
  const totalMessagesText = totalMessages ? `~ ${totalMessages} сообщений` : "0 сообщений";
  const mainTab = state.mailingMainTab || "new";
  const editorChannel = state.mailingEditorChannel || "Telegram";
  const previewChannel = state.mailingPreviewChannel || editorChannel;
  const filterOptions = ["Статус клиента: Новый", "Статус клиента: Активный", "Статус клиента: Постоянный", "Telegram: Подключен", "SMS: Доступен", "Email: Заполнен", "Источник: Сайт", "Источник: Рекомендация", "Ответственный: Іваненко А.Ю.", "Клиенты с активными делами", "Есть согласие на рассылку"];
  const availableFilters = filterOptions.filter((filter) => !activeMailingFilters.includes(filter));
  const campaignFilter = state.mailingCampaignFilter || "all";
  const campaignQuery = String(state.mailingCampaignQuery || "").trim().toLowerCase();
  const baseCampaignRows = state.mailingCampaigns.length ? state.mailingCampaigns : realDataMode ? [] : [{ title: "Нагадування про консультацію", status: "Відправлено", meta: "Telegram + SMS · 124 отримувачі", sample: true }];
  const campaignRows = baseCampaignRows.filter((item) => {
    if (campaignFilter === "all") return true;
    if (campaignFilter === "scheduled") return item.status === "Запланирована";
    if (campaignFilter === "test") return item.status === "Тест отправлен";
    return item.status !== "Запланирована" && item.status !== "Тест отправлен";
  }).filter((item) => {
    if (!campaignQuery) return true;
    return `${item.title} ${item.status} ${item.meta || ""} ${item.createdAt || ""}`.toLowerCase().includes(campaignQuery);
  });
  const campaignStatusMeta = (status = "") => {
    if (status === "Запланирована") return { icon: "calendar", tone: "violet", label: "Запланированные" };
    if (status === "Тест отправлен") return { icon: "telegram", tone: "blue", label: "Тестовые" };
    if (status === "Готова к отправке") return { icon: "clock", tone: "amber", label: "Готовые" };
    if (status === "Частично отправлено") return { icon: "bell", tone: "amber", label: "Частичные" };
    if (status === "Відправлено" || status === "Отправлено") return { icon: "check", tone: "green", label: "Отправленные" };
    return { icon: "file", tone: "blue", label: "Кампании" };
  };
  const deliverySummary = (item) => {
    const stats = item.deliveryStats || {};
    if (!stats.total) return "";
    const pending = Number(stats.pending || 0) + Number(stats.queued || 0);
    const sent = Number(stats.sent || 0) + Number(stats.delivered || 0);
    const error = Number(stats.error || 0);
    return `<span class="mailing-delivery-summary">
      <b class="mailing-channel-mini muted">${icon("clock")}${pending} ожидает</b>
      <b class="mailing-channel-mini green">${icon("check")}${sent} отправлено</b>
      ${error ? `<b class="mailing-channel-mini red">${icon("bell")}${error} ошибок</b>` : ""}
    </span>`;
  };
  const campaignChannels = (item) => {
    if (item.channels) return Object.entries(item.channels).filter(([, enabled]) => enabled).map(([name]) => name);
    return ["Telegram", "SMS", "Email"].filter((name) => String(item.meta || "").includes(name));
  };
  const statusTone = (status = "") => status === "error" ? "red" : status === "sent" || status === "delivered" ? "green" : "muted";
  const statusIcon = (status = "") => status === "error" ? "bell" : status === "sent" || status === "delivered" ? "check" : "clock";
  const deliveryRows = (item, rowIndex) => {
    if (!item.id || state.openMailingCampaignId !== item.id) return "";
    const rows = item.deliveries || [];
    if (!rows.length) return `<div class="mailing-delivery-panel"><p class="muted">Для этой кампании пока нет доставок.</p></div>`;
    return `<div class="mailing-delivery-panel">
      <div class="mailing-delivery-head"><strong>Доставки по клиентам</strong><span>${item.deliveryStats?.total || rows.length} записей</span></div>
      ${rows.map((delivery) => `<div class="mailing-delivery-row">
        <span><strong>${delivery.client}</strong><em>${delivery.channel}</em></span>
        <b class="mailing-channel-mini ${statusTone(delivery.status)}">${icon(statusIcon(delivery.status))}${delivery.statusLabel || delivery.status}</b>
        <div class="mailing-delivery-actions">
          ${delivery.status !== "sent" && delivery.status !== "delivered" ? `<button type="button" class="secondary" data-update-delivery="${delivery.id}" data-delivery-status="sent" data-campaign-index="${rowIndex}">${icon("check")} Отправлено</button>` : ""}
          ${delivery.status !== "error" ? `<button type="button" class="secondary danger-text" data-update-delivery="${delivery.id}" data-delivery-status="error" data-campaign-index="${rowIndex}">${icon("bell")} Ошибка</button>` : ""}
          ${delivery.status === "error" ? `<button type="button" class="secondary" data-update-delivery="${delivery.id}" data-delivery-status="queued" data-campaign-index="${rowIndex}">${icon("refresh")} Повторить</button>` : ""}
        </div>
      </div>`).join("")}
    </div>`;
  };
  const campaignStats = [
    { label: "Всего", value: baseCampaignRows.length, icon: "file", tone: "blue" },
    { label: "Запланированы", value: baseCampaignRows.filter((item) => item.status === "Запланирована").length, icon: "calendar", tone: "violet" },
    { label: "Тестовые", value: baseCampaignRows.filter((item) => item.status === "Тест отправлен").length, icon: "telegram", tone: "blue" },
    { label: "Готовые", value: baseCampaignRows.filter((item) => item.status === "Готова к отправке" || item.status === "Відправлено").length, icon: "check", tone: "green" }
  ];
  const campaignStatsMarkup = `<div class="mailing-campaign-kpis">${campaignStats.map((item) => `<article class="${item.tone}"><i>${icon(item.icon)}</i><div><strong>${item.value}</strong><span>${item.label}</span></div></article>`).join("")}</div>`;
  const campaignRowsMarkup = campaignRows.length ? campaignRows.map((item) => {
    const sourceIndex = state.mailingCampaigns.indexOf(item);
    const rowIndex = sourceIndex >= 0 ? sourceIndex : 0;
    const statusMeta = campaignStatusMeta(item.status);
    const channels = campaignChannels(item);
    const queuedCount = Number(item.deliveryStats?.pending || 0) + Number(item.deliveryStats?.queued || 0);
    const deliveryToggle = item.deliveryStats?.total ? { label: state.openMailingCampaignId === item.id ? "Скрыть доставки" : "Доставки", icon: "filter", attrs: { "data-toggle-mailing-deliveries": rowIndex } } : null;
    const menuItems = [{ label: "Редактировать", icon: "edit", attrs: { "data-edit-mailing-campaign": rowIndex } }, ...(deliveryToggle ? [deliveryToggle] : []), { label: "Удалить", icon: "trash", danger: true, attrs: { "data-delete-mailing-campaign": rowIndex } }];
    const sendButton = queuedCount && item.id ? `<button type="button" class="primary mailing-send-toggle" data-send-mailing-campaign="${rowIndex}">${icon("telegram")} Запустить</button>` : "";
    const deliveryButton = deliveryToggle ? `<button type="button" class="secondary mailing-delivery-toggle ${state.openMailingCampaignId === item.id ? "active" : ""}" data-toggle-mailing-deliveries="${rowIndex}">${icon("filter")} ${state.openMailingCampaignId === item.id ? "Скрыть доставки" : "Доставки"}</button>` : "";
    return `<div class="mailing-campaign-block"><div class="mailing-history-row ${statusMeta.tone}">
      <i class="mailing-campaign-icon">${icon(statusMeta.icon)}</i>
      <div class="mailing-campaign-main">
        <strong>${item.title}</strong>
        <em>${item.meta || item.createdAt}</em>
        <span>${channels.map((channel) => `<b class="mailing-channel-mini ${channel.toLowerCase()}">${icon(channel === "Telegram" ? "telegram" : channel === "SMS" ? "message" : "mail")}${channel}</b>`).join("") || `<b class="mailing-channel-mini muted">${statusMeta.label}</b>`}</span>
        ${deliverySummary(item)}
      </div>
      ${badge(item.status, statusMeta.tone)}
      <div class="mailing-row-actions">${sendButton}${deliveryButton}${actionMenu(menuItems, { label: "Дії рассылки" })}</div>
    </div>${deliveryRows(item, rowIndex)}</div>`;
  }).join("") : `<p class="muted">По этому запросу рассылок не найдено.</p>`;
  const channelIcon = (channel = "") => channel === "SMS" ? "message" : channel === "Email" ? "mail" : channel === "Telegram" ? "telegram" : channel === "Все каналы" ? "filter" : "file";
  const channelClass = (channel = "") => ["Telegram", "SMS", "Email"].includes(channel) ? channel.toLowerCase() : "all";
  const templateRowsMarkup = state.mailingTemplates.map((item, index) => `<div class="template-library-row">
    <i class="template-channel-icon ${channelClass(item.type)}">${icon(channelIcon(item.type))}</i>
    <div>
      <strong>${item.title}</strong>
      <em>${item.text}</em>
    </div>
    <span class="mailing-channel-mini ${channelClass(item.type)}">${icon(channelIcon(item.type))}${item.type}</span>
    <div class="mailing-row-actions">${actionMenu([{ label: "Использовать", icon: "check", attrs: { "data-use-template": index } }, { label: "Редактировать", icon: "edit", attrs: { "data-edit-template": index } }, { label: "Удалить", icon: "trash", danger: true, attrs: { "data-delete-template": index } }], { label: "Дії шаблона" })}</div>
  </div>`).join("");
  const templateStats = [
    { label: "Шаблонов", value: state.mailingTemplates.length, icon: "file", tone: "blue" },
    { label: "Telegram", value: state.mailingTemplates.filter((item) => item.type === "Telegram" || item.type === "Нагадування").length, icon: "telegram", tone: "blue" },
    { label: "С переменными", value: state.mailingTemplates.filter((item) => /\{\{.+?\}\}/.test(item.text)).length, icon: "tag", tone: "violet" },
    { label: "Готовы", value: state.mailingTemplates.filter((item) => item.text.length > 30).length, icon: "check", tone: "green" }
  ];
  const templateStatsMarkup = `<div class="mailing-campaign-kpis mailing-template-kpis">${templateStats.map((item) => `<article class="${item.tone}"><i>${icon(item.icon)}</i><div><strong>${item.value}</strong><span>${item.label}</span></div></article>`).join("")}</div>`;
  const automationRowsMarkup = state.mailingAutomationRules.map((rule, index) => `<article class="automation-rule ${rule.enabled ? "enabled" : "disabled"}">
    <label>
      <input type="checkbox" data-toggle-automation="${index}" ${rule.enabled ? "checked" : ""} />
      <i class="automation-rule-icon ${rule.enabled ? "green" : "red"}">${icon(rule.enabled ? "check" : "bell")}</i>
      <span><strong>${rule.title}</strong><em>${rule.description}</em></span>
    </label>
    <span class="mailing-channel-mini ${channelClass(rule.channel)}">${icon(channelIcon(rule.channel))}${rule.channel}</span>
    <select data-automation-channel="${index}">${["Telegram", "SMS", "Email", "Все каналы"].map((channel) => `<option ${rule.channel === channel ? "selected" : ""}>${channel}</option>`).join("")}</select>
    ${badge(rule.enabled ? "Включено" : "Выключено", rule.enabled ? "green" : "red")}
  </article>`).join("");
  const automationStats = [
    { label: "Правил", value: state.mailingAutomationRules.length, icon: "filter", tone: "blue" },
    { label: "Включено", value: state.mailingAutomationRules.filter((rule) => rule.enabled).length, icon: "check", tone: "green" },
    { label: "Выключено", value: state.mailingAutomationRules.filter((rule) => !rule.enabled).length, icon: "bell", tone: "amber" },
    { label: "Telegram", value: state.mailingAutomationRules.filter((rule) => rule.channel === "Telegram").length, icon: "telegram", tone: "blue" }
  ];
  const automationStatsMarkup = `<div class="mailing-campaign-kpis mailing-automation-kpis">${automationStats.map((item) => `<article class="${item.tone}"><i>${icon(item.icon)}</i><div><strong>${item.value}</strong><span>${item.label}</span></div></article>`).join("")}</div>`;
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
      ${mainTab === "campaigns" ? `<section class="panel mailing-section"><div class="mailing-section-head"><h2>Мои рассылки</h2><div class="mailing-section-actions"><button type="button" class="secondary" data-export-mailings>${icon("file")} Экспорт CSV</button><button type="button" class="primary" data-new-mailing>${icon("telegram")} Новая рассылка</button></div></div>${campaignStatsMarkup}<div class="mailing-list-tools"><div class="mailing-filter-tabs">${[{ id: "all", label: "Все" }, { id: "scheduled", label: "Запланированные" }, { id: "test", label: "Тестовые" }, { id: "ready", label: "Готовые" }].map((item) => `<button type="button" class="${campaignFilter === item.id ? "active" : ""}" data-campaign-filter="${item.id}">${item.label}</button>`).join("")}</div><label class="mailing-search">${icon("search")}<input type="search" value="${state.mailingCampaignQuery}" placeholder="Поиск по рассылкам..." data-campaign-search /></label></div><div class="mailing-history-list">${campaignRowsMarkup}</div></section>` : ""}
      ${mainTab === "templates" ? `<section class="panel mailing-section"><div class="mailing-section-head"><h2>Шаблоны сообщений</h2><button type="button" class="secondary" data-new-mailing>${icon("telegram")} Создать из сообщения</button></div>${templateStatsMarkup}<div class="template-library-list">${templateRowsMarkup}</div></section>` : ""}
      ${mainTab === "automation" ? `<section class="panel mailing-section"><div class="mailing-section-head"><h2>Автоматизация</h2><button type="button" class="secondary" data-mailing-main-tab="new">${icon("telegram")} Новая рассылка</button></div>${automationStatsMarkup}<div class="automation-grid">${automationRowsMarkup}</div></section>` : ""}
      ${mainTab === "new" ? `
      <div class="mailing-layout">
        <div class="mailing-left-stack">
          <section class="panel mailing-section mailing-recipients-section">
            <h2>1. Получатели</h2>
            <div class="recipient-mode-grid">
              <button class="recipient-mode-card ${recipientMode === "all" ? "selected" : ""}" data-recipient-mode="all">${icon("filter")}<span><strong>Все клиенты</strong><em>${totalClients} клиентов</em></span></button>
              <button class="recipient-mode-card ${recipientMode === "segment" ? "selected" : ""}" data-recipient-mode="segment">${icon("check")}<span><strong>Сегмент клиентов</strong><em>Выбрано ${recipients} клиентов</em></span></button>
              <button class="recipient-mode-card ${recipientMode === "manual" ? "selected" : ""}" data-recipient-mode="manual">${icon("user")}<span><strong>Выбор вручную</strong><em>Выбрано ${manualRecipients.length} клиентов</em></span></button>
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
                ${activeMailingFilters.map((filter, index) => `<span>${filter} <button data-remove-mailing-filter="${index}">×</button></span>`).join("") || `<em class="muted">Фильтры не выбраны</em>`}
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
              <span class="coverage-telegram">${icon("telegram")}<strong>Telegram</strong><em>${metricText(estimatedTelegram)}</em></span>
              <span class="coverage-sms">${icon("message")}<strong>SMS</strong><em>${metricText(smsDelivered)}</em></span>
              <span class="coverage-email">${icon("mail")}<strong>Email</strong><em>${metricText(emailDelivered)}</em></span>
            </div>
          </section>
          <section class="panel mailing-section">
            <h2>2. Содержание сообщения</h2>
            <div class="message-channel-tabs">
              ${["Telegram", "SMS", "Email"].map((channel) => `<button class="${editorChannel === channel ? "active" : ""}" data-message-channel="${channel}">${icon(channel === "Telegram" ? "telegram" : channel === "SMS" ? "message" : "mail")} ${channel}</button>`).join("")}
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
              <div class="telegram-preview-head"><button type="button" data-preview-action="back">←</button><span class="telegram-preview-avatar">AB</span><strong>${previewChannel === "Email" ? "Advocates Bureau" : previewChannel === "SMS" ? "SMS Alpha" : "Advocates Bureau"}<span>${previewChannel === "Telegram" ? "бот" : previewChannel}</span></strong><em><button type="button" data-preview-action="send">${icon(previewChannel === "Telegram" ? "telegram" : previewChannel === "SMS" ? "message" : "mail")}</button><button type="button" data-preview-action="menu">⋮</button></em></div>
              <div class="telegram-preview-body">
                <div class="telegram-bubble ${previewChannel.toLowerCase()}-bubble" id="mail-preview"></div>
              </div>
            </div>
          </section>
          <section class="panel forecast-card">
            <h2>Прогноз результатов</h2>
            <div class="forecast-row"><span>Всего получателей</span><strong>${recipients}</strong></div>
            <div class="forecast-row green"><span>Telegram доставлено</span><strong>${forecastText(estimatedTelegram)}</strong></div>
            <div class="forecast-row green"><span>SMS доставлено</span><strong>${forecastText(smsDelivered)}</strong></div>
            <div class="forecast-row green"><span>Email доставлено</span><strong>${forecastText(emailDelivered)}</strong></div>
            <div class="forecast-total"><span>Ориентировочный охват</span><strong>${totalMessagesText}</strong></div>
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
  document.querySelector("[data-save-mailing-template]")?.addEventListener("click", async () => {
    const template = { title: `Шаблон ${state.mailingTemplates.length + 1}`, type: state.mailingEditorChannel, text: state.mailingText };
    try {
      const saved = persistMailings ? await saveMailingTemplateToApi(template) : template;
      state.mailingTemplates.unshift(saved);
      state.mailingStatusNotice = "Шаблон сохранён и доступен во вкладке «Шаблоны сообщений».";
      rerender();
      showToast("Шаблон сохранён.");
    } catch (error) {
      state.mailingStatusNotice = "Не удалось сохранить шаблон на сервере.";
      rerender();
      showToast(error.message || "Не удалось сохранить шаблон.", "danger");
    }
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
  document.querySelectorAll("[data-delete-template]").forEach((button) => button.addEventListener("click", async () => {
    const index = Number(button.dataset.deleteTemplate);
    const removed = state.mailingTemplates[index];
    if (!removed) return;
    try {
      if (persistMailings && removed.id) await deleteMailingTemplateFromApi(removed.id);
      state.mailingTemplates.splice(index, 1);
      state.mailingStatusNotice = `Шаблон «${removed.title}» удалён.`;
      rerender();
      showToast("Шаблон удалён.", "danger");
    } catch (error) {
      state.mailingStatusNotice = "Не удалось удалить шаблон на сервере.";
      rerender();
      showToast(error.message || "Не удалось удалить шаблон.", "danger");
    }
  }));
  document.querySelectorAll("[data-toggle-automation]").forEach((input) => input.addEventListener("change", () => {
    const rule = state.mailingAutomationRules[Number(input.dataset.toggleAutomation)];
    if (!rule) return;
    const previous = rule.enabled;
    rule.enabled = input.checked;
    const save = async () => {
      try {
        const saved = persistMailings ? await saveMailingAutomationRuleToApi(rule) : rule;
        state.mailingAutomationRules[Number(input.dataset.toggleAutomation)] = saved;
        state.mailingStatusNotice = `Автоматизация «${saved.title}» ${saved.enabled ? "включена" : "выключена"}.`;
        rerender();
        showToast(saved.enabled ? "Автоматизация включена." : "Автоматизация выключена.", saved.enabled ? "success" : "warning");
      } catch (error) {
        rule.enabled = previous;
        state.mailingStatusNotice = "Не удалось сохранить правило автоматизации на сервере.";
        rerender();
        showToast(error.message || "Не удалось сохранить правило.", "danger");
      }
    };
    save();
  }));
  document.querySelectorAll("[data-automation-channel]").forEach((select) => select.addEventListener("change", () => {
    const rule = state.mailingAutomationRules[Number(select.dataset.automationChannel)];
    if (!rule) return;
    const previous = rule.channel;
    rule.channel = select.value;
    const save = async () => {
      try {
        const saved = persistMailings ? await saveMailingAutomationRuleToApi(rule) : rule;
        state.mailingAutomationRules[Number(select.dataset.automationChannel)] = saved;
        state.mailingStatusNotice = `Для автоматизации «${saved.title}» выбран канал: ${saved.channel}.`;
        rerender();
      } catch (error) {
        rule.channel = previous;
        state.mailingStatusNotice = "Не удалось сохранить канал автоматизации на сервере.";
        rerender();
        showToast(error.message || "Не удалось сохранить канал.", "danger");
      }
    };
    save();
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
  document.querySelectorAll("[data-toggle-mailing-deliveries]").forEach((button) => button.addEventListener("click", () => {
    const campaign = state.mailingCampaigns[Number(button.dataset.toggleMailingDeliveries)];
    if (!campaign?.id) return;
    state.openMailingCampaignId = state.openMailingCampaignId === campaign.id ? "" : campaign.id;
    state.mailingStatusNotice = state.openMailingCampaignId ? `Открыты доставки рассылки «${campaign.title}».` : "";
    rerender();
  }));
  document.querySelectorAll("[data-update-delivery]").forEach((button) => button.addEventListener("click", async () => {
    const campaignIndex = Number(button.dataset.campaignIndex);
    const status = button.dataset.deliveryStatus;
    try {
      const response = persistMailings
        ? await updateMailingDeliveryInApi(button.dataset.updateDelivery, { status })
        : null;
      if (response?.campaign) state.mailingCampaigns[campaignIndex] = response.campaign;
      state.openMailingCampaignId = response?.campaign?.id || state.openMailingCampaignId;
      state.mailingStatusNotice = status === "error" ? "Доставка помечена как ошибка." : status === "queued" ? "Доставка возвращена в очередь." : "Доставка помечена как отправленная.";
      rerender();
      showToast(state.mailingStatusNotice, status === "error" ? "warning" : "success");
    } catch (error) {
      state.mailingStatusNotice = "Не удалось обновить статус доставки на сервере.";
      rerender();
      showToast(error.message || "Не удалось обновить доставку.", "danger");
    }
  }));
  document.querySelectorAll("[data-send-mailing-campaign]").forEach((button) => button.addEventListener("click", async () => {
    const campaignIndex = Number(button.dataset.sendMailingCampaign);
    const campaign = state.mailingCampaigns[campaignIndex];
    if (!campaign?.id) return;
    try {
      const response = persistMailings ? await sendMailingCampaignInApi(campaign.id) : null;
      if (response?.campaign) state.mailingCampaigns[campaignIndex] = response.campaign;
      state.openMailingCampaignId = response?.campaign?.id || state.openMailingCampaignId;
      state.mailingStatusNotice = `Mock-отправка запущена: отправлено ${response?.sent || 0} доставок.`;
      rerender();
      showToast(state.mailingStatusNotice, "success");
    } catch (error) {
      state.mailingStatusNotice = "Не удалось запустить отправку на сервере.";
      rerender();
      showToast(error.message || "Не удалось запустить отправку.", "danger");
    }
  }));
  document.querySelectorAll("[data-delete-mailing-campaign]").forEach((button) => button.addEventListener("click", async () => {
    const index = Number(button.dataset.deleteMailingCampaign);
    if (!state.mailingCampaigns[index]) {
      state.mailingStatusNotice = "Примерную рассылку удалить нельзя. Она исчезнет, когда появятся ваши рассылки.";
      rerender();
      showToast("Примерную рассылку нельзя удалить.", "warning");
      return;
    }
    const removed = state.mailingCampaigns[index];
    try {
      if (persistMailings && removed.id) await deleteMailingCampaignFromApi(removed.id);
      state.mailingCampaigns.splice(index, 1);
      if (state.openMailingCampaignId === removed.id) state.openMailingCampaignId = "";
      state.mailingStatusNotice = `Рассылка «${removed.title}» удалена.`;
      rerender();
      showToast("Рассылка удалена.", "danger");
    } catch (error) {
      state.mailingStatusNotice = "Не удалось удалить рассылку на сервере.";
      rerender();
      showToast(error.message || "Не удалось удалить рассылку.", "danger");
    }
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
  document.querySelectorAll("[data-mailing-action]").forEach((button) => button.addEventListener("click", async () => {
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
    const campaign = {
      title,
      status,
      meta: action === "test" ? testMeta : `${enabledChannels.join(" + ")} · ${recipients} получателей · ${plannedAt}`,
      createdAt: new Date().toLocaleString("uk-UA"),
      text: state.mailingText,
      channels: { ...state.mailingChannels },
      sendMode: state.mailingSendMode,
      scheduleDate: state.mailingScheduleDate,
      scheduleTime: state.mailingScheduleTime,
      recipientMode: state.mailingRecipientMode,
      manualClientIds: state.mailingManualClientIds,
      filters: activeMailingFilters,
      recipientCount: recipients
    };
    try {
      const saved = persistMailings ? await saveMailingCampaignToApi(campaign) : campaign;
      state.mailingCampaigns.unshift(saved);
      setTab("campaigns");
      state.mailingStatusNotice = action === "test" ? `Тестовая отправка создана: ${testMeta}.` : `Рассылка добавлена во вкладку «Мои рассылки»: ${plannedAt}.`;
      rerender();
      showToast(action === "test" ? "Тестовая отправка создана." : "Рассылка добавлена в «Мои рассылки».");
    } catch (error) {
      state.mailingStatusNotice = "Не удалось сохранить рассылку на сервере.";
      rerender();
      showToast(error.message || "Не удалось сохранить рассылку.", "danger");
    }
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
