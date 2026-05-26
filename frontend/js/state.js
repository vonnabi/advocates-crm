import { apiBaseUrl } from "./api.js?v=demo-empty-state-1";

const DEMO_DATE_ANCHOR = new Date(2024, 4, 15);
const ISO_DATE_RE = /(?<!\d)(\d{4})-(\d{2})-(\d{2})(?!\d)/g;
const DISPLAY_DATE_RE = /(?<!\d)(\d{2})\.(\d{2})\.(\d{4})(?!\d)/g;
const DEMO_CASE_YEAR_RE = /(?<!\d)2024\/(?=\d)/g;
const SNAPSHOT_STORAGE_KEY = "advocates-crm-snapshot";

function localDateOnly(value = new Date()) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function localIsoDate(value = new Date()) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function addDays(value, days) {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

function demoDateDeltaDays() {
  return Math.round((localDateOnly().getTime() - DEMO_DATE_ANCHOR.getTime()) / 86400000);
}

function shiftIsoDate(value) {
  const [year, month, day] = String(value).split("-").map(Number);
  return localIsoDate(addDays(new Date(year, month - 1, day), demoDateDeltaDays()));
}

function displayFromIso(value) {
  const [year, month, day] = String(value).split("-");
  return `${day}.${month}.${year}`;
}

function shiftDemoDateString(value) {
  const days = demoDateDeltaDays();
  const source = String(value);
  const shiftedDates = days
    ? source
      .replace(ISO_DATE_RE, (_match, year, month, day) => localIsoDate(addDays(new Date(Number(year), Number(month) - 1, Number(day)), days)))
      .replace(DISPLAY_DATE_RE, (_match, day, month, year) => displayFromIso(localIsoDate(addDays(new Date(Number(year), Number(month) - 1, Number(day)), days))))
    : source;
  return shiftedDates.replace(DEMO_CASE_YEAR_RE, `${new Date().getFullYear()}/`);
}

function shiftDemoPayloadDates(value) {
  if (Array.isArray(value)) return value.map(shiftDemoPayloadDates);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, shiftDemoPayloadDates(item)]));
  }
  if (typeof value === "string") return shiftDemoDateString(value);
  return value;
}

function demoCaseId(value) {
  return String(value || "").replace(DEMO_CASE_YEAR_RE, `${new Date().getFullYear()}/`);
}

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
  const clean = String(value).trim();
  const isoTime = clean.match(/T(\d{2}:\d{2})/);
  if (isoTime) return isoTime[1];
  const time = clean.match(/\b\d{1,2}:\d{2}\b/)?.[0] || "";
  return time.length === 4 ? `0${time}` : time;
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
    time: event.time || timePart(event.startsAt) || "09:00",
    endTime: event.endTime || timePart(event.endsAt) || "",
    reminderEnabled: Boolean(event.reminderEnabled || event.reminderChannels),
  };
}

export function normalizeFinanceOperation(operation) {
  return {
    ...operation,
    date: displayDate(operation.date, operation.date || ""),
    amount: Number(operation.amount || 0)
  };
}

export function normalizeAuditLog(item) {
  return {
    ...item,
    date: displayDateTime(item.date, item.date || ""),
    text: item.summary || item.text || "",
    tone: item.tone || "blue"
  };
}

export function normalizeSettingsUser(user) {
  const passwordTemporary = Boolean(user.passwordTemporary || user.mustChangePassword);
  return {
    ...user,
    name: user.name || "",
    email: user.email || "",
    role: user.role || "Помічник",
    access: user.access || "Задачі та документи",
    photo: user.photo || (user.name || "К").slice(0, 1),
    permissionKeys: Array.isArray(user.permissionKeys) ? user.permissionKeys : [],
    permissions: user.permissions || {},
    assignedCaseIds: Array.isArray(user.assignedCaseIds) ? user.assignedCaseIds : [],
    assignedCases: Array.isArray(user.assignedCases) ? user.assignedCases : [],
    assignedCasesCount: Number(user.assignedCasesCount || user.assignedCaseIds?.length || 0),
    caseScope: user.caseScope || (user.role === "Адміністратор" ? "all" : "assigned"),
    accessStatus: user.accessStatus || (passwordTemporary ? "Пароль тимчасовий" : user.lastLoginAt ? "Активний" : "Запрошено"),
    passwordTemporary,
    mustChangePassword: passwordTemporary,
    passwordUpdatedAt: user.passwordUpdatedAt || "",
    lastLoginAt: user.lastLoginAt || ""
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
    mailing: payload.mailing || {},
    settings: payload.settings || {},
    auditLogs: (payload.auditLogs || []).map(normalizeAuditLog),
    meta: payload.meta || {},
    source: "api"
  };
}

function mergeSettings(fallback, incoming = {}) {
  return {
    bureau: { ...(fallback?.bureau || {}), ...(incoming?.bureau || {}) },
    integrations: { ...(fallback?.integrations || {}), ...(incoming?.integrations || {}) },
    integrationSettings: { ...(fallback?.integrationSettings || {}), ...(incoming?.integrationSettings || {}) },
    notifications: { ...(fallback?.notifications || {}), ...(incoming?.notifications || {}) }
  };
}

