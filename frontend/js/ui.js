export const calendarToday = isoFromDate(new Date());
export const monthNames = ["Січень", "Лютий", "Березень", "Квітень", "Травень", "Червень", "Липень", "Серпень", "Вересень", "Жовтень", "Листопад", "Грудень"];
export const weekDayNames = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];

export function formatDate(dateString) {
  if (!dateString) return new Date().toLocaleDateString("uk-UA");
  return new Date(dateString).toLocaleDateString("uk-UA");
}

export function dateFromIso(iso) {
  const [year, month, day] = String(iso || calendarToday).split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function isoFromDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function todayIso() {
  return isoFromDate(new Date());
}

export function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function startOfWeek(date) {
  const day = date.getDay() || 7;
  return addDays(date, 1 - day);
}

export function calendarTitle(date, mode) {
  if (mode === "day") return `${formatDate(isoFromDate(date))}`;
  if (mode === "week") {
    const start = startOfWeek(date);
    const end = addDays(start, 6);
    return `${formatDate(isoFromDate(start))} - ${formatDate(isoFromDate(end))}`;
  }
  if (mode === "list") return `Список подій · ${monthNames[date.getMonth()]} ${date.getFullYear()}`;
  return `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
}

export function calendarViewDays(date, mode) {
  if (mode === "day") {
    return [{ date, iso: isoFromDate(date), day: date.getDate(), current: true, weekday: weekDayNames[(date.getDay() + 6) % 7] }];
  }
  if (mode === "week") {
    const start = startOfWeek(date);
    return Array.from({ length: 7 }, (_, index) => {
      const current = addDays(start, index);
      return { date: current, iso: isoFromDate(current), day: current.getDate(), current: true, weekday: weekDayNames[index] };
    });
  }
  const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
  const gridStart = startOfWeek(monthStart);
  return Array.from({ length: 42 }, (_, index) => {
    const current = addDays(gridStart, index);
    return {
      date: current,
      iso: isoFromDate(current),
      day: current.getDate(),
      current: current.getMonth() === date.getMonth(),
      weekday: weekDayNames[index % 7]
    };
  });
}

export function currency(value) {
  return new Intl.NumberFormat("uk-UA").format(value) + " ₴";
}

export function currencyText(value) {
  return `${new Intl.NumberFormat("uk-UA").format(value)} грн`;
}

export function badge(text, tone = "") {
  const resolvedTone = tone || semanticTone(text);
  return `<span class="badge ${resolvedTone}">${text}</span>`;
}

const profilePhotos = {
  "Іваненко А.Ю.": "https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=160&h=160&fit=crop",
  "Петренко Іван Миколайович": "https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=160&h=160&fit=crop",
  "Мельник Н.П.": "https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=160&h=160&fit=crop",
  "Шевченко Марія Ігорівна": "https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=160&h=160&fit=crop",
  "Кравчук А.В.": "https://images.pexels.com/photos/614810/pexels-photo-614810.jpeg?auto=compress&cs=tinysrgb&w=160&h=160&fit=crop",
  "Бондаренко Дмитро Єфремович": "https://images.pexels.com/photos/614810/pexels-photo-614810.jpeg?auto=compress&cs=tinysrgb&w=160&h=160&fit=crop",
  "Петренко С.В.": "https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?auto=compress&cs=tinysrgb&w=160&h=160&fit=crop",
  "Коваленко Олександр Сергійович": "https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?auto=compress&cs=tinysrgb&w=160&h=160&fit=crop"
};

export function advocatePhoto(name = "Адвокат", extraClass = "") {
  const initial = String(name).trim().slice(0, 1).toUpperCase() || "А";
  const photoUrl = profilePhotos[name];
  const photoClass = photoUrl ? "has-photo" : "";
  const photoStyle = photoUrl ? ` style="--profile-photo: url('${photoUrl}')"` : "";
  return `<span class="advocate-photo ${photoClass} ${extraClass}"${photoStyle} aria-label="${name}"><span>${initial}</span></span>`;
}

export function documentStatusTone(status) {
  return semanticTone(status);
}

export function documentStatusControl(status) {
  return `<div class="folder-status-control">${badge(status, documentStatusTone(status))}</div>`;
}

export function makeDocumentId() {
  return `doc-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function documentActionButtons(source, firstIndex, secondIndex = "") {
  const suffix = secondIndex === "" ? firstIndex : `${firstIndex}:${secondIndex}`;
  return `
    <button type="button" data-view-document="${source}:${suffix}" title="Посмотреть" aria-label="Посмотреть документ">${icon("eye")}</button>
    <button type="button" data-edit-document="${source}:${suffix}" title="Редактировать" aria-label="Редактировать документ">${icon("edit")}</button>
  `;
}

function attributeString(attrs = {}) {
  return Object.entries(attrs)
    .filter(([, value]) => value !== false && value !== null && value !== undefined)
    .map(([key, value]) => {
      if (value === true) return key;
      return `${key}="${String(value).replaceAll("&", "&amp;").replaceAll("\"", "&quot;")}"`;
    })
    .join(" ");
}

export function actionMenu(items = [], options = {}) {
  const label = options.label || "Дії";
  const className = options.className ? ` ${options.className}` : "";
  const triggerAttr = options.triggerAttr || "data-action-menu-trigger";
  return `
    <div class="row-action-menu-wrap${className}">
      <button type="button" class="icon-button compact row-action-trigger" ${triggerAttr} aria-label="${label}" aria-expanded="false">⋮</button>
      <div class="row-action-menu" hidden>
        ${items.map((item) => {
          const tone = item.danger ? " danger" : "";
          const attrs = attributeString(item.attrs || {});
          return `<button type="button" class="${tone.trim()}" ${attrs}>${item.icon ? icon(item.icon) : ""}<span>${item.label}</span></button>`;
        }).join("")}
      </div>
    </div>
  `;
}

function resetActionMenu(menu) {
  menu.hidden = true;
  menu.style.position = "";
  menu.style.top = "";
  menu.style.left = "";
  menu.style.right = "";
  menu.style.bottom = "";
  menu.style.zIndex = "";
  if (menu.__actionMenuOwner && menu.parentElement !== menu.__actionMenuOwner) {
    menu.__actionMenuOwner.append(menu);
  }
}

export function bindActionMenus(root = document) {
  if (!document.body.dataset.actionMenusGlobalBound) {
    document.body.dataset.actionMenusGlobalBound = "true";
    document.addEventListener("click", (event) => {
      if (event.target.closest(".row-action-menu-wrap")) return;
      document.querySelectorAll(".row-action-menu").forEach(resetActionMenu);
      document.querySelectorAll("[data-action-menu-trigger], [data-subtask-action-menu-trigger]").forEach((button) => {
        button.setAttribute("aria-expanded", "false");
      });
    });
  }

  root.querySelectorAll("[data-action-menu-trigger], [data-subtask-action-menu-trigger]").forEach((button) => {
    if (button.dataset.actionMenuBound === "true") return;
    button.dataset.actionMenuBound = "true";
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const wrapper = button.closest(".row-action-menu-wrap");
      const menu = wrapper?.__actionMenuEl || wrapper?.querySelector(".row-action-menu");
      if (wrapper && menu) {
        wrapper.__actionMenuEl = menu;
        menu.__actionMenuOwner = wrapper;
      }
      const shouldOpen = menu?.hidden;
      document.querySelectorAll(".row-action-menu").forEach((item) => {
        if (item !== menu) {
          resetActionMenu(item);
        }
      });
      document.querySelectorAll("[data-action-menu-trigger], [data-subtask-action-menu-trigger]").forEach((item) => {
        if (item !== button) item.setAttribute("aria-expanded", "false");
      });
      if (menu) {
        menu.hidden = !shouldOpen;
        resetActionMenu(menu);
        if (shouldOpen) {
          const triggerBox = button.getBoundingClientRect();
          const preferredLeft = Math.max(8, triggerBox.left);
          const preferredTop = triggerBox.bottom + 8;
          document.body.append(menu);
          menu.hidden = false;
          menu.style.position = "fixed";
          menu.style.zIndex = "100000";
          menu.style.left = `${preferredLeft}px`;
          menu.style.top = `${preferredTop}px`;
          requestAnimationFrame(() => {
            let menuBox = menu.getBoundingClientRect();
            const offsetX = menuBox.left - preferredLeft;
            const offsetY = menuBox.top - preferredTop;
            if (Math.abs(offsetX) > 1) {
              menu.style.left = `${preferredLeft - offsetX}px`;
            }
            if (Math.abs(offsetY) > 1) {
              menu.style.top = `${preferredTop - offsetY}px`;
            }
            requestAnimationFrame(() => {
              menuBox = menu.getBoundingClientRect();
              if (menuBox.right > window.innerWidth - 8) {
                const alignedLeft = Math.max(8, triggerBox.right - menuBox.width);
                menu.style.left = `${alignedLeft - offsetX}px`;
              }
              const blocker = Array.from(document.querySelectorAll(".tasks-pagination, .case-pagination"))
                .map((item) => item.getBoundingClientRect())
                .find((box) => (
                  box.width > 0 &&
                  box.height > 0 &&
                  triggerBox.bottom <= box.bottom &&
                  menuBox.bottom > box.top - 4 &&
                  menuBox.top < box.bottom
                ));
              const topAbove = triggerBox.top - menuBox.height - 8;
              if ((menuBox.bottom > window.innerHeight - 8 || blocker) && topAbove >= 8) {
                menu.style.top = `${topAbove - offsetY}px`;
              }
            });
          });
        }
      }
      button.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
    });
  });
}

