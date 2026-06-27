import { clearAuditLogsFromApi, deleteSettingsUserFromApi, getAuditLogsFromApi, getMailingProviderStatusFromApi, saveCrmSettingsToApi, saveSettingsUserToApi, shouldUseApi, testMailingProviderInApi } from "../api.js?v=mailings-api-69";
import { icon, navIconName, escapeHtml } from "../ui.js?v=settings-icons-5";
import { normalizeAuditLog, normalizeSettingsUser } from "../state.js?v=mailings-api-69";

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
const clientPickerRenderLimit = 80;

const integrationConfigFields = {
  Telegram: [
    ["botToken", "Bot token", "Наприклад, 123456:telegram-token", true],
    ["chatId", "Тестовий chat ID", "@ivanenko_admin або 123456789", true],
    ["webhookUrl", "Webhook URL", "https://example.com/telegram/webhook", false]
  ],
  SMS: [
    ["provider", "Провайдер", "TurboSMS", true],
    ["sender", "Відправник", "Advocates", true],
    ["apiKey", "API key", "sms-api-key", true]
  ],
  Email: [
    ["senderEmail", "Email відправника", "admin@advocates.ua", true],
    ["senderName", "Ім'я відправника", "Advocates Bureau", false],
    ["smtpHost", "SMTP host", "smtp.example.com", true],
    ["smtpPort", "SMTP port", "587", true]
  ],
  "Е-підпис": [
    ["provider", "Провайдер", "Вчасно або Дія.Підпис", true],
    ["apiToken", "API token", "Токен провайдера підпису", true],
    ["callbackUrl", "Webhook / callback URL", "https://example.com/esign/callback", false],
    ["edrpou", "ЄДРПОУ бюро", "12345678", false]
  ],
  ONLYOFFICE: [
    ["documentServerUrl", "Document Server URL", "https://office.example.com", true],
    ["serverAccessUrl", "CRM URL для Document Server", "http://host.docker.internal:8001", true],
    ["callbackUrl", "Callback URL CRM", "https://crm.example.com/api/documents/onlyoffice/callback", true],
    ["jwtSecret", "JWT secret", "Секрет для підпису запитів", false]
  ],
  AI: [
    ["model", "Модель", "demo", false],
    ["workspace", "Контекст", "cases", false]
  ]
};

const integrationConfigIcons = {
  Telegram: "telegram",
  SMS: "message",
  Email: "mail",
  "Е-підпис": "signature",
  ONLYOFFICE: "file",
  AI: "search"
};
const defaultBureauLogo = "";

const accessPermissionMap = {
  "Повний доступ": allPermissionKeys,
  "Справи, клієнти, календар": ["manage_cases", "manage_clients", "manage_calendar"],
  "Задачі та документи": ["manage_tasks", "manage_documents", "manage_calendar", "view_planner", "manage_ai"],
  "Фінанси та звіти": ["view_finance", "manage_finance", "view_analytics"],
  "Індивідуальний доступ": []
};

function settingsAuditDate(daysAgo, time) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")}.${date.getFullYear()} ${time}`;
}

const rolePermissionMap = Object.fromEntries(
  Object.entries(roleAccessMap).map(([role, access]) => [role, accessPermissionMap[access] || []])
);

function cleanSettingValue(value) {
  return String(value || "").trim().replace(/[<>]/g, "");
}

