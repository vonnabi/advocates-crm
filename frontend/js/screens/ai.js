import { setupScreenCustomSelects } from "../custom-selects.js";
import {
  askAiInApi,
  askAiWithAttachmentInApi,
  connectAiAssistantToApi,
  deleteAiKnowledgeFromApi,
  deleteAiSkillFromApi,
  disconnectAiAssistantFromApi,
  downloadDocxFromTextApi,
  exportAiConclusionDocx,
  getAiAssistantsFromApi,
  getAiDocumentIndexFromApi,
  getDocumentTextFromApi,
  makeTemplateFromTextWithAi,
  getAiKnowledgeFromApi,
  getAiSkillsFromApi,
  getAiUsageFromApi,
  saveAiDraftToApi,
  saveAiQuestionsToApi,
  saveAiSkillToApi,
  setAiAssistantActiveInApi,
  shouldUseApi,
  streamAiChat,
  uploadAiKnowledgeToApi
} from "../api.js";
import { normalizeDocument } from "../state.js";

// The API throws an Error whose message is the raw response body (JSON). Pull out
// the backend's human-readable `message` (e.g. "AI не налаштований"), else fall back.
function aiErrorMessage(error, fallback) {
  try {
    const parsed = JSON.parse(error?.message || "");
    if (parsed && parsed.message) return parsed.message;
  } catch (_ignored) { /* not JSON — use the fallback */ }
  return fallback;
}

const LAW_HELPERS = [
  {
    key: "family",
    label: "Сімейне право",
    icon: "user",
    tone: "blue",
    description: "Консультації щодо шлюбу, аліментів, опіки та майна",
  },
  {
    key: "criminal",
    label: "Кримінальне право",
    icon: "tag",
    tone: "violet",
    description: "Захист, процесуальні строки, кваліфікація та докази",
  },
  {
    key: "military",
    label: "Військове право",
    icon: "briefcase",
    tone: "green",
    description: "Мобілізація, військова служба, ТЦК та оскарження рішень",
  },
  {
    key: "civil",
    label: "Цивільне право",
    icon: "building",
    tone: "amber",
    description: "Договори, зобов'язання, майнові та спадкові спори",
  },
  {
    key: "administrative",
    label: "Адміністративне право",
    icon: "file",
    tone: "blue",
    description: "Скарги на органи влади, штрафи, адмінпроцедури",
  }
];

// Built-in starter questions per area. Used until the bureau saves its own
// (editable via the "Керувати" button in the chat). Saved list always wins.
const DEFAULT_QUESTIONS = {
  family: [
    "Які підстави для розірвання шлюбу?",
    "Як розрахувати розмір аліментів?",
    "Які документи потрібні для позову?",
    "Як визначити місце проживання дитини?"
  ],
  criminal: [
    "Яка відповідальність за цією статтею?",
    "Які строки досудового розслідування?",
    "Як будувати лінію захисту?",
    "Які клопотання доцільно заявити?"
  ],
  military: [
    "Як оскаржити рішення ТЦК?",
    "Які підстави для відстрочки?",
    "Які строки оскарження рішення?",
    "Які документи підтверджують відстрочку?"
  ],
  civil: [
    "Які строки позовної давності?",
    "Як обґрунтувати позовні вимоги?",
    "Які докази потрібні у справі?",
    "Чи можлива мирова угода?"
  ],
  administrative: [
    "Як оскаржити рішення органу влади?",
    "Які строки звернення до суду?",
    "Які процедурні порушення шукати?",
    "Які докази слід зібрати?"
  ]
};

const MIC_SVG = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v1a7 7 0 0 1-14 0v-1"></path><path d="M12 18v4"></path></svg>`;
const EXPAND_SVG = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3"></path><path d="M21 8V5a2 2 0 0 0-2-2h-3"></path><path d="M3 16v3a2 2 0 0 0 2 2h3"></path><path d="M16 21h3a2 2 0 0 0 2-2v-3"></path></svg>`;

