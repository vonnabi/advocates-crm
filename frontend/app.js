import { createInitialState } from "./js/state.js?v=calendar-time-1";
import {
  closeTopbarPanels as closeTopbarPanelsInChrome,
  isTopbarPanelOpen,
  setupTopbarControls,
  syncTopbarNotifications
} from "./js/chrome.js?v=preserve-manual-demo-1";
import { createDialogOpeners } from "./js/dialog-openers.js?v=document-delete-path-3";
import { setupDialogControls } from "./js/dialogs.js?v=document-delete-path-3";
import { setupCaseDetailForms } from "./js/forms/case-details.js?v=finance-operation-menu-1";
import { setupCaseItemForms } from "./js/forms/case-items.js";
import { setupCaseForm } from "./js/forms/cases.js";
import { setupClientForm } from "./js/forms/clients.js";
import { setupDocumentForm } from "./js/forms/documents.js?v=document-target-mode-1";
import { setupEventForm } from "./js/forms/events.js?v=event-reminder-toggle-1";
import {
  restoreNavigationState as restoreNavigationStateFromStorage,
  saveNavigationState as saveNavigationStateToStorage
} from "./js/navigation.js";
import { renderAIScreen } from "./js/screens/ai.js";
import { renderAnalyticsScreen } from "./js/screens/analytics.js?v=live-demo-1";
import {
  caseFinance,
  caseFolders,
  caseProceduralItems,
  renderCaseListScreen,
  renderCaseProfileScreen,
  renderCasesScreen
} from "./js/screens/cases.js?v=context-task-case-2";
import {
  calendarEntries as calendarEntriesScreen,
  calendarEventMeta as calendarEventMetaScreen,
  calendarEventTypes as calendarEventTypesScreen,
  calendarStatuses as calendarStatusesScreen,
  renderCalendarScreen
} from "./js/screens/calendar.js?v=calendar-task-time-1";
import {
  renderClientProfile as renderClientProfileScreen,
  renderClientRows as renderClientRowsScreen,
  renderClientsScreen
} from "./js/screens/clients.js?v=clients-filter-1";
import { renderDashboardScreen } from "./js/screens/dashboard.js?v=live-demo-1";
import { renderDocumentsScreen } from "./js/screens/documents.js?v=document-delete-path-3";
import {
  renderMailingsScreen,
  setMailingTab as setMailingTabScreen
} from "./js/screens/mailings.js?v=modal-select-audit-1";
import { renderFinanceScreen } from "./js/screens/finance.js?v=finance-pagination-2";
import { renderOSINTScreen } from "./js/screens/osint.js?v=live-demo-1";
import { renderPlannerScreen } from "./js/screens/planner.js";
import { renderSettingsScreen } from "./js/screens/settings.js?v=empty-audit-1";
import {
  allCaseTasks as allCaseTasksScreen,
  renderTasksScreen
} from "./js/screens/tasks.js?v=empty-kpi-2";
import {
  addDays,
  actionMenu,
  advocatePhoto,
  badge,
  bindActionMenus,
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
  navIconName,
  riskTone,
  semanticTone,
  statusTone,
  taskTone,
  todayIso,
  weekDayNames
} from "./js/ui.js?v=document-archive-books-1";

const state = await createInitialState();
document.documentElement.dataset.dataSource = state.dataSource || "json";

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

function syncSidebarNavIcons() {
  navNodes.forEach((node) => {
    const holder = node.querySelector(".nav-icon");
    if (!holder) return;
    holder.innerHTML = icon(navIconName(node.dataset.view));
  });
}

syncSidebarNavIcons();

const defaultPermissions = {
  canManageUsers: true,
  canSeeFinance: true,
  canManageFinance: true,
  canManageCases: true,
  canManageClients: true,
  canManageTasks: true,
  canManageDocuments: true,
  canManageCalendar: true,
  canManageMailings: true,
  canUseAi: true,
  canViewPlanner: true,
  canViewAnalytics: true,
  canUseOsint: true
};

const viewPermissionMap = {
  cases: "canManageCases",
  clients: "canManageClients",
  calendar: "canManageCalendar",
  tasks: "canManageTasks",
  documents: "canManageDocuments",
  mailings: "canManageMailings",
  ai: "canUseAi",
  planner: "canViewPlanner",
  analytics: "canViewAnalytics",
  finance: "canSeeFinance",
  osint: "canUseOsint",
  settings: "canManageUsers"
};

