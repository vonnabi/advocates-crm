const OSINT_TABS = [
  ["overview", "Огляд"],
  ["cases", "За справами"],
  ["people", "За людьми"],
  ["events", "За подіями"],
  ["registries", "Реєстри"],
  ["monitoring", "Моніторинг"],
  ["reports", "Звіти"],
  ["settings", "Налаштування"]
];

const OSINT_SUBTABS = [
  ["mentions", "Останні згадки"],
  ["risks", "Виявлені ризики"],
  ["registries", "Зміни в реєстрах"],
  ["people", "Пов'язані особи"],
  ["events", "Ключові події"]
];

const OSINT_METRICS = [
  { label: "Зібрано даних", value: "32 540", trend: "+18%", icon: "briefcase", tone: "blue" },
  { label: "Нові згадки", value: "1 245", trend: "+12%", icon: "file", tone: "green" },
  { label: "Проаналізовано справ", value: "86", trend: "+8%", icon: "check", tone: "green" },
  { label: "Виявлено ризиків", value: "24", trend: "+20%", icon: "tag", tone: "red" },
  { label: "Моніторинг активний", value: "15", trend: "справ / людей / подій", icon: "refresh", tone: "blue" },
  { label: "Джерел у роботі", value: "52", trend: "підключено", icon: "search", tone: "blue" }
];

const OSINT_SOURCE_SPLIT = [
  ["Соцмережі", 45, 562, "#1f7ae0"],
  ["Новини", 25, 312, "#27ae6f"],
  ["Судові рішення", 15, 187, "#7c5ce8"],
  ["Форуми", 7, 87, "#f59e0b"],
  ["Блоги", 5, 62, "#8796a8"],
  ["Інше", 3, 37, "#cbd5e1"]
];

const OSINT_MENTIONS = [
  { source: "Facebook", title: "Згадка у Facebook", text: "Олександр Петренко згаданий у коментарях до публікації", caseId: "2024/12345", time: "16.05.2024 09:20", tone: "red", status: "Негативна" },
  { source: "Opendatabot", title: "Зміна в компанії", text: "ТОВ «Альфа» змінило кінцевого бенефіціара", caseId: "2024/9012", time: "16.05.2024 09:10", tone: "blue", status: "Нейтральна" },
  { source: "Судовий реєстр", title: "Нове судове рішення", text: "Знайдено рішення у справі №755/1234/24", caseId: "2024/5678", time: "16.05.2024 08:45", tone: "amber", status: "Важлива" },
  { source: "Telegram", title: "Повідомлення в Telegram", text: "Знайдено згадку в каналі «Правовий контроль»", caseId: "2024/2468", time: "16.05.2024 08:30", tone: "red", status: "Негативна" },
  { source: "Новини", title: "Публікація в ЗМІ", text: "Опубліковано статтю про судову справу", caseId: "2024/1357", time: "16.05.2024 08:15", tone: "blue", status: "Нейтральна" }
];

const OSINT_ACTIVE_CASES = [
  { caseId: "2024/1234", title: "Оскарження дій ТЦК щодо мобілізації", risk: "Високий ризик", progress: 78, updated: "16.05.2024 09:15", tone: "red" },
  { caseId: "2024/5678", title: "Шахрайство в особливо великих розмірах", risk: "Середній ризик", progress: 64, updated: "16.05.2024 08:40", tone: "amber" },
  { caseId: "2024/9012", title: "Корпоративний спір між засновниками", risk: "Низький ризик", progress: 42, updated: "15.05.2024 17:30", tone: "green" },
  { caseId: "2024/2468", title: "Визнання договору недійсним", risk: "Низький ризик", progress: 35, updated: "15.05.2024 16:10", tone: "green" },
  { caseId: "2024/1357", title: "Стягнення заборгованості з контрагента", risk: "Середній ризик", progress: 58, updated: "15.05.2024 14:55", tone: "amber" }
];

const OSINT_DATA_TYPES = [
  ["Персональні дані", 1245, "#1f7ae0"],
  ["Судові рішення", 987, "#2f80d0"],
  ["Соцмережі", 856, "#27ae6f"],
  ["Компанії та реєстри", 743, "#ef4444"],
  ["Новини та ЗМІ", 532, "#7c5ce8"],
  ["Відкриті реєстри", 421, "#f59e0b"],
  ["Форуми та блоги", 312, "#3b82f6"],
  ["Інше", 156, "#64748b"]
];

