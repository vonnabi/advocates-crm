import { deleteSettingsUserFromApi, saveSettingsUserToApi, shouldUseApi } from "../api.js";
import { normalizeSettingsUser } from "../state.js";

const roleAccessMap = {
  "Адміністратор": "Повний доступ",
  "Адвокат": "Справи, клієнти, календар",
  "Помічник": "Задачі та документи",
  "Бухгалтер": "Фінанси та звіти"
};

const rolePermissionMap = {
  "Адміністратор": ["manage_users", "manage_clients", "manage_cases", "manage_tasks", "manage_documents", "manage_calendar", "view_finance", "manage_finance"],
  "Адвокат": ["manage_clients", "manage_cases", "manage_tasks", "manage_documents", "manage_calendar"],
  "Помічник": ["manage_tasks", "manage_documents", "manage_calendar"],
  "Бухгалтер": ["view_finance", "manage_finance"]
};

const permissionOptions = [
  ["manage_users", "Користувачі", "user"],
  ["manage_clients", "Клієнти", "user"],
  ["manage_cases", "Справи", "briefcase"],
  ["manage_tasks", "Задачі", "check"],
  ["manage_documents", "Документи", "file"],
  ["manage_calendar", "Календар", "calendar"],
  ["view_finance", "Фінанси", "briefcase"],
  ["manage_finance", "Операції", "edit"]
];

function cleanSettingValue(value) {
  return String(value || "").trim().replace(/[<>]/g, "");
}

function userInitials(name) {
  const initials = cleanSettingValue(name)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  return initials || "К";
}

