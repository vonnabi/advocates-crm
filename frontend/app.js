import { createInitialState } from "./js/state.js";
import { renderAIScreen } from "./js/screens/ai.js";
import { renderAnalyticsScreen } from "./js/screens/analytics.js";
import {
  caseFinance,
  caseFolders,
  caseProceduralItems,
  renderCaseListScreen,
  renderCaseProfileScreen,
  renderCasesScreen
} from "./js/screens/cases.js";
import {
  calendarEntries as calendarEntriesScreen,
  calendarEventMeta as calendarEventMetaScreen,
  calendarEventTypes as calendarEventTypesScreen,
  calendarStatuses as calendarStatusesScreen,
  renderCalendarScreen
} from "./js/screens/calendar.js";
import {
  renderClientProfile as renderClientProfileScreen,
  renderClientRows as renderClientRowsScreen,
  renderClientsScreen
} from "./js/screens/clients.js";
import { renderDocumentsScreen } from "./js/screens/documents.js";
import {
  renderMailingsScreen,
  setMailingTab as setMailingTabScreen
} from "./js/screens/mailings.js";
import { renderFinanceScreen } from "./js/screens/finance.js";
import { renderPlannerScreen } from "./js/screens/planner.js";
import { renderSettingsScreen } from "./js/screens/settings.js";
import {
  allCaseTasks as allCaseTasksScreen,
  renderTasksScreen
} from "./js/screens/tasks.js";
import {
  addDays,
  advocatePhoto,
  badge,
  calendarTimeTone,
  calendarTitle,
  calendarToday,
  calendarViewDays,
  currency,
  currencyText,
  dateFromIso,
  documentActionButtons,
  documentStatusControl,
  documentStatusTone,
  formatDate,
  icon,
  isoFromDate,
  makeDocumentId,
  monthNames,
  riskTone,
  semanticTone,
  statusTone,
  taskTone,
  todayIso,
  weekDayNames
} from "./js/ui.js";

const state = await createInitialState();

const NAV_STORAGE_KEY = "advocates-crm-navigation";

const titles = {
  dashboard: "Дашборд",
  cases: "Справи",
  clients: "База клієнтів",
  tasks: "Задачі",
  calendar: "Календар",
  planner: "Планер",
  documents: "Документи",
  mailings: "Розсилка",
  ai: "AI помічники",
  finance: "Фінанси",
  analytics: "Аналітика",
  osint: "OSINT",
  settings: "Налаштування"
};

const $ = (selector) => document.querySelector(selector);
const viewNodes = [...document.querySelectorAll(".view")];
const navNodes = [...document.querySelectorAll(".nav-item")];
const DEMO_URL = "https://vonnabi.github.io/advocates-crm/";

function showToast(message, type = "success") {
  const stack = $("#toast-stack");
  if (!stack || !message) return;
  const node = document.createElement("div");
  node.className = `toast ${type}`;
  node.textContent = message;
  stack.append(node);
  [...stack.children].slice(0, -3).forEach((item) => item.remove());
  requestAnimationFrame(() => node.classList.add("visible"));
  window.setTimeout(() => {
    node.classList.remove("visible");
    node.addEventListener("transitionend", () => node.remove(), { once: true });
  }, 2800);
}

function closeTopbarPanels() {
  [
    ["#notifications-toggle", "#notifications-menu"],
    ["#admin-profile-toggle", "#admin-profile-menu"]
  ].forEach(([toggleSelector, panelSelector]) => {
    const toggle = $(toggleSelector);
    const panel = $(panelSelector);
    if (!toggle || !panel) return;
    toggle.classList.remove("active");
    toggle.setAttribute("aria-expanded", "false");
    panel.classList.remove("open");
    panel.hidden = true;
  });
}

function toggleTopbarPanel(toggleSelector, panelSelector) {
  const toggle = $(toggleSelector);
  const panel = $(panelSelector);
  if (!toggle || !panel) return;
  const willOpen = panel.hidden;
  closeTopbarPanels();
  panel.hidden = !willOpen;
  panel.classList.toggle("open", willOpen);
  toggle.classList.toggle("active", willOpen);
  toggle.setAttribute("aria-expanded", String(willOpen));
}

function markNotificationRead() {
  const badge = $("#notifications-count");
  if (!badge) return;
  const nextCount = Math.max(Number(badge.textContent) - 1, 0);
  badge.textContent = String(nextCount);
  badge.classList.toggle("empty", nextCount === 0);
}

function toggleSidebar() {
  const collapsed = document.body.classList.toggle("sidebar-collapsed");
  saveNavigationState();
  showToast(collapsed ? "Бокове меню згорнуто." : "Бокове меню розгорнуто.");
}

async function copyDemoLink() {
  try {
    await navigator.clipboard.writeText(DEMO_URL);
    showToast("Ссылка для заказчика скопирована.");
  } catch (error) {
    window.prompt("Скопируйте ссылку для заказчика:", DEMO_URL);
  }
}

function clientById(id) {
  return state.clients.find((client) => client.id === Number(id));
}

function caseById(id) {
  return state.cases.find((item) => item.id === id);
}

function screenContext() {
  return {
    state,
    $,
    icon,
    badge,
    statusTone,
    semanticTone,
    formatDate,
    currency,
    currencyText,
    addDays,
    calendarTimeTone,
    calendarTitle,
    calendarToday,
    calendarViewDays,
    dateFromIso,
    isoFromDate,
    monthNames,
    todayIso,
    weekDayNames,
    documentActionButtons,
    documentStatusControl,
    documentStatusTone,
    taskTone,
    advocatePhoto,
    clientById,
    caseById,
    allCaseTasks,
    calendarEntries,
    openClientDialog,
    openCaseDialog,
    openEssenceDialog,
    openAuthorityDialog,
    openFinanceDialog,
    openDocumentDialog,
    openTaskDialog,
    openEventDialog,
    openFolderDialog,
    openDeleteDocumentConfirm,
    getDocumentPayload,
    openStoredDocument,
    parseDisplayDate,
    renderAll,
    renderCases,
    renderTasks,
    renderCalendar,
    switchView,
    bindViewLinks,
    showToast,
    saveNavigationState,
    syncNavigationState
  };
}

function allCaseTasks() {
  return allCaseTasksScreen(screenContext());
}

function renderDashboard() {
  const activeCases = state.cases.filter((item) => item.status !== "Закрито").length;
  const debt = state.cases.reduce((sum, item) => sum + item.debt, 0);
  const income = state.cases.reduce((sum, item) => sum + item.income, 0);
  const telegram = state.clients.filter((client) => client.telegram).length;

  $("#dashboard").innerHTML = `
    <div class="grid cols-4">
      <div class="metric"><span>Клієнтів у базі</span><strong>${state.clients.length}</strong></div>
      <div class="metric"><span>Активних справ</span><strong>${activeCases}</strong></div>
      <div class="metric"><span>Telegram підключено</span><strong>${telegram}</strong></div>
      <div class="metric"><span>Заборгованість</span><strong>${currency(debt)}</strong></div>
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
          <div class="profile-line"><span>Дохід по активних справах</span><strong>${currency(income)}</strong></div>
          <div class="profile-line"><span>Очікується оплата</span><strong>${currency(debt)}</strong></div>
          <div class="profile-line"><span>Маржинальність демо</span><strong>68%</strong></div>
          <button class="primary" data-view-link="finance">Перейти до фінансів</button>
        </div>
      </div>
    </div>
  `;
}

