import { deleteSettingsUserFromApi, saveSettingsUserToApi, shouldUseApi } from "../api.js";
import { normalizeSettingsUser } from "../state.js";

const roleAccessMap = {
  "Адміністратор": "Повний доступ",
  "Адвокат": "Справи, клієнти, календар",
  "Помічник": "Задачі та документи",
  "Бухгалтер": "Фінанси та звіти"
};

const permissionOptions = [
  { key: "", label: "Дашборд", icon: "home", note: "базовий огляд", locked: true },
  { key: "manage_cases", label: "Справи", icon: "briefcase", note: "список і картки справ" },
  { key: "manage_clients", label: "Клієнти", icon: "user", note: "клієнтська база" },
  { key: "manage_calendar", label: "Календар", icon: "calendar", note: "події та дедлайни" },
  { key: "manage_tasks", label: "Задачі", icon: "check", note: "задачі і підзадачі" },
  { key: "manage_documents", label: "Документи", icon: "file", note: "архів і файли" },
  { key: "manage_mailings", label: "Розсилка", icon: "telegram", note: "кампанії і шаблони" },
  { key: "manage_ai", label: "AI помічники", icon: "bot", note: "чати і навчання" },
  { key: "view_planner", label: "Планер", icon: "planner", note: "план дня" },
  { key: "view_analytics", label: "Аналітика", icon: "chart", note: "звіти і метрики" },
  { key: "view_finance", label: "Фінанси", icon: "dollar", note: "перегляд фінансів" },
  { key: "manage_finance", label: "Платежі та зарплата", icon: "wallet", note: "операції у фінансах" },
  { key: "view_osint", label: "OSINT", icon: "search", note: "перевірки ризиків" },
  { key: "manage_users", label: "Налаштування", icon: "gear", note: "користувачі і доступ" }
];

const allPermissionKeys = permissionOptions.map((item) => item.key).filter(Boolean);

const accessPermissionMap = {
  "Повний доступ": allPermissionKeys,
  "Справи, клієнти, календар": ["manage_cases", "manage_clients", "manage_calendar"],
  "Задачі та документи": ["manage_tasks", "manage_documents", "manage_calendar", "view_planner", "manage_ai"],
  "Фінанси та звіти": ["view_finance", "manage_finance", "view_analytics"],
  "Індивідуальний доступ": []
};

const rolePermissionMap = Object.fromEntries(
  Object.entries(roleAccessMap).map(([role, access]) => [role, accessPermissionMap[access] || []])
);

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
  if (Array.isArray(user?.permissionKeys) && user.permissionKeys.length) return user.permissionKeys;
  if (user?.access && accessPermissionMap[user.access]?.length) return accessPermissionMap[user.access];
  return rolePermissionMap[user?.role] || rolePermissionMap["Помічник"];
}

function selectedCaseIds(user) {
  const direct = Array.isArray(user?.assignedCaseIds) ? user.assignedCaseIds : [];
  const nested = Array.isArray(user?.assignedCases) ? user.assignedCases.map((item) => item.id) : [];
  return new Set([...direct, ...nested].filter(Boolean));
}

function readStoredCaseIds(form) {
  try {
    return new Set(JSON.parse(form.dataset.selectedCaseIds || "[]").filter(Boolean));
  } catch (_error) {
    return new Set();
  }
}

function writeStoredCaseIds(form, selectedIds) {
  form.dataset.selectedCaseIds = JSON.stringify([...selectedIds]);
}

function syncStoredCaseIdsFromForm(form) {
  const selectedIds = readStoredCaseIds(form);
  form.querySelectorAll("input[name='assignedCaseIds']").forEach((input) => {
    if (input.checked) selectedIds.add(input.value);
    else selectedIds.delete(input.value);
  });
  writeStoredCaseIds(form, selectedIds);
  return selectedIds;
}

function caseClientOptions(state) {
  return [...new Set((state.cases || []).map((caseItem) => caseItem.client).filter(Boolean))].sort((a, b) => a.localeCompare(b, "uk"));
}

function filteredCases(state, search = "", client = "") {
  const query = cleanSettingValue(search).toLowerCase();
  return (state.cases || []).filter((caseItem) => {
    const matchesClient = !client || caseItem.client === client;
    const haystack = [caseItem.id, caseItem.client, caseItem.title, caseItem.stage].join(" ").toLowerCase();
    return matchesClient && (!query || haystack.includes(query));
  });
}

