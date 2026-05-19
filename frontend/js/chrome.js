import { changePasswordInApi, clearDemoDataInApi, loginToApi, logoutFromApi, restoreDemoDataInApi, shouldUseApi } from "./api.js?v=password-access-1";

const DEMO_URL = "https://vonnabi.github.io/advocates-crm/";

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

export function syncTopbarNotifications($, state) {
  const settings = state.settingsNotifications || {};
  const readKeys = new Set(state.notificationReadKeys || []);
  let unreadCount = 0;
  document.querySelectorAll("[data-notification-key]").forEach((row) => {
    const key = row.dataset.notificationKey;
    const visible = settings[key] !== false && !readKeys.has(key);
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
  if (!status?.enabled) return "Вимкнено";
  if (!total) return "Увімкнено";
  return `Увімкнено · ${total} записів`;
}

function syncDemoDataToggle(state) {
  const toggle = document.querySelector("[data-demo-data-toggle]");
  if (!toggle) return;
  const visible = shouldUseApi(state) && state.sessionPermissions?.canManageUsers;
  toggle.hidden = !visible;
  if (!visible) return;
  const enabled = Boolean(state.demoDataStatus?.enabled);
  toggle.classList.toggle("is-on", enabled);
  toggle.classList.toggle("is-off", !enabled);
  toggle.setAttribute("aria-pressed", String(enabled));
  toggle.querySelector("[data-demo-data-summary]").textContent = demoDataSummary(state.demoDataStatus);
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
      <div class="demo-data-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M4 7h16"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M6 7l1 14h10l1-14"></path><path d="M9 7V4h6v3"></path></svg>
      </div>
      <h2 id="demo-data-title">Демо-дані</h2>
      <p data-demo-data-text></p>
      <div class="demo-data-counts" data-demo-data-counts></div>
      <div class="demo-data-actions">
        <button class="secondary" type="button" data-demo-data-close>Скасувати</button>
        <button class="danger-soft" type="button" data-demo-data-clear>Очистити</button>
        <button class="primary" type="button" data-demo-data-restore>Відновити</button>
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
    try {
      const payload = await clearDemoDataInApi();
      state.demoDataStatus = payload.demoData;
      syncDemoDataToggle(state);
      showToast("Демо-записи очищено. Ваші додані дані залишаються.");
      window.setTimeout(() => window.location.reload(), 500);
    } catch (_error) {
      showToast("Не вдалося очистити демо-дані.", "warning");
      button.disabled = false;
    }
  });
  overlay.querySelector("[data-demo-data-restore]")?.addEventListener("click", async () => {
    const button = overlay.querySelector("[data-demo-data-restore]");
    button.disabled = true;
    try {
      const payload = await restoreDemoDataInApi();
      state.demoDataStatus = payload.demoData;
      syncDemoDataToggle(state);
      showToast("Демо-дані відновлено. Оновлюю кабінет.");
      window.setTimeout(() => window.location.reload(), 500);
    } catch (_error) {
      showToast("Не вдалося відновити демо-дані.", "warning");
      button.disabled = false;
    }
  });
  return overlay;
}

function openDemoDataOverlay(ctx) {
  const overlay = ensureDemoDataOverlay(ctx);
  const status = ctx.state.demoDataStatus || {};
  const enabled = Boolean(status.enabled);
  overlay.querySelector("[data-demo-data-text]").textContent = enabled
    ? "Вимкнення очистить тільки записи, позначені як демо: клієнтів, справи, задачі, документи, календар і фінанси. Те, що ви або замовник додали вручну, залишиться."
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
  overlay.querySelector("[data-demo-data-restore]").hidden = enabled;
  overlay.hidden = false;
}

export function syncTopbarUser($, state) {
  const user = state.currentUser || state.settingsUsers?.[0];
  if (!user) return;
  const initials = user.photo || user.name?.slice(0, 1) || "І";
  const role = state.sessionAuthenticated ? user.role : `${user.role || "Адміністратор"} · демо`;
  const toggleName = $("#admin-profile-toggle > div:nth-of-type(2) strong");
  const toggleRole = $("#admin-profile-toggle > div:nth-of-type(2) span");
  const panelName = $("#admin-profile-menu .profile-panel-head > div:nth-of-type(2) strong");
  const panelRole = $("#admin-profile-menu .profile-panel-head > div:nth-of-type(2) span");
  const avatars = document.querySelectorAll(".admin-photo span");
  if (toggleName) toggleName.textContent = user.name;
  if (toggleRole) toggleRole.textContent = role;
  if (panelName) panelName.textContent = user.name;
  if (panelRole) panelRole.textContent = state.sessionAuthenticated ? user.access || user.role : "Демо-доступ до CRM";
  avatars.forEach((node) => {
    node.textContent = initials.slice(0, 2);
  });
  document.documentElement.dataset.authenticated = state.sessionAuthenticated ? "true" : "false";
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
      <div class="logout-mark">AB</div>
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

function ensureLogoutOverlay(ctx) {
  let overlay = document.querySelector("#logout-overlay");
  if (overlay) return overlay;
  const { $, state, saveNavigationState, showToast, onSessionChange } = ctx;
  overlay = document.createElement("div");
  overlay.id = "logout-overlay";
  overlay.className = "logout-overlay";
  overlay.hidden = true;
  overlay.innerHTML = `
    <section class="logout-card" role="dialog" aria-modal="true" aria-labelledby="logout-title">
      <div class="logout-mark">AB</div>
      <h2 id="logout-title">Сеанс завершено</h2>
      <p>Увійдіть під роллю користувача бюро або поверніться в демо-режим.</p>
      <form class="login-form" data-login-form>
        <label>Email<input name="email" type="email" value="ivanenko@advocates.crm" autocomplete="username" required /></label>
        <label>Пароль<input name="password" type="password" value="demo12345" autocomplete="current-password" required /></label>
        <small>Демо-доступ: ivanenko@advocates.crm / demo12345</small>
        <p class="login-error" data-login-error hidden></p>
        <button class="primary" type="submit">Увійти</button>
        <button class="secondary" type="button" data-login-return>Повернутися в демо</button>
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
  const overlay = ensureLogoutOverlay(ctx);
  document.body.classList.add("session-ended");
  overlay.hidden = false;
  overlay.querySelector("input[name='email']")?.focus();
}

async function copyDemoLink(showToast) {
  try {
    await navigator.clipboard.writeText(DEMO_URL);
    showToast("Ссылка для заказчика скопирована.");
  } catch (error) {
    window.prompt("Скопируйте ссылку для заказчика:", DEMO_URL);
  }
}

export function setupTopbarControls({ $, state, switchView, saveNavigationState, showToast, onSessionChange }) {
  syncTopbarUser($, state);
  syncTopbarNotifications($, state);
  syncDemoDataToggle(state);

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
        switchView("settings");
        focusSettingsSection("profile");
        return;
      }
      if (action === "team") {
        switchView("settings");
        focusSettingsSection("users");
        return;
      }
      if (action === "demo-link") {
        copyDemoLink(showToast);
        return;
      }
      if (action === "open-demo") {
        window.open(DEMO_URL, "_blank", "noopener");
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
  $("[data-demo-data-toggle]")?.addEventListener("click", () => openDemoDataOverlay({ state, showToast }));
  window.setTimeout(() => openPasswordChangeOverlay({ $, state, saveNavigationState, showToast, onSessionChange }), 0);
}