function renderClients() {
  renderClientsScreen(screenContext());
}

function renderClientRows() {
  renderClientRowsScreen(screenContext());
}

function renderClientProfile(id) {
  renderClientProfileScreen(screenContext(), id);
}

function renderCases() {
  renderCasesScreen(screenContext());
}

function renderCaseList() {
  renderCaseListScreen(screenContext());
}

function renderCaseProfile(id) {
  renderCaseProfileScreen(screenContext(), id);
}

function calendarEventTypes() {
  return calendarEventTypesScreen(screenContext());
}

function calendarStatuses() {
  return calendarStatusesScreen(screenContext());
}

function calendarEventMeta(event) {
  return calendarEventMetaScreen(screenContext(), event);
}

function calendarEntries() {
  return calendarEntriesScreen(screenContext());
}

function renderCalendar() {
  renderCalendarScreen(screenContext());
}

function renderTasks() {
  renderTasksScreen(screenContext());
}

function renderPlanner() {
  renderPlannerScreen(screenContext());
}

function setMailingTab(tab, remember = true) {
  setMailingTabScreen(screenContext(), tab, remember);
}

function renderMailings() {
  renderMailingsScreen(screenContext());
}

function renderAI() {
  renderAIScreen(screenContext());
}

function renderFinance() {
  renderFinanceScreen(screenContext());
}

function renderAnalytics() {
  renderAnalyticsScreen(screenContext());
}

