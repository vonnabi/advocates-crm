export function renderFinanceScreen(ctx) {
  const { state, $, badge, currency, clientById } = ctx;
  const income = state.cases.reduce((sum, item) => sum + item.income, 0);
  const debt = state.cases.reduce((sum, item) => sum + item.debt, 0);
  const expenses = 18600;

  $("#finance").innerHTML = `
    <div class="grid cols-4">
      <div class="metric"><span>Дохід</span><strong>${currency(income)}</strong></div>
      <div class="metric"><span>Витрати</span><strong>${currency(expenses)}</strong></div>
      <div class="metric"><span>Прибуток</span><strong>${currency(income - expenses)}</strong></div>
      <div class="metric"><span>Борг клієнтів</span><strong>${currency(debt)}</strong></div>
    </div>
    <div class="panel table-wrap" style="margin-top:16px">
      <div class="toolbar"><h2>Фінанси по справах</h2><button class="primary">+ Створити рахунок</button></div>
      <table>
        <thead><tr><th>Справа</th><th>Клієнт</th><th>Оплачено</th><th>Борг</th><th>Статус</th><th>Дія</th></tr></thead>
        <tbody>
          ${state.cases.map((item) => `<tr>
            <td>№${item.id}</td>
            <td>${clientById(item.clientId).name}</td>
            <td>${currency(item.income)}</td>
            <td>${currency(item.debt)}</td>
            <td>${item.debt ? badge("Є борг", "red") : badge("Оплачено", "green")}</td>
            <td><button class="secondary">Нагадати</button></td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>
  `;
}