function renderPermissionCheckboxes(icon, checkedKeys = []) {
  const checked = new Set(checkedKeys);
  return permissionOptions.map((item) => `
    <label class="settings-permission-tile ${item.locked ? "is-locked" : ""}">
      ${item.locked
        ? `<input type="checkbox" checked disabled aria-label="${item.label}" />`
        : `<input type="checkbox" name="permissionKeys" value="${item.key}" ${checked.has(item.key) ? "checked" : ""} />`}
      <span class="settings-permission-icon">${icon(item.icon)}</span>
      <strong>${item.label}</strong>
      <small>${item.note}</small>
    </label>
  `).join("");
}

function renderCaseCheckboxes(cases, checkedIds = new Set()) {
  if (!cases.length) {
    return `<div class="settings-case-empty">Нічого не знайдено за цими фільтрами.</div>`;
  }
  return cases.map((caseItem) => `
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

function refreshCaseGrid(form, state) {
  const selectedIds = syncStoredCaseIdsFromForm(form);
  const search = form.elements.caseSearch?.value || "";
  const client = form.elements.caseClient?.value || "";
  const matches = filteredCases(state, search, client);
  form.querySelector("[data-settings-cases-grid]").innerHTML = renderCaseCheckboxes(matches, selectedIds);
  const meta = form.querySelector("[data-settings-case-filter-meta]");
  if (meta) {
    const total = state.cases?.length || 0;
    meta.textContent = `${matches.length} з ${total} справ · вибрано ${selectedIds.size}`;
  }
}

function syncCaseScope(form) {
  const isAdmin = form.elements.role.value === "Адміністратор";
  form.querySelector("[data-settings-case-scope]").textContent = isAdmin ? "Повний доступ до всіх справ" : "Доступ тільки до вибраних справ";
  form.querySelector("[data-settings-cases-controls]").toggleAttribute("hidden", isAdmin);
  form.querySelector("[data-settings-cases-grid]").toggleAttribute("hidden", isAdmin);
}

function applyRoleDefaultsToForm(form, icon) {
  const role = form.elements.role.value;
  form.elements.access.value = roleAccessMap[role] || roleAccessMap["Помічник"];
  form.querySelector("[data-settings-permissions-grid]").innerHTML = renderPermissionCheckboxes(icon, rolePermissionMap[role] || rolePermissionMap["Помічник"]);
}

function applyAccessPresetToForm(form, icon) {
  const access = form.elements.access.value;
  if (access === "Індивідуальний доступ") return;
  form.querySelector("[data-settings-permissions-grid]").innerHTML = renderPermissionCheckboxes(icon, accessPermissionMap[access] || []);
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
  form.elements.caseSearch.value = "";
  form.elements.caseClient.value = "";
  writeStoredCaseIds(form, selectedCaseIds(user));
  form.querySelector("[data-settings-cases-grid]").innerHTML = "";
  refreshCaseGrid(form, state);
  syncCaseScope(form);
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
          ${Object.keys(accessPermissionMap).map((access) => `<option>${access}</option>`).join("")}
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
        <div class="settings-cases-controls" data-settings-cases-controls>
          <label>Пошук справи
            <input name="caseSearch" type="search" placeholder="Клієнт, номер або назва справи" data-settings-case-search>
          </label>
          <label>Клієнт
            <select name="caseClient" data-settings-case-client>
              <option value="">Всі клієнти</option>
              ${caseClientOptions(ctx.state).map((client) => `<option value="${client}">${client}</option>`).join("")}
            </select>
          </label>
          <small data-settings-case-filter-meta></small>
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
    syncCaseScope(form);
  });
  form?.elements.access?.addEventListener("change", () => applyAccessPresetToForm(form, icon));
  form?.addEventListener("change", (event) => {
    if (event.target?.name === "permissionKeys") {
      form.elements.access.value = "Індивідуальний доступ";
    }
    if (event.target?.name === "assignedCaseIds") {
      syncStoredCaseIdsFromForm(form);
      const meta = form.querySelector("[data-settings-case-filter-meta]");
      if (meta) {
        const total = ctx.state.cases?.length || 0;
        const visible = filteredCases(ctx.state, form.elements.caseSearch?.value || "", form.elements.caseClient?.value || "").length;
        meta.textContent = `${visible} з ${total} справ · вибрано ${readStoredCaseIds(form).size}`;
      }
    }
  });
  form?.elements.caseSearch?.addEventListener("input", () => refreshCaseGrid(form, ctx.state));
  form?.elements.caseClient?.addEventListener("change", () => refreshCaseGrid(form, ctx.state));
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
    const assignedCaseIds = role === "Адміністратор" ? [] : [...syncStoredCaseIdsFromForm(form)];
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