function formatAuditTime() {
  return new Date().toLocaleString("uk-UA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function addSettingsAudit(state, text, tone = "blue") {
  state.settingsAudit = [
    { date: formatAuditTime(), text, tone },
    ...(state.settingsAudit || [])
  ].slice(0, 8);
}

function userPermissionKeys(user) {
  return user?.permissionKeys?.length ? user.permissionKeys : rolePermissionMap[user?.role] || rolePermissionMap["Помічник"];
}

function selectedCaseIds(user) {
  const direct = Array.isArray(user?.assignedCaseIds) ? user.assignedCaseIds : [];
  const nested = Array.isArray(user?.assignedCases) ? user.assignedCases.map((item) => item.id) : [];
  return new Set([...direct, ...nested].filter(Boolean));
}

function renderPermissionCheckboxes(icon, checkedKeys = []) {
  const checked = new Set(checkedKeys);
  return permissionOptions.map(([key, label, iconName]) => `
    <label class="settings-permission-tile">
      <input type="checkbox" name="permissionKeys" value="${key}" ${checked.has(key) ? "checked" : ""} />
      <span>${icon(iconName)}</span>
      <strong>${label}</strong>
    </label>
  `).join("");
}

function renderCaseCheckboxes(state, checkedIds = new Set()) {
  return (state.cases || []).map((caseItem) => `
    <label class="settings-case-choice">
      <input type="checkbox" name="assignedCaseIds" value="${caseItem.id}" ${checkedIds.has(caseItem.id) ? "checked" : ""} />
      <span>
        <strong>№${caseItem.id}</strong>
        <em>${caseItem.client || ""}</em>
      </span>
      <small>${caseItem.title || ""}</small>
    </label>
  `).join("");
}

function applyRoleDefaultsToForm(form, icon) {
  const role = form.elements.role.value;
  form.elements.access.value = roleAccessMap[role] || roleAccessMap["Помічник"];
  const keys = new Set(rolePermissionMap[role] || rolePermissionMap["Помічник"]);
  form.querySelector("[data-settings-permissions-grid]").innerHTML = renderPermissionCheckboxes(icon, keys);
}

function fillUserDialog(dialog, ctx, userIndex = "") {
  const { state, icon } = ctx;
  const form = dialog.querySelector("#settings-invite-form");
  const user = userIndex === "" ? null : state.settingsUsers[Number(userIndex)];
  form.dataset.userIndex = userIndex;
  dialog.querySelector("[data-settings-user-dialog-title]").textContent = user ? "Картка користувача" : "Створити користувача";
  dialog.querySelector("[data-settings-user-submit]").textContent = user ? "Зберегти користувача" : "Створити користувача";
  form.elements.name.value = user?.name || "";
  form.elements.email.value = user?.email || "";
  form.elements.password.value = user ? "" : "demo12345";
  form.elements.role.value = user?.role || "Адвокат";
  form.elements.access.value = user?.access || roleAccessMap[form.elements.role.value] || roleAccessMap["Помічник"];
  form.querySelector("[data-settings-permissions-grid]").innerHTML = renderPermissionCheckboxes(icon, userPermissionKeys(user || { role: form.elements.role.value }));
  form.querySelector("[data-settings-cases-grid]").innerHTML = renderCaseCheckboxes(state, selectedCaseIds(user));
  const isAdmin = form.elements.role.value === "Адміністратор";
  form.querySelector("[data-settings-case-scope]").textContent = isAdmin ? "Повний доступ до всіх справ" : "Доступ тільки до вибраних справ";
  form.querySelector("[data-settings-cases-grid]").toggleAttribute("hidden", isAdmin);
}

function ensureInviteDialog(ctx) {
  const { icon } = ctx;
  let dialog = document.querySelector("#settings-invite-dialog");
  if (dialog) return dialog;
  dialog = document.createElement("dialog");
  dialog.id = "settings-invite-dialog";
  dialog.innerHTML = `
    <form method="dialog" class="modal-form settings-invite-form settings-user-form" id="settings-invite-form">
      <div class="modal-head">
        <h2 data-settings-user-dialog-title>Створити користувача</h2>
        <button class="ghost" type="button" data-settings-invite-close>Закрити</button>
      </div>
      <div class="settings-user-form-grid">
        <label>Ім'я та прізвище<input name="name" required placeholder="Наприклад, Шевченко Марія Ігорівна"></label>
        <label>Email<input name="email" type="email" required placeholder="user@example.com"></label>
        <label>Пароль<input name="password" type="text" placeholder="Залишити без змін"></label>
        <label>Роль
          <select name="role">
            <option>Адвокат</option>
            <option>Помічник</option>
            <option>Бухгалтер</option>
            <option>Адміністратор</option>
          </select>
        </label>
      </div>
      <label>Доступ
        <select name="access">
          ${Object.values(roleAccessMap).map((access) => `<option>${access}</option>`).join("")}
        </select>
      </label>
      <section class="settings-user-editor-section">
        <div class="settings-user-editor-head">
          <strong>Меню CRM</strong>
          <button type="button" class="secondary compact" data-settings-role-defaults>${icon("refresh")} За роллю</button>
        </div>
        <div class="settings-permissions-grid" data-settings-permissions-grid></div>
      </section>
      <section class="settings-user-editor-section">
        <div class="settings-user-editor-head">
          <strong>Справи користувача</strong>
          <span data-settings-case-scope>Доступ тільки до вибраних справ</span>
        </div>
        <div class="settings-cases-grid" data-settings-cases-grid></div>
      </section>
      <button type="submit" class="primary" data-settings-user-submit>Створити користувача</button>
    </form>
  `;
  document.body.append(dialog);
  const form = dialog.querySelector("#settings-invite-form");
  form?.elements.role?.addEventListener("change", () => {
    applyRoleDefaultsToForm(form, icon);
    const isAdmin = form.elements.role.value === "Адміністратор";
    form.querySelector("[data-settings-case-scope]").textContent = isAdmin ? "Повний доступ до всіх справ" : "Доступ тільки до вибраних справ";
    form.querySelector("[data-settings-cases-grid]").toggleAttribute("hidden", isAdmin);
  });
  dialog.querySelector("[data-settings-role-defaults]")?.addEventListener("click", () => applyRoleDefaultsToForm(form, icon));
  dialog.querySelector("[data-settings-invite-close]")?.addEventListener("click", () => dialog.close());
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const { state, saveNavigationState, showToast } = ctx;
    const name = cleanSettingValue(form.elements.name.value);
    const email = cleanSettingValue(form.elements.email.value).toLowerCase();
    const role = cleanSettingValue(form.elements.role.value);
    const access = cleanSettingValue(form.elements.access.value) || roleAccessMap[role] || roleAccessMap["Помічник"];
    const password = cleanSettingValue(form.elements.password.value);
    const userIndex = form.dataset.userIndex;
    const existing = userIndex === "" ? null : state.settingsUsers[Number(userIndex)];
    const permissionKeys = [...form.querySelectorAll("input[name='permissionKeys']:checked")].map((input) => input.value);
    const assignedCaseIds = role === "Адміністратор" ? [] : [...form.querySelectorAll("input[name='assignedCaseIds']:checked")].map((input) => input.value);
    if (!name || !email) return;
    let user = {
      ...(existing || {}),
      name,
      email,
      role,
      access,
      photo: existing?.photo || userInitials(name),
      permissionKeys,
      assignedCaseIds
    };
    if (password) user.password = password;
    if (shouldUseApi(state)) {
      try {
        user = normalizeSettingsUser(await saveSettingsUserToApi(user));
      } catch (_error) {
        showToast("Не вдалося зберегти користувача в базі.", "danger");
        return;
      }
    }
    if (existing) {
      state.settingsUsers[Number(userIndex)] = normalizeSettingsUser(user);
      addSettingsAudit(state, `Оновлено картку користувача ${name}.`, "blue");
    } else {
      state.settingsUsers.push(normalizeSettingsUser(user));
      addSettingsAudit(state, `Запрошено користувача ${name} з роллю ${role}.`, "green");
    }
    form.reset();
    form.elements.access.value = roleAccessMap["Адвокат"];
    dialog.close();
    saveNavigationState();
    renderSettingsScreen(ctx);
    showToast(existing ? `Користувача ${name} оновлено.` : `Користувача ${name} створено.`);
  });
  return dialog;
}