export function icon(name) {
  const icons = {
    home: `<svg viewBox="0 0 24 24"><path d="m3 11 9-8 9 8"></path><path d="M5 10v10h5v-6h4v6h5V10"></path></svg>`,
    userPlus: `<svg viewBox="0 0 24 24"><circle cx="9" cy="7" r="4"></circle><path d="M3 21a6 6 0 0 1 12 0"></path><path d="M17 11h4"></path><path d="M19 9v4"></path></svg>`,
    users: `<svg viewBox="0 0 24 24"><circle cx="8" cy="8" r="3.5"></circle><path d="M2.5 21a5.5 5.5 0 0 1 11 0"></path><circle cx="17" cy="9" r="3"></circle><path d="M14.5 20a4.8 4.8 0 0 1 7 0"></path></svg>`,
    checkbox: `<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2"></rect><path d="m8 12 2.5 2.5L16 9"></path></svg>`,
    aiMark: `<svg viewBox="0 0 24 24"><path d="M6 19H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2"></path><path d="M18 5h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-2"></path><path d="M8 16V8l4 8 4-8v8"></path></svg>`,
    searchPlus: `<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-4-4"></path><path d="M11 8v6M8 11h6"></path></svg>`,
    search: `<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path></svg>`,
    filter: `<svg viewBox="0 0 24 24"><path d="M4 5h16l-6.5 7.2V18l-3 1.5v-7.3L4 5Z"></path></svg>`,
    telegram: `<svg viewBox="0 0 24 24"><path d="M21 4 3.8 10.8c-.8.3-.8 1.4.1 1.6l4.3 1.3 1.7 5.1c.2.7 1.1.9 1.6.3l2.5-2.9 4.5 3.4c.6.5 1.5.1 1.7-.7L22.5 5c.2-.7-.7-1.3-1.5-1Z"></path><path d="m8.4 13.6 8.2-5.2-6.4 7.4"></path></svg>`,
    bot: `<svg viewBox="0 0 24 24"><rect x="5" y="8" width="14" height="10" rx="3"></rect><path d="M12 8V4"></path><circle cx="9" cy="13" r="1"></circle><circle cx="15" cy="13" r="1"></circle><path d="M9 18v2M15 18v2"></path></svg>`,
    user: `<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"></circle><path d="M4.5 21a7.5 7.5 0 0 1 15 0"></path></svg>`,
    phone: `<svg viewBox="0 0 24 24"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.7 19.7 0 0 1-8.6-3.1 19.3 19.3 0 0 1-6-6A19.7 19.7 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c1 .3 1.9.6 2.9.7A2 2 0 0 1 22 16.9Z"></path></svg>`,
    message: `<svg viewBox="0 0 24 24"><path d="M5 5h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-5 3v-3H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"></path></svg>`,
    mail: `<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"></rect><path d="m4 7 8 6 8-6"></path></svg>`,
    calendar: `<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M16 3v4M8 3v4M3 11h18"></path></svg>`,
    planner: `<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="16" rx="2"></rect><path d="M9 3v4M15 3v4M8 13h8M8 17h4"></path><path d="m15 17 2 2 4-5"></path></svg>`,
    chart: `<svg viewBox="0 0 24 24"><path d="M4 20V10"></path><path d="M9 20V4"></path><path d="M14 20v-7"></path><path d="M19 20V8"></path></svg>`,
    dollar: `<svg viewBox="0 0 24 24"><path d="M12 3v18"></path><path d="M17 7.5A4 4 0 0 0 12 6c-2.2 0-4 1-4 2.8s1.8 2.5 4 3 4 1.2 4 3-1.8 3.2-4 3.2a5 5 0 0 1-5-2"></path></svg>`,
    wallet: `<svg viewBox="0 0 24 24"><path d="M4 7h15a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h13"></path><path d="M16 13h.01"></path></svg>`,
    clock: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path></svg>`,
    building: `<svg viewBox="0 0 24 24"><path d="M3 21h18"></path><path d="M5 21V9l7-4 7 4v12"></path><path d="M9 21v-6h6v6"></path><path d="M9 10h.01M12 10h.01M15 10h.01"></path></svg>`,
    briefcase: `<svg viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="13" rx="2"></rect><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"></path><path d="M3 12h18"></path></svg>`,
    bell: `<svg viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"></path><path d="M10 21h4"></path></svg>`,
    warning: `<svg viewBox="0 0 24 24"><path d="M10.4 4.1 2.7 18a2 2 0 0 0 1.7 3h15.2a2 2 0 0 0 1.7-3L13.6 4.1a1.8 1.8 0 0 0-3.2 0Z"></path><path d="M12 9v4"></path><path d="M12 17h.01"></path></svg>`,
    archive: `<svg viewBox="0 0 24 24"><path d="M4 5.5h4.5v14H4Z"></path><path d="M9.5 4.5H14v15H9.5Z"></path><path d="M15 6.5h5v13h-5Z"></path><path d="M5.5 9h1.5"></path><path d="M11 8h1.5"></path><path d="M16.5 10h2"></path><path d="M3 19.5h18"></path></svg>`,
    file: `<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"></path><path d="M14 2v6h6"></path></svg>`,
    fileUp: `<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"></path><path d="M14 2v6h6"></path><path d="M12 18v-7"></path><path d="m9 14 3-3 3 3"></path></svg>`,
    signature: `<svg viewBox="0 0 24 24"><path d="M4 18c2.8-5.2 5.5-8.2 7.2-8.2 2.3 0 .2 6.7 2.4 6.7 1.2 0 2.5-1.2 3.6-2.7"></path><path d="M3 21h18"></path><path d="m17.5 4.5 2 2"></path><path d="m19.5 2.5 2 2-8.2 8.2-2.8.8.8-2.8 8.2-8.2Z"></path></svg>`,
    upload: `<svg viewBox="0 0 24 24"><path d="M12 3v12"></path><path d="m7 8 5-5 5 5"></path><path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"></path></svg>`,
    imageUp: `<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="3"></rect><path d="m7 15 3-3 2 2 2.5-3 2.5 4"></path><circle cx="8.5" cy="9.5" r="1.2"></circle><path d="M12 3v6"></path><path d="m9.5 5.5 2.5-2.5 2.5 2.5"></path></svg>`,
    eye: `<svg viewBox="0 0 24 24"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"></path><circle cx="12" cy="12" r="3"></circle></svg>`,
    tag: `<svg viewBox="0 0 24 24"><path d="M20.6 13.1 13.1 20.6a2 2 0 0 1-2.8 0L3 13.3V4h9.3l8.3 8.3a2 2 0 0 1 0 2.8Z"></path><circle cx="8" cy="8" r="1.5"></circle></svg>`,
    edit: `<svg viewBox="0 0 24 24"><path d="M16.9 3.7a2.1 2.1 0 0 1 3 3L8.4 18.2l-4.1 1.2 1.2-4.1L16.9 3.7Z"></path><path d="m15.5 5.1 3.4 3.4"></path></svg>`,
    trash: `<svg viewBox="0 0 24 24"><path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="m19 6-1 15H6L5 6"></path><path d="M10 11v6M14 11v6"></path></svg>`,
    refresh: `<svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 0 1-14.6 4.5"></path><path d="M4 12A8 8 0 0 1 18.6 7.5"></path><path d="M18 3v5h-5"></path><path d="M6 21v-5h5"></path></svg>`,
    check: `<svg viewBox="0 0 24 24"><path d="m20 6-11 11-5-5"></path></svg>`,
    x: `<svg viewBox="0 0 24 24"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>`,
    gear: `<svg viewBox="0 0 24 24"><path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z"></path><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1A2 2 0 0 1 4.2 17l.1-.1A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.6-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.3 7A2 2 0 0 1 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1A2 2 0 0 1 19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.1a2 2 0 0 1 0 4H21a1.7 1.7 0 0 0-1.6 1Z"></path></svg>`
  };
  return `<span class="ui-icon">${icons[name] || ""}</span>`;
}