// Grow a chat textarea to fit its content (up to a cap), so long text wraps and
// the box expands under the chat instead of scrolling in one line.
function autoGrowTextarea(el) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${Math.min(Math.max(el.scrollHeight, 54), 150)}px`;
}

let voiceRecognition = null;
let voiceButton = null;
let voiceStopRequested = false;

// Голосове введення (Web Speech API) — dictate the question by voice (uk-UA).
// Takes the mic button element so it reliably finds its own composer/textarea.
function toggleVoiceInput(button, state, showToast) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    showToast?.("Голосове введення не підтримується цим браузером. Спробуйте Chrome або Edge.", "warning");
    return;
  }
  if (voiceRecognition) { voiceStopRequested = true; voiceRecognition.stop(); return; } // toggle off

  const composer = button.closest(".ai-chat-composer");
  const textarea = composer?.querySelector("[data-ai-prompt]");
  const caseId = button.dataset.aiChatCase;
  if (!textarea) return;

  const rec = new SR();
  rec.lang = "uk-UA";
  rec.interimResults = true;
  rec.continuous = true;
  voiceRecognition = rec;
  voiceButton = button;
  voiceStopRequested = false;
  let baseText = textarea.value ? `${textarea.value.trimEnd()} ` : "";

  const cleanup = () => {
    button.classList.remove("recording");
    voiceRecognition = null;
    voiceButton = null;
  };
  rec.onstart = () => button.classList.add("recording");
  rec.onresult = (event) => {
    let transcript = "";
    for (let i = 0; i < event.results.length; i++) transcript += event.results[i][0].transcript;
    textarea.value = baseText + transcript;
    if (state.aiChats[caseId]) state.aiChats[caseId].draft = textarea.value;
    autoGrowTextarea(textarea);
  };
  rec.onerror = (event) => {
    const messages = {
      "not-allowed": "Немає доступу до мікрофона. Дозвольте його для сайту в налаштуваннях браузера.",
      "service-not-allowed": "Мікрофон заблоковано браузером.",
      "audio-capture": "Мікрофон не знайдено.",
      "no-speech": "Не почув голосу — спробуйте ще раз ближче до мікрофона.",
      "language-not-supported": "Українська мова недоступна для розпізнавання у цьому браузері.",
      "network": "Проблема з мережею для розпізнавання голосу."
    };
    if (messages[event.error]) showToast?.(messages[event.error], "warning");
    voiceStopRequested = true; // an error should not auto-restart
  };
  rec.onend = () => {
    // Chrome ends the session after a pause — keep listening (preserve text so far).
    if (!voiceStopRequested) {
      baseText = textarea.value ? `${textarea.value.trimEnd()} ` : "";
      try { rec.start(); return; } catch (_error) { /* fall through to cleanup */ }
    }
    cleanup();
  };
  try { rec.start(); } catch (_error) { cleanup(); }
}

// Saved questions for an area (from the backend) win; else built-in defaults.
function questionsForArea(state, areaKey) {
  const saved = state.aiSkillStats?.[areaKey]?.questions;
  if (Array.isArray(saved) && saved.length) return saved;
  return DEFAULT_QUESTIONS[areaKey] || DEFAULT_QUESTIONS.civil;
}

function fallbackDemoCaseId(suffix = "12345") {
  return `${new Date().getFullYear()}/${suffix}`;
}

function fallbackCreatedDate() {
  const date = new Date();
  date.setDate(date.getDate() - 9);
  return `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")}.${date.getFullYear()}`;
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatTokens(value) {
  const n = Number(value || 0);
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)} млн`;
  if (n >= 1000) return `${Math.round(n / 1000)} тис.`;
  return String(n);
}

function usagePanelHtml(usage, icon) {
  if (!usage) return "";
  const cost = Number(usage.estimatedCostUsd || 0).toFixed(2);
  const hasBudget = usage.budgetUsd != null;
  const remainingVal = Number(usage.remainingUsd || 0);
  const remaining = hasBudget ? `$${remainingVal.toFixed(2)}` : "—";
  const remainLabel = hasBudget ? `Залишок з $${Number(usage.budgetUsd).toFixed(2)}` : "Бюджет не задано";
  const requestsLeft = usage.estimatedRequestsLeft != null ? `≈ ${usage.estimatedRequestsLeft}` : "—";
  // Warn when the estimated remaining budget is nearly used up.
  const low = hasBudget && Number(usage.budgetUsd) > 0 && remainingVal <= Number(usage.budgetUsd) * 0.1;
  const note = low
    ? `<p class="ai-usage-note warning">⚠️ Кредити майже вичерпані (залишок ≈ ${remaining}). Поповніть рахунок на console.anthropic.com і оновіть бюджет у Налаштування → AI.</p>`
    : `<p class="ai-usage-note muted">${usage.requestCount || 0} запитів усього · орієнтовна оцінка — точний баланс кредитів у console.anthropic.com</p>`;
  return `
    <section class="ai-usage-strip ${low ? "low" : ""}" aria-label="Використання AI">
      <div class="ai-usage-tile">
        <i class="blue">${icon("wallet")}</i>
        <strong>$${cost}</strong>
        <span>Витрачено</span>
      </div>
      <div class="ai-usage-tile ${low ? "danger" : ""}">
        <i class="${low ? "red" : "green"}">${icon("dollar")}</i>
        <strong>${remaining}</strong>
        <span>${remainLabel}</span>
      </div>
      <div class="ai-usage-tile">
        <i class="violet">${icon("message")}</i>
        <strong>${requestsLeft}</strong>
        <span>Ще запитів</span>
      </div>
      <div class="ai-usage-tile">
        <i class="amber">${icon("chart")}</i>
        <strong>${formatTokens(usage.inputTokens)} / ${formatTokens(usage.outputTokens)}</strong>
        <span>Токени вх / вих</span>
      </div>
    </section>
    ${note}
  `;
}

function lawForCase(caseItem = {}) {
  const type = String(caseItem.type || "").toLowerCase();
  const title = String(caseItem.title || "").toLowerCase();
  if (type.includes("сім") || title.includes("шлюб") || title.includes("алімент")) return LAW_HELPERS[0];
  if (type.includes("крим")) return LAW_HELPERS[1];
  if (type.includes("війсь") || title.includes("військ") || title.includes("тцк")) return LAW_HELPERS[2];
  if (type.includes("адмін") || title.includes("тцк")) return LAW_HELPERS[4];
  return LAW_HELPERS[3];
}

function assistantRows(state, clientById) {
  // Opt-in: only cases the bureau explicitly connected appear as AI помічники.
  // `aiConnected` is [{ caseNumber, active }].
  const activeByNumber = new Map((state.aiConnected || []).map((item) => [item.caseNumber, item.active !== false]));
  return state.cases
    .filter((caseItem) => activeByNumber.has(caseItem.id))
    .map((caseItem) => {
      const helper = lawForCase(caseItem);
      const client = clientById(caseItem.clientId);
      const active = activeByNumber.get(caseItem.id);
      return {
        id: `case-${caseItem.id}`,
        caseId: caseItem.id,
        title: `${client?.name?.split(" ")[0] || "Клієнт"}, ${caseItem.title.toLowerCase()}`,
        subtitle: `Справа №${caseItem.id} · ${helper.label}`,
        created: caseItem.opened || fallbackCreatedDate(),
        description: "Аналізує матеріали справи: опис, сторони, документи, задачі та історію.",
        active,
        status: active ? "Активний" : "Неактивний",
        helper,
        icon: helper.icon
      };
    });
}

function defaultMessages(caseItem, helperLabel = "AI консультант") {
  // A single clean greeting, marked `seeded` so it is NOT sent to the model as
  // conversation history (it's a UI opener, not a real exchange).
  return [
    {
      role: "assistant",
      seeded: true,
      text: `Я вивчив матеріали справи №${caseItem?.id || fallbackDemoCaseId()} (${helperLabel}). Постав питання — проаналізую ризики та строки, підготую план дій або чернетку документа на основі даних справи.`
    }
  ];
}

function assistantReply(prompt, helper, caseItem) {
  const lower = prompt.toLowerCase();
  if (lower.includes("доказ") || lower.includes("матеріал")) {
    return `Для справи №${caseItem.id} варто зібрати: рішення або листування, підтвердження дат, документи клієнта, докази направлення запитів та пояснення відповідальних осіб.`;
  }
  if (lower.includes("тцк") || lower.includes("оскарж")) {
    return `По справі №${caseItem.id} перевірте строки звернення, повноваження органу, підстави рішення, медичні або сімейні документи та факт отримання відповіді.`;
  }
  if (lower.includes("апеляц") || lower.includes("строк")) {
    return `Я б виніс строк у планер, перевірив дату отримання рішення і підготував чернетку процесуального документа з контрольним дедлайном.`;
  }
  if (lower.includes("план") || lower.includes("задач")) {
    return `План: 1. Уточнити факти. 2. Перевірити строки. 3. Підготувати документ. 4. Додати контрольну задачу. 5. Зберегти висновок в історії справи.`;
  }
  return `По справі №${caseItem.id} я б перевірив ризики строків, достатність документів і відповідність дій поточному етапу: ${caseItem.stage}.`;
}

function statusTone(status) {
  return status === "Неактивний" ? "muted" : "green";
}

function statusMeta(status) {
  if (status === "Неактивний") return { icon: "clock", tone: "muted", label: "Неактивний" };
  return { icon: "check", tone: "green", label: "Активний" };
}

function selectedAssistant(state, rows) {
  return rows.find((row) => row.id === state.aiSelectedAssistantId) || rows[0];
}

function filterRows(state, rows) {
  const query = (state.aiSearchQuery || "").trim().toLowerCase();
  const lawFilter = state.aiSelectedLaw || "all";
  return rows.filter((row) => {
    const caseItem = state.cases.find((item) => item.id === row.caseId);
    const matchesQuery = !query || [row.title, row.subtitle, row.description, caseItem?.responsible, caseItem?.id]
      .some((value) => String(value || "").toLowerCase().includes(query));
    const matchesLaw = lawFilter === "all" || row.helper.key === lawFilter;
    const matchesStatus = state.aiCaseStatusFilter === "all" || row.status === state.aiCaseStatusFilter;
    return matchesQuery && matchesLaw && matchesStatus;
  });
}

function renderMessage(message, caseId = "", index = -1) {
  // "Thinking" state: animated typing dots so it's clear the помічник is working, not frozen.
  if (message.pending) {
    return `<div class="bubble ai-typing" role="status" aria-label="Помічник аналізує">
      <span class="ai-typing-dots"><span></span><span></span><span></span></span>
      <span class="ai-typing-label">Помічник аналізує…</span>
    </div>`;
  }
  const tone = message.error ? "error" : (message.role === "user" ? "user" : "");
  const attach = message.attachmentName
    ? `<div class="bubble-attach">📎 ${escapeHtml(message.attachmentName)}</div>`
    : "";
  // Assistant replies: render light-markdown (headings/lists/bold) so they're readable, not a
  // wall of text. User/error messages: escaped text with preserved line breaks.
  const isAssistant = message.role === "assistant" && !message.error;
  let body;
  if (message.text) {
    body = isAssistant ? `<div class="bubble-md">${draftToHtml(message.text)}</div>` : `<span class="bubble-plain">${escapeHtml(message.text)}</span>`;
  } else {
    body = message.attachmentName ? "<em class=\"muted\">Проаналізуй прикріплений файл</em>" : "";
  }
  const bubble = `<div class="bubble ${tone}">${attach}${body}</div>`;
  // On a real assistant reply, offer to preview or save it as an editable .docx (ONLYOFFICE).
  const canDraft = message.role === "assistant" && !message.seeded && !message.error && (message.text || "").trim().length > 40;
  if (!canDraft || !caseId || index < 0) return bubble;
  const actions = `<div class="ai-msg-actions">
    <button type="button" class="ai-msg-copy-btn" data-ai-copy-case="${escapeHtml(caseId)}" data-ai-copy-index="${index}" title="Скопіювати текст відповіді">📋 Копіювати</button>
    <button type="button" class="ai-msg-view-btn" data-ai-preview-case="${escapeHtml(caseId)}" data-ai-preview-index="${index}" title="Відкрити документ: редагувати в ONLYOFFICE, зберегти, зробити шаблон">👁 Переглянути</button>
  </div>`;
  return `<div class="ai-msg">${bubble}${actions}</div>`;
}

// Render an AI draft (plain / light-markdown) as document-like HTML for the preview.
function draftToHtml(text) {
  const inline = (s) => escapeHtml(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  let html = "";
  let inList = false;
  const closeList = () => { if (inList) { html += "</ul>"; inList = false; } };
  for (const raw of String(text || "").split("\n")) {
    const line = raw.trim().replace(/^>\s?/, ""); // drop markdown blockquote marker
    if (!line) { closeList(); continue; }
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) { closeList(); const lvl = Math.min(heading[1].length + 1, 4); html += `<h${lvl}>${inline(heading[2])}</h${lvl}>`; continue; }
    const li = line.match(/^[-*•]\s+(.*)$/);
    if (li) { if (!inList) { html += "<ul>"; inList = true; } html += `<li>${inline(li[1])}</li>`; continue; }
    closeList();
    html += `<p>${inline(line)}</p>`;
  }
  closeList();
  return html || "<p class=\"muted\">Порожній чернетка.</p>";
}

// Live-update the pending assistant bubble in a specific chat while a reply streams in.
function updateStreamingBubble(caseId, text) {
  const chatEl = document.querySelector(`.ai-chat[data-ai-chat-case="${CSS.escape(caseId)}"]`);
  if (!chatEl) return;
  let bubble = chatEl.querySelector(".bubble.streaming");
  if (!bubble) {
    // First chunk: replace the "typing" indicator with a live bubble.
    const typing = chatEl.querySelector(".ai-typing");
    bubble = document.createElement("div");
    bubble.className = "bubble streaming";
    bubble.innerHTML = '<div class="bubble-md"></div>';
    if (typing) typing.replaceWith(bubble); else chatEl.appendChild(bubble);
  }
  bubble.querySelector(".bubble-md").innerHTML = draftToHtml(text);
}

// Plain, paste-friendly version of a reply (drops markdown markers # ** > , keeps bullets).
function cleanForCopy(text) {
  return String(text || "")
    .split("\n")
    .map((line) => line
      .replace(/^\s*#{1,4}\s+/, "")
      .replace(/^\s*>\s?/, "")
      .replace(/^\s*[-*]\s+/, "• ")
      .replace(/\*\*(.+?)\*\*/g, "$1"))
    .join("\n")
    .trim();
}

// Picker that mirrors the real Документообіг screen (top filters + client/case & folder rail +
// table) inside a popup, so browsing feels familiar. Selecting a row attaches it to the chat.
async function openDocLibraryModal(onPick) {
  document.querySelector("#ai-doc-picker-dialog")?.remove();
  const dialog = document.createElement("dialog");
  dialog.id = "ai-doc-picker-dialog";
  dialog.className = "ai-doclib-dialog";
  dialog.innerHTML = `
    <div class="ai-doclib-head">
      <div>
        <h2>Документообіг</h2>
        <p class="muted">Оберіть будь-який документ — з будь-якої справи. Помічник його прочитає.</p>
      </div>
      <button type="button" class="ai-skills-x" data-doc-close aria-label="Закрити">✕</button>
    </div>
    <div class="ai-doclib-filters">
      <input type="search" data-f-search placeholder="Документ, справа, клієнт, папка…" autocomplete="off">
      <select data-f-status></select>
      <select data-f-type></select>
      <select data-f-client></select>
      <select data-f-case></select>
    </div>
    <div class="ai-doclib-body">
      <aside class="ai-doclib-rail" data-rail></aside>
      <div class="ai-doclib-main" data-main><div class="ai-doc-pick-empty">Завантажуємо документообіг…</div></div>
    </div>`;
  document.body.append(dialog);
  const close = () => dialog.close();
  dialog.querySelector("[data-doc-close]").addEventListener("click", close);
  dialog.addEventListener("close", () => dialog.remove());
  dialog.showModal();

  const mainEl = dialog.querySelector("[data-main]");
  let all = [];
  try {
    all = (await getAiDocumentIndexFromApi())?.results || [];
  } catch (_error) {
    mainEl.innerHTML = `<div class="ai-doc-pick-empty">Не вдалося завантажити документообіг.</div>`;
    return;
  }
  if (!all.length) {
    mainEl.innerHTML = `<div class="ai-doc-pick-empty">У документообігу ще немає документів із текстом/файлом.</div>`;
    return;
  }

  const filters = { search: "", status: "all", type: "all", client: "all", case: "all", folder: "all" };
  const uniq = (vals) => [...new Set(vals.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), "uk"));
  const statuses = uniq(all.map((d) => d.status));
  const types = uniq(all.map((d) => d.type));
  const clients = [...new Map(all.filter((d) => d.clientName).map((d) => [d.clientName, { id: d.clientName, name: d.clientName }])).values()]
    .sort((a, b) => a.name.localeCompare(b.name, "uk"));
  const cases = [...new Map(all.filter((d) => d.caseId).map((d) => [d.caseId, { id: d.caseId, title: d.caseTitle }])).values()];
  const folders = uniq(all.map((d) => d.folder));
  const opt = (v, label, sel) => `<option value="${escapeHtml(v)}" ${String(sel) === String(v) ? "selected" : ""}>${escapeHtml(label)}</option>`;

  const searchEl = dialog.querySelector("[data-f-search]");
  const statusEl = dialog.querySelector("[data-f-status]");
  const typeEl = dialog.querySelector("[data-f-type]");
  const clientEl = dialog.querySelector("[data-f-client]");
  const caseEl = dialog.querySelector("[data-f-case]");
  statusEl.innerHTML = opt("all", "Всі статуси") + statuses.map((s) => opt(s, s)).join("");
  typeEl.innerHTML = opt("all", "Всі типи") + types.map((t) => opt(t, t)).join("");
  clientEl.innerHTML = opt("all", "Всі клієнти") + clients.map((c) => opt(c.id, c.name)).join("");
  caseEl.innerHTML = opt("all", "Всі справи") + cases.map((c) => opt(c.id, `№${c.id} · ${c.title || ""}`)).join("");

  const matches = (d) => {
    const q = filters.search.trim().toLowerCase();
    if (q && !`${d.name} ${d.caseId} ${d.caseTitle} ${d.clientName} ${d.folder} ${d.type} ${d.status}`.toLowerCase().includes(q)) return false;
    if (filters.status !== "all" && d.status !== filters.status) return false;
    if (filters.type !== "all" && d.type !== filters.type) return false;
    if (filters.client !== "all" && d.clientName !== filters.client) return false;
    if (filters.case !== "all" && String(d.caseId) !== String(filters.case)) return false;
    if (filters.folder !== "all" && d.folder !== filters.folder) return false;
    return true;
  };

  const refresh = () => {
    statusEl.value = filters.status; typeEl.value = filters.type; clientEl.value = filters.client; caseEl.value = filters.case;
    const rows = all.filter(matches);
    // Left rail: «Документи у справах» (client → cases) + «Папки», mirroring the real screen.
    const clientBlocks = clients.map((c) => {
      const cCount = all.filter((d) => d.clientName === c.id).length;
      const cCases = [...new Map(all.filter((d) => d.clientName === c.id && d.caseId).map((d) => [d.caseId, { id: d.caseId, title: d.caseTitle }])).values()];
      const active = filters.client === c.id;
      return `
        <button type="button" class="ai-doclib-node ${active && filters.case === "all" ? "active" : ""}" data-rail-client="${escapeHtml(c.id)}">
          <span>👤 ${escapeHtml(c.name)}</span><em>${cCount}</em>
        </button>
        ${cCases.map((cc) => `
          <button type="button" class="ai-doclib-subnode ${String(filters.case) === String(cc.id) ? "active" : ""}" data-rail-case="${escapeHtml(cc.id)}">
            <span>№${escapeHtml(cc.id)} · ${escapeHtml(cc.title || "")}</span><em>${all.filter((d) => String(d.caseId) === String(cc.id)).length}</em>
          </button>`).join("")}`;
    }).join("");
    const folderBlocks = folders.map((f) => `
      <button type="button" class="ai-doclib-node ${filters.folder === f ? "active" : ""}" data-rail-folder="${escapeHtml(f)}">
        <span>📁 ${escapeHtml(f)}</span><em>${all.filter((d) => d.folder === f).length}</em>
      </button>`).join("");
    dialog.querySelector("[data-rail]").innerHTML = `
      <button type="button" class="ai-doclib-node ${filters.client === "all" && filters.case === "all" && filters.folder === "all" ? "active" : ""}" data-rail-all>
        <span>🗂 Усі документи</span><em>${all.length}</em>
      </button>
      <div class="ai-doclib-rail-title">Документи у справах</div>
      ${clientBlocks || '<div class="ai-doclib-rail-empty">—</div>'}
      <div class="ai-doclib-rail-title">Папки</div>
      ${folderBlocks || '<div class="ai-doclib-rail-empty">—</div>'}`;
    // Right: table.
    mainEl.innerHTML = rows.length ? `
      <table class="ai-doclib-table">
        <thead><tr><th>Документ</th><th>Справа</th><th>Папка</th><th>Статус</th><th>Джерело</th></tr></thead>
        <tbody>
          ${rows.map((d) => `
            <tr class="ai-doclib-row" data-doc-id="${escapeHtml(d.id)}">
              <td><span class="ai-doclib-doc-name">📄 ${escapeHtml(d.name)}</span><span class="ai-doclib-doc-type">${escapeHtml(d.type || "Документ")}</span></td>
              <td>${d.caseId ? `№${escapeHtml(d.caseId)}<span class="ai-doclib-sub">${escapeHtml(d.clientName || d.caseTitle || "")}</span>` : '<span class="ai-doclib-sub">Без справи</span>'}</td>
              <td>${escapeHtml(d.folder || "—")}</td>
              <td>${escapeHtml(d.status || "—")}</td>
              <td>${escapeHtml(d.source || "—")}</td>
            </tr>`).join("")}
        </tbody>
      </table>` : `<div class="ai-doc-pick-empty">Нічого не знайдено за фільтром.</div>`;
    dialog.querySelector("[data-main]").querySelectorAll(".ai-doclib-row").forEach((row) => row.addEventListener("click", () => {
      const picked = all.find((x) => String(x.id) === String(row.dataset.docId));
      close();
      if (picked) onPick(picked);
    }));
  };

  searchEl.addEventListener("input", () => { filters.search = searchEl.value; refresh(); });
  statusEl.addEventListener("change", () => { filters.status = statusEl.value; refresh(); });
  typeEl.addEventListener("change", () => { filters.type = typeEl.value; refresh(); });
  clientEl.addEventListener("change", () => { filters.client = clientEl.value; filters.case = "all"; refresh(); });
  caseEl.addEventListener("change", () => { filters.case = caseEl.value; filters.client = "all"; refresh(); });
  dialog.querySelector("[data-rail]").addEventListener("click", (event) => {
    const target = event.target.closest("button");
    if (!target) return;
    if (target.hasAttribute("data-rail-all")) { filters.client = "all"; filters.case = "all"; filters.folder = "all"; }
    else if (target.dataset.railClient !== undefined) { filters.client = target.dataset.railClient; filters.case = "all"; filters.folder = "all"; }
    else if (target.dataset.railCase !== undefined) { filters.case = target.dataset.railCase; filters.client = "all"; filters.folder = "all"; }
    else if (target.dataset.railFolder !== undefined) { filters.folder = filters.folder === target.dataset.railFolder ? "all" : target.dataset.railFolder; }
    refresh();
  });
  refresh();
  searchEl.focus();
}

// Best-effort document title from the first meaningful line (skips markdown / placeholders).
function guessDocTitle(text) {
  for (const raw of String(text || "").split("\n")) {
    const line = raw.trim().replace(/^#{1,4}\s+/, "").replace(/^>\s?/, "").replace(/\*\*/g, "").trim();
    if (line && line.length >= 4 && !/\{\{/.test(line)) return line.slice(0, 80);
  }
  return "Документ AI";
}

// The AI document workspace: preview → edit in ONLYOFFICE (edits come back here) → save
// (rename + destination: computer / документообіг) → or turn it into a template.
function openDraftPreviewModal({ text, caseId, showToast, openOfficeEditor, cases = [], onSavedToCase }) {
  document.querySelector("#ai-draft-preview-dialog")?.remove();
  const dialog = document.createElement("dialog");
  dialog.id = "ai-draft-preview-dialog";
  dialog.className = "ai-draft-preview-dialog";
  let currentText = text;
  let workingDoc = null; // materialised CaseDocument, so ONLYOFFICE has a file to open
  const title = guessDocTitle(text);
  dialog.innerHTML = `
    <div class="ai-preview-head">
      <div>
        <h2>Документ помічника</h2>
        <p class="muted">Редагуйте в ONLYOFFICE, збережіть куди потрібно або зробіть шаблон.</p>
      </div>
      <button type="button" class="ai-skills-x" data-preview-close aria-label="Закрити">✕</button>
    </div>
    <div class="ai-preview-paper" data-preview-paper>${draftToHtml(currentText)}</div>
    <div class="ai-preview-actions">
      <button type="button" class="ai-preview-cancel" data-preview-close>Закрити</button>
      <div class="ai-preview-actions-group">
        <button type="button" class="ai-preview-btn" data-preview-office>✏️ Редагувати в ONLYOFFICE</button>
        <button type="button" class="ai-preview-btn" data-preview-template>🧩 Зберегти як шаблон</button>
        <button type="button" class="ai-preview-btn" data-preview-make-template>✨ Зробити шаблон (AI)</button>
        <button type="button" class="ai-preview-save" data-preview-save>💾 Зберегти</button>
      </div>
    </div>`;
  document.body.append(dialog);
  const paper = dialog.querySelector("[data-preview-paper]");
  const close = () => dialog.close();
  dialog.querySelectorAll("[data-preview-close]").forEach((btn) => btn.addEventListener("click", close));
  dialog.addEventListener("close", () => dialog.remove());

  const withBusy = async (btn, label, fn) => {
    const orig = btn.innerHTML;
    btn.disabled = true;
    btn.textContent = label;
    try { await fn(); } finally { btn.disabled = false; btn.innerHTML = orig; }
  };
  const norm = (s) => String(s || "").replace(/\s+/g, " ").trim();
  const setRefreshing = (on) => {
    let banner = dialog.querySelector(".ai-preview-refreshing");
    if (on && !banner) {
      banner = document.createElement("div");
      banner.className = "ai-preview-refreshing";
      banner.innerHTML = '<span class="ai-preview-spin"></span> Отримуємо ваші зміни з ONLYOFFICE…';
      paper.before(banner);
    } else if (!on && banner) {
      banner.remove();
    }
  };

  // ✏️ Edit in ONLYOFFICE. Materialise a doc first (ONLYOFFICE needs a real file), then on
  // close poll for the edited version (its save-callback lands ~10s later) and show it here.
  dialog.querySelector("[data-preview-office]").addEventListener("click", (event) => withBusy(event.currentTarget, "Готуємо…", async () => {
    if (!openOfficeEditor) { showToast?.("Редактор ONLYOFFICE недоступний.", "warning"); return; }
    if (!workingDoc) {
      try {
        const payload = await saveAiDraftToApi({ caseNumber: caseId, text: currentText, title });
        workingDoc = normalizeDocument(payload);
        onSavedToCase?.(payload);
      } catch (error) { showToast?.(aiErrorMessage(error, "Не вдалося підготувати документ."), "danger"); return; }
    }
    // Baseline = server's extraction of the un-edited doc, to know when the edits actually land.
    let baseline = "";
    try { baseline = (await getDocumentTextFromApi(workingDoc.id))?.text || ""; } catch (_error) { /* ignore */ }
    const officeDialog = document.querySelector("#office-editor-dialog");
    if (officeDialog) {
      officeDialog.addEventListener("close", async () => {
        setRefreshing(true);
        let applied = false;
        for (let i = 0; i < 16; i++) { // ~32s window — ONLYOFFICE saves a few seconds after close
          await new Promise((resolve) => setTimeout(resolve, 2000));
          let fetched = "";
          try { fetched = (await getDocumentTextFromApi(workingDoc.id))?.text || ""; } catch (_error) { continue; }
          if (fetched.trim() && norm(fetched) !== norm(baseline)) {
            currentText = fetched;
            paper.innerHTML = draftToHtml(currentText);
            applied = true;
            break;
          }
        }
        setRefreshing(false);
        if (applied) showToast?.("Зміни з ONLYOFFICE підтягнуто — тепер можна зберегти.", "success");
        else showToast?.("Змін не виявлено (або документ ще зберігається в ONLYOFFICE).", "info");
      }, { once: true });
    }
    openOfficeEditor(workingDoc, { caseId, returnView: "ai" });
  }));

  // 🧩 Save as template (as-is)
  dialog.querySelector("[data-preview-template]").addEventListener("click", (event) => withBusy(event.currentTarget, "Зберігаємо…", async () => {
    try {
      const tpl = await saveAiDraftToApi({ caseNumber: caseId, text: currentText, title, asTemplate: true });
      const n = (tpl.placeholders || []).length;
      showToast?.(n ? `Шаблон збережено (${n} полів {{…}}). Доступний у «Скласти документ (AI)».` : "Шаблон збережено (без полів {{…}}).", n ? "success" : "info");
    } catch (error) { showToast?.(aiErrorMessage(error, "Не вдалося зберегти шаблон."), "danger"); }
  }));

  // 🧩 Make a template with AI (inserts {{placeholders}})
  dialog.querySelector("[data-preview-make-template]").addEventListener("click", (event) => withBusy(event.currentTarget, "AI робить шаблон…", async () => {
    try {
      const tpl = await makeTemplateFromTextWithAi({ text: currentText, title });
      const n = (tpl.placeholders || []).length;
      showToast?.(n ? `Помічник зробив шаблон: ${n} полів {{…}}. Доступний у «Скласти документ (AI)».` : "Шаблон створено (без полів).", n ? "success" : "info");
    } catch (error) { showToast?.(aiErrorMessage(error, "Не вдалося зробити шаблон."), "danger"); }
  }));

  // 💾 Save → destination dialog (rename + computer / документообіг)
  dialog.querySelector("[data-preview-save]").addEventListener("click", () => {
    openSaveDestinationDialog({ text: currentText, defaultTitle: title, caseId, cases, showToast, onSavedToCase });
  });

  dialog.showModal();
}

// Where to save: rename + download to computer OR open the Документообіг browser to pick a place.
function openSaveDestinationDialog({ text, defaultTitle, cases = [], showToast, onSavedToCase }) {
  document.querySelector("#ai-save-dest-dialog")?.remove();
  const dialog = document.createElement("dialog");
  dialog.id = "ai-save-dest-dialog";
  dialog.className = "ai-save-dest-dialog";
  dialog.innerHTML = `
    <div class="ai-preview-head">
      <div><h2>Зберегти документ</h2><p class="muted">Перейменуйте та оберіть, куди зберегти.</p></div>
      <button type="button" class="ai-skills-x" data-dest-close aria-label="Закрити">✕</button>
    </div>
    <div class="ai-dest-body">
      <label class="ai-dest-field"><span>Назва документа</span>
        <input type="text" data-dest-title value="${escapeHtml(defaultTitle)}"></label>
      <div class="ai-dest-field"><span>Куди зберегти</span>
        <button type="button" class="ai-dest-choice" data-dest-download>💻 Скачати .docx на комп'ютер</button>
        <button type="button" class="ai-dest-choice" data-dest-docflow>📁 Зберегти в документообіг…</button>
      </div>
    </div>`;
  document.body.append(dialog);
  const close = () => dialog.close();
  dialog.querySelector("[data-dest-close]").addEventListener("click", close);
  dialog.addEventListener("close", () => dialog.remove());
  const titleOf = () => (dialog.querySelector("[data-dest-title]").value.trim() || defaultTitle);

  dialog.querySelector("[data-dest-download]").addEventListener("click", async (event) => {
    const btn = event.currentTarget; btn.disabled = true;
    try {
      const blob = await downloadDocxFromTextApi({ text, title: titleOf() });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${titleOf()}.docx`;
      document.body.append(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      showToast?.("Документ завантажено на комп'ютер.", "success");
      close();
    } catch (_error) { btn.disabled = false; showToast?.("Не вдалося завантажити документ.", "danger"); }
  });
  dialog.querySelector("[data-dest-docflow]").addEventListener("click", () => {
    const chosenTitle = titleOf();
    close();
    openSaveToDocflowModal({ text, title: chosenTitle, cases, showToast, onSavedToCase });
  });
  dialog.showModal();
}

