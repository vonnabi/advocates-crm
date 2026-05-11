function planDateLabel(date, monthNames) {
  const weekdays = ["неділя", "понеділок", "вівторок", "середа", "четвер", "п'ятниця", "субота"];
  return `${date.getDate()} ${monthNames[date.getMonth()].toLowerCase()} ${date.getFullYear()}, ${weekdays[date.getDay()]}`;
}

function dueTime(task, index) {
  const match = String(task.dueText || "").match(/\d{2}:\d{2}/);
  const fallback = ["10:00", "11:30", "14:00", "12:30", "15:30", "16:30", "09:00", "17:30"];
  return match?.[0] || fallback[index % fallback.length];
}

function taskCategory(task) {
  const title = String(task.title || "").toLowerCase();
  if (title.includes("суд")) return "Суд";
  if (title.includes("термін") || title.includes("строк")) return "Дедлайн";
  if (title.includes("клієнт") || title.includes("зустр")) return "Зустріч";
  if (title.includes("дзв")) return "Дзвінок";
  if (title.includes("документ")) return "Документ";
  if (title.includes("аналіз")) return "Аналіз";
  return task.priority === "Низький" ? "Планове" : "Терміново";
}

function taskIconName(task) {
  const category = taskCategory(task);
  if (category === "Суд") return "building";
  if (category === "Дедлайн" || category === "Документ") return "file";
  if (category === "Зустріч" || category === "Аналіз") return "briefcase";
  if (category === "Дзвінок") return "phone";
  return "calendar";
}

function priorityTone(priority) {
  if (priority === "Високий") return "red";
  if (priority === "Середній") return "amber";
  return "green";
}