function cleanAttribute(value) {
  return cleanSettingValue(value).replace(/["'`]/g, "");
}

function integrationConfigProgress(channel, state) {
  const fields = integrationConfigFields[channel] || [];
  const required = fields.filter((field) => field[3]);
  const values = state.settingsIntegrationSettings?.[channel] || {};
  if (!required.length) return { filled: fields.length, total: fields.length, label: "Налаштовано" };
  const filled = required.filter(([key]) => cleanSettingValue(values[key])).length;
  return { filled, total: required.length, label: `${filled}/${required.length} обов'язкових` };
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

function readinessTone(score) {
  if (score >= 80) return "green";
  if (score >= 60) return "amber";
  return "red";
}

function buildProjectReadiness(state, activeIntegrations, integrationsCount, activeUsers) {
  const apiReady = shouldUseApi(state);
  const caseTasksCount = (state.cases || []).reduce((sum, caseItem) => sum + (caseItem.tasks || []).length, 0);
  const totalTasksCount = (state.tasks || []).length + caseTasksCount;
  const hasCoreData = Boolean(state.clients?.length && state.cases?.length && totalTasksCount && state.events?.length);
  const caseDocuments = (state.cases || []).flatMap((caseItem) => [
    ...(caseItem.documents || []),
    ...(caseItem.folders || []).flatMap((folder) => folder.files || [])
  ]);
  const documentSources = new Set(caseDocuments.map((documentItem) => documentItem.source).filter(Boolean));
  const archiveFolders = state.documentArchiveFolders || [];
  const archiveFolderCount = (folders = []) => folders.reduce((sum, folder) => sum + 1 + archiveFolderCount(folder.children || []), 0);
  const onlyOfficeProgress = integrationConfigProgress("ONLYOFFICE", state);
  const onlyOfficeReady = Boolean(onlyOfficeProgress.total && onlyOfficeProgress.filled >= onlyOfficeProgress.total);
  const eSignProgress = integrationConfigProgress("Е-підпис", state);
  const eSignReady = Boolean(eSignProgress.total && eSignProgress.filled >= eSignProgress.total);
  const hasDocumentArchive = archiveFolderCount(archiveFolders) >= 2;
  const hasDocumentSources = ["Комп'ютер", "Google Docs", "CRM файл"].filter((source) => documentSources.has(source)).length;
  const backupReady = Boolean(apiReady || state.demoDataStatus);
  const noDemoResetMode = apiReady && state.demoDataStatus?.enabled === false;
  const auditReady = Boolean((state.auditLogs || []).length || (state.settingsAudit || []).length);
  const integrationRequiredTotal = Object.keys(integrationConfigFields).reduce((sum, channel) => sum + integrationConfigProgress(channel, state).total, 0);
  const integrationFilledTotal = Object.keys(integrationConfigFields).reduce((sum, channel) => sum + integrationConfigProgress(channel, state).filled, 0);
  const integrationSetupScore = integrationRequiredTotal
    ? Math.round((integrationFilledTotal / integrationRequiredTotal) * 18)
    : 0;
  const integrationScore = Math.min(86, 36 + activeIntegrations * 6 + integrationSetupScore + (onlyOfficeReady ? 5 : 0) + (eSignReady ? 4 : 0));
  const documentScore = Math.min(88,
    38
    + (caseDocuments.length ? 12 : 0)
    + Math.min(12, hasDocumentSources * 4)
    + (hasDocumentArchive ? 10 : 0)
    + (onlyOfficeReady ? 10 : 0)
    + (apiReady ? 6 : 0)
    + (eSignReady ? 4 : 0)
    + 6
  );
  const pilotScore = Math.min(92,
    (apiReady ? 64 : 48)
    + (backupReady ? 8 : 0)
    + (auditReady ? 5 : 0)
    + (noDemoResetMode ? 7 : 0)
    + 8 // хардненинг безпеки реалізований: CSRF, SSRF-guard, сесійна авторизація, гейтинг прав
  );
  const items = [
    {
      title: "Основний сценарій",
      score: hasCoreData ? 91 : 70,
      status: "Сильна зона",
      detail: "Клієнти, справи, задачі, календар, фінанси й документи вже проходять основний демо-сценарій.",
      next: "Далі варто перевірити сценарій на 10-20 реальних прикладах замовника."
    },
    {
      title: "Backend і збереження",
      score: apiReady ? 92 : 64,
      status: apiReady ? "Працює через API" : "Статичний режим",
      detail: apiReady ? "Django API, база, ролі, журнал дій, файли документів, CSRF-захист і Render-запуск уже підключені." : "Без API зміни залишаються демонстраційними.",
      next: apiReady ? "Перед пілотом лишається зафіксувати правила резервних копій БД." : "Для пілота потрібно відкривати CRM через Render/API, а не статичну сторінку."
    },
    {
      title: "Користувачі та доступ",
      score: activeUsers > 1 ? 88 : 64,
      status: `${activeUsers} користувачів`,
      detail: "Ролі, права й розмежування доступу перевірені на backend: фінанси й список користувачів не віддаються тим, кому не можна.",
      next: "Залишився практичний UI-прогін під ролями: помічник, бухгалтер, адвокат."
    },
    {
      title: "Інтеграції",
      score: integrationScore,
      status: `${activeIntegrations}/${integrationsCount} увімкнено · ${integrationFilledTotal}/${integrationRequiredTotal} полів`,
      detail: "Telegram, SMS, Email, КЕП, ONLYOFFICE і AI мають UI, але готовність рахується тільки за заповненими обов'язковими параметрами.",
      next: integrationFilledTotal >= integrationRequiredTotal
        ? "Першими бойовими варто перевірити тестову відправку Telegram/Email, потім КЕП і ONLYOFFICE сервер."
        : "Дозаповнити незакриті поля інтеграцій і виконати тестову відправку з кожного активного каналу."
    },
    {
      title: "Документи та AI",
      score: documentScore,
      status: `${caseDocuments.length} документів · ${archiveFolderCount(archiveFolders)} папки архіву`,
      detail: "Є створення документа з комп'ютера, Google Docs і ONLYOFFICE, перегляд/редагування, експорт, КЕП-статуси та окремий архів.",
      next: eSignReady
        ? "Наступний крок: перевірити з реальними DOCX/PDF клієнта і вирішити, які формати лишаємо в бойовому меню."
        : "Дописати налаштування КЕП і перевірити реальний DOCX/PDF клієнта."
    },
    {
      title: "Пілот і безпека",
      score: pilotScore,
      status: noDemoResetMode ? "Можна готувати пілот" : "Потребує фінального режиму",
      detail: "Smoke/golden-тести, журнал дій, JSON-копії CRM, а також CSRF-захист, SSRF-guard, сесійна авторизація і гейтинг прав (за флагами для прода).",
      next: noDemoResetMode ? "Лишилось: увімкнути auth/CORS на проді, графік бекапів, інструкція замовнику." : "Перед реальними даними: вимкнути демо-скидання, увімкнути auth/CORS, домовитись про графік копій."
    }
  ];
  const overall = Math.round(items.reduce((sum, item) => sum + item.score, 0) / items.length);
  const weakItems = [...items].sort((a, b) => a.score - b.score).slice(0, 3);
  return { overall, items, weakItems };
}

function buildPilotChecklist(state, providerStatusByChannel, activeUsers) {
  const demoStatus = state.demoDataStatus || {};
  const demoCounts = demoStatus.counts || {};
  const demoTotal = demoStatus.total ?? Object.values(demoCounts).reduce((sum, value) => sum + Number(value || 0), 0);
  const enabledProviders = ["Telegram", "SMS", "Email"]
    .map((channel) => providerStatusByChannel[channel])
    .filter(Boolean);
  const providersNeedingSetup = enabledProviders.filter((item) => item.status === "setup");
  const integrationGaps = Object.keys(integrationConfigFields)
    .map((channel) => {
      const progress = integrationConfigProgress(channel, state);
      return {
        channel,
        missing: Math.max(0, progress.total - progress.filled),
        progress
      };
    })
    .filter((item) => item.missing > 0);
  const requiredIntegrationGaps = integrationGaps.filter((item) => item.channel !== "AI");
  const onlyOfficeProgress = integrationConfigProgress("ONLYOFFICE", state);
  const onlyOfficeReady = onlyOfficeProgress.total > 0 && onlyOfficeProgress.filled >= onlyOfficeProgress.total;
  const auditReady = Boolean((state.auditLogs || []).length || (state.settingsAudit || []).length);
  const requiredGapLabel = requiredIntegrationGaps.length === 1
    ? "1 інтеграцію треба доповнити"
    : `${requiredIntegrationGaps.length} інтеграції треба доповнити`;

  return [
    {
      title: "Демо-дані",
      done: demoStatus.enabled === false,
      status: demoStatus.enabled === false ? "Пілотний режим" : `${demoTotal || 0} демо-записів`,
      detail: demoStatus.enabled === false
        ? "Стартові демо-записи вимкнені, можна заводити реальних клієнтів без змішування з макетом."
        : "Перед реальними клієнтами відкрийте перемикач демо-даних у верхній панелі і очистіть демо-записи.",
      action: demoStatus.enabled === false ? "За потреби натисніть перемикач, щоб увімкнути стартові демо-дані." : "Натисніть перемикач демо-даних і вимкніть стартові записи."
    },
    {
      title: "Канали зв'язку",
      done: providersNeedingSetup.length === 0 && requiredIntegrationGaps.length === 0,
      status: providersNeedingSetup.length
        ? `${providersNeedingSetup.length} канали треба налаштувати`
        : requiredIntegrationGaps.length
          ? requiredGapLabel
          : "Канали готові",
      detail: providersNeedingSetup.length
        ? providersNeedingSetup.map((item) => `${item.channel}: ${item.detail}`).join(" ")
        : requiredIntegrationGaps.length
          ? "Увімкнені модулі є, але частина обов'язкових параметрів провайдерів ще порожня."
          : "Telegram, SMS та Email не показують технічних стопперів у перевірці провайдера.",
      action: requiredIntegrationGaps.length
        ? `Заповнити обов'язкові поля: ${requiredIntegrationGaps.map((item) => `${item.channel} ${item.progress.filled}/${item.progress.total}`).join(", ")}.`
        : "Відправити тестове повідомлення з кожного активного каналу."
    },
    {
      title: "Документи",
      done: onlyOfficeReady,
      status: onlyOfficeReady ? "ONLYOFFICE налаштований" : `ONLYOFFICE ${onlyOfficeProgress.filled}/${onlyOfficeProgress.total}`,
      detail: onlyOfficeReady
        ? "CRM має URL Document Server, адресу доступу для контейнера і callback для збереження версій."
        : "Для бойового редагування DOCX треба завершити поля ONLYOFFICE.",
      action: onlyOfficeReady ? "Перевірити відкриття реального DOCX/PDF клієнта." : "Заповнити ONLYOFFICE і перевірити доступність сервера."
    },
    {
      title: "Ролі та аудит",
      done: activeUsers >= 4 && auditReady,
      status: `${activeUsers} користувачів · ${auditReady ? "журнал працює" : "журнал порожній"}`,
      detail: "Перед показом важливо пройти CRM під ролями адміністратора, адвоката, помічника і бухгалтера.",
      action: "Провести короткий рольовий прогін: створення клієнта, справа, задача, документ, фінансова операція."
    }
  ];
}

function buildRemainingWork() {
  // Явний список недоробок — те, що ще лишилось зробити до бойового пілоту.
  // tag: "ключі" — потрібні зовнішні токени/доступи; "код" — наша розробка;
  //      "конфіг" — увімкнути на проді; "перевірка"/"процес"/"док" — організаційне.
  return [
    { area: "Інтеграції", title: "Бойова відправка Telegram / SMS / Email", note: "Зараз mock-провайдер. Потрібні токени бота / ключ SMS / SMTP і тестова відправка.", tag: "потрібні ключі", tone: "red" },
    { area: "Інтеграції", title: "КЕП (е-підпис) — реальне підписання", note: "UI і статуси є; потрібна інтеграція з сервісом КЕП.", tag: "потрібні ключі", tone: "red" },
    { area: "AI", title: "AI-помічник на реальному LLM", note: "Зараз інтерфейс/заглушки (без LLM). Потрібен API-ключ і рішення по бюджету.", tag: "ключ + рішення", tone: "red" },
    { area: "Безпека", title: "Валідація значень полів (choices/типи)", note: "Битий JSON вже → 400. Лишилась акуратна перевірка значень у backend upsert.", tag: "код", tone: "blue" },
    { area: "Безпека", title: "Увімкнути auth/CORS на бойовому сервері", note: "Готово за флагами CRM_REQUIRE_AUTH / CRM_ALLOWED_ORIGINS — лишається ввімкнути на проді.", tag: "конфіг", tone: "amber" },
    { area: "Backend", title: "Правила резервних копій БД", note: "Зафіксувати графік і місце зберігання бекапів перед реальними даними.", tag: "процес", tone: "amber" },
    { area: "Пілот", title: "Рольовий UI-прогін", note: "Backend-розмежування прав перевірено (адвокат/помічник/бухгалтер). Лишився прогін інтерфейсу під кожною роллю.", tag: "перевірка", tone: "amber" },
    { area: "Документи", title: "Реальні DOCX/PDF клієнта в ONLYOFFICE", note: "Перевірити відкриття/редагування справжніх файлів і форматів.", tag: "перевірка", tone: "amber" },
    { area: "Пілот", title: "Коротка інструкція для замовника", note: "1-2 сторінки: як вести клієнта, справу, документи й фінанси.", tag: "док", tone: "amber" },
    { area: "Дрібниці", title: "Хвости честності даних", note: "Декоративні select в аналітиці, сегмент-фільтри розсилки, мертвий код OSINT/analytics.", tag: "код", tone: "blue" },
  ];
}

function renderRemainingWork(items, badge) {
  return `
    <div class="settings-pilot-checklist settings-remaining-work">
      <div class="settings-pilot-head">
        <strong>Що залишилось зробити</strong>
        <span>${items.length} пунктів</span>
      </div>
      <div class="settings-pilot-grid">
        ${items.map((item) => `<article class="needs-work">
          <div>
            <strong>${item.title}</strong>
            ${badge(item.tag, item.tone)}
          </div>
          <em>${item.area}</em>
          <p>${item.note}</p>
        </article>`).join("")}
      </div>
    </div>
  `;
}

function renderPilotChecklist(checklist, badge) {
  return `
    <div class="settings-pilot-checklist">
      <div class="settings-pilot-head">
        <strong>Перед пілотом</strong>
        <span>${checklist.filter((item) => item.done).length}/${checklist.length} готово</span>
      </div>
      <div class="settings-pilot-grid">
        ${checklist.map((item) => `<article class="${item.done ? "is-done" : "needs-work"}">
          <div>
            <strong>${item.title}</strong>
            ${badge(item.done ? "OK" : "Дія", item.done ? "green" : "amber")}
          </div>
          <em>${item.status}</em>
          <p>${item.detail}</p>
          <small>${item.action}</small>
        </article>`).join("")}
      </div>
    </div>
  `;
}

function renderReadinessSection(readiness, checklist, badge, focused) {
  return `
    <section class="panel settings-readiness-card settings-readiness-panel ${focused ? "is-focused" : ""}" data-settings-section="readiness">
      <div class="settings-readiness-body">
        <div class="settings-readiness-grid">
          ${readiness.items.map((item) => `<article class="settings-readiness-item tone-${readinessTone(item.score)}">
            <div class="settings-readiness-item-head">
              <strong>${item.title}</strong>
              ${badge(`${item.score}%`, readinessTone(item.score))}
            </div>
            <div class="settings-readiness-bar"><span style="width:${item.score}%"></span></div>
            <em>${item.status}</em>
            <p>${item.detail}</p>
            <small>${item.next}</small>
          </article>`).join("")}
        </div>
        <div class="settings-readiness-next">
          <strong>Найслабші місця зараз</strong>
          <span>${readiness.weakItems.map((item) => `${item.title} ${item.score}%`).join(" · ")}</span>
        </div>
        ${renderRemainingWork(buildRemainingWork(), badge)}
        ${renderPilotChecklist(checklist, badge)}
      </div>
    </section>
  `;
}

function bureauLogoValue(settings = {}) {
  return cleanSettingValue(settings.logo || "") || defaultBureauLogo;
}

function bureauLogoDisplayValue(settings = {}) {
  const logo = bureauLogoValue(settings);
  return logo.startsWith("data:image/") ? "Завантажений логотип" : logo;
}

function isBureauLogoImage(value = "") {
  return /^(https?:\/\/|assets\/|data:image\/)/i.test(value);
}

function renderBureauLogo(settings = {}) {
  const logo = bureauLogoValue(settings);
  const name = cleanSettingValue(settings.name || "");
  if (isBureauLogoImage(logo)) {
    return `<img src="${cleanAttribute(logo)}" alt="${cleanAttribute(name || "CRM")}">`;
  }
  return `<span>${cleanSettingValue(logo || userInitials(name) || "CRM").slice(0, 4)}</span>`;
}

function bureauFaviconHref(settings = {}) {
  const logo = bureauLogoValue(settings);
  if (isBureauLogoImage(logo)) return logo;
  const label = cleanSettingValue(logo || userInitials(settings.name || "") || "CRM").slice(0, 4);
  const safeLabel = label.replace(/&/g, "&amp;");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#1f4e79"/><text x="32" y="39" text-anchor="middle" font-family="Arial,sans-serif" font-size="21" font-weight="800" fill="#fff">${safeLabel}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function syncBureauBrand(settings = {}) {
  const brandLogo = document.querySelector("[data-brand-logo]");
  const brandName = document.querySelector("[data-brand-name]");
  const favicon = document.querySelector("[data-brand-favicon]") || document.querySelector('link[rel="icon"]');
  if (brandLogo) brandLogo.innerHTML = renderBureauLogo(settings);
  if (brandName) brandName.textContent = cleanSettingValue(settings.name || "") || "Юридичне бюро";
  if (favicon) favicon.href = bureauFaviconHref(settings);
}

function brandIcon(name) {
  const icons = {
    telegram: `<svg viewBox="0 0 24 24"><path d="M21 4 3.8 10.8c-.8.3-.8 1.4.1 1.6l4.3 1.3 1.7 5.1c.2.7 1.1.9 1.6.3l2.5-2.9 4.5 3.4c.6.5 1.5.1 1.7-.7L22.5 5c.2-.7-.7-1.3-1.5-1Z"></path><path d="m8.4 13.6 8.2-5.2-6.4 7.4"></path></svg>`,
    whatsapp: `<svg viewBox="0 0 24 24"><path d="M20 11.6a8 8 0 0 1-11.9 7l-3.6 1 1-3.5A8 8 0 1 1 20 11.6Z"></path><path d="M9.4 8.7c.2-.4.4-.4.7-.4h.5c.2 0 .4.1.5.4l.7 1.7c.1.3.1.5-.1.7l-.4.5c-.1.1-.2.3 0 .5.5.9 1.3 1.7 2.4 2.2.2.1.4.1.5-.1l.7-.8c.2-.2.4-.2.7-.1l1.7.8c.3.1.4.3.4.5 0 .6-.4 1.5-1 1.7-.6.3-2.8.2-5.1-1.8-2.1-1.8-3.3-4.3-3.3-5.2 0-.5.5-1.3.7-1.6Z"></path></svg>`,
    instagram: `<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="5"></rect><circle cx="12" cy="12" r="3.4"></circle><circle cx="17" cy="7" r="1"></circle></svg>`,
    facebook: `<svg viewBox="0 0 24 24"><path d="M14 8h2V4h-2c-3 0-5 2-5 5v2H7v4h2v5h4v-5h3l1-4h-4V9c0-.6.4-1 1-1Z"></path></svg>`,
    tiktok: `<svg viewBox="0 0 24 24"><path d="M14 4c.5 3 2.2 4.8 5 5v3c-1.9 0-3.5-.6-5-1.7V16a5 5 0 1 1-5-5c.4 0 .7 0 1 .1v3.2a2 2 0 1 0 1.2 1.8V4h2.8Z"></path></svg>`,
    phone: `<svg viewBox="0 0 24 24"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.7 19.7 0 0 1-8.6-3.1 19.3 19.3 0 0 1-6-6A19.7 19.7 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c1 .3 1.9.6 2.9.7A2 2 0 0 1 22 16.9Z"></path></svg>`,
    website: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"></circle><path d="M3 12h18"></path><path d="M12 3c2.5 2.5 3.8 5.5 3.8 9S14.5 18.5 12 21c-2.5-2.5-3.8-5.5-3.8-9S9.5 5.5 12 3Z"></path></svg>`
  };
  return `<span class="settings-brand-icon ${name}" aria-hidden="true">${icons[name] || ""}</span>`;
}

function readImageAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result || "")));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(file);
  });
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