// Документообіг browser for choosing WHERE to save — mirrors the real screen: search, collapsible
// clients → cases, «Без справи» + folders (incl. templates). Pick a case/folder → choose folder → save.
async function openSaveToDocflowModal({ text, title, cases = [], showToast, onSavedToCase }) {
  document.querySelector("#ai-docflow-save-dialog")?.remove();
  const dialog = document.createElement("dialog");
  dialog.id = "ai-docflow-save-dialog";
  dialog.className = "ai-doclib-dialog";
  dialog.innerHTML = `
    <div class="ai-doclib-head">
      <div><h2>Куди зберегти документ</h2><p class="muted">Оберіть справу і папку — або самостійну папку / шаблони.</p></div>
      <button type="button" class="ai-skills-x" data-df-close aria-label="Закрити">✕</button>
    </div>
    <div class="ai-docflow-filters"><input type="search" data-df-search placeholder="Пошук клієнта або справи…" autocomplete="off"></div>
    <div class="ai-doclib-body ai-docflow-body">
      <aside class="ai-doclib-rail" data-df-rail></aside>
      <div class="ai-docflow-target" data-df-target><div class="ai-doc-pick-empty">← Оберіть, куди зберегти документ.</div></div>
    </div>`;
  document.body.append(dialog);
  const close = () => dialog.close();
  dialog.querySelector("[data-df-close]").addEventListener("click", close);
  dialog.addEventListener("close", () => dialog.remove());
  dialog.showModal();

  let index = [];
  try { index = (await getAiDocumentIndexFromApi())?.results || []; } catch (_error) { /* ignore */ }
  const foldersOfCase = (id) => [...new Set(index.filter((d) => String(d.caseId) === String(id) && d.folder).map((d) => d.folder))];
  const commonFolders = ["Документи справи", "Позови", "Клопотання", "Листування", "Архів"];
  const standaloneFolders = [...new Set(["Шаблони документів", ...index.filter((d) => !d.caseId && d.folder).map((d) => d.folder)])];
  const railEl = dialog.querySelector("[data-df-rail]");
  const targetEl = dialog.querySelector("[data-df-target]");
  const searchEl = dialog.querySelector("[data-df-search]");

  const groups = new Map();
  cases.slice().sort((a, b) => String(a.id).localeCompare(String(b.id), "uk")).forEach((c) => {
    const client = c.clientName || c.client || "Без клієнта";
    if (!groups.has(client)) groups.set(client, []);
    groups.get(client).push(c);
  });

  const expanded = new Set();
  let target = null;
  let query = "";

  const renderRail = () => {
    const q = query.trim().toLowerCase();
    const clientBlocks = [...groups.entries()].map(([client, list]) => {
      const matched = q ? list.filter((c) => `${c.id} ${c.title || ""} ${client}`.toLowerCase().includes(q)) : list;
      const clientMatches = q ? (client.toLowerCase().includes(q) || matched.length > 0) : true;
      if (!clientMatches) return "";
      const shown = q && !client.toLowerCase().includes(q) ? matched : list;
      const isOpen = expanded.has(client) || Boolean(q);
      return `
        <button type="button" class="ai-doclib-node ai-df-client ${isOpen ? "open" : ""}" data-df-client="${escapeHtml(client)}">
          <span class="ai-df-caret">▸</span><span class="ai-df-client-name">👤 ${escapeHtml(client)}</span><em>${list.length}</em>
        </button>
        ${isOpen ? shown.map((c) => `
          <button type="button" class="ai-doclib-subnode ${target?.caseId === c.id ? "active" : ""}" data-df-case="${escapeHtml(c.id)}">
            <span>№${escapeHtml(c.id)} · ${escapeHtml(c.title || "")}</span>
          </button>`).join("") : ""}`;
    }).join("");
    railEl.innerHTML = `
      <button type="button" class="ai-doclib-node ${target?.standalone && !target?.fixedFolder ? "active" : ""}" data-df-standalone>
        <span>🗂 Без справи (самостійна папка)</span></button>
      <div class="ai-doclib-rail-title">Документи у справах</div>
      ${clientBlocks || '<div class="ai-doclib-rail-empty">Нічого не знайдено</div>'}
      <div class="ai-doclib-rail-title">Папки</div>
      ${standaloneFolders.map((f) => `
        <button type="button" class="ai-doclib-node ${target?.fixedFolder === f ? "active" : ""}" data-df-folder-node="${escapeHtml(f)}">
          <span>📁 ${escapeHtml(f)}</span></button>`).join("")}`;
  };

  const renderTarget = () => {
    if (!target) { targetEl.innerHTML = '<div class="ai-doc-pick-empty">← Оберіть, куди зберегти документ.</div>'; return; }
    let defFolder;
    let chips;
    if (target.caseId) { defFolder = "Документи справи"; chips = [...new Set([...foldersOfCase(target.caseId), ...commonFolders])]; }
    else if (target.fixedFolder) { defFolder = target.fixedFolder; chips = [...new Set([target.fixedFolder, ...standaloneFolders, "Архів"])]; }
    else { defFolder = "Мої документи"; chips = ["Мої документи", "Архів", ...standaloneFolders]; }
    targetEl.innerHTML = `
      <div class="ai-df-target-head">📁 ${escapeHtml(target.label || "")}</div>
      <label class="ai-df-field"><span>Папка</span>
        <input type="text" data-df-folder value="${escapeHtml(defFolder)}" placeholder="Назва папки"></label>
      <div class="ai-df-chips">${chips.map((f) => `<button type="button" class="ai-df-chip" data-df-folder-pick="${escapeHtml(f)}">${escapeHtml(f)}</button>`).join("")}</div>
      <button type="button" class="ai-df-save" data-df-save>💾 Зберегти сюди</button>`;
    targetEl.querySelectorAll("[data-df-folder-pick]").forEach((chip) => chip.addEventListener("click", () => {
      targetEl.querySelector("[data-df-folder]").value = chip.dataset.dfFolderPick;
    }));
    targetEl.querySelector("[data-df-save]").addEventListener("click", async (event) => {
      const btn = event.currentTarget;
      const folder = targetEl.querySelector("[data-df-folder]").value.trim() || defFolder;
      btn.disabled = true; btn.textContent = "Зберігаємо…";
      try {
        const payload = await saveAiDraftToApi({ caseNumber: target.caseId || "", text, title, folder });
        onSavedToCase?.(payload);
        showToast?.(`Збережено: ${target.caseId ? "справа №" + target.caseId : "без справи"} · ${folder}.`, "success");
        close();
      } catch (error) { btn.disabled = false; btn.textContent = "💾 Зберегти сюди"; showToast?.(aiErrorMessage(error, "Не вдалося зберегти."), "danger"); }
    });
  };

  railEl.addEventListener("click", (event) => {
    const node = event.target.closest("button");
    if (!node) return;
    if (node.dataset.dfClient !== undefined) {
      // Toggle a client open/closed (collapsed by default, like the real Документообіг).
      const client = node.dataset.dfClient;
      if (expanded.has(client)) expanded.delete(client); else expanded.add(client);
      renderRail();
      return;
    }
    if (node.hasAttribute("data-df-standalone")) target = { standalone: true, label: "Без справи (самостійна папка)" };
    else if (node.dataset.dfFolderNode !== undefined) target = { standalone: true, fixedFolder: node.dataset.dfFolderNode, label: node.dataset.dfFolderNode };
    else if (node.dataset.dfCase !== undefined) {
      const c = cases.find((x) => String(x.id) === String(node.dataset.dfCase));
      target = { caseId: node.dataset.dfCase, label: `Справа №${node.dataset.dfCase} · ${c?.title || ""}` };
    } else return;
    renderRail();
    renderTarget();
  });

  searchEl.addEventListener("input", () => { query = searchEl.value; renderRail(); });
  renderRail();
  searchEl.focus();
}

