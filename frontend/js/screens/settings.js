const roleAccessMap = {
  "Адвокат": "Справи, клієнти, календар",
  "Помічник": "Задачі та документи",
  "Бухгалтер": "Фінанси та звіти"
};

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

function ensureInviteDialog(ctx) {
  let dialog = document.querySelector("#settings-invite-dialog");
  if (dialog) return dialog;
  dialog = document.createElement("dialog");
  dialog.id = "settings-invite-dialog";
  dialog.innerHTML = `
    <form method="dialog" class="modal-form settings-invite-form" id="settings-invite-form">
      <div class="modal-head">
        <h2>Запросити користувача</h2>
        <button class="ghost" type="button" data-settings-invite-close>Закрити</button>
      </div>
      <label>Ім'я та прізвище<input name="name" required placeholder="Наприклад, Шевченко Марія Ігорівна"></label>
      <label>Email<input name="email" type="email" required placeholder="user@example.com"></label>
      <label>Роль
        <select name="role">
          <option>Адвокат</option>
          <option>Помічник</option>
          <option>Бухгалтер</option>
        </select>
      </label>
      <label>Доступ
        <select name="access">
          ${Object.values(roleAccessMap).map((access) => `<option>${access}</option>`).join("")}
        </select>
      </label>
      <button type="submit" class="primary">Надіслати запрошення</button>
    </form>
  `;
  document.body.append(dialog);
  const form = dialog.querySelector("#settings-invite-form");
  form?.elements.role?.addEventListener("change", () => {
    form.elements.access.value = roleAccessMap[form.elements.role.value] || roleAccessMap["Помічник"];
  });
  dialog.querySelector("[data-settings-invite-close]")?.addEventListener("click", () => dialog.close());
  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    const { state, saveNavigationState, showToast } = ctx;
    const name = cleanSettingValue(form.elements.name.value);
    const email = cleanSettingValue(form.elements.email.value).toLowerCase();
    const role = cleanSettingValue(form.elements.role.value);
    const access = cleanSettingValue(form.elements.access.value) || roleAccessMap[role] || roleAccessMap["Помічник"];
    if (!name || !email) return;
    state.settingsUsers.push({
      name,
      email,
      role,
      access,
      photo: userInitials(name)
    });
    addSettingsAudit(state, `Запрошено користувача ${name} з роллю ${role}.`, "green");
    form.reset();
    form.elements.access.value = roleAccessMap["Адвокат"];
    dialog.close();
    saveNavigationState();
    renderSettingsScreen(ctx);
    showToast(`Запрошення для ${name} підготовлено.`);
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
  state.settingsAudit ||= [
    { date: "16.05.2024 09:30", text: "Синхронізовано канали Telegram та SMS.", tone: "green" },
    { date: "15.05.2024 18:10", text: "Оновлено профіль бюро для документів.", tone: "blue" },
    { date: "15.05.2024 12:40", text: "Перевірено правила сповіщень по дедлайнах.", tone: "amber" }
  ];

  $("#settings").innerHTML = `
    <div class="settings-screen">
      <section class="settings-summary-grid">
        <article class="panel settings-summary-card">
          <span>${icon("user")}</span>
          <div><strong>${activeUsers}</strong><em>користувачів</em></div>
        </article>
        <article class="panel settings-summary-card">
          <span>${icon("refresh")}</span>
          <div><strong>${activeIntegrations}/${integrations.length}</strong><em>інтеграцій активні</em></div>
        </article>
        <article class="panel settings-summary-card">
          <span>${icon("bell")}</span>
          <div><strong>${enabledNotifications}</strong><em>типи сповіщень</em></div>
        </article>
        <article class="panel settings-summary-card">
          <span>${icon("check")}</span>
          <div><strong>Готово</strong><em>стан системи</em></div>
        </article>
      </section>

      <section class="panel settings-profile-card" data-settings-section="profile">
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

      <section class="panel settings-users-card" data-settings-section="users">
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
            <div><strong>${user.name}</strong><span>${user.role}</span></div>
            <em>${user.access}</em>
            <div class="settings-user-actions">
              ${badge(user.role === "Адміністратор" ? "Owner" : "Active", user.role === "Адміністратор" ? "blue" : "green")}
              <div class="settings-user-menu-wrap">
                <button type="button" class="icon-button compact" data-settings-user-menu="${index}" aria-label="Дії користувача" aria-expanded="${state.settingsOpenUserMenu === String(index) ? "true" : "false"}">⋮</button>
                <div class="settings-user-menu" data-settings-user-menu-panel="${index}" ${state.settingsOpenUserMenu === String(index) ? "" : "hidden"}>
                  ${user.role === "Адміністратор" ? "" : `<button type="button" data-settings-user-role="${index}">${icon("edit")} Змінити роль</button>`}
                  <button type="button" data-settings-user-access="${index}">${icon("check")} Оновити доступ</button>
                  ${user.role === "Адміністратор" ? "" : `<button type="button" class="danger" data-settings-user-delete="${index}">${icon("trash")} Видалити</button>`}
                </div>
              </div>
            </div>
          </article>`).join("")}
        </div>
      </section>

      <section class="panel settings-integrations-card" data-settings-section="integrations">
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

      <section class="panel settings-notifications-card" data-settings-section="notifications">
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

      <section class="panel settings-audit-card" data-settings-section="audit">
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
  document.querySelector("[data-settings-action='invite']")?.addEventListener("click", () => {
    const dialog = ensureInviteDialog(ctx);
    const form = dialog.querySelector("#settings-invite-form");
    if (form) {
      form.reset();
      form.elements.access.value = roleAccessMap["Адвокат"];
    }
    dialog.showModal();
    form?.elements.name?.focus();
  });
  document.querySelectorAll("[data-settings-user-menu]").forEach((button) => button.addEventListener("click", () => {
    const key = button.dataset.settingsUserMenu;
    state.settingsOpenUserMenu = state.settingsOpenUserMenu === key ? "" : key;
    renderSettingsScreen(ctx);
  }));
  document.querySelectorAll("[data-settings-user-access]").forEach((button) => button.addEventListener("click", () => {
    const user = state.settingsUsers[Number(button.dataset.settingsUserAccess)];
    if (!user) return;
    user.access = roleAccessMap[user.role] || user.access;
    state.settingsOpenUserMenu = "";
    addSettingsAudit(state, `Оновлено доступ користувача ${user.name}: ${user.access}.`, "blue");
    saveNavigationState();
    renderSettingsScreen(ctx);
    showToast(`Доступ користувача ${user.name} оновлено.`);
  }));
  document.querySelectorAll("[data-settings-user-role]").forEach((button) => button.addEventListener("click", () => {
    const user = state.settingsUsers[Number(button.dataset.settingsUserRole)];
    if (!user || user.role === "Адміністратор") return;
    user.role = user.role === "Адвокат" ? "Помічник" : "Адвокат";
    user.access = user.role === "Адвокат" ? "Справи, клієнти, календар" : "Задачі та документи";
    state.settingsOpenUserMenu = "";
    addSettingsAudit(state, `Змінено роль користувача ${user.name}: ${user.role}.`, "amber");
    saveNavigationState();
    renderSettingsScreen(ctx);
    showToast(`Роль користувача змінено: ${user.role}.`);
  }));
  document.querySelectorAll("[data-settings-user-delete]").forEach((button) => button.addEventListener("click", () => {
    const [removed] = state.settingsUsers.splice(Number(button.dataset.settingsUserDelete), 1);
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