function mergeMailing(fallback, incoming = {}) {
  return {
    ...fallback,
    ...incoming,
    channels: { ...(fallback?.channels || {}), ...(incoming?.channels || {}) },
    testContacts: incoming?.testContacts || fallback?.testContacts || [],
    filters: incoming?.filters || fallback?.filters || [],
    templates: incoming?.templates || fallback?.templates || [],
    campaigns: incoming?.campaigns || fallback?.campaigns || [],
    automationRules: incoming?.automationRules || fallback?.automationRules || []
  };
}

function emptyDemoDataStatus(extra = {}) {
  const counts = {
    clients: 0,
    cases: 0,
    tasks: 0,
    documents: 0,
    events: 0,
    financeOperations: 0,
    communications: 0,
    campaigns: 0
  };
  return {
    enabled: false,
    counts,
    total: 0,
    ...extra
  };
}

function emptyApiPayload(mailing, settings, demoData = {}) {
  return {
    clients: [],
    cases: [],
    events: [],
    financeOperations: [],
    finance: {},
    mailing,
    settings,
    settingsUsers: [],
    auditLogs: [],
    session: {},
    currentUser: null,
    meta: {
      clients: 0,
      cases: 0,
      tasks: 0,
      events: 0,
      demoData: emptyDemoDataStatus(demoData)
    },
    source: "api"
  };
}

function readSnapshotOverride(fallbackMailing, fallbackSettings) {
  let snapshot = null;
  try {
    snapshot = JSON.parse(localStorage.getItem(SNAPSHOT_STORAGE_KEY) || "null");
  } catch (_error) {
    localStorage.removeItem(SNAPSHOT_STORAGE_KEY);
    return null;
  }
  if (!snapshot || !Array.isArray(snapshot.clients) || !Array.isArray(snapshot.cases) || !Array.isArray(snapshot.events)) return null;
  const counts = snapshot.demoData?.counts || {};
  const total = snapshot.demoData?.total ?? Object.values(counts).reduce((sum, value) => sum + Number(value || 0), 0);
  return {
    session: snapshot.session || {},
    currentUser: snapshot.currentUser || null,
    settingsUsers: snapshot.settingsUsers || [],
    clients: snapshot.clients,
    cases: snapshot.cases,
    events: snapshot.events,
    financeOperations: snapshot.financeOperations || [],
    finance: snapshot.finance || {},
    mailing: mergeMailing(fallbackMailing, snapshot.mailing || {}),
    settings: mergeSettings(fallbackSettings, {
      bureau: snapshot.bureauSettings || snapshot.settings?.bureau || {},
      integrations: snapshot.settingsIntegrations || snapshot.settings?.integrations || {},
      integrationSettings: snapshot.settingsIntegrationSettings || snapshot.settings?.integrationSettings || {},
      notifications: snapshot.settingsNotifications || snapshot.settings?.notifications || {}
    }),
    auditLogs: snapshot.auditLogs || [],
    meta: {
      ...(snapshot.meta || {}),
      demoData: {
        ...(snapshot.demoData || snapshot.meta?.demoData || {}),
        enabled: true,
        snapshot: true,
        total,
        counts
      }
    },
    source: "snapshot"
  };
}

async function loadDemoData() {
  const [rawMailing, rawSettings] = await Promise.all([
    readDataFile("../data/mailing.json"),
    readDataFile("../data/settings.json")
  ]);
  const mailing = shiftDemoPayloadDates(rawMailing);
  const settings = shiftDemoPayloadDates(rawSettings);
  const snapshot = readSnapshotOverride(mailing, settings);
  if (snapshot) return snapshot;
  const expectedApi = Boolean(apiBaseUrl());
  try {
    const apiData = normalizeBackendPayload(await readApiBootstrap());
    if (apiData) return { ...apiData, mailing: mergeMailing(mailing, apiData.mailing), settings: mergeSettings(settings, apiData.settings) };
  } catch (_error) {
    if (expectedApi) return emptyApiPayload(mailing, settings, { apiError: true });
  }
  if (expectedApi) return emptyApiPayload(mailing, settings);
  const [clients, cases, events] = await Promise.all([
    readDataFile("../data/clients.json"),
    readDataFile("../data/cases.json"),
    readDataFile("../data/events.json")
  ]);
  return {
    clients: shiftDemoPayloadDates(clients),
    cases: shiftDemoPayloadDates(cases),
    events: shiftDemoPayloadDates(events),
    mailing,
    settings,
    source: "json"
  };
}