function inlineChatPanel(row, caseItem, helper, messages, icon, draft = "", questions = [], attachment = null) {
  return `
    <section class="panel ai-card-chat-panel">
      <div class="toolbar compact">
        <div>
          <h2>Чат по справі</h2>
          <p class="muted">№${escapeHtml(caseItem.id)} · ${escapeHtml(helper.label)} · ${escapeHtml(row.title)}</p>
        </div>
        <button class="ai-chat-close" type="button" data-ai-close-chat="${row.id}" aria-label="Згорнути чат" title="Згорнути чат">
          ×
        </button>
      </div>
      <div class="ai-chat" data-ai-chat-case="${escapeHtml(caseItem.id)}">
        ${messages.map((message, index) => renderMessage(message, caseItem.id, index)).join("")}
      </div>
      <div class="ai-chat-composer">
        <div class="ai-composer-tools">
          <details class="ai-questions-details">
            <summary class="ai-questions-summary">💡 Швидкі питання</summary>
            <div class="ai-question-list">
              ${questions.map((question) => `<button type="button" data-ai-question="${escapeHtml(question)}" data-ai-chat-case="${escapeHtml(caseItem.id)}">${escapeHtml(question)}</button>`).join("")}
              <button type="button" class="ai-question-manage" data-ai-manage-questions="${escapeHtml(helper.key)}" title="Редагувати швидкі питання">${icon("edit")} Редагувати</button>
            </div>
          </details>
        </div>
        ${attachment ? `
        <div class="ai-attach-chip">
          <span class="ai-attach-name">📎 ${escapeHtml(attachment.name)}</span>
          <button type="button" class="ai-attach-remove" data-ai-attach-remove data-ai-chat-case="${escapeHtml(caseItem.id)}" title="Прибрати файл" aria-label="Прибрати файл">✕</button>
        </div>` : ""}
        <div class="ai-input-row">
          <input type="file" hidden data-ai-attach-input data-ai-chat-case="${escapeHtml(caseItem.id)}" accept="image/png,image/jpeg,image/gif,image/webp,.pdf,.docx,.txt,.md">
          <div class="ai-attach-wrap">
            <button class="ai-attach-btn" type="button" data-ai-attach data-ai-chat-case="${escapeHtml(caseItem.id)}" aria-label="Додати документ" title="Додати документ для аналізу">${icon("file")}</button>
            <div class="ai-attach-menu" data-ai-attach-menu hidden>
              <button type="button" data-ai-attach-computer data-ai-chat-case="${escapeHtml(caseItem.id)}">💻 З комп'ютера</button>
              <button type="button" data-ai-attach-docs data-ai-chat-case="${escapeHtml(caseItem.id)}">📁 З документообігу</button>
            </div>
          </div>
          <textarea data-ai-prompt data-ai-chat-case="${escapeHtml(caseItem.id)}" rows="1" placeholder="Напишіть питання по справі…  (Enter — надіслати, Shift+Enter — новий рядок)">${escapeHtml(draft)}</textarea>
          <button class="ai-voice-btn" type="button" data-ai-voice data-ai-chat-case="${escapeHtml(caseItem.id)}" aria-label="Голосове введення" title="Диктувати голосом">${MIC_SVG}</button>
          <button class="primary icon-button" type="button" data-ai-send data-ai-chat-case="${escapeHtml(caseItem.id)}" aria-label="Надіслати">${icon("telegram")}</button>
        </div>
      </div>
    </section>
  `;
}

