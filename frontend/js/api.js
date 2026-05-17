export function apiBaseUrl() {
  const configured = window.CRM_API_BASE || localStorage.getItem("crmApiBase");
  if (configured) return configured.replace(/\/$/, "");
  if (window.location.port === "8001") return window.location.origin;
  return "";
}

export function shouldUseApi(state) {
  return state?.dataSource === "api" && Boolean(apiBaseUrl());
}

export async function apiRequest(path, options = {}) {
  const baseUrl = apiBaseUrl();
  if (!baseUrl) throw new Error("CRM API base URL is not configured");
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method || "GET",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
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

export function getSessionFromApi() {
  return apiRequest("/api/session/");
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
