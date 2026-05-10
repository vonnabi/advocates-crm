export function renderPlannerScreen(ctx) {
  const { $, allCaseTasks, badge, bindViewLinks, calendarEntries, taskTone } = ctx;
  const tasks = allCaseTasks();
  const todayItems = tasks
    .filter((task) => !task.completed)
    .sort((a, b) => {
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
      return a.dueText.localeCompare(b.dueText);
    })
    .slice(0, 6);
  const team = ["Іваненко А.Ю.", "Мельник Н.П.", "Кравчук А.В.", "Петренко С.В."];

  $("#planner").innerHTML = `
    <div class="tasks-screen">
      <div class="case-kpi-grid">
        <article><span>У плані на день</span><strong>${todayItems.length}</strong></article>
        <article><span>Просрочені</span><strong>${tasks.filter((task) => task.overdue).length}</strong></article>
        <article><span>Високий пріоритет</span><strong>${tasks.filter((task) => task.priority === "Високий").length}</strong></article>
        <article><span>З календаря</span><strong>${calendarEntries().length}</strong></article>
      </div>
      <div class="tasks-layout">
        <div class="panel tasks-list-card">
          <div class="toolbar">
            <h2>Робочий план юриста</h2>
            <button class="primary" data-view-link="tasks">Відкрити задачі</button>
          </div>
          <div class="list">
            ${todayItems.map((task) => `
              <div class="list-item">
                <strong>${task.dueText} · ${task.title}</strong>
                <p class="muted">№${task.caseId} · ${task.clientName} · ${task.responsible}</p>
                ${badge(task.overdue ? "Просрочено" : task.status, task.overdue ? "red" : taskTone(task.status))}
              </div>
            `).join("") || `<div class="list-item"><strong>План чистий</strong><p class="muted">Немає задач для автоматичного плану.</p></div>`}
          </div>
        </div>
        <aside class="panel task-side-card">
          <h2>Плани команди</h2>
          <div class="profile">
            ${team.map((name) => {
              const count = tasks.filter((task) => task.responsible === name && !task.completed).length;
              const overdue = tasks.filter((task) => task.responsible === name && task.overdue).length;
              return `<div class="profile-line"><span>${name}</span><strong>${count} задач${overdue ? ` · ${overdue} проср.` : ""}</strong></div>`;
            }).join("")}
          </div>
          <button class="secondary" data-view-link="calendar">Відкрити календар</button>
        </aside>
      </div>
    </div>
  `;
  bindViewLinks();
}