function ensureSkillsStyles() {
  if (document.querySelector("#ai-skills-styles")) return;
  const style = document.createElement("style");
  style.id = "ai-skills-styles";
  style.textContent = `
    .ai-skills-dialog { width: min(880px, 94vw); max-width: 94vw; border: none; border-radius: 16px; padding: 0; background: #fff; color: #1a2233; box-shadow: 0 24px 70px rgba(15,23,42,.28); }
    .ai-skills-dialog::backdrop { background: rgba(15,23,42,.45); }
    .ai-skills-head { display: flex; gap: 16px; align-items: flex-start; justify-content: space-between; padding: 22px 24px 12px; border-bottom: 1px solid #eef1f6; }
    .ai-skills-head h2 { margin: 0 0 6px; font-size: 20px; }
    .ai-skills-head .muted { margin: 0; font-size: 13px; color: #6b7482; max-width: 640px; }
    .ai-skills-x { border: none; background: #f1f3f7; width: 34px; height: 34px; border-radius: 9px; cursor: pointer; font-size: 15px; color: #475066; flex: none; }
    .ai-skills-x:hover { background: #e6e9f0; }
    .ai-skills-body { display: grid; grid-template-columns: 210px 1fr; gap: 0; min-height: 380px; }
    .ai-skills-tabs { display: flex; flex-direction: column; gap: 4px; padding: 16px 12px; border-right: 1px solid #eef1f6; background: #fafbfd; }
    .ai-skill-tab { text-align: left; border: none; background: transparent; padding: 10px 12px; border-radius: 9px; cursor: pointer; font-size: 14px; color: #364152; }
    .ai-skill-tab:hover { background: #eef1f6; }
    .ai-skill-tab.active { background: #223759; color: #fff; font-weight: 600; }
    .ai-skills-editor { display: flex; flex-direction: column; gap: 10px; padding: 18px 22px 22px; }
    .ai-skill-caption-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .ai-skill-caption { font-size: 13px; color: #6b7482; }
    .ai-skill-caption strong { color: #1a2233; }
    .ai-skill-expand { display: inline-flex; align-items: center; gap: 6px; border: 1px solid #d9dee7; background: #f6f8fc; color: #223759; border-radius: 8px; padding: 6px 11px; font-size: 12.5px; cursor: pointer; flex: none; }
    .ai-skill-expand:hover { background: #e9eefa; }
    .ai-skills-dialog.fullscreen { width: 96vw; max-width: 96vw; height: 92vh; display: flex; flex-direction: column; }
    .ai-skills-dialog.fullscreen .ai-skills-body { flex: 1; min-height: 0; }
    .ai-skills-dialog.fullscreen .ai-skills-editor { min-height: 0; }
    .ai-skills-dialog.fullscreen textarea[data-skill-content] { flex: 1; min-height: 0; }
    .ai-skills-editor textarea { flex: 1; min-height: 260px; resize: vertical; border: 1px solid #d9dee7; border-radius: 12px; padding: 14px; font: 14px/1.55 inherit; color: #1a2233; outline: none; }
    .ai-skills-editor textarea:focus { border-color: #6f86b8; box-shadow: 0 0 0 3px rgba(111,134,184,.18); }
    .ai-skill-status { margin: 0; font-size: 12px; }
    .ai-skills-actions { display: flex; flex-wrap: wrap; gap: 10px; }
    .ai-skills-actions button { padding: 10px 16px; border-radius: 9px; cursor: pointer; font-size: 14px; border: 1px solid #d9dee7; background: #fff; color: #223759; }
    .ai-skills-actions button:hover { background: #f4f6fa; }
    .ai-skills-actions button.primary { background: #223759; color: #fff; border-color: #223759; }
    .ai-skills-actions button.primary:hover { background: #1a2c48; }
    .ai-skills-actions button.danger { color: #b42318; border-color: #f2c9c4; }
    .ai-skills-actions button.danger:hover { background: #fdf1f0; }
    .ai-skills-files { border-top: 1px solid #eef1f6; margin-top: 6px; padding-top: 12px; }
    .ai-skills-files-head { display: flex; align-items: center; gap: 12px; }
    .ai-skills-files-head strong { font-size: 14px; }
    .ai-skills-files-head button { margin-left: auto; padding: 7px 12px; border-radius: 8px; border: 1px solid #cdd6e6; background: #eef2fb; color: #223759; cursor: pointer; font-size: 13px; }
    .ai-skills-files-head button:hover { background: #e2e9f7; }
    .ai-knowledge-hint { margin: 6px 0 8px; font-size: 12px; }
    .ai-knowledge-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; max-height: 150px; overflow-y: auto; }
    .ai-knowledge-row { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border: 1px solid #e7ebf2; border-radius: 9px; font-size: 13px; }
    .ai-knowledge-row .kn-name { font-weight: 500; color: #1a2233; word-break: break-word; }
    .ai-knowledge-row .kn-meta { color: #8a93a3; font-size: 12px; margin-left: auto; white-space: nowrap; }
    .ai-knowledge-row .kn-del { border: none; background: #fbeceb; color: #b42318; width: 26px; height: 26px; border-radius: 7px; cursor: pointer; flex: none; }
    .ai-knowledge-empty { color: #8a93a3; font-size: 13px; padding: 6px 2px; }
    .ai-export-dialog { width: min(440px, 92vw); }
    .ai-export-formats { display: flex; flex-direction: column; gap: 10px; padding: 18px 22px 24px; }
    .ai-export-formats button { padding: 13px 16px; border-radius: 10px; cursor: pointer; font-size: 15px; border: 1px solid #d9dee7; background: #fff; color: #223759; text-align: left; }
    .ai-export-formats button:hover { background: #f4f6fa; }
    .ai-export-formats button.primary { background: #223759; color: #fff; border-color: #223759; }
    .ai-export-formats button.primary:hover { background: #1a2c48; }
    .ai-casepicker-dialog { width: min(600px, 94vw); }
    .ai-picker-body { padding: 16px 22px 22px; display: grid; gap: 12px; }
    .ai-picker-search { border: 1px solid #d9dee7; border-radius: 10px; padding: 11px 14px; font: 14px inherit; outline: none; }
    .ai-picker-search:focus { border-color: #6f86b8; box-shadow: 0 0 0 3px rgba(111,134,184,.18); }
    .ai-picker-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; max-height: 420px; overflow-y: auto; }
    .ai-picker-row { display: flex; align-items: center; gap: 12px; padding: 11px 14px; border: 1px solid #e7ebf2; border-radius: 11px; }
    .ai-picker-info { display: grid; gap: 2px; min-width: 0; }
    .ai-picker-info strong { color: #1a2233; font-size: 14px; }
    .ai-picker-info span { color: #6b7482; font-size: 12px; overflow: hidden; text-overflow: ellipsis; }
    .ai-picker-row button { margin-left: auto; flex: none; padding: 8px 16px; border-radius: 8px; border: 1px solid #223759; background: #223759; color: #fff; cursor: pointer; font-size: 13px; }
    .ai-picker-row button:hover { background: #1a2c48; }
    .ai-picker-row button:disabled { opacity: .5; cursor: default; }
    .ai-questions-dialog { width: min(560px, 94vw); }
    .ai-questions-body { padding: 16px 22px 22px; display: grid; gap: 12px; }
    .ai-questions-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; max-height: 360px; overflow-y: auto; }
    .ai-q-row { display: flex; gap: 8px; align-items: center; }
    .ai-q-row input { flex: 1; border: 1px solid #d9dee7; border-radius: 9px; padding: 10px 12px; font: 14px inherit; outline: none; }
    .ai-q-row input:focus { border-color: #6f86b8; box-shadow: 0 0 0 3px rgba(111,134,184,.18); }
    .ai-q-del { border: none; background: #fbeceb; color: #b42318; width: 34px; height: 34px; border-radius: 8px; cursor: pointer; flex: none; }
    .ai-q-add { align-self: start; border: 1px dashed #cdd6e6; background: #f6f8fc; color: #223759; border-radius: 9px; padding: 9px 14px; cursor: pointer; font-size: 13px; }
    .ai-q-add:hover { background: #eef2fb; }
    .ai-questions-actions { display: flex; gap: 10px; border-top: 1px solid #eef1f6; padding-top: 14px; }
    .ai-questions-actions button { padding: 10px 18px; border-radius: 9px; cursor: pointer; font-size: 14px; border: 1px solid #d9dee7; background: #fff; color: #223759; }
    .ai-questions-actions button.primary { background: #223759; color: #fff; border-color: #223759; }
    @media (max-width: 640px) { .ai-skills-body { grid-template-columns: 1fr; } .ai-skills-tabs { flex-direction: row; overflow-x: auto; border-right: none; border-bottom: 1px solid #eef1f6; } }
  `;
  document.head.append(style);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = String(filename).replace(/[\\/]/g, "-");
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function realAiMessages(messages) {
  return (messages || []).filter((message) => !message.seeded && !message.pending && message.text);
}

function buildExportText(caseItem, helper, messages, markdown) {
  const header = markdown
    ? `# Висновок AI-помічника\n\n**Справа №${caseItem.id}** · ${helper.label} · ${caseItem.title}\n\n---\n`
    : `Висновок AI-помічника\nСправа №${caseItem.id} · ${helper.label} · ${caseItem.title}\n${"=".repeat(48)}\n`;
  const body = messages.map((message) => {
    const who = message.role === "user" ? "Клієнт" : "AI-помічник";
    return markdown ? `**${who}:**\n\n${message.text}\n` : `${who}:\n${message.text}\n`;
  }).join("\n");
  return `${header}\n${body}`;
}

// "Експорт висновку" — save the current case conversation as .txt / .md / .docx.
function openExportPicker(caseItem, helper, messages, showToast) {
  const real = realAiMessages(messages);
  if (!real.length) {
    showToast?.("Немає діалогу для експорту — спершу поставте питання помічнику.", "warning");
    return;
  }
  ensureSkillsStyles();
  document.querySelector("#ai-export-dialog")?.remove();
  const dialog = document.createElement("dialog");
  dialog.id = "ai-export-dialog";
  dialog.className = "ai-skills-dialog ai-export-dialog";
  dialog.innerHTML = `
    <div class="ai-skills-head">
      <div>
        <h2>Експорт висновку</h2>
        <p class="muted">Оберіть формат файлу для збереження діалогу з AI по справі №${escapeHtml(caseItem.id)}.</p>
      </div>
      <button type="button" class="ai-skills-x" data-export-close aria-label="Закрити">✕</button>
    </div>
    <div class="ai-export-formats">
      <button type="button" class="primary" data-export-format="txt">Текст (.txt)</button>
      <button type="button" data-export-format="md">Markdown (.md)</button>
      <button type="button" data-export-format="docx">Word (.docx)</button>
    </div>
  `;
  document.body.append(dialog);
  dialog.querySelector("[data-export-close]").addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => dialog.remove());

  const subtitle = `Справа №${caseItem.id} · ${helper.label} · ${caseItem.title}`;
  const payloadMessages = real.map((message) => ({ role: message.role, text: message.text }));
  dialog.querySelectorAll("[data-export-format]").forEach((button) => button.addEventListener("click", async () => {
    const format = button.dataset.exportFormat;
    try {
      if (format === "docx") {
        const blob = await exportAiConclusionDocx({ title: "Висновок AI-помічника", subtitle, messages: payloadMessages });
        downloadBlob(blob, `ai-vysnovok-${caseItem.id}.docx`);
      } else {
        const markdown = format === "md";
        const text = buildExportText(caseItem, helper, real, markdown);
        const mime = markdown ? "text/markdown;charset=utf-8" : "text/plain;charset=utf-8";
        downloadBlob(new Blob([text], { type: mime }), `ai-vysnovok-${caseItem.id}.${format}`);
      }
      showToast?.("Висновок збережено на комп'ютер.");
      dialog.close();
    } catch (_error) {
      showToast?.("Не вдалося сформувати файл.", "danger");
    }
  }));
  dialog.showModal();
}

// "Керувати питаннями" — add/edit/delete the per-area quick questions (chat chips).
function openQuestionsManager({ state, areaKey, areaLabel, showToast, rerender }) {
  if (!shouldUseApi(state)) {
    showToast?.("Редагування питань доступне через сервер (Django).", "warning");
    return;
  }
  ensureSkillsStyles();
  document.querySelector("#ai-questions-dialog")?.remove();
  const dialog = document.createElement("dialog");
  dialog.id = "ai-questions-dialog";
  dialog.className = "ai-skills-dialog ai-questions-dialog";
  dialog.innerHTML = `
    <div class="ai-skills-head">
      <div>
        <h2>Швидкі питання — ${escapeHtml(areaLabel)}</h2>
        <p class="muted">Ці питання показуються кнопками під чатом для цієї галузі. Додавайте, редагуйте або видаляйте.</p>
      </div>
      <button type="button" class="ai-skills-x" data-q-close aria-label="Закрити">✕</button>
    </div>
    <div class="ai-questions-body">
      <ul class="ai-questions-list" data-q-list></ul>
      <button type="button" class="ai-q-add" data-q-add>+ Додати питання</button>
      <div class="ai-questions-actions">
        <button type="button" class="primary" data-q-save>Зберегти</button>
        <button type="button" data-q-cancel>Скасувати</button>
      </div>
    </div>
  `;
  document.body.append(dialog);
  const listEl = dialog.querySelector("[data-q-list]");
  const addRow = (value = "") => {
    const li = document.createElement("li");
    li.className = "ai-q-row";
    li.innerHTML = `<input type="text" maxlength="300" placeholder="Текст питання…"><button type="button" class="ai-q-del" aria-label="Видалити">✕</button>`;
    li.querySelector("input").value = value;
    li.querySelector(".ai-q-del").addEventListener("click", () => li.remove());
    listEl.append(li);
  };
  questionsForArea(state, areaKey).forEach((question) => addRow(question));

  dialog.querySelector("[data-q-add]").addEventListener("click", () => {
    addRow("");
    listEl.lastElementChild?.querySelector("input")?.focus();
  });
  const close = () => dialog.close();
  dialog.querySelector("[data-q-close]").addEventListener("click", close);
  dialog.querySelector("[data-q-cancel]").addEventListener("click", close);
  dialog.addEventListener("close", () => dialog.remove());
  dialog.querySelector("[data-q-save]").addEventListener("click", async () => {
    const questions = [...listEl.querySelectorAll("input")].map((input) => input.value.trim()).filter(Boolean).slice(0, 20);
    try {
      const saved = await saveAiQuestionsToApi(areaKey, questions);
      state.aiSkillStats = state.aiSkillStats || {};
      state.aiSkillStats[areaKey] = { ...(state.aiSkillStats[areaKey] || {}), questions: saved.questions };
      showToast?.("Швидкі питання збережено.");
      dialog.close();
      rerender();
    } catch (_error) {
      showToast?.("Не вдалося зберегти питання.", "danger");
    }
  });
  dialog.showModal();
}

