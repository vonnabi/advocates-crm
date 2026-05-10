export function renderSettingsScreen(ctx) {
  const { state, $, icon, badge, saveNavigationState, showToast } = ctx;
  const users = [
    { name: "Іваненко А.Ю.", role: "Адміністратор", access: "Повний доступ", photo: "І" },
    { name: "Мельник Н.П.", role: "Адвокат", access: "Справи, клієнти, календар", photo: "М" },
    { name: "Кравчук А.В.", role: "Помічник", access: "Задачі та документи", photo: "К" }
  ];
  const integrations = [
    { key: "Telegram", description: "Повідомлення клієнтам, тестові відправки, нагадування" },
    { key: "SMS", description: "Короткі сповіщення про події та дедлайни" },
    { key: "Email", description: "Листи, шаблони та службові повідомлення" },
    { key: "AI", description: "AI помічники, аналіз справ і чернетки документів" }
  ];

  $("#settings").innerHTML = `
    <div class="settings-screen">
      <section class="panel settings-profile-card">
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

      <section class="panel settings-users-card">
        <div class="settings-section-head">
          <div>
            <h2>Користувачі</h2>
            <p class="muted">Ролі команди та рівні доступу до CRM.</p>
          </div>
          <button type="button" class="secondary" data-settings-action="invite">+ Запросити</button>
        </div>
        <div class="settings-users-list">
          ${users.map((user) => `<article class="settings-user-row">
            <div class="avatar">${user.photo}</div>
            <div><strong>${user.name}</strong><span>${user.role}</span></div>
            <em>${user.access}</em>
            ${badge(user.role === "Адміністратор" ? "Owner" : "Active", user.role === "Адміністратор" ? "blue" : "green")}
          </article>`).join("")}
        </div>
      </section>

      <section class="panel settings-integrations-card">
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

      <section class="panel settings-notifications-card">
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
    showToast("Запрошення користувача показано як прототипну дію.", "warning");
  });
  document.querySelectorAll("[data-settings-integration]").forEach((input) => input.addEventListener("change", () => {
    const key = input.dataset.settingsIntegration;
    state.settingsIntegrations[key] = input.checked;
    saveNavigationState();
    showToast(`${key}: ${input.checked ? "увімкнено" : "вимкнено"}.`, input.checked ? "success" : "warning");
  }));
  document.querySelectorAll("[data-settings-notification]").forEach((input) => input.addEventListener("change", () => {
    state.settingsNotifications[input.dataset.settingsNotification] = input.checked;
    saveNavigationState();
    showToast(input.checked ? "Сповіщення увімкнено." : "Сповіщення вимкнено.", input.checked ? "success" : "warning");
  }));
}
