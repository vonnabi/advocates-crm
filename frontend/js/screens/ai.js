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
      created: caseItem.opened || "12.05.2024",
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
      text: `Я відкрив справу №${caseItem?.id || "2024/12345"} і бачу фокус: ${caseItem?.stage || "підготовка позиції"}. Можу підготувати план, перевірити ризики або сформувати список доказів.`
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

function selectedAssistant(state, rows) {
  return rows.find((row) => row.id === state.aiSelectedAssistantId) || rows[0];
}

function filterRows(state, rows) {
  const query = (state.aiSearchQuery || "").trim().toLowerCase();
  return rows.filter((row) => {
    const caseItem = state.cases.find((item) => item.id === row.caseId);
    const matchesQuery = !query || [row.title, row.subtitle, row.description, caseItem?.responsible, caseItem?.id]
      .some((value) => String(value || "").toLowerCase().includes(query));
    const matchesStatus = state.aiCaseStatusFilter === "all" || row.status === state.aiCaseStatusFilter;
    const matchesResponsible = state.aiCaseResponsibleFilter === "all" || caseItem?.responsible === state.aiCaseResponsibleFilter;
    return matchesQuery && matchesStatus && matchesResponsible;
  });
}

function renderMessage(message) {
  return `<div class="bubble ${message.role === "user" ? "user" : ""}">${escapeHtml(message.text)}</div>`;
}

export function renderAIScreen(ctx) {
  const { state, $, badge, icon, caseById, clientById, showToast, openTaskDialog, switchView, saveNavigationState } = ctx;
  state.aiSearchQuery ||= "";
  state.aiCaseStatusFilter ||= "all";
  state.aiCaseResponsibleFilter ||= "all";
  state.aiCustomAssistants ||= [];
  state.aiHiddenAssistantIds ||= [];
  const rows = assistantRows(state, clientById);
  const filteredRows = filterRows(state, rows);
  const selected = selectedAssistant(state, rows);
  const selectedCase = caseById(selected?.caseId || state.aiSelectedCaseId) || state.cases[0];
  const selectedHelper = selected?.helper || lawForCase(selectedCase);
  if (!state.aiMessages.length || state.aiSelectedCaseId !== selectedCase.id) {
    state.aiSelectedCaseId = selectedCase.id;
    state.aiSelectedHelper = selectedHelper.label;
    state.aiMessages = defaultMessages(selectedCase, selectedHelper.label);
  }

  const activeCount = rows.filter((row) => row.status === "Активний").length;
  const trainingCount = rows.filter((row) => row.status === "На навчанні").length;
  const requestCount = LAW_HELPERS.reduce((sum, helper) => sum + helper.requests, 0) + rows.length * 486;

  $("#ai").innerHTML = `
    <div class="ai-screen ai-directory-screen">
      <div class="ai-page-tools">
        <div class="search-field">
          ${icon("search")}
          <input data-ai-search type="search" placeholder="Пошук помічників..." value="${escapeHtml(state.aiSearchQuery)}">
        </div>
        <button class="primary" type="button" data-ai-create-global>${icon("user")} Створити AI помічника</button>
      </div>

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
                <button class="panel ai-law-card ${state.aiSelectedHelper === helper.label ? "active" : ""}" type="button" data-ai-helper="${helper.label}">
                  <span class="ai-law-icon ${helper.tone}">${icon(helper.icon)}</span>
                  <strong>${helper.label}</strong>
                  <em>${helper.description}</em>
                  <small>${icon("message")} ${helper.requests.toLocaleString("uk-UA")}</small>
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
                <button class="active" type="button" data-ai-view-mode="cards">${icon("filter")}</button>
                <button type="button" data-ai-view-mode="list">${icon("file")}</button>
              </div>
            </div>
            <div class="ai-case-filters">
              <div class="search-field">
                ${icon("search")}
                <input data-ai-case-search type="search" placeholder="Пошук по делам..." value="${escapeHtml(state.aiSearchQuery)}">
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
            <div class="ai-case-list">
              ${filteredRows.map((row) => `
                <article class="ai-case-row ${selected?.id === row.id ? "selected" : ""}" data-ai-assistant-row="${row.id}">
                  <span class="ai-case-icon ${row.helper.tone}">${icon(row.icon)}</span>
                  <div>
                    <strong>${escapeHtml(row.title)}</strong>
                    <span>${escapeHtml(row.subtitle)}</span>
                    <small>Створено: ${escapeHtml(row.created)}</small>
                  </div>
                  <p>${escapeHtml(row.description)}</p>
                  ${badge(row.status, statusTone(row.status))}
                  <button class="secondary compact-button" type="button" data-ai-open-chat="${row.id}">${icon("message")} Відкрити чат</button>
                  <div class="ai-row-actions">
                    <button class="icon-button" type="button" data-ai-row-menu="${row.id}" aria-label="Дії помічника">⋮</button>
                    ${state.aiOpenMenuId === row.id ? `
                      <div class="ai-row-menu">
                        <button type="button" data-ai-row-action="train" data-ai-row-id="${row.id}">Навчити на матеріалах</button>
                        <button type="button" data-ai-row-action="export" data-ai-row-id="${row.id}">Експорт висновку</button>
                        <button type="button" data-ai-row-action="delete" data-ai-row-id="${row.id}">Видалити</button>
                      </div>
                    ` : ""}
                  </div>
                </article>
              `).join("")}
              <article class="ai-case-row ai-create-row">
                <span class="ai-case-icon neutral">+</span>
                <div>
                  <strong>Створити AI помічника для нового дела</strong>
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

          <section class="panel ai-chat-card">
            <div class="toolbar compact">
              <div>
                <h2>Чат по справі</h2>
                <p class="muted">№${escapeHtml(selectedCase.id)} · ${escapeHtml(selectedHelper.label)}</p>
              </div>
            </div>
            <div class="ai-chat">
              ${state.aiMessages.map(renderMessage).join("")}
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
            <button class="list-item action-list-button" type="button" data-ai-quick="case">${icon("tag")} Створити помічника для дела</button>
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
  const sendPrompt = (promptText) => {
    const prompt = String(promptText || state.aiDraftPrompt || "").trim();
    if (!prompt) {
      showToast("Напишіть запит для AI помічника.", "warning");
      return;
    }
    state.aiMessages.push({ role: "user", text: prompt });
    state.aiMessages.push({ role: "assistant", text: assistantReply(prompt, selectedHelper.label, selectedCase) });
    state.aiDraftPrompt = "";
    rerender();
  };

  document.querySelectorAll("[data-ai-helper]").forEach((button) => button.addEventListener("click", () => {
    state.aiSelectedHelper = button.dataset.aiHelper;
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
  document.querySelector("[data-ai-responsible-filter]")?.addEventListener("change", (event) => {
    state.aiCaseResponsibleFilter = event.currentTarget.value;
    rerender();
  });
  document.querySelectorAll("[data-ai-open-chat], [data-ai-assistant-row]").forEach((element) => element.addEventListener("click", (event) => {
    if (event.target.closest("[data-ai-row-menu], [data-ai-row-action]")) return;
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
