import {
  clientName,
  DEMO_END,
  DEMO_START,
  osintSummaryFromData
} from "../derived-data.js?v=live-demo-1";

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

const OSINT_DEFAULT_START = DEMO_START;
const OSINT_DEFAULT_END = DEMO_END;
const demoCaseYear = new Date().getFullYear();
const demoDateAnchor = new Date(2024, 4, 15);

function demoCaseId(value) {
  return String(value).replace(/^2024\//, `${demoCaseYear}/`);
}

function demoDateTime(dayMonth, clock) {
  const [day, month] = String(dayMonth).split(".").map(Number);
  const source = new Date(2024, month - 1, day);
  const today = new Date();
  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const deltaDays = Math.round((todayOnly.getTime() - demoDateAnchor.getTime()) / 86400000);
  source.setDate(source.getDate() + deltaDays);
  return `${String(source.getDate()).padStart(2, "0")}.${String(source.getMonth() + 1).padStart(2, "0")}.${source.getFullYear()} ${clock}`;
}

const OSINT_SUBTABS = [
  ["mentions", "Останні згадки"],
  ["risks", "Виявлені ризики"],
  ["registries", "Зміни в реєстрах"],
  ["people", "Пов'язані особи"],
  ["events", "Ключові події"]
];

const OSINT_SOURCE_SPLIT = [
  ["Соцмережі", 45, 562, "#1f7ae0"],
  ["Новини", 25, 312, "#27ae6f"],
  ["Судові рішення", 15, 187, "#7c5ce8"],
  ["Форуми", 7, 87, "#f59e0b"],
  ["Блоги", 5, 62, "#8796a8"],
  ["Інше", 3, 37, "#cbd5e1"]
];

const OSINT_SOURCE_COLORS = new Map(OSINT_SOURCE_SPLIT.map(([label, , , color]) => [label, color]));
OSINT_SOURCE_COLORS.set("Telegram", "#1f7ae0");
OSINT_SOURCE_COLORS.set("Facebook", "#2f80d0");
OSINT_SOURCE_COLORS.set("Opendatabot", "#27ae6f");
OSINT_SOURCE_COLORS.set("Судовий реєстр", "#7c5ce8");
OSINT_SOURCE_COLORS.set("Новини", "#f59e0b");
OSINT_SOURCE_COLORS.set("YouControl", "#16a34a");

const OSINT_SOURCE_DEFAULTS = [
  { id: "youcontrol", title: "YouControl", subtitle: "Бізнес-дані та реєстри", updated: demoDateTime("16.05", "09:00"), status: "Активне", enabled: true, cadence: "кожні 60 хв" },
  { id: "opendatabot", title: "Opendatabot", subtitle: "Відкриті дані", updated: demoDateTime("16.05", "09:15"), status: "Активне", enabled: true, cadence: "кожні 30 хв" },
  { id: "court", title: "Судові рішення", subtitle: "Єдиний держреєстр", updated: demoDateTime("16.05", "09:20"), status: "Активне", enabled: true, cadence: "кожні 2 год" },
  { id: "social", title: "Соцмережі", subtitle: "Facebook, Instagram, LinkedIn", updated: demoDateTime("16.05", "08:10"), status: "Активне", enabled: true, cadence: "кожні 4 год" },
  { id: "telegram", title: "Telegram", subtitle: "Канали та групи", updated: demoDateTime("16.05", "09:05"), status: "Активне", enabled: true, cadence: "кожні 20 хв" },
  { id: "news", title: "Новини", subtitle: "ЗМІ та новинні сайти", updated: demoDateTime("16.05", "08:50"), status: "Активне", enabled: true, cadence: "кожні 45 хв" }
];

const OSINT_REGISTRY_ROWS = [
  ["ЄДР", "Компанії, ФОП, бенефіціари", "Підключено", demoDateTime("16.05", "09:00")],
  ["Судовий реєстр", "Рішення та процесуальні згадки", "Підключено", demoDateTime("16.05", "09:20")],
  ["Боржники", "Виконавчі провадження та борги", "Потребує уваги", demoDateTime("15.05", "18:10")],
  ["Санкції", "Санкційні списки та обмеження", "Підключено", demoDateTime("15.05", "17:00")]
];

function osintTone(value = "") {
  const text = String(value).toLowerCase();
  if (text.includes("висок") || text.includes("негатив") || text.includes("ризик")) return "red";
  if (text.includes("серед") || text.includes("уваг") || text.includes("важлив")) return "amber";
  if (text.includes("низь") || text.includes("актив") || text.includes("готов")) return "green";
  return "blue";
}

function dateFromAny(value) {
  const clean = String(value || OSINT_DEFAULT_START);
  if (clean.includes("-")) return new Date(clean);
  const [day, month, year] = clean.split(".");
  return new Date(`${year}-${month}-${day}`);
}

function osintDate(value) {
  return String(value || OSINT_DEFAULT_START).split("-").reverse().join(".");
}

function osintDayKey(value) {
  const text = String(value || "");
  const localMatch = text.match(/(\d{2})\.(\d{2})\.(\d{4})/);
  if (localMatch) return `${localMatch[3]}-${localMatch[2]}-${localMatch[1]}`;
  const isoMatch = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  return new Date().toISOString().slice(0, 10);
}

function osintDayLabel(key) {
  const [, month, day] = String(key).split("-");
  return `${day}.${month}`;
}

function osintCaseSequence(value) {
  const match = String(value || "").match(/(\d+)$/);
  return match ? Number(match[1]) : 0;
}

function sourceDistribution(state) {
  const counts = new Map();
  osintMentions(state).forEach((item) => {
    const source = item.source || "Інше";
    counts.set(source, (counts.get(source) || 0) + 1);
  });
  (state.osintChecks || []).forEach((check) => {
    (check.sources || []).forEach((source) => counts.set(source, (counts.get(source) || 0) + 1));
  });
  const total = Array.from(counts.values()).reduce((sum, value) => sum + value, 0);
  if (!total) return [];
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([label, count], index) => ({
      label,
      count,
      percent: Math.max(1, Math.round((count / total) * 100)),
      color: OSINT_SOURCE_COLORS.get(label) || OSINT_SOURCE_SPLIT[index % OSINT_SOURCE_SPLIT.length][3]
    }));
}

