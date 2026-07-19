import { changePasswordInApi, clearDemoDataInApi, getDemoDataStatusFromApi, importCrmSnapshotToApi, loginToApi, logoutFromApi, restoreDemoDataInApi, shouldUseApi, updateProfileInApi } from "./api.js?v=demo-empty-state-1";
import { icon } from "./ui.js?v=document-archive-books-1";
import { readAvatarThumbnail } from "./screens/settings.js?v=readiness-toggle-1";

const SNAPSHOT_STORAGE_KEY = "advocates-crm-snapshot";
let topbarClockTimer = null;

export function closeTopbarPanels($) {
  [
    ["#notifications-toggle", "#notifications-menu"],
    ["#admin-profile-toggle", "#admin-profile-menu"]
  ].forEach(([toggleSelector, panelSelector]) => {
    const toggle = $(toggleSelector);
    const panel = $(panelSelector);
    if (!toggle || !panel) return;
    toggle.classList.remove("active");
    toggle.setAttribute("aria-expanded", "false");
    panel.classList.remove("open");
    panel.hidden = true;
  });
}

export function isTopbarPanelOpen() {
  return Boolean(document.querySelector(".topbar-panel:not([hidden])"));
}

function syncTopbarClock() {
  const dateNode = document.querySelector("#topbar-current-date");
  const timeNode = document.querySelector("#topbar-current-time");
  const wrap = document.querySelector("[data-topbar-clock]");
  if (!dateNode || !timeNode) return;
  const now = new Date();
  dateNode.textContent = new Intl.DateTimeFormat("uk-UA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(now);
  timeNode.textContent = new Intl.DateTimeFormat("uk-UA", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(now);
  if (wrap) {
    wrap.title = new Intl.DateTimeFormat("uk-UA", {
      dateStyle: "full",
      timeStyle: "medium"
    }).format(now);
  }
}

function toggleTopbarPanel($, toggleSelector, panelSelector) {
  const toggle = $(toggleSelector);
  const panel = $(panelSelector);
  if (!toggle || !panel) return;
  const willOpen = panel.hidden;
  closeTopbarPanels($);
  panel.hidden = !willOpen;
  panel.classList.toggle("open", willOpen);
  toggle.classList.toggle("active", willOpen);
  toggle.setAttribute("aria-expanded", String(willOpen));
}

const doneNotificationStatuses = new Set(["Готово", "Виконано", "Завершено"]);

function notificationDate(value) {
  const clean = String(value || "").split(" ")[0];
  if (!clean || clean === "-") return null;
  if (clean.includes("-")) {
    const [year, month, day] = clean.split("-").map(Number);
    return new Date(year, month - 1, day);
  }
  const [day, month, year] = clean.split(".").map(Number);
  return new Date(year, month - 1, day);
}

function notificationTasks(state) {
  return (state.cases || []).flatMap((item) => (item.tasks || []).map((task) => ({
    ...task,
    caseId: item.id
  })));
}

function topbarNotificationData(state) {
  if (state.dataSource !== "api") {
    return {
      deadlines: { available: true },
      court: { available: true },
      mailings: { available: true }
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tasks = notificationTasks(state);
  const overdueTasks = tasks.filter((task) => {
    const due = notificationDate(task.due || task.dueDate || task.deadline);
    return due && due < today && !doneNotificationStatuses.has(task.status);
  });
  const courtEvent = (state.events || []).find((event) => {
    const text = `${event.type || ""} ${event.title || ""}`.toLowerCase();
    return text.includes("суд");
  });
  const campaign = (state.mailingCampaigns || [])[0];

  return {
    deadlines: {
      available: overdueTasks.length > 0,
      title: `${overdueTasks.length} ${overdueTasks.length === 1 ? "задача прострочена" : "задачі прострочено"}`,
      meta: "Перевірте дедлайни на сьогодні",
      action: "Відкрити задачі"
    },
    court: {
      available: Boolean(courtEvent),
      title: courtEvent ? `${courtEvent.title || courtEvent.type || "Судова подія"}${courtEvent.time ? ` о ${courtEvent.time}` : ""}` : "",
      meta: courtEvent?.caseId ? `Справа №${courtEvent.caseId}` : "Судові події ще не додані",
      action: "Відкрити календар"
    },
    mailings: {
      available: Boolean(campaign),
      title: campaign?.title || "Розсилка готова",
      meta: campaign?.meta || campaign?.status || "Кампанії ще не створені",
      action: "Відкрити розсилку"
    }
  };
}

function updateNotificationCopy(row, data) {
  if (!data?.available) return;
  const title = row.querySelector("strong");
  const meta = row.querySelector("em");
  const action = row.querySelector("small");
  if (data.title && title) title.textContent = data.title;
  if (data.meta && meta) meta.textContent = data.meta;
  if (data.action && action) action.textContent = data.action;
}

export function syncTopbarNotifications($, state) {
  const settings = state.settingsNotifications || {};
  const readKeys = new Set(state.notificationReadKeys || []);
  const notifications = topbarNotificationData(state);
  let unreadCount = 0;
  document.querySelectorAll("[data-notification-key]").forEach((row) => {
    const key = row.dataset.notificationKey;
    const data = notifications[key] || { available: true };
    updateNotificationCopy(row, data);
    const visible = data.available && settings[key] !== false && !readKeys.has(key);
    row.hidden = !visible;
    if (visible) unreadCount += 1;
  });
  const empty = document.querySelector("[data-notifications-empty]");
  if (empty) empty.hidden = unreadCount > 0;
  const badge = $("#notifications-count");
  if (badge) {
    badge.textContent = String(unreadCount);
    badge.classList.toggle("empty", unreadCount === 0);
  }
}

function markNotificationRead($, state, key) {
  const badge = $("#notifications-count");
  if (!badge || !key) return;
  state.notificationReadKeys = [...new Set([...(state.notificationReadKeys || []), key])];
  syncTopbarNotifications($, state);
}

function toggleSidebar({ saveNavigationState, showToast }) {
  const collapsed = document.body.classList.toggle("sidebar-collapsed");
  saveNavigationState();
  showToast(collapsed ? "Бокове меню згорнуто." : "Бокове меню розгорнуто.");
}

function focusSettingsSection(sectionKey) {
  requestAnimationFrame(() => {
    const section = document.querySelector(`[data-settings-section="${sectionKey}"]`);
    if (!section) return;
    document.querySelectorAll("[data-settings-section].is-focused").forEach((node) => {
      node.classList.remove("is-focused");
    });
    section.classList.add("is-focused");
    section.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => section.classList.remove("is-focused"), 1600);
  });
}

function demoDataSummary(status) {
  const counts = status?.counts || {};
  const total = status?.total ?? Object.values(counts).reduce((sum, value) => sum + Number(value || 0), 0);
  if (status?.snapshot) return `Локальна копія · ${total || 0} записів`;
  if (!status?.enabled) return "Вимкнено";
  if (!total) return "Увімкнено";
  return `Увімкнено · ${total} записів`;
}

function isSnapshotMode(state) {
  return state?.dataSource === "snapshot";
}

function syncDemoDataToggle(state) {
  const toggle = document.querySelector("[data-demo-data-toggle]");
  if (!toggle) return;
  const visible = (shouldUseApi(state) || isSnapshotMode(state)) && state.sessionPermissions?.canManageUsers;
  toggle.hidden = !visible;
  if (!visible) return;
  const enabled = Boolean(state.demoDataStatus?.enabled);
  toggle.classList.toggle("is-on", enabled);
  toggle.classList.toggle("is-off", !enabled);
  toggle.setAttribute("aria-pressed", String(enabled));
  toggle.querySelector("[data-demo-data-summary]").textContent = demoDataSummary(state.demoDataStatus);
}

async function refreshDemoDataStatus(state) {
  if (isSnapshotMode(state)) return state.demoDataStatus;
  if (!shouldUseApi(state)) return state.demoDataStatus;
  const status = await getDemoDataStatusFromApi();
  state.demoDataStatus = status;
  syncDemoDataToggle(state);
  return status;
}

function ensureDemoDataOverlay(ctx) {
  let overlay = document.querySelector("#demo-data-overlay");
  if (overlay) return overlay;
  const { state, showToast } = ctx;
  overlay = document.createElement("div");
  overlay.id = "demo-data-overlay";
  overlay.className = "demo-data-overlay";
  overlay.hidden = true;
  overlay.innerHTML = `
    <section class="demo-data-card" role="dialog" aria-modal="true" aria-labelledby="demo-data-title">
      <button class="demo-data-close" type="button" data-demo-data-close aria-label="Закрити">×</button>
      <div class="demo-data-head">
        <div class="demo-data-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M4 7h16"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M6 7l1 14h10l1-14"></path><path d="M9 7V4h6v3"></path></svg>
        </div>
        <h2 id="demo-data-title">Демо-дані</h2>
        <p data-demo-data-text></p>
      </div>
      <div class="demo-data-counts" data-demo-data-counts></div>
      <div class="demo-data-actions">
        <button class="danger-soft" type="button" data-demo-data-clear>Вимкнути демо-дані</button>
        <button class="primary" type="button" data-demo-data-restore>Увімкнути демо-дані</button>
        <button class="secondary" type="button" data-demo-data-close>Скасувати</button>
      </div>
    </section>
  `;
  document.body.append(overlay);
  overlay.querySelectorAll("[data-demo-data-close]").forEach((button) => {
    button.addEventListener("click", () => {
      overlay.hidden = true;
    });
  });
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) overlay.hidden = true;
  });
  overlay.querySelector("[data-demo-data-clear]")?.addEventListener("click", async () => {
    const button = overlay.querySelector("[data-demo-data-clear]");
    button.disabled = true;
    if (isSnapshotMode(state)) {
      localStorage.removeItem(SNAPSHOT_STORAGE_KEY);
      overlay.hidden = true;
      showToast("Локальну копію вимкнено. Повертаю звичайний режим.");
      window.setTimeout(() => window.location.reload(), 350);
      return;
    }
    try {
      const payload = await clearDemoDataInApi();
      state.demoDataStatus = payload.demoData;
      syncDemoDataToggle(state);
      overlay.hidden = true;
      showToast("Демо-дані вимкнено. Ручні записи залишилися в CRM.");
      window.setTimeout(() => window.location.reload(), 350);
    } catch (_error) {
      showToast("Не вдалося очистити демо-дані.", "warning");
      button.disabled = false;
    }
  });
  overlay.querySelector("[data-demo-data-restore]")?.addEventListener("click", async () => {
    const button = overlay.querySelector("[data-demo-data-restore]");
    overlay.hidden = true;
    await restoreDemoDataAndReload({ state, showToast }, button);
  });
  return overlay;
}

