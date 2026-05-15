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
  const integrations = [
    { key: "Telegram", description: "Повідомлення клієнтам, тестові відправки, нагадування" },
    { key: "SMS", description: "Короткі сповіщення про події та дедлайни" },
    { key: "Email", description: "Листи, шаблони та службові повідомлення" },
    { key: "AI", description: "AI помічники, аналіз справ і чернетки документів" }
  ];

  $("#settings").innerHTML = `
    <div class="settings-screen">
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
              <button type="button" class="case-row-icon" data-settings-user-role="${index}" title="Змінити роль">${icon("edit")}</button>
              ${user.role === "Адміністратор" ? "" : `<button type="button" class="case-row-icon danger-icon" data-settings-user-delete="${index}" title="Видалити користувача">${icon("trash")}</button>`}
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
          ${integrations.map((item) => `<label class="settings-toggle-row">
            <span>${icon(item.key === "Email" ? "mail" : item.key === "AI" ? "search" : item.key === "SMS" ? "message" : item.key.toLowerCase())}</span>
            <strong>${item.key}<em>${item.description}</em></strong>
            <input type="checkbox" data-settings-integration="${item.key}" ${state.settingsIntegrations[item.key] ? "checked" : ""} />
          </label>`).join("")}
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
    </div>
  `;

  document.querySelector("[data-save-settings]")?.addEventListener("click", () => {
    document.querySelectorAll("[data-bureau-field]").forEach((input) => {
      state.bureauSettings[input.dataset.bureauField] = input.value.trim();
    });
    saveNavigationState();
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
  document.querySelectorAll("[data-settings-user-role]").forEach((button) => button.addEventListener("click", () => {
    const user = state.settingsUsers[Number(button.dataset.settingsUserRole)];
    if (!user || user.role === "Адміністратор") return;
    user.role = user.role === "Адвокат" ? "Помічник" : "Адвокат";
    user.access = user.role === "Адвокат" ? "Справи, клієнти, календар" : "Задачі та документи";
    saveNavigationState();
    renderSettingsScreen(ctx);
    showToast(`Роль користувача змінено: ${user.role}.`);
  }));
  document.querySelectorAll("[data-settings-user-delete]").forEach((button) => button.addEventListener("click", () => {
    const [removed] = state.settingsUsers.splice(Number(button.dataset.settingsUserDelete), 1);
    saveNavigationState();
    renderSettingsScreen(ctx);
    showToast(`Користувача ${removed.name} видалено.`, "danger");
  }));
  document.querySelectorAll("[data-settings-integration]").forEach((input) => input.addEventListener("change", () => {
    const key = input.dataset.settingsIntegration;
    state.settingsIntegrations[key] = input.checked;
    saveNavigationState();
    showToast(`${key}: ${input.checked ? "увімкнено" : "вимкнено"}.`, input.checked ? "success" : "warning");
  }));
  document.querySelectorAll("[data-settings-notification]").forEach((input) => input.addEventListener("change", () => {
    const key = input.dataset.settingsNotification;
    state.settingsNotifications[key] = input.checked;
    if (input.checked) {
      state.notificationReadKeys = (state.notificationReadKeys || []).filter((item) => item !== key);
    }
    syncTopbarNotifications?.();
    saveNavigationState();
    showToast(input.checked ? "Сповіщення увімкнено." : "Сповіщення вимкнено.", input.checked ? "success" : "warning");
  }));
}
