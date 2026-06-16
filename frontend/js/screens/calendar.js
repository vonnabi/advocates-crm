import { saveEventToApi, shouldUseApi } from "../api.js";
import { normalizeEvent } from "../state.js";

let state;
let $;
let icon;
let badge;
let calendarTimeTone;
let calendarTitle;
let calendarToday;
let calendarViewDays;
let dateFromIso;
let formatDate;
let isoFromDate;
let monthNames;
let todayIso;
let weekDayNames;
let addDays;
let clientById;
let caseById;
let parseDisplayDate;
let openEventDialog;
let openTaskDialog;
let openDeleteDocumentConfirm;
let renderCases;
let switchView;
let showToast;

function applyContext(ctx) {
  ({
    state,
    $,
    icon,
    badge,
    calendarTimeTone,
    calendarTitle,
    calendarToday,
    calendarViewDays,
    dateFromIso,
    formatDate,
    isoFromDate,
    monthNames,
    todayIso,
    weekDayNames,
    addDays,
    clientById,
    caseById,
    parseDisplayDate,
    openEventDialog,
    openTaskDialog,
    openDeleteDocumentConfirm,
    renderCases,
    switchView,
    showToast
  } = ctx);
}

export function renderCalendarScreen(ctx) {
  applyContext(ctx);
  renderCalendar();
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function closeCalendarSelectMenus(except = null) {
  document.querySelectorAll(".calendar-filter-field .document-custom-select.is-open").forEach((shell) => {
    if (shell === except) return;
    shell.classList.remove("is-open");
    shell.querySelector(".document-custom-select-button")?.setAttribute("aria-expanded", "false");
    const menu = shell.querySelector(".document-custom-select-menu");
    if (menu) menu.hidden = true;
  });
}

function closeCalendarDayMenus(except = null) {
  document.querySelectorAll(".calendar-day-more-wrap.is-open").forEach((shell) => {
    if (shell === except) return;
    shell.classList.remove("is-open");
    shell.querySelector("[data-calendar-more]")?.setAttribute("aria-expanded", "false");
  });
}

function syncCalendarCustomSelect(select) {
  const shell = select.nextElementSibling?.classList?.contains("document-custom-select")
    ? select.nextElementSibling
    : null;
  if (!shell) return;
  const selected = select.selectedOptions?.[0] || select.options[0];
  const buttonText = shell.querySelector("[data-document-select-value]");
  const menu = shell.querySelector(".document-custom-select-menu");
  if (buttonText) buttonText.textContent = selected?.textContent || "";
  if (!menu) return;
  menu.innerHTML = [...select.options].filter((option) => !option.hidden).map((option) => `
    <button class="document-custom-select-option ${option.value === select.value ? "is-selected" : ""}" type="button" role="option" data-value="${escapeHtml(option.value)}" aria-selected="${option.value === select.value ? "true" : "false"}">
      <span aria-hidden="true">✓</span>
      <strong>${escapeHtml(option.textContent || "")}</strong>
    </button>
  `).join("");
}

function setupCalendarCustomSelects() {
  document.querySelectorAll(".calendar-filter-field > select").forEach((select) => {
    select.classList.add("document-native-select");
    select.tabIndex = -1;
    select.setAttribute("aria-hidden", "true");
    let shell = select.nextElementSibling?.classList?.contains("document-custom-select")
      ? select.nextElementSibling
      : null;
    if (!shell) {
      shell = document.createElement("div");
      shell.className = "document-custom-select calendar-filter-select";
      shell.innerHTML = `
        <button class="document-custom-select-button" type="button" aria-haspopup="listbox" aria-expanded="false">
          <span data-document-select-value></span>
          <span class="document-custom-select-chevron" aria-hidden="true"></span>
        </button>
        <div class="document-custom-select-menu" role="listbox" hidden></div>
      `;
      select.insertAdjacentElement("afterend", shell);
      shell.querySelector(".document-custom-select-button")?.addEventListener("click", () => {
        const isOpen = shell.classList.contains("is-open");
        closeCalendarSelectMenus(isOpen ? null : shell);
        shell.classList.toggle("is-open", !isOpen);
        shell.querySelector(".document-custom-select-button")?.setAttribute("aria-expanded", String(!isOpen));
        const menu = shell.querySelector(".document-custom-select-menu");
        if (menu) menu.hidden = isOpen;
      });
      shell.querySelector(".document-custom-select-menu")?.addEventListener("click", (event) => {
        const optionButton = event.target.closest(".document-custom-select-option");
        if (!optionButton) return;
        select.value = optionButton.dataset.value || "";
        select.dispatchEvent(new Event("change", { bubbles: true }));
        syncCalendarCustomSelect(select);
        closeCalendarSelectMenus();
      });
    }
    syncCalendarCustomSelect(select);
  });
}

function eventClass(event) {
  const typeConfig = calendarEventTypeMap()[event.type];
  if (typeConfig) return typeConfig.className;
  if (event.source === "task") return "task";
  if (event.type.includes("Зустр") || event.type.includes("Консульта")) return "meeting";
  if (event.type.includes("Суд")) return "court";
  if (event.type.includes("строк")) return "deadline";
  if (event.type.includes("документ") || event.type.includes("Документ")) return "doc";
  if (event.type.includes("Ожид") || event.type.includes("Очіку")) return "waiting";
  return "other";
}

function calendarEventTypeMap() {
  return {
    "Судове засідання": { className: "court", label: "Суд", hint: "Суд / орган" },
    "Зустріч з клієнтом": { className: "meeting", label: "Зустріч", hint: "Клієнт" },
    "Консультація": { className: "consultation", label: "Консультація", hint: "Первинний контакт" },
    "Підготовка документа": { className: "doc", label: "Документ", hint: "Процесуальний документ" },
    "Крайній строк": { className: "deadline", label: "Дедлайн", hint: "Контроль строку" },
    "Ожидання відповіді від органу": { className: "waiting", label: "Очікування", hint: "Суд / ТЦК / держорган" },
    "Внутрішня задача": { className: "task", label: "Задача", hint: "Внутрішня робота" },
    "Інше": { className: "other", label: "Інше", hint: "Довільна подія" }
  };
}

export function calendarEventTypes(ctx = null) {
  if (ctx) applyContext(ctx);
  return Object.keys(calendarEventTypeMap());
}

export function calendarStatuses(ctx = null) {
  if (ctx) applyContext(ctx);
  return ["Заплановано", "Очікує виконання", "Виконано", "Перенесено", "Скасовано", "Просрочено"];
}

function responsibleNames() {
  return [...new Set([
    ...state.cases.map((item) => item.responsible),
    ...state.cases.flatMap((item) => item.tasks.map((task) => task.responsible)),
    "Іваненко А.Ю.",
    "Мельник Н.П.",
    "Кравчук А.В.",
    "Петренко С.В."
  ].filter(Boolean))];
}

function addMinutesToTime(time, minutes) {
  const [hour = 9, minute = 0] = String(time || "09:00").split(":").map(Number);
  const date = new Date(2024, 0, 1, hour, minute + minutes);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function calendarSortValue(event) {
  return `${event.date} ${event.time || "23:59"}`;
}

function calendarDistanceFrom(dateIso, anchorDate) {
  return Math.abs(dateFromIso(dateIso) - anchorDate);
}

function calendarAutoFocusEvent(events, activeDate) {
  const selected = events.find((event) => event.id === state.selectedEventId);
  if (selected) return selected;
  const today = dateFromIso(calendarToday);
  const upcoming = events
    .filter((event) => dateFromIso(event.date) >= today)
    .sort((a, b) => calendarSortValue(a).localeCompare(calendarSortValue(b)));
  return upcoming[0] || [...events].sort((a, b) => calendarDistanceFrom(a.date, activeDate) - calendarDistanceFrom(b.date, activeDate))[0];
}

function calendarTimeLabel(event) {
  return event.source === "task" ? "" : event.time;
}

function calendarTimeRange(event, meta) {
  if (event.source === "task") return "";
  return `${event.time} - ${meta.endTime}`;
}

export function calendarEventMeta(ctxOrEvent, maybeEvent) {
  const event = maybeEvent || ctxOrEvent;
  if (maybeEvent) applyContext(ctxOrEvent);
  const caseItem = caseById(event.caseId);
  const reminderEnabled = Boolean(event.reminderEnabled || event.reminderChannels);
  const fallbackEndTime = addMinutesToTime(event.time, event.type?.includes("Суд") ? 90 : 60);
  const endTime = event.endTime && event.endTime > event.time ? event.endTime : fallbackEndTime;
  return {
    client: clientById(event.clientId),
    caseItem,
    authority: event.authority || caseItem?.court || "Не вказано",
    location: event.location || event.authorityAddress || caseItem?.authorityAddress || event.description || "Не вказано",
    responsible: event.responsible || caseItem?.responsible || "Іваненко А.Ю.",
    endTime,
    recurrence: event.recurrence || "Не повторювати",
    reminderEnabled,
    reminderBefore: reminderEnabled ? (event.reminderBefore || "За 1 день") : "",
    reminderChannels: reminderEnabled ? (event.reminderChannels || "CRM") : "",
    reminderRecipients: reminderEnabled ? (event.reminderRecipients || "Відповідальний юрист + клієнт") : ""
  };
}

function calendarReminderRows(event) {
  const meta = calendarEventMeta(event);
  if (!meta.reminderEnabled) return [];
  const channels = String(meta.reminderChannels).split("+").map((item) => item.trim()).filter(Boolean);
  const beforeOptions = channels.length > 2 ? [meta.reminderBefore, "За 1 день", "За 1 годину"] : channels.map(() => meta.reminderBefore);
  return channels.map((channel, index) => ({
    channel,
    before: beforeOptions[index] || meta.reminderBefore,
    recipient: meta.reminderRecipients,
    scheduledAt: reminderScheduledAt(event, beforeOptions[index] || meta.reminderBefore),
    status: event.status === "Виконано" ? "Виконано" : channel === "CRM" ? "Готово" : "У плані",
    tone: event.status === "Виконано" || channel === "CRM" ? "ready" : "planned"
  }));
}

function reminderOffsetHours(before) {
  if (before.includes("1 год")) return 1;
  if (before.includes("3 год")) return 3;
  if (before.includes("1 день")) return 24;
  if (before.includes("3 д")) return 72;
  if (before.includes("7 д")) return 168;
  return 24;
}

function reminderScheduledAt(event, before) {
  const [year, month, day] = String(event.date).split("-").map(Number);
  const [hour = 9, minute = 0] = String(event.time || "09:00").split(":").map(Number);
  const date = new Date(year, month - 1, day, hour - reminderOffsetHours(before), minute);
  return `${date.toLocaleDateString("uk-UA")} о ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function eventTimeLeftLabel(event) {
  const now = dateFromIso(calendarToday);
  const eventDate = dateFromIso(event.date);
  const diffHours = Math.ceil((eventDate - now) / 3600000);
  const diffDays = Math.ceil((eventDate - now) / 86400000);
  if (diffHours < 0) return "Просрочено";
  if (diffHours <= 24) return diffHours <= 1 ? "Менше години" : `Через ${diffHours} год.`;
  return diffDays === 1 ? "Через 1 день" : `Через ${diffDays} дні`;
}

function taskCalendarEntries() {
  return state.cases.flatMap((item) => item.tasks.map((task, index) => {
    const date = parseDisplayDate(task.due);
    if (!task.showInCalendar || !date) return null;
    const client = clientById(item.clientId);
    const [, month, day] = date.split("-");
    return {
      id: `task-${item.id}-${index}`,
      source: "task",
      taskIndex: index,
      day: Number(day),
      date,
      time: "",
      title: task.title,
      type: "Внутрішня задача",
      clientId: item.clientId,
      caseId: item.id,
      description: `Задача по справі №${item.id}. Відповідальний: ${task.responsible || item.responsible}.`,
      status: task.status,
      reminderEnabled: Boolean(task.reminderEnabled),
      reminderBefore: task.reminderBefore || "",
      reminderChannels: task.reminderChannel || "",
      reminderRecipients: task.responsible ? "Відповідальний юрист" : "",
      month
    };
  }).filter(Boolean));
}

export function calendarEntries(ctx = null) {
  if (ctx) applyContext(ctx);
  return [
    ...state.events.map((event) => ({ ...event, id: `event-${event.id}`, source: "event", month: event.date.slice(5, 7) })),
    ...taskCalendarEntries()
  ];
}

function renderCalendar() {
  const entries = calendarEntries();
  const mode = state.calendarMode || "month";
  let activeDate = dateFromIso(state.calendarDate || calendarToday);
  const query = (state.calendarQuery || "").toLowerCase().trim();
  const filter = state.calendarFilter || "all";
  const clientFilter = state.calendarClientFilter || "all";
  const caseFilter = state.calendarCaseFilter || "all";
  const responsibleFilter = state.calendarResponsibleFilter || "all";
  const statusFilter = state.calendarStatusFilter || "all";
  const authorityFilter = (state.calendarAuthorityFilter || "").toLowerCase().trim();
  const filtered = entries.filter((event) => {
    const meta = calendarEventMeta(event);
    const byQuery = !query || [event.title, event.type, event.status, event.description, meta.client?.name, meta.caseItem?.title, event.caseId, meta.authority, meta.location]
      .some((value) => String(value || "").toLowerCase().includes(query));
    const byFilter =
      filter === "all" ||
      (filter === "task" && event.source === "task") ||
      (filter === "event" && event.source === "event") ||
      (filter === "court" && event.type.includes("Суд")) ||
      (filter === "deadline" && event.type.includes("строк")) ||
      event.type === filter;
    const byClient = clientFilter === "all" || String(event.clientId) === clientFilter;
    const byCase = caseFilter === "all" || event.caseId === caseFilter;
    const byResponsible = responsibleFilter === "all" || meta.responsible === responsibleFilter;
    const byStatus = statusFilter === "all" || event.status === statusFilter;
    const byAuthority = !authorityFilter || meta.authority.toLowerCase().includes(authorityFilter);
    const byOverdue = !state.calendarOverdueOnly || event.status === "Просрочено" || dateFromIso(event.date) < dateFromIso(calendarToday);
    return byQuery && byFilter && byClient && byCase && byResponsible && byStatus && byAuthority && byOverdue;
  });
  let calendarDays = calendarViewDays(activeDate, mode);
  let visibleIso = new Set(calendarDays.map((cell) => cell.iso));
  let visibleEvents = mode === "list"
    ? [...filtered].sort((a, b) => calendarSortValue(a).localeCompare(calendarSortValue(b)))
    : filtered.filter((event) => visibleIso.has(event.date));
  const activeMonthKey = (state.calendarDate || calendarToday).slice(0, 7);
  const todayMonthKey = calendarToday.slice(0, 7);
  const shouldAutoFocusCalendar =
    mode !== "list" &&
    !visibleEvents.length &&
    filtered.length &&
    (!state.calendarDatePinned || activeMonthKey === todayMonthKey);
  if (shouldAutoFocusCalendar) {
    const focusEvent = calendarAutoFocusEvent(filtered, activeDate);
    if (focusEvent?.date) {
      state.calendarDate = focusEvent.date;
      state.calendarDatePinned = false;
      state.selectedEventId = focusEvent.id;
      activeDate = dateFromIso(focusEvent.date);
      calendarDays = calendarViewDays(activeDate, mode);
      visibleIso = new Set(calendarDays.map((cell) => cell.iso));
      visibleEvents = filtered.filter((event) => visibleIso.has(event.date));
    }
  }
  const upcoming = [...filtered].sort((a, b) => calendarSortValue(a).localeCompare(calendarSortValue(b))).slice(0, 4);
  const typeStats = calendarEventTypes().map((type) => ({
    type,
    count: filtered.filter((event) => event.type === type).length,
    ...calendarEventTypeMap()[type]
  }));
  const selected = visibleEvents.find((event) => event.id === state.selectedEventId) || visibleEvents[0] || filtered.find((event) => event.id === state.selectedEventId) || filtered[0] || entries[0];
  const selectedReminderRows = selected ? calendarReminderRows(selected) : [];
  const gridStyle = `--calendar-columns:${mode === "day" ? 1 : 7};`;
  const pickerYears = Array.from({ length: 11 }, (_, index) => activeDate.getFullYear() - 5 + index);
  const caseOptions = state.cases.map((item) => `<option value="${item.id}" ${caseFilter === item.id ? "selected" : ""}>№${item.id}</option>`).join("");
  const clientOptions = state.clients.map((client) => `<option value="${client.id}" ${clientFilter === String(client.id) ? "selected" : ""}>${escapeHtml(client.name)}</option>`).join("");
  const responsibleOptions = responsibleNames().map((name) => `<option value="${escapeHtml(name)}" ${responsibleFilter === name ? "selected" : ""}>${escapeHtml(name)}</option>`).join("");
  $("#calendar").innerHTML = `
    <div class="calendar-screen">
      <div class="calendar-toolbar">
        <button class="primary" id="add-event">+ Додати подію</button>
        <div class="calendar-mode-group">
          <button class="secondary ${mode === "day" ? "active" : ""}" data-calendar-mode="day">День</button>
          <button class="secondary ${mode === "week" ? "active" : ""}" data-calendar-mode="week">Тиждень</button>
          <button class="secondary ${mode === "month" ? "active" : ""}" data-calendar-mode="month">Місяць</button>
          <button class="secondary ${mode === "list" ? "active" : ""}" data-calendar-mode="list">Список</button>
        </div>
        <button class="secondary" data-calendar-today>Сьогодні</button>
        <div class="calendar-arrows"><button class="secondary" data-calendar-step="-1">‹</button><button class="secondary" data-calendar-step="1">›</button></div>
        <div class="calendar-date-picker">
          <button type="button" class="calendar-title-button" data-calendar-picker>${calendarTitle(activeDate, mode)} <span>⌄</span></button>
          ${state.calendarPickerOpen ? `<div class="calendar-picker-menu">
            <div class="calendar-picker-column">
              <span>Місяць</span>
              ${monthNames.map((name, index) => `<button type="button" class="${index === activeDate.getMonth() ? "active" : ""}" data-calendar-month="${index}">${name}</button>`).join("")}
            </div>
            <div class="calendar-picker-column year-column">
              <span>Рік</span>
              ${pickerYears.map((year) => `<button type="button" class="${year === activeDate.getFullYear() ? "active" : ""}" data-calendar-year="${year}">${year}</button>`).join("")}
            </div>
          </div>` : ""}
        </div>
        <input id="calendar-search" type="search" value="${escapeHtml(state.calendarQuery || "")}" placeholder="Пошук подій, справ, клієнтів..." />
      </div>
      <div class="calendar-filter-panel">
        <label class="calendar-filter-field"><select id="calendar-filter" aria-label="Фільтр подій">
          <option value="all" ${filter === "all" ? "selected" : ""}>Усі події</option>
          <option value="task" ${filter === "task" ? "selected" : ""}>Задачі</option>
          <option value="event" ${filter === "event" ? "selected" : ""}>Події</option>
          <option value="court" ${filter === "court" ? "selected" : ""}>Судові</option>
          <option value="deadline" ${filter === "deadline" ? "selected" : ""}>Дедлайни</option>
          ${calendarEventTypes().map((type) => `<option value="${escapeHtml(type)}" ${filter === type ? "selected" : ""}>${escapeHtml(type)}</option>`).join("")}
        </select></label>
        <label class="calendar-filter-field"><select id="calendar-client-filter" aria-label="Фільтр клієнтів"><option value="all">Усі клієнти</option>${clientOptions}</select></label>
        <label class="calendar-filter-field"><select id="calendar-case-filter" aria-label="Фільтр справ"><option value="all">Усі справи</option>${caseOptions}</select></label>
        <label class="calendar-filter-field"><select id="calendar-responsible-filter" aria-label="Фільтр відповідальних"><option value="all">Усі відповідальні</option>${responsibleOptions}</select></label>
        <label class="calendar-filter-field"><select id="calendar-status-filter" aria-label="Фільтр статусів"><option value="all">Усі статуси</option>${calendarStatuses().map((status) => `<option value="${escapeHtml(status)}" ${statusFilter === status ? "selected" : ""}>${escapeHtml(status)}</option>`).join("")}</select></label>
        <input id="calendar-authority-filter" value="${escapeHtml(state.calendarAuthorityFilter || "")}" placeholder="Орган / суд / ТЦК" />
        <label class="calendar-overdue-filter"><input id="calendar-overdue-filter" type="checkbox" ${state.calendarOverdueOnly ? "checked" : ""} /> Прострочені</label>
        <button class="secondary calendar-reset-filter" type="button" data-calendar-reset-filters>${icon("refresh")} Скинути</button>
      </div>
      <div class="calendar-layout">
        <div class="calendar-left-stack">
          <div class="panel calendar-main-card">
            ${mode === "list" ? `
            <div class="calendar-list-view">
              ${visibleEvents.map((event) => {
                const meta = calendarEventMeta(event);
                const timeRange = calendarTimeRange(event, meta);
                return `<button type="button" class="calendar-list-row ${event.id === selected?.id ? "selected" : ""}" data-event="${event.id}">
                  <span class="event-dot ${eventClass(event)}"></span>
                  <time><strong>${formatDate(event.date)}</strong>${timeRange ? `<em>${timeRange}</em>` : ""}</time>
                  <span><strong>${escapeHtml(event.title)}</strong><em>${escapeHtml(event.type)} · ${escapeHtml(event.status)}</em></span>
                  <span><strong>${escapeHtml(meta.client?.name || "Клієнт не вказаний")}</strong><em>№${event.caseId}</em></span>
                  <span><strong>${escapeHtml(meta.authority)}</strong><em>${escapeHtml(meta.responsible)}</em></span>
                  ${badge(eventTimeLeftLabel(event), calendarTimeTone(eventTimeLeftLabel(event)))}
                </button>`;
              }).join("") || `<p class="muted">Подій за цими фільтрами немає.</p>`}
            </div>
            ` : `
            <div class="calendar-weekdays ${mode}-view" style="${gridStyle}">
              ${(mode === "day" ? [calendarDays[0]?.weekday || "День"] : weekDayNames).map((name) => `<span>${name}</span>`).join("")}
            </div>
            <div class="calendar-grid ${mode}-view" style="${gridStyle}">
              ${calendarDays.map((cell) => {
                const events = filtered.filter((event) => event.date === cell.iso);
                const visibleCellEvents = mode === "month" ? events.slice(0, 1) : events;
                const hiddenCellEvents = mode === "month" ? events.slice(visibleCellEvents.length) : [];
                return `<div class="day ${cell.current ? "" : "muted-day"}">
                  <div class="day-num">${cell.day}</div>
                ${visibleCellEvents.map((event) => {
                  const client = clientById(event.clientId);
                  const eventSubline = event.caseId ? `Справа №${event.caseId}` : client?.name || "Клієнт";
                  const timeLabel = calendarTimeLabel(event);
                  return `<button class="event-chip ${eventClass(event)} ${event.id === selected?.id ? "selected" : ""}" data-event="${event.id}">${timeLabel ? `<strong>${escapeHtml(timeLabel)}</strong>` : ""}<span class="event-chip-title">${escapeHtml(event.title)}</span><span class="event-chip-meta">${escapeHtml(eventSubline)}</span></button>`;
                }).join("")}
                ${hiddenCellEvents.length ? `<div class="calendar-day-more-wrap">
                  <button type="button" class="calendar-day-more" data-calendar-more="${cell.iso}" aria-expanded="false" aria-label="Показати ще ${hiddenCellEvents.length} подій">+${hiddenCellEvents.length}<span>⌄</span></button>
                  <div class="calendar-day-popover" role="list">
                    ${events.map((event) => {
                      const client = clientById(event.clientId);
                      const eventSubline = event.caseId ? `Справа №${event.caseId}` : client?.name || "Клієнт";
                      const timeLabel = calendarTimeLabel(event);
                      return `<button type="button" class="calendar-popover-event ${eventClass(event)}" data-event="${event.id}" role="listitem">${timeLabel ? `<strong>${escapeHtml(timeLabel)}</strong>` : ""}<span class="event-chip-title">${escapeHtml(event.title)}</span><span class="event-chip-meta">${escapeHtml(eventSubline)}</span></button>`;
                    }).join("")}
                  </div>
                </div>` : ""}
              </div>`;
            }).join("")}
            </div>
            `}
            <div class="calendar-legend">
              ${typeStats.map((item) => `<button type="button" class="${filter === item.type ? "active" : ""}" data-calendar-type="${item.type}" title="${item.hint}">
                <i class="${item.className}"></i>
                <span>${item.label}</span>
                <em>${item.count}</em>
              </button>`).join("")}
            </div>
          </div>
          <div class="panel calendar-events-list">
            <div class="calendar-events-head"><h2>Найближчі події</h2><button class="ghost" type="button" data-calendar-show-list>Показати всі</button></div>
            ${upcoming.map((event) => {
              const client = clientById(event.clientId);
              const leftLabel = eventTimeLeftLabel(event);
              const timeLabel = calendarTimeLabel(event);
              return `<button type="button" class="upcoming-event-row" data-event="${event.id}">
                <span class="event-dot ${eventClass(event)}"></span>
                <span class="upcoming-event-main"><strong>${escapeHtml(event.title)}${event.caseId ? ` у справі №${event.caseId}` : ""}</strong><em>Клієнт: ${escapeHtml(client?.name || "Не вказано")}</em></span>
                <time>${formatDate(event.date)}</time>
                ${timeLabel ? `<span class="upcoming-event-time">${timeLabel}</span>` : `<span class="upcoming-event-time muted">Без часу</span>`}
                ${badge(leftLabel, calendarTimeTone(leftLabel))}
              </button>`;
            }).join("") || `<p class="muted">Подій за цими фільтрами немає.</p>`}
          </div>
        </div>
        <aside class="calendar-side">
          <div class="panel" id="event-card"></div>
          <div class="panel calendar-reminders">
            <div class="calendar-reminders-head"><h2>Нагадування</h2><button class="ghost" type="button" data-send-selected-reminder>${icon("bell")} Нагадати зараз</button></div>
            ${selected ? (selectedReminderRows.length ? selectedReminderRows.map((row) => `<div class="reminder-row">${icon(row.channel === "SMS" ? "mail" : row.channel === "CRM" ? "bell" : "telegram")}<div><strong>${row.channel}</strong><span>${row.before} до події (${row.scheduledAt})</span><small>${escapeHtml(row.recipient)}</small></div><em class="reminder-status ${row.tone}">${escapeHtml(row.status)}</em></div>`).join("") : `<p class="muted">Нагадування вимкнено.</p>`) : `<p class="muted">Виберіть подію, щоб побачити нагадування.</p>`}
          </div>
          <div class="panel calendar-reminders active-reminders">
            <h2>Нагадування активні</h2>
            <p class="muted">${selected && selectedReminderRows.length ? `Активні канали для події «${escapeHtml(selected.title)}».` : "Активних нагадувань немає."}</p>
            <div class="active-reminder-icons">
              ${selectedReminderRows.length ? selectedReminderRows.map((row) => `<span>${icon(row.channel === "SMS" ? "mail" : row.channel === "CRM" ? "bell" : "telegram")} ${row.channel}</span>`).join("") : `<span>${icon("bell")} Вимкнено</span>`}
            </div>
          </div>
        </aside>
      </div>
    </div>
  `;
  renderEventCard(selected?.id);
  $("#add-event").addEventListener("click", openEventDialog);
  document.querySelectorAll("[data-event]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedEventId = button.dataset.event;
      renderCalendar();
    });
  });
  document.querySelectorAll("[data-calendar-more]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const shell = button.closest(".calendar-day-more-wrap");
      if (!shell) return;
      const willOpen = !shell.classList.contains("is-open");
      closeCalendarDayMenus(willOpen ? shell : null);
      shell.classList.toggle("is-open", willOpen);
      button.setAttribute("aria-expanded", String(willOpen));
    });
  });
  document.querySelectorAll("[data-calendar-mode]").forEach((button) => button.addEventListener("click", () => {
    state.calendarMode = button.dataset.calendarMode;
    state.calendarPickerOpen = false;
    renderCalendar();
  }));
  document.querySelectorAll("[data-calendar-type]").forEach((button) => button.addEventListener("click", () => {
    state.calendarFilter = state.calendarFilter === button.dataset.calendarType ? "all" : button.dataset.calendarType;
    renderCalendar();
  }));
  document.querySelector("[data-calendar-show-list]")?.addEventListener("click", () => {
    state.calendarMode = "list";
    renderCalendar();
  });
  document.querySelectorAll("[data-calendar-day]").forEach((button) => button.addEventListener("click", () => {
    state.calendarDate = button.dataset.calendarDay;
    state.calendarDatePinned = true;
    state.calendarMode = "day";
    const dayEvents = filtered.filter((event) => event.date === button.dataset.calendarDay);
    if (dayEvents[0]) state.selectedEventId = dayEvents[0].id;
    renderCalendar();
  }));
  document.querySelector("[data-send-selected-reminder]")?.addEventListener("click", () => {
    if (!selected || selected.source === "task") return;
    sendManualReminder(selected.id);
  });
  document.querySelector("[data-calendar-today]")?.addEventListener("click", () => {
    state.calendarDate = todayIso();
    state.calendarDatePinned = true;
    state.calendarPickerOpen = false;
    renderCalendar();
  });
  document.querySelectorAll("[data-calendar-step]").forEach((button) => button.addEventListener("click", () => {
    const direction = Number(button.dataset.calendarStep);
    const current = dateFromIso(state.calendarDate || calendarToday);
    if (state.calendarMode === "day") {
      state.calendarDate = isoFromDate(addDays(current, direction));
    } else if (state.calendarMode === "week") {
      state.calendarDate = isoFromDate(addDays(current, direction * 7));
    } else {
      state.calendarDate = isoFromDate(new Date(current.getFullYear(), current.getMonth() + direction, Math.min(current.getDate(), 28)));
    }
    state.calendarDatePinned = true;
    state.calendarPickerOpen = false;
    renderCalendar();
  }));
  document.querySelector("[data-calendar-picker]")?.addEventListener("click", () => {
    state.calendarPickerOpen = !state.calendarPickerOpen;
    renderCalendar();
  });
  document.querySelectorAll("[data-calendar-month]").forEach((button) => button.addEventListener("click", () => {
    const current = dateFromIso(state.calendarDate || calendarToday);
    state.calendarDate = isoFromDate(new Date(current.getFullYear(), Number(button.dataset.calendarMonth), Math.min(current.getDate(), 28)));
    state.calendarDatePinned = true;
    state.calendarPickerOpen = false;
    renderCalendar();
  }));
  document.querySelectorAll("[data-calendar-year]").forEach((button) => button.addEventListener("click", () => {
    const current = dateFromIso(state.calendarDate || calendarToday);
    state.calendarDate = isoFromDate(new Date(Number(button.dataset.calendarYear), current.getMonth(), Math.min(current.getDate(), 28)));
    state.calendarDatePinned = true;
    state.calendarPickerOpen = false;
    renderCalendar();
  }));
  $("#calendar-search")?.addEventListener("input", (event) => {
    state.calendarQuery = event.currentTarget.value;
    state.calendarDatePinned = false;
    renderCalendar();
    requestAnimationFrame(() => {
      const input = $("#calendar-search");
      if (!input) return;
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    });
  });
  $("#calendar-filter")?.addEventListener("change", (event) => {
    state.calendarFilter = event.currentTarget.value;
    state.calendarDatePinned = false;
    renderCalendar();
  });
  $("#calendar-client-filter")?.addEventListener("change", (event) => {
    state.calendarClientFilter = event.currentTarget.value;
    state.calendarDatePinned = false;
    renderCalendar();
  });
  $("#calendar-case-filter")?.addEventListener("change", (event) => {
    state.calendarCaseFilter = event.currentTarget.value;
    state.calendarDatePinned = false;
    renderCalendar();
  });
  $("#calendar-responsible-filter")?.addEventListener("change", (event) => {
    state.calendarResponsibleFilter = event.currentTarget.value;
    state.calendarDatePinned = false;
    renderCalendar();
  });
  $("#calendar-status-filter")?.addEventListener("change", (event) => {
    state.calendarStatusFilter = event.currentTarget.value;
    state.calendarDatePinned = false;
    renderCalendar();
  });
  $("#calendar-authority-filter")?.addEventListener("input", (event) => {
    state.calendarAuthorityFilter = event.currentTarget.value;
    state.calendarDatePinned = false;
    renderCalendar();
    requestAnimationFrame(() => {
      const input = $("#calendar-authority-filter");
      if (!input) return;
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    });
  });
  $("#calendar-overdue-filter")?.addEventListener("change", (event) => {
    state.calendarOverdueOnly = event.currentTarget.checked;
    state.calendarDatePinned = false;
    renderCalendar();
  });
  document.querySelector("[data-calendar-reset-filters]")?.addEventListener("click", () => {
    state.calendarQuery = "";
    state.calendarFilter = "all";
    state.calendarClientFilter = "all";
    state.calendarCaseFilter = "all";
    state.calendarResponsibleFilter = "all";
    state.calendarStatusFilter = "all";
    state.calendarAuthorityFilter = "";
    state.calendarOverdueOnly = false;
    state.calendarMode = "month";
    state.calendarDatePinned = false;
    state.calendarPickerOpen = false;
    renderCalendar();
  });
  setupCalendarCustomSelects();
  const calendarRoot = $("#calendar");
  if (calendarRoot && !calendarRoot.dataset.calendarSelectCloseBound) {
    calendarRoot.dataset.calendarSelectCloseBound = "true";
    calendarRoot.addEventListener("click", (event) => {
      if (event.target.closest(".calendar-filter-field .document-custom-select")) return;
      closeCalendarSelectMenus();
      if (!event.target.closest(".calendar-day-more-wrap")) closeCalendarDayMenus();
    });
    calendarRoot.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeCalendarDayMenus();
    });
  }
}

async function sendManualReminder(eventId) {
  const target = state.events.find((item) => `event-${item.id}` === eventId);
  if (!target) return;
  const meta = calendarEventMeta({ ...target, id: eventId });
  const channels = meta.reminderChannels;
  if (!meta.reminderEnabled || !channels) {
    showToast?.("Нагадування для цієї події вимкнено.");
    return;
  }
  target.reminderLog = [
    { date: new Date().toLocaleString("uk-UA"), text: `Нагадування відправлено вручну: ${channels}.` },
    ...(target.reminderLog || [])
  ];
  if (shouldUseApi(state)) {
    try {
      Object.assign(target, normalizeEvent(await saveEventToApi(target)));
    } catch (_error) {
      showToast?.("Не вдалося зберегти нагадування в базі.", "danger");
      return;
    }
  }
  renderCalendar();
}

function renderEventCard(id) {
  const event = calendarEntries().find((item) => item.id === id) || calendarEntries()[0];
  if (!event) {
    $("#event-card").innerHTML = `<h2>Подія</h2><p class="muted">Подій поки немає.</p>`;
    return;
  }
  const { client, caseItem, authority, location, responsible, endTime, recurrence, reminderEnabled, reminderBefore, reminderChannels, reminderRecipients } = calendarEventMeta(event);
  const typeConfig = calendarEventTypeMap()[event.type] || calendarEventTypeMap()["Інше"];
  const orderedEvents = [...calendarEntries()].sort((a, b) => calendarSortValue(a).localeCompare(calendarSortValue(b)));
  const eventIndex = Math.max(0, orderedEvents.findIndex((item) => item.id === event.id));
  const previousEvent = orderedEvents[(eventIndex - 1 + orderedEvents.length) % orderedEvents.length];
  const nextEvent = orderedEvents[(eventIndex + 1) % orderedEvents.length];
  const timeRange = calendarTimeRange(event, { endTime });
  state.selectedEventId = event.id;
  $("#event-card").innerHTML = `
    <div class="event-card-head">
      <h2>Подія</h2>
      <div class="event-card-nav">
        <button class="ghost" type="button" data-event-nav="${previousEvent?.id || event.id}" title="Попередня подія">‹</button>
        <button class="ghost" type="button" data-event-nav="${nextEvent?.id || event.id}" title="Наступна подія">›</button>
        <div class="event-more-wrap">
          <button class="ghost" type="button" data-event-more title="Дії">⋮</button>
          <div class="event-more-menu" hidden>
            <button type="button" data-reschedule-calendar-event="${event.id}">${icon("calendar")} Перенести</button>
            <button type="button" data-complete-calendar-event="${event.id}">${icon("check")} Виконано</button>
            <button type="button" data-send-calendar-reminder="${event.id}">${icon("bell")} Нагадати зараз</button>
            <button type="button" data-open-calendar-case="${event.caseId}">${icon("eye")} Відкрити справу</button>
          </div>
        </div>
      </div>
    </div>
    <div class="event-card-title">
      <span class="event-dot ${eventClass(event)}"></span>
      <strong>${escapeHtml(event.title)}</strong>
      ${badge(event.source === "task" ? "Задача" : typeConfig.label, eventClass(event) === "court" ? "green" : eventClass(event) === "deadline" ? "red" : "blue")}
    </div>
    <div class="event-profile">
      <div class="event-info-list">
        <div class="event-info-row">${icon("calendar")}<span><strong>${formatDate(event.date)}</strong></span></div>
        ${timeRange ? `<div class="event-info-row">${icon("clock")}<span><strong>${timeRange}</strong></span></div>` : ""}
        <div class="event-info-row">${icon("building")}<span><strong>${escapeHtml(authority)}</strong><em>${escapeHtml(location)}</em></span></div>
        <div class="event-info-row">${icon("briefcase")}<span><strong>Справа №${event.caseId}</strong><em>${escapeHtml(caseItem?.title || "Без назви справи")}</em></span></div>
        <div class="event-info-row">${icon("user")}<span><strong>Клієнт: ${escapeHtml(client?.name || "Не вказано")}</strong></span></div>
        <div class="event-info-row">${icon("user")}<span><strong>Відповідальний: ${escapeHtml(responsible)}</strong></span></div>
        <div class="event-info-row">${icon("bell")}<span><strong>${reminderEnabled ? `${escapeHtml(reminderBefore)} · ${escapeHtml(reminderChannels)}` : "Нагадування вимкнено"}</strong><em>${reminderEnabled ? `${escapeHtml(reminderRecipients)} · ` : ""}${escapeHtml(recurrence)} · ${escapeHtml(event.status)}</em></span></div>
      </div>
      <p class="muted event-description">${escapeHtml(event.description || "Опис події ще не додано.")}</p>
      <div class="event-reminder-log">
        <strong>Журнал нагадувань</strong>
        ${(event.reminderLog || []).map((row) => `<span>${row.date} · ${row.text}</span>`).join("") || `<span>Нагадування ще не відправлялись.</span>`}
      </div>
      <div class="event-card-actions" id="event-card-actions">
        <button class="secondary" data-edit-calendar-event="${event.id}">${icon("edit")} Редагувати</button>
        <button class="secondary danger" data-delete-calendar-event="${event.id}">${icon("trash")} Видалити</button>
      </div>
    </div>
  `;
  document.querySelector("[data-open-calendar-case]")?.addEventListener("click", () => {
    if (!caseItem) return;
    state.selectedCaseId = caseItem.id;
    state.caseScreen = "detail";
    renderCases();
    switchView("cases");
  });
  document.querySelectorAll("[data-event-nav]").forEach((button) => button.addEventListener("click", () => {
    state.selectedEventId = button.dataset.eventNav;
    renderCalendar();
  }));
  document.querySelector("[data-event-more]")?.addEventListener("click", () => {
    const menu = document.querySelector(".event-more-menu");
    if (!menu) return;
    menu.hidden = !menu.hidden;
  });
  document.querySelector("[data-edit-calendar-event]")?.addEventListener("click", () => {
    if (event.source === "task") {
      openTaskDialog(event.caseId, event.taskIndex, "calendar");
      return;
    }
    openEventDialog({ eventId: event.id });
  });
  document.querySelector("[data-reschedule-calendar-event]")?.addEventListener("click", () => {
    if (event.source === "task") {
      openTaskDialog(event.caseId, event.taskIndex, "calendar");
      return;
    }
    openEventDialog({ eventId: event.id });
  });
  document.querySelector("[data-complete-calendar-event]")?.addEventListener("click", async () => {
    if (event.source === "task") return;
    const target = state.events.find((item) => `event-${item.id}` === event.id);
    if (!target) return;
    target.status = "Виконано";
    if (shouldUseApi(state)) {
      try {
        Object.assign(target, normalizeEvent(await saveEventToApi(target)));
      } catch (_error) {
        showToast?.("Не вдалося зберегти статус події в базі.", "danger");
        return;
      }
    }
    renderCalendar();
  });
  document.querySelector("[data-send-calendar-reminder]")?.addEventListener("click", () => {
    if (event.source === "task") return;
    sendManualReminder(event.id);
  });
  document.querySelector("[data-delete-calendar-event]")?.addEventListener("click", () => {
    if (event.source === "task") {
      openDeleteDocumentConfirm({ type: "task", caseId: event.caseId, taskIndex: event.taskIndex, returnView: "calendar" });
      return;
    }
    openDeleteDocumentConfirm({ type: "calendarEvent", eventId: event.id, returnView: "calendar" });
  });
}