async function persistCrmSettings(ctx) {
  const { state } = ctx;
  if (!shouldUseApi(state)) return true;
  const payload = await saveCrmSettingsToApi({
    bureau: state.bureauSettings,
    integrations: state.settingsIntegrations,
    integrationSettings: state.settingsIntegrationSettings,
    notifications: state.settingsNotifications
  });
  if (payload.settings) {
    state.bureauSettings = payload.settings.bureau || state.bureauSettings;
    state.settingsIntegrations = payload.settings.integrations || state.settingsIntegrations;
    state.settingsIntegrationSettings = payload.settings.integrationSettings || state.settingsIntegrationSettings;
    state.settingsNotifications = payload.settings.notifications || state.settingsNotifications;
  }
  if (payload.auditLogs) {
    state.auditLogs = payload.auditLogs.map(normalizeAuditLog);
  }
  return true;
}

async function refreshMailingProviderStatus(ctx) {
  const { state } = ctx;
  if (!shouldUseApi(state)) return null;
  const payload = await getMailingProviderStatusFromApi();
  state.mailingProviderStatus = payload.providerStatus || state.mailingProviderStatus;
  return state.mailingProviderStatus;
}

function ensureIntegrationConfigDialog(ctx) {
  let dialog = document.querySelector("#settings-integration-config-dialog");
  if (dialog) return dialog;
  dialog = document.createElement("dialog");
  dialog.id = "settings-integration-config-dialog";
  dialog.innerHTML = `
    <form method="dialog" class="modal-form crm-modal-form settings-integration-config-form" id="settings-integration-config-form">
      <div class="modal-head crm-modal-head settings-integration-config-head">
        <div class="crm-modal-title settings-integration-config-title">
          <span class="crm-modal-title-icon settings-integration-config-title-icon" data-settings-integration-config-icon></span>
          <div>
            <h2 data-settings-integration-config-title>Налаштування інтеграції</h2>
            <p class="muted" data-settings-integration-config-note></p>
          </div>
        </div>
        <button class="crm-modal-close settings-modal-close" type="button" data-settings-integration-config-close aria-label="Закрити" title="Закрити">${icon("x")}</button>
      </div>
      <div class="crm-modal-status settings-integration-config-status" data-settings-integration-config-status></div>
      <div class="crm-modal-grid settings-integration-config-grid" data-settings-integration-config-fields></div>
      <div class="crm-modal-actions settings-integration-config-actions">
        <button type="submit" class="primary">Зберегти підключення</button>
      </div>
    </form>
  `;
  document.body.append(dialog);
  dialog.querySelector("[data-settings-integration-config-close]")?.addEventListener("click", () => dialog.close());
  dialog.querySelector("#settings-integration-config-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const { state, saveNavigationState, showToast } = ctx;
    const form = event.currentTarget;
    const channel = form.dataset.channel;
    const nextSettings = { ...(state.settingsIntegrationSettings?.[channel] || {}) };
    (integrationConfigFields[channel] || []).forEach(([key]) => {
      nextSettings[key] = cleanSettingValue(form.elements[key]?.value || "");
    });
    state.settingsIntegrationSettings = {
      ...(state.settingsIntegrationSettings || {}),
      [channel]: nextSettings
    };
    addSettingsAudit(state, `${channel}: оновлено параметри підключення.`, "blue");
    try {
      await persistCrmSettings(ctx);
      await refreshMailingProviderStatus(ctx);
    } catch (_error) {
      showToast("Не вдалося зберегти параметри інтеграції.", "danger");
      return;
    }
    dialog.close();
    saveNavigationState();
    renderSettingsScreen(ctx);
    showToast(`${channel}: підключення збережено.`);
  });
  return dialog;
}

