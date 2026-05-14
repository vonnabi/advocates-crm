const HELPERS = [
  "Сімейне право",
  "Кримінальне право",
  "Військове право",
  "Адміністративне право",
  "Господарське право",
  "Трудове право"
];

function defaultMessages(caseItem) {
  return [
    {
      role: "assistant",
      text: `Я проаналізував матеріали справи №${caseItem?.id || "2024/12345"}. Основний фокус: ${caseItem?.stage || "підготовка позиції"} та контроль дедлайнів.`
    },
    {
      role: "user",
      text: "Сформуй план дій і перелік доказів."
    },
    {
      role: "assistant",
      text: "План: перевірити документи, уточнити факти, підготувати процесуальні запити, оновити задачі та винести ключові дедлайни в планер."
    }
  ];
}

function assistantReply(prompt, helper, caseItem) {
  const lower = prompt.toLowerCase();
  if (lower.includes("доказ")) {
    return `Для справи №${caseItem.id} варто зібрати: рішення/листування, підтвердження дат, документи клієнта, докази направлення запитів та пояснення відповідальних осіб.`;
  }
  if (lower.includes("план") || lower.includes("задач")) {
    return `План від ${helper}: 1. Уточнити факти. 2. Перевірити строки. 3. Підготувати документ. 4. Додати контрольну задачу. 5. Зберегти висновок в історії справи.`;
  }
  return `По справі №${caseItem.id} я б перевірив ризики строків, достатність документів і відповідність дій поточному етапу: ${caseItem.stage}.`;
}

export function renderAIScreen(ctx) {
  const { state, $, badge, icon, caseById, showToast, openTaskDialog } = ctx;
  const selectedCase = caseById(state.aiSelectedCaseId) || state.cases[0];
  if (!state.aiMessages.length) {
    state.aiMessages = defaultMessages(selectedCase);
  }

  $("#ai").innerHTML = `
    <div class="ai-screen">
      <div class="grid cols-3 ai-helper-grid">
        ${HELPERS.map((helper) => `<button class="panel ai-helper-card ${state.aiSelectedHelper === helper ? "active" : ""}" type="button" data-ai-helper="${helper}">
          <span>${icon(helper === "Військове право" ? "briefcase" : "file")}</span>
          <strong>${helper}</strong>
          <em>Консультації, аналіз документів, підготовка позиції</em>
          ${badge(state.aiSelectedHelper === helper ? "Відкритий" : "Активний", state.aiSelectedHelper === helper ? "blue" : "green")}
        </button>`).join("")}
      </div>
      <div class="layout ai-workspace">
        <section class="panel">
          <div class="toolbar">
            <div>
              <h2>AI помічник по справі</h2>
              <p class="muted">${state.aiSelectedHelper} · №${selectedCase.id} · ${selectedCase.title}</p>
            </div>
            <select data-ai-case>
              ${state.cases.map((item) => `<option value="${item.id}" ${selectedCase.id === item.id ? "selected" : ""}>№${item.id}</option>`).join("")}
            </select>
          </div>
          <div class="ai-chat">
            ${state.aiMessages.map((message) => `<div class="bubble ${message.role === "user" ? "user" : ""}">${message.text}</div>`).join("")}
          </div>
          <div class="ai-input-row">
            <input data-ai-prompt placeholder="Напишіть запит: план дій, докази, ризики..." value="${state.aiDraftPrompt || ""}">
            <button class="primary" type="button" data-ai-send>${icon("telegram")} Надіслати</button>
          </div>
        </section>
        <aside class="panel ai-side">
          <h2>Дії помічника</h2>
          <div class="list">
            <button class="list-item action-list-button" type="button" data-ai-action="summary"><strong>Сформувати короткий висновок</strong><span>Ризики, дедлайни, наступні кроки</span></button>
            <button class="list-item action-list-button" type="button" data-ai-action="task"><strong>Створити задачу</strong><span>Відкрити форму задачі для цієї справи</span></button>
            <button class="list-item action-list-button" type="button" data-ai-action="template"><strong>Підібрати шаблон</strong><span>Рекомендація документа під етап справи</span></button>
          </div>
          <h2>База знань</h2>
          <div class="list">
            <div class="list-item">Закони та кодекси ${badge("128 файлів", "blue")}</div>
            <div class="list-item">Шаблони документів ${badge("43 шаблони", "green")}</div>
            <div class="list-item">Матеріали справ ${badge("захищено", "amber")}</div>
          </div>
        </aside>
      </div>
    </div>
  `;

  document.querySelectorAll("[data-ai-helper]").forEach((button) => button.addEventListener("click", () => {
    state.aiSelectedHelper = button.dataset.aiHelper;
    state.aiMessages = defaultMessages(selectedCase);
    renderAIScreen(ctx);
  }));
  document.querySelector("[data-ai-case]")?.addEventListener("change", (event) => {
    state.aiSelectedCaseId = event.currentTarget.value;
    state.aiMessages = defaultMessages(caseById(state.aiSelectedCaseId));
    renderAIScreen(ctx);
  });
  document.querySelector("[data-ai-prompt]")?.addEventListener("input", (event) => {
    state.aiDraftPrompt = event.currentTarget.value;
  });
  document.querySelector("[data-ai-send]")?.addEventListener("click", () => {
    const prompt = (state.aiDraftPrompt || "").trim();
    if (!prompt) {
      showToast("Напишіть запит для AI помічника.", "warning");
      return;
    }
    state.aiMessages.push({ role: "user", text: prompt });
    state.aiMessages.push({ role: "assistant", text: assistantReply(prompt, state.aiSelectedHelper, selectedCase) });
    state.aiDraftPrompt = "";
    renderAIScreen(ctx);
  });
  document.querySelectorAll("[data-ai-action]").forEach((button) => button.addEventListener("click", () => {
    const action = button.dataset.aiAction;
    if (action === "task") {
      openTaskDialog(selectedCase.id, null, "ai");
      return;
    }
    const prompt = action === "summary" ? "Сформуй короткий висновок" : "Підібрати шаблон документа";
    state.aiMessages.push({ role: "user", text: prompt });
    state.aiMessages.push({ role: "assistant", text: assistantReply(prompt, state.aiSelectedHelper, selectedCase) });
    renderAIScreen(ctx);
  }));
}
