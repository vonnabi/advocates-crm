const NAV_STORAGE_KEY = "advocates-crm-navigation";

export function saveNavigationState({ state }) {
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
      settingsAudit: state.settingsAudit,
      notificationReadKeys: state.notificationReadKeys,
      aiSelectedHelper: state.aiSelectedHelper,
      aiSelectedCaseId: state.aiSelectedCaseId,
      aiSearchQuery: state.aiSearchQuery,
      aiCaseStatusFilter: state.aiCaseStatusFilter,
      aiCaseResponsibleFilter: state.aiCaseResponsibleFilter,
      aiSelectedAssistantId: state.aiSelectedAssistantId,
      aiCustomAssistants: state.aiCustomAssistants,
      aiHiddenAssistantIds: state.aiHiddenAssistantIds,
      sidebarCollapsed: document.body.classList.contains("sidebar-collapsed")
    };
    localStorage.setItem(NAV_STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    // Navigation persistence is helpful, but the app should still work without storage access.
  }
}

export function restoreNavigationState({ state, caseById }) {
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
    state.settingsAudit = Array.isArray(saved.settingsAudit) ? saved.settingsAudit : state.settingsAudit;
    state.notificationReadKeys = Array.isArray(saved.notificationReadKeys) ? saved.notificationReadKeys : [];
    state.aiSelectedHelper = saved.aiSelectedHelper || state.aiSelectedHelper;
    state.aiSelectedCaseId = caseById(saved.aiSelectedCaseId) ? saved.aiSelectedCaseId : state.aiSelectedCaseId;
    state.aiSearchQuery = saved.aiSearchQuery || "";
    state.aiCaseStatusFilter = saved.aiCaseStatusFilter || state.aiCaseStatusFilter;
    state.aiCaseResponsibleFilter = saved.aiCaseResponsibleFilter || state.aiCaseResponsibleFilter;
    state.aiSelectedAssistantId = saved.aiSelectedAssistantId || "";
    state.aiCustomAssistants = Array.isArray(saved.aiCustomAssistants) ? saved.aiCustomAssistants : [];
    state.aiHiddenAssistantIds = Array.isArray(saved.aiHiddenAssistantIds) ? saved.aiHiddenAssistantIds : [];
    document.body.classList.toggle("sidebar-collapsed", Boolean(saved.sidebarCollapsed));
  } catch (error) {
    localStorage.removeItem(NAV_STORAGE_KEY);
  }
}
