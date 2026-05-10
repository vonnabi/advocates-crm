export function renderOSINTScreen(ctx) {
  const { $, badge } = ctx;

  $("#osint").innerHTML = `
    <div class="grid cols-4">
      <div class="metric"><span>Перевірок</span><strong>12</strong></div>
      <div class="metric"><span>Відкриті ризики</span><strong>3</strong></div>
      <div class="metric"><span>Джерел даних</span><strong>8</strong></div>
      <div class="metric"><span>Звіти</span><strong>5</strong></div>
    </div>
    <div class="layout" style="margin-top:16px">
      <div class="panel">
        <div class="toolbar"><h2>OSINT перевірки</h2><button class="primary">+ Нова перевірка</button></div>
        <div class="list">
          <div class="list-item"><strong>Перевірка контрагента по договору</strong><p class="muted">Справа №2024/5678 · реєстри, судові рішення, борги</p>${badge("В роботі", "blue")}</div>
          <div class="list-item"><strong>Аналіз відкритих джерел клієнта</strong><p class="muted">Справа №2024/9999 · згадки, документи, ризики</p>${badge("Потребує уваги", "amber")}</div>
          <div class="list-item"><strong>Моніторинг судових реєстрів</strong><p class="muted">Автоматична перевірка по активних справах</p>${badge("Активний", "green")}</div>
        </div>
      </div>
      <aside class="panel">
        <h2>Картка перевірки</h2>
        <div class="profile">
          <div class="profile-line"><span>Об'єкт</span><strong>ТОВ / контрагент</strong></div>
          <div class="profile-line"><span>Статус</span>${badge("В роботі", "blue")}</div>
          <div class="profile-line"><span>Пов'язана справа</span><strong>№2024/5678</strong></div>
          <p class="muted">У повній версії тут буде збір відкритих даних, файли перевірки, висновок і історія змін.</p>
        </div>
      </aside>
    </div>
  `;
}
