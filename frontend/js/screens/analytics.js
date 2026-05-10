export function renderAnalyticsScreen(ctx) {
  const { $, badge } = ctx;

  $("#analytics").innerHTML = `
    <div class="toolbar">
      <div class="left">
        <select><option>Останні 30 днів</option><option>Поточний місяць</option><option>Рік</option></select>
        <select><option>Усі співробітники</option><option>Іваненко А.Ю.</option><option>Мельник Н.П.</option></select>
        <select><option>Усі справи</option><option>Активні</option><option>Просрочені</option></select>
      </div>
      <button class="secondary">Експорт PDF</button>
    </div>
    <div class="grid cols-4">
      <div class="metric"><span>Нові клієнти</span><strong>18</strong></div>
      <div class="metric"><span>Закриті справи</span><strong>7</strong></div>
      <div class="metric"><span>Просрочені задачі</span><strong>2</strong></div>
      <div class="metric"><span>Доставка повідомлень</span><strong>94%</strong></div>
    </div>
    <div class="grid cols-3" style="margin-top:16px">
      <div class="panel"><h2>Справи за типами</h2><div class="list"><div class="profile-line"><span>Військові</span><strong>34%</strong></div><div class="profile-line"><span>Сімейні</span><strong>22%</strong></div><div class="profile-line"><span>Господарські</span><strong>18%</strong></div></div></div>
      <div class="panel"><h2>Джерела клієнтів</h2><div class="list"><div class="profile-line"><span>Рекомендації</span><strong>41%</strong></div><div class="profile-line"><span>Сайт</span><strong>27%</strong></div><div class="profile-line"><span>Соцмережі</span><strong>19%</strong></div></div></div>
      <div class="panel"><h2>Ризики</h2><div class="list"><div class="list-item">${badge("2 просрочені задачі")}</div><div class="list-item">${badge("3 клієнти з боргом")}</div><div class="list-item">${badge("1 документ без відповіді")}</div></div></div>
    </div>
  `;
}