export function renderSettingsScreen(ctx) {
  const { state, $, icon, badge, saveNavigationState, syncTopbarNotifications, showToast } = ctx;
  const users = state.settingsUsers;
  state.settingsOpenUserMenu ||= "";
  const integrations = [
    { key: "Telegram", iconName: "telegram", description: "Повідомлення клієнтам, тестові відправки, нагадування", modules: "Розсилка, календар" },
    { key: "SMS", iconName: "message", description: "Короткі сповіщення про події та дедлайни", modules: "Події, дедлайни" },
    { key: "Email", iconName: "mail", description: "Листи, шаблони та службові повідомлення", modules: "Документи, звіти" },
    { key: "AI", iconName: "search", description: "AI помічники, аналіз справ і чернетки документів", modules: "AI, OSINT, документи" }
  ];
  const activeIntegrations = integrations.filter((item) => state.settingsIntegrations[item.key]).length;
  const enabledNotifications = Object.values(state.settingsNotifications || {}).filter(Boolean).length;
  const activeUsers = users.filter((user) => user.role !== "Видалений").length;
  state.settingsFocusedSection ||= "profile";
  state.settingsAudit ||= [
    { date: "16.05.2024 09:30", text: "Синхронізовано канали Telegram та SMS.", tone: "green" },
    { date: "15.05.2024 18:10", text: "Оновлено профіль бюро для документів.", tone: "blue" },
    { date: "15.05.2024 12:40", text: "Перевірено правила сповіщень по дедлайнах.", tone: "amber" }
  ];

  $("#settings").innerHTML = `
    <div class="settings-screen">
      <section class="settings-summary-grid">
        <button class="panel settings-summary-card ${state.settingsFocusedSection === "users" ? "active" : ""}" type="button" data-settings-focus="users" aria-pressed="${state.settingsFocusedSection === "users"}">
          <span>${icon("user")}</span>
          <div><strong>${activeUsers}</strong><em>користувачів</em></div>
        </button>
        <button class="panel settings-summary-card ${state.settingsFocusedSection === "integrations" ? "active" : ""}" type="button" data-settings-focus="integrations" aria-pressed="${state.settingsFocusedSection === "integrations"}">
          <span>${icon("refresh")}</span>
          <div><strong>${activeIntegrations}/${integrations.length}</strong><em>інтеграцій активні</em></div>
        </button>
        <button class="panel settings-summary-card ${state.settingsFocusedSection === "notifications" ? "active" : ""}" type="button" data-settings-focus="notifications" aria-pressed="${state.settingsFocusedSection === "notifications"}">
          <span>${icon("bell")}</span>
          <div><strong>${enabledNotifications}</strong><em>типи сповіщень</em></div>
        </button>
        <button class="panel settings-summary-card ${state.settingsFocusedSection === "audit" ? "active" : ""}" type="button" data-settings-focus="audit" aria-pressed="${state.settingsFocusedSection === "audit"}">
          <span>${icon("check")}</span>
          <div><strong>Готово</strong><em>стан системи</em></div>
        </button>
      </section>

      <section class="panel settings-profile-card ${state.settingsFocusedSection === "profile" ? "is-focused" : ""}" data-settings-section="profile">
        <div class="settings-section-head">
          <div>
            <h2>Профіль бюро</h2>
            <p class="muted">Основні дані, які використовуються в документах, розсилках і профілі адміністратора.</p>
          </div>
          <button type="button" class="primary" data-save-settings>${icon("check")} Зберегти</button>
        </div>
        <div class="settings-form-grid">
          <label>Назва бюро<input data-bureau-field="name" value="${state.bureauSettings.name}" /></label>
          <label>Email<input data-bureau-field="email" value="${state.bureauSettings.email}" /></label>
          <label>Телефон<input data-bureau-field="phone" value="${state.bureauSettings.phone}" /></label>
          <label>Адреса<input data-bureau-field="address" value="${state.bureauSettings.address}" /></label>
        </div>
      </section>

      <section class="panel settings-users-card ${state.settingsFocusedSection === "users" ? "is-focused" : ""}" data-settings-section="users">
        <div class="settings-section-head">
          <div>
            <h2>Користувачі</h2>
            <p class="muted">Ролі команди та рівні доступу до CRM.</p>
          </div>
          <button type="button" class="secondary" data-settings-action="invite">+ Запросити</button>
        </div>
        <div class="settings-users-list">
          ${users.map((user, index) => `<article class="settings-user-row">
            <div class="avatar">${user.photo}</div>
            <div class="settings-user-main">
              <strong>${user.name}</strong>
              <span>${user.email || "email не вказано"}</span>
            </div>
            <div class="settings-user-access">
              <b>${user.role}</b>
              <em>${user.access}</em>
            </div>
            <div class="settings-user-scope">
              <span>${icon("briefcase")} ${user.caseScope === "all" ? "Всі справи" : `${user.assignedCasesCount || selectedCaseIds(user).size} справ`}</span>
              <small>${userPermissionKeys(user).length} доступів</small>
            </div>
            <div class="settings-user-actions">
              ${badge(user.role === "Адміністратор" ? "Owner" : "Active", user.role === "Адміністратор" ? "blue" : "green")}
              <div class="settings-user-menu-wrap">
                <button type="button" class="icon-button compact" data-settings-user-menu="${index}" aria-label="Дії користувача" aria-expanded="${state.settingsOpenUserMenu === String(index) ? "true" : "false"}">⋮</button>
                <div class="settings-user-menu" data-settings-user-menu-panel="${index}" ${state.settingsOpenUserMenu === String(index) ? "" : "hidden"}>
                  <button type="button" data-settings-user-edit="${index}">${icon("edit")} Картка доступу</button>
                  ${user.role === "Адміністратор" ? "" : `<button type="button" data-settings-user-role="${index}">${icon("edit")} Змінити роль</button>`}
                  <button type="button" data-settings-user-access="${index}">${icon("check")} Оновити доступ</button>
                  ${user.role === "Адміністратор" ? "" : `<button type="button" class="danger" data-settings-user-delete="${index}">${icon("trash")} Видалити</button>`}
                </div>
              </div>
            </div>
          </article>`).join("")}
        </div>
      </section>

      <section class="panel settings-integrations-card ${state.settingsFocusedSection === "integrations" ? "is-focused" : ""}" data-settings-section="integrations">
        <div class="settings-section-head">
          <div>
            <h2>Інтеграції</h2>
            <p class="muted">Канали, які беруть участь у повідомленнях, календарі та автоматизації.</p>
          </div>
        </div>
        <div class="settings-toggle-list">
          ${integrations.map((item) => `<article class="settings-integration-row">
            <span class="settings-integration-icon">${icon(item.iconName)}</span>
            <div class="settings-integration-copy">
              <strong>${item.key}</strong>
              <em>${item.description}</em>
              <small>Використовується: ${item.modules}</small>
            </div>
            <div class="settings-integration-control">
              ${badge(state.settingsIntegrations[item.key] ? "Підключено" : "Вимкнено", state.settingsIntegrations[item.key] ? "green" : "red")}
              <label class="settings-switch" aria-label="${item.key}">
                <input type="checkbox" data-settings-integration="${item.key}" ${state.settingsIntegrations[item.key] ? "checked" : ""} />
                <span></span>
              </label>
            </div>
          </article>`).join("")}
        </div>
      </section>

      <section class="panel settings-notifications-card ${state.settingsFocusedSection === "notifications" ? "is-focused" : ""}" data-settings-section="notifications">
        <div class="settings-section-head">
          <div>
            <h2>Сповіщення</h2>
            <p class="muted">Що показувати у верхньому дзвіночку та оперативних нагадуваннях.</p>
          </div>
        </div>
        <div class="settings-toggle-list compact">
          ${[
            ["deadlines", "Дедлайни та прострочені задачі"],
            ["court", "Судові засідання та події календаря"],
            ["mailings", "Статус розсилок та тестових відправок"]
          ].map(([key, label]) => `<label class="settings-toggle-row">
            <strong>${label}</strong>
            <input type="checkbox" data-settings-notification="${key}" ${state.settingsNotifications[key] ? "checked" : ""} />
          </label>`).join("")}
        </div>
      </section>

      <section class="panel settings-audit-card ${state.settingsFocusedSection === "audit" ? "is-focused" : ""}" data-settings-section="audit">
        <div class="settings-section-head">
          <div>
            <h2>Журнал змін</h2>
            <p class="muted">Останні системні дії по користувачах, інтеграціях і сповіщеннях.</p>
          </div>
          <button type="button" class="secondary" data-settings-clear-audit>${icon("trash")} Очистити</button>
        </div>
        <div class="settings-audit-list">
          ${state.settingsAudit.map((item) => `<article>
            ${badge(item.tone === "green" ? "OK" : item.tone === "red" ? "Увага" : "Info", item.tone)}
            <strong>${item.text}</strong>
            <span>${item.date}</span>
          </article>`).join("")}
        </div>
      </section>
    </div>
  `;

  document.querySelector("[data-save-settings]")?.addEventListener("click", () => {
    document.querySelectorAll("[data-bureau-field]").forEach((input) => {
      state.bureauSettings[input.dataset.bureauField] = input.value.trim();
    });
    addSettingsAudit(state, "Збережено основні дані профілю бюро.", "blue");
    saveNavigationState();
    renderSettingsScreen(ctx);
    showToast("Налаштування бюро збережено.");
  });
  document.querySelectorAll("[data-settings-focus]").forEach((button) => button.addEventListener("click", () => {
    state.settingsFocusedSection = button.dataset.settingsFocus;
    renderSettingsScreen(ctx);
    requestAnimationFrame(() => {
      document.querySelector(`[data-settings-section="${state.settingsFocusedSection}"]`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }));
  document.querySelector("[data-settings-action='invite']")?.addEventListener("click", () => {
    const dialog = ensureInviteDialog(ctx);
    const form = dialog.querySelector("#settings-invite-form");
    if (form) fillUserDialog(dialog, ctx);
    dialog.showModal();
    form?.elements.name?.focus();
  });
  document.querySelectorAll("[data-settings-user-menu]").forEach((button) => button.addEventListener("click", () => {
    const key = button.dataset.settingsUserMenu;
    state.settingsOpenUserMenu = state.settingsOpenUserMenu === key ? "" : key;
    renderSettingsScreen(ctx);
  }));
  document.querySelectorAll("[data-settings-user-edit]").forEach((button) => button.addEventListener("click", () => {
    const index = button.dataset.settingsUserEdit;
    const dialog = ensureInviteDialog(ctx);
    fillUserDialog(dialog, ctx, index);
    state.settingsOpenUserMenu = "";
    renderSettingsScreen(ctx);
    dialog.showModal();
  }));
  document.querySelectorAll("[data-settings-user-access]").forEach((button) => button.addEventListener("click", async () => {
    const user = state.settingsUsers[Number(button.dataset.settingsUserAccess)];
    if (!user) return;
    user.access = roleAccessMap[user.role] || user.access;
    user.permissionKeys = rolePermissionMap[user.role] || user.permissionKeys;
    if (shouldUseApi(state)) {
      try {
        Object.assign(user, normalizeSettingsUser(await saveSettingsUserToApi(user)));
      } catch (_error) {
        showToast("Не вдалося оновити доступ у базі.", "danger");
        return;
      }
    }
    state.settingsOpenUserMenu = "";
    addSettingsAudit(state, `Оновлено доступ користувача ${user.name}: ${user.access}.`, "blue");
    saveNavigationState();
    renderSettingsScreen(ctx);
    showToast(`Доступ користувача ${user.name} оновлено.`);
  }));
  document.querySelectorAll("[data-settings-user-role]").forEach((button) => button.addEventListener("click", async () => {
    const user = state.settingsUsers[Number(button.dataset.settingsUserRole)];
    if (!user || user.role === "Адміністратор") return;
    user.role = user.role === "Адвокат" ? "Помічник" : "Адвокат";
    user.access = user.role === "Адвокат" ? "Справи, клієнти, календар" : "Задачі та документи";
    user.permissionKeys = rolePermissionMap[user.role] || user.permissionKeys;
    if (shouldUseApi(state)) {
      try {
        Object.assign(user, normalizeSettingsUser(await saveSettingsUserToApi(user)));
      } catch (_error) {
        showToast("Не вдалося змінити роль у базі.", "danger");
        return;
      }
    }
    state.settingsOpenUserMenu = "";
    addSettingsAudit(state, `Змінено роль користувача ${user.name}: ${user.role}.`, "amber");
    saveNavigationState();
    renderSettingsScreen(ctx);
    showToast(`Роль користувача змінено: ${user.role}.`);
  }));
  document.querySelectorAll("[data-settings-user-delete]").forEach((button) => button.addEventListener("click", async () => {
    const index = Number(button.dataset.settingsUserDelete);
    const removed = state.settingsUsers[index];
    if (!removed) return;
    if (shouldUseApi(state) && removed.id) {
      try {
        await deleteSettingsUserFromApi(removed.id);
      } catch (_error) {
        showToast("Не вдалося видалити користувача з бази.", "danger");
        return;
      }
    }
    state.settingsUsers.splice(index, 1);
    state.settingsOpenUserMenu = "";
    addSettingsAudit(state, `Видалено користувача ${removed.name}.`, "red");
    saveNavigationState();
    renderSettingsScreen(ctx);
    showToast(`Користувача ${removed.name} видалено.`, "danger");
  }));
  document.querySelectorAll("[data-settings-integration]").forEach((input) => input.addEventListener("change", () => {
    const key = input.dataset.settingsIntegration;
    state.settingsIntegrations[key] = input.checked;
    addSettingsAudit(state, `${key}: ${input.checked ? "інтеграцію увімкнено" : "інтеграцію вимкнено"}.`, input.checked ? "green" : "amber");
    saveNavigationState();
    renderSettingsScreen(ctx);
    showToast(`${key}: ${input.checked ? "увімкнено" : "вимкнено"}.`, input.checked ? "success" : "warning");
  }));
  document.querySelectorAll("[data-settings-notification]").forEach((input) => input.addEventListener("change", () => {
    const key = input.dataset.settingsNotification;
    state.settingsNotifications[key] = input.checked;
    if (input.checked) {
      state.notificationReadKeys = (state.notificationReadKeys || []).filter((item) => item !== key);
    }
    addSettingsAudit(state, `Сповіщення «${key}» ${input.checked ? "увімкнено" : "вимкнено"}.`, input.checked ? "green" : "amber");
    syncTopbarNotifications?.();
    saveNavigationState();
    renderSettingsScreen(ctx);
    showToast(input.checked ? "Сповіщення увімкнено." : "Сповіщення вимкнено.", input.checked ? "success" : "warning");
  }));
  document.querySelector("[data-settings-clear-audit]")?.addEventListener("click", () => {
    state.settingsAudit = [{ date: formatAuditTime(), text: "Журнал змін очищено адміністратором.", tone: "blue" }];
    saveNavigationState();
    renderSettingsScreen(ctx);
    showToast("Журнал змін очищено.");
  });
}