function downloadCrmSnapshot(state, showToast) {
  const timestamp = new Date().toISOString();
  const snapshot = {
    exportedAt: timestamp,
    source: state.dataSource || "static",
    demoData: state.demoDataStatus || {},
    currentUser: state.currentUser || null,
    bureauSettings: state.bureauSettings || {},
    settingsUsers: state.settingsUsers || [],
    settingsIntegrations: state.settingsIntegrations || {},
    settingsIntegrationSettings: state.settingsIntegrationSettings || {},
    settingsNotifications: state.settingsNotifications || {},
    clients: state.clients || [],
    cases: state.cases || [],
    tasks: state.tasks || [],
    events: state.events || [],
    financeOperations: state.financeOperations || [],
    mailing: {
      templates: state.mailingTemplates || [],
      campaigns: state.mailingCampaigns || [],
      automationRules: state.mailingAutomationRules || [],
      testContacts: state.mailingTestContacts || []
    },
    auditLogs: state.auditLogs || []
  };
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `advocates-crm-snapshot-${timestamp.slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast("JSON-копію CRM підготовлено для завантаження.");
}

async function readCrmSnapshotFile(file) {
  const text = await file.text();
  let snapshot = null;
  try {
    snapshot = JSON.parse(text);
  } catch (_error) {
    throw new Error("Файл не схожий на коректну JSON-копію CRM.");
  }
  if (!snapshot || !Array.isArray(snapshot.clients) || !Array.isArray(snapshot.cases) || !Array.isArray(snapshot.events)) {
    throw new Error("У копії немає базових розділів CRM: clients, cases, events.");
  }
  return snapshot;
}

async function importCrmSnapshot(file) {
  const snapshot = await readCrmSnapshotFile(file);
  localStorage.setItem(SNAPSHOT_STORAGE_KEY, JSON.stringify({
    ...snapshot,
    importedAt: new Date().toISOString()
  }));
  return snapshot;
}

async function restoreDemoDataAndReload(ctx, control = null) {
  const { state, showToast } = ctx;
  localStorage.removeItem(SNAPSHOT_STORAGE_KEY);
  if (control) control.disabled = true;
  try {
    const payload = await restoreDemoDataInApi();
    state.demoDataStatus = payload.demoData;
    syncDemoDataToggle(state);
    showToast("Демо-дані відновлено. Оновлюю кабінет.");
    window.setTimeout(() => window.location.reload(), 350);
  } catch (_error) {
    showToast("Не вдалося відновити демо-дані.", "warning");
    if (control) control.disabled = false;
  }
}

async function openDemoDataOverlay(ctx) {
  const overlay = ensureDemoDataOverlay(ctx);
  try {
    await refreshDemoDataStatus(ctx.state);
  } catch (_error) {
    ctx.showToast("Не вдалося перевірити стан демо-даних.", "warning");
  }
  const status = ctx.state.demoDataStatus || {};
  const enabled = Boolean(status.enabled);
  syncDemoDataToggle(ctx.state);
  overlay.querySelector("[data-demo-data-text]").textContent = isSnapshotMode(ctx.state)
    ? "Зараз відкрито локальну JSON-копію CRM у цьому браузері. Вона не змінює серверну базу. Кнопка «Очистити» прибере локальну копію і поверне звичайний режим."
    : enabled
    ? "Вимкнення прибере тільки стартові демо-записи CRM. Клієнти, справи, задачі, документи, календар і фінанси, які ви додали вручну, залишаться."
    : "Демо-кабінет зараз порожній. Можна відновити стартовий набір клієнтів, справ, задач, документів, календаря та фінансів.";
  const counts = status.counts || {};
  overlay.querySelector("[data-demo-data-counts]").innerHTML = [
    ["Клієнти", counts.clients],
    ["Справи", counts.cases],
    ["Задачі", counts.tasks],
    ["Документи", counts.documents],
    ["Події", counts.events],
    ["Фінанси", counts.financeOperations],
  ].map(([label, value]) => `<span><strong>${Number(value || 0)}</strong><em>${label}</em></span>`).join("");
  overlay.querySelector("[data-demo-data-clear]").hidden = !enabled;
  overlay.querySelector("[data-demo-data-restore]").hidden = enabled || isSnapshotMode(ctx.state);
  overlay.hidden = false;
}

async function handleDemoDataToggleClick(ctx) {
  const { state, showToast } = ctx;
  const toggle = document.querySelector("[data-demo-data-toggle]");
  try {
    await refreshDemoDataStatus(state);
  } catch (_error) {
    showToast("Не вдалося перевірити стан демо-даних.", "warning");
  }
  if (!isSnapshotMode(state) && shouldUseApi(state) && !state.demoDataStatus?.enabled) {
    await restoreDemoDataAndReload(ctx, toggle);
    return;
  }
  await openDemoDataOverlay(ctx);
}

export function syncTopbarUser($, state) {
  const user = state.currentUser || state.settingsUsers?.[0];
  if (!user) return;
  const neutralDemoAdmin = shouldUseApi(state) && !state.sessionAuthenticated && state.demoDataStatus?.enabled === false;
  const displayName = neutralDemoAdmin ? "Admin" : user.name;
  const photo = neutralDemoAdmin ? "" : (user.photo || "");
  const photoIsImage = /^(https?:\/\/|\/|assets\/|data:image\/)/i.test(photo);
  const initials = ((neutralDemoAdmin ? "AD" : (photoIsImage ? "" : photo)) || user.name?.trim()?.slice(0, 2) || "АД").slice(0, 2);
  const role = neutralDemoAdmin ? "Адміністратор" : state.sessionAuthenticated ? user.role : `${user.role || "Адміністратор"} · демо`;
  const toggleName = $("#admin-profile-toggle > div:nth-of-type(2) strong");
  const toggleRole = $("#admin-profile-toggle > div:nth-of-type(2) span");
  const panelName = $("#admin-profile-menu .profile-panel-head > div:nth-of-type(2) strong");
  const panelRole = $("#admin-profile-menu .profile-panel-head > div:nth-of-type(2) span");
  const avatars = document.querySelectorAll(".admin-photo");
  if (toggleName) toggleName.textContent = displayName;
  if (toggleRole) toggleRole.textContent = role;
  if (panelName) panelName.textContent = displayName;
  const panelRoleText = neutralDemoAdmin ? "Порожній кабінет CRM" : state.sessionAuthenticated ? user.access || user.role : "Демо-доступ до CRM";
  if (panelRole) panelRole.textContent = panelRoleText;
  // Show the uploaded/linked photo as a real image; otherwise fall back to the initials.
  avatars.forEach((node) => {
    node.classList.toggle("has-photo", photoIsImage);
    node.textContent = "";
    if (photoIsImage) {
      const img = document.createElement("img");
      img.src = photo;
      img.alt = displayName || "";
      node.appendChild(img);
    } else {
      const span = document.createElement("span");
      span.textContent = initials;
      node.appendChild(span);
    }
  });
  document.documentElement.dataset.authenticated = state.sessionAuthenticated ? "true" : "false";
  // Cache for the inline hydration script so the topbar profile shows instantly on reload
  // instead of flashing the static placeholder while the API data loads.
  try {
    localStorage.setItem("crmUserCache", JSON.stringify({
      name: displayName || "",
      role: role || "",
      panelRole: panelRoleText || "",
      photoImg: photoIsImage ? photo : "",
      initials
    }));
  } catch (_e) { /* ignore */ }
}

function applySessionState(state, session) {
  state.session = session || {};
  state.currentUser = session?.user || state.settingsUsers?.[0] || state.currentUser;
  state.sessionAuthenticated = Boolean(session?.authenticated);
  state.sessionPermissions = session?.permissions || {};
}

function sessionRequiresPasswordChange(state) {
  return shouldUseApi(state)
    && state.sessionAuthenticated
    && Boolean(state.session?.mustChangePassword || state.currentUser?.mustChangePassword || state.currentUser?.passwordTemporary);
}

function ensurePasswordChangeOverlay(ctx) {
  let overlay = document.querySelector("#password-change-overlay");
  if (overlay) return overlay;
  const { $, state, saveNavigationState, showToast, onSessionChange } = ctx;
  overlay = document.createElement("div");
  overlay.id = "password-change-overlay";
  overlay.className = "logout-overlay password-change-overlay";
  overlay.hidden = true;
  overlay.innerHTML = `
    <section class="logout-card password-change-card" role="dialog" aria-modal="true" aria-labelledby="password-change-title">
      <div class="logout-mark">CRM</div>
      <h2 id="password-change-title">Змініть тимчасовий пароль</h2>
      <p>Цей пароль виданий адміністратором. Щоб продовжити роботу, створіть власний пароль.</p>
      <form class="login-form" data-password-change-form>
        <label>Новий пароль<input name="password" type="password" autocomplete="new-password" minlength="8" required /></label>
        <label>Повторіть пароль<input name="passwordRepeat" type="password" autocomplete="new-password" minlength="8" required /></label>
        <small>Мінімум 8 символів. Адміністратор зможе тільки скинути пароль, але не побачить ваш новий.</small>
        <p class="login-error" data-password-change-error hidden></p>
        <button class="primary" type="submit">Зберегти пароль</button>
        <button class="secondary" type="button" data-password-change-logout>Вийти</button>
      </form>
    </section>
  `;
  document.body.append(overlay);
  overlay.querySelector("[data-password-change-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const error = overlay.querySelector("[data-password-change-error]");
    const password = form.elements.password.value;
    const repeat = form.elements.passwordRepeat.value;
    if (error) error.hidden = true;
    if (password.length < 8) {
      if (error) {
        error.textContent = "Пароль має містити щонайменше 8 символів.";
        error.hidden = false;
      }
      return;
    }
    if (password !== repeat) {
      if (error) {
        error.textContent = "Паролі не збігаються.";
        error.hidden = false;
      }
      return;
    }
    try {
      const session = await changePasswordInApi(password);
      applySessionState(state, session);
      const userIndex = state.settingsUsers?.findIndex((user) => user.id === session.user?.id);
      if (userIndex >= 0) state.settingsUsers[userIndex] = session.user;
      syncTopbarUser($, state);
      saveNavigationState();
      onSessionChange?.();
      form.reset();
      overlay.hidden = true;
      showToast("Пароль змінено. Доступ активний.");
    } catch (_error) {
      if (error) {
        error.textContent = "Не вдалося змінити пароль. Спробуйте ще раз.";
        error.hidden = false;
      }
    }
  });
  overlay.querySelector("[data-password-change-logout]")?.addEventListener("click", async () => {
    overlay.hidden = true;
    await openLogoutOverlay(ctx);
  });
  return overlay;
}

function openPasswordChangeOverlay(ctx) {
  if (!sessionRequiresPasswordChange(ctx.state)) return;
  const overlay = ensurePasswordChangeOverlay(ctx);
  overlay.hidden = false;
  overlay.querySelector("input[name='password']")?.focus();
}

function renderMyProfilePreview(node, photo, name) {
  if (!node) return;
  node.textContent = "";
  const value = String(photo || "");
  if (/^(https?:\/\/|\/|assets\/|data:image\/)/i.test(value)) {
    const img = document.createElement("img");
    img.src = value;
    img.alt = name || "";
    node.appendChild(img);
  } else {
    const span = document.createElement("span");
    const initials = value || (name || "").trim().split(/\s+/).map((part) => part[0] || "").join("").slice(0, 2).toUpperCase() || "CRM";
    span.textContent = initials.slice(0, 4);
    node.appendChild(span);
  }
}

// "Мій профіль": every logged-in user edits their OWN photo/name/email/phone (+ password).
// Laid out like the bureau profile card — avatar with upload on the left, fields on the right.
function openMyProfileDialog(ctx) {
  const { $, state, showToast, saveNavigationState, onSessionChange } = ctx;
  if (!shouldUseApi(state)) {
    showToast?.("Профіль доступний, коли CRM відкрита через сервер.", "warning");
    return;
  }
  const user = state.currentUser || state.settingsUsers?.[0] || {};
  document.querySelector("#my-profile-dialog")?.remove();
  const dialog = document.createElement("dialog");
  dialog.id = "my-profile-dialog";
  dialog.className = "settings-invite-dialog my-profile-dialog";
  dialog.innerHTML = `
    <form method="dialog" class="modal-form crm-modal-form settings-user-form" id="my-profile-form">
      <div class="modal-head crm-modal-head">
        <div class="crm-modal-title">
          <span class="crm-modal-title-icon">${icon("userPlus")}</span>
          <div>
            <h2>Мій профіль</h2>
            <p class="muted">Змініть своє фото, ім'я та контактні дані.</p>
          </div>
        </div>
        <button class="crm-modal-close" type="button" data-my-profile-close aria-label="Закрити" title="Закрити">${icon("x")}</button>
      </div>
      <div class="settings-profile-layout">
        <div class="settings-bureau-logo-card">
          <div class="settings-bureau-logo-preview" data-my-profile-preview></div>
          <div class="settings-logo-source">
            <input type="hidden" name="photo" />
            <div class="settings-logo-actions">
              <label class="secondary settings-logo-upload" aria-label="Завантажити фото" title="Завантажити фото з комп'ютера">${icon("upload")}
                <input type="file" accept="image/png,image/jpeg,image/webp" data-my-profile-upload hidden />
              </label>
              <input data-my-profile-manual placeholder="URL або ініціали" />
            </div>
          </div>
        </div>
        <div class="settings-profile-fields">
          <div class="settings-form-grid settings-bureau-main-grid">
            <label>Ім'я та прізвище<input name="name" placeholder="Прізвище Ім'я По батькові" /></label>
            <label>Email<input name="email" type="email" placeholder="user@example.com" /></label>
            <label>Телефон<input name="phone" placeholder="+380..." /></label>
            <label>Новий пароль<input name="newPassword" type="password" autocomplete="new-password" placeholder="Залиште порожнім, щоб не міняти" /></label>
          </div>
        </div>
      </div>
      <div class="crm-modal-actions my-profile-actions">
        <button type="button" class="secondary" data-my-profile-close>Скасувати</button>
        <button type="submit" class="primary">${icon("check")} Зберегти профіль</button>
      </div>
    </form>
  `;
  document.body.append(dialog);
  const form = dialog.querySelector("#my-profile-form");
  const preview = dialog.querySelector("[data-my-profile-preview]");
  const manual = dialog.querySelector("[data-my-profile-manual]");
  const photo = String(user.photo || "");
  const photoIsImage = /^(https?:\/\/|\/|assets\/|data:image\/)/i.test(photo);
  form.elements.name.value = user.name || "";
  form.elements.email.value = user.email || "";
  form.elements.phone.value = user.phone || "";
  form.elements.photo.value = photo;
  manual.value = photoIsImage ? "" : photo;
  renderMyProfilePreview(preview, photo, user.name);

  dialog.querySelector("[data-my-profile-upload]")?.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { showToast?.("Оберіть файл зображення.", "danger"); event.target.value = ""; return; }
    if (file.size > 8 * 1024 * 1024) { showToast?.("Фото завелике. Оберіть файл до 8 MB.", "danger"); event.target.value = ""; return; }
    try {
      const dataUrl = await readAvatarThumbnail(file);
      form.elements.photo.value = dataUrl;
      manual.value = "";
      renderMyProfilePreview(preview, dataUrl, form.elements.name.value);
    } catch (_error) {
      showToast?.("Не вдалося обробити фото.", "danger");
    } finally {
      event.target.value = "";
    }
  });
  manual.addEventListener("input", (event) => {
    const value = event.target.value.trim();
    form.elements.photo.value = value;
    renderMyProfilePreview(preview, value, form.elements.name.value);
  });
  dialog.querySelectorAll("[data-my-profile-close]").forEach((button) => button.addEventListener("click", () => dialog.close()));
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const newPassword = (form.elements.newPassword.value || "").trim();
    if (newPassword && newPassword.length < 8) {
      showToast?.("Пароль має містити щонайменше 8 символів.", "danger");
      return;
    }
    try {
      let session = await updateProfileInApi({
        name: form.elements.name.value.trim(),
        email: form.elements.email.value.trim(),
        phone: form.elements.phone.value.trim(),
        photo: form.elements.photo.value.trim()
      });
      if (newPassword) session = await changePasswordInApi(newPassword);
      applySessionState(state, session);
      const idx = state.settingsUsers?.findIndex((item) => item.id === session.user?.id);
      if (idx >= 0) state.settingsUsers[idx] = session.user;
      syncTopbarUser($, state);
      saveNavigationState?.();
      onSessionChange?.();
      dialog.close();
      showToast?.("Профіль оновлено.");
    } catch (_error) {
      showToast?.("Не вдалося зберегти профіль. Спробуйте ще раз.", "danger");
    }
  });
  dialog.showModal();
}

function ensureLogoutOverlay(ctx) {
  let overlay = document.querySelector("#logout-overlay");
  if (overlay) return overlay;
  const { $, state, saveNavigationState, showToast, onSessionChange } = ctx;
  overlay = document.createElement("div");
  overlay.id = "logout-overlay";
  overlay.className = "logout-overlay";
  overlay.hidden = true;
  // Secured deployments (CRM_REQUIRE_AUTH) get a real sign-in screen: no demo
  // credentials, no "back to demo" escape hatch (it would bypass auth).
  const secured = Boolean(state.session?.requireAuth);
  const heading = secured ? "Вхід у систему" : "Сеанс завершено";
  const subtitle = secured
    ? "Введіть робочий email і пароль, щоб увійти в CRM."
    : "Увійдіть під роллю користувача бюро або поверніться в демо-режим.";
  const emailValue = secured ? "" : "ivanenko@advocates.crm";
  const passwordValue = secured ? "" : "demo12345";
  const demoHint = secured ? "" : `<small>Демо-доступ: ivanenko@advocates.crm / demo12345</small>`;
  const returnButton = secured ? "" : `<button class="secondary" type="button" data-login-return>Повернутися в демо</button>`;
  overlay.innerHTML = `
    <section class="logout-card" role="dialog" aria-modal="true" aria-labelledby="logout-title">
      <div class="logout-mark">CRM</div>
      <h2 id="logout-title">${heading}</h2>
      <p>${subtitle}</p>
      <form class="login-form" data-login-form>
        <label>Логін<input name="email" type="text" value="${emailValue}" autocomplete="username" required /></label>
        <label>Пароль<input name="password" type="password" value="${passwordValue}" autocomplete="current-password" required /></label>
        ${demoHint}
        <p class="login-error" data-login-error hidden></p>
        <button class="primary" type="submit">Увійти</button>
        ${returnButton}
      </form>
    </section>
  `;
  document.body.append(overlay);
  overlay.querySelector("[data-login-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const error = overlay.querySelector("[data-login-error]");
    const form = event.currentTarget;
    if (error) error.hidden = true;
    if (!shouldUseApi(state)) {
      if (error) {
        error.textContent = "Логін доступний, коли CRM відкрита через Django-сервер.";
        error.hidden = false;
      }
      return;
    }
    try {
      const session = await loginToApi({
        email: form.elements.email.value,
        password: form.elements.password.value
      });
      applySessionState(state, session);
      syncTopbarUser($, state);
      saveNavigationState();
      onSessionChange?.();
      overlay.hidden = true;
      document.body.classList.remove("session-ended");
      armIdleTimer(); // перезапускаємо відлік бездіяльності для нової сесії
      showToast(`Вхід виконано: ${session.user?.name || "користувач"}.`);
      openPasswordChangeOverlay(ctx);
    } catch (_error) {
      if (error) {
        error.textContent = "Невірний email або пароль.";
        error.hidden = false;
      }
    }
  });
  overlay.querySelector("[data-login-return]")?.addEventListener("click", () => {
    state.currentUser = state.settingsUsers?.[0] || state.currentUser;
    state.session = { authenticated: false, user: state.currentUser, permissions: {} };
    state.sessionAuthenticated = false;
    syncTopbarUser($, state);
    saveNavigationState();
    onSessionChange?.();
    overlay.hidden = true;
    document.body.classList.remove("session-ended");
    showToast("Демо-режим активний.");
  });
  return overlay;
}

async function openLogoutOverlay(ctx) {
  const { $, state, saveNavigationState, showToast, onSessionChange } = ctx;
  if (shouldUseApi(state)) {
    try {
      const session = await logoutFromApi();
      applySessionState(state, session);
      state.sessionAuthenticated = false;
      syncTopbarUser($, state);
      saveNavigationState();
      onSessionChange?.();
    } catch (_error) {
      showToast("Не вдалося завершити серверну сесію.", "warning");
    }
  }
  stopIdleTimer();
  const overlay = ensureLogoutOverlay(ctx);
  document.body.classList.add("session-ended");
  overlay.hidden = false;
  overlay.querySelector("input[name='email']")?.focus();
}

// ── Автоматичний вихід через бездіяльність ────────────────────────────────
// Захищає відкриту CRM, якщо співробітник відійшов від комп'ютера: після
// IDLE_LIMIT_MS без жодних дій серверна сесія завершується і для продовження
// роботи потрібно знову ввести пароль. Працює лише для реально автентифікованої
// сесії (в демо-режимі немає пароля — захищати нічого).
const IDLE_LIMIT_MS = 15 * 60 * 1000;   // 15 хвилин бездіяльності → вихід
const IDLE_WARN_MS = 60 * 1000;         // попередити за 1 хв до виходу
const IDLE_ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "wheel"];

let idleCtx = null;             // останній ctx — потрібен для logout при спливанні
let idleDeadline = 0;           // момент автозавершення (epoch ms)
let idleTicker = null;          // interval, що звіряє дедлайн
let idleWarned = false;         // чи вже показали попередження про близький вихід
let idleListenersBound = false; // слухачі активності чіпляємо один раз
let idleLoggingOut = false;     // захист від повторного виклику logout

// Дозволяємо тимчасово змінити ліміт для тесту через консоль:
//   window.__CRM_IDLE_MINUTES__ = 1
function idleLimitMs() {
  const override = Number(window.__CRM_IDLE_MINUTES__);
  if (Number.isFinite(override) && override > 0) return override * 60 * 1000;
  return IDLE_LIMIT_MS;
}

function idleActive() {
  return Boolean(idleCtx && shouldUseApi(idleCtx.state) && idleCtx.state.sessionAuthenticated);
}

function bumpIdleDeadline() {
  if (!idleActive()) return;
  idleDeadline = Date.now() + idleLimitMs();
  idleWarned = false;
}

function stopIdleTimer() {
  if (idleTicker) {
    window.clearInterval(idleTicker);
    idleTicker = null;
  }
}

async function idleCheck() {
  if (idleLoggingOut || !idleActive()) return;
  const remaining = idleDeadline - Date.now();
  if (remaining <= 0) {
    idleLoggingOut = true;
    stopIdleTimer();
    idleCtx.showToast?.("Сеанс завершено через бездіяльність. Увійдіть знову, щоб продовжити роботу.", "warning");
    try {
      await openLogoutOverlay(idleCtx);
    } finally {
      idleLoggingOut = false;
    }
    return;
  }
  if (remaining <= IDLE_WARN_MS && !idleWarned) {
    idleWarned = true;
    idleCtx.showToast?.("Сеанс завершиться за хвилину через бездіяльність. Порухайте мишею, щоб залишитися в системі.", "info");
  }
}

function armIdleTimer() {
  stopIdleTimer();
  if (!idleActive()) return;
  bumpIdleDeadline();
  idleTicker = window.setInterval(idleCheck, 5000); // звіряємо дедлайн кожні 5 с
}

function setupIdleLogout(ctx) {
  idleCtx = ctx;
  if (!idleListenersBound) {
    idleListenersBound = true;
    IDLE_ACTIVITY_EVENTS.forEach((evt) =>
      document.addEventListener(evt, bumpIdleDeadline, { passive: true }));
    // Повернення на вкладку теж звіряємо: сесія могла спливти, поки вкладка була у фоні.
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) idleCheck();
    });
  }
  armIdleTimer();
}

export function setupTopbarControls({ $, state, switchView, saveNavigationState, showToast, onSessionChange }) {
  syncTopbarUser($, state);
  syncTopbarNotifications($, state);
  syncDemoDataToggle(state);
  syncTopbarClock();
  if (!topbarClockTimer) {
    topbarClockTimer = window.setInterval(syncTopbarClock, 30000);
  }

  document.addEventListener("click", (event) => {
    if (event.target.closest("#notifications-toggle")) {
      event.preventDefault();
      event.stopPropagation();
      toggleTopbarPanel($, "#notifications-toggle", "#notifications-menu");
      return;
    }
    if (event.target.closest("#admin-profile-toggle")) {
      event.preventDefault();
      event.stopPropagation();
      toggleTopbarPanel($, "#admin-profile-toggle", "#admin-profile-menu");
      return;
    }
    if (!event.target.closest(".topbar-menu-wrap")) closeTopbarPanels($);
  });

  document.querySelectorAll("[data-notification-view]").forEach((button) => {
    button.addEventListener("click", () => {
      markNotificationRead($, state, button.dataset.notificationKey);
      saveNavigationState();
      closeTopbarPanels($);
      switchView(button.dataset.notificationView);
      showToast("Відкрито розділ зі сповіщення.");
    });
  });

  $("[data-clear-notifications]")?.addEventListener("click", () => {
    state.notificationReadKeys = [...document.querySelectorAll("[data-notification-key]")]
      .filter((row) => state.settingsNotifications?.[row.dataset.notificationKey] !== false)
      .map((row) => row.dataset.notificationKey);
    syncTopbarNotifications($, state);
    saveNavigationState();
    closeTopbarPanels($);
    showToast("Сповіщення позначено як прочитані.");
  });

  document.querySelectorAll("[data-profile-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      const action = button.dataset.profileAction;
      closeTopbarPanels($);
      if (action === "settings") {
        openMyProfileDialog({ $, state, showToast, saveNavigationState, onSessionChange });
        return;
      }
      if (action === "team") {
        switchView("settings");
        focusSettingsSection("users");
        return;
      }
      if (action === "compact") {
        toggleSidebar({ saveNavigationState, showToast });
        return;
      }
      await openLogoutOverlay({ $, state, saveNavigationState, showToast, onSessionChange });
    });
  });

  $(".collapse-menu")?.addEventListener("click", () => toggleSidebar({ saveNavigationState, showToast }));
  $(".sidebar-restore")?.addEventListener("click", () => toggleSidebar({ saveNavigationState, showToast }));
  $("[data-demo-data-toggle]")?.addEventListener("click", () => handleDemoDataToggleClick({ state, showToast }));
  if (shouldUseApi(state) && state.sessionPermissions?.canManageUsers) {
    window.setTimeout(() => refreshDemoDataStatus(state).catch(() => {}), 0);
  }
  // Secured mode (CRM_REQUIRE_AUTH): force the login screen on boot so the app
  // is not usable anonymously. Does NOT call logout — just reveals the overlay.
  if (shouldUseApi(state) && state.session?.requireAuth && !state.sessionAuthenticated) {
    const overlay = ensureLogoutOverlay({ $, state, saveNavigationState, showToast, onSessionChange });
    document.body.classList.add("session-ended");
    overlay.hidden = false;
    overlay.querySelector("input[name='email']")?.focus();
  }
  window.setTimeout(() => openPasswordChangeOverlay({ $, state, saveNavigationState, showToast, onSessionChange }), 0);
  // Авто-вихід через бездіяльність (запускається лише для автентифікованої сесії).
  setupIdleLogout({ $, state, saveNavigationState, showToast, onSessionChange });
}
