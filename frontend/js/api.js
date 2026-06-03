export function apiBaseUrl() {
  const hostname = window.location.hostname;
  if (hostname.endsWith(".onrender.com")) return window.location.origin;
  if (window.CRM_API_MODE === "static" || localStorage.getItem("crmApiMode") === "static") return "";
  if (window.location.port === "8001") return window.location.origin;
  const configured = window.CRM_API_BASE || localStorage.getItem("crmApiBase");
  if (configured) return configured.replace(/\/$/, "");
  return "";
}

export function shouldUseApi(state) {
  return state?.dataSource === "api" && Boolean(apiBaseUrl());
}

function readCookie(name) {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : "";
}

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export async function apiRequest(path, options = {}) {
  const baseUrl = apiBaseUrl();
  if (!baseUrl) throw new Error("CRM API base URL is not configured");
  const method = options.method || "GET";
  const csrfHeader = UNSAFE_METHODS.has(method) ? { "X-CSRFToken": readCookie("csrftoken") } : {};
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...csrfHeader,
      ...(options.headers || {})
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `CRM API request failed: ${response.status}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

export async function apiFormRequest(path, formData, options = {}) {
  const baseUrl = apiBaseUrl();
  if (!baseUrl) throw new Error("CRM API base URL is not configured");
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method || "POST",
    credentials: "include",
    headers: { "X-CSRFToken": readCookie("csrftoken") },
    body: formData
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `CRM API request failed: ${response.status}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

export function saveClientToApi(client) {
  const hasId = client.id !== undefined && client.id !== null && client.id !== "";
  return apiRequest(hasId ? `/api/clients/${client.id}/` : "/api/clients/", {
    method: hasId ? "PUT" : "POST",
    body: client
  });
}

export function deleteClientFromApi(clientId) {
  return apiRequest(`/api/clients/${clientId}/`, { method: "DELETE" });
}

export function saveClientCommunicationToApi(communication) {
  const hasId = communication.id !== undefined && communication.id !== null && communication.id !== "";
  const clientId = communication.clientId;
  return apiRequest(hasId ? `/api/client-communications/${communication.id}/` : `/api/clients/${clientId}/communications/`, {
    method: hasId ? "PUT" : "POST",
    body: communication
  });
}

export function deleteClientCommunicationFromApi(communicationId) {
  return apiRequest(`/api/client-communications/${communicationId}/`, { method: "DELETE" });
}

export function saveSettingsUserToApi(user) {
  const hasId = user.id !== undefined && user.id !== null && user.id !== "";
  return apiRequest(hasId ? `/api/users/${user.id}/` : "/api/users/", {
    method: hasId ? "PUT" : "POST",
    body: user
  });
}

export function deleteSettingsUserFromApi(userId) {
  return apiRequest(`/api/users/${userId}/`, { method: "DELETE" });
}

export function loginToApi(credentials) {
  return apiRequest("/api/auth/login/", {
    method: "POST",
    body: credentials
  });
}

export function logoutFromApi() {
  return apiRequest("/api/auth/logout/", { method: "POST" });
}

export function changePasswordInApi(password) {
  return apiRequest("/api/auth/change-password/", {
    method: "POST",
    body: { password }
  });
}

export function getSessionFromApi() {
  return apiRequest("/api/session/");
}

export function getDemoDataStatusFromApi() {
  return apiRequest("/api/demo-data/");
}

export function getAuditLogsFromApi(limit = 50) {
  return apiRequest(`/api/audit-logs/?limit=${encodeURIComponent(limit)}`);
}

export function clearAuditLogsFromApi() {
  return apiRequest("/api/audit-logs/", { method: "DELETE" });
}

export function saveCrmSettingsToApi(settings) {
  return apiRequest("/api/settings/", {
    method: "PUT",
    body: { settings }
  });
}

export function getMailingProviderStatusFromApi() {
  return apiRequest("/api/settings/provider-status/");
}

export function testMailingProviderInApi(channel) {
  return apiRequest("/api/settings/provider-status/", {
    method: "POST",
    body: { channel }
  });
}

export function saveMailingTemplateToApi(template) {
  const hasId = template.id !== undefined && template.id !== null && template.id !== "";
  return apiRequest(hasId ? `/api/mailings/templates/${template.id}/` : "/api/mailings/templates/", {
    method: hasId ? "PUT" : "POST",
    body: template
  });
}

export function deleteMailingTemplateFromApi(templateId) {
  return apiRequest(`/api/mailings/templates/${templateId}/`, { method: "DELETE" });
}

export function saveMailingCampaignToApi(campaign) {
  const hasId = campaign.id !== undefined && campaign.id !== null && campaign.id !== "";
  return apiRequest(hasId ? `/api/mailings/campaigns/${campaign.id}/` : "/api/mailings/campaigns/", {
    method: hasId ? "PUT" : "POST",
    body: campaign
  });
}

export function deleteMailingCampaignFromApi(campaignId) {
  return apiRequest(`/api/mailings/campaigns/${campaignId}/`, { method: "DELETE" });
}

export function sendMailingCampaignInApi(campaignId) {
  return apiRequest(`/api/mailings/campaigns/${campaignId}/send/`, { method: "POST" });
}

export function saveMailingAutomationRuleToApi(rule) {
  const hasId = rule.id !== undefined && rule.id !== null && rule.id !== "";
  return apiRequest(hasId ? `/api/mailings/automation-rules/${rule.id}/` : "/api/mailings/automation-rules/", {
    method: hasId ? "PUT" : "POST",
    body: rule
  });
}

export function updateMailingDeliveryInApi(deliveryId, payload) {
  return apiRequest(`/api/mailings/deliveries/${deliveryId}/`, {
    method: "PUT",
    body: payload
  });
}

export function clearDemoDataInApi() {
  return apiRequest("/api/demo-data/", {
    method: "POST",
    body: { action: "clear" }
  });
}

export function restoreDemoDataInApi() {
  return apiRequest("/api/demo-data/", {
    method: "POST",
    body: { action: "restore" }
  });
}

export function importCrmSnapshotToApi(snapshot) {
  return apiRequest("/api/demo-data/", {
    method: "POST",
    body: { action: "import_snapshot", snapshot }
  });
}

export function saveCaseToApi(caseItem) {
  const hasId = caseItem.id !== undefined && caseItem.id !== null && caseItem.id !== "";
  return apiRequest(hasId ? `/api/cases/${encodeURIComponent(caseItem.id)}/` : "/api/cases/", {
    method: hasId ? "PUT" : "POST",
    body: caseItem
  });
}

export function deleteCaseFromApi(caseId) {
  return apiRequest(`/api/cases/${encodeURIComponent(caseId)}/`, { method: "DELETE" });
}

export function saveTaskToApi(task) {
  const hasId = task.id !== undefined && task.id !== null && task.id !== "";
  return apiRequest(hasId ? `/api/tasks/${task.id}/` : "/api/tasks/", {
    method: hasId ? "PUT" : "POST",
    body: task
  });
}

export function deleteTaskFromApi(taskId) {
  return apiRequest(`/api/tasks/${taskId}/`, { method: "DELETE" });
}

export function saveDocumentToApi(document) {
  const hasId = document.id !== undefined && document.id !== null && document.id !== "";
  return apiRequest(hasId ? `/api/documents/${document.id}/` : "/api/documents/", {
    method: hasId ? "PUT" : "POST",
    body: document
  });
}

export function uploadDocumentFileToApi(documentId, file) {
  const formData = new FormData();
  formData.append("file", file);
  return apiFormRequest(`/api/documents/${documentId}/file/`, formData);
}

export function deleteDocumentFromApi(documentId) {
  return apiRequest(`/api/documents/${documentId}/`, { method: "DELETE" });
}

export function saveEventToApi(event) {
  const hasId = event.id !== undefined && event.id !== null && event.id !== "";
  return apiRequest(hasId ? `/api/calendar/events/${event.id}/` : "/api/calendar/events/", {
    method: hasId ? "PUT" : "POST",
    body: event
  });
}

export function deleteEventFromApi(eventId) {
  return apiRequest(`/api/calendar/events/${eventId}/`, { method: "DELETE" });
}

export function saveFinanceOperationToApi(operation) {
  return apiRequest("/api/finance/operations/", {
    method: "POST",
    body: operation
  });
}

export function deleteFinanceOperationFromApi(operationId) {
  return apiRequest(`/api/finance/operations/${encodeURIComponent(operationId)}/`, { method: "DELETE" });
}

export function saveSalaryToApi(salary) {
  const hasId = salary.id !== undefined && salary.id !== null && salary.id !== "";
  return apiRequest(hasId ? `/api/finance/salaries/${encodeURIComponent(salary.id)}/` : "/api/finance/salaries/", {
    method: hasId ? "PUT" : "POST",
    body: salary
  });
}

export function deleteSalaryFromApi(salaryId) {
  return apiRequest(`/api/finance/salaries/${encodeURIComponent(salaryId)}/`, { method: "DELETE" });
}

export function saveArchiveFoldersToApi(folders) {
  return apiRequest("/api/documents/archive-folders/", { method: "PUT", body: { folders } });
}