const permissionControlRules = [
  {
    permission: "canManageClients",
    selectors: [
      "#quick-add-client",
      "#add-client",
      "[data-edit-client-row]",
      "[data-edit-client]",
      "[data-delete-client]",
      "[data-client-bulk-action]",
      "[data-client-communication]"
    ]
  },
  {
    permission: "canManageCases",
    selectors: [
      "#create-case-from-list",
      "#save-case-current",
      "[data-edit-case-row]",
      "[data-delete-case]",
      "[data-case-bulk-action]",
      "[data-edit-case-section]",
      "[data-edit-authority]"
    ]
  },
  {
    permission: "canManageTasks",
    selectors: [
      "[data-add-task]",
      "[data-edit-task]",
      "[data-delete-task]",
      "[data-edit-task-global]",
      "[data-delete-task-global]",
      "[data-edit-subtask-task]",
      "[data-delete-subtask-task]",
      "[data-task-bulk-action]",
      "[data-task-status-pick]",
      "[data-edit-planner-task]",
      "[data-complete-planner-task]",
      "[data-reschedule-planner-task]",
      "[data-important-planner-task]",
      "[data-remove-planner-task]",
      "[data-task-drag]",
      "#task-create-from-section",
      "#add-plan-task",
      "#add-plan-task-bottom"
    ]
  },
  {
    permission: "canManageDocuments",
    selectors: [
      "[data-add-document]",
      "[data-add-folder]",
      "[data-documents-add]",
      "[data-documents-add-current]",
      "[data-documents-add-empty]",
      "[data-documents-add-folder]",
      "[data-documents-edit-folder]",
      "[data-documents-template]",
      "[data-document-status-pick]",
      "[data-document-status-change]",
      "[data-document-date-change]",
      "[data-edit-document]",
      "[data-edit-global-document]",
      "[data-delete-global-document]",
      "[data-delete-procedural-doc]",
      "[data-edit-folder]",
      "[data-delete-folder]",
      "[data-delete-folder-file]",
      "[data-document-bulk-action]"
    ]
  },
  {
    permission: "canManageCalendar",
    selectors: [
      "#add-event",
      "[data-add-event]",
      "[data-reschedule-calendar-event]",
      "[data-complete-calendar-event]",
      "[data-send-calendar-reminder]",
      "[data-send-selected-reminder]",
      "[data-edit-calendar-event]",
      "[data-delete-calendar-event]",
      "[data-edit-procedural-action]",
      "[data-delete-procedural-action]"
    ]
  },
  {
    permission: "canSeeFinance",
    selectors: [
      "[data-export-finance]",
      "[data-finance-payments]"
    ]
  },
  {
    permission: "canManageFinance",
    selectors: [
      "[data-edit-finance]",
      "[data-preview-finance]",
      "[data-finance-work-action]",
      "[data-finance-quick-action]",
      "[data-finance-salary-open]",
      "[data-salary-edit]",
      "[data-salary-delete]"
    ]
  },
  {
    permission: "canManageMailings",
    selectors: [
      "[data-mailing-action]",
      "[data-client-telegram-settings]",
      "[data-client-mailing-panel]",
      "[data-client-mailing-action]",
      "[data-use-template]",
      "[data-edit-template]",
      "[data-delete-template]",
      "[data-save-mailing-template]",
      "[data-recipient-mode]",
      "[data-message-channel]",
      "[data-mail-var]",
      "[data-insert-mailing]",
      "[data-wrap-mailing]",
      "[data-toggle-automation]",
      "[data-automation-channel]",
      "[data-edit-mailing-campaign]",
      "[data-delete-mailing-campaign]",
      "[data-send-mailing-campaign]",
      "[data-toggle-mailing-deliveries]",
      "[data-update-delivery]",
      "[data-mailing-channel-toggle]",
      "[data-test-contact]",
      "[data-mailing-schedule-date]",
      "[data-mailing-schedule-time]"
    ]
  },
  {
    permission: "canManageUsers",
    selectors: [
      "[data-save-settings]",
      "[data-settings-action='invite']",
      "[data-settings-user-edit]",
      "[data-settings-user-delivery]",
      "[data-settings-user-delete]",
      "[data-settings-role-defaults]",
      "[data-settings-user-submit]",
      "[data-settings-delivery-refresh]",
      "[data-settings-delivery-copy]",
      "[data-settings-integration]",
      "[data-settings-notification]",
      "[data-settings-refresh-audit]",
      "[data-settings-clear-audit]",
      "[data-demo-data-toggle]"
    ]
  },
  {
    permission: "canUseAi",
    selectors: [
      "[data-documents-ai]",
      "[data-ai-create-global]",
      "[data-ai-create-case]",
      "[data-ai-row-action]",
      "[data-ai-send]",
      "[data-ai-question]",
      "[data-ai-quick]"
    ]
  },
  {
    permission: "canUseOsint",
    selectors: [
      "[data-create-osint]",
      "[data-osint-export]",
      "[data-osint-monitor]",
      "[data-osint-source-toggle]",
      "[data-osint-source-refresh]",
      "[data-osint-sync]",
      "[data-osint-quick]"
    ]
  }
];