// "Додати справу" — pick which cases to connect to the AI (opt-in, not all cases).
function openCasePicker({ state, clientById, showToast, rerender }) {
  if (!shouldUseApi(state)) {
    showToast?.("Підключення справ доступне через сервер (Django), а не статичні файли.", "warning");
    return;
  }
  ensureSkillsStyles();
  document.querySelector("#ai-casepicker-dialog")?.remove();
  const dialog = document.createElement("dialog");
  dialog.id = "ai-casepicker-dialog";
  dialog.className = "ai-skills-dialog ai-casepicker-dialog";
  const connectedNums = new Set((state.aiConnected || []).map((item) => item.caseNumber));
  const available = (state.cases || []).filter((caseItem) => !connectedNums.has(caseItem.id));

  dialog.innerHTML = `
    <div class="ai-skills-head">
      <div>
        <h2>Додати справу до AI</h2>
        <p class="muted">Підключіть лише ті справи, з якими працюєте — не всі одразу. Підключену справу можна відключити будь-коли.</p>
      </div>
      <button type="button" class="ai-skills-x" data-picker-close aria-label="Закрити">✕</button>
    </div>
    <div class="ai-picker-body">
      <input class="ai-picker-search" data-picker-search type="search" placeholder="Пошук за номером, клієнтом або назвою…">
      <ul class="ai-picker-list" data-picker-list></ul>
    </div>
  `;
  document.body.append(dialog);
  const listEl = dialog.querySelector("[data-picker-list]");
  const searchEl = dialog.querySelector("[data-picker-search]");

  const renderList = () => {
    const query = searchEl.value.trim().toLowerCase();
    const items = available.filter((caseItem) => {
      const client = clientById(caseItem.clientId);
      return !query || [caseItem.id, caseItem.title, client?.name].some((value) => String(value || "").toLowerCase().includes(query));
    });
    if (!items.length) {
      listEl.innerHTML = `<li class="ai-knowledge-empty">${available.length ? "Нічого не знайдено." : "Усі справи вже підключені (або справ ще немає)."}</li>`;
      return;
    }
    listEl.innerHTML = items.map((caseItem) => {
      const client = clientById(caseItem.clientId);
      return `
        <li class="ai-picker-row">
          <div class="ai-picker-info">
            <strong>${escapeHtml(client?.name || "Клієнт")}</strong>
            <span>№${escapeHtml(caseItem.id)} · ${escapeHtml(caseItem.type || "—")} · ${escapeHtml(caseItem.title || "")}</span>
          </div>
          <button type="button" class="primary" data-pick-case="${escapeHtml(caseItem.id)}">Підключити</button>
        </li>`;
    }).join("");
  };

  dialog.querySelector("[data-picker-close]").addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => dialog.remove());
  searchEl.addEventListener("input", renderList);
  listEl.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-pick-case]");
    if (!button) return;
    const caseNumber = button.dataset.pickCase;
    button.disabled = true;
    try {
      await connectAiAssistantToApi(caseNumber);
      state.aiConnected = [...(state.aiConnected || []), { caseNumber, active: true }];
      const index = available.findIndex((caseItem) => caseItem.id === caseNumber);
      if (index >= 0) available.splice(index, 1);
      // Open the freshly connected assistant's chat (accordion, alongside others).
      if (!state.aiOpenChatIds.includes(`case-${caseNumber}`)) state.aiOpenChatIds.push(`case-${caseNumber}`);
      state.aiSkillStatsLoaded = false;
      showToast?.("Справу підключено до AI.");
      renderList();
      rerender();
    } catch (error) {
      button.disabled = false;
      showToast?.(aiErrorMessage(error, "Не вдалося підключити справу."), "danger");
    }
  });

  renderList();
  dialog.showModal();
}

// "Управління знаннями" — full CRUD editor for the per-area bureau skills that
// get injected into the AI помічник's prompt. Edit/append, upload from file,
// export to file, clear. Requires the Django backend (real API mode).
function openSkillsManager({ state, showToast }) {
  if (!shouldUseApi(state)) {
    showToast?.("База знань доступна, коли CRM відкрита через сервер (Django), а не статичні файли.", "warning");
    return;
  }
  ensureSkillsStyles();
  document.querySelector("#ai-skills-dialog")?.remove();

  const dialog = document.createElement("dialog");
  dialog.id = "ai-skills-dialog";
  dialog.className = "ai-skills-dialog";
  const tabs = LAW_HELPERS.map((helper, index) =>
    `<button type="button" class="ai-skill-tab${index === 0 ? " active" : ""}" data-skill-tab="${helper.key}">${escapeHtml(helper.label)}</button>`
  ).join("");
  dialog.innerHTML = `
    <div class="ai-skills-head">
      <div>
        <h2>База знань помічників</h2>
        <p class="muted">Скіл — інструкція та експертиза бюро для галузі права. Помічник читає її при кожному запиті. Це не «навчання моделі», а ваші настанови, які ви дописуєте.</p>
      </div>
      <button type="button" class="ai-skills-x" data-skill-close aria-label="Закрити">✕</button>
    </div>
    <div class="ai-skills-body">
      <aside class="ai-skills-tabs">${tabs}</aside>
      <div class="ai-skills-editor">
        <div class="ai-skill-caption-row">
          <label class="ai-skill-caption">Навички для: <strong data-skill-current></strong></label>
          <button type="button" class="ai-skill-expand" data-skill-expand title="Розгорнути на весь екран">${EXPAND_SVG}<span>На весь екран</span></button>
        </div>
        <textarea data-skill-content placeholder="Напишіть експертизу бюро для цієї галузі: на що звертати увагу, які статті перевіряти, які шаблони й аргументи використовувати…"></textarea>
        <p class="ai-skill-status muted" data-skill-status></p>
        <div class="ai-skills-actions">
          <button type="button" class="primary" data-skill-save>Зберегти</button>
          <button type="button" data-skill-upload>Завантажити текст</button>
          <button type="button" data-skill-export>Експортувати</button>
          <button type="button" class="danger" data-skill-clear>Очистити</button>
          <input type="file" accept=".txt,.md,.markdown,.text" hidden data-skill-file>
        </div>
        <div class="ai-skills-files">
          <div class="ai-skills-files-head">
            <strong>Файли-знання</strong>
            <button type="button" data-knowledge-upload>+ Додати файл</button>
            <input type="file" accept=".txt,.md,.markdown,.text,.docx,.pdf" hidden data-knowledge-file>
          </div>
          <p class="muted ai-knowledge-hint">Шаблони, методички, зразки — модель використовує їх у відповідях по цій галузі. Формати: .txt, .md, .docx, .pdf (до 10 МБ).</p>
          <ul class="ai-knowledge-list" data-knowledge-list></ul>
        </div>
      </div>
    </div>
  `;
  document.body.append(dialog);

  const labelFor = (key) => LAW_HELPERS.find((helper) => helper.key === key)?.label || key;
  const cache = {}; // key -> { title, content, updatedAt }
  let currentKey = LAW_HELPERS[0].key;

  const contentEl = dialog.querySelector("[data-skill-content]");
  const currentEl = dialog.querySelector("[data-skill-current]");
  const statusEl = dialog.querySelector("[data-skill-status]");
  const fileEl = dialog.querySelector("[data-skill-file]");
  const knowledgeListEl = dialog.querySelector("[data-knowledge-list]");
  const knowledgeFileEl = dialog.querySelector("[data-knowledge-file]");

  const stamp = (value) => (value ? `Збережено: ${new Date(value).toLocaleString("uk-UA")}` : "Ще не збережено.");
  const formatSize = (chars) => (chars >= 1000 ? `${Math.round(chars / 1000)} тис. симв.` : `${chars} симв.`);

  const renderKnowledge = (docs) => {
    if (!docs.length) {
      knowledgeListEl.innerHTML = `<li class="ai-knowledge-empty">Ще немає файлів. Додайте шаблони чи методички для цієї галузі.</li>`;
      return;
    }
    knowledgeListEl.innerHTML = docs.map((doc) => `
      <li class="ai-knowledge-row" data-knowledge-id="${doc.id}">
        <span class="kn-name">${escapeHtml(doc.filename)}</span>
        <span class="kn-meta">${formatSize(doc.sizeChars || 0)}</span>
        <button type="button" class="kn-del" data-knowledge-del="${doc.id}" aria-label="Видалити">✕</button>
      </li>
    `).join("");
  };

  const loadKnowledge = (key) => {
    knowledgeListEl.innerHTML = `<li class="ai-knowledge-empty">Завантаження…</li>`;
    getAiKnowledgeFromApi(key)
      .then((data) => { if (currentKey === key) renderKnowledge(data?.results || []); })
      .catch(() => { if (currentKey === key) knowledgeListEl.innerHTML = `<li class="ai-knowledge-empty">Не вдалося завантажити файли.</li>`; });
  };

  const showArea = (key) => {
    currentKey = key;
    currentEl.textContent = labelFor(key);
    contentEl.value = cache[key]?.content || "";
    statusEl.textContent = stamp(cache[key]?.updatedAt);
    dialog.querySelectorAll("[data-skill-tab]").forEach((tab) => tab.classList.toggle("active", tab.dataset.skillTab === key));
    loadKnowledge(key);
  };

  contentEl.addEventListener("input", () => {
    cache[currentKey] = { ...(cache[currentKey] || {}), content: contentEl.value };
  });
  dialog.querySelectorAll("[data-skill-tab]").forEach((tab) => tab.addEventListener("click", () => showArea(tab.dataset.skillTab)));
  dialog.querySelector("[data-skill-close]").addEventListener("click", () => dialog.close());
  dialog.querySelector("[data-skill-expand]").addEventListener("click", () => {
    dialog.classList.toggle("fullscreen");
    const expanded = dialog.classList.contains("fullscreen");
    dialog.querySelector("[data-skill-expand] span").textContent = expanded ? "Згорнути" : "На весь екран";
  });
  dialog.addEventListener("close", () => {
    dialog.remove();
    state.aiSkillStatsLoaded = false; // refresh doc/request counters on the main screen
  });

  dialog.querySelector("[data-skill-save]").addEventListener("click", async () => {
    try {
      const saved = await saveAiSkillToApi(currentKey, { title: labelFor(currentKey), content: contentEl.value });
      cache[currentKey] = { title: saved.title, content: saved.content, updatedAt: saved.updatedAt };
      statusEl.textContent = stamp(saved.updatedAt);
      showToast?.("Навички збережено.");
    } catch (_error) {
      showToast?.("Не вдалося зберегти навички.", "danger");
    }
  });

  dialog.querySelector("[data-skill-clear]").addEventListener("click", async () => {
    try {
      await deleteAiSkillFromApi(currentKey);
      cache[currentKey] = { title: labelFor(currentKey), content: "", updatedAt: "" };
      contentEl.value = "";
      statusEl.textContent = "Очищено.";
      showToast?.("Навички очищено.");
    } catch (_error) {
      showToast?.("Не вдалося очистити навички.", "danger");
    }
  });

  dialog.querySelector("[data-skill-export]").addEventListener("click", () => {
    const blob = new Blob([contentEl.value || ""], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `skill-${currentKey}.md`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast?.("Файл навички вивантажено.");
  });

  dialog.querySelector("[data-skill-upload]").addEventListener("click", () => fileEl.click());
  fileEl.addEventListener("change", async () => {
    const file = fileEl.files?.[0];
    if (!file) return;
    const text = await file.text();
    contentEl.value = text;
    cache[currentKey] = { ...(cache[currentKey] || {}), content: text };
    fileEl.value = "";
    showToast?.("Файл завантажено в редактор. Натисніть «Зберегти», щоб застосувати.");
  });

  // Файли-знання (Этап 2): upload a whole document into the area's knowledge base.
  dialog.querySelector("[data-knowledge-upload]").addEventListener("click", () => knowledgeFileEl.click());
  knowledgeFileEl.addEventListener("change", async () => {
    const file = knowledgeFileEl.files?.[0];
    if (!file) return;
    const key = currentKey;
    knowledgeFileEl.value = "";
    showToast?.("Обробка файлу…");
    try {
      await uploadAiKnowledgeToApi(key, file);
      showToast?.("Файл додано до бази знань.");
      loadKnowledge(key);
    } catch (error) {
      showToast?.(aiErrorMessage(error, "Не вдалося додати файл."), "danger");
    }
  });

  knowledgeListEl.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-knowledge-del]");
    if (!button) return;
    try {
      await deleteAiKnowledgeFromApi(button.dataset.knowledgeDel);
      showToast?.("Файл видалено.");
      loadKnowledge(currentKey);
    } catch (_error) {
      showToast?.("Не вдалося видалити файл.", "danger");
    }
  });

  getAiSkillsFromApi()
    .then((data) => {
      Object.entries(data?.results || {}).forEach(([key, skill]) => {
        cache[key] = { title: skill.title, content: skill.content, updatedAt: skill.updatedAt };
      });
      showArea(currentKey);
    })
    .catch(() => showArea(currentKey));

  showArea(currentKey);
  dialog.showModal();
}

