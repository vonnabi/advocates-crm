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

function markNotificationRead($) {
  const badge = $("#notifications-count");
  if (!badge) return;
  const nextCount = Math.max(Number(badge.textContent) - 1, 0);
  badge.textContent = String(nextCount);
  badge.classList.toggle("empty", nextCount === 0);
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

function ensureLogoutOverlay() {
  let overlay = document.querySelector("#logout-overlay");
  if (overlay) return overlay;
  overlay = document.createElement("div");
  overlay.id = "logout-overlay";
  overlay.className = "logout-overlay";
  overlay.hidden = true;
  overlay.innerHTML = `
    <section class="logout-card" role="dialog" aria-modal="true" aria-labelledby="logout-title">
      <div class="logout-mark">AB</div>
      <h2 id="logout-title">Сеанс завершено</h2>
      <p>Ви вийшли з демо-кабінету Advocates Bureau. Для прототипу можна одразу повернутися назад.</p>
      <button class="primary" type="button" data-login-return>Повернутися в демо</button>
    </section>
  `;
  document.body.append(overlay);
  overlay.querySelector("[data-login-return]")?.addEventListener("click", () => {
    overlay.hidden = true;
    document.body.classList.remove("session-ended");
  });
  return overlay;
}

function openLogoutOverlay() {
  const overlay = ensureLogoutOverlay();
  document.body.classList.add("session-ended");
  overlay.hidden = false;
  overlay.querySelector("[data-login-return]")?.focus();
}

async function copyDemoLink(showToast) {
  try {
    await navigator.clipboard.writeText(DEMO_URL);
    showToast("Ссылка для заказчика скопирована.");
  } catch (error) {
    window.prompt("Скопируйте ссылку для заказчика:", DEMO_URL);
  }
}

export function setupTopbarControls({ $, switchView, saveNavigationState, showToast }) {
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
      markNotificationRead($);
      closeTopbarPanels($);
      switchView(button.dataset.notificationView);
      showToast("Відкрито розділ зі сповіщення.");
    });
  });

  $("[data-clear-notifications]")?.addEventListener("click", () => {
    const badge = $("#notifications-count");
    if (badge) {
      badge.textContent = "0";
      badge.classList.add("empty");
    }
    closeTopbarPanels($);
    showToast("Сповіщення позначено як прочитані.");
  });

  document.querySelectorAll("[data-profile-action]").forEach((button) => {
    button.addEventListener("click", () => {
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
      openLogoutOverlay();
    });
  });

  $(".collapse-menu")?.addEventListener("click", () => toggleSidebar({ saveNavigationState, showToast }));
  $(".sidebar-restore")?.addEventListener("click", () => toggleSidebar({ saveNavigationState, showToast }));
}