function renderOSINT() {
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

function renderDocuments() {
  renderDocumentsScreen(screenContext());
}

function renderSettings() {
  renderSettingsScreen(screenContext());
}

function renderAll() {
  const taskBadge = document.querySelector('[data-view="tasks"] .nav-badge');
  if (taskBadge) taskBadge.textContent = allCaseTasks().filter((task) => !task.completed).length;
  renderDashboard();
  renderClients();
  renderCases();
  renderTasks();
  renderCalendar();
  renderPlanner();
  renderDocuments();
  renderMailings();
  renderAI();
  renderFinance();
  renderAnalytics();
  renderOSINT();
  renderSettings();
  bindViewLinks();
  requestAnimationFrame(syncNavigationState);
}

function saveNavigationState() {
  try {
    const payload = {
      currentView: state.currentView,
      viewHistory: state.viewHistory,
      caseScreen: state.caseScreen,
      selectedCaseId: state.selectedCaseId,
      taskDetailOpen: state.taskDetailOpen,
      selectedTaskKey: state.selectedTaskKey,
      mailingMainTab: state.mailingMainTab,
      previousMailingTab: state.previousMailingTab,
      bureauSettings: state.bureauSettings,
      settingsIntegrations: state.settingsIntegrations,
      settingsNotifications: state.settingsNotifications,
      sidebarCollapsed: document.body.classList.contains("sidebar-collapsed")
    };
    localStorage.setItem(NAV_STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    // Navigation persistence is helpful, but the app should still work without storage access.
  }
}

function restoreNavigationState() {
  try {
    const saved = JSON.parse(localStorage.getItem(NAV_STORAGE_KEY) || "{}");
    if (!saved || !saved.currentView || !document.getElementById(saved.currentView)) return;
    state.currentView = saved.currentView;
    state.viewHistory = Array.isArray(saved.viewHistory) ? saved.viewHistory.filter((view) => document.getElementById(view)).slice(-20) : [];
    state.previousView = state.viewHistory.at(-1) || "";
    state.caseScreen = saved.caseScreen === "detail" ? "detail" : "list";
    state.selectedCaseId = caseById(saved.selectedCaseId) ? saved.selectedCaseId : state.selectedCaseId;
    state.taskDetailOpen = Boolean(saved.taskDetailOpen);
    state.selectedTaskKey = saved.selectedTaskKey || "";
    state.mailingMainTab = saved.mailingMainTab || state.mailingMainTab;
    state.previousMailingTab = saved.previousMailingTab || "";
    state.bureauSettings = { ...state.bureauSettings, ...(saved.bureauSettings || {}) };
    state.settingsIntegrations = { ...state.settingsIntegrations, ...(saved.settingsIntegrations || {}) };
    state.settingsNotifications = { ...state.settingsNotifications, ...(saved.settingsNotifications || {}) };
    document.body.classList.toggle("sidebar-collapsed", Boolean(saved.sidebarCollapsed));
  } catch (error) {
    localStorage.removeItem(NAV_STORAGE_KEY);
  }
}

function switchView(view, options = {}) {
  if (!view || !document.getElementById(view)) return;
  const leavingView = state.currentView;
  if (view !== state.currentView && !options.skipHistory) {
    pushViewHistory(state.currentView, view);
  }
  if (leavingView === "mailings" && view !== "mailings") {
    state.previousMailingTab = "";
  }
  state.currentView = view;
  state.previousView = state.viewHistory.at(-1) || "";
  viewNodes.forEach((node) => node.classList.toggle("active", node.id === view));
  navNodes.forEach((node) => node.classList.toggle("active", node.dataset.view === view));
  $("#page-title").textContent = titles[view] || "CRM";
  $("#page-eyebrow").textContent = view === "tasks" ? "Управління задачами та контроль виконання" : "Юридичне бюро";
  document.body.dataset.view = view;
  syncNavigationState();
}

function pushViewHistory(fromView, toView) {
  if (!fromView || fromView === toView) return;
  while (state.viewHistory.at(-1) === toView) {
    state.viewHistory.pop();
  }
  if (state.viewHistory.at(-1) !== fromView) {
    state.viewHistory.push(fromView);
  }
  state.viewHistory = state.viewHistory.slice(-20);
}

function hasInternalBack(view = state.currentView) {
  return (view === "mailings" && Boolean(state.previousMailingTab))
    || (view === "cases" && state.caseScreen === "detail")
    || (view === "tasks" && state.taskDetailOpen);
}

function updateTopbarBack() {
  const backButton = $("#topbar-back");
  if (backButton) {
    const visible = state.viewHistory.length > 0 || hasInternalBack();
    backButton.classList.toggle("visible", visible);
    const label = backTargetLabel();
    backButton.title = label;
    backButton.setAttribute("aria-label", label);
  }
}

function syncNavigationState() {
  updateTopbarBack();
  saveNavigationState();
}

function backTargetLabel() {
  if (state.currentView === "cases" && state.caseScreen === "detail") return "Назад к списку справ";
  if (state.currentView === "tasks" && state.taskDetailOpen) return "Назад к списку задач";
  if (state.currentView === "mailings" && state.previousMailingTab) return "Назад к предыдущей вкладке рассылки";
  const previousTitle = titles[state.viewHistory.at(-1)] || "предыдущему разделу";
  return `Назад к разделу: ${previousTitle}`;
}

function goInternalBack() {
  if (state.currentView === "mailings" && state.previousMailingTab) {
    const targetTab = state.previousMailingTab;
    state.previousMailingTab = "";
    setMailingTab(targetTab, false);
    renderMailings();
    switchView("mailings", { skipHistory: true });
    return true;
  }
  if (state.currentView === "cases" && state.caseScreen === "detail") {
    state.caseScreen = "list";
    state.openCaseSection = "";
    renderCases();
    switchView("cases", { skipHistory: true });
    return true;
  }
  if (state.currentView === "tasks" && state.taskDetailOpen) {
    state.taskDetailOpen = false;
    state.selectedTaskKey = "";
    renderTasks();
    switchView("tasks", { skipHistory: true });
    return true;
  }
  return false;
}

function goBack() {
  const openDialog = document.querySelector("dialog[open]");
  if (openDialog) {
    openDialog.close();
    return;
  }
  if (goInternalBack()) {
    scrollActiveViewTop();
    return;
  }
  const target = state.viewHistory.pop() || "dashboard";
  state.previousView = state.viewHistory.at(-1) || "";
  switchView(target, { skipHistory: true });
  scrollActiveViewTop();
}

function scrollActiveViewTop() {
  requestAnimationFrame(() => {
    document.querySelector(".view.active")?.scrollTo?.({ top: 0, behavior: "smooth" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

function bindViewLinks() {
  document.querySelectorAll("[data-view-link]").forEach((button) => {
    button.addEventListener("click", () => switchView(button.dataset.viewLink));
  });
}

function openClientDialog(clientId = null) {
  const form = $("#client-form");
  form.reset();
  form.elements.clientId.value = "";
  $("#client-dialog-title").textContent = "Новий клієнт";

  if (clientId !== null && clientId !== undefined) {
    const client = clientById(clientId);
    if (!client) {
      $("#client-dialog").showModal();
      return;
    }
    form.elements.clientId.value = client.id;
    form.elements.name.value = client.name;
    form.elements.phone.value = client.phone;
    form.elements.email.value = client.email;
    form.elements.address.value = client.address || "";
    form.elements.telegramUsername.value = client.telegramUsername || "";
    form.elements.request.value = client.request;
    form.elements.status.value = client.status;
    form.elements.source.value = client.source;
    form.elements.manager.value = client.manager;
    $("#client-dialog-title").textContent = "Редагувати клієнта";
  }

  $("#client-dialog").showModal();
}

function parseDisplayDate(displayDate) {
  if (!displayDate || displayDate === "Не вказано") return "";
  const [day, month, yearWithTime] = displayDate.split(".");
  const year = yearWithTime?.split(" ")[0];
  if (!day || !month || !year) return "";
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function openCaseDialog(caseId = null) {
  const form = $("#case-form");
  form.reset();
  $("#case-client").innerHTML = state.clients.map((client) => `<option value="${client.id}">${client.name}</option>`).join("");
  form.elements.caseId.value = "";
  form.elements.stage.value = "Первинна консультація";
  $("#case-dialog-title").textContent = "Нова справа";
  $("#case-submit-button").textContent = "Створити справу";

  if (caseId !== null && caseId !== undefined) {
    const item = caseById(caseId);
    if (!item) {
      $("#case-dialog").showModal();
      return;
    }
    form.elements.caseId.value = item.id;
    form.elements.clientId.value = item.clientId;
    form.elements.title.value = item.title;
    form.elements.type.value = item.type;
    form.elements.stage.value = item.stage;
    form.elements.status.value = item.status;
    form.elements.deadline.value = parseDisplayDate(item.deadline);
    form.elements.priority.value = item.priority;
    form.elements.responsible.value = item.responsible;
    $("#case-dialog-title").textContent = "Редагувати справу";
    $("#case-submit-button").textContent = "Зберегти справу";
  }

  $("#case-dialog").showModal();
}

function openEssenceDialog(caseId) {
  const item = caseById(caseId);
  if (!item) return;
  const form = $("#essence-form");
  form.reset();
  form.elements.caseId.value = item.id;
  form.elements.description.value = item.description || "";
  $("#essence-dialog").showModal();
}

function openAuthorityDialog(caseId) {
  const item = caseById(caseId);
  if (!item) return;
  const form = $("#authority-form");
  form.reset();
  form.elements.caseId.value = item.id;
  form.elements.court.value = item.court === "Не вказано" ? "" : item.court;
  form.elements.authorityType.value = item.authorityType || "";
  form.elements.authorityAddress.value = item.authorityAddress || "";
  form.elements.authorityContact.value = item.authorityContact || "";
  $("#authority-dialog").showModal();
}

function moneyValue(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function openFinanceDialog(caseId) {
  const item = caseById(caseId);
  if (!item) return;
  const form = $("#finance-form");
  const finance = caseFinance(item);
  form.reset();
  form.elements.caseId.value = item.id;
  form.elements.totalFee.value = finance.total || "";
  form.elements.paid.value = finance.paid || "";
  form.elements.firstPaymentDate.value = parseDisplayDate(item.firstPaymentDate);
  form.elements.nextPaymentDue.value = parseDisplayDate(item.nextPaymentDue);
  form.elements.financeComment.value = item.financeComment || "";
  $("#finance-dialog").showModal();
}

function findFolderFileByDocument(item, doc) {
  const folders = caseFolders(item);
  if (doc?.documentId) {
    for (let folderIndex = 0; folderIndex < folders.length; folderIndex += 1) {
      const fileIndex = folders[folderIndex].files.findIndex((file) => file.documentId === doc.documentId);
      if (fileIndex >= 0) return { folder: folders[folderIndex], folderIndex, file: folders[folderIndex].files[fileIndex], fileIndex };
    }
  }
  for (let folderIndex = 0; folderIndex < folders.length; folderIndex += 1) {
    const fileIndex = folders[folderIndex].files.findIndex((file) => file.name === doc?.name);
    if (fileIndex >= 0) return { folder: folders[folderIndex], folderIndex, file: folders[folderIndex].files[fileIndex], fileIndex };
  }
  return null;
}

function getDocumentPayload(caseId, encoded) {
  const item = caseById(caseId);
  const [source, first, second] = encoded.split(":");
  if (source === "procedural") {
    const docIndex = Number(first);
    return { item, source, docIndex, doc: item.documents[docIndex], linked: findFolderFileByDocument(item, item.documents[docIndex]) };
  }
  const folderIndex = Number(first);
  const fileIndex = Number(second);
  const folder = caseFolders(item)[folderIndex];
  const file = folder?.files[fileIndex];
  const docIndex = file?.documentId
    ? item.documents.findIndex((doc) => doc.documentId === file.documentId)
    : item.documents.findIndex((doc) => doc.name === file?.name);
  return { item, source, folderIndex, fileIndex, folder, file, docIndex, doc: item.documents[docIndex] };
}

function openStoredDocument(documentData) {
  if (!documentData) return;
  if (documentData.url) {
    window.open(documentData.url, "_blank", "noopener");
    return;
  }
  if (documentData.fileObject) {
    window.open(URL.createObjectURL(documentData.fileObject), "_blank", "noopener");
    return;
  }
  showToast(`Для документа «${documentData.name}» пока нет файла или ссылки.`, "warning");
}

function openDocumentDialog(caseId, editContext = null) {
  const form = $("#document-form");
  form.reset();
  form.elements.caseId.value = caseId;
  const item = caseById(caseId);
  $("#document-folder").innerHTML = [
    ...caseFolders(item).map((folder, index) => `<option value="${index}">${folder.name}</option>`),
    `<option value="__new__">+ Создать новую папку</option>`
  ].join("");
  form.elements.editSource.value = "";
  form.elements.docIndex.value = "";
  form.elements.folderIndex.value = "";
  form.elements.fileIndex.value = "";
  $("#document-dialog-title").textContent = "Новий документ";
  $("#document-submit-button").textContent = "Додати документ";

  if (editContext) {
    const data = editContext.file || editContext.doc;
    const linked = editContext.linked || (editContext.doc ? findFolderFileByDocument(item, editContext.doc) : null);
    form.elements.editSource.value = editContext.source;
    form.elements.docIndex.value = editContext.docIndex ?? "";
    form.elements.folderIndex.value = editContext.folderIndex ?? linked?.folderIndex ?? "";
    form.elements.fileIndex.value = editContext.fileIndex ?? linked?.fileIndex ?? "";
    form.elements.name.value = data?.name || "";
    form.elements.url.value = data?.url || "";
    form.elements.type.value = data?.type || "Інше";
    form.elements.submitted.value = parseDisplayDate(data?.submitted);
    form.elements.responseDue.value = parseDisplayDate(data?.responseDue);
    form.elements.status.value = data?.status || "Чернетка";
    form.elements.comment.value = data?.comment || "";
    form.elements.folder.value = String(editContext.folderIndex ?? linked?.folderIndex ?? 0);
    $("#document-dialog-title").textContent = "Редагувати документ";
    $("#document-submit-button").textContent = "Зберегти документ";
  }
  $("#document-dialog").showModal();
}

function openTaskDialog(caseId, taskIndex = null, returnView = null) {
  const form = $("#task-form");
  form.reset();
  form.dataset.originalCaseId = caseId || "";
  $("#task-case-select").innerHTML = state.cases.map((item) => `<option value="${item.id}">№${item.id} · ${item.title}</option>`).join("");
  form.elements.caseId.value = caseId;
  form.elements.taskIndex.value = "";
  state.taskDialogReturnView = returnView || ($("#tasks")?.classList.contains("active") ? "tasks" : "cases");
  form.elements.showInCalendar.checked = true;
  $("#task-dialog-title").textContent = "Нова задача";
  $("#task-submit-button").textContent = "Додати задачу";
  if (taskIndex !== null) {
    const task = caseById(caseId)?.tasks[taskIndex];
    if (!task) return;
    form.elements.taskIndex.value = taskIndex;
    form.elements.title.value = task.title;
    form.elements.status.value = task.status;
    form.elements.responsible.value = task.responsible || caseById(caseId)?.responsible || "Іваненко А.Ю.";
    form.elements.due.value = parseDisplayDate(task.due);
    form.elements.showInCalendar.checked = Boolean(task.showInCalendar);
    $("#task-dialog-title").textContent = "Редагувати задачу";
    $("#task-submit-button").textContent = "Зберегти задачу";
  }
  $("#task-dialog").showModal();
}

function openEventDialog(context = {}, actionIndex = null) {
  const form = $("#event-form");
  form.reset();
  $("#event-client").innerHTML = state.clients.map((client) => `<option value="${client.id}">${client.name}</option>`).join("");
  $("#event-case").innerHTML = state.cases.map((item) => `<option value="${item.id}">№${item.id} · ${item.title}</option>`).join("");
  form.elements.caseId.value = context.caseId || state.selectedCaseId || state.cases[0]?.id || "";
  form.elements.actionIndex.value = "";
  form.elements.eventId.value = "";
  $("#event-dialog h2").textContent = "Нова подія";
  if (context.clientId) {
    form.elements.client.value = context.clientId;
  } else {
    const selectedCase = caseById(form.elements.caseId.value);
    if (selectedCase) form.elements.client.value = selectedCase.clientId;
  }
  if (context.eventId) {
    const sourceEvent = calendarEntries().find((item) => item.id === context.eventId);
    if (!sourceEvent || sourceEvent.source === "task") return;
    const meta = calendarEventMeta(sourceEvent);
    form.elements.eventId.value = sourceEvent.id;
    form.elements.title.value = sourceEvent.title || "";
    form.elements.type.value = sourceEvent.type || "Судове засідання";
    form.elements.date.value = sourceEvent.date || "";
    form.elements.time.value = sourceEvent.time || "09:00";
    form.elements.endTime.value = meta.endTime || "";
    form.elements.status.value = sourceEvent.status || "Заплановано";
    form.elements.client.value = sourceEvent.clientId;
    form.elements.caseId.value = sourceEvent.caseId;
    form.elements.authority.value = sourceEvent.authority || "";
    form.elements.location.value = sourceEvent.location || "";
    form.elements.responsible.value = meta.responsible;
    form.elements.recurrence.value = meta.recurrence;
    form.elements.reminderBefore.value = meta.reminderBefore;
    form.elements.reminderChannels.value = meta.reminderChannels;
    form.elements.reminderRecipients.value = meta.reminderRecipients;
    form.elements.description.value = sourceEvent.description || "";
    $("#event-dialog h2").textContent = "Редагувати подію";
  }
  if (actionIndex !== null && context.caseId) {
    const action = caseProceduralItems(caseById(context.caseId))[actionIndex];
    if (!action || Array.isArray(action)) return;
    form.elements.actionIndex.value = actionIndex;
    form.elements.title.value = action.action || "";
    form.elements.date.value = parseDisplayDate(action.initiated);
    form.elements.time.value = action.time || "09:00";
    form.elements.due.value = parseDisplayDate(action.due);
    form.elements.status.value = action.status || "Заплановано";
    form.elements.description.value = action.description || "";
  }
  $("#event-case").onchange = (event) => {
    const selectedCase = caseById(event.currentTarget.value);
    if (selectedCase) form.elements.client.value = selectedCase.clientId;
  };
  $("#event-dialog").showModal();
}

function openFolderDialog(caseId, folderIndex = null) {
  const form = $("#folder-form");
  form.reset();
  form.elements.caseId.value = caseId;
  form.elements.folderIndex.value = "";
  $("#folder-dialog-title").textContent = "Нова папка";
  $("#folder-submit-button").textContent = "Створити папку";
  if (folderIndex !== null) {
    const folder = caseFolders(caseById(caseId))[folderIndex];
    if (!folder) return;
    form.elements.folderIndex.value = folderIndex;
    form.elements.name.value = folder.name;
    $("#folder-dialog-title").textContent = "Редагувати папку";
    $("#folder-submit-button").textContent = "Зберегти папку";
  }
  $("#folder-dialog").showModal();
}

function openDeleteDocumentConfirm(payload) {
  const item = caseById(payload.caseId);
  if (payload.type === "case") {
    if (!item) return;
    state.pendingDocumentDelete = payload;
    $("#delete-document-title").textContent = "Удалить справу?";
    $("#delete-document-text").textContent = `Вы уверены, что хотите удалить справу №${item.id} «${item.title}»?`;
    $("#delete-document-confirm").textContent = "Да, удалить";
    $("#delete-document-dialog").showModal();
    return;
  }
  if (payload.type === "folder") {
    const folder = caseFolders(item)[payload.folderIndex];
    if (!folder) return;
    state.pendingDocumentDelete = payload;
    $("#delete-document-title").textContent = "Удалить папку?";
    $("#delete-document-text").textContent = `Вы уверены, что хотите удалить папку «${folder.name}» и ${folder.files.length} файл(ов) внутри?`;
    $("#delete-document-confirm").textContent = "Да, удалить";
    $("#delete-document-dialog").showModal();
    return;
  }
  if (payload.type === "task") {
    const task = item.tasks[payload.taskIndex];
    if (!task) return;
    state.pendingDocumentDelete = payload;
    $("#delete-document-title").textContent = "Удалить задачу?";
    $("#delete-document-text").textContent = `Вы уверены, что хотите удалить задачу «${task.title}»?`;
    $("#delete-document-confirm").textContent = "Да, удалить";
    $("#delete-document-dialog").showModal();
    return;
  }
  if (payload.type === "proceduralAction") {
    const action = caseProceduralItems(item)[payload.actionIndex];
    if (!action || Array.isArray(action)) return;
    state.pendingDocumentDelete = payload;
    $("#delete-document-title").textContent = "Удалить процессуальную дію?";
    $("#delete-document-text").textContent = `Вы уверены, что хотите удалить процессуальную дію «${action.action}»?`;
    $("#delete-document-confirm").textContent = "Да, удалить";
    $("#delete-document-dialog").showModal();
    return;
  }
  if (payload.type === "calendarEvent") {
    const eventItem = state.events.find((event) => `event-${event.id}` === payload.eventId);
    if (!eventItem) return;
    state.pendingDocumentDelete = payload;
    $("#delete-document-title").textContent = "Удалить подію?";
    $("#delete-document-text").textContent = `Вы уверены, что хотите удалить подію «${eventItem.title}»?`;
    $("#delete-document-confirm").textContent = "Да, удалить";
    $("#delete-document-dialog").showModal();
    return;
  }
  const file = payload.type === "procedural"
    ? item.documents[payload.docIndex]
    : caseFolders(item)[payload.folderIndex]?.files[payload.fileIndex];
  if (!file) return;
  state.pendingDocumentDelete = payload;
  $("#delete-document-title").textContent = "Удалить документ?";
  $("#delete-document-text").textContent = `Вы уверены, что хотите удалить документ «${file.name}»?`;
  $("#delete-document-confirm").textContent = "Да, удалить";
  $("#delete-document-dialog").showModal();
}

function closeDeleteDocumentConfirm() {
  state.pendingDocumentDelete = null;
  $("#delete-document-dialog").close();
}

navNodes.forEach((button) => {
  button.addEventListener("click", () => {
    if (button.dataset.view === "cases") {
      state.caseScreen = "list";
      renderCases();
    }
    switchView(button.dataset.view);
  });
});

$("#topbar-back")?.addEventListener("click", goBack);

document.addEventListener("click", (event) => {
  if (event.target.closest("#notifications-toggle")) {
    event.preventDefault();
    event.stopPropagation();
    toggleTopbarPanel("#notifications-toggle", "#notifications-menu");
    return;
  }
  if (event.target.closest("#admin-profile-toggle")) {
    event.preventDefault();
    event.stopPropagation();
    toggleTopbarPanel("#admin-profile-toggle", "#admin-profile-menu");
  }
});

document.querySelectorAll("[data-notification-view]").forEach((button) => {
  button.addEventListener("click", () => {
    markNotificationRead();
    closeTopbarPanels();
    switchView(button.dataset.notificationView);
    showToast("Відкрито розділ зі сповіщення.");
  });
});

$("[data-clear-notifications]")?.addEventListener("click", () => {
  const badge = $("#notifications-count");
  if (badge) {
    badge.textContent = "0";
    badge.classList.add("empty");
  }
  closeTopbarPanels();
  showToast("Сповіщення позначено як прочитані.");
});

document.querySelectorAll("[data-profile-action]").forEach((button) => {
  button.addEventListener("click", () => {
    const action = button.dataset.profileAction;
    closeTopbarPanels();
    if (action === "settings") {
      switchView("settings");
      return;
    }
    if (action === "team") {
      switchView("settings");
      showToast("Розділ користувачів відкривається в налаштуваннях.");
      return;
    }
    if (action === "demo-link") {
      copyDemoLink();
      return;
    }
    if (action === "open-demo") {
      window.open(DEMO_URL, "_blank", "noopener");
      return;
    }
    if (action === "compact") {
      toggleSidebar();
      return;
    }
    showToast("Вихід з акаунта показано як прототипну дію.", "warning");
  });
});

$(".collapse-menu")?.addEventListener("click", toggleSidebar);
$(".sidebar-restore")?.addEventListener("click", toggleSidebar);

document.addEventListener("click", (event) => {
  if (!event.target.closest(".topbar-menu-wrap")) closeTopbarPanels();
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  const topbarPanelOpen = Boolean(document.querySelector(".topbar-panel:not([hidden])"));
  if (topbarPanelOpen) {
    event.preventDefault();
    closeTopbarPanels();
    return;
  }
  if (event.target?.closest?.("input, textarea, select, dialog")) return;
  if (!state.viewHistory.length && !hasInternalBack()) return;
  event.preventDefault();
  goBack();
});

$("#quick-add-client")?.addEventListener("click", () => openClientDialog());

$("#client-dialog-close").addEventListener("click", () => {
  $("#client-dialog").close();
});

$("#case-dialog-close").addEventListener("click", () => {
  $("#case-dialog").close();
});

$("#essence-dialog-close").addEventListener("click", () => {
  $("#essence-dialog").close();
});

$("#authority-dialog-close").addEventListener("click", () => {
  $("#authority-dialog").close();
});

$("#finance-dialog-close").addEventListener("click", () => {
  $("#finance-dialog").close();
});

$("#document-dialog-close").addEventListener("click", () => {
  $("#document-dialog").close();
});

$("#task-dialog-close").addEventListener("click", () => {
  $("#task-dialog").close();
});

$("#event-dialog-close").addEventListener("click", () => {
  $("#event-dialog").close();
});

$("#folder-dialog-close").addEventListener("click", () => {
  $("#folder-dialog").close();
});

$("#delete-document-close").addEventListener("click", closeDeleteDocumentConfirm);
$("#delete-document-cancel").addEventListener("click", closeDeleteDocumentConfirm);
$("#delete-document-confirm").addEventListener("click", () => {
  const pending = state.pendingDocumentDelete;
  if (!pending) return;
  const item = caseById(pending.caseId);
  const today = new Date().toLocaleDateString("uk-UA");
  let deleted;
  if (pending.type === "case") {
    const caseIndex = state.cases.findIndex((caseItem) => caseItem.id === pending.caseId);
    deleted = state.cases.splice(caseIndex, 1)[0];
    state.selectedCaseId = state.cases[0]?.id || "";
    state.caseScreen = "list";
  } else if (pending.type === "procedural") {
    deleted = item.documents.splice(pending.docIndex, 1)[0];
  } else if (pending.type === "folder") {
    const folders = caseFolders(item);
    deleted = folders.splice(pending.folderIndex, 1)[0];
    const deletedIds = new Set((deleted?.files || []).map((file) => file.documentId).filter(Boolean));
    if (deletedIds.size) {
      item.documents = item.documents.filter((doc) => !deletedIds.has(doc.documentId));
    }
    if (state.openFolderIndex === pending.folderIndex) {
      state.openFolderIndex = null;
    } else if (state.openFolderIndex > pending.folderIndex) {
      state.openFolderIndex -= 1;
    }
  } else if (pending.type === "task") {
    deleted = item.tasks.splice(pending.taskIndex, 1)[0];
  } else if (pending.type === "proceduralAction") {
    item.proceduralActions = caseProceduralItems(item);
    deleted = item.proceduralActions.splice(pending.actionIndex, 1)[0];
  } else if (pending.type === "calendarEvent") {
    const eventIndex = state.events.findIndex((event) => `event-${event.id}` === pending.eventId);
    deleted = state.events.splice(eventIndex, 1)[0];
    state.selectedEventId = calendarEntries()[0]?.id || "";
  } else {
    const folder = caseFolders(item)[pending.folderIndex];
    deleted = folder.files.splice(pending.fileIndex, 1)[0];
    folder.updated = today;
  }
  if (pending.type !== "case" && pending.type !== "calendarEvent") {
    item.history.unshift({
      date: today,
      text: pending.type === "folder"
        ? `Видалено папку документів: ${deleted.name}.`
        : pending.type === "task"
          ? `Видалено задачу: ${deleted.title}.`
          : pending.type === "proceduralAction"
            ? `Видалено процесуальну дію: ${deleted.action}.`
          : `Видалено документ: ${deleted.name}.`
    });
  }
  const returnView = pending.returnView || "cases";
  state.pendingDocumentDelete = null;
  $("#delete-document-dialog").close();
  renderAll();
  switchView(returnView);
  showToast(pending.type === "case" ? "Справу видалено." : pending.type === "calendarEvent" ? "Подію видалено з календаря." : "Елемент видалено.", "danger");
});

$("#client-form").addEventListener("submit", (event) => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const clientId = form.get("clientId");

  if (clientId) {
    const stayInCases = $("#cases")?.classList.contains("active") && state.caseScreen === "detail";
    const client = clientById(clientId);
    client.name = form.get("name");
    client.phone = form.get("phone");
    client.email = form.get("email");
    client.address = form.get("address");
    client.request = form.get("request");
    client.status = form.get("status");
    client.telegramUsername = form.get("telegramUsername");
    client.telegram = Boolean(form.get("telegramUsername"));
    client.consent = form.get("status") !== "Не турбувати";
    client.manager = form.get("manager");
    client.source = form.get("source");
    client.lastContact = new Date().toLocaleDateString("uk-UA");
    client.communications = [
      {
        date: new Date().toLocaleDateString("uk-UA"),
        channel: "CRM",
        title: "Дані клієнта оновлено",
        status: "Оновлено"
      },
      ...client.communications
    ];
    state.selectedClientId = client.id;
    $("#client-dialog").close();
    renderAll();
    switchView(stayInCases ? "cases" : "clients");
    showToast("Дані клієнта оновлено.");
    return;
  }

  const nextId = Math.max(...state.clients.map((client) => client.id)) + 1;
  state.clients.push({
    id: nextId,
    name: form.get("name"),
    phone: form.get("phone"),
    email: form.get("email"),
    address: form.get("address"),
    request: form.get("request"),
    status: form.get("status"),
    telegram: Boolean(form.get("telegramUsername")),
    telegramUsername: form.get("telegramUsername"),
    clientType: "Фізична особа",
    consent: form.get("status") !== "Не турбувати",
    manager: form.get("manager"),
    source: form.get("source"),
    added: new Date().toLocaleDateString("uk-UA"),
    lastContact: new Date().toLocaleDateString("uk-UA"),
    nextAction: "Провести первинну консультацію",
    risk: "Середній",
    notes: "Клієнт доданий вручну. Потрібно уточнити документи, згоду на розсилку та створити справу.",
    communications: [
      { date: new Date().toLocaleDateString("uk-UA"), channel: "CRM", title: "Клієнт доданий до бази", status: "Створено" }
    ]
  });
  state.selectedClientId = nextId;
  $("#client-dialog").close();
  renderAll();
  switchView("clients");
  showToast("Клієнта додано до бази.");
});

$("#case-form").addEventListener("submit", (event) => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const caseId = form.get("caseId");
  const deadline = form.get("deadline");

  if (caseId) {
    const item = caseById(caseId);
    item.clientId = Number(form.get("clientId"));
    item.title = form.get("title");
    item.type = form.get("type");
    item.stage = form.get("stage") || "Первинна консультація";
    item.status = form.get("status");
    item.priority = form.get("priority");
    item.responsible = form.get("responsible");
    item.deadline = deadline ? formatDate(deadline) : "Не вказано";
    item.history.unshift({
      date: new Date().toLocaleDateString("uk-UA"),
      text: "Дані справи оновлено."
    });
    state.selectedCaseId = item.id;
    state.caseScreen = "list";
    $("#case-dialog").close();
    renderAll();
    switchView("cases");
    showToast("Справу оновлено.");
    return;
  }

  const currentYear = new Date().getFullYear();
  const nextNumber = String(state.cases.length + 1112).padStart(4, "0");
  const nextId = `${currentYear}/${nextNumber}`;
  const newCase = {
    id: nextId,
    clientId: Number(form.get("clientId")),
    title: form.get("title"),
    type: form.get("type"),
    status: form.get("status"),
    stage: form.get("stage") || "Первинна консультація",
    priority: form.get("priority"),
    responsible: form.get("responsible"),
    court: "Не вказано",
    authorityType: "",
    authorityAddress: "",
    authorityContact: "",
    opened: new Date().toLocaleDateString("uk-UA"),
    deadline: deadline ? formatDate(deadline) : "Не вказано",
    debt: 0,
    income: 0,
    description: "Опис справи буде додано пізніше.",
    documents: [],
    proceduralActions: [],
    folders: [],
    tasks: [],
    history: [
      {
        date: new Date().toLocaleDateString("uk-UA"),
        text: "Справу створено в CRM."
      }
    ]
  };
  state.cases.unshift(newCase);
  state.selectedCaseId = newCase.id;
  state.caseScreen = "detail";
  $("#case-dialog").close();
  renderAll();
  switchView("cases");
  showToast("Нову справу створено.");
});

$("#essence-form").addEventListener("submit", (event) => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const item = caseById(form.get("caseId"));
  if (!item) return;
  item.description = form.get("description") || "Опис справи буде додано пізніше.";
  item.history.unshift({
    date: new Date().toLocaleDateString("uk-UA"),
    text: "Оновлено суть справи."
  });
  state.selectedCaseId = item.id;
  state.caseScreen = "detail";
  $("#essence-dialog").close();
  renderAll();
  switchView("cases");
  showToast("Суть справи збережено.");
});

$("#authority-form").addEventListener("submit", (event) => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const item = caseById(form.get("caseId"));
  if (!item) return;
  item.court = form.get("court") || "Не вказано";
  item.authorityType = form.get("authorityType") || "";
  item.authorityAddress = form.get("authorityAddress") || "";
  item.authorityContact = form.get("authorityContact") || "";
  item.history.unshift({
    date: new Date().toLocaleDateString("uk-UA"),
    text: "Оновлено орган звернення по справі."
  });
  state.selectedCaseId = item.id;
  state.caseScreen = "detail";
  $("#authority-dialog").close();
  renderAll();
  switchView("cases");
  showToast("Орган звернення збережено.");
});

$("#finance-form").addEventListener("submit", (event) => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const item = caseById(form.get("caseId"));
  if (!item) return;
  const total = moneyValue(form.get("totalFee"));
  const paid = Math.min(moneyValue(form.get("paid")), total);
  const firstPaymentDate = form.get("firstPaymentDate");
  const nextPaymentDue = form.get("nextPaymentDue");
  item.totalFee = total;
  item.income = total;
  item.paid = paid;
  item.debt = Math.max(total - paid, 0);
  item.firstPaymentDate = firstPaymentDate ? formatDate(firstPaymentDate) : "";
  item.nextPaymentDue = nextPaymentDue ? formatDate(nextPaymentDue) : "";
  item.financeComment = form.get("financeComment") || "";
  item.history.unshift({
    date: new Date().toLocaleDateString("uk-UA"),
    text: `Оновлено фінанси справи: сума ${currency(total)}, оплачено ${currency(paid)}, борг ${currency(item.debt)}.`
  });
  state.selectedCaseId = item.id;
  $("#finance-dialog").close();
  renderAll();
  switchView("cases");
  showToast("Фінанси справи оновлено.");
});

$("#document-form").addEventListener("submit", (event) => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const item = caseById(form.get("caseId"));
  const file = form.get("file");
  const fileName = file && file.name ? file.name : "";
  const url = form.get("url");
  const name = form.get("name") || fileName || "Новий документ";
  const today = new Date().toLocaleDateString("uk-UA");
  const folders = caseFolders(item);
  const selectedFolder = form.get("folder");
  const editSource = form.get("editSource");
  const source = fileName && url ? "Файл + Google посилання" : fileName ? "Файл з комп'ютера" : url ? "Google посилання" : "Опис без файлу";
  const submitted = form.get("submitted") ? formatDate(form.get("submitted")) : "-";
  const responseDue = form.get("responseDue") ? formatDate(form.get("responseDue")) : "-";

  if (editSource) {
    const docIndex = form.get("docIndex") === "" ? -1 : Number(form.get("docIndex"));
    const folderIndex = form.get("folderIndex") === "" ? -1 : Number(form.get("folderIndex"));
    const fileIndex = form.get("fileIndex") === "" ? -1 : Number(form.get("fileIndex"));
    const doc = item.documents[docIndex];
    const linked = doc ? findFolderFileByDocument(item, doc) : null;
    const folderFile = folderIndex >= 0 ? folders[folderIndex]?.files[fileIndex] : linked?.file;
    const documentId = doc?.documentId || folderFile?.documentId || makeDocumentId();
    const previousFileName = doc?.fileName || folderFile?.fileName || "";
    const previousFileObject = doc?.fileObject || folderFile?.fileObject || null;
    const previousUrl = doc?.url || folderFile?.url || "";
    const nextFileName = fileName || previousFileName;
    const nextFileObject = fileName ? file : previousFileObject;
    const nextUrl = url || previousUrl;
    const nextSource = fileName
      ? (nextUrl ? "Файл + Google посилання" : "Файл з комп'ютера")
      : nextUrl
        ? (nextFileName ? "Файл + Google посилання" : "Google посилання")
        : "Опис без файлу";
    const update = (target) => {
      if (!target) return;
      target.documentId = documentId;
      target.name = name;
      target.type = form.get("type");
      target.status = form.get("status");
      target.submitted = submitted;
      target.responseDue = responseDue;
      target.comment = form.get("comment");
      target.fileName = nextFileName;
      target.fileObject = nextFileObject;
      target.url = nextUrl;
      target.source = nextSource;
      target.updated = today;
    };
    update(doc);
    update(folderFile);
    if (doc) {
      doc.added = doc.added || today;
    }
    if (folderFile) {
      const changedFolder = folders[folderIndex] || linked?.folder;
      if (changedFolder) changedFolder.updated = today;
    }
    item.history.unshift({
      date: today,
      text: `Оновлено документ: ${name}.`
    });
    state.selectedCaseId = item.id;
    $("#document-dialog").close();
    renderAll();
    switchView("cases");
    showToast("Документ оновлено.");
    return;
  }

  let targetFolder = folders[Number(selectedFolder)] || folders[0];
  if (selectedFolder === "__new__") {
    const folderName = form.get("newFolderName") || "Нова папка";
    targetFolder = { name: folderName, updated: today, files: [] };
    folders.push(targetFolder);
    state.openFolderIndex = folders.length - 1;
  } else {
    state.openFolderIndex = Number(selectedFolder);
  }
  const documentId = makeDocumentId();
  item.documents.unshift({
    documentId,
    name,
    type: form.get("type"),
    status: form.get("status"),
    submitted,
    responseDue,
    comment: form.get("comment"),
    fileName,
    fileObject: fileName ? file : null,
    url,
    source,
    added: today
  });
  targetFolder.files.unshift({
    documentId,
    name,
    type: form.get("type"),
    status: form.get("status"),
    submitted,
    responseDue,
    comment: form.get("comment"),
    updated: today,
    fileName,
    fileObject: fileName ? file : null,
    url
  });
  targetFolder.updated = today;
  item.history.unshift({
    date: today,
    text: `Додано документ: ${name} у папку «${targetFolder.name}».`
  });
  state.selectedCaseId = item.id;
  state.openCaseSection = "documents";
  $("#document-dialog").close();
  renderAll();
  switchView("cases");
  showToast("Документ додано до справи.");
});

$("#task-form").addEventListener("submit", (event) => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const taskIndex = form.get("taskIndex") === "" ? null : Number(form.get("taskIndex"));
  const item = caseById(taskIndex !== null ? event.currentTarget.dataset.originalCaseId : form.get("caseId"));
  const due = form.get("due");
  const title = form.get("title");
  if (taskIndex !== null) {
    const task = item.tasks[taskIndex];
    if (!task) return;
    task.title = title;
    task.status = form.get("status");
    task.responsible = form.get("responsible");
    task.due = due ? formatDate(due) : "Не вказано";
    task.showInCalendar = Boolean(form.get("showInCalendar") && due);
    item.history.unshift({
      date: new Date().toLocaleDateString("uk-UA"),
      text: `Оновлено задачу: ${title}.`
    });
    state.selectedCaseId = item.id;
    $("#task-dialog").close();
    renderAll();
    switchView(state.taskDialogReturnView || "cases");
    showToast("Задачу оновлено.");
    return;
  }
  item.tasks.unshift({
    title,
    status: form.get("status"),
    responsible: form.get("responsible"),
    due: due ? formatDate(due) : "Не вказано",
    showInCalendar: Boolean(form.get("showInCalendar") && due)
  });
  item.history.unshift({
    date: new Date().toLocaleDateString("uk-UA"),
    text: `Додано задачу: ${title}.`
  });
  state.selectedCaseId = item.id;
  state.openCaseSection = "tasks";
  $("#task-dialog").close();
  renderAll();
  switchView(state.taskDialogReturnView || "cases");
  showToast("Задачу додано.");
});

$("#folder-form").addEventListener("submit", (event) => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const item = caseById(form.get("caseId"));
  const name = form.get("name");
  const folderIndex = form.get("folderIndex") === "" ? null : Number(form.get("folderIndex"));
  const folders = caseFolders(item);
  const today = new Date().toLocaleDateString("uk-UA");
  if (folderIndex !== null) {
    const folder = folders[folderIndex];
    if (!folder) return;
    const previousName = folder.name;
    folder.name = name;
    folder.updated = today;
    item.history.unshift({
      date: today,
      text: `Папку документів перейменовано: ${previousName} → ${name}.`
    });
    state.selectedCaseId = item.id;
    $("#folder-dialog").close();
    renderAll();
    switchView("cases");
    showToast("Папку перейменовано.");
    return;
  }
  folders.push({
    name,
    updated: today,
    files: []
  });
  item.history.unshift({
    date: today,
    text: `Створено папку документів: ${name}.`
  });
  state.selectedCaseId = item.id;
  $("#folder-dialog").close();
  renderAll();
  switchView("cases");
  showToast("Папку створено.");
});

$("#event-form").addEventListener("submit", (event) => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const date = form.get("date");
  const due = form.get("due");
  const eventId = form.get("eventId");
  const actionIndex = form.get("actionIndex") === "" ? null : Number(form.get("actionIndex"));
  const nextId = Math.max(...state.events.map((item) => item.id)) + 1;
  const selectedCaseId = form.get("caseId");
  const caseItem = selectedCaseId ? caseById(selectedCaseId) : state.cases.find((item) => item.clientId === Number(form.get("client"))) || state.cases[0];
  const status = form.get("status") || "Заплановано";
  if (eventId) {
    const target = state.events.find((item) => `event-${item.id}` === eventId);
    if (!target) return;
    target.day = Number(date.split("-")[2]);
    target.date = date;
    target.time = form.get("time");
    target.endTime = form.get("endTime");
    target.title = form.get("title");
    target.type = form.get("type");
    target.clientId = Number(form.get("client"));
    target.caseId = caseItem.id;
    target.authority = form.get("authority");
    target.location = form.get("location");
    target.responsible = form.get("responsible");
    target.recurrence = form.get("recurrence");
    target.reminderBefore = form.get("reminderBefore");
    target.reminderChannels = form.get("reminderChannels");
    target.reminderRecipients = form.get("reminderRecipients");
    target.description = form.get("description");
    target.status = status;
    state.selectedEventId = eventId;
    state.selectedCaseId = caseItem.id;
    $("#event-dialog").close();
    renderAll();
    switchView("calendar");
    showToast("Подію календаря оновлено.");
    return;
  }
  if (selectedCaseId && actionIndex !== null) {
    caseItem.proceduralActions = caseProceduralItems(caseItem);
    const action = caseItem.proceduralActions[actionIndex];
    if (!action) return;
    action.action = form.get("title");
    action.initiator = form.get("responsible") || "Адвокат";
    action.initiated = formatDate(date);
    action.time = form.get("time");
    action.due = due ? formatDate(due) : `${formatDate(date)} ${form.get("time")}`;
    action.status = status;
    action.tone = status === "Заплановано" ? "blue" : status === "В процесі" ? "amber" : "";
    action.description = form.get("description");
    caseItem.history.unshift({
      date: new Date().toLocaleDateString("uk-UA"),
      text: `Оновлено процесуальну дію: ${form.get("title")}.`
    });
    state.selectedCaseId = caseItem.id;
    $("#event-dialog").close();
    renderAll();
    switchView("cases");
    showToast("Процесуальну дію оновлено.");
    return;
  }
  state.events.push({
    id: nextId,
    day: Number(date.split("-")[2]),
    date,
    time: form.get("time"),
    endTime: form.get("endTime"),
    title: form.get("title"),
    type: form.get("type"),
    clientId: Number(form.get("client")),
    caseId: caseItem.id,
    authority: form.get("authority"),
    location: form.get("location"),
    responsible: form.get("responsible"),
    recurrence: form.get("recurrence"),
    reminderBefore: form.get("reminderBefore"),
    reminderChannels: form.get("reminderChannels"),
    reminderRecipients: form.get("reminderRecipients"),
    reminderLog: [],
    description: form.get("description"),
    status
  });
  if (selectedCaseId) {
    caseItem.proceduralActions = caseProceduralItems(caseItem);
    caseItem.proceduralActions.unshift({
      action: form.get("title"),
      initiator: form.get("responsible") || "Адвокат",
      initiated: formatDate(date),
      time: form.get("time"),
      due: due ? formatDate(due) : `${formatDate(date)} ${form.get("time")}`,
      status,
      tone: semanticTone(status),
      description: form.get("description")
    });
    caseItem.history.unshift({
      date: new Date().toLocaleDateString("uk-UA"),
      text: `Додано процесуальну дію: ${form.get("title")}.`
    });
  }
  state.selectedEventId = `event-${nextId}`;
  state.selectedCaseId = caseItem.id;
  state.openCaseSection = "events";
  $("#event-dialog").close();
  renderAll();
  switchView(selectedCaseId ? "cases" : "calendar");
  showToast(selectedCaseId ? "Процесуальну дію додано." : "Подію додано до календаря.");
});

$("#global-search")?.addEventListener("input", (event) => {
  const value = event.target.value.trim();
  if (!value) return;
  switchView("clients");
  setTimeout(() => {
    const filter = $("#client-filter");
    if (filter) {
      filter.value = value;
      renderClientRows();
    }
  }, 0);
});

restoreNavigationState();
renderAll();
switchView(state.currentView || "dashboard", { skipHistory: true });
