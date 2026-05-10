import { createInitialState } from "./js/state.js";
import {
  closeTopbarPanels as closeTopbarPanelsInChrome,
  isTopbarPanelOpen,
  setupTopbarControls
} from "./js/chrome.js";
import { setupDialogControls } from "./js/dialogs.js";
import { setupCaseDetailForms } from "./js/forms/case-details.js";
import { setupCaseForm } from "./js/forms/cases.js";
import { setupClientForm } from "./js/forms/clients.js";
import { setupDocumentForm } from "./js/forms/documents.js";
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