export function renderAIScreen(ctx) {
  const { state, $, badge, icon, caseById, clientById, showToast, openTaskDialog, switchView, saveNavigationState, openOfficeEditor } = ctx;
  state.aiSearchQuery ||= "";
  state.aiCaseStatusFilter ||= "all";
  state.aiViewMode ||= "cards";
  state.aiSelectedLaw ||= "all";
  state.aiChats ||= {};        // per-case chat state: { messages, draft, pending }
  state.aiOpenChatIds ||= [];  // rows whose chat is expanded (several can be open at once)
  // renderAll() рендерить цей екран для всіх; ролі без canUseAi не смикають AI-endpoint-и (403).
  const canUseAi = !(state.sessionPermissions && state.sessionPermissions.canUseAi === false);
  // Lazy-load the opt-in connected-cases list once, then rerender with real data.
  if (shouldUseApi(state) && canUseAi && !state.aiConnectedLoaded) {
    state.aiConnectedLoaded = true;
    getAiAssistantsFromApi()
      .then((data) => { state.aiConnected = data?.results || []; renderAIScreen(ctx); })
      .catch(() => {});
  }
  const rows = assistantRows(state, clientById);
  const filteredRows = filterRows(state, rows);
  // Auto-open the first assistant's chat on first visit (once there is at least one).
  if (rows.length && !state.aiOpenChatIds.length && !state.aiAutoOpenedOnce) {
    state.aiAutoOpenedOnce = true;
    state.aiOpenChatIds = [rows[0].id];
  }
  // Ensure every open chat has an initialised conversation.
  state.aiOpenChatIds.forEach((rowId) => {
    const row = rows.find((item) => item.id === rowId);
    if (row && !state.aiChats[row.caseId]) {
      state.aiChats[row.caseId] = { messages: defaultMessages(caseById(row.caseId), row.helper.label), draft: "", pending: false };
    }
  });

  // Lazy-load real per-area stats (request counts, doc counts) from the backend
  // once. Replaces the old hardcoded demo numbers. Refetched after AI replies.
  if (shouldUseApi(state) && canUseAi && !state.aiSkillStatsLoaded) {
    state.aiSkillStatsLoaded = true;
    getAiSkillsFromApi()
      .then((data) => { state.aiSkillStats = data?.results || {}; renderAIScreen(ctx); })
      .catch(() => {});
  }
  const skillStats = state.aiSkillStats || {};
  const areaRequests = (key) => Number(skillStats[key]?.requestCount || 0);
  const areaDocs = (key) => Number(skillStats[key]?.docCount || 0);

  // Lazy-load token usage / spend estimate once (refetched after each reply).
  if (shouldUseApi(state) && canUseAi && !state.aiUsageLoaded) {
    state.aiUsageLoaded = true;
    getAiUsageFromApi()
      .then((data) => { state.aiUsage = data || null; renderAIScreen(ctx); })
      .catch(() => {});
  }

  $("#ai").innerHTML = `
    <div class="ai-screen ai-directory-screen">
      <div class="ai-layout">
        <div class="ai-main">
          ${usagePanelHtml(state.aiUsage, icon)}
          <section class="ai-section">
            <div class="section-head compact">
              <div>
                <h2>Помічники по галузях права</h2>
                <p class="muted">Універсальні AI консультанти по основних напрямах бюро</p>
              </div>
            </div>
            <div class="ai-law-grid">
              ${LAW_HELPERS.map((helper) => `
                <button class="panel ai-law-card ${state.aiSelectedLaw === helper.key ? "active" : ""}" type="button" data-ai-helper="${helper.key}" data-ai-helper-label="${helper.label}" aria-pressed="${state.aiSelectedLaw === helper.key}">
                  <span class="ai-law-icon ${helper.tone}">${icon(helper.icon)}</span>
                  <strong>${helper.label}</strong>
                  <em>${helper.description}</em>
                  <small>${icon("message")} ${rows.filter((row) => row.helper.key === helper.key).length} помічн. · ${areaRequests(helper.key).toLocaleString("uk-UA")} запитів · ${areaDocs(helper.key)} файлів</small>
                </button>
              `).join("")}
            </div>
          </section>

          <section class="ai-section">
            <div class="section-head compact">
              <div>
                <h2>AI помічники для справ</h2>
                <p class="muted">Оберіть справу зліва — і задайте питання помічнику в чаті по справі</p>
              </div>
              <div class="ai-section-actions">
                <button class="primary compact-button" type="button" data-ai-add-case>${icon("tag")} Додати справу</button>
                <button class="secondary compact-button" type="button" data-ai-quick="knowledge">${icon("telegram")} Управління знаннями</button>
                <div class="ai-view-toggle" aria-label="Перемикання вигляду">
                  <button class="${state.aiViewMode === "cards" ? "active" : ""}" type="button" data-ai-view-mode="cards" title="Дві в рядок">${icon("filter")}</button>
                  <button class="${state.aiViewMode === "list" ? "active" : ""}" type="button" data-ai-view-mode="list" title="В один стовпець">${icon("file")}</button>
                </div>
              </div>
            </div>
            <div class="ai-case-filters">
              <div class="search-field">
                ${icon("search")}
                <input data-ai-case-search type="search" placeholder="Пошук по справах..." value="${escapeHtml(state.aiSearchQuery)}">
              </div>
              <select data-ai-status-filter>
                <option value="all" ${state.aiCaseStatusFilter === "all" ? "selected" : ""}>Всі статуси</option>
                <option value="Активний" ${state.aiCaseStatusFilter === "Активний" ? "selected" : ""}>Активні</option>
                <option value="Неактивний" ${state.aiCaseStatusFilter === "Неактивний" ? "selected" : ""}>Неактивні</option>
              </select>
              <select data-ai-law-filter>
                <option value="all" ${state.aiSelectedLaw === "all" ? "selected" : ""}>Всі галузі права</option>
                ${LAW_HELPERS.map((helper) => `
                  <option value="${helper.key}" ${state.aiSelectedLaw === helper.key ? "selected" : ""}>${escapeHtml(helper.label)}</option>
                `).join("")}
              </select>
            </div>
            ${rows.length === 0 ? `
              <div class="ai-empty-list panel">
                <strong>Ще немає підключених справ</strong>
                <p class="muted">Оберіть, які справи підключити до AI помічника — не всі справи, а лише потрібні. Натисніть «Додати справу».</p>
                <button class="primary" type="button" data-ai-add-case>${icon("tag")} Додати справу</button>
              </div>
            ` : filteredRows.length === 0 ? `
              <div class="ai-empty-list panel">
                <p class="muted">За фільтром нічого не знайдено.</p>
              </div>
            ` : ""}
            <div class="ai-case-list ${state.aiViewMode === "list" ? "list-view" : "cards-view"}">
              ${filteredRows.map((row) => {
                const meta = statusMeta(row.status);
                const isOpen = state.aiOpenChatIds.includes(row.id);
                const rowCase = caseById(row.caseId);
                const chat = state.aiChats[row.caseId] || { messages: [], draft: "" };
                return `
                <div class="ai-case-block ${isOpen ? "open" : ""}">
                  <article class="ai-case-row ${isOpen ? "selected" : ""} ${row.active ? "" : "inactive"}" data-ai-assistant-row="${row.id}">
                    <span class="ai-case-icon ${row.helper.tone}">${icon(row.icon)}</span>
                    <div class="ai-case-main">
                      <strong>${escapeHtml(row.title)}</strong>
                      <span>${escapeHtml(row.subtitle)}</span>
                      <small>${icon("calendar")} ${escapeHtml(row.created)}</small>
                    </div>
                    <p>${escapeHtml(row.description)}</p>
                    <div class="ai-row-actions">
                      <button type="button" class="ai-status-pill ${meta.tone}" data-ai-status-toggle="${escapeHtml(row.caseId)}" data-ai-status-active="${row.active ? "1" : "0"}" title="Натисніть, щоб ${row.active ? "призупинити" : "активувати"} помічника">${icon(meta.icon)} ${meta.label}</button>
                      <span class="ai-chat-caret ${isOpen ? "open" : ""}" aria-hidden="true">▾</span>
                      <button class="icon-button" type="button" data-ai-row-menu="${row.id}" aria-label="Дії помічника">⋮</button>
                      ${state.aiOpenMenuId === row.id ? `
                        <div class="ai-row-menu">
                          <button type="button" data-ai-row-action="export" data-ai-row-id="${row.id}">${icon("briefcase")} Експорт висновку</button>
                          <button type="button" data-ai-row-action="disconnect" data-ai-row-id="${row.id}" data-ai-row-case="${escapeHtml(row.caseId)}">${icon("trash")} Відключити від AI</button>
                        </div>
                      ` : ""}
                    </div>
                  </article>
                  ${isOpen ? inlineChatPanel(row, rowCase, row.helper, chat.messages || [], icon, chat.draft || "", questionsForArea(state, row.helper.key), chat.attachment || null) : ""}
                </div>
              `; }).join("")}
            </div>
          </section>

          <section class="panel ai-hints-card">
            <h2>Як користуватися AI помічником</h2>
            <div class="ai-hints-grid">
              <div class="ai-hint">
                <span class="ai-hint-icon blue">${icon("tag")}</span>
                <strong>1. Підключіть справу</strong>
                <small>Натисніть «Додати справу» і оберіть потрібні справи — не всі одразу, а лише ті, з якими працюєте.</small>
              </div>
              <div class="ai-hint">
                <span class="ai-hint-icon violet">${icon("message")}</span>
                <strong>2. Задайте питання</strong>
                <small>Оберіть справу і напишіть питання в «Чат по справі». Помічник відповідає на основі даних справи.</small>
              </div>
              <div class="ai-hint">
                <span class="ai-hint-icon green">${icon("file")}</span>
                <strong>3. Наповніть базу знань</strong>
                <small>У «Управлінні знаннями» додайте експертизу бюро та шаблони — відповіді стануть точнішими.</small>
              </div>
              <div class="ai-hint">
                <span class="ai-hint-icon amber">${icon("briefcase")}</span>
                <strong>4. Збережіть висновок</strong>
                <small>Через меню помічника (⋮) експортуйте діалог у файл .txt, .md або .docx.</small>
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  `;

  const rerender = () => {
    renderAIScreen(ctx);
    saveNavigationState?.();
  };
  setupScreenCustomSelects($("#ai"), ".ai-case-filters select");
  // Send a question in a SPECIFIC case's chat (several chats can be open at once).
  const sendPrompt = async (caseId, promptText) => {
    const caseItem = caseById(caseId);
    if (!caseItem) return;
    const helper = lawForCase(caseItem);
    const chat = state.aiChats[caseId] || (state.aiChats[caseId] = { messages: defaultMessages(caseItem, helper.label), draft: "", pending: false });
    const prompt = String(promptText || chat.draft || "").trim();
    const attachment = chat.attachment || null;
    if (!prompt && !attachment) { showToast("Напишіть запит або додайте файл для AI помічника.", "warning"); return; }
    if (chat.pending) return;

    const history = chat.messages
      .filter((message) => !message.seeded && !message.pending)
      .map((message) => ({ role: message.role, text: message.text }));

    chat.messages.push({ role: "user", text: prompt, attachmentName: attachment?.name || "" });
    chat.draft = "";
    chat.attachment = null; // attachment travels with this turn only
    if (!state.aiOpenChatIds.includes(`case-${caseId}`)) state.aiOpenChatIds.push(`case-${caseId}`);

    if (!shouldUseApi(state)) {
      chat.messages.push({ role: "assistant", text: assistantReply(prompt, helper.label, caseItem) });
      rerender();
      return;
    }

    chat.pending = true;
    chat.messages.push({ role: "assistant", text: "…", pending: true });
    rerender();

    let reply;
    try {
      // Stream the reply live (token-by-token); on any streaming problem, fall back to the
      // plain non-streaming endpoint so a buffering proxy or old browser still works.
      const streamed = await streamAiChat({
        caseNumber: caseId, message: prompt, helper: helper.label, helperKey: helper.key, history,
        file: attachment?.file, attachmentDocumentId: attachment?.documentId,
        onChunk: (acc) => updateStreamingBubble(caseId, acc),
      });
      reply = { role: "assistant", text: streamed || "AI не повернув відповіді." };
    } catch (_streamError) {
      try {
        let data;
        if (attachment?.file) {
          data = await askAiWithAttachmentInApi({ caseNumber: caseId, message: prompt, helper: helper.label, helperKey: helper.key, history, file: attachment.file });
        } else if (attachment?.documentId) {
          data = await askAiInApi({ caseNumber: caseId, message: prompt, helper: helper.label, helperKey: helper.key, history, attachmentDocumentId: attachment.documentId });
        } else {
          data = await askAiInApi({ caseNumber: caseId, message: prompt, helper: helper.label, helperKey: helper.key, history });
        }
        reply = { role: "assistant", text: data?.reply || "AI не повернув відповіді." };
      } catch (error) {
        reply = { role: "assistant", error: true, text: aiErrorMessage(error, "AI-сервіс недоступний. Перевірте ключ Anthropic у Налаштування → AI.") };
      }
    } finally {
      chat.pending = false;
    }
    const pendingIndex = chat.messages.findIndex((message) => message.pending);
    if (pendingIndex >= 0) chat.messages[pendingIndex] = reply; else chat.messages.push(reply);
    state.aiSkillStatsLoaded = false;
    state.aiUsageLoaded = false; // refresh the spend/tokens panel
    rerender();
  };

  document.querySelectorAll("[data-ai-helper]").forEach((button) => button.addEventListener("click", () => {
    const nextLaw = button.dataset.aiHelper;
    state.aiSelectedLaw = state.aiSelectedLaw === nextLaw ? "all" : nextLaw;
    state.aiOpenMenuId = "";
    rerender();
  }));
  document.querySelectorAll("[data-ai-search], [data-ai-case-search]").forEach((input) => input.addEventListener("input", (event) => {
    state.aiSearchQuery = event.currentTarget.value;
    rerender();
  }));
  document.querySelector("[data-ai-status-filter]")?.addEventListener("change", (event) => {
    state.aiCaseStatusFilter = event.currentTarget.value;
    rerender();
  });
  document.querySelector("[data-ai-law-filter]")?.addEventListener("change", (event) => {
    state.aiSelectedLaw = event.currentTarget.value;
    rerender();
  });
  document.querySelectorAll("[data-ai-view-mode]").forEach((button) => button.addEventListener("click", () => {
    state.aiViewMode = button.dataset.aiViewMode;
    rerender();
  }));
  // Click a card → toggle its own chat open/closed (several may be open together).
  document.querySelectorAll("[data-ai-assistant-row]").forEach((element) => element.addEventListener("click", (event) => {
    if (event.target.closest("[data-ai-row-menu], [data-ai-row-action], [data-ai-close-chat], [data-ai-status-toggle], .ai-card-chat-panel")) return;
    const id = element.dataset.aiAssistantRow;
    const row = rows.find((item) => item.id === id);
    if (!row) return;
    const open = new Set(state.aiOpenChatIds);
    if (open.has(id)) {
      open.delete(id);
    } else {
      open.add(id);
      if (!state.aiChats[row.caseId]) {
        state.aiChats[row.caseId] = { messages: defaultMessages(caseById(row.caseId), row.helper.label), draft: "", pending: false };
      }
    }
    state.aiOpenChatIds = [...open];
    state.aiOpenMenuId = "";
    rerender();
  }));
  document.querySelectorAll("[data-ai-close-chat]").forEach((button) => button.addEventListener("click", (event) => {
    event.stopPropagation();
    state.aiOpenChatIds = state.aiOpenChatIds.filter((rowId) => rowId !== button.dataset.aiCloseChat);
    rerender();
  }));
  // Toggle active/inactive (the status pill).
  document.querySelectorAll("[data-ai-status-toggle]").forEach((button) => button.addEventListener("click", async (event) => {
    event.stopPropagation();
    const caseNumber = button.dataset.aiStatusToggle;
    const nextActive = button.dataset.aiStatusActive !== "1";
    try {
      await setAiAssistantActiveInApi(caseNumber, nextActive);
      state.aiConnected = (state.aiConnected || []).map((item) => item.caseNumber === caseNumber ? { ...item, active: nextActive } : item);
      showToast(nextActive ? "Помічника активовано." : "Помічника призупинено.");
    } catch (_error) {
      showToast("Не вдалося змінити статус.", "danger");
    }
    rerender();
  }));
  // Per-chat input: keep each case's draft separate; multiline with auto-height.
  document.querySelectorAll("[data-ai-prompt]").forEach((input) => {
    autoGrowTextarea(input); // size to current content on render
    input.addEventListener("input", (event) => {
      const caseId = event.currentTarget.dataset.aiChatCase;
      if (state.aiChats[caseId]) state.aiChats[caseId].draft = event.currentTarget.value;
      autoGrowTextarea(event.currentTarget);
    });
    input.addEventListener("keydown", (event) => {
      // Enter sends; Shift+Enter inserts a new line.
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendPrompt(event.currentTarget.dataset.aiChatCase);
      }
    });
  });
  document.querySelectorAll("[data-ai-voice]").forEach((button) => button.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleVoiceInput(button, state, showToast);
  }));
  // Attach button opens a small menu: file from computer OR a document from Документообіг.
  document.querySelectorAll("[data-ai-attach]").forEach((button) => button.addEventListener("click", (event) => {
    event.stopPropagation();
    const menu = button.parentElement.querySelector("[data-ai-attach-menu]");
    if (menu) menu.hidden = !menu.hidden;
  }));
  document.querySelectorAll("[data-ai-attach-computer]").forEach((button) => button.addEventListener("click", (event) => {
    event.stopPropagation();
    button.closest("[data-ai-attach-menu]").hidden = true;
    button.closest(".ai-input-row")?.querySelector("[data-ai-attach-input]")?.click();
  }));
  document.querySelectorAll("[data-ai-attach-docs]").forEach((button) => button.addEventListener("click", (event) => {
    event.stopPropagation();
    button.closest("[data-ai-attach-menu]").hidden = true;
    const caseId = button.dataset.aiChatCase;
    const caseItem = caseById(caseId);
    openDocLibraryModal((picked) => {
      const chat = state.aiChats[caseId] || (state.aiChats[caseId] = { messages: defaultMessages(caseItem, lawForCase(caseItem).label), draft: "", pending: false });
      const typed = document.querySelector(`[data-ai-prompt][data-ai-chat-case="${CSS.escape(caseId)}"]`);
      if (typed) chat.draft = typed.value;
      chat.attachment = { documentId: picked.id, name: picked.name };
      rerender();
    });
  }));
  // Close any open attach menu when clicking elsewhere (attached once, survives rerenders).
  if (!window.__aiAttachMenuGlobal) {
    window.__aiAttachMenuGlobal = true;
    document.addEventListener("click", (event) => {
      if (!event.target.closest(".ai-attach-wrap")) {
        document.querySelectorAll("[data-ai-attach-menu]").forEach((menu) => { menu.hidden = true; });
      }
    });
  }
  document.querySelectorAll("[data-ai-attach-input]").forEach((input) => input.addEventListener("change", (event) => {
    const caseId = event.currentTarget.dataset.aiChatCase;
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    if (!/\.(png|jpe?g|gif|webp|pdf|docx|txt|md)$/i.test(file.name)) {
      showToast("Дозволені: зображення (png/jpg), pdf, docx, txt.", "warning");
      return;
    }
    if (file.size > 12 * 1024 * 1024) { showToast("Файл завеликий (макс. 12 МБ).", "warning"); return; }
    const chat = state.aiChats[caseId] || (state.aiChats[caseId] = { messages: defaultMessages(caseById(caseId), lawForCase(caseById(caseId)).label), draft: "", pending: false });
    // Preserve whatever the user has already typed before we re-render.
    const typed = document.querySelector(`[data-ai-prompt][data-ai-chat-case="${CSS.escape(caseId)}"]`);
    if (typed) chat.draft = typed.value;
    chat.attachment = { file, name: file.name };
    rerender();
  }));
  document.querySelectorAll("[data-ai-attach-remove]").forEach((button) => button.addEventListener("click", (event) => {
    event.stopPropagation();
    const caseId = button.dataset.aiChatCase;
    if (state.aiChats[caseId]) state.aiChats[caseId].attachment = null;
    rerender();
  }));
  const draftTextAt = (button, caseAttr, idxAttr) => {
    const caseId = button.dataset[caseAttr];
    const msg = state.aiChats[caseId]?.messages?.[Number(button.dataset[idxAttr])];
    return { caseId, text: (msg?.text || "").trim() };
  };
  // 📋 Copy the reply text (markdown stripped) to the clipboard.
  document.querySelectorAll("[data-ai-copy-index]").forEach((button) => button.addEventListener("click", async (event) => {
    event.stopPropagation();
    const { text } = draftTextAt(button, "aiCopyCase", "aiCopyIndex");
    if (!text) return;
    const clean = cleanForCopy(text);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(clean);
      } else {
        const ta = document.createElement("textarea");
        ta.value = clean; ta.style.position = "fixed"; ta.style.opacity = "0";
        document.body.append(ta); ta.select(); document.execCommand("copy"); ta.remove();
      }
      const original = button.innerHTML;
      button.textContent = "✓ Скопійовано";
      setTimeout(() => { button.innerHTML = original; }, 1400);
    } catch (_error) {
      showToast("Не вдалося скопіювати.", "warning");
    }
  }));
  // 👁 Preview opens the document workspace: edit in ONLYOFFICE, save (with destination), templates.
  document.querySelectorAll("[data-ai-preview-index]").forEach((button) => button.addEventListener("click", (event) => {
    event.stopPropagation();
    const { caseId, text } = draftTextAt(button, "aiPreviewCase", "aiPreviewIndex");
    if (!text) return;
    if (!shouldUseApi(state)) { showToast("Дії з документом доступні через сервер (Django).", "warning"); return; }
    openDraftPreviewModal({
      text, caseId, showToast,
      openOfficeEditor: (typeof openOfficeEditor === "function" ? openOfficeEditor : null),
      cases: state.cases || [],
      onSavedToCase: (created) => {
        const target = caseById(created?.caseId || caseId);
        if (target && created) { target.documents = target.documents || []; target.documents.unshift(normalizeDocument(created)); }
      },
    });
  }));
  document.querySelectorAll("[data-ai-send]").forEach((button) => button.addEventListener("click", () => sendPrompt(button.dataset.aiChatCase)));
  // After each render, position the latest exchange so it reads from the TOP: put the last
  // user question just under the top edge, with the reply flowing below (like a real chat).
  // Falls back to the bottom when there's no user message yet (only the greeting).
  document.querySelectorAll(".ai-card-chat-panel .ai-chat").forEach((el) => {
    const users = el.querySelectorAll(".bubble.user");
    const lastUser = users[users.length - 1];
    if (lastUser) {
      el.scrollTop += lastUser.getBoundingClientRect().top - el.getBoundingClientRect().top - 12;
    } else {
      el.scrollTop = el.scrollHeight;
    }
  });
  document.querySelectorAll("[data-ai-question]").forEach((button) => button.addEventListener("click", () => sendPrompt(button.dataset.aiChatCase, button.dataset.aiQuestion)));
  document.querySelectorAll("[data-ai-manage-questions]").forEach((button) => button.addEventListener("click", (event) => {
    event.stopPropagation();
    const areaKey = button.dataset.aiManageQuestions;
    const areaLabel = LAW_HELPERS.find((helper) => helper.key === areaKey)?.label || "Галузь";
    openQuestionsManager({ state, areaKey, areaLabel, showToast, rerender });
  }));
  document.querySelectorAll("[data-ai-row-menu]").forEach((button) => button.addEventListener("click", (event) => {
    event.stopPropagation();
    state.aiOpenMenuId = state.aiOpenMenuId === button.dataset.aiRowMenu ? "" : button.dataset.aiRowMenu;
    rerender();
  }));
  document.querySelectorAll("[data-ai-row-action]").forEach((button) => button.addEventListener("click", async (event) => {
    event.stopPropagation();
    const id = button.dataset.aiRowId;
    const row = rows.find((item) => item.id === id);
    if (button.dataset.aiRowAction === "disconnect") {
      const caseNumber = button.dataset.aiRowCase;
      try {
        await disconnectAiAssistantFromApi(caseNumber);
        state.aiConnected = (state.aiConnected || []).filter((item) => item.caseNumber !== caseNumber);
        state.aiOpenChatIds = state.aiOpenChatIds.filter((rowId) => rowId !== `case-${caseNumber}`);
        delete state.aiChats[caseNumber];
        state.aiSkillStatsLoaded = false;
        showToast("Справу відключено від AI.");
      } catch (_error) {
        showToast("Не вдалося відключити справу.", "danger");
      }
    } else if (button.dataset.aiRowAction === "export") {
      const exportCase = caseById(row?.caseId);
      const chat = state.aiChats[row?.caseId] || { messages: [] };
      openExportPicker(exportCase, row?.helper || lawForCase(exportCase || {}), chat.messages, showToast);
    }
    state.aiOpenMenuId = "";
    rerender();
  }));
  document.querySelectorAll("[data-ai-add-case]").forEach((button) => button.addEventListener("click", () => {
    openCasePicker({ state, clientById, showToast, rerender });
  }));
  document.querySelectorAll("[data-ai-quick]").forEach((button) => button.addEventListener("click", () => {
    if (button.dataset.aiQuick === "knowledge") openSkillsManager({ state, showToast });
  }));
}