export function renderPlannerScreen(ctx) {
  const {
    $,
    state,
    allCaseTasks,
    badge,
    bindViewLinks,
    calendarEntries,
    calendarToday,
    caseById,
    dateFromIso,
    icon,
    monthNames,
    openTaskDialog,
    renderAll,
    renderCases,
    switchView,
    showToast
  } = ctx;
  const tasks = allCaseTasks();
  const entries = calendarEntries();
  const planDate = dateFromIso(calendarToday);
  const sourceTask = (task) => task ? caseById(task.caseId)?.tasks?.[task.taskIndex] : null;
  const priorityOrder = { "Високий": 0, "Середній": 1, "Низький": 2, "Плановий": 3 };
  const planItems = tasks
    .filter((task) => task.plannerIncluded && !task.completed)
    .sort((a, b) => {
      const priorityDiff = (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3);
      return priorityDiff || String(a.dueText).localeCompare(String(b.dueText));
    })
    .slice(0, 8);
  const groups = [
    {
      key: "urgent",
      title: "Термінові (високий пріоритет)",
      tone: "red",
      icon: "bell",
      items: planItems.filter((task) => task.priority === "Високий")
    },
    {
      key: "important",
      title: "Важливі (середній пріоритет)",
      tone: "amber",
      icon: "file",
      items: planItems.filter((task) => task.priority === "Середній")
    },
    {
      key: "planned",
      title: "Планові (низький пріоритет)",
      tone: "green",
      icon: "calendar",
      items: planItems.filter((task) => ["Низький", "Плановий"].includes(task.priority))
    }
  ];
  const completed = tasks.filter((task) => task.completed).length;
  const productivityBase = Math.max(1, planItems.length);
  const productivityDone = Math.min(productivityBase, Math.max(completed, Math.max(0, productivityBase - 3)));
  const productivity = Math.round((productivityDone / productivityBase) * 100);
  const calendarTomorrow = [...entries].sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)).slice(0, 3);

  $("#planner").innerHTML = `
    <div class="planner-screen">
      <div class="planner-head">
        <div>
          <h2>План на завтра</h2>
          <span>${planDateLabel(planDate, monthNames)} ${icon("calendar")}</span>
        </div>
        <div class="planner-head-actions">
          <button class="primary" type="button" id="generate-plan">${icon("refresh")} Згенерувати план на завтра</button>
          <button class="secondary" type="button" id="add-plan-task">+ Додати справу / завдання</button>
        </div>
      </div>

      <div class="planner-kpi-grid">
        <article><div><span>Всього справ / подій</span><strong>${planItems.length}</strong></div><i>${icon("calendar")}</i></article>
        <article><div><span>Термінові</span><strong>${groups[0].items.length}</strong></div><i class="red">!</i></article>
        <article><div><span>Важливі</span><strong>${groups[1].items.length}</strong></div><i class="amber">${icon("tag")}</i></article>
        <article><div><span>Планові</span><strong>${groups[2].items.length}</strong></div><i class="green">${icon("calendar")}</i></article>
      </div>

      <div class="planner-layout">
        <section class="panel planner-main-card">
          <h2>План дня по пріоритетності</h2>
          <div class="planner-priority-list">
            ${groups.map((group) => group.items.length ? `
              <section class="planner-priority-group ${group.tone}">
                <header>
                  <span>${icon(group.icon)}</span>
                  <strong>${group.title}</strong>
                  <em>${group.items.length}</em>
                </header>
                <div class="planner-items">
                  ${group.items.map((task, index) => `
                    <article class="planner-item">
                      <time><strong>${dueTime(task, index)}</strong><span>${icon("clock")}</span></time>
                      <div class="planner-item-icon">${icon(taskIconName(task))}</div>
                      <div class="planner-item-main">
                        <strong>${task.title}</strong>
                        <span>${task.caseTitle} · ${task.plannerReason || task.status}</span>
                      </div>
                      ${badge(taskCategory(task), group.tone)}
                      <div class="planner-item-case">
                        <strong>Справа №${task.caseId}</strong>
                        <span>${task.clientName}</span>
                      </div>
                      <div class="planner-item-actions">
                        <button type="button" class="secondary" data-open-planner-case="${task.caseId}">Відкрити справу</button>
                        <button type="button" class="secondary" data-complete-planner-task="${task.key}">Виконано</button>
                        <div class="planner-more-wrap">
                          <button type="button" class="icon-button compact" data-planner-more="${task.key}" aria-label="Додаткові дії" aria-expanded="false">⋮</button>
                          <div class="planner-more-menu" data-planner-menu="${task.key}" hidden>
                            <button type="button" data-edit-planner-task="${task.key}">${icon("edit")} Редагувати</button>
                            <button type="button" data-reschedule-planner-task="${task.key}">${icon("calendar")} Перенести дедлайн</button>
                            <button type="button" data-important-planner-task="${task.key}">${icon("bell")} ${task.plannerImportant ? "Зняти важливість" : "Позначити важливу"}</button>
                            <button type="button" class="danger" data-remove-planner-task="${task.key}">${icon("trash")} Прибрати з плану</button>
                          </div>
                        </div>
                      </div>
                    </article>
                  `).join("")}
                </div>
              </section>
            ` : "").join("")}
          </div>
          <button class="planner-add-row" type="button" id="add-plan-task-bottom">+ Додати справу / завдання у план</button>
        </section>

        <aside class="planner-side">
          <section class="panel planner-side-card">
            <h2>Синхронізація даних</h2>
            <div class="planner-sync-list">
              <p>${icon("calendar")}<span>Календар</span><strong>Синхронізовано</strong><em></em></p>
              <p>${icon("file")}<span>Справи</span><strong>Синхронізовано</strong><em></em></p>
              <p>${icon("check")}<span>Задачі</span><strong>Оновлено 5 хв тому</strong><button type="button" aria-label="Оновити">${icon("refresh")}</button></p>
            </div>
            <small>Останнє оновлення: сьогодні, 21:45</small>
          </section>

          <section class="panel planner-side-card">
            <h2>Як формується план?</h2>
            <p class="muted">План створюється автоматично щовечора на основі:</p>
            <ul class="planner-check-list">
              <li>Подій з календаря</li>
              <li>Термінів у справах</li>
              <li>Дедлайнів та задач</li>
              <li>Пріоритетів справ</li>
            </ul>
            <small>Ви можете вручну додавати або змінювати порядок справ у плані.</small>
          </section>

          <section class="panel planner-side-card planner-calendar-card">
            <h2>Календар на завтра</h2>
            <span>${planDateLabel(planDate, monthNames)}</span>
            <div>
              ${calendarTomorrow.map((event) => `
                <p>
                  <time>${event.time}</time>
                  <strong>${event.title}</strong>
                  <span>Справа №${event.caseId}</span>
                </p>
              `).join("")}
            </div>
            <button class="ghost" type="button" data-view-link="calendar">Переглянути календар</button>
          </section>

          <section class="panel planner-side-card planner-productivity">
            <h2>Продуктивність <span>За сьогодні</span></h2>
            <p><span>Виконано справ / задач</span><strong>${productivityDone} / ${productivityBase}</strong></p>
            <div class="planner-progress"><span style="width:${productivity}%;"></span></div>
            <p><span>Ефективність</span><strong>${productivity}%</strong></p>
            <div class="planner-progress"><span style="width:${productivity}%;"></span></div>
            <button class="ghost" type="button" data-view-link="analytics">Детальна статистика</button>
          </section>
        </aside>
      </div>
    </div>
  `;

  bindViewLinks();
  $("#generate-plan")?.addEventListener("click", () => {
    tasks.forEach((task) => {
      const source = sourceTask(task);
      if (!source) return;
      source.plannerAutoReason = task.plannerAutoReason || "";
    });
    renderAll();
    switchView("planner");
    showToast(`План на завтра оновлено: ${planItems.length} задач.`);
  });
  $("#add-plan-task")?.addEventListener("click", () => openTaskDialog(state.selectedCaseId || state.cases[0]?.id, null, "planner"));
  $("#add-plan-task-bottom")?.addEventListener("click", () => openTaskDialog(state.selectedCaseId || state.cases[0]?.id, null, "planner"));
  document.querySelectorAll("[data-open-planner-case]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedCaseId = button.dataset.openPlannerCase;
      state.caseScreen = "detail";
      renderCases();
      switchView("cases");
    });
  });
  document.querySelectorAll("[data-complete-planner-task]").forEach((button) => {
    button.addEventListener("click", () => {
      const task = tasks.find((item) => item.key === button.dataset.completePlannerTask);
      const source = sourceTask(task);
      if (!source) return;
      source.status = "Виконано";
      renderAll();
      switchView("planner");
      showToast("Задачу виконано і прибрано з плану.");
    });
  });
  document.querySelectorAll("[data-planner-more]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const menu = document.querySelector(`[data-planner-menu="${button.dataset.plannerMore}"]`);
      if (!menu) return;
      const willOpen = menu.hidden;
      document.querySelectorAll(".planner-more-menu").forEach((item) => item.hidden = true);
      document.querySelectorAll("[data-planner-more]").forEach((item) => item.setAttribute("aria-expanded", "false"));
      menu.hidden = !willOpen;
      button.setAttribute("aria-expanded", String(willOpen));
    });
  });
  document.querySelectorAll("[data-edit-planner-task]").forEach((button) => {
    button.addEventListener("click", () => {
      const task = tasks.find((item) => item.key === button.dataset.editPlannerTask);
      if (!task) return;
      openTaskDialog(task.caseId, task.taskIndex, "planner");
    });
  });
  document.querySelectorAll("[data-reschedule-planner-task]").forEach((button) => {
    button.addEventListener("click", () => {
      const task = tasks.find((item) => item.key === button.dataset.reschedulePlannerTask);
      if (!task) return;
      openTaskDialog(task.caseId, task.taskIndex, "planner");
    });
  });
  document.querySelectorAll("[data-important-planner-task]").forEach((button) => {
    button.addEventListener("click", () => {
      const task = tasks.find((item) => item.key === button.dataset.importantPlannerTask);
      const source = sourceTask(task);
      if (!source) return;
      source.plannerImportant = !task.plannerImportant;
      if (source.plannerImportant) source.plannerSuppressed = false;
      renderAll();
      switchView("planner");
      showToast(source.plannerImportant ? "Задачу позначено важливою." : "Важливість задачі знято.");
    });
  });
  document.querySelectorAll("[data-remove-planner-task]").forEach((button) => {
    button.addEventListener("click", () => {
      const task = tasks.find((item) => item.key === button.dataset.removePlannerTask);
      const source = sourceTask(task);
      if (!source) return;
      source.plannerManual = false;
      source.plannerImportant = false;
      source.plannerSuppressed = true;
      renderAll();
      switchView("planner");
      showToast("Задачу прибрано з плану.");
    });
  });
  document.addEventListener("click", (event) => {
    if (event.target.closest(".planner-more-wrap")) return;
    document.querySelectorAll(".planner-more-menu").forEach((item) => item.hidden = true);
    document.querySelectorAll("[data-planner-more]").forEach((item) => item.setAttribute("aria-expanded", "false"));
  }, { once: true });
}
