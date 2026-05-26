import { setupScreenCustomSelects } from "../custom-selects.js";

const LAW_HELPERS = [
  {
    key: "family",
    label: "Сімейне право",
    icon: "user",
    tone: "blue",
    description: "Консультації щодо шлюбу, аліментів, опіки та майна",
    requests: 1245
  },
  {
    key: "criminal",
    label: "Кримінальне право",
    icon: "tag",
    tone: "violet",
    description: "Захист, процесуальні строки, кваліфікація та докази",
    requests: 1876
  },
  {
    key: "military",
    label: "Військове право",
    icon: "briefcase",
    tone: "green",
    description: "Мобілізація, військова служба, ТЦК та оскарження рішень",
    requests: 1532
  },
  {
    key: "civil",
    label: "Цивільне право",
    icon: "building",
    tone: "amber",
    description: "Договори, зобов'язання, майнові та спадкові спори",
    requests: 2342
  },
  {
    key: "administrative",
    label: "Адміністративне право",
    icon: "file",
    tone: "blue",
    description: "Скарги на органи влади, штрафи, адмінпроцедури",
    requests: 1123
  }
];

const QUICK_QUESTIONS = [
  "Які підстави для розірвання шлюбу?",
  "Як оскаржити рішення ТЦК?",
  "Строки подачі апеляції в суд",
  "Яка відповідальність за ст. 121 КК?"
];

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
  const caseRows = state.cases.map((caseItem, index) => {
    const helper = lawForCase(caseItem);
    const client = clientById(caseItem.clientId);
    return {
      id: `case-${caseItem.id}`,
      caseId: caseItem.id,
      title: `${client?.name?.split(" ")[0] || "Клієнт"}, ${caseItem.title.toLowerCase()}`,
      subtitle: `Справа №${caseItem.id} · ${helper.label}`,
      created: caseItem.opened || fallbackCreatedDate(),
      description: `Помічник навчений на матеріалах справи: ${caseItem.stage?.toLowerCase() || "аналіз матеріалів"}, документи, задачі та історія.`,
      status: index === 3 ? "На навчанні" : "Активний",
      helper,
      icon: helper.icon
    };
  });

  const customRows = (state.aiCustomAssistants || []).map((item) => {
    const caseItem = state.cases.find((source) => source.id === item.caseId) || state.cases[0];
    const helper = lawForCase(caseItem);
    return {
      id: item.id,
      caseId: item.caseId,
      title: item.title,
      subtitle: `Справа №${item.caseId} · ${helper.label}`,
      created: item.created,
      description: item.description,
      status: item.status,
      helper,
      icon: helper.icon
    };
  });

  const hidden = new Set(state.aiHiddenAssistantIds || []);
  return [...customRows, ...caseRows].filter((row) => !hidden.has(row.id));
}

function defaultMessages(caseItem, helperLabel = "AI консультант") {
  return [
    {
      role: "assistant",
      text: `Я відкрив справу №${caseItem?.id || fallbackDemoCaseId()} і бачу фокус: ${caseItem?.stage || "підготовка позиції"}. Можу підготувати план, перевірити ризики або сформувати список доказів.`
    },
    {
      role: "user",
      text: "Сформуй короткий план дій."
    },
    {
      role: "assistant",
      text: `План від ${helperLabel}: перевірити строки, зібрати документи, уточнити факти, підготувати процесуальну дію і додати контрольну задачу в планер.`
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
  return status === "На навчанні" ? "amber" : "green";
}

function statusMeta(status) {
  if (status === "На навчанні") return { icon: "clock", tone: "amber", label: "На навчанні" };
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
    const matchesResponsible = state.aiCaseResponsibleFilter === "all" || caseItem?.responsible === state.aiCaseResponsibleFilter;
    return matchesQuery && matchesLaw && matchesStatus && matchesResponsible;
  });
}

function renderMessage(message) {
  return `<div class="bubble ${message.role === "user" ? "user" : ""}">${escapeHtml(message.text)}</div>`;
}

