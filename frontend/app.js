import { createInitialState } from "./js/state.js";
import {
  closeTopbarPanels as closeTopbarPanelsInChrome,
  isTopbarPanelOpen,
  setupTopbarControls
} from "./js/chrome.js";
import { createDialogOpeners } from "./js/dialog-openers.js";
import { setupDialogControls } from "./js/dialogs.js";
import { setupCaseDetailForms } from "./js/forms/case-details.js";
import { setupCaseItemForms } from "./js/forms/case-items.js";
import { setupCaseForm } from "./js/forms/cases.js";
import { setupClientForm } from "./js/forms/clients.js";
import { setupDocumentForm } from "./js/forms/documents.js";
import { setupEventForm } from "./js/forms/events.js";
import {
  restoreNavigationState as restoreNavigationStateFromStorage,
  saveNavigationState as saveNavigationStateToStorage
} from "./js/navigation.js";
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
import { renderDashboardScreen } from "./js/screens/dashboard.js";
import { renderDocumentsScreen } from "./js/screens/documents.js";
import {
  renderMailingsScreen,
  setMailingTab as setMailingTabScreen
} from "./js/screens/mailings.js";
import { renderFinanceScreen } from "./js/screens/finance.js";
import { renderOSINTScreen } from "./js/screens/osint.js";
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
  closeTopbarPanelsInChrome($);
}

function clientById(id) {
  return state.clients.find((client) => client.id === Number(id));
}

function caseById(id) {
  return state.cases.find((item) => item.id === id);
}

const {
  openClientDialog,
  parseDisplayDate,
  openCaseDialog,
  openEssenceDialog,
  openAuthorityDialog,
  openFinanceDialog,
  findFolderFileByDocument,
  getDocumentPayload,
  openStoredDocument,
  openDocumentDialog,
  openTaskDialog,
  openEventDialog,
  openFolderDialog,
  openDeleteDocumentConfirm
} = createDialogOpeners({
  state,
  $,
  clientById,
  caseById,
  caseFinance,
  caseFolders,
  caseProceduralItems,
  calendarEntries,
  calendarEventMeta,
  showToast
});

function screenContext() {
  return {
    state,
    $,
    icon,
    badge,
    riskTone,
    statusTone,
    semanticTone,
    formatDate,
    currency,
    currencyText,
    caseFinance,
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
    caseFolders,
    findFolderFileByDocument,
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
  renderDashboardScreen(screenContext());
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
  renderOSINTScreen(screenContext());
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
  saveNavigationStateToStorage({ state });
}

function restoreNavigationState() {
  restoreNavigationStateFromStorage({ state, caseById });
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
  $("#page-eyebrow").textContent = view === "tasks"
    ? "Управління задачами та контроль виконання"
    : view === "planner"
      ? "Ваш план на день, синхронізований із календарем та справами"
      : "Юридичне бюро";
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
    const visible = state.currentView !== "dashboard" || state.viewHistory.length > 0 || hasInternalBack();
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
  if (!state.viewHistory.length && state.currentView !== "dashboard") return "Назад к разделу: Дашборд";
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

setupTopbarControls({ $, switchView, saveNavigationState, showToast });

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (isTopbarPanelOpen()) {
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

setupDialogControls({
  state,
  $,
  caseById,
  caseFolders,
  caseProceduralItems,
  calendarEntries,
  renderAll,
  switchView,
  showToast
});

setupClientForm({ state, $, clientById, renderAll, switchView, showToast });
setupCaseForm({ state, $, caseById, formatDate, renderAll, switchView, showToast });
setupCaseDetailForms({ state, $, caseById, formatDate, currency, renderAll, switchView, showToast });
setupDocumentForm({
  state,
  $,
  caseById,
  caseFolders,
  findFolderFileByDocument,
  makeDocumentId,
  formatDate,
  renderAll,
  switchView,
  showToast
});
setupCaseItemForms({ state, $, caseById, caseFolders, formatDate, renderAll, switchView, showToast });
setupEventForm({ state, $, caseById, caseProceduralItems, formatDate, semanticTone, renderAll, switchView, showToast });

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