export const navIconMap = {
  dashboard: "home",
  cases: "userPlus",
  clients: "users",
  calendar: "calendar",
  tasks: "checkbox",
  documents: "file",
  mailings: "telegram",
  ai: "aiMark",
  planner: "planner",
  analytics: "chart",
  finance: "dollar",
  osint: "searchPlus",
  settings: "gear"
};

export function navIconName(view) {
  return navIconMap[view] || "file";
}

export function statusTone(status) {
  return semanticTone(status);
}

export function riskTone(risk) {
  return semanticTone(risk);
}

export function taskTone(status) {
  return semanticTone(status);
}

export function semanticTone(value = "") {
  const text = String(value || "").toLowerCase();
  if (!text) return "blue";
  if (text.includes("не срочно") || text.includes("не термін") || text.includes("низьк") || text.includes("планов")) return "green";
  if (
    text.includes("просроч") ||
    text.includes("простроч") ||
    text.includes("терміново") ||
    text.includes("срочно") ||
    text.includes("висок") ||
    text.includes("помилка") ||
    text.includes("ошибка") ||
    text.includes("борг") ||
    text.includes("выключ") ||
    text.includes("вимк") ||
    text.includes("не турбувати")
  ) return "red";
  if (
    text.includes("не подано") ||
    text.includes("не розпочато") ||
    text.includes("без відпові") ||
    text.includes("серед") ||
    text.includes("очіку") ||
    text.includes("ожида") ||
    text.includes("чернет") ||
    text.includes("потрібно") ||
    text.includes("потреб") ||
    text.includes("перевір") ||
    text.includes("процес") ||
    text.includes("менше") ||
    text.includes("год")
  ) return "amber";
  if (
    text.includes("викон") ||
    text.includes("готов") ||
    text.includes("отрим") ||
    text.includes("подано") ||
    text.includes("достав") ||
    text.includes("провед") ||
    text.includes("відправ") ||
    text.includes("створ") ||
    text.includes("онов") ||
    text.includes("закрит") ||
    text.includes("заплан") ||
    text.includes("увімк") ||
    text.includes("включ") ||
    text.includes("актив") ||
    text.includes("оплач") ||
    text.includes("постій")
  ) return "green";
  if (
    text.includes("нов") ||
    text.includes("робот") ||
    text.includes("тест") ||
    text.includes("файл") ||
    text.includes("задач")
  ) return "blue";
  return "blue";
}

export function calendarTimeTone(label) {
  const text = String(label || "").toLowerCase();
  if (text.includes("просроч") || text.includes("простроч")) return "red";
  if (text.includes("менше") || text.includes("год")) return "amber";
  return "blue";
}
