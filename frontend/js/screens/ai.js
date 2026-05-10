export function renderAIScreen(ctx) {
  const { $, badge } = ctx;
  const helpers = ["Сімейне право", "Кримінальне право", "Військове право", "Адміністративне право", "Господарське право", "Трудове право"];

  $("#ai").innerHTML = `
    <div class="grid cols-3">
      ${helpers.map((helper) => `<div class="panel">
        <h2>${helper}</h2>
        <p class="muted">Консультації, аналіз документів, підготовка позиції та процесуальних документів.</p>
        ${badge("Активний", "green")}
        <div style="margin-top:14px"><button class="primary">Відкрити консультанта</button></div>
      </div>`).join("")}
    </div>
    <div class="layout" style="margin-top:16px">
      <div class="panel">
        <h2>AI помічник по справі</h2>
        <div class="ai-chat">
          <div class="bubble">Я проаналізував матеріали справи №2024/12345. Основний ризик: потрібно підтвердити дату отримання рішення ТЦК.</div>
          <div class="bubble user">Сформуй план дій і перелік доказів.</div>
          <div class="bubble">План: 1. Витребувати копію рішення. 2. Підготувати адвокатський запит. 3. Сформувати адміністративний позов. 4. Додати медичні та службові документи.</div>
        </div>
      </div>
      <aside class="panel">
        <h2>База знань</h2>
        <div class="list">
          <div class="list-item">Закони та кодекси ${badge("128 файлів", "blue")}</div>
          <div class="list-item">Шаблони документів ${badge("43 шаблони", "green")}</div>
          <div class="list-item">Матеріали справ ${badge("захищено", "amber")}</div>
        </div>
      </aside>
    </div>
  `;
}