const OSINT_SOURCES = [
  ["YouControl", "Бізнес-дані та реєстри", "16.05.2024 09:00", "Активне"],
  ["Opendatabot", "Відкриті дані", "16.05.2024 09:15", "Активне"],
  ["Судові рішення", "Єдиний держреєстр", "16.05.2024 09:20", "Активне"],
  ["Соцмережі", "Facebook, Instagram, LinkedIn", "16.05.2024 08:10", "Активне"],
  ["Telegram", "Канали та групи", "16.05.2024 09:05", "Активне"],
  ["Новини", "ЗМІ та новинні сайти", "16.05.2024 08:50", "Активне"]
];

const OSINT_REGISTRY_ROWS = [
  ["ЄДР", "Компанії, ФОП, бенефіціари", "Підключено", "16.05.2024 09:00"],
  ["Судовий реєстр", "Рішення та процесуальні згадки", "Підключено", "16.05.2024 09:20"],
  ["Боржники", "Виконавчі провадження та борги", "Потребує уваги", "15.05.2024 18:10"],
  ["Санкції", "Санкційні списки та обмеження", "Підключено", "15.05.2024 17:00"]
];

function osintTone(value = "") {
  const text = String(value).toLowerCase();
  if (text.includes("висок") || text.includes("негатив") || text.includes("ризик")) return "red";
  if (text.includes("серед") || text.includes("уваг") || text.includes("важлив")) return "amber";
  if (text.includes("низь") || text.includes("актив") || text.includes("готов")) return "green";
  return "blue";
}

function filteredChecks(state) {
  const query = (state.osintQuery || "").trim().toLowerCase();
  return state.osintChecks.filter((check) => {
    const matchesQuery = !query || [check.title, check.caseId, check.object, check.status, ...(check.sources || [])]
      .some((value) => String(value || "").toLowerCase().includes(query));
    const matchesStatus = (state.osintStatusFilter || "all") === "all" || check.status === state.osintStatusFilter;
    return matchesQuery && matchesStatus;
  });
}

function filteredMentions(state) {
  const query = (state.osintQuery || "").trim().toLowerCase();
  const subtab = state.osintSubtab || "mentions";
  const bySubtab = OSINT_MENTIONS.filter((item) => {
    if (subtab === "risks") return item.tone === "red" || item.tone === "amber";
    if (subtab === "registries") return item.source === "Opendatabot" || item.source === "Судовий реєстр";
    if (subtab === "people") return item.text.includes("Петренко") || item.text.includes("бенефіціара");
    if (subtab === "events") return item.source === "Telegram" || item.source === "Новини" || item.status === "Важлива";
    return true;
  });
  if (!query) return bySubtab;
  return bySubtab.filter((item) => [item.source, item.title, item.text, item.caseId, item.status]
    .some((value) => String(value).toLowerCase().includes(query)));
}

function openOsintCase(ctx, caseId) {
  const { state, renderCases, switchView } = ctx;
  state.selectedCaseId = caseId;
  state.caseScreen = "detail";
  renderCases();
  switchView("cases");
}

function points(values, max = 1500, width = 590, height = 190) {
  const step = width / (values.length - 1);
  return values.map((value, index) => `${Math.round(index * step)},${Math.round(height - (value / max) * height)}`).join(" ");
}