function permissions() {
  if (Object.keys(state.sessionPermissions || {}).length) return state.sessionPermissions;
  return state.dataSource === "api" ? {} : defaultPermissions;
}

function can(permission) {
  const currentPermissions = permissions();
  if (Object.prototype.hasOwnProperty.call(currentPermissions, permission)) {
    return Boolean(currentPermissions[permission]);
  }
  return Boolean(defaultPermissions[permission]);
}

function canOpenView(view) {
  const permission = viewPermissionMap[view];
  return !permission || can(permission);
}

function restrictedViewMessage(view) {
  if (view === "finance") return "Фінанси доступні адміністратору або бухгалтеру.";
  if (view === "settings") return "Налаштування користувачів доступні адміністратору.";
  return "Для цього розділу недостатньо прав.";
}

function syncRoleNavigation() {
  Object.entries(viewPermissionMap).forEach(([view, permission]) => {
    const visible = can(permission);
    document.querySelectorAll(`[data-view="${view}"], [data-view-link="${view}"]`).forEach((node) => {
      node.hidden = !visible;
    });
  });
}

function applyPermissionControls(root = document) {
  permissionControlRules.forEach(({ permission, selectors }) => {
    const allowed = can(permission);
    selectors.forEach((selector) => {
      root.querySelectorAll(selector).forEach((node) => {
        node.hidden = !allowed;
        if (!allowed) node.setAttribute("aria-hidden", "true");
        else node.removeAttribute("aria-hidden");
      });
    });
  });
  syncRoleNavigation();
}

function showToast(message, type = "success") {
  const stack = $("#toast-stack");
  if (stack) stack.replaceChildren();
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
  exportStoredDocument,
  openOfficeEditor,
  openDocumentDialog,
  openTaskDialog,
  openSubtaskDialog,
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
  renderAll,
  switchView,
  showToast
});

function screenContext() {
  return {
    state,
    $,
    icon,
    actionMenu,
    bindActionMenus,
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
    makeDocumentId,
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
    openSubtaskDialog,
    openEventDialog,
    openFolderDialog,
    openDeleteDocumentConfirm,
    getDocumentPayload,
    openStoredDocument,
    exportStoredDocument,
    openOfficeEditor,
    parseDisplayDate,
    permissions,
    can,
    renderAll,
    renderCases,
    renderTasks,
    renderCalendar,
    switchView,
    bindViewLinks,
    showToast,
    saveNavigationState,
    syncNavigationState,
    syncTopbarNotifications: () => syncTopbarNotifications($, state)
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
  if (taskBadge) {
    const activeTasks = allCaseTasks().filter((task) => !task.completed).length;
    taskBadge.textContent = activeTasks;
    taskBadge.hidden = activeTasks <= 0;
    taskBadge.closest(".nav-item")?.classList.toggle("has-badge", activeTasks > 0);
  }
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
  applyPermissionControls();
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
  if (!canOpenView(view)) {
    showToast(restrictedViewMessage(view), "warning");
    view = "dashboard";
  }
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
      : view === "analytics"
        ? "Аналізуйте ефективність роботи, справи та фінансові показники"
        : view === "finance"
          ? "Повний фінансовий облік по всіх справах та клієнтах"
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

function handleSessionChange() {
  if (!canOpenView(state.currentView)) {
    switchView("dashboard", { skipHistory: true });
  }
  renderAll();
  syncNavigationState();
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

setupTopbarControls({ $, state, switchView, saveNavigationState, showToast, onSessionChange: handleSessionChange });

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
  openOfficeEditor,
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