export async function createInitialState() {
  const demoData = await loadDemoData();
  const demoRangeStart = shiftIsoDate("2024-05-01");
  const demoRangeEnd = shiftIsoDate("2024-05-15");
  const demoOsintRangeEnd = shiftIsoDate("2024-05-16");
  const demoToday = localIsoDate();
  const demoDataStatus = demoData.meta?.demoData || {
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
  };
  const demoDataDisabled = demoData.source === "api" && demoDataStatus.enabled === false;
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

  return {
    currentView: "dashboard",
    previousView: "",
    viewHistory: [],
    clients: demoData.clients,
    cases: demoData.cases,
    events: demoData.events,
    dataSource: demoData.source,
    session: demoData.session || {},
    currentUser: demoData.currentUser || null,
    sessionAuthenticated: Boolean(demoData.session?.authenticated),
    sessionPermissions: demoData.session?.permissions || (demoData.source === "api" ? {} : defaultPermissions),
    backendMeta: demoData.meta || {},
    backendFinance: demoData.finance || {},
    demoDataStatus,
    selectedClientId: 1,
    selectedClientKeys: [],
    clientPage: 1,
    clientPageSize: 10,
    clientSort: "added",
    clientStatusFilter: "all",
    clientSourceFilter: "all",
    clientManagerFilter: "all",
    selectedCaseId: demoCaseId("2024/12345"),
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
    documentArchiveClientId: "all",
    documentArchiveCaseId: "all",
    documentArchiveFolder: "",
    documentStorageArchiveFolderId: "all",
    documentArchiveFolders: [
      { id: "finished", name: "Завершені документи", documents: [], children: [] },
      { id: "saved", name: "На зберіганні", documents: [], children: [] }
    ],
    selectedDocumentKeys: [],
    selectedDocumentKey: "",
    documentDialogReturnView: "cases",
    folderDialogReturnView: "cases",
    documentArchiveScope: "cases",
    financeQuery: "",
    financeStatusFilter: "all",
    financeOperationClientFilter: "all",
    financeOperationCaseFilter: "all",
    financeCaseQuery: "",
    financeCaseStatusFilter: "all",
    financeClientDebtQuery: "",
    financeClientDebtStatusFilter: "all",
    financePaymentMode: "all",
    selectedFinanceOperationId: "",
    selectedFinanceCaseId: demoCaseId("2024/12345"),
    financeTab: "overview",
    financeDateStart: demoRangeStart,
    financeDateEnd: demoRangeEnd,
    financeDatePickerOpen: false,
    financeOperations: demoData.financeOperations || [],
    auditLogs: demoData.auditLogs || [],
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
    analyticsDateStart: demoRangeStart,
    analyticsDateEnd: demoRangeEnd,
    analyticsDatePickerOpen: false,
    aiSelectedHelper: "Військове право",
    aiSelectedCaseId: demoCaseId("2024/12345"),
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
    osintDateStart: demoRangeStart,
    osintDateEnd: demoOsintRangeEnd,
    selectedOsintId: "osint-1",
    osintChecks: demoDataDisabled ? [] : [
      {
        id: "osint-1",
        title: "Перевірка контрагента по договору",
        caseId: demoCaseId("2024/5678"),
        object: "ТОВ / контрагент",
        sources: ["ЄДР", "Судові рішення", "Борги"],
        risks: ["Є виконавче провадження", "Потрібна перевірка бенефіціарів"],
        status: "В роботі"
      },
      {
        id: "osint-2",
        title: "Аналіз відкритих джерел клієнта",
        caseId: demoCaseId("2024/9999"),
        object: "Клієнт / публічні згадки",
        sources: ["Пошук", "Реєстри", "Документи"],
        risks: ["Знайдено розбіжності у датах"],
        status: "Потребує уваги"
      },
      {
        id: "osint-3",
        title: "Моніторинг судових реєстрів",
        caseId: demoCaseId("2024/12345"),
        object: "Активні справи бюро",
        sources: ["Судовий реєстр", "Календар", "Справи"],
        risks: [],
        status: "Активний"
      }
    ],
    osintSources: demoDataDisabled ? [] : undefined,
    osintReports: demoDataDisabled ? [] : undefined,
    settingsUsers: demoData.settingsUsers || [
      { name: "Іваненко А.Ю.", role: "Адміністратор", access: "Повний доступ", photo: "І" },
      { name: "Мельник Н.П.", role: "Адвокат", access: "Справи, клієнти, календар", photo: "М" },
      { name: "Кравчук А.В.", role: "Помічник", access: "Задачі та документи", photo: "К" }
    ],
    selectedEventId: "event-4",
    calendarMode: "month",
    calendarDate: demoToday,
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
    openMailingCampaignId: "",
    mailingAutomationRules: demoData.mailing.automationRules,
    bureauSettings: demoData.settings.bureau,
    settingsIntegrations: demoData.settings.integrations,
    settingsIntegrationSettings: demoData.settings.integrationSettings || {},
    settingsNotifications: demoData.settings.notifications,
    settingsAudit: demoDataDisabled ? [] : [
      { date: shiftDemoDateString("16.05.2024 09:30"), text: "Синхронізовано канали Telegram та SMS.", tone: "green" },
      { date: shiftDemoDateString("15.05.2024 18:10"), text: "Оновлено профіль бюро для документів.", tone: "blue" },
      { date: shiftDemoDateString("15.05.2024 12:40"), text: "Перевірено правила сповіщень по дедлайнах.", tone: "amber" }
    ],
    notificationReadKeys: [],
    mailingStatusNotice: demoData.mailing.statusNotice || ""
  };
}
