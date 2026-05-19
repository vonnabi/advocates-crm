import { apiBaseUrl } from "./api.js?v=demo-data-2";

async function readDataFile(path) {
  const response = await fetch(new URL(path, import.meta.url));
  if (!response.ok) throw new Error(`Не удалось загрузить файл данных: ${path}`);
  return response.json();
}

async function readApiBootstrap(timeoutMs = 5000) {
  const baseUrl = apiBaseUrl();
  if (!baseUrl) return null;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}/api/bootstrap/`, {
      cache: "no-store",
      credentials: "include",
      signal: controller.signal
    });
    if (!response.ok) throw new Error("Backend API is not available");
    return response.json();
  } finally {
    window.clearTimeout(timeout);
  }
}

function isoDatePart(value) {
  if (!value || value === "-") return "";
  const clean = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(clean)) return clean.slice(0, 10);
  if (/^\d{2}\.\d{2}\.\d{4}/.test(clean)) {
    const [day, month, year] = clean.slice(0, 10).split(".");
    return `${year}-${month}-${day}`;
  }
  return "";
}

function timePart(value) {
  if (!value || value === "-") return "";
  return String(value).match(/\b\d{2}:\d{2}\b/)?.[0] || "";
}

function displayDate(value, fallback = "") {
  const iso = isoDatePart(value);
  if (!iso) return fallback;
  const [year, month, day] = iso.split("-");
  return `${day}.${month}.${year}`;
}

function displayDateTime(value, fallback = "") {
  const date = displayDate(value);
  if (!date) return fallback;
  const time = timePart(value);
  return time ? `${date} ${time}` : date;
}

export function normalizeClient(client) {
  return {
    ...client,
    added: displayDate(client.added, client.added || ""),
    lastContact: displayDate(client.lastContact, client.lastContact || ""),
    communications: (client.communications || []).map(normalizeClientCommunication)
  };
}

export function normalizeClientCommunication(item) {
  return {
    ...item,
    date: displayDate(item.date, item.date || "")
  };
}

export function normalizeDocument(document) {
  return {
    ...document,
    documentId: document.documentId || document.id || document.documentId,
    folder: document.folder || "Процесуальні документи",
    submitted: displayDate(document.submitted, document.submitted || "-"),
    responseDue: displayDate(document.responseDue, document.responseDue || "-")
  };
}

export function normalizeTask(task) {
  const plannerDate = isoDatePart(task.plannerAt);
  return {
    ...task,
    due: displayDateTime(task.due, task.due || "Не вказано"),
    dueText: displayDateTime(task.due, task.due || "Не вказано"),
    plannerDate,
    plannerDateText: plannerDate ? displayDate(plannerDate) : "",
    subtasks: (task.subtasks || []).map((subtask) => ({
      ...subtask,
      due: displayDate(subtask.due, subtask.due || "Не вказано")
    }))
  };
}

export function normalizeCase(caseItem) {
  return {
    ...caseItem,
    opened: displayDate(caseItem.opened, caseItem.opened || ""),
    deadline: displayDate(caseItem.deadline, caseItem.deadline || "Без строку"),
    documents: (caseItem.documents || []).map(normalizeDocument),
    tasks: (caseItem.tasks || []).map(normalizeTask)
  };
}

export function normalizeEvent(event) {
  const date = isoDatePart(event.date || event.startsAt);
  return {
    ...event,
    date: date || event.date || "",
    time: timePart(event.startsAt) || event.time || "09:00",
    endTime: timePart(event.endsAt) || event.endTime || "",
  };
}

export function normalizeFinanceOperation(operation) {
  return {
    ...operation,
    date: displayDate(operation.date, operation.date || ""),
    amount: Number(operation.amount || 0)
  };
}

export function normalizeSettingsUser(user) {
  return {
    ...user,
    name: user.name || "",
    email: user.email || "",
    role: user.role || "Помічник",
    access: user.access || "Задачі та документи",
    photo: user.photo || (user.name || "К").slice(0, 1)
  };
}

function normalizeBackendPayload(payload) {
  if (!payload?.clients || !payload?.cases || !payload?.events) return null;
  return {
    session: payload.session || {},
    currentUser: payload.session?.user ? normalizeSettingsUser(payload.session.user) : payload.currentUser ? normalizeSettingsUser(payload.currentUser) : null,
    settingsUsers: (payload.settingsUsers || []).map(normalizeSettingsUser),
    clients: payload.clients.map(normalizeClient),
    cases: payload.cases.map(normalizeCase),
    events: payload.events.map(normalizeEvent),
    financeOperations: (payload.financeOperations || []).map(normalizeFinanceOperation),
    finance: payload.finance || {},
    meta: payload.meta || {},
    source: "api"
  };
}

async function loadDemoData() {
  const [mailing, settings] = await Promise.all([
    readDataFile("../data/mailing.json"),
    readDataFile("../data/settings.json")
  ]);
  try {
    const apiData = normalizeBackendPayload(await readApiBootstrap());
    if (apiData) return { ...apiData, mailing, settings };
  } catch (_error) {
    // The static prototype must keep working when Django is not running.
  }
  const [clients, cases, events] = await Promise.all([
    readDataFile("../data/clients.json"),
    readDataFile("../data/cases.json"),
    readDataFile("../data/events.json")
  ]);
  return { clients, cases, events, mailing, settings, source: "json" };
}

export async function createInitialState() {
  const demoData = await loadDemoData();
  const defaultPermissions = {
    canManageUsers: true,
    canSeeFinance: true,
    canManageFinance: true,
    canManageCases: true,
    canManageClients: true,
    canManageTasks: true,
    canManageDocuments: true,
    canManageCalendar: true
  };

  return {
    currentView: "dashboard",
    previousView: "",
    viewHistory: [],
    clients: demoData.clients,
    cases: demoData.cases,
    events: demoData.events,
    dataSource: demoData.source,
    currentUser: demoData.currentUser || null,
    sessionAuthenticated: Boolean(demoData.session?.authenticated),
    sessionPermissions: demoData.session?.permissions || defaultPermissions,
    backendMeta: demoData.meta || {},
    backendFinance: demoData.finance || {},
    demoDataStatus: demoData.meta?.demoData || {
      enabled: Boolean((demoData.clients || []).length || (demoData.cases || []).length || (demoData.events || []).length),
      counts: {
        clients: (demoData.clients || []).length,
        cases: (demoData.cases || []).length,
        tasks: (demoData.cases || []).flatMap((item) => item.tasks || []).length,
        documents: (demoData.cases || []).flatMap((item) => item.documents || []).length,
        events: (demoData.events || []).length,
        financeOperations: (demoData.financeOperations || []).length,
        communications: (demoData.clients || []).flatMap((item) => item.communications || []).length,
        campaigns: (demoData.mailing?.campaigns || []).length
      }
    },
    selectedClientId: 1,
    selectedClientKeys: [],
    selectedCaseId: "2024/12345",
    caseScreen: "list",
    casePage: 1,
    casePageSize: 6,
    caseQuickFilter: "all",
    caseQuery: "",
    caseStatusFilter: "all",
    caseTypeFilter: "all",
    caseResponsibleFilter: "all",
    selectedCaseKeys: [],
    caseActionFilter: "all",
    taskTab: "all",
    taskQuickFilter: "all",
    taskStatusFilter: "all",
    taskPriorityFilter: "all",
    taskCaseFilter: "all",
    taskResponsibleFilter: "all",
    taskQuery: "",
    taskPage: 1,
    taskPageSize: 10,
    selectedTaskKeys: [],
    selectedTaskKey: "",
    taskDetailOpen: false,
    taskDetailTab: "info",
    taskOrder: [],
    dragTaskKey: "",
    taskDialogReturnView: "cases",
    openCaseSection: "",
    openFolderIndex: null,
    pendingDocumentDelete: null,
    documentQuery: "",
    documentQuickFilter: "all",
    documentStatusFilter: "all",
    documentTypeFilter: "all",
    documentClientFilter: "all",
    documentDueFilter: "all",
    documentCaseFilter: "all",
    documentArchiveCaseId: "all",
    documentArchiveFolder: "",
    selectedDocumentKeys: [],
    selectedDocumentKey: "",
    documentDialogReturnView: "cases",
    folderDialogReturnView: "cases",
    financeQuery: "",
    financeStatusFilter: "all",
    selectedFinanceCaseId: "2024/12345",
    financeTab: "overview",
    financeDateStart: "2024-05-01",
    financeDateEnd: "2024-05-15",
    financeDatePickerOpen: false,
    financeOperations: demoData.financeOperations || [],
    salaryRows: [],
    salaryFilter: "all",
    salaryMenuId: "",
    editingSalaryId: "",
    deletedSalaryIds: [],
    analyticsPeriod: "custom",
    analyticsResponsible: "all",
    analyticsStatus: "all",
    analyticsTab: "overview",
    analyticsCaseFilter: "all",
    analyticsTypeFilter: "all",
    analyticsPriorityFilter: "all",
    analyticsDateStart: "2024-05-01",
    analyticsDateEnd: "2024-05-15",
    analyticsDatePickerOpen: false,
    aiSelectedHelper: "Військове право",
    aiSelectedCaseId: "2024/12345",
    aiMessages: [],
    aiSearchQuery: "",
    aiCaseStatusFilter: "all",
    aiCaseResponsibleFilter: "all",
    aiSelectedAssistantId: "",
    aiCustomAssistants: [],
    aiHiddenAssistantIds: [],
    aiOpenMenuId: "",
    osintQuery: "",
    osintStatusFilter: "all",
    osintTab: "overview",
    osintDateStart: "2024-05-01",
    osintDateEnd: "2024-05-16",
    selectedOsintId: "osint-1",
    osintChecks: [
      {
        id: "osint-1",
        title: "Перевірка контрагента по договору",
        caseId: "2024/5678",
        object: "ТОВ / контрагент",
        sources: ["ЄДР", "Судові рішення", "Борги"],
        risks: ["Є виконавче провадження", "Потрібна перевірка бенефіціарів"],
        status: "В роботі"
      },
      {
        id: "osint-2",
        title: "Аналіз відкритих джерел клієнта",
        caseId: "2024/9999",
        object: "Клієнт / публічні згадки",
        sources: ["Пошук", "Реєстри", "Документи"],
        risks: ["Знайдено розбіжності у датах"],
        status: "Потребує уваги"
      },
      {
        id: "osint-3",
        title: "Моніторинг судових реєстрів",
        caseId: "2024/12345",
        object: "Активні справи бюро",
        sources: ["Судовий реєстр", "Календар", "Справи"],
        risks: [],
        status: "Активний"
      }
    ],
    settingsUsers: demoData.settingsUsers || [
      { name: "Іваненко А.Ю.", role: "Адміністратор", access: "Повний доступ", photo: "І" },
      { name: "Мельник Н.П.", role: "Адвокат", access: "Справи, клієнти, календар", photo: "М" },
      { name: "Кравчук А.В.", role: "Помічник", access: "Задачі та документи", photo: "К" }
    ],
    selectedEventId: "event-4",
    calendarMode: "month",
    calendarDate: "2024-05-15",
    calendarPickerOpen: false,
    calendarFilter: "all",
    calendarClientFilter: "all",
    calendarCaseFilter: "all",
    calendarResponsibleFilter: "all",
    calendarStatusFilter: "all",
    calendarAuthorityFilter: "",
    calendarOverdueOnly: false,
    calendarQuery: "",
    mailingText: demoData.mailing.text,
    mailingMainTab: "new",
    previousMailingTab: "",
    mailingRecipientMode: demoData.mailing.recipientMode,
    mailingManualClientIds: demoData.mailing.manualClientIds,
    mailingEditorChannel: demoData.mailing.editorChannel,
    mailingPreviewChannel: demoData.mailing.previewChannel,
    mailingSendMode: demoData.mailing.sendMode,
    mailingScheduleDate: demoData.mailing.scheduleDate,
    mailingScheduleTime: demoData.mailing.scheduleTime,
    mailingChannels: demoData.mailing.channels,
    mailingTestContacts: demoData.mailing.testContacts,
    mailingFilters: demoData.mailing.filters,
    mailingFilterMenuOpen: false,
    mailingTemplates: demoData.mailing.templates || [],
    mailingCampaigns: demoData.mailing.campaigns || [],
    mailingCampaignFilter: "all",
    mailingCampaignQuery: "",
    mailingAutomationRules: demoData.mailing.automationRules,
    bureauSettings: demoData.settings.bureau,
    settingsIntegrations: demoData.settings.integrations,
    settingsNotifications: demoData.settings.notifications,
    settingsAudit: [
      { date: "16.05.2024 09:30", text: "Синхронізовано канали Telegram та SMS.", tone: "green" },
      { date: "15.05.2024 18:10", text: "Оновлено профіль бюро для документів.", tone: "blue" },
      { date: "15.05.2024 12:40", text: "Перевірено правила сповіщень по дедлайнах.", tone: "amber" }
    ],
    notificationReadKeys: [],
    mailingStatusNotice: demoData.mailing.statusNotice || ""
  };
}
