import { setupScreenCustomSelects } from "../custom-selects.js";
import {
  askAiInApi,
  connectAiAssistantToApi,
  deleteAiKnowledgeFromApi,
  deleteAiSkillFromApi,
  disconnectAiAssistantFromApi,
  exportAiConclusionDocx,
  getAiAssistantsFromApi,
  getAiKnowledgeFromApi,
  getAiSkillsFromApi,
  getAiUsageFromApi,
  saveAiQuestionsToApi,
  saveAiSkillToApi,
  setAiAssistantActiveInApi,
  shouldUseApi,
  uploadAiKnowledgeToApi
} from "../api.js";

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
  const remaining = hasBudget ? `$${Number(usage.remainingUsd || 0).toFixed(2)}` : "—";
  const remainLabel = hasBudget ? `Залишок з $${Number(usage.budgetUsd).toFixed(2)}` : "Бюджет не задано";
  const requestsLeft = usage.estimatedRequestsLeft != null ? `≈ ${usage.estimatedRequestsLeft}` : "—";
  return `
    <section class="ai-usage-strip" aria-label="Використання AI">
      <div class="ai-usage-tile">
        <i class="blue">${icon("wallet")}</i>
        <strong>$${cost}</strong>
        <span>Витрачено</span>
      </div>
      <div class="ai-usage-tile">
        <i class="green">${icon("dollar")}</i>
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
    <p class="ai-usage-note muted">${usage.requestCount || 0} запитів усього · орієнтовна оцінка — точний баланс кредитів у console.anthropic.com</p>
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

function renderMessage(message) {
  return `<div class="bubble ${message.role === "user" ? "user" : ""}">${escapeHtml(message.text)}</div>`;
}

function inlineChatPanel(row, caseItem, helper, messages, icon, draft = "", questions = []) {
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
      <div class="ai-chat">
        ${messages.map(renderMessage).join("")}
      </div>
      <div class="ai-chat-composer">
        <div class="ai-question-list">
          ${questions.map((question) => `<button type="button" data-ai-question="${escapeHtml(question)}" data-ai-chat-case="${escapeHtml(caseItem.id)}">${escapeHtml(question)}</button>`).join("")}
          <button type="button" class="ai-question-manage" data-ai-manage-questions="${escapeHtml(helper.key)}" title="Редагувати швидкі питання">${icon("edit")} Питання</button>
        </div>
        <div class="ai-input-row">
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
  const { state, $, badge, icon, caseById, clientById, showToast, openTaskDialog, switchView, saveNavigationState } = ctx;
  state.aiSearchQuery ||= "";
  state.aiCaseStatusFilter ||= "all";
  state.aiViewMode ||= "cards";
  state.aiSelectedLaw ||= "all";
  state.aiChats ||= {};        // per-case chat state: { messages, draft, pending }
  state.aiOpenChatIds ||= [];  // rows whose chat is expanded (several can be open at once)
  // Lazy-load the opt-in connected-cases list once, then rerender with real data.
  if (shouldUseApi(state) && !state.aiConnectedLoaded) {
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
  if (shouldUseApi(state) && !state.aiSkillStatsLoaded) {
    state.aiSkillStatsLoaded = true;
    getAiSkillsFromApi()
      .then((data) => { state.aiSkillStats = data?.results || {}; renderAIScreen(ctx); })
      .catch(() => {});
  }
  const skillStats = state.aiSkillStats || {};
  const areaRequests = (key) => Number(skillStats[key]?.requestCount || 0);
  const areaDocs = (key) => Number(skillStats[key]?.docCount || 0);

  // Lazy-load token usage / spend estimate once (refetched after each reply).
  if (shouldUseApi(state) && !state.aiUsageLoaded) {
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
                  ${isOpen ? inlineChatPanel(row, rowCase, row.helper, chat.messages || [], icon, chat.draft || "", questionsForArea(state, row.helper.key)) : ""}
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
    if (!prompt) { showToast("Напишіть запит для AI помічника.", "warning"); return; }
    if (chat.pending) return;

    const history = chat.messages
      .filter((message) => !message.seeded && !message.pending)
      .map((message) => ({ role: message.role, text: message.text }));

    chat.messages.push({ role: "user", text: prompt });
    chat.draft = "";
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
      const data = await askAiInApi({ caseNumber: caseId, message: prompt, helper: helper.label, helperKey: helper.key, history });
      reply = { role: "assistant", text: data?.reply || "AI не повернув відповіді." };
    } catch (error) {
      reply = { role: "assistant", text: aiErrorMessage(error, "AI-сервіс недоступний. Перевірте ключ Anthropic у налаштуваннях сервера.") };
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
  document.querySelectorAll("[data-ai-send]").forEach((button) => button.addEventListener("click", () => sendPrompt(button.dataset.aiChatCase)));
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