function inlineChatPanel(row, caseItem, helper, messages, icon) {
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
    </section>
  `;
}

export function renderAIScreen(ctx) {
  const { state, $, badge, icon, caseById, clientById, showToast, openTaskDialog, switchView, saveNavigationState } = ctx;
  state.aiSearchQuery ||= "";
  state.aiCaseStatusFilter ||= "all";
  state.aiCaseResponsibleFilter ||= "all";
  state.aiCustomAssistants ||= [];
  state.aiHiddenAssistantIds ||= [];
  state.aiViewMode ||= "cards";
  state.aiSelectedLaw ||= "all";
  const rows = assistantRows(state, clientById);
  const filteredRows = filterRows(state, rows);
  const selected = selectedAssistant(state, rows);
  const selectedCase = caseById(selected?.caseId || state.aiSelectedCaseId) || state.cases[0];
  if (!selectedCase) {
    $("#ai").innerHTML = `
      <div class="empty-state panel">
        <h2>${icon("bot")} AI помічники</h2>
        <p class="muted">Додайте клієнта та справу, щоб створити AI помічника на матеріалах справи.</p>
        <button class="primary" type="button" data-view-link="cases">Перейти до справ</button>
      </div>
    `;
    return;
  }
  const selectedHelper = selected?.helper || lawForCase(selectedCase);
  state.aiSelectedAssistantId ||= selected?.id;
  if (!state.aiMessages.length || state.aiSelectedCaseId !== selectedCase.id) {
    state.aiSelectedCaseId = selectedCase.id;
    state.aiSelectedHelper = selectedHelper.label;
    state.aiMessages = defaultMessages(selectedCase, selectedHelper.label);
  }

  const activeCount = rows.filter((row) => row.status === "Активний").length;
  const trainingCount = rows.filter((row) => row.status === "На навчанні").length;
  const requestCount = LAW_HELPERS.reduce((sum, helper) => sum + helper.requests, 0) + rows.length * 486;
  const filteredCount = filteredRows.length;

  $("#ai").innerHTML = `
    <div class="ai-screen ai-directory-screen">
      <div class="ai-page-tools">
        <div class="search-field">
          ${icon("search")}
          <input data-ai-search type="search" placeholder="Пошук помічників..." value="${escapeHtml(state.aiSearchQuery)}">
        </div>
        <button class="primary" type="button" data-ai-create-global>${icon("user")} Створити AI помічника</button>
      </div>

      <section class="ai-summary-strip" aria-label="Стани AI помічників">
        <button class="${state.aiCaseStatusFilter === "all" ? "active" : ""}" type="button" data-ai-summary-filter="all">
          <i class="blue">${icon("message")}</i>
          <strong>${rows.length}</strong>
          <span>Всього</span>
        </button>
        <button class="${state.aiCaseStatusFilter === "Активний" ? "active" : ""}" type="button" data-ai-summary-filter="Активний">
          <i class="green">${icon("check")}</i>
          <strong>${activeCount}</strong>
          <span>Активні</span>
        </button>
        <button class="${state.aiCaseStatusFilter === "На навчанні" ? "active" : ""}" type="button" data-ai-summary-filter="На навчанні">
          <i class="amber">${icon("clock")}</i>
          <strong>${trainingCount}</strong>
          <span>Навчання</span>
        </button>
        <button type="button" data-ai-summary-filter="visible">
          <i class="violet">${icon("search")}</i>
          <strong>${filteredCount}</strong>
          <span>У вибірці</span>
        </button>
      </section>

      <div class="ai-layout">
        <div class="ai-main">
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
                  <small>${icon("message")} ${rows.filter((row) => row.helper.key === helper.key).length} помічн. · ${helper.requests.toLocaleString("uk-UA")} запитів</small>
                </button>
              `).join("")}
            </div>
          </section>

          <section class="ai-section">
            <div class="section-head compact">
              <div>
                <h2>AI помічники для справ</h2>
                <p class="muted">Персоналізовані помічники, навчені під конкретні справи</p>
              </div>
              <div class="ai-view-toggle" aria-label="Перемикання вигляду">
                <button class="${state.aiViewMode === "cards" ? "active" : ""}" type="button" data-ai-view-mode="cards" title="Картки">${icon("filter")}</button>
                <button class="${state.aiViewMode === "list" ? "active" : ""}" type="button" data-ai-view-mode="list" title="Список">${icon("file")}</button>
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
                <option value="На навчанні" ${state.aiCaseStatusFilter === "На навчанні" ? "selected" : ""}>На навчанні</option>
              </select>
              <select data-ai-responsible-filter>
                <option value="all" ${state.aiCaseResponsibleFilter === "all" ? "selected" : ""}>Всі відповідальні</option>
                ${[...new Set(state.cases.map((item) => item.responsible).filter(Boolean))].map((name) => `
                  <option value="${escapeHtml(name)}" ${state.aiCaseResponsibleFilter === name ? "selected" : ""}>${escapeHtml(name)}</option>
                `).join("")}
              </select>
            </div>
            <div class="ai-case-list ${state.aiViewMode === "list" ? "list-mode" : "card-mode"}">
              ${filteredRows.map((row) => {
                const meta = statusMeta(row.status);
                const isOpen = state.aiChatOpenId === row.id;
                const rowCase = caseById(row.caseId) || selectedCase;
                return `
                <article class="ai-case-row ${selected?.id === row.id ? "selected" : ""}" data-ai-assistant-row="${row.id}">
                  <span class="ai-case-icon ${row.helper.tone}">${icon(row.icon)}</span>
                  <div class="ai-case-main">
                    <strong>${escapeHtml(row.title)}</strong>
                    <span>${escapeHtml(row.subtitle)}</span>
                    <small>${icon("calendar")} ${escapeHtml(row.created)}</small>
                  </div>
                  <p>${escapeHtml(row.description)}</p>
                  <div class="ai-row-actions">
                    <span class="ai-status-pill ${meta.tone}">${icon(meta.icon)} ${meta.label}</span>
                    <button class="icon-button" type="button" data-ai-row-menu="${row.id}" aria-label="Дії помічника">⋮</button>
                    ${state.aiOpenMenuId === row.id ? `
                      <div class="ai-row-menu">
                        <button type="button" data-ai-row-action="train" data-ai-row-id="${row.id}">${icon("file")} Навчити на матеріалах</button>
                        <button type="button" data-ai-row-action="export" data-ai-row-id="${row.id}">${icon("briefcase")} Експорт висновку</button>
                        <button type="button" data-ai-row-action="delete" data-ai-row-id="${row.id}">${icon("trash")} Видалити</button>
                      </div>
                    ` : ""}
                  </div>
                </article>
                ${isOpen ? inlineChatPanel(row, rowCase, row.helper, state.aiMessages, icon) : ""}
              `; }).join("")}
              <article class="ai-case-row ai-create-row">
                <span class="ai-case-icon neutral">+</span>
                <div>
                  <strong>Створити AI помічника для нової справи</strong>
                  <span>Навчіть помічника на матеріалах справи і отримуйте точні консультації</span>
                </div>
                <button class="secondary compact-button" type="button" data-ai-create-case>Створити</button>
              </article>
            </div>
          </section>

          <section class="panel ai-how-card">
            <h2>Як працюють AI помічники?</h2>
            <div>
              <span>${icon("tag")}</span><strong>1. Створіть помічника</strong><small>Оберіть галузь або конкретну справу</small>
            </div>
            <div>
              <span>${icon("file")}</span><strong>2. Завантажте матеріали</strong><small>Документи, задачі, закони та практику</small>
            </div>
            <div>
              <span>${icon("user")}</span><strong>3. AI навчається</strong><small>Система аналізує матеріали і контекст</small>
            </div>
            <div>
              <span>${icon("message")}</span><strong>4. Отримуйте відповіді</strong><small>Запитуйте по справі і контролюйте дії</small>
            </div>
          </section>
        </div>

        <aside class="ai-right-stack">
          <section class="panel ai-consultant-card">
            <h2>AI консультант</h2>
            <p class="muted">Ваш універсальний помічник</p>
            <div class="ai-bot-mark">${icon("message")}</div>
            <p>Задайте питання по будь-якому правовому питанню</p>
            <div class="ai-input-row">
              <input data-ai-prompt placeholder="Напишіть ваше питання..." value="${escapeHtml(state.aiDraftPrompt || "")}">
              <button class="primary icon-button" type="button" data-ai-send aria-label="Надіслати">${icon("telegram")}</button>
            </div>
            <div class="ai-question-list">
              <span>Спробуйте спитати:</span>
              ${QUICK_QUESTIONS.map((question) => `<button type="button" data-ai-question="${escapeHtml(question)}">${escapeHtml(question)} <b>›</b></button>`).join("")}
            </div>
          </section>

          <section class="panel ai-stats-card">
            <h2>Мої AI помічники</h2>
            <div><span>Всього помічників</span><strong>${rows.length}</strong></div>
            <div><span>Активних</span><strong>${activeCount}</strong></div>
            <div><span>На навчанні</span><strong>${trainingCount}</strong></div>
            <div><span>Всього запитів</span><strong>${requestCount.toLocaleString("uk-UA")}</strong></div>
          </section>

          <section class="panel ai-actions-card">
            <h2>Швидкі дії</h2>
            <button class="list-item action-list-button" type="button" data-ai-quick="case">${icon("tag")} Створити помічника для справи</button>
            <button class="list-item action-list-button" type="button" data-ai-quick="branch">${icon("briefcase")} Створити помічника по галузі</button>
            <button class="list-item action-list-button" type="button" data-ai-quick="knowledge">${icon("telegram")} Управління знаннями</button>
          </section>
        </aside>
      </div>
    </div>
  `;

  const rerender = () => {
    renderAIScreen(ctx);
    saveNavigationState?.();
  };
  setupScreenCustomSelects($("#ai"), ".ai-case-filters select");
  const sendPrompt = (promptText) => {
    const prompt = String(promptText || state.aiDraftPrompt || "").trim();
    if (!prompt) {
      showToast("Напишіть запит для AI помічника.", "warning");
      return;
    }
    state.aiMessages.push({ role: "user", text: prompt });
    state.aiMessages.push({ role: "assistant", text: assistantReply(prompt, selectedHelper.label, selectedCase) });
    state.aiChatOpenId = state.aiSelectedAssistantId || selected?.id;
    state.aiDraftPrompt = "";
    rerender();
  };

  document.querySelectorAll("[data-ai-helper]").forEach((button) => button.addEventListener("click", () => {
    const nextLaw = button.dataset.aiHelper;
    state.aiSelectedLaw = state.aiSelectedLaw === nextLaw ? "all" : nextLaw;
    state.aiSelectedHelper = button.dataset.aiHelperLabel;
    state.aiSelectedAssistantId = "";
    state.aiChatOpenId = "";
    state.aiOpenMenuId = "";
    state.aiMessages = defaultMessages(selectedCase, state.aiSelectedHelper);
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
  document.querySelectorAll("[data-ai-summary-filter]").forEach((button) => button.addEventListener("click", () => {
    if (button.dataset.aiSummaryFilter === "visible") return;
    state.aiCaseStatusFilter = button.dataset.aiSummaryFilter;
    rerender();
  }));
  document.querySelectorAll("[data-ai-view-mode]").forEach((button) => button.addEventListener("click", () => {
    state.aiViewMode = button.dataset.aiViewMode;
    rerender();
  }));
  document.querySelector("[data-ai-responsible-filter]")?.addEventListener("change", (event) => {
    state.aiCaseResponsibleFilter = event.currentTarget.value;
    rerender();
  });
  document.querySelectorAll("[data-ai-open-chat], [data-ai-assistant-row]").forEach((element) => element.addEventListener("click", (event) => {
    if (event.target.closest("[data-ai-row-menu], [data-ai-row-action], [data-ai-close-chat]")) return;
    if (element.dataset.aiAssistantRow && event.target.closest("[data-ai-open-chat]")) return;
    const id = element.dataset.aiOpenChat || element.dataset.aiAssistantRow;
    const row = rows.find((item) => item.id === id);
    if (!row) return;
    const caseItem = caseById(row.caseId) || selectedCase;
    state.aiSelectedAssistantId = row.id;
    state.aiSelectedCaseId = row.caseId;
    state.aiSelectedHelper = row.helper.label;
    state.aiMessages = defaultMessages(caseItem, row.helper.label);
    state.aiOpenMenuId = "";
    state.aiChatOpenId = row.id;
    rerender();
  }));
  document.querySelectorAll("[data-ai-close-chat]").forEach((button) => button.addEventListener("click", (event) => {
    event.stopPropagation();
    if (state.aiChatOpenId === button.dataset.aiCloseChat) {
      state.aiChatOpenId = "";
    }
    rerender();
  }));
  document.querySelector("[data-ai-prompt]")?.addEventListener("input", (event) => {
    state.aiDraftPrompt = event.currentTarget.value;
  });
  document.querySelector("[data-ai-prompt]")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") sendPrompt();
  });
  document.querySelector("[data-ai-send]")?.addEventListener("click", () => sendPrompt());
  document.querySelectorAll("[data-ai-question]").forEach((button) => button.addEventListener("click", () => sendPrompt(button.dataset.aiQuestion)));
  document.querySelectorAll("[data-ai-row-menu]").forEach((button) => button.addEventListener("click", (event) => {
    event.stopPropagation();
    state.aiOpenMenuId = state.aiOpenMenuId === button.dataset.aiRowMenu ? "" : button.dataset.aiRowMenu;
    rerender();
  }));
  document.querySelectorAll("[data-ai-row-action]").forEach((button) => button.addEventListener("click", (event) => {
    event.stopPropagation();
    const id = button.dataset.aiRowId;
    if (button.dataset.aiRowAction === "delete") {
      state.aiHiddenAssistantIds = [...new Set([...(state.aiHiddenAssistantIds || []), id])];
      showToast("AI помічника приховано зі списку.");
    } else if (button.dataset.aiRowAction === "export") {
      showToast("Висновок AI підготовлено до експорту.");
    } else {
      showToast("Матеріали справи додано до навчання помічника.");
    }
    state.aiOpenMenuId = "";
    rerender();
  }));
  document.querySelector("[data-ai-create-global]")?.addEventListener("click", () => {
    state.aiCustomAssistants.unshift({
      id: `custom-${Date.now()}`,
      caseId: selectedCase.id,
      title: `${selectedCase.title}, новий AI помічник`,
      created: new Date().toLocaleDateString("uk-UA"),
      description: "Помічник створений вручну і готовий до навчання на документах справи.",
      status: "На навчанні"
    });
    showToast("AI помічника створено і додано до списку.");
    rerender();
  });
  document.querySelector("[data-ai-create-case]")?.addEventListener("click", () => {
    openTaskDialog(selectedCase.id, null, "ai");
    showToast("Відкрито форму задачі для підготовки матеріалів AI.");
  });
  document.querySelectorAll("[data-ai-quick]").forEach((button) => button.addEventListener("click", () => {
    if (button.dataset.aiQuick === "knowledge") {
      switchView("documents");
      return;
    }
    if (button.dataset.aiQuick === "branch") {
      state.aiSelectedHelper = LAW_HELPERS[0].label;
      state.aiMessages = defaultMessages(selectedCase, state.aiSelectedHelper);
      showToast("Оберіть галузь права для нового помічника.");
      rerender();
      return;
    }
    document.querySelector("[data-ai-create-global]")?.click();
  }));
}