function exportOsintReport(ctx) {
  const lines = [
    "Тип,Назва,Справа,Статус",
    ...ctx.state.osintChecks.map((item) => ["Перевірка", item.title, item.caseId, item.status].join(",")),
    ...OSINT_MENTIONS.map((item) => ["Згадка", item.title, item.caseId, item.status].join(","))
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "osint-report.csv";
  link.click();
  URL.revokeObjectURL(link.href);
  ctx.showToast("OSINT звіт підготовлено до експорту.");
}

function metricCard(item, icon) {
  return `
    <article class="osint-kpi-card">
      <div>
        <span>${item.label}</span>
        <strong>${item.value}</strong>
        <small class="${item.tone === "red" ? "danger" : ""}">${item.trend}</small>
      </div>
      <em class="${item.tone}">${icon(item.icon)}</em>
    </article>
  `;
}

function osintLineChart() {
  const all = [610, 720, 760, 950, 920, 1020, 1230, 1120, 1160, 980, 1010, 910, 1130, 1310, 1200, 1150, 990, 1110, 1005];
  const negative = [290, 360, 340, 430, 380, 390, 520, 440, 510, 420, 490, 380, 430, 590, 450, 390, 350, 430, 370];
  const positive = [145, 180, 160, 220, 190, 210, 300, 240, 290, 220, 240, 190, 220, 290, 250, 230, 210, 250, 205];
  const neutral = [175, 180, 260, 300, 350, 420, 410, 440, 360, 340, 280, 340, 480, 430, 500, 530, 430, 430, 430];
  return `
    <svg class="osint-line-chart" viewBox="0 0 650 230" role="img" aria-label="Динаміка згадок">
      ${[0, 1, 2, 3, 4].map((line) => `<path class="grid-line" d="M36 ${20 + line * 40}H630"></path>`).join("")}
      <polyline points="${points(all)}" transform="translate(36 20)" class="line all"></polyline>
      <polyline points="${points(negative)}" transform="translate(36 20)" class="line negative"></polyline>
      <polyline points="${points(positive)}" transform="translate(36 20)" class="line positive"></polyline>
      <polyline points="${points(neutral)}" transform="translate(36 20)" class="line neutral"></polyline>
      ${["01.05", "03.05", "05.05", "07.05", "09.05", "11.05", "13.05", "16.05"].map((label, index) => `<text x="${52 + index * 80}" y="222">${label}</text>`).join("")}
      ${[0, 500, 1000, 1500].map((label, index) => `<text x="0" y="${184 - index * 54}">${label}</text>`).join("")}
    </svg>
  `;
}

function sourceDonut() {
  return `
    <div class="osint-donut-wrap">
      <div class="osint-donut"></div>
      <div class="osint-legend">
        ${OSINT_SOURCE_SPLIT.map(([label, percent, count, color]) => `
          <span><i style="background:${color}"></i>${label}<b>${percent}% (${count})</b></span>
        `).join("")}
      </div>
    </div>
  `;
}

function mentionIconMeta(source) {
  if (source === "Facebook") return { tone: "facebook", label: "f" };
  if (source === "Opendatabot") return { tone: "opendata", label: "OD" };
  if (source === "Telegram") return { tone: "blue", iconName: "telegram" };
  if (source === "Судовий реєстр") return { tone: "amber", iconName: "building" };
  if (source === "Новини") return { tone: "blue", iconName: "file" };
  return { tone: "blue", iconName: "search" };
}

function mentionList(badge, icon, state) {
  const mentions = filteredMentions(state);
  return `
    <div class="osint-mentions-list">
      ${mentions.map((item) => {
        const meta = mentionIconMeta(item.source);
        return `
        <button class="osint-mention-row" type="button" data-open-osint-case="${item.caseId}">
          <span class="source-icon ${meta.tone}">${meta.label ? `<b>${meta.label}</b>` : icon(meta.iconName)}</span>
          <span>
            <strong>${item.title}</strong>
            <small>${item.text}</small>
            <small>Справа: №${item.caseId}</small>
          </span>
          <time>${item.time}</time>
          ${badge(item.status, item.tone)}
        </button>
      `;
      }).join("") || `<div class="finance-operation-empty">Згадок за пошуком не знайдено.</div>`}
    </div>
  `;
}

function relationshipGraph() {
  return `
    <div class="osint-graph">
      <span class="node center">Петренко<br>Олександр</span>
      <span class="node n1">ТОВ "Альфа"</span>
      <span class="node n2">ТОВ "Бета"</span>
      <span class="node n3">ТОВ "Гамма"</span>
      <span class="node n4">Сидоренко<br>Марія</span>
      <span class="node n5">Іванов<br>Сергій</span>
      <i class="edge e1"></i><i class="edge e2"></i><i class="edge e3"></i><i class="edge e4"></i><i class="edge e5"></i>
    </div>
  `;
}

function dataTypeBars() {
  const max = Math.max(...OSINT_DATA_TYPES.map(([, value]) => value));
  return `
    <div class="osint-bar-list">
      ${OSINT_DATA_TYPES.map(([label, value, color]) => `
        <div>
          <span>${label}</span>
          <em><i style="width:${Math.round((value / max) * 100)}%;background:${color}"></i></em>
          <b>${value}</b>
        </div>
      `).join("")}
    </div>
  `;
}

function activeCasesList(badge) {
  return `
    <div class="osint-active-list">
      ${OSINT_ACTIVE_CASES.map((item) => `
        <button type="button" data-open-osint-case="${item.caseId}">
          <span>
            <strong>№${item.caseId}</strong>
            <b>${item.title}</b>
            <small>Оновлено: ${item.updated}</small>
          </span>
          ${badge(item.risk, item.tone)}
          <em><i style="width:${item.progress}%"></i></em>
          <small>${item.progress}%</small>
        </button>
      `).join("")}
    </div>
  `;
}

function sourceIconMeta(title) {
  if (title.includes("YouControl")) return { iconName: "briefcase", tone: "green" };
  if (title.includes("Opendatabot")) return { iconName: "search", tone: "blue" };
  if (title.includes("Telegram")) return { iconName: "telegram", tone: "blue" };
  if (title.includes("Судові")) return { iconName: "building", tone: "amber" };
  if (title.includes("Новини")) return { iconName: "file", tone: "blue" };
  if (title.includes("Соц")) return { iconName: "user", tone: "blue" };
  return { iconName: "search", tone: "blue" };
}

function sourcesGrid(badge, icon) {
  return `
    <div class="osint-source-grid">
      ${OSINT_SOURCES.map(([title, subtitle, updated, status]) => {
        const meta = sourceIconMeta(title);
        return `
        <article>
          <div class="source-card-icon ${meta.tone}">${icon(meta.iconName)}</div>
          <div>
            <strong>${title}</strong>
            <span>${subtitle}</span>
            <small>Оновлено: ${updated}</small>
          </div>
          ${badge(status, "green")}
        </article>
      `;
      }).join("")}
    </div>
  `;
}

function quickActions(icon) {
  return `
    <div class="osint-quick-actions">
      <button type="button" data-osint-quick="person">${icon("user")} Пошук по людині</button>
      <button type="button" data-osint-quick="company">${icon("building")} Пошук по компанії</button>
      <button type="button" data-osint-monitor>${icon("refresh")} Моніторинг справи</button>
      <button type="button" data-create-osint>${icon("file")} Створити звіт</button>
      <button type="button" data-osint-export>${icon("file")} Експорт даних</button>
    </div>
  `;
}

function overviewWorkspace(state, badge, icon) {
  state.osintSubtab = state.osintSubtab || "mentions";
  return `
    <section class="osint-overview-layout">
      <article class="panel osint-chart-card osint-line-panel">
        <div class="analytics-card-head">
          <h2>Динаміка згадок</h2>
          <select data-osint-chart-scale><option>По днях</option><option>По тижнях</option></select>
        </div>
        <div class="analytics-legend">
          <span class="blue">Всі згадки</span>
          <span class="red">Негативні</span>
          <span class="green">Позитивні</span>
          <span class="neutral">Нейтральні</span>
        </div>
        ${osintLineChart()}
      </article>

      <article class="panel osint-chart-card osint-source-panel">
        <h2>Розподіл згадок за джерелами</h2>
        ${sourceDonut()}
      </article>

      <section class="panel osint-lower-composite">
        <nav class="osint-subtabs">
          ${OSINT_SUBTABS.map(([key, label]) => `
            <button class="${state.osintSubtab === key ? "active" : ""}" type="button" data-osint-subtab="${key}">${label}</button>
          `).join("")}
        </nav>
        <div class="osint-lower-columns">
          <article class="osint-mentions-column">
            ${mentionList(badge, icon, state)}
            <button class="ghost osint-list-more" type="button" data-osint-sync>Переглянути всі згадки</button>
          </article>

          <article class="osint-graph-column">
            <h2>Граф зв'язків у справах</h2>
            ${relationshipGraph()}
            <div class="osint-graph-legend">
              <span><i class="person"></i>Фізична особа</span>
              <span><i class="company"></i>Компанія</span>
              <span><i class="line"></i>Зв'язок</span>
              <span><i class="dash"></i>Опосередкований зв'язок</span>
            </div>
          </article>

          <article class="osint-types-column">
            <h2>Розподіл за типами даних</h2>
            ${dataTypeBars()}
          </article>
        </div>
      </section>

      <aside class="osint-side-stack">
        <article class="panel osint-right-card">
          <div class="analytics-card-head">
            <h2>Активні справи OSINT</h2>
            <button class="ghost compact" type="button" data-osint-show-all>Переглянути всі</button>
          </div>
          ${activeCasesList(badge)}
        </article>

        <article class="panel osint-right-card">
          <h2>Швидкі дії</h2>
          ${quickActions(icon)}
        </article>
      </aside>

      <article class="panel osint-wide-card osint-sources-panel">
        <h2>Джерела даних</h2>
        ${sourcesGrid(badge, icon)}
        <button class="ghost osint-manage" type="button" data-osint-sync>Керування джерелами</button>
      </article>
    </section>
  `;
}

function secondaryWorkspace(state, badge, icon) {
  const tab = state.osintTab || "overview";
  if (tab === "overview") return "";
  if (tab === "cases" || tab === "monitoring") {
    return `
      <section class="osint-tab-layout">
        <article class="panel osint-wide-card">
          <div class="analytics-card-head">
            <h2>${tab === "monitoring" ? "Активний моніторинг" : "OSINT за справами"}</h2>
            <button class="secondary compact" type="button" data-osint-monitor>${icon("refresh")} Додати моніторинг</button>
          </div>
          ${activeCasesList(badge)}
        </article>
        <aside class="panel osint-right-card">
          <h2>Швидкі дії</h2>
          ${quickActions(icon)}
        </aside>
      </section>
    `;
  }
  if (tab === "people" || tab === "events") {
    return `
      <section class="osint-tab-layout">
        <article class="panel osint-wide-card">
          <div class="analytics-card-head">
            <h2>${tab === "people" ? "OSINT за людьми" : "OSINT за подіями"}</h2>
            <button class="secondary compact" type="button" data-osint-sync>${icon("refresh")} Оновити</button>
          </div>
          ${mentionList(badge, icon, state)}
        </article>
        <article class="panel osint-small-card">
          <h2>${tab === "people" ? "Граф зв'язків" : "Типи подій"}</h2>
          ${tab === "people" ? relationshipGraph() : dataTypeBars()}
        </article>
      </section>
    `;
  }
  if (tab === "registries" || tab === "settings") {
    return `
      <section class="panel osint-wide-card osint-tab-workspace">
        <div class="analytics-card-head">
          <h2>${tab === "settings" ? "Налаштування джерел" : "Підключені реєстри"}</h2>
          <button class="secondary compact" type="button" data-osint-sync>${icon("refresh")} Оновити</button>
        </div>
        <div class="osint-registry-table">
          ${OSINT_REGISTRY_ROWS.map(([name, description, status, updated]) => `
            <div>
              <strong>${name}</strong>
              <span>${description}</span>
              ${badge(status, osintTone(status))}
              <time>${updated}</time>
            </div>
          `).join("")}
        </div>
      </section>
    `;
  }
  if (tab === "reports") {
    return `
      <section class="panel osint-wide-card osint-tab-workspace">
        <div class="analytics-card-head">
          <h2>Готові OSINT звіти</h2>
          <button class="primary compact" type="button" data-osint-export>${icon("file")} Експорт</button>
        </div>
        <div class="finance-report-grid">
          ${["Звіт по ризиках", "Звіт по згадках", "Звіт по реєстрах"].map((title) => `
            <article class="finance-report-card">
              <span>${icon("file")}</span>
              <strong>${title}</strong>
              <p>Автоматично сформований документ для передачі адвокату або клієнту.</p>
              <button class="secondary compact" type="button" data-osint-export>CSV</button>
            </article>
          `).join("")}
        </div>
      </section>
    `;
  }
  return `
    <section class="panel osint-wide-card osint-tab-workspace">
      <div class="analytics-card-head">
        <h2>${OSINT_TABS.find(([key]) => key === tab)?.[1] || "OSINT"}</h2>
        <button class="secondary compact" type="button" data-osint-monitor>${icon("refresh")} Додати моніторинг</button>
      </div>
      <div class="osint-focus-grid">
        ${filteredChecks(state).map((check) => `
          <button class="osint-focus-card" type="button" data-select-osint="${check.id}">
            <strong>${check.title}</strong>
            <span>№${check.caseId} · ${check.object}</span>
            ${badge(check.status, osintTone(check.status))}
          </button>
        `).join("")}
      </div>
    </section>
  `;
}

export function renderOSINTScreen(ctx) {
  const { state, $, badge, icon, showToast } = ctx;
  state.osintTab = state.osintTab || "overview";
  state.osintDateStart = state.osintDateStart || "2024-05-01";
  state.osintDateEnd = state.osintDateEnd || "2024-05-16";
  const filtered = filteredChecks(state);
  if (!filtered.some((check) => check.id === state.selectedOsintId)) {
    state.selectedOsintId = filtered[0]?.id || state.osintChecks[0]?.id || "";
  }

  $("#osint").innerHTML = `
    <div class="osint-screen osint-reference">
      <div class="osint-topbar">
        <div>
          <h2>OSINT аналітика</h2>
          <p>OSINT перевірки, збір та аналіз інформації з відкритих джерел</p>
        </div>
        <div class="osint-top-actions">
          <label class="osint-search">
            ${icon("search")}
            <input data-osint-query placeholder="Пошук по OSINT..." value="${state.osintQuery || ""}">
          </label>
          <button class="secondary" type="button" data-osint-date>${state.osintDateStart.split("-").reverse().join(".")} - ${state.osintDateEnd.split("-").reverse().join(".")} ${icon("calendar")}</button>
          <button class="primary" type="button" data-create-osint>${icon("file")} Створити звіт</button>
        </div>
      </div>

      <nav class="osint-tabs" aria-label="OSINT розділи">
        ${OSINT_TABS.map(([tab, label]) => `<button class="${state.osintTab === tab ? "active" : ""}" type="button" data-osint-tab="${tab}">${label}</button>`).join("")}
      </nav>

      <section class="osint-kpi-grid">
        ${OSINT_METRICS.map((item) => metricCard(item, icon)).join("")}
      </section>

      ${state.osintTab === "overview" ? overviewWorkspace(state, badge, icon) : secondaryWorkspace(state, badge, icon)}
    </div>
  `;

  document.querySelector("[data-osint-query]")?.addEventListener("input", (event) => {
    state.osintQuery = event.currentTarget.value;
    renderOSINTScreen(ctx);
  });
  document.querySelectorAll("[data-osint-tab]").forEach((button) => button.addEventListener("click", () => {
    state.osintTab = button.dataset.osintTab;
    showToast(`Відкрито розділ: ${button.textContent.trim()}.`);
    renderOSINTScreen(ctx);
  }));
  document.querySelectorAll("[data-create-osint]").forEach((button) => button.addEventListener("click", () => {
    const caseId = state.selectedCaseId || state.cases[0]?.id || "";
    const next = {
      id: `osint-${Date.now()}`,
      title: "OSINT звіт по справі",
      caseId,
      object: "Автоматична перевірка відкритих джерел",
      sources: ["YouControl", "Opendatabot", "Судовий реєстр", "Соцмережі"],
      risks: ["Потрібно переглянути негативні згадки"],
      status: "Звіт готовий"
    };
    state.osintChecks.unshift(next);
    state.selectedOsintId = next.id;
    state.osintTab = "reports";
    showToast("OSINT звіт створено.");
    renderOSINTScreen(ctx);
  }));
  document.querySelectorAll("[data-select-osint]").forEach((button) => button.addEventListener("click", () => {
    state.selectedOsintId = button.dataset.selectOsint;
    state.osintTab = "cases";
    renderOSINTScreen(ctx);
  }));
  document.querySelectorAll("[data-open-osint-case]").forEach((button) => button.addEventListener("click", (event) => {
    openOsintCase(ctx, event.currentTarget.dataset.openOsintCase);
  }));
  document.querySelectorAll("[data-osint-export]").forEach((button) => button.addEventListener("click", () => exportOsintReport(ctx)));
  document.querySelectorAll("[data-osint-monitor]").forEach((button) => button.addEventListener("click", () => {
    state.osintTab = "monitoring";
    showToast("Моніторинг OSINT додано до активних перевірок.");
    renderOSINTScreen(ctx);
  }));
  document.querySelectorAll("[data-osint-show-all]").forEach((button) => button.addEventListener("click", () => {
    state.osintTab = "cases";
    renderOSINTScreen(ctx);
  }));
  document.querySelectorAll("[data-osint-subtab]").forEach((button) => button.addEventListener("click", () => {
    state.osintSubtab = button.dataset.osintSubtab;
    showToast(`OSINT: ${button.textContent.trim()}.`);
    renderOSINTScreen(ctx);
  }));
  document.querySelectorAll("[data-osint-sync], [data-osint-date], [data-osint-chart-scale]").forEach((control) => {
    control.addEventListener("click", () => showToast("OSINT дані оновлено."));
    control.addEventListener("change", () => showToast("Параметри OSINT оновлено."));
  });
  document.querySelectorAll("[data-osint-quick]").forEach((button) => button.addEventListener("click", () => {
    state.osintQuery = button.dataset.osintQuick === "person" ? "Петренко" : "ТОВ";
    showToast("Швидкий пошук запущено.");
    renderOSINTScreen(ctx);
  }));
}