function osintDataTypes(state) {
  const documentCount = state.cases.reduce((sum, item) => sum + (item.documents?.length || 0), 0);
  const taskCount = state.cases.reduce((sum, item) => sum + (item.tasks?.length || 0), 0);
  const riskCount = state.cases.filter((item) => item.priority === "Високий" || Number(item.debt || 0) > 0).length
    + (state.osintChecks || []).reduce((sum, item) => sum + (item.risks?.length || 0), 0);
  return [
    ["Справи", state.cases.length, "#1f7ae0"],
    ["Документи", documentCount, "#27ae6f"],
    ["Задачі", taskCount, "#f59e0b"],
    ["OSINT перевірки", (state.osintChecks || []).length, "#7c5ce8"],
    ["Ризики", riskCount, "#ef4444"]
  ].filter(([, value]) => value > 0);
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

function osintMetrics(state) {
  const summary = osintSummaryFromData(state);
  const trend = (metricValue, value) => metricValue ? value : "Без даних";
  return [
    { action: "overview", label: "Зібрано даних", value: new Intl.NumberFormat("uk-UA").format(summary.collected), trend: trend(summary.collected, "+18%"), icon: "briefcase", tone: "blue" },
    { action: "mentions", label: "Нові згадки", value: new Intl.NumberFormat("uk-UA").format(summary.mentions), trend: trend(summary.mentions, "+12%"), icon: "file", tone: "green" },
    { action: "cases", label: "Проаналізовано справ", value: summary.analyzedCases, trend: trend(summary.analyzedCases, "+8%"), icon: "check", tone: "green" },
    { action: "risks", label: "Виявлено ризиків", value: summary.risks, trend: trend(summary.risks, "+20%"), icon: "tag", tone: "red" },
    { action: "monitoring", label: "Моніторинг активний", value: summary.monitoring, trend: trend(summary.monitoring, "справ / людей / подій"), icon: "refresh", tone: "blue" },
    { action: "sources", label: "Джерел у роботі", value: summary.sources, trend: trend(summary.sources, "підключено"), icon: "search", tone: "blue" }
  ];
}

function selectedOsintCase(state) {
  const selected = (state.cases || []).find((item) => item.id === state.selectedCaseId);
  if (selected) return selected;
  const selectedCheck = (state.osintChecks || []).find((check) => check.id === state.selectedOsintId);
  return (state.cases || []).find((item) => item.id === selectedCheck?.caseId) || state.cases?.[0] || null;
}

function osintPersonQuery(state, caseItem = selectedOsintCase(state)) {
  if (!caseItem) return "";
  const name = clientName(state, caseItem);
  return name === "Клієнт не вказаний" ? "" : name;
}

function osintCompanyQuery(caseItem) {
  const candidates = [
    caseItem?.court,
    caseItem?.organ,
    caseItem?.opponent,
    caseItem?.title,
    ...(caseItem?.documents || []).map((item) => item.name || item.title || "")
  ].filter(Boolean);
  return candidates.find((value) => /тов|тцк|суд|банк|компан|орган|установ|фоп|пп/i.test(value)) || "";
}

function ensureOsintChecks(state) {
  state.osintChecks = Array.isArray(state.osintChecks) ? state.osintChecks : [];
  return state.osintChecks;
}

function createOsintReport(state) {
  const caseItem = selectedOsintCase(state);
  const caseId = caseItem?.id || "";
  const next = {
    id: `osint-${Date.now()}`,
    title: "OSINT звіт по справі",
    caseId,
    object: `Автоматична перевірка відкритих джерел${caseItem ? `: ${caseItem.title}` : ""}`,
    sources: ["YouControl", "Opendatabot", "Судовий реєстр", "Соцмережі"],
    risks: ["Потрібно переглянути негативні згадки"],
    status: "Звіт готовий"
  };
  ensureOsintChecks(state).unshift(next);
  state.osintReports = Array.isArray(state.osintReports) ? state.osintReports : [];
  state.osintReports.unshift({
    title: `OSINT звіт №${caseId || "новий"}`,
    description: "Автоматично сформований звіт з відкритих джерел, ризиків, згадок і реєстрів.",
    created: new Date().toLocaleString("uk-UA", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
  });
  state.selectedOsintId = next.id;
  state.osintTab = "reports";
  return next;
}

function startOsintMonitoring(state) {
  const caseItem = selectedOsintCase(state);
  if (!caseItem) return null;
  const checks = ensureOsintChecks(state);
  const existing = checks.find((check) => check.caseId === caseItem.id && /моніторинг/i.test(check.title));
  const next = existing || {
    id: `osint-monitor-${Date.now()}`,
    title: `Моніторинг справи №${caseItem.id}`,
    caseId: caseItem.id,
    object: caseItem.title,
    sources: ["Opendatabot", "Судовий реєстр", "Telegram"],
    risks: [],
    status: "Активний моніторинг"
  };
  if (!existing) checks.unshift(next);
  state.selectedOsintId = next.id;
  state.selectedCaseId = caseItem.id;
  state.osintTab = "monitoring";
  state.osintMetricFocus = "monitoring";
  return next;
}

function osintMentions(state) {
  const fromCases = state.cases.map((item, index) => {
    const hasDebt = Number(item.debt || 0) > 0;
    const source = item.priority === "Високий"
      ? "Telegram"
      : hasDebt
        ? "Opendatabot"
        : index % 2
          ? "Новини"
          : "Судовий реєстр";
    return {
      source,
      title: source === "Opendatabot" ? "Зміна в компанії" : source === "Telegram" ? "Повідомлення в Telegram" : "Нове судове рішення",
      text: `${item.title} · ${clientName(state, item)}`,
      caseId: item.id,
      time: item.history?.[0]?.date || demoDateTime("16.05", "09:20"),
      tone: item.priority === "Високий" || hasDebt ? "red" : item.priority === "Середній" ? "amber" : "blue",
      status: item.priority === "Високий" || hasDebt ? "Негативна" : item.priority === "Середній" ? "Важлива" : "Нейтральна"
    };
  });
  const fromChecks = (state.osintChecks || []).map((check) => ({
    source: check.sources?.[0] || "YouControl",
    title: check.title,
    text: `${check.object} · ${check.status}`,
    caseId: check.caseId,
    time: demoDateTime("16.05", "09:30"),
    tone: check.risks?.length ? "amber" : "blue",
    status: check.risks?.length ? "Важлива" : "Нейтральна"
  }));
  return [...fromChecks, ...fromCases].sort((a, b) => {
    const byCase = osintCaseSequence(b.caseId) - osintCaseSequence(a.caseId);
    if (byCase) return byCase;
    return osintDayKey(b.time).localeCompare(osintDayKey(a.time));
  });
}

function filteredMentions(state) {
  const query = (state.osintQuery || "").trim().toLowerCase();
  const subtab = state.osintSubtab || "mentions";
  const bySubtab = osintMentions(state).filter((item) => {
    if (subtab === "risks") return item.tone === "red" || item.tone === "amber";
    if (subtab === "registries") return item.source === "Opendatabot" || item.source === "Судовий реєстр";
    if (subtab === "people") return true;
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
  const step = values.length > 1 ? width / (values.length - 1) : 0;
  return values.map((value, index) => `${Math.round(index * step)},${Math.round(height - (value / max) * height)}`).join(" ");
}

function exportOsintReport(ctx) {
  const lines = [
    "Тип,Назва,Справа,Статус",
    ...ctx.state.osintChecks.map((item) => ["Перевірка", item.title, item.caseId, item.status].join(",")),
    ...osintMentions(ctx.state).map((item) => ["Згадка", item.title, item.caseId, item.status].join(","))
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "osint-report.csv";
  link.click();
  URL.revokeObjectURL(link.href);
  ctx.showToast("OSINT звіт підготовлено до експорту.");
}

function metricCard(item, icon, activeAction = "overview") {
  return `
    <button class="osint-kpi-card ${activeAction === item.action ? "active" : ""}" type="button" data-osint-metric="${item.action}" aria-pressed="${activeAction === item.action}">
      <div>
        <span>${item.label}</span>
        <strong>${item.value}</strong>
        <small class="${item.tone === "red" ? "danger" : ""}">${item.trend}</small>
      </div>
      <em class="${item.tone}">${icon(item.icon)}</em>
    </button>
  `;
}

function osintLineSeries(state) {
  const bucket = new Map();
  osintMentions(state).forEach((item) => {
    const key = osintDayKey(item.time);
    const row = bucket.get(key) || { all: 0, negative: 0, positive: 0, neutral: 0 };
    row.all += 1;
    if (item.tone === "red") row.negative += 1;
    else if (item.tone === "green") row.positive += 1;
    else row.neutral += 1;
    bucket.set(key, row);
  });
  const labels = Array.from(bucket.keys()).sort().slice(-10);
  const rows = labels.map((key) => bucket.get(key));
  return {
    labels: labels.map(osintDayLabel),
    all: rows.map((item) => item.all),
    negative: rows.map((item) => item.negative),
    positive: rows.map((item) => item.positive),
    neutral: rows.map((item) => item.neutral)
  };
}

function osintLineChart(state) {
  const series = osintLineSeries(state);
  const max = Math.max(1, ...series.all, ...series.negative, ...series.positive, ...series.neutral);
  const axisMax = Math.max(5, Math.ceil(max / 5) * 5);
  if (!series.labels.length) {
    return `<div class="osint-chart-empty">OSINT-згадок за вибраний період ще немає.</div>`;
  }
  return `
    <svg class="osint-line-chart" viewBox="0 0 650 230" role="img" aria-label="Динаміка згадок">
      ${[0, 1, 2, 3, 4].map((line) => `<path class="grid-line" d="M36 ${20 + line * 40}H630"></path>`).join("")}
      <polyline points="${points(series.all, axisMax)}" transform="translate(36 20)" class="line all"></polyline>
      <polyline points="${points(series.negative, axisMax)}" transform="translate(36 20)" class="line negative"></polyline>
      <polyline points="${points(series.positive, axisMax)}" transform="translate(36 20)" class="line positive"></polyline>
      <polyline points="${points(series.neutral, axisMax)}" transform="translate(36 20)" class="line neutral"></polyline>
      ${series.labels.map((label, index) => `<text x="${52 + index * (560 / Math.max(1, series.labels.length - 1))}" y="222">${label}</text>`).join("")}
      ${[0, 1, 2, 3].map((step) => `<text x="0" y="${184 - step * 54}">${Math.round((axisMax / 3) * step)}</text>`).join("")}
    </svg>
  `;
}

function sourceDonut(state) {
  const rows = sourceDistribution(state);
  if (!rows.length) return `<div class="osint-chart-empty">Джерела з'являться після першої OSINT-перевірки.</div>`;
  let current = 0;
  const gradient = rows.map((row) => {
    const start = current;
    current += row.percent;
    return `${row.color} ${start}% ${Math.min(100, current)}%`;
  }).join(", ");
  return `
    <div class="osint-donut-wrap">
      <div class="osint-donut" style="background: conic-gradient(${gradient});"></div>
      <div class="osint-legend">
        ${rows.map(({ label, percent, count, color }) => `
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

function mentionList(badge, icon, state, limit = 0) {
  const mentions = filteredMentions(state);
  const visibleMentions = limit ? mentions.slice(0, limit) : mentions;
  const hiddenCount = Math.max(0, mentions.length - visibleMentions.length);
  return `
    <div class="osint-mentions-list">
      ${visibleMentions.map((item) => {
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
      ${hiddenCount ? `<div class="osint-list-hint">+${hiddenCount} згадок у повному списку</div>` : ""}
    </div>
  `;
}

function relationshipGraph() {
  return `
    <div class="osint-graph">
      <svg viewBox="0 0 320 230" aria-hidden="true">
        <line class="edge-line" x1="160" y1="116" x2="160" y2="34"></line>
        <line class="edge-line" x1="160" y1="116" x2="270" y2="74"></line>
        <line class="edge-line" x1="160" y1="116" x2="246" y2="178"></line>
        <line class="edge-line dashed" x1="160" y1="116" x2="65" y2="176"></line>
        <line class="edge-line dashed" x1="160" y1="116" x2="56" y2="78"></line>
      </svg>
      <span class="node center">Петренко<br>Олександр</span>
      <span class="node n1">ТОВ "Альфа"</span>
      <span class="node n2">ТОВ "Бета"</span>
      <span class="node n3">ТОВ "Гамма"</span>
      <span class="node n4">Сидоренко<br>Марія</span>
      <span class="node n5">Іванов<br>Сергій</span>
    </div>
  `;
}

function dataTypeBars(state) {
  const rows = osintDataTypes(state);
  const max = Math.max(1, ...rows.map(([, value]) => value));
  if (!rows.length) return `<div class="osint-chart-empty">Типи даних з'являться після додавання справ, задач або документів.</div>`;
  return `
    <div class="osint-bar-list">
      ${rows.map(([label, value, color]) => `
        <div>
          <span>${label}</span>
          <em><i style="width:${Math.round((value / max) * 100)}%;background:${color}"></i></em>
          <b>${value}</b>
        </div>
      `).join("")}
    </div>
  `;
}

function activeCasesList(state, badge) {
  const checkByCase = new Map((state.osintChecks || []).map((check) => [check.caseId, check]));
  const rows = state.cases.map((item) => {
    const check = checkByCase.get(item.id);
    const riskCount = (check?.risks?.length || 0) + (item.priority === "Високий" ? 1 : 0) + (item.debt > 0 ? 1 : 0);
    const tone = riskCount >= 2 ? "red" : riskCount === 1 ? "amber" : "green";
    return {
      caseId: item.id,
      title: item.title,
      risk: tone === "red" ? "Високий ризик" : tone === "amber" ? "Середній ризик" : "Низький ризик",
      progress: Math.min(95, 35 + (item.documents?.length || 0) * 7 + (item.tasks?.length || 0) * 6 + (check ? 12 : 0)),
      updated: item.history?.[0]?.date || demoDateTime("16.05", "09:15"),
      tone
    };
  }).sort((a, b) => osintCaseSequence(b.caseId) - osintCaseSequence(a.caseId));
  const visibleRows = rows.slice(0, 5);
  const hiddenCount = Math.max(0, rows.length - visibleRows.length);
  return `
    <div class="osint-active-list">
      ${visibleRows.map((item) => `
        <button type="button" data-open-osint-case="${item.caseId}">
          <span>
            <strong>№${item.caseId}</strong>
            <b>${item.title}</b>
            <small>Оновлено: ${item.updated}</small>
          </span>
          ${badge(item.risk, item.tone)}
          <div class="osint-progress-caption">
            <span>Прогрес аналізу</span>
            <strong>${item.progress}%</strong>
          </div>
          <em><i style="width:${item.progress}%"></i></em>
        </button>
      `).join("")}
      ${hiddenCount ? `<div class="osint-list-hint">+${hiddenCount} справ у повному списку</div>` : ""}
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

function ensureOsintSources(state) {
  if (!Array.isArray(state.osintSources)) {
    state.osintSources = OSINT_SOURCE_DEFAULTS.map((source) => ({ ...source }));
  }
  return state.osintSources;
}

function currentOsintStamp() {
  return new Date().toLocaleString("uk-UA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function sourceStatusLabel(source) {
  return source.enabled ? source.status || "Активне" : "Вимкнено";
}

function sourceStatusTone(source) {
  return source.enabled ? "green" : "gray";
}

function sourcesGrid(badge, icon, sources) {
  return `
    <div class="osint-source-grid">
      ${sources.map((source) => {
        const meta = sourceIconMeta(source.title);
        return `
        <article class="${source.enabled ? "" : "is-disabled"}">
          <div class="source-card-icon ${meta.tone}">${icon(meta.iconName)}</div>
          <div>
            <strong>${source.title}</strong>
            <span>${source.subtitle}</span>
            <small>Оновлено: ${source.updated}</small>
          </div>
          ${badge(sourceStatusLabel(source), sourceStatusTone(source))}
        </article>
      `;
      }).join("")}
    </div>
  `;
}

function sourceManagerPanel(badge, icon, sources) {
  return `
    <div class="osint-source-manager">
      <div class="analytics-card-head">
        <div>
          <h3>Керування джерелами</h3>
          <p>Налаштуйте, які відкриті джерела використовуються для OSINT-перевірок.</p>
        </div>
        <button class="ghost compact" type="button" data-osint-manage-close>Закрити</button>
      </div>
      <div class="osint-source-manager-grid">
        ${sources.map((source) => `
          <article class="${source.enabled ? "" : "is-disabled"}">
            <label class="osint-source-toggle">
              <input type="checkbox" data-osint-source-toggle="${source.id}" ${source.enabled ? "checked" : ""}>
              <span></span>
              <strong>${source.title}</strong>
            </label>
            <p>${source.subtitle}</p>
            <dl>
              <div><dt>Синхронізація</dt><dd>${source.cadence}</dd></div>
              <div><dt>Оновлено</dt><dd>${source.updated}</dd></div>
              <div><dt>Статус</dt><dd>${badge(sourceStatusLabel(source), sourceStatusTone(source))}</dd></div>
            </dl>
            <button class="secondary compact" type="button" data-osint-source-refresh="${source.id}" ${source.enabled ? "" : "disabled"}>${icon("refresh")} Оновити</button>
          </article>
        `).join("")}
      </div>
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

function osintHasData(state) {
  return Boolean(
    (state.cases || []).length
    || (state.osintChecks || []).length
    || (state.osintSources || []).length
    || (state.osintReports || []).length
  );
}

function emptyOsintWorkspace(icon) {
  return `
    <section class="panel osint-empty-state">
      <span>${icon("searchPlus")}</span>
      <strong>OSINT даних ще немає</strong>
      <p>Демо-дані вимкнені, тому тестові згадки, джерела і моніторинг приховані. Після додавання реальних справ або створення перевірки тут з'являться робочі дані.</p>
      <button class="primary compact" type="button" data-create-osint>${icon("file")} Створити звіт</button>
    </section>
  `;
}

function overviewWorkspace(state, badge, icon) {
  state.osintSubtab = state.osintSubtab || "mentions";
  const sources = ensureOsintSources(state);
  return `
    <section class="osint-overview-layout">
      <article class="panel osint-chart-card osint-line-panel">
        <div class="analytics-card-head">
          <h2>Динаміка згадок</h2>
        </div>
        <div class="analytics-legend">
          <span class="blue">Всі згадки</span>
          <span class="red">Негативні</span>
          <span class="green">Позитивні</span>
          <span class="neutral">Нейтральні</span>
        </div>
        ${osintLineChart(state)}
      </article>

      <article class="panel osint-chart-card osint-source-panel">
        <h2>Розподіл згадок за джерелами</h2>
        ${sourceDonut(state)}
      </article>

      <section class="panel osint-lower-composite">
        <nav class="osint-subtabs">
          ${OSINT_SUBTABS.map(([key, label]) => `
            <button class="${state.osintSubtab === key ? "active" : ""}" type="button" data-osint-subtab="${key}">${label}</button>
          `).join("")}
        </nav>
        <div class="osint-lower-columns">
          <article class="osint-mentions-column">
            ${mentionList(badge, icon, state, 6)}
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
            ${dataTypeBars(state)}
          </article>
        </div>
      </section>

      <aside class="osint-side-stack">
        <article class="panel osint-right-card">
          <div class="analytics-card-head">
            <h2>Активні справи OSINT</h2>
            <button class="ghost compact" type="button" data-osint-show-all>Переглянути всі</button>
          </div>
          ${activeCasesList(state, badge)}
        </article>

        <article class="panel osint-right-card">
          <h2>Швидкі дії</h2>
          ${quickActions(icon)}
        </article>
      </aside>

      <article class="panel osint-wide-card osint-sources-panel">
        <h2>Джерела даних</h2>
        ${sourcesGrid(badge, icon, sources)}
        <button class="ghost osint-manage" type="button" data-osint-manage>${state.osintSourceManagerOpen ? "Сховати налаштування" : "Керування джерелами"}</button>
        ${state.osintSourceManagerOpen ? sourceManagerPanel(badge, icon, sources) : ""}
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
          ${activeCasesList(state, badge)}
        </article>
        <aside class="panel osint-right-card">
          <h2>Швидкі дії</h2>
          ${quickActions(icon)}
        </aside>
      </section>
    `;
  }
  if (tab === "people" || tab === "events") {
    const tabState = { ...state, osintSubtab: tab === "people" ? "people" : "events" };
    return `
      <section class="osint-tab-layout">
        <article class="panel osint-wide-card">
          <div class="analytics-card-head">
            <h2>${tab === "people" ? "OSINT за людьми" : "OSINT за подіями"}</h2>
            <button class="secondary compact" type="button" data-osint-sync>${icon("refresh")} Оновити</button>
          </div>
          ${mentionList(badge, icon, tabState)}
        </article>
        <article class="panel osint-small-card osint-graph-card">
          <h2>${tab === "people" ? "Граф зв'язків" : "Типи подій"}</h2>
          ${tab === "people" ? relationshipGraph() : dataTypeBars(state)}
          ${tab === "people" ? `
            <div class="osint-graph-legend">
              <span><i class="person"></i>Фізична особа</span>
              <span><i class="company"></i>Компанія</span>
              <span><i class="line"></i>Зв'язок</span>
              <span><i class="dash"></i>Опосередкований зв'язок</span>
            </div>
          ` : ""}
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
    const reports = state.osintReports || [
      { title: "Звіт по ризиках", description: "Негативні згадки, ризики по справам та рекомендовані дії.", created: demoDateTime("16.05", "10:20") },
      { title: "Звіт по згадках", description: "Публічні згадки з Facebook, Telegram, ЗМІ та реєстрів.", created: demoDateTime("16.05", "09:45") },
      { title: "Звіт по реєстрах", description: "Зміни по компаніях, судових рішеннях і відкритих базах.", created: demoDateTime("15.05", "18:30") }
    ];
    return `
      <section class="panel osint-wide-card osint-tab-workspace">
        <div class="analytics-card-head">
          <h2>Готові OSINT звіти</h2>
          <button class="primary compact" type="button" data-osint-export>${icon("file")} Експорт</button>
        </div>
        <div class="finance-report-grid">
          ${reports.map((report) => `
            <article class="finance-report-card">
              <span>${icon("file")}</span>
              <strong>${report.title}</strong>
              <p>${report.description}</p>
              <small>Створено: ${report.created}</small>
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
  ensureOsintSources(state);
  state.osintReports = Array.isArray(state.osintReports) ? state.osintReports : [
    { title: "Звіт по ризиках", description: "Негативні згадки, ризики по справам та рекомендовані дії.", created: demoDateTime("16.05", "10:20") },
    { title: "Звіт по згадках", description: "Публічні згадки з Facebook, Telegram, ЗМІ та реєстрів.", created: demoDateTime("16.05", "09:45") },
    { title: "Звіт по реєстрах", description: "Зміни по компаніях, судових рішеннях і відкритих базах.", created: demoDateTime("15.05", "18:30") }
  ];
  state.osintDateStart = state.osintDateStart || OSINT_DEFAULT_START;
  state.osintDateEnd = state.osintDateEnd || OSINT_DEFAULT_END;
  state.osintMetricFocus = state.osintMetricFocus || "overview";
  state.osintDatePickerOpen = Boolean(state.osintDatePickerOpen);
  const filtered = filteredChecks(state);
  if (!filtered.some((check) => check.id === state.selectedOsintId)) {
    state.selectedOsintId = filtered[0]?.id || state.osintChecks[0]?.id || "";
  }
  const hasOsintData = osintHasData(state);

  $("#osint").innerHTML = `
    <div class="osint-screen osint-reference">
      <span class="sr-only">OSINT перевірки</span>
      <div class="osint-demo-note" role="note" style="margin:0 0 12px;padding:10px 14px;border:1px solid #f5dc9f;border-left:4px solid #f59e0b;border-radius:8px;background:rgba(245,158,11,0.08);color:#92400e;font-size:13px;font-weight:700;">
        Демонстраційний модуль: згадки, реєстри та граф зв'язків — приклади. Зовнішні джерела не підключені, дані не оновлюються в реальному часі.
      </div>
      <div class="osint-topbar">
        <nav class="osint-tabs" aria-label="OSINT розділи">
          ${OSINT_TABS.map(([tab, label]) => `<button class="${state.osintTab === tab ? "active" : ""}" type="button" data-osint-tab="${tab}">${label}</button>`).join("")}
        </nav>
        <div class="osint-top-actions">
          <label class="osint-search">
            ${icon("search")}
            <input data-osint-query placeholder="Пошук по OSINT..." value="${state.osintQuery || ""}">
          </label>
          <div class="analytics-date-wrap osint-date-wrap">
            <button class="analytics-date-range finance-date-range osint-date-range" type="button" data-osint-date-toggle aria-expanded="${state.osintDatePickerOpen}">
              <span>${osintDate(state.osintDateStart)} - ${osintDate(state.osintDateEnd)}</span>
              ${icon("calendar")}
            </button>
            ${state.osintDatePickerOpen ? `
              <div class="analytics-date-popover finance-date-popover osint-date-popover">
                <label>Початок
                  <input type="date" data-osint-date-start value="${state.osintDateStart}">
                </label>
                <label>Кінець
                  <input type="date" data-osint-date-end value="${state.osintDateEnd}">
                </label>
                <div>
                  <button class="secondary" type="button" data-osint-date-preset>1-16 травня</button>
                  <button class="primary" type="button" data-osint-date-apply>Застосувати</button>
                </div>
              </div>
            ` : ""}
          </div>
          <button class="primary" type="button" data-create-osint>${icon("file")} Створити звіт</button>
        </div>
      </div>

      <section class="osint-kpi-grid">
        ${osintMetrics(state).map((item) => metricCard(item, icon, state.osintMetricFocus)).join("")}
      </section>

      ${hasOsintData ? state.osintTab === "overview" ? overviewWorkspace(state, badge, icon) : secondaryWorkspace(state, badge, icon) : emptyOsintWorkspace(icon)}
    </div>
  `;

  document.querySelector("[data-osint-query]")?.addEventListener("input", (event) => {
    state.osintQuery = event.currentTarget.value;
    renderOSINTScreen(ctx);
  });
  document.querySelectorAll("[data-osint-tab]").forEach((button) => button.addEventListener("click", () => {
    state.osintTab = button.dataset.osintTab;
    state.osintMetricFocus = state.osintTab === "overview" ? "overview" : state.osintTab;
    showToast(`Відкрито розділ: ${button.textContent.trim()}.`);
    renderOSINTScreen(ctx);
  }));
  document.querySelectorAll("[data-osint-metric]").forEach((button) => button.addEventListener("click", () => {
    const focus = button.dataset.osintMetric;
    state.osintMetricFocus = focus;
    if (focus === "mentions" || focus === "risks") {
      state.osintTab = "overview";
      state.osintSubtab = focus;
      state.osintSourceManagerOpen = false;
    } else if (focus === "sources") {
      state.osintTab = "overview";
      state.osintSubtab = "mentions";
      state.osintSourceManagerOpen = true;
    } else if (focus === "cases" || focus === "monitoring") {
      state.osintTab = focus;
      state.osintSourceManagerOpen = false;
    } else {
      state.osintTab = "overview";
      state.osintSubtab = "mentions";
      state.osintSourceManagerOpen = false;
    }
    showToast(`OSINT: ${button.querySelector("span")?.textContent || "розділ"} відкрито.`);
    renderOSINTScreen(ctx);
  }));
  document.querySelectorAll("[data-create-osint]").forEach((button) => button.addEventListener("click", () => {
    createOsintReport(state);
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
    const monitor = startOsintMonitoring(state);
    showToast(monitor ? "Моніторинг справи запущено." : "Спочатку додайте справу для моніторингу.", monitor ? "success" : "warning");
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
  document.querySelector("[data-osint-manage]")?.addEventListener("click", () => {
    state.osintSourceManagerOpen = !state.osintSourceManagerOpen;
    renderOSINTScreen(ctx);
  });
  document.querySelector("[data-osint-manage-close]")?.addEventListener("click", () => {
    state.osintSourceManagerOpen = false;
    renderOSINTScreen(ctx);
  });
  document.querySelectorAll("[data-osint-source-toggle]").forEach((input) => input.addEventListener("change", () => {
    const source = state.osintSources.find((item) => item.id === input.dataset.osintSourceToggle);
    if (!source) return;
    source.enabled = input.checked;
    source.status = input.checked ? "Активне" : "Вимкнено";
    renderOSINTScreen(ctx);
  }));
  document.querySelectorAll("[data-osint-source-refresh]").forEach((button) => button.addEventListener("click", () => {
    const source = state.osintSources.find((item) => item.id === button.dataset.osintSourceRefresh);
    if (!source || !source.enabled) return;
    source.updated = currentOsintStamp();
    source.status = "Активне";
    renderOSINTScreen(ctx);
  }));
  document.querySelector("[data-osint-date-toggle]")?.addEventListener("click", () => {
    state.osintDatePickerOpen = !state.osintDatePickerOpen;
    renderOSINTScreen(ctx);
  });
  document.querySelector("[data-osint-date-start]")?.addEventListener("change", (event) => {
    state.osintDateStart = event.currentTarget.value || OSINT_DEFAULT_START;
  });
  document.querySelector("[data-osint-date-end]")?.addEventListener("change", (event) => {
    state.osintDateEnd = event.currentTarget.value || OSINT_DEFAULT_END;
  });
  document.querySelector("[data-osint-date-preset]")?.addEventListener("click", () => {
    state.osintDateStart = OSINT_DEFAULT_START;
    state.osintDateEnd = OSINT_DEFAULT_END;
    state.osintDatePickerOpen = false;
    showToast("Період OSINT повернуто до 1-16 травня.", "warning");
    renderOSINTScreen(ctx);
  });
  document.querySelector("[data-osint-date-apply]")?.addEventListener("click", () => {
    if (dateFromAny(state.osintDateStart) > dateFromAny(state.osintDateEnd)) {
      [state.osintDateStart, state.osintDateEnd] = [state.osintDateEnd, state.osintDateStart];
    }
    state.osintDatePickerOpen = false;
    showToast("Період OSINT застосовано.");
    renderOSINTScreen(ctx);
  });
  document.querySelectorAll("[data-osint-sync]").forEach((control) => {
    control.addEventListener("click", () => showToast("OSINT дані оновлено."));
  });
  document.querySelectorAll("[data-osint-quick]").forEach((button) => button.addEventListener("click", () => {
    const caseItem = selectedOsintCase(state);
    if (button.dataset.osintQuick === "person") {
      state.osintQuery = osintPersonQuery(state, caseItem);
      state.osintTab = "people";
      state.osintMetricFocus = "people";
      showToast(state.osintQuery ? `Пошук по людині: ${state.osintQuery}.` : "Пошук по людях відкрито.");
    } else {
      state.osintQuery = osintCompanyQuery(caseItem);
      state.osintTab = "overview";
      state.osintSubtab = "registries";
      state.osintMetricFocus = "mentions";
      showToast(state.osintQuery ? `Пошук по організації: ${state.osintQuery}.` : "Реєстровий пошук відкрито.");
    }
    renderOSINTScreen(ctx);
  }));
}
