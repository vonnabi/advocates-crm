import { loginToApi, logoutFromApi, shouldUseApi } from "./api.js?v=render-api-1";

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

function ensureLogoutOverlay(ctx) {
  let overlay = document.querySelector("#logout-overlay");
  if (overlay) return overlay;
  const { $, state, saveNavigationState, showToast } = ctx;
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
      state.currentUser = session.user;
      state.sessionAuthenticated = Boolean(session.authenticated);
      state.sessionPermissions = session.permissions || {};
      syncTopbarUser($, state);
      saveNavigationState();
      overlay.hidden = true;
      document.body.classList.remove("session-ended");
      showToast(`Вхід виконано: ${session.user?.name || "користувач"}.`);
    } catch (_error) {
      if (error) {
        error.textContent = "Невірний email або пароль.";
        error.hidden = false;
      }
    }
  });
  overlay.querySelector("[data-login-return]")?.addEventListener("click", () => {
    state.currentUser = state.settingsUsers?.[0] || state.currentUser;
    state.sessionAuthenticated = false;
    syncTopbarUser($, state);
    saveNavigationState();
    overlay.hidden = true;
    document.body.classList.remove("session-ended");
    showToast("Демо-режим активний.");
  });
  return overlay;
}

async function openLogoutOverlay(ctx) {
  const { $, state, saveNavigationState, showToast } = ctx;
  if (shouldUseApi(state)) {
    try {
      const session = await logoutFromApi();
      state.currentUser = session.user || state.settingsUsers?.[0] || state.currentUser;
      state.sessionAuthenticated = false;
      state.sessionPermissions = session.permissions || {};
      syncTopbarUser($, state);
      saveNavigationState();
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

export function setupTopbarControls({ $, state, switchView, saveNavigationState, showToast }) {
  syncTopbarUser($, state);
  syncTopbarNotifications($, state);

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
      await openLogoutOverlay({ $, state, saveNavigationState, showToast });
    });
  });

  $(".collapse-menu")?.addEventListener("click", () => toggleSidebar({ saveNavigationState, showToast }));
  $(".sidebar-restore")?.addEventListener("click", () => toggleSidebar({ saveNavigationState, showToast }));
}