function fillIntegrationConfigDialog(dialog, ctx, channel) {
  const { state } = ctx;
  const form = dialog.querySelector("#settings-integration-config-form");
  const fieldsWrap = dialog.querySelector("[data-settings-integration-config-fields]");
  const statusWrap = dialog.querySelector("[data-settings-integration-config-status]");
  const config = state.settingsIntegrationSettings?.[channel] || {};
  const providerStatus = (state.mailingProviderStatus?.channels || []).find((item) => item.channel === channel);
  const progress = integrationConfigProgress(channel, state);
  form.dataset.channel = channel;
  dialog.querySelector("[data-settings-integration-config-icon]").innerHTML = icon(integrationConfigIcons[channel] || "gear");
  dialog.querySelector("[data-settings-integration-config-title]").textContent = `${channel}: підключення`;
  dialog.querySelector("[data-settings-integration-config-note]").textContent = "Поля зберігаються в налаштуваннях CRM і використовуються для тестових відправок та майбутнього реального провайдера.";
  statusWrap.innerHTML = `
    <span class="${providerStatus?.status === "ready" ? "ready" : providerStatus?.status === "disabled" ? "disabled" : "setup"}">${providerStatus?.label || "Параметри"}</span>
    <strong>${progress.label}</strong>
    <em>${cleanSettingValue(providerStatus?.detail || "Параметри можна оновити нижче.")}</em>
  `;
  fieldsWrap.innerHTML = (integrationConfigFields[channel] || []).map(([key, label, placeholder, required]) => `
    <label class="crm-modal-field settings-integration-config-field ${required ? "required" : ""}">
      <span class="settings-field-label">${label}${required ? `<em>Обов'язково</em>` : ""}</span>
      <input name="${key}" value="${cleanAttribute(config[key] || "")}" placeholder="${cleanAttribute(placeholder)}" autocomplete="off" ${required ? "required" : ""} />
    </label>
  `).join("");
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
  return cases.map((caseItem) => `№${caseItem.id} · ${cleanSettingValue(caseItem.client || caseItem.title || "справа")}`).join(" / ");
}

function selectedCaseIds(user) {
  const direct = Array.isArray(user?.assignedCaseIds) ? user.assignedCaseIds : [];
  const nested = Array.isArray(user?.assignedCases) ? user.assignedCases.map((item) => caseAccessKey(item)) : [];
  return new Set([...direct, ...nested].filter(Boolean));
}

function caseAccessKey(caseItem) {
  return caseItem?.id || caseItem?.number || "";
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

function readVisibleCaseIds(form) {
  try {
    return new Set(JSON.parse(form.dataset.visibleCaseIds || "[]").filter(Boolean));
  } catch (_error) {
    return new Set();
  }
}

function writeVisibleCaseIds(form, visibleIds = new Set()) {
  form.dataset.visibleCaseIds = JSON.stringify([...visibleIds]);
}

function readAccessClientNames(form) {
  try {
    return new Set(JSON.parse(form.dataset.accessClientNames || "[]").filter(Boolean));
  } catch (_error) {
    return new Set();
  }
}

function writeAccessClientNames(form, clients = new Set()) {
  form.dataset.accessClientNames = JSON.stringify([...clients]);
}

function readHiddenCaseIds(form) {
  try {
    return new Set(JSON.parse(form.dataset.hiddenCaseIds || "[]").filter(Boolean));
  } catch (_error) {
    return new Set();
  }
}

function writeHiddenCaseIds(form, hiddenIds = new Set()) {
  form.dataset.hiddenCaseIds = JSON.stringify([...hiddenIds]);
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

function caseClientName(state, caseItem) {
  if (caseItem?.client) return caseItem.client;
  if (caseItem?.clientName) return caseItem.clientName;
  const client = (state.clients || []).find((item) => String(item.id) === String(caseItem?.clientId));
  return client?.name || "";
}

function caseClientOptions(state) {
  return [...new Set((state.cases || []).map((caseItem) => caseClientName(state, caseItem)).filter(Boolean))].sort((a, b) => a.localeCompare(b, "uk"));
}

function casesForClient(state, client = "") {
  return (state.cases || []).filter((caseItem) => caseClientName(state, caseItem) === client);
}

function selectedClientNames(state, selectedIds = new Set()) {
  return caseClientOptions(state).filter((client) => casesForClient(state, client).some((caseItem) => selectedIds.has(caseAccessKey(caseItem))));
}

function clientMatchesQuery(state, client, query = "") {
  const normalizedQuery = cleanSettingValue(query).toLowerCase();
  if (!normalizedQuery) return true;
  const caseText = casesForClient(state, client)
    .map((caseItem) => [caseAccessKey(caseItem), caseItem.title, caseItem.stage].join(" "))
    .join(" ");
  return [client, caseText].join(" ").toLowerCase().includes(normalizedQuery);
}

function filteredCases(state, search = "") {
  const query = cleanSettingValue(search).toLowerCase();
  return (state.cases || []).filter((caseItem) => {
    const haystack = [caseAccessKey(caseItem), caseClientName(state, caseItem), caseItem.title, caseItem.stage].join(" ").toLowerCase();
    return !query || haystack.includes(query);
  });
}

function accessGridCases(form, state, selectedIds = new Set(), search = "") {
  if (cleanSettingValue(search)) return filteredCases(state, search);
  const hiddenIds = readHiddenCaseIds(form);
  const visibleIds = readVisibleCaseIds(form);
  if (!visibleIds.size && selectedIds.size) writeVisibleCaseIds(form, selectedIds);
  writeAccessClientNames(form, selectedClientNames(state, selectedIds));
  const idsToShow = visibleIds.size ? visibleIds : selectedIds;
  return (state.cases || []).filter((caseItem) => idsToShow.has(caseAccessKey(caseItem)) && !hiddenIds.has(caseAccessKey(caseItem)));
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

function readOpenCaseClients(form) {
  try {
    return new Set(JSON.parse(form.dataset.openCaseClients || "[]").filter(Boolean));
  } catch (_error) {
    return new Set();
  }
}

function writeOpenCaseClients(form, clients = new Set()) {
  form.dataset.openCaseClients = JSON.stringify([...clients]);
}

function rememberOpenCaseGroups(form) {
  const openClients = new Set();
  form.querySelectorAll(".settings-case-group[open]").forEach((group) => {
    const client = group.dataset.caseClient;
    if (client) openClients.add(client);
  });
  if (openClients.size) writeOpenCaseClients(form, openClients);
}

function renderCaseCheckboxes(cases, checkedIds = new Set(), state = {}, emptyText = "Нічого не знайдено за цими фільтрами.", openClients = new Set(), forceOpen = false) {
  if (!cases.length) {
    return `
      <div class="settings-case-empty">
        <strong>${emptyText}</strong>
        <span>Додайте клієнта через вибір клієнтів або знайдіть конкретну справу пошуком.</span>
        <button type="button" class="secondary compact" data-settings-open-client-picker>${icon("users")} Вибрати клієнтів</button>
      </div>`;
  }
  const groups = new Map();
  cases.forEach((caseItem) => {
    const client = caseClientName(state, caseItem) || "Без клієнта";
    groups.set(client, [...(groups.get(client) || []), caseItem]);
  });
  return [...groups.entries()].map(([client, clientCases], index) => {
    const selectedCount = clientCases.filter((caseItem) => checkedIds.has(caseAccessKey(caseItem))).length;
    const shouldOpen = forceOpen || (openClients.size ? openClients.has(client) : index === 0);
    return `
      <details class="settings-case-group" data-case-client="${cleanAttribute(client)}" ${shouldOpen ? "open" : ""}>
        <summary class="settings-case-group-head">
          <strong>${cleanSettingValue(client)}</strong>
          <span>Доступ: ${selectedCount}/${clientCases.length}</span>
          <button type="button" class="settings-case-group-clear" data-settings-clear-client-cases="${cleanAttribute(client)}">Зняти доступ</button>
        </summary>
        <div class="settings-case-group-list">
          ${clientCases.map((caseItem) => {
            const hasAccess = checkedIds.has(caseAccessKey(caseItem));
            return `
            <div class="settings-case-choice ${hasAccess ? "has-access" : "no-access"}">
              <label class="settings-case-label">
                <input type="checkbox" name="assignedCaseIds" value="${caseAccessKey(caseItem)}" ${hasAccess ? "checked" : ""} />
                <span>
                  <strong>№${caseAccessKey(caseItem)}</strong>
                  <em>${cleanSettingValue(caseItem.stage || "Стадія не вказана")}</em>
                </span>
                <small>${cleanSettingValue(caseItem.title || "")}</small>
              </label>
              <span class="settings-case-access-badge">${hasAccess ? "Доступ є" : "Без доступу"}</span>
              <button type="button" class="settings-case-hide" data-settings-hide-case="${cleanAttribute(caseAccessKey(caseItem))}" aria-label="Прибрати справу №${cleanAttribute(caseAccessKey(caseItem))} зі списку" title="Прибрати зі списку">${icon("x")}</button>
            </div>`;
          }).join("")}
        </div>
      </details>`;
  }).join("");
}

function renderClientAccessSummary(state, checkedIds = new Set(), visibleIds = new Set()) {
  const clients = selectedClientNames(state, checkedIds);
  const preview = clients.slice(0, 4);
  const rest = Math.max(0, clients.length - preview.length);
  const caseLabel = `${checkedIds.size} ${checkedIds.size === 1 ? "справа" : checkedIds.size > 1 && checkedIds.size < 5 ? "справи" : "справ"}`;
  return `
    <div class="settings-client-summary">
      <button type="button" class="secondary settings-client-open" data-settings-open-client-picker>
        ${icon("users")} Вибрати клієнтів
      </button>
      <div class="settings-client-selected-list">
        <span class="is-total">Доступ: ${caseLabel}</span>
        <span>У списку: ${visibleIds.size}</span>
        ${preview.length
          ? preview.map((client) => `
            <button type="button" class="settings-client-selected-chip" data-settings-remove-client="${cleanAttribute(client)}" aria-label="Прибрати ${cleanAttribute(client)}">
              <span>${client}</span>
              ${icon("x")}
            </button>`).join("")
          : `<em>Клієнти не вибрані</em>`}
        ${rest ? `<span>+${rest}</span>` : ""}
      </div>
    </div>`;
}

function renderCaseAccessStats(matches = [], selectedIds = new Set(), state = {}, search = "") {
  const clientCount = selectedClientNames(state, selectedIds).length;
  const label = cleanSettingValue(search) ? "Знайдено" : "Показано";
  return `
    <span><em>${label}</em><strong>${matches.length}</strong></span>
    <span><em>Доступ</em><strong>${selectedIds.size}</strong></span>
    <span><em>Клієнти</em><strong>${clientCount}</strong></span>
  `;
}

function refreshCaseGrid(form, state, options = {}) {
  rememberOpenCaseGroups(form);
  const shouldSyncFromVisibleCases = options.syncFromVisibleCases !== false;
  const selectedIds = shouldSyncFromVisibleCases ? syncStoredCaseIdsFromForm(form) : readStoredCaseIds(form);
  const search = form.elements.caseSearch?.value || "";
  const matches = accessGridCases(form, state, selectedIds, search);
  const emptyText = cleanSettingValue(search)
    ? "Нічого не знайдено за цим пошуком."
    : "Права на справи ще не вибрані. Виберіть клієнтів або знайдіть справу за номером.";
  form.querySelector("[data-settings-cases-grid]").innerHTML = renderCaseCheckboxes(matches, selectedIds, state, emptyText, readOpenCaseClients(form), Boolean(cleanSettingValue(search)));
  form.querySelector("[data-settings-client-picker]").innerHTML = renderClientAccessSummary(state, selectedIds, readVisibleCaseIds(form));
  const meta = form.querySelector("[data-settings-case-filter-meta]");
  if (meta) {
    meta.innerHTML = renderCaseAccessStats(matches, selectedIds, state, search);
  }
}

function applyClientScopeChange(form, state, client, shouldSelect, options = {}) {
  const selectedIds = syncStoredCaseIdsFromForm(form);
  const visibleIds = readVisibleCaseIds(form);
  const visibleClients = readAccessClientNames(form);
  const hiddenIds = readHiddenCaseIds(form);
  applyClientScopeChangeToSet(state, selectedIds, client, shouldSelect);
  if (shouldSelect || options.keepVisible) {
    visibleClients.add(client);
    casesForClient(state, client).forEach((caseItem) => {
      const key = caseAccessKey(caseItem);
      visibleIds.add(key);
      hiddenIds.delete(key);
    });
  } else {
    visibleClients.delete(client);
    casesForClient(state, client).forEach((caseItem) => {
      const key = caseAccessKey(caseItem);
      visibleIds.delete(key);
      hiddenIds.add(key);
    });
  }
  writeStoredCaseIds(form, selectedIds);
  writeVisibleCaseIds(form, visibleIds);
  writeAccessClientNames(form, visibleClients);
  writeHiddenCaseIds(form, hiddenIds);
  refreshCaseGrid(form, state, { syncFromVisibleCases: false });
}

function visibleClientOptions(dialog, state) {
  const query = dialog.querySelector("[data-settings-client-search]")?.value || "";
  return caseClientOptions(state).filter((client) => clientMatchesQuery(state, client, query));
}

function renderedClientOptions(dialog, state) {
  return visibleClientOptions(dialog, state).slice(0, clientPickerRenderLimit);
}

function readPickerCaseIds(dialog) {
  try {
    return new Set(JSON.parse(dialog.dataset.selectedCaseIds || "[]").filter(Boolean));
  } catch (_error) {
    return new Set();
  }
}

function writePickerCaseIds(dialog, selectedIds) {
  dialog.dataset.selectedCaseIds = JSON.stringify([...selectedIds]);
}

function readOpenPickerClients(dialog) {
  try {
    return new Set(JSON.parse(dialog.dataset.openPickerClients || "[]").filter(Boolean));
  } catch (_error) {
    return new Set();
  }
}

function writeOpenPickerClients(dialog, clients = new Set()) {
  dialog.dataset.openPickerClients = JSON.stringify([...clients]);
}

function rememberOpenPickerClients(dialog) {
  const openClients = new Set();
  dialog.querySelectorAll(".settings-client-dialog-choice[open]").forEach((group) => {
    const client = group.dataset.pickerClient;
    if (client) openClients.add(client);
  });
  writeOpenPickerClients(dialog, openClients);
}

function renderClientPickerSelectedSummary(dialog, state, selectedIds = new Set()) {
  const wrap = dialog.querySelector("[data-settings-client-picker-selected]");
  if (!wrap) return;
  const clients = selectedClientNames(state, selectedIds);
  if (!clients.length) {
    wrap.innerHTML = `<em>Поточний вибір порожній. Знайдіть клієнта нижче або додайте знайдених.</em>`;
    return;
  }
  const preview = clients.slice(0, 8);
  const rest = Math.max(0, clients.length - preview.length);
  wrap.innerHTML = `
    <strong>Поточний вибір</strong>
    <div>
      ${preview.map((client) => `
        <button type="button" class="settings-client-selected-chip" data-settings-picker-remove-client="${cleanAttribute(client)}" aria-label="Прибрати ${cleanAttribute(client)}">
          <span>${client}</span>
          ${icon("x")}
        </button>`).join("")}
      ${rest ? `<span class="settings-client-picker-more">+${rest}</span>` : ""}
    </div>`;
}

function renderClientPickerList(dialog, state) {
  rememberOpenPickerClients(dialog);
  const selectedIds = readPickerCaseIds(dialog);
  const allClients = visibleClientOptions(dialog, state);
  const clients = allClients.slice(0, clientPickerRenderLimit);
  const selectedClients = selectedClientNames(state, selectedIds);
  const openClients = readOpenPickerClients(dialog);
  const hasOpenClientInResults = clients.some((client) => openClients.has(client));
  const status = dialog.querySelector("[data-settings-client-picker-status]");
  renderClientPickerSelectedSummary(dialog, state, selectedIds);
  if (status) {
    status.innerHTML = `
      <span>${allClients.length} з ${caseClientOptions(state).length} клієнтів</span>
      <strong>${selectedClients.length} вибрано · ${selectedIds.size} справ</strong>
    `;
  }
  const list = dialog.querySelector("[data-settings-client-dialog-list]");
  if (!list) return;
  if (!clients.length) {
    list.innerHTML = `<div class="settings-case-empty">Клієнтів за цим пошуком не знайдено.</div>`;
    return;
  }
  const limitNotice = allClients.length > clients.length
    ? `<div class="settings-client-dialog-limit">Показано перші ${clients.length} з ${allClients.length}. Уточніть пошук за прізвищем, назвою або номером справи.</div>`
    : "";
  list.innerHTML = clients.map((client, index) => {
    const clientCases = casesForClient(state, client);
    const selectedCount = clientCases.filter((caseItem) => selectedIds.has(caseAccessKey(caseItem))).length;
    const allSelected = clientCases.length > 0 && selectedCount === clientCases.length;
    const partialSelected = selectedCount > 0 && !allSelected;
    const shouldOpen = hasOpenClientInResults ? openClients.has(client) : index === 0;
    return `
      <details class="settings-client-dialog-choice ${allSelected ? "is-selected" : ""} ${partialSelected ? "is-partial" : ""}" data-picker-client="${cleanAttribute(client)}" ${shouldOpen ? "open" : ""}>
        <summary class="settings-client-dialog-summary">
          <input class="settings-client-dialog-master" type="checkbox" name="clientScope" value="${cleanAttribute(client)}" data-client-scope-client="${cleanAttribute(client)}" aria-label="Вибрати всі справи клієнта ${cleanAttribute(client)}" ${allSelected ? "checked" : ""}>
          <span class="settings-client-dialog-copy">
            <strong>${cleanSettingValue(client)}</strong>
            <em>${partialSelected ? "Вибрані тільки окремі справи" : "Галочка зліва вибирає всі справи"}</em>
          </span>
          <span class="settings-client-dialog-count">${selectedCount}/${clientCases.length} справ</span>
        </summary>
        <div class="settings-client-case-list">
          ${clientCases.map((caseItem) => `
            <label class="settings-client-case-choice">
              <input type="checkbox" name="clientCaseScope" value="${cleanAttribute(caseAccessKey(caseItem))}" data-client-case-client="${cleanAttribute(client)}" ${selectedIds.has(caseAccessKey(caseItem)) ? "checked" : ""}>
              <span>
                <strong>№${caseAccessKey(caseItem)}</strong>
                <em>${cleanSettingValue(caseItem.title || caseItem.stage || "Справу не названо")}</em>
              </span>
            </label>
          `).join("")}
        </div>
      </details>`;
  }).join("") + limitNotice;
  list.querySelectorAll("input[name='clientScope']").forEach((input) => {
    const client = input.dataset.clientScopeClient;
    const clientCases = casesForClient(state, client);
    const selectedCount = clientCases.filter((caseItem) => selectedIds.has(caseAccessKey(caseItem))).length;
    input.indeterminate = selectedCount > 0 && selectedCount < clientCases.length;
  });
}

function ensureClientPickerDialog(ctx) {
  let dialog = document.querySelector("#settings-client-picker-dialog");
  if (dialog) return dialog;
  dialog = document.createElement("dialog");
  dialog.id = "settings-client-picker-dialog";
  dialog.innerHTML = `
    <form method="dialog" class="modal-form crm-modal-form settings-client-picker-form" id="settings-client-picker-form">
      <div class="modal-head crm-modal-head">
        <div class="crm-modal-title">
          <span class="crm-modal-title-icon">${icon("users")}</span>
          <div>
            <h2>Вибір клієнтів</h2>
            <p class="muted">Знайдіть клієнта за прізвищем, назвою або номером справи та додайте доступ одним кліком.</p>
          </div>
        </div>
        <button class="crm-modal-close settings-modal-close" type="button" data-settings-client-picker-close aria-label="Закрити" title="Закрити">${icon("x")}</button>
      </div>
      <div class="settings-client-picker-toolbar">
        <label class="crm-modal-field">Пошук клієнта
          <input name="clientSearch" type="search" placeholder="Наприклад, Петренко або №2026/12345" data-settings-client-search>
        </label>
        <div class="settings-client-picker-status" data-settings-client-picker-status></div>
      </div>
      <div class="settings-client-picker-quick-actions">
        <button type="button" class="secondary compact" data-settings-client-picker-add-visible>Додати знайдених</button>
        <button type="button" class="secondary compact" data-settings-client-picker-clear>Очистити вибір</button>
      </div>
      <div class="settings-client-picker-selected" data-settings-client-picker-selected></div>
      <div class="settings-client-dialog-list" data-settings-client-dialog-list></div>
      <div class="crm-modal-actions settings-client-picker-actions">
        <button type="submit" class="primary">Застосувати вибір</button>
      </div>
    </form>
  `;
  document.body.append(dialog);
  dialog.querySelector("[data-settings-client-picker-close]")?.addEventListener("click", () => dialog.close());
  dialog.querySelector("[data-settings-client-search]")?.addEventListener("input", () => renderClientPickerList(dialog, ctx.state));
  dialog.querySelector("[data-settings-client-picker-clear]")?.addEventListener("click", () => {
    writePickerCaseIds(dialog, new Set());
    renderClientPickerList(dialog, ctx.state);
  });
  dialog.querySelector("[data-settings-client-picker-add-visible]")?.addEventListener("click", () => {
    const selectedIds = readPickerCaseIds(dialog);
    renderedClientOptions(dialog, ctx.state).forEach((client) => applyClientScopeChangeToSet(ctx.state, selectedIds, client, true));
    writePickerCaseIds(dialog, selectedIds);
    renderClientPickerList(dialog, ctx.state);
  });
  dialog.querySelector("[data-settings-client-picker-selected]")?.addEventListener("click", (event) => {
    const removeButton = event.target?.closest("[data-settings-picker-remove-client]");
    if (!removeButton) return;
    const selectedIds = readPickerCaseIds(dialog);
    applyClientScopeChangeToSet(ctx.state, selectedIds, removeButton.dataset.settingsPickerRemoveClient, false);
    writePickerCaseIds(dialog, selectedIds);
    renderClientPickerList(dialog, ctx.state);
  });
  dialog.querySelector("[data-settings-client-dialog-list]")?.addEventListener("change", (event) => {
    const selectedIds = readPickerCaseIds(dialog);
    if (event.target?.name === "clientScope") {
      applyClientScopeChangeToSet(ctx.state, selectedIds, event.target.value, event.target.checked);
    } else if (event.target?.name === "clientCaseScope") {
      if (event.target.checked) selectedIds.add(event.target.value);
      else selectedIds.delete(event.target.value);
    } else {
      return;
    }
    writePickerCaseIds(dialog, selectedIds);
    renderClientPickerList(dialog, ctx.state);
  });
  dialog.querySelector("[data-settings-client-dialog-list]")?.addEventListener("click", (event) => {
    if (event.target?.closest("input[name='clientScope']")) {
      event.stopPropagation();
    }
  });
  dialog.querySelector("[data-settings-client-dialog-list]")?.addEventListener("toggle", (event) => {
    if (event.target?.classList?.contains("settings-client-dialog-choice")) {
      rememberOpenPickerClients(dialog);
    }
  }, true);
  dialog.querySelector("#settings-client-picker-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const parentForm = dialog.settingsParentForm;
    if (!parentForm) return;
    const selectedIds = readPickerCaseIds(dialog);
    writeStoredCaseIds(parentForm, selectedIds);
    writeVisibleCaseIds(parentForm, selectedIds);
    writeAccessClientNames(parentForm, selectedClientNames(ctx.state, selectedIds));
    writeHiddenCaseIds(parentForm, new Set());
    refreshCaseGrid(parentForm, ctx.state, { syncFromVisibleCases: false });
    dialog.close();
  });
  return dialog;
}

function applyClientScopeChangeToSet(state, selectedIds, client, shouldSelect) {
  casesForClient(state, client).forEach((caseItem) => {
    const key = caseAccessKey(caseItem);
    if (!key) return;
    if (shouldSelect) selectedIds.add(key);
    else selectedIds.delete(key);
  });
}

function openClientPickerDialog(ctx, parentForm) {
  syncStoredCaseIdsFromForm(parentForm);
  const dialog = ensureClientPickerDialog(ctx);
  dialog.settingsParentForm = parentForm;
  writePickerCaseIds(dialog, readStoredCaseIds(parentForm));
  const search = dialog.querySelector("[data-settings-client-search]");
  if (search) search.value = "";
  writeOpenPickerClients(dialog, new Set());
  renderClientPickerList(dialog, ctx.state);
  dialog.showModal();
  search?.focus();
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
  syncSettingsCustomSelects(form);
}

function applyAccessPresetToForm(form, icon) {
  const access = form.elements.access.value;
  if (access === "Індивідуальний доступ") return;
  form.querySelector("[data-settings-permissions-grid]").innerHTML = renderPermissionCheckboxes(icon, accessPermissionMap[access] || []);
}

function closeSettingsCustomSelects(form, except = null) {
  form.querySelectorAll(".settings-custom-select").forEach((control) => {
    if (control === except) return;
    control.classList.remove("is-open");
    control.querySelector("[data-settings-custom-select-trigger]")?.setAttribute("aria-expanded", "false");
    control.querySelector("[data-settings-custom-select-menu]")?.setAttribute("hidden", "");
  });
}

function openSettingsCustomSelect(form, control, focusSelected = false) {
  const trigger = control.querySelector("[data-settings-custom-select-trigger]");
  const menu = control.querySelector("[data-settings-custom-select-menu]");
  closeSettingsCustomSelects(form, control);
  control.classList.add("is-open");
  trigger.setAttribute("aria-expanded", "true");
  menu.removeAttribute("hidden");
  if (focusSelected) {
    (control.querySelector(".settings-custom-select-option.is-selected") || control.querySelector("[data-settings-custom-select-option]"))?.focus({ preventScroll: true });
  }
}

function selectSettingsCustomOption(form, option) {
  const control = option.closest(".settings-custom-select");
  const select = form.elements[control.dataset.selectName];
  select.value = option.dataset.value;
  select.dispatchEvent(new Event("change", { bubbles: true }));
  closeSettingsCustomSelects(form);
  control.querySelector("[data-settings-custom-select-trigger]")?.focus({ preventScroll: true });
}

function moveSettingsCustomSelectFocus(control, direction = 1) {
  const options = [...control.querySelectorAll("[data-settings-custom-select-option]")];
  if (!options.length) return;
  const currentIndex = Math.max(0, options.indexOf(document.activeElement));
  const fallbackIndex = Math.max(0, options.findIndex((option) => option.classList.contains("is-selected")));
  const baseIndex = document.activeElement?.matches?.("[data-settings-custom-select-option]") ? currentIndex : fallbackIndex;
  const nextIndex = (baseIndex + direction + options.length) % options.length;
  options[nextIndex].focus({ preventScroll: true });
}

function syncSettingsCustomSelect(select) {
  const control = select.closest(".settings-custom-select-field")?.querySelector(".settings-custom-select");
  if (!control) return;
  const value = select.value;
  const label = select.selectedOptions?.[0]?.textContent || value;
  control.querySelector("[data-settings-custom-select-value]").textContent = label;
  control.querySelectorAll("[data-settings-custom-select-option]").forEach((option) => {
    const selected = option.dataset.value === value;
    option.classList.toggle("is-selected", selected);
    option.setAttribute("aria-selected", selected ? "true" : "false");
  });
}

function syncSettingsCustomSelects(form) {
  form.querySelectorAll("select[data-settings-custom-select-source]").forEach(syncSettingsCustomSelect);
}

function setupSettingsCustomSelect(select, icon) {
  if (!select || select.dataset.settingsCustomSelectSource) return;
  const field = select.closest(".crm-modal-field");
  if (!field) return;
  field.classList.add("settings-custom-select-field");
  select.dataset.settingsCustomSelectSource = "true";
  const options = [...select.options];
  const control = document.createElement("div");
  control.className = "settings-custom-select";
  control.dataset.selectName = select.name;
  control.innerHTML = `
    <button type="button" class="settings-custom-select-trigger" data-settings-custom-select-trigger aria-haspopup="listbox" aria-expanded="false">
      <span data-settings-custom-select-value></span>
      <span class="settings-custom-select-arrow" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m7 10 5 5 5-5"></path></svg></span>
    </button>
    <div class="settings-custom-select-menu" data-settings-custom-select-menu role="listbox" hidden>
      ${options.map((option) => `
        <button type="button" class="settings-custom-select-option" role="option" data-settings-custom-select-option data-value="${cleanAttribute(option.value)}">
          ${icon("check")}
          <span>${option.textContent}</span>
        </button>
      `).join("")}
    </div>
  `;
  select.insertAdjacentElement("afterend", control);
  syncSettingsCustomSelect(select);
}

function ensureTemporaryPasswordInfoDialog() {
  let dialog = document.querySelector("#settings-password-info-dialog");
  if (dialog) return dialog;
  dialog = document.createElement("dialog");
  dialog.id = "settings-password-info-dialog";
  dialog.innerHTML = `
    <div class="modal-form crm-modal-form settings-password-info-dialog">
      <div class="modal-head crm-modal-head">
        <div class="crm-modal-title">
          <span class="crm-modal-title-icon">i</span>
          <div>
            <h2>Тимчасовий пароль</h2>
            <p class="muted">Навіщо він потрібен і що відбувається після входу.</p>
          </div>
        </div>
        <button class="crm-modal-close settings-modal-close" type="button" data-settings-password-info-close aria-label="Закрити" title="Закрити">${icon("x")}</button>
      </div>
      <div class="settings-password-info-body">
        <p><strong>Тимчасовий пароль</strong> використовується, коли адміністратор створює нового користувача або відновлює доступ існуючому співробітнику.</p>
        <div>
          <span>1</span>
          <p>CRM зберігає пароль як стартовий доступ для входу користувача.</p>
        </div>
        <div>
          <span>2</span>
          <p>Коли увімкнено перемикач, користувач має змінити пароль після входу.</p>
        </div>
        <div>
          <span>3</span>
          <p>Це зручно для безпечної передачі доступу: адміністратор задає пароль, а користувач одразу встановлює свій.</p>
        </div>
        <em>Якщо пароль не змінювати, залиште поле пароля порожнім під час редагування користувача.</em>
      </div>
      <div class="crm-modal-actions">
        <button type="button" class="primary" data-settings-password-info-close>Зрозуміло</button>
      </div>
    </div>
  `;
  document.body.append(dialog);
  dialog.querySelectorAll("[data-settings-password-info-close]").forEach((button) => {
    button.addEventListener("click", () => dialog.close());
  });
  return dialog;
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
  syncSettingsCustomSelects(form);
  form.querySelector("[data-settings-permissions-grid]").innerHTML = renderPermissionCheckboxes(icon, userPermissionKeys(user || { role: form.elements.role.value }));
  form.elements.caseSearch.value = "";
  writeStoredCaseIds(form, selectedCaseIds(user));
  writeVisibleCaseIds(form, readStoredCaseIds(form));
  writeAccessClientNames(form, selectedClientNames(state, readStoredCaseIds(form)));
  writeHiddenCaseIds(form, new Set());
  writeOpenCaseClients(form, new Set());
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

async function deleteSettingsUserAtIndex(ctx, index) {
  const { state, saveNavigationState, showToast } = ctx;
  const removed = state.settingsUsers[index];
  if (!removed) return false;
  if (shouldUseApi(state) && removed.id) {
    try {
      await deleteSettingsUserFromApi(removed.id);
    } catch (_error) {
      showToast("Не вдалося видалити користувача з бази.", "danger");
      return false;
    }
  }
  state.settingsUsers.splice(index, 1);
  state.settingsOpenUserMenu = "";
  addSettingsAudit(state, `Видалено користувача ${removed.name}.`, "red");
  saveNavigationState();
  renderSettingsScreen(ctx);
  showToast(`Користувача ${removed.name} видалено.`, "danger");
  return true;
}

function fillDeleteUserDialog(dialog, ctx, index) {
  const user = ctx.state.settingsUsers[index];
  dialog.querySelector("[data-settings-delete-user-name]").textContent = user?.name || "користувача";
  dialog.querySelector("[data-settings-delete-user-email]").textContent = user?.email || "email не вказано";
  dialog.querySelector("[data-settings-delete-user-role]").textContent = user?.role || "роль не вказана";
  dialog.querySelector("[data-settings-delete-user-confirm]").disabled = !user;
  dialog.dataset.userIndex = String(index);
}

function ensureDeleteUserDialog(ctx) {
  const { icon } = ctx;
  let dialog = document.querySelector("#settings-user-delete-dialog");
  if (dialog) return dialog;
  dialog = document.createElement("dialog");
  dialog.id = "settings-user-delete-dialog";
  dialog.innerHTML = `
    <div class="modal-form crm-modal-form settings-user-delete-dialog">
      <div class="modal-head crm-modal-head">
        <div class="crm-modal-title">
          <span class="crm-modal-title-icon settings-delete-title-icon">${icon("trash")}</span>
          <div>
            <h2>Видалити користувача?</h2>
            <p class="muted">Цю дію потрібно підтвердити, щоб випадково не прибрати доступ співробітника.</p>
          </div>
        </div>
        <button class="crm-modal-close settings-modal-close" type="button" data-settings-delete-user-cancel aria-label="Закрити" title="Закрити">${icon("x")}</button>
      </div>
      <div class="settings-delete-warning">
        <span>${icon("bell")}</span>
        <div>
          <strong data-settings-delete-user-name></strong>
          <em><span data-settings-delete-user-role></span> · <span data-settings-delete-user-email></span></em>
          <p>Після видалення користувач зникне зі списку команди та втратить налаштований доступ до CRM.</p>
        </div>
      </div>
      <div class="crm-modal-actions settings-delete-actions">
        <button type="button" class="secondary" data-settings-delete-user-cancel>Скасувати</button>
        <button type="button" class="primary danger" data-settings-delete-user-confirm>${icon("trash")} Видалити користувача</button>
      </div>
    </div>
  `;
  document.body.append(dialog);
  dialog.querySelectorAll("[data-settings-delete-user-cancel]").forEach((button) => {
    button.addEventListener("click", () => dialog.close());
  });
  dialog.querySelector("[data-settings-delete-user-confirm]")?.addEventListener("click", async () => {
    const button = dialog.querySelector("[data-settings-delete-user-confirm]");
    const index = Number(dialog.dataset.userIndex);
    button.disabled = true;
    const deleted = await deleteSettingsUserAtIndex(ctx, index);
    button.disabled = false;
    if (deleted) dialog.close();
  });
  return dialog;
}

async function clearSettingsAuditLog(ctx) {
  const { state, saveNavigationState, showToast } = ctx;
  if (shouldUseApi(state)) {
    try {
      await clearAuditLogsFromApi();
    } catch (_error) {
      showToast("Не вдалося очистити журнал в базі.", "danger");
      return false;
    }
  }
  state.auditLogs = [];
  state.settingsAudit = [];
  saveNavigationState();
  renderSettingsScreen(ctx);
  showToast("Журнал змін очищено.");
  return true;
}

function ensureClearAuditDialog(ctx) {
  const { icon } = ctx;
  let dialog = document.querySelector("#settings-audit-clear-dialog");
  if (dialog) return dialog;
  dialog = document.createElement("dialog");
  dialog.id = "settings-audit-clear-dialog";
  dialog.innerHTML = `
    <div class="modal-form crm-modal-form settings-audit-clear-dialog">
      <div class="modal-head crm-modal-head">
        <div class="crm-modal-title">
          <span class="crm-modal-title-icon settings-audit-clear-title-icon">${icon("trash")}</span>
          <div>
            <h2>Очистити журнал змін?</h2>
            <p class="muted">Журнал дій буде прибрано з цього списку після підтвердження.</p>
          </div>
        </div>
        <button class="crm-modal-close settings-modal-close" type="button" data-settings-clear-audit-cancel aria-label="Закрити" title="Закрити">${icon("x")}</button>
      </div>
      <div class="settings-audit-clear-warning">
        <span>${icon("bell")}</span>
        <div>
          <strong>Перед очищенням перевірте, що історія більше не потрібна.</strong>
          <p>Це прибере записи про зміни користувачів, інтеграцій і налаштувань з журналу CRM.</p>
        </div>
      </div>
      <div class="crm-modal-actions settings-delete-actions">
        <button type="button" class="secondary" data-settings-clear-audit-cancel>Скасувати</button>
        <button type="button" class="primary danger" data-settings-clear-audit-confirm>${icon("trash")} Очистити журнал</button>
      </div>
    </div>
  `;
  document.body.append(dialog);
  dialog.querySelectorAll("[data-settings-clear-audit-cancel]").forEach((button) => {
    button.addEventListener("click", () => dialog.close());
  });
  dialog.querySelector("[data-settings-clear-audit-confirm]")?.addEventListener("click", async () => {
    const button = dialog.querySelector("[data-settings-clear-audit-confirm]");
    button.disabled = true;
    const cleared = await clearSettingsAuditLog(ctx);
    button.disabled = false;
    if (cleared) dialog.close();
  });
  return dialog;
}

function ensureInviteDialog(ctx) {
  let dialog = document.querySelector("#settings-invite-dialog");
  if (dialog) return dialog;
  dialog = document.createElement("dialog");
  dialog.id = "settings-invite-dialog";
  dialog.innerHTML = `
    <form method="dialog" class="modal-form crm-modal-form settings-invite-form settings-user-form" id="settings-invite-form">
      <div class="modal-head crm-modal-head settings-invite-head">
        <div class="crm-modal-title settings-invite-title">
          <span class="crm-modal-title-icon settings-invite-title-icon">${icon("userPlus")}</span>
          <div>
            <h2 data-settings-user-dialog-title>Створити користувача</h2>
            <p class="muted">Налаштуйте роль, доступ до меню CRM і список справ користувача.</p>
          </div>
        </div>
        <button class="crm-modal-close settings-modal-close" type="button" data-settings-invite-close aria-label="Закрити" title="Закрити">${icon("x")}</button>
      </div>
      <div class="settings-user-form-grid">
        <label class="crm-modal-field required">Ім'я та прізвище<input name="name" required placeholder="Наприклад, Шевченко Марія Ігорівна"></label>
        <label class="crm-modal-field required">Email<input name="email" type="email" required placeholder="user@example.com"></label>
        <label class="crm-modal-field">Аватар / фото<input name="photo" placeholder="Ініціали або URL фото"></label>
        <div class="crm-modal-field settings-password-field">
          <span class="settings-password-field-label">Пароль</span>
          <div class="settings-password-input-row">
            <input name="password" type="text" placeholder="Залишити без змін" aria-label="Пароль користувача">
            <button type="button" class="settings-password-generate" data-settings-generate-password aria-label="Згенерувати тимчасовий пароль" title="Згенерувати тимчасовий пароль">${icon("refresh")}</button>
          </div>
        </div>
        <label class="crm-modal-field settings-select-field">Роль
          <select name="role">
            <option>Адвокат</option>
            <option>Помічник</option>
            <option>Бухгалтер</option>
            <option>Адміністратор</option>
          </select>
        </label>
      </div>
      <label class="settings-password-temporary">
        <input name="passwordTemporary" type="checkbox">
        <span class="settings-password-copy">
          <strong>Тимчасовий пароль <button type="button" class="settings-password-info-trigger" data-settings-password-info aria-label="Пояснення тимчасового пароля" title="Пояснення тимчасового пароля">i</button></strong>
          <em>Вимагати зміну пароля при вході</em>
        </span>
        <span class="settings-password-switch" aria-hidden="true"></span>
      </label>
      <label class="crm-modal-field settings-select-field">Доступ
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
          <label class="settings-case-search-field">Пошук або додавання справи
            <input name="caseSearch" type="search" placeholder="Номер справи, клієнт, стадія або назва" data-settings-case-search>
          </label>
          <label class="settings-case-meta-field">Підсумок доступу
            <small data-settings-case-filter-meta></small>
          </label>
          <div class="settings-client-picker" data-settings-client-picker></div>
        </div>
        <div class="settings-cases-grid" data-settings-cases-grid></div>
      </section>
      <div class="crm-modal-actions settings-user-form-actions">
        <button type="submit" class="primary" data-settings-user-submit>Створити користувача</button>
      </div>
    </form>
  `;
  document.body.append(dialog);
  const form = dialog.querySelector("#settings-invite-form");
  setupSettingsCustomSelect(form?.elements.role, icon);
  setupSettingsCustomSelect(form?.elements.access, icon);
  form?.elements.role?.addEventListener("change", () => {
    applyRoleDefaultsToForm(form, icon);
    syncCaseScope(form);
    syncSettingsCustomSelects(form);
  });
  form?.elements.access?.addEventListener("change", () => {
    applyAccessPresetToForm(form, icon);
    syncSettingsCustomSelects(form);
  });
  form?.addEventListener("click", (event) => {
    const trigger = event.target?.closest("[data-settings-custom-select-trigger]");
    const option = event.target?.closest("[data-settings-custom-select-option]");
    const generatePassword = event.target?.closest("[data-settings-generate-password]");
    const passwordInfo = event.target?.closest("[data-settings-password-info]");
    if (passwordInfo) {
      event.preventDefault();
      event.stopPropagation();
      ensureTemporaryPasswordInfoDialog().showModal();
      return;
    }
    if (generatePassword) {
      event.preventDefault();
      form.elements.password.value = generateTemporaryPassword();
      form.elements.passwordTemporary.checked = true;
      form.elements.password.focus();
      return;
    }
    if (trigger) {
      event.preventDefault();
      const control = trigger.closest(".settings-custom-select");
      const shouldOpen = !control.classList.contains("is-open");
      if (shouldOpen) openSettingsCustomSelect(form, control);
      else closeSettingsCustomSelects(form);
      return;
    }
    if (option) {
      event.preventDefault();
      selectSettingsCustomOption(form, option);
      return;
    }
    if (!event.target?.closest(".settings-custom-select")) {
      closeSettingsCustomSelects(form);
    }
  });
  form?.addEventListener("keydown", (event) => {
    const trigger = event.target?.closest("[data-settings-custom-select-trigger]");
    const option = event.target?.closest("[data-settings-custom-select-option]");
    const control = event.target?.closest(".settings-custom-select");
    if (!control || (!trigger && !option)) return;
    if (trigger && ["Enter", " ", "ArrowDown", "ArrowUp"].includes(event.key)) {
      event.preventDefault();
      openSettingsCustomSelect(form, control, true);
      if (event.key === "ArrowUp") moveSettingsCustomSelectFocus(control, -1);
      return;
    }
    if (option && ["Enter", " "].includes(event.key)) {
      event.preventDefault();
      selectSettingsCustomOption(form, option);
      return;
    }
    if (option && event.key === "ArrowDown") {
      event.preventDefault();
      moveSettingsCustomSelectFocus(control, 1);
      return;
    }
    if (option && event.key === "ArrowUp") {
      event.preventDefault();
      moveSettingsCustomSelectFocus(control, -1);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      closeSettingsCustomSelects(form);
      control.querySelector("[data-settings-custom-select-trigger]")?.focus({ preventScroll: true });
    }
  });
  document.addEventListener("click", (event) => {
    if (!dialog.open || dialog.contains(event.target)) return;
    closeSettingsCustomSelects(form);
  });
  form?.addEventListener("change", (event) => {
    if (event.target?.name === "permissionKeys") {
      form.elements.access.value = "Індивідуальний доступ";
      syncSettingsCustomSelects(form);
    }
    if (event.target?.name === "assignedCaseIds") {
      const selectedIds = syncStoredCaseIdsFromForm(form);
      const visibleIds = readVisibleCaseIds(form);
      const visibleClients = readAccessClientNames(form);
      const hiddenIds = readHiddenCaseIds(form);
      const caseItem = (ctx.state.cases || []).find((item) => caseAccessKey(item) === event.target.value);
      const client = caseClientName(ctx.state, caseItem);
      if (client) visibleClients.add(client);
      visibleIds.add(event.target.value);
      hiddenIds.delete(event.target.value);
      writeStoredCaseIds(form, selectedIds);
      writeVisibleCaseIds(form, visibleIds);
      writeAccessClientNames(form, visibleClients);
      writeHiddenCaseIds(form, hiddenIds);
      refreshCaseGrid(form, ctx.state, { syncFromVisibleCases: false });
    }
  });
  form?.addEventListener("toggle", (event) => {
    if (event.target?.classList?.contains("settings-case-group")) {
      rememberOpenCaseGroups(form);
    }
  }, true);
  form?.addEventListener("click", (event) => {
    const hideCase = event.target?.closest("[data-settings-hide-case]");
    if (hideCase) {
      event.preventDefault();
      event.stopPropagation();
      const selectedIds = syncStoredCaseIdsFromForm(form);
      const visibleIds = readVisibleCaseIds(form);
      const hiddenIds = readHiddenCaseIds(form);
      selectedIds.delete(hideCase.dataset.settingsHideCase);
      visibleIds.delete(hideCase.dataset.settingsHideCase);
      hiddenIds.add(hideCase.dataset.settingsHideCase);
      writeStoredCaseIds(form, selectedIds);
      writeVisibleCaseIds(form, visibleIds);
      writeHiddenCaseIds(form, hiddenIds);
      refreshCaseGrid(form, ctx.state, { syncFromVisibleCases: false });
      return;
    }
    const clearClientCases = event.target?.closest("[data-settings-clear-client-cases]");
    if (clearClientCases) {
      event.preventDefault();
      event.stopPropagation();
      applyClientScopeChange(form, ctx.state, clearClientCases.dataset.settingsClearClientCases, false, { keepVisible: true });
      return;
    }
    const removeClient = event.target?.closest("[data-settings-remove-client]");
    if (removeClient) {
      applyClientScopeChange(form, ctx.state, removeClient.dataset.settingsRemoveClient, false);
      return;
    }
    if (event.target?.closest("[data-settings-open-client-picker]")) {
      openClientPickerDialog(ctx, form);
    }
  });
  form?.elements.caseSearch?.addEventListener("input", () => refreshCaseGrid(form, ctx.state));
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
    { key: "Е-підпис", iconName: "signature", description: "Відправка документів на КЕП, контроль статусу та архів підписаних файлів", modules: "Документи, справи" },
    { key: "ONLYOFFICE", iconName: "file", description: "Повноцінний Word-редактор у CRM для DOCX, коментарів і версій", modules: "Документи, шаблони" },
    { key: "AI", iconName: "search", description: "AI помічники, аналіз справ і чернетки документів", modules: "AI, OSINT, документи" }
  ];
  if (shouldUseApi(state) && !state.mailingProviderStatus && !state.loadingMailingProviderStatus) {
    state.loadingMailingProviderStatus = true;
    refreshMailingProviderStatus(ctx)
      .catch(() => {})
      .finally(() => {
        state.loadingMailingProviderStatus = false;
        renderSettingsScreen(ctx);
      });
  }
  const activeIntegrations = integrations.filter((item) => state.settingsIntegrations[item.key]).length;
  const providerStatusByChannel = Object.fromEntries((state.mailingProviderStatus?.channels || []).map((item) => [item.channel, item]));
  const enabledNotifications = Object.values(state.settingsNotifications || {}).filter(Boolean).length;
  const activeUsers = users.filter((user) => user.role !== "Видалений").length;
  state.settingsFocusedSection ||= "profile";
  const readiness = buildProjectReadiness(state, activeIntegrations, integrations.length, activeUsers);
  const pilotChecklist = buildPilotChecklist(state, providerStatusByChannel, activeUsers);
  state.settingsReadinessOpen ||= false;
  if (!shouldUseApi(state) && !state.settingsAudit) {
    state.settingsAudit = [
      { date: settingsAuditDate(0, "09:30"), text: "Синхронізовано канали Telegram та SMS.", tone: "green" },
      { date: settingsAuditDate(1, "18:10"), text: "Оновлено профіль бюро для документів.", tone: "blue" },
      { date: settingsAuditDate(1, "12:40"), text: "Перевірено правила сповіщень по дедлайнах.", tone: "amber" }
    ];
  }
  state.settingsAudit ||= [];
  const auditItems = [
    ...(state.auditLogs || []),
    ...(state.settingsAudit || [])
  ].slice(0, 20);

  $("#settings").innerHTML = `
    <div class="settings-screen">
      <section class="settings-summary-grid">
        <button class="panel settings-summary-card ${state.settingsFocusedSection === "users" ? "active" : ""}" type="button" data-settings-focus="users" aria-pressed="${state.settingsFocusedSection === "users"}">
          <span>${icon("user")}</span>
          <div><strong>${activeUsers}</strong><em>користувачів</em></div>
        </button>
        <button class="panel settings-summary-card ${state.settingsFocusedSection === "integrations" ? "active" : ""}" type="button" data-settings-focus="integrations" aria-pressed="${state.settingsFocusedSection === "integrations"}">
          <span>${icon("refresh")}</span>
          <div><strong>${activeIntegrations}/${integrations.length}</strong><em>інтеграцій увімкнено</em></div>
        </button>
        <button class="panel settings-summary-card ${state.settingsFocusedSection === "notifications" ? "active" : ""}" type="button" data-settings-focus="notifications" aria-pressed="${state.settingsFocusedSection === "notifications"}">
          <span>${icon("bell")}</span>
          <div><strong>${enabledNotifications}</strong><em>типи сповіщень</em></div>
        </button>
        <button class="panel settings-summary-card ${state.settingsFocusedSection === "audit" ? "active" : ""}" type="button" data-settings-focus="audit" aria-pressed="${state.settingsFocusedSection === "audit"}">
          <span>${icon("check")}</span>
          <div><strong>${auditItems.length}</strong><em>дій у журналі</em></div>
        </button>
        <button class="panel settings-summary-card settings-summary-readiness tone-${readinessTone(readiness.overall)} ${state.settingsReadinessOpen ? "active" : ""}" type="button" data-settings-readiness-toggle aria-expanded="${state.settingsReadinessOpen ? "true" : "false"}">
          <span>${icon("chart")}</span>
          <div><strong>${readiness.overall}%</strong><em>готовність CRM</em></div>
        </button>
      </section>

      ${state.settingsReadinessOpen ? renderReadinessSection(readiness, pilotChecklist, badge, true) : ""}

      <section class="panel settings-profile-card ${state.settingsFocusedSection === "profile" ? "is-focused" : ""}" data-settings-section="profile">
        <div class="settings-section-head">
          <div>
            <h2>Профіль бюро</h2>
            <p class="muted">Основні дані, які використовуються в документах, розсилках і профілі адміністратора.</p>
          </div>
          <button type="button" class="secondary settings-profile-save" data-save-settings>${icon("check")} Зберегти профіль</button>
        </div>
        <div class="settings-profile-layout">
          <div class="settings-bureau-logo-card">
            <div class="settings-bureau-logo-preview">${renderBureauLogo(state.bureauSettings)}</div>
            <div class="settings-logo-source">
              <input type="hidden" data-bureau-field="logo" value="${cleanAttribute(state.bureauSettings.logo || "")}" />
              <div class="settings-logo-actions">
                <label class="secondary settings-logo-upload" aria-label="Завантажити логотип" title="Завантажити логотип">${icon("upload")}
                  <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" data-bureau-logo-upload />
                </label>
                <input data-bureau-logo-manual value="${cleanAttribute(bureauLogoDisplayValue(state.bureauSettings))}" placeholder="URL або AB" />
              </div>
            </div>
          </div>
          <div class="settings-profile-fields">
            <div class="settings-form-grid settings-bureau-main-grid">
              <label>Назва бюро<input data-bureau-field="name" value="${cleanAttribute(state.bureauSettings.name || "")}" /></label>
              <label>Email<input data-bureau-field="email" value="${cleanAttribute(state.bureauSettings.email || "")}" /></label>
              <label><span class="settings-field-title">${brandIcon("phone")} Телефон</span><input data-bureau-field="phone" value="${cleanAttribute(state.bureauSettings.phone || "")}" /></label>
              <label><span class="settings-field-title">${brandIcon("telegram")} Telegram</span><input data-bureau-field="telegram" value="${cleanAttribute(state.bureauSettings.telegram || "")}" placeholder="@username або URL" /></label>
              <label class="settings-wide-field">Адреса<input data-bureau-field="address" value="${cleanAttribute(state.bureauSettings.address || "")}" /></label>
              <label><span class="settings-field-title">${brandIcon("whatsapp")} WhatsApp</span><input data-bureau-field="whatsapp" value="${cleanAttribute(state.bureauSettings.whatsapp || "")}" placeholder="+380..." /></label>
            </div>
            <div class="settings-social-grid">
              <label><span class="settings-field-title">${brandIcon("instagram")} Instagram</span><input data-bureau-field="instagram" value="${cleanAttribute(state.bureauSettings.instagram || "")}" placeholder="@bureau або URL" /></label>
              <label><span class="settings-field-title">${brandIcon("facebook")} Facebook</span><input data-bureau-field="facebook" value="${cleanAttribute(state.bureauSettings.facebook || "")}" placeholder="Сторінка або URL" /></label>
              <label><span class="settings-field-title">${brandIcon("tiktok")} TikTok</span><input data-bureau-field="tiktok" value="${cleanAttribute(state.bureauSettings.tiktok || "")}" placeholder="@bureau або URL" /></label>
              <label><span class="settings-field-title">${brandIcon("website")} Сайт</span><input data-bureau-field="website" value="${cleanAttribute(state.bureauSettings.website || "")}" placeholder="https://example.com" /></label>
            </div>
          </div>
        </div>
      </section>

      <section class="panel settings-users-card ${state.settingsFocusedSection === "users" ? "is-focused" : ""}" data-settings-section="users">
        <div class="settings-section-head">
          <div>
            <h2>Користувачі</h2>
            <p class="muted">Ролі команди та рівні доступу до CRM.</p>
          </div>
          <button type="button" class="primary settings-invite-action" data-settings-action="invite">${icon("userPlus")} Додати користувача</button>
        </div>
        <div class="settings-users-list">
          ${users.map((user, index) => {
            const viewUser = displaySettingsUser(user, state);
            return `<article class="settings-user-row">
            <div class="settings-user-identity">
              ${renderUserAvatar(viewUser)}
              <div class="settings-user-main">
                <strong>${escapeHtml(viewUser.name)}</strong>
                <span>${escapeHtml(viewUser.email || "email не вказано")}</span>
                <em>${escapeHtml(viewUser.role)}</em>
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
          ${integrations.map((item) => {
            const providerStatus = providerStatusByChannel[item.key];
            const providerTone = providerStatus?.status === "ready" ? "green" : providerStatus?.status === "disabled" ? "red" : "amber";
            const needsConfig = providerStatus?.status === "setup";
            return `<article class="settings-integration-row">
            <div class="settings-integration-main">
              <div class="settings-integration-copy">
                <div class="settings-integration-heading">
                  <strong>${item.key}</strong>
                  <button type="button" class="settings-integration-config-button ${needsConfig ? "needs-config" : ""}" data-settings-integration-config="${item.key}" aria-label="Налаштувати ${item.key}" title="${needsConfig ? "Потрібно заповнити параметри підключення" : `Налаштувати ${item.key}`}">${icon("gear")}</button>
                </div>
                <em>${item.description}</em>
              </div>
              <div class="settings-integration-corner">
                <span class="settings-integration-icon">${icon(item.iconName)}</span>
                ${providerStatus ? badge(providerStatus.label, providerTone) : badge(state.settingsIntegrations[item.key] ? "Підключено" : "Вимкнено", state.settingsIntegrations[item.key] ? "green" : "red")}
              </div>
            </div>
            <div class="settings-integration-meta">
              <span>${item.modules}</span>
              ${providerStatus ? `<span>${providerStatus.provider}</span>` : ""}
            </div>
            <div class="settings-integration-control ${providerStatus ? "has-test" : ""}">
              ${providerStatus ? `<button type="button" class="secondary compact" data-settings-provider-test="${item.key}" ${state.settingsTestingProvider === item.key ? "disabled" : ""}>Тест</button>` : ""}
              <label class="settings-switch" aria-label="${item.key}">
                <input type="checkbox" data-settings-integration="${item.key}" ${state.settingsIntegrations[item.key] ? "checked" : ""} />
                <span></span>
              </label>
            </div>
          </article>`;
          }).join("")}
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
            <p class="muted">Останні системні дії по клієнтах, справах, задачах, фінансах, користувачах та інтеграціях.</p>
          </div>
          <div class="settings-section-actions">
            <button type="button" class="secondary" data-settings-refresh-audit>${icon("refresh")} Оновити</button>
            <button type="button" class="secondary" data-settings-clear-audit>${icon("trash")} Очистити</button>
          </div>
        </div>
        <div class="settings-audit-list">
          ${auditItems.length ? auditItems.map((item) => `<article>
            ${badge(item.tone === "green" ? "OK" : item.tone === "red" ? "Увага" : "Info", item.tone)}
            <strong>${cleanSettingValue(item.text || item.summary)}</strong>
            <span>${cleanSettingValue([item.date, item.actor, item.entityLabel].filter(Boolean).join(" · "))}</span>
          </article>`).join("") : `<article class="settings-audit-empty"><strong>Журнал змін порожній</strong><span>Нові системні дії з'являться тут після наступної зміни.</span></article>`}
        </div>
      </section>
    </div>
  `;
  syncBureauBrand(state.bureauSettings);

  document.querySelector("[data-save-settings]")?.addEventListener("click", async () => {
    document.querySelectorAll("[data-bureau-field]").forEach((input) => {
      state.bureauSettings[input.dataset.bureauField] = input.value.trim();
    });
    addSettingsAudit(state, "Збережено основні дані профілю бюро.", "blue");
    try {
      await persistCrmSettings(ctx);
    } catch (_error) {
      showToast("Не вдалося зберегти налаштування в базі.", "danger");
      return;
    }
    saveNavigationState();
    syncBureauBrand(state.bureauSettings);
    renderSettingsScreen(ctx);
    showToast("Налаштування бюро збережено.");
  });
  const refreshBureauLogoPreview = () => {
    document.querySelector(".settings-bureau-logo-preview").innerHTML = renderBureauLogo(state.bureauSettings);
    syncBureauBrand(state.bureauSettings);
  };
  const syncBureauLogoInputs = () => {
    const logoInput = document.querySelector('[data-bureau-field="logo"]');
    const logoManual = document.querySelector("[data-bureau-logo-manual]");
    if (logoInput) logoInput.value = state.bureauSettings.logo || "";
    if (logoManual) logoManual.value = bureauLogoDisplayValue(state.bureauSettings);
  };
  document.querySelector("[data-bureau-logo-manual]")?.addEventListener("input", (event) => {
    state.bureauSettings.logo = event.target.value.trim();
    document.querySelector('[data-bureau-field="logo"]').value = state.bureauSettings.logo;
    refreshBureauLogoPreview();
  });
  document.querySelector("[data-bureau-logo-reset]")?.addEventListener("click", () => {
    state.bureauSettings.logo = defaultBureauLogo;
    syncBureauLogoInputs();
    refreshBureauLogoPreview();
    saveNavigationState();
    showToast("Повернули стандартний логотип.");
  });
  document.querySelector("[data-bureau-logo-upload]")?.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast("Оберіть файл зображення для логотипу.", "danger");
      return;
    }
    if (file.size > 1500000) {
      showToast("Логотип завеликий. Оберіть файл до 1.5 MB.", "danger");
      event.target.value = "";
      return;
    }
    try {
      const dataUrl = await readImageAsDataUrl(file);
      state.bureauSettings.logo = dataUrl;
      syncBureauLogoInputs();
      refreshBureauLogoPreview();
      saveNavigationState();
      showToast("Логотип завантажено. Натисніть «Зберегти профіль», щоб закріпити.");
    } catch (_error) {
      showToast("Не вдалося прочитати файл логотипу.", "danger");
    } finally {
      event.target.value = "";
    }
  });
  document.querySelectorAll("[data-settings-focus]").forEach((button) => button.addEventListener("click", () => {
    state.settingsFocusedSection = button.dataset.settingsFocus;
    renderSettingsScreen(ctx);
    requestAnimationFrame(() => {
      document.querySelector(`[data-settings-section="${state.settingsFocusedSection}"]`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }));
  document.querySelector("[data-settings-readiness-toggle]")?.addEventListener("click", () => {
    state.settingsReadinessOpen = !state.settingsReadinessOpen;
    if (state.settingsReadinessOpen) state.settingsFocusedSection = "readiness";
    renderSettingsScreen(ctx);
    if (state.settingsReadinessOpen) {
      requestAnimationFrame(() => {
        document.querySelector('[data-settings-section="readiness"]')?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    }
  });
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
  document.querySelectorAll("[data-settings-user-delete]").forEach((button) => button.addEventListener("click", () => {
    const index = Number(button.dataset.settingsUserDelete);
    const dialog = ensureDeleteUserDialog(ctx);
    fillDeleteUserDialog(dialog, ctx, index);
    state.settingsOpenUserMenu = "";
    renderSettingsScreen(ctx);
    dialog.showModal();
  }));
  document.querySelectorAll("[data-settings-integration]").forEach((input) => input.addEventListener("change", async () => {
    const key = input.dataset.settingsIntegration;
    state.settingsIntegrations[key] = input.checked;
    addSettingsAudit(state, `${key}: ${input.checked ? "інтеграцію увімкнено" : "інтеграцію вимкнено"}.`, input.checked ? "green" : "amber");
    try {
      await persistCrmSettings(ctx);
      await refreshMailingProviderStatus(ctx);
    } catch (_error) {
      state.settingsIntegrations[key] = !input.checked;
      showToast("Не вдалося зберегти інтеграцію в базі.", "danger");
      renderSettingsScreen(ctx);
      return;
    }
    saveNavigationState();
    renderSettingsScreen(ctx);
    showToast(`${key}: ${input.checked ? "увімкнено" : "вимкнено"}.`, input.checked ? "success" : "warning");
  }));
  document.querySelectorAll("[data-settings-provider-test]").forEach((button) => button.addEventListener("click", async () => {
    const channel = button.dataset.settingsProviderTest;
    state.settingsTestingProvider = channel;
    renderSettingsScreen(ctx);
    try {
      const payload = await testMailingProviderInApi(channel);
      state.mailingProviderStatus = payload.providerStatus || state.mailingProviderStatus;
      state.auditLogs = (payload.auditLogs || []).map(normalizeAuditLog);
      addSettingsAudit(state, `${channel}: тест mock-провайдера ${payload.result?.ok ? "успішний" : "не пройшов"}.`, payload.result?.ok ? "green" : "red");
      showToast(payload.result?.ok ? `${channel}: тестова відправка успішна.` : (payload.result?.error || `${channel}: тест не пройшов.`), payload.result?.ok ? "success" : "danger");
    } catch (_error) {
      showToast("Не вдалося перевірити інтеграцію.", "danger");
    }
    state.settingsTestingProvider = "";
    saveNavigationState();
    renderSettingsScreen(ctx);
  }));
  document.querySelectorAll("[data-settings-integration-config]").forEach((button) => button.addEventListener("click", () => {
    const channel = button.dataset.settingsIntegrationConfig;
    const dialog = ensureIntegrationConfigDialog(ctx);
    fillIntegrationConfigDialog(dialog, ctx, channel);
    dialog.showModal();
  }));
  document.querySelectorAll("[data-settings-notification]").forEach((input) => input.addEventListener("change", async () => {
    const key = input.dataset.settingsNotification;
    state.settingsNotifications[key] = input.checked;
    if (input.checked) {
      state.notificationReadKeys = (state.notificationReadKeys || []).filter((item) => item !== key);
    }
    addSettingsAudit(state, `Сповіщення «${key}» ${input.checked ? "увімкнено" : "вимкнено"}.`, input.checked ? "green" : "amber");
    try {
      await persistCrmSettings(ctx);
    } catch (_error) {
      state.settingsNotifications[key] = !input.checked;
      showToast("Не вдалося зберегти сповіщення в базі.", "danger");
      renderSettingsScreen(ctx);
      return;
    }
    syncTopbarNotifications?.();
    saveNavigationState();
    renderSettingsScreen(ctx);
    showToast(input.checked ? "Сповіщення увімкнено." : "Сповіщення вимкнено.", input.checked ? "success" : "warning");
  }));
  document.querySelector("[data-settings-clear-audit]")?.addEventListener("click", () => {
    ensureClearAuditDialog(ctx).showModal();
  });
  document.querySelector("[data-settings-refresh-audit]")?.addEventListener("click", async () => {
    if (!shouldUseApi(state)) {
      showToast("Журнал оновлено у демо-режимі.");
      return;
    }
    try {
      const payload = await getAuditLogsFromApi(50);
      state.auditLogs = (payload.results || []).map(normalizeAuditLog);
      saveNavigationState();
      renderSettingsScreen(ctx);
      showToast("Журнал дій оновлено.");
    } catch (_error) {
      showToast("Не вдалося оновити журнал дій.", "danger");
    }
  });
}
