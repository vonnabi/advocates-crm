import { caseFinancials } from "../derived-data.js";

export function renderDashboardScreen(ctx) {
  const { state, $, badge, currency, clientById } = ctx;
  const activeCases = state.cases.filter((item) => item.status !== "Закрито").length;
  const finance = state.cases.reduce((totals, item) => {
    const row = caseFinancials(item);
    return {
      paid: totals.paid + row.paid,
      debt: totals.debt + row.debt,
      total: totals.total + row.total
    };
  }, { paid: 0, debt: 0, total: 0 });
  const telegram = state.clients.filter((client) => client.telegram).length;

  $("#dashboard").innerHTML = `
    <div class="grid cols-4">
      <div class="metric"><span>Клієнтів у базі</span><strong>${state.clients.length}</strong></div>
      <div class="metric"><span>Активних справ</span><strong>${activeCases}</strong></div>
      <div class="metric"><span>Telegram підключено</span><strong>${telegram}</strong></div>
      <div class="metric"><span>Заборгованість</span><strong>${currency(finance.debt)}</strong></div>
    </div>
    <div class="layout" style="margin-top:16px">
      <div class="panel">
        <div class="toolbar">
          <h2>Найближчі події</h2>
          <button class="secondary" data-view-link="calendar">Відкрити календар</button>
        </div>
        <div class="list">
          ${state.events.slice(0, 5).map((event) => {
            const client = clientById(event.clientId);
            return `<div class="list-item">
              <strong>${event.time} · ${event.title}</strong>
              <p class="muted">${event.date} · ${client.name} · Справа №${event.caseId}</p>
              ${badge(event.status)}
            </div>`;
          }).join("")}
        </div>
      </div>
      <div class="panel">
        <h2>Фінансовий зріз</h2>
        <div class="profile">
          <div class="profile-line"><span>Дохід по активних справах</span><strong>${currency(finance.paid)}</strong></div>
          <div class="profile-line"><span>Очікується оплата</span><strong>${currency(finance.debt)}</strong></div>
          <div class="profile-line"><span>Маржинальність демо</span><strong>${finance.total ? Math.round((finance.paid / finance.total) * 100) : 0}%</strong></div>
          <button class="primary" data-view-link="finance">Перейти до фінансів</button>
        </div>
      </div>
    </div>
  `;
}
