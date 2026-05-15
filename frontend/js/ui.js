export const calendarToday = "2024-05-15";
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
  return `
    <div class="row-action-menu-wrap${className}">
      <button type="button" class="icon-button compact row-action-trigger" data-action-menu-trigger aria-label="${label}" aria-expanded="false">⋮</button>
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

export function bindActionMenus(root = document) {
  if (!document.body.dataset.actionMenusGlobalBound) {
    document.body.dataset.actionMenusGlobalBound = "true";
    document.addEventListener("click", (event) => {
      if (event.target.closest(".row-action-menu-wrap")) return;
      document.querySelectorAll(".row-action-menu").forEach((menu) => {
        menu.hidden = true;
        menu.style.position = "";
        menu.style.top = "";
        menu.style.right = "";
        menu.style.bottom = "";
      });
      document.querySelectorAll("[data-action-menu-trigger]").forEach((button) => {
        button.setAttribute("aria-expanded", "false");
      });
    });
  }

  root.querySelectorAll("[data-action-menu-trigger]").forEach((button) => {
    if (button.dataset.actionMenuBound === "true") return;
    button.dataset.actionMenuBound = "true";
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const wrapper = button.closest(".row-action-menu-wrap");
      const menu = wrapper?.querySelector(".row-action-menu");
      const shouldOpen = menu?.hidden;
      document.querySelectorAll(".row-action-menu").forEach((item) => {
        if (item !== menu) {
          item.hidden = true;
          item.style.position = "";
          item.style.top = "";
          item.style.right = "";
          item.style.bottom = "";
        }
      });
      document.querySelectorAll("[data-action-menu-trigger]").forEach((item) => {
        if (item !== button) item.setAttribute("aria-expanded", "false");
      });
      if (menu) {
        menu.hidden = !shouldOpen;
        menu.style.position = "";
        menu.style.top = "";
        menu.style.right = "";
        menu.style.bottom = "";
        if (shouldOpen) {
          const triggerBox = button.getBoundingClientRect();
          menu.style.position = "fixed";
          menu.style.right = `${Math.max(8, window.innerWidth - triggerBox.right)}px`;
          menu.style.top = `${triggerBox.bottom + 8}px`;
          requestAnimationFrame(() => {
            const menuBox = menu.getBoundingClientRect();
            if (menuBox.bottom > window.innerHeight - 8) {
              menu.style.top = `${Math.max(8, triggerBox.top - menuBox.height - 8)}px`;
            }
          });
        }
      }
      button.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
    });
  });
}

export function icon(name) {
  const icons = {
    search: `<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path></svg>`,
    filter: `<svg viewBox="0 0 24 24"><path d="M4 5h16l-6.5 7.2V18l-3 1.5v-7.3L4 5Z"></path></svg>`,
    telegram: `<svg viewBox="0 0 24 24"><path d="M21 4 3.8 10.8c-.8.3-.8 1.4.1 1.6l4.3 1.3 1.7 5.1c.2.7 1.1.9 1.6.3l2.5-2.9 4.5 3.4c.6.5 1.5.1 1.7-.7L22.5 5c.2-.7-.7-1.3-1.5-1Z"></path><path d="m8.4 13.6 8.2-5.2-6.4 7.4"></path></svg>`,
    user: `<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"></circle><path d="M4.5 21a7.5 7.5 0 0 1 15 0"></path></svg>`,
    phone: `<svg viewBox="0 0 24 24"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.7 19.7 0 0 1-8.6-3.1 19.3 19.3 0 0 1-6-6A19.7 19.7 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c1 .3 1.9.6 2.9.7A2 2 0 0 1 22 16.9Z"></path></svg>`,
    message: `<svg viewBox="0 0 24 24"><path d="M5 5h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-5 3v-3H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"></path></svg>`,
    mail: `<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"></rect><path d="m4 7 8 6 8-6"></path></svg>`,
    calendar: `<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M16 3v4M8 3v4M3 11h18"></path></svg>`,
    clock: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path></svg>`,
    building: `<svg viewBox="0 0 24 24"><path d="M3 21h18"></path><path d="M5 21V9l7-4 7 4v12"></path><path d="M9 21v-6h6v6"></path><path d="M9 10h.01M12 10h.01M15 10h.01"></path></svg>`,
    briefcase: `<svg viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="13" rx="2"></rect><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"></path><path d="M3 12h18"></path></svg>`,
    bell: `<svg viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"></path><path d="M10 21h4"></path></svg>`,
    file: `<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"></path><path d="M14 2v6h6"></path></svg>`,
    eye: `<svg viewBox="0 0 24 24"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"></path><circle cx="12" cy="12" r="3"></circle></svg>`,
    tag: `<svg viewBox="0 0 24 24"><path d="M20.6 13.1 13.1 20.6a2 2 0 0 1-2.8 0L3 13.3V4h9.3l8.3 8.3a2 2 0 0 1 0 2.8Z"></path><circle cx="8" cy="8" r="1.5"></circle></svg>`,
    edit: `<svg viewBox="0 0 24 24"><path d="M16.9 3.7a2.1 2.1 0 0 1 3 3L8.4 18.2l-4.1 1.2 1.2-4.1L16.9 3.7Z"></path><path d="m15.5 5.1 3.4 3.4"></path></svg>`,
    trash: `<svg viewBox="0 0 24 24"><path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="m19 6-1 15H6L5 6"></path><path d="M10 11v6M14 11v6"></path></svg>`,
    refresh: `<svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 0 1-14.6 4.5"></path><path d="M4 12A8 8 0 0 1 18.6 7.5"></path><path d="M18 3v5h-5"></path><path d="M6 21v-5h5"></path></svg>`,
    check: `<svg viewBox="0 0 24 24"><path d="m20 6-11 11-5-5"></path></svg>`
  };
  return `<span class="ui-icon">${icons[name] || ""}</span>`;
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
  if (text.includes("не срочно") || text.includes("низьк") || text.includes("планов")) return "green";
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
