import { deleteSettingsUserFromApi, saveSettingsUserToApi, shouldUseApi } from "../api.js";
import { navIconName } from "../ui.js?v=settings-icons-1";
import { normalizeSettingsUser } from "../state.js";

const roleAccessMap = {
  "Адміністратор": "Повний доступ",
  "Адвокат": "Справи, клієнти, календар",
  "Помічник": "Задачі та документи",
  "Бухгалтер": "Фінанси та звіти"
};

const permissionOptions = [
  { key: "", label: "Дашборд", icon: navIconName("dashboard"), note: "базовий огляд", locked: true },
  { key: "manage_cases", label: "Справи", icon: navIconName("cases"), note: "список і картки справ" },
  { key: "manage_clients", label: "Клієнти", icon: navIconName("clients"), note: "клієнтська база" },
  { key: "manage_calendar", label: "Календар", icon: navIconName("calendar"), note: "події та дедлайни" },
  { key: "manage_tasks", label: "Задачі", icon: navIconName("tasks"), note: "задачі і підзадачі" },
  { key: "manage_documents", label: "Документи", icon: navIconName("documents"), note: "архів і файли" },
  { key: "manage_mailings", label: "Розсилка", icon: navIconName("mailings"), note: "кампанії і шаблони" },
  { key: "manage_ai", label: "AI помічники", icon: navIconName("ai"), note: "чати і навчання" },
  { key: "view_planner", label: "Планер", icon: navIconName("planner"), note: "план дня" },
  { key: "view_analytics", label: "Аналітика", icon: navIconName("analytics"), note: "звіти і метрики" },
  { key: "view_finance", label: "Фінанси", icon: navIconName("finance"), note: "перегляд фінансів" },
  { key: "manage_finance", label: "Платежі та зарплата", icon: "wallet", note: "операції у фінансах" },
  { key: "view_osint", label: "OSINT", icon: navIconName("osint"), note: "перевірки ризиків" },
  { key: "manage_users", label: "Налаштування", icon: navIconName("settings"), note: "користувачі і доступ" }
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

function cleanAttribute(value) {
  return cleanSettingValue(value).replace(/["'`]/g, "");
}

function isNeutralDemoAdminState(state) {
  return shouldUseApi(state) && !state.sessionAuthenticated && state.demoDataStatus?.enabled === false;
}

function displaySettingsUser(user, state) {
  if (!isNeutralDemoAdminState(state) || user?.role !== "Адміністратор") return user;
  return {
    ...user,
    name: "Admin",
    photo: "AD",
    email: "admin@advocates.ua"
  };
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

function generateTemporaryPassword() {
  return `crm${Math.random().toString(36).slice(2, 8)}${Math.floor(10 + Math.random() * 89)}`;
}

function accessStatusMeta(user) {
  const label = user.accessStatus || (user.passwordTemporary ? "Пароль тимчасовий" : "Активний");
  if (user.passwordTemporary || label === "Пароль тимчасовий") return { label: "Тимчасовий пароль", tone: "amber" };
  if (label === "Запрошено") return { label: "Запрошено", tone: "blue" };
  return { label: "Активний", tone: "green" };
}

function renderAccessStatus(user, icon) {
  const status = accessStatusMeta(user);
  const iconName = status.tone === "amber" ? "clock" : status.tone === "blue" ? "mail" : "check";
  return `<span class="settings-access-status ${status.tone}" data-tooltip="${status.label}" tabindex="0" role="img" aria-label="${status.label}">${icon(iconName)}</span>`;
}

function crmAccessUrl() {
  return `${window.location.origin}/`;
}

function buildAccessMessage(user, password, channel = "email") {
  const greeting = channel === "telegram" ? "Вітаю!" : `Вітаю, ${user.name || "колего"}!`;
  return [
    greeting,
    "",
    "Для вас створено доступ до Advocates Bureau CRM.",
    `Посилання: ${crmAccessUrl()}`,
    `Логін: ${user.email || "email не вказано"}`,
    `Тимчасовий пароль: ${password}`,
    "",
    "Після першого входу система попросить змінити пароль."
  ].join("\n");
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "-999px";
  document.body.append(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function userPermissionKeys(user) {
  if (Array.isArray(user?.permissionKeys) && user.permissionKeys.length) return user.permissionKeys;
  if (user?.access && accessPermissionMap[user.access]?.length) return accessPermissionMap[user.access];
  return rolePermissionMap[user?.role] || rolePermissionMap["Помічник"];
}

function formatUserDate(value) {
  if (!value) return "ще не входив";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "ще не входив";
  return date.toLocaleDateString("uk-UA", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function permissionLabel(key) {
  return permissionOptions.find((item) => item.key === key)?.label || key;
}

function permissionTone(key) {
  if (key.includes("finance") || key === "manage_mailings") return "green";
  if (key.includes("analytics") || key.includes("osint") || key === "manage_ai") return "violet";
  if (key.includes("tasks") || key.includes("calendar") || key === "view_planner") return "amber";
  if (key === "manage_users") return "red";
  return "blue";
}

function renderPermissionSummary(user, icon) {
  const keys = userPermissionKeys(user);
  const visible = keys.slice(0, 6);
  const rest = Math.max(0, keys.length - visible.length);
  if (!keys.length) {
    return `<span class="settings-user-permission-icon muted-chip" data-tooltip="Базовий доступ" tabindex="0" role="img" aria-label="Базовий доступ">${icon("home")}</span>`;
  }
  return [
    ...visible.map((key) => {
      const option = permissionOptions.find((item) => item.key === key);
      const label = permissionLabel(key);
      return `<span class="settings-user-permission-icon ${permissionTone(key)}" data-tooltip="${label}" tabindex="0" role="img" aria-label="${label}">${icon(option?.icon || "check")}</span>`;
    }),
    rest ? `<span class="settings-user-permission-icon more-chip" data-tooltip="Ще ${rest} модулів доступу" tabindex="0" role="img" aria-label="Ще ${rest} модулів доступу">${icon("filter")}</span>` : ""
  ].join("");
}

function renderUserAvatar(user) {
  const photo = cleanAttribute(user?.photo || "");
  const name = cleanSettingValue(user?.name || "");
  if (/^(https?:\/\/|\/|assets\/)/i.test(photo)) {
    return `<div class="avatar settings-user-avatar has-photo"><img src="${photo}" alt="${name || "Користувач"}" /></div>`;
  }
  return `<div class="avatar settings-user-avatar">${photo || userInitials(name)}</div>`;
}

function userCaseSummary(user) {
  if (user.caseScope === "all") return "усі справи";
  const count = user.assignedCasesCount || selectedCaseIds(user).size;
  if (!count) return "справи не вибрані";
  return `${count} ${count === 1 ? "справа" : count < 5 ? "справи" : "справ"}`;
}

function renderCasePreview(user) {
  if (user.caseScope === "all") return "Повний доступ до всіх справ бюро";
  const cases = Array.isArray(user.assignedCases) ? user.assignedCases.slice(0, 2) : [];
  if (!cases.length) return "Доступ до справ ще не налаштовано";
  return cases.map((caseItem) => `№${caseItem.id} · ${caseItem.client || caseItem.title || "справа"}`).join(" / ");
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
  form.elements.photo.value = user?.photo || userInitials(user?.name || "");
  form.elements.password.value = user ? "" : "demo12345";
  form.elements.passwordTemporary.checked = user ? Boolean(user.passwordTemporary || user.mustChangePassword) : true;
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

function fillAccessDeliveryDialog(dialog, ctx, userIndex) {
  const user = ctx.state.settingsUsers[Number(userIndex)];
  const password = generateTemporaryPassword();
  const form = dialog.querySelector("#settings-access-delivery-form");
  form.dataset.userIndex = userIndex;
  form.dataset.channel = "email";
  form.elements.password.value = password;
  dialog.querySelector("[data-settings-delivery-user]").textContent = user?.name || "Користувач";
  dialog.querySelector("[data-settings-delivery-email]").textContent = user?.email || "email не вказано";
  dialog.querySelector("[data-settings-delivery-message]").value = buildAccessMessage(user || {}, password, "email");
  dialog.querySelectorAll("[data-settings-access-channel]").forEach((button) => {
    button.classList.toggle("active", button.dataset.settingsAccessChannel === "email");
  });
}

function refreshAccessDeliveryMessage(dialog, ctx) {
  const form = dialog.querySelector("#settings-access-delivery-form");
  const user = ctx.state.settingsUsers[Number(form.dataset.userIndex)];
  const password = cleanSettingValue(form.elements.password.value) || generateTemporaryPassword();
  form.elements.password.value = password;
  const channel = form.dataset.channel || "email";
  dialog.querySelector("[data-settings-delivery-message]").value = buildAccessMessage(user || {}, password, channel);
}

async function persistAccessDelivery(dialog, ctx) {
  const form = dialog.querySelector("#settings-access-delivery-form");
  const index = Number(form.dataset.userIndex);
  const user = ctx.state.settingsUsers[index];
  const password = cleanSettingValue(form.elements.password.value);
  if (!user || !password) return null;
  let updatedUser = { ...user, password, passwordTemporary: true };
  if (shouldUseApi(ctx.state)) {
    updatedUser = normalizeSettingsUser(await saveSettingsUserToApi(updatedUser));
  } else {
    updatedUser.password = password;
  }
  ctx.state.settingsUsers[index] = normalizeSettingsUser(updatedUser);
  return ctx.state.settingsUsers[index];
}

function ensureAccessDeliveryDialog(ctx) {
  const { icon } = ctx;
  let dialog = document.querySelector("#settings-access-delivery-dialog");
  if (dialog) return dialog;
  dialog = document.createElement("dialog");
  dialog.id = "settings-access-delivery-dialog";
  dialog.innerHTML = `
    <form method="dialog" class="modal-form settings-access-delivery-form" id="settings-access-delivery-form">
      <div class="modal-head">
        <div>
          <h2>Надіслати доступ</h2>
          <p class="muted">Підготуйте повідомлення з логіном, тимчасовим паролем і посиланням на CRM.</p>
        </div>
        <button class="ghost" type="button" data-settings-delivery-close>Закрити</button>
      </div>
      <section class="settings-delivery-user-card">
        <span>${icon("mail")}</span>
        <div>
          <strong data-settings-delivery-user></strong>
          <em data-settings-delivery-email></em>
        </div>
      </section>
      <div class="settings-delivery-channels" role="group" aria-label="Канал повідомлення">
        <button type="button" class="active" data-settings-access-channel="email">${icon("mail")} Email</button>
        <button type="button" data-settings-access-channel="telegram">${icon("telegram")} Telegram</button>
        <button type="button" data-settings-access-channel="sms">${icon("message")} SMS</button>
      </div>
      <label>Тимчасовий пароль
        <input name="password" type="text" data-settings-delivery-password>
      </label>
      <label>Повідомлення
        <textarea readonly rows="9" data-settings-delivery-message></textarea>
      </label>
      <div class="settings-delivery-actions">
        <button type="button" class="secondary" data-settings-delivery-refresh>${icon("refresh")} Новий пароль</button>
        <button type="button" class="primary" data-settings-delivery-copy>${icon("check")} Оновити пароль і скопіювати</button>
      </div>
    </form>
  `;
  document.body.append(dialog);
  const form = dialog.querySelector("#settings-access-delivery-form");
  dialog.querySelector("[data-settings-delivery-close]")?.addEventListener("click", () => dialog.close());
  dialog.querySelectorAll("[data-settings-access-channel]").forEach((button) => button.addEventListener("click", () => {
    form.dataset.channel = button.dataset.settingsAccessChannel;
    dialog.querySelectorAll("[data-settings-access-channel]").forEach((node) => node.classList.toggle("active", node === button));
    refreshAccessDeliveryMessage(dialog, ctx);
  }));
  form.elements.password?.addEventListener("input", () => refreshAccessDeliveryMessage(dialog, ctx));
  dialog.querySelector("[data-settings-delivery-refresh]")?.addEventListener("click", () => {
    form.elements.password.value = generateTemporaryPassword();
    refreshAccessDeliveryMessage(dialog, ctx);
  });
  dialog.querySelector("[data-settings-delivery-copy]")?.addEventListener("click", async () => {
    const button = dialog.querySelector("[data-settings-delivery-copy]");
    button.disabled = true;
    try {
      const user = await persistAccessDelivery(dialog, ctx);
      refreshAccessDeliveryMessage(dialog, ctx);
      await copyTextToClipboard(dialog.querySelector("[data-settings-delivery-message]").value);
      addSettingsAudit(ctx.state, `Підготовлено доступ для ${user?.name || "користувача"}.`, "green");
      ctx.state.settingsOpenUserMenu = "";
      ctx.saveNavigationState();
      renderSettingsScreen(ctx);
      ctx.showToast("Доступ скопійовано. Тимчасовий пароль оновлено.");
    } catch (_error) {
      ctx.showToast("Не вдалося підготувати доступ.", "danger");
    } finally {
      button.disabled = false;
    }
  });
  return dialog;
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
        <label>Аватар / фото<input name="photo" placeholder="Ініціали або URL фото"></label>
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
      <label class="checkline settings-password-temporary">
        <input name="passwordTemporary" type="checkbox">
        <span>Вимагати зміну пароля при вході</span>
      </label>
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
    const photo = cleanSettingValue(form.elements.photo.value);
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
      photo: photo || existing?.photo || userInitials(name),
      permissionKeys,
      assignedCaseIds
    };
    user.passwordTemporary = Boolean(form.elements.passwordTemporary?.checked);
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
          ${users.map((user, index) => {
            const viewUser = displaySettingsUser(user, state);
            return `<article class="settings-user-row">
            <div class="settings-user-identity">
              ${renderUserAvatar(viewUser)}
              <div class="settings-user-main">
                <strong>${viewUser.name}</strong>
                <span>${viewUser.email || "email не вказано"}</span>
                <em>${viewUser.role}</em>
              </div>
            </div>
            <div class="settings-user-details">
              <div class="settings-user-data-grid">
                <span>
                  <small>Доступ</small>
                  <b>${viewUser.access}</b>
                </span>
                <span>
                  <small>Справи</small>
                  <b>${userCaseSummary(viewUser)}</b>
                </span>
                <span>
                  <small>Останній вхід</small>
                  <b>${formatUserDate(viewUser.lastLoginAt)}</b>
                </span>
              </div>
              <div class="settings-user-case-preview">${renderCasePreview(viewUser)}</div>
              <div class="settings-user-permissions">${renderPermissionSummary(viewUser, icon)}</div>
            </div>
            <div class="settings-user-actions">
              ${renderAccessStatus(viewUser, icon)}
              <div class="settings-user-menu-wrap">
                <button type="button" class="icon-button compact" data-settings-user-menu="${index}" aria-label="Дії користувача" aria-expanded="${state.settingsOpenUserMenu === String(index) ? "true" : "false"}">⋮</button>
                <div class="settings-user-menu" data-settings-user-menu-panel="${index}" ${state.settingsOpenUserMenu === String(index) ? "" : "hidden"}>
                  <button type="button" data-settings-user-edit="${index}">${icon("edit")} Картка доступу</button>
                  <button type="button" data-settings-user-delivery="${index}">${icon("mail")} Надіслати доступ</button>
                  ${user.role === "Адміністратор" ? "" : `<button type="button" class="danger" data-settings-user-delete="${index}">${icon("trash")} Видалити</button>`}
                </div>
              </div>
            </div>
          </article>`;
          }).join("")}
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
  document.querySelectorAll("[data-settings-user-delivery]").forEach((button) => button.addEventListener("click", () => {
    const index = button.dataset.settingsUserDelivery;
    const dialog = ensureAccessDeliveryDialog(ctx);
    fillAccessDeliveryDialog(dialog, ctx, index);
    state.settingsOpenUserMenu = "";
    renderSettingsScreen(ctx);
    dialog.showModal();
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
