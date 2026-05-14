async function readDataFile(path) {
  const response = await fetch(new URL(path, import.meta.url));
  if (!response.ok) throw new Error(`Не удалось загрузить файл данных: ${path}`);
  return response.json();
}

async function loadDemoData() {
  const [clients, cases, events, mailing, settings] = await Promise.all([
    readDataFile("../data/clients.json"),
    readDataFile("../data/cases.json"),
    readDataFile("../data/events.json"),
    readDataFile("../data/mailing.json"),
    readDataFile("../data/settings.json")
  ]);
  return { clients, cases, events, mailing, settings };
}

export async function createInitialState() {
  const demoData = await loadDemoData();

  return {
    currentView: "dashboard",
    previousView: "",
    viewHistory: [],
    clients: demoData.clients,
    cases: demoData.cases,
    events: demoData.events,
    selectedClientId: 1,
    selectedCaseId: "2024/12345",
    caseScreen: "list",
    casePage: 1,
    casePageSize: 6,
    taskTab: "all",
    taskStatusFilter: "all",
    taskPriorityFilter: "all",
    taskCaseFilter: "all",
    taskResponsibleFilter: "all",
    taskQuery: "",
    taskPage: 1,
    taskPageSize: 6,
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
    documentStatusFilter: "all",
    documentCaseFilter: "all",
    selectedDocumentKey: "",
    documentDialogReturnView: "cases",
    folderDialogReturnView: "cases",
    financeQuery: "",
    financeStatusFilter: "all",
    selectedFinanceCaseId: "2024/12345",
    analyticsPeriod: "month",
    analyticsResponsible: "all",
    analyticsStatus: "all",
    aiSelectedHelper: "Військове право",
    aiSelectedCaseId: "2024/12345",
    aiMessages: [],
    osintQuery: "",
    osintStatusFilter: "all",
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
    settingsUsers: [
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
    mailingStatusNotice: demoData.mailing.statusNotice || ""
  };
}
