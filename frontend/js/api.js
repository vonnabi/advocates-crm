export function apiBaseUrl() {
  const hostname = window.location.hostname;
  if (hostname.endsWith(".onrender.com")) return window.location.origin;
  if (hostname === "advokatcrm.com" || hostname.endsWith(".advokatcrm.com")) return window.location.origin;
  // A static-mode override is only honoured for local development — the production
  // domains above always use the real API, so a stale flag can never show demo data.
  if (window.CRM_API_MODE === "static" || localStorage.getItem("crmApiMode") === "static") return "";
  // Served over HTTPS from a real domain → the API is co-located on the same origin.
  // (Local static dev servers run over plain HTTP, so they correctly stay in demo mode.)
  if (window.location.protocol === "https:") return window.location.origin;
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

export function updateProfileInApi(profile) {
  return apiRequest("/api/profile/", {
    method: "PUT",
    body: profile
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

// AI помічник: send a question (+ case context and prior turns) to the real Claude
// backend and get a reply. Returns { reply }.
export function askAiInApi({ caseNumber, message, helper, helperKey, history, attachmentDocumentId = "" }) {
  return apiRequest("/api/ai/chat/", {
    method: "POST",
    body: { caseNumber, message, helper, helperKey, history, attachmentDocumentId }
  });
}

// AI помічник зі стрімінгом: віддає відповідь по частинах через onChunk(accumulatedText).
// Повертає підсумковий текст. Кидає помилку — викликач відкочується на askAiInApi.
export async function streamAiChat({ caseNumber, message, helper, helperKey, history, file, attachmentDocumentId, onChunk }) {
  const baseUrl = apiBaseUrl();
  if (!baseUrl) throw new Error("CRM API base URL is not configured");
  let body;
  const headers = { "X-CSRFToken": readCookie("csrftoken") };
  if (file) {
    body = new FormData();
    body.append("caseNumber", caseNumber || "");
    body.append("message", message || "");
    body.append("helper", helper || "");
    body.append("helperKey", helperKey || "");
    body.append("history", JSON.stringify(history || []));
    body.append("attachment", file);
  } else {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify({ caseNumber, message, helper, helperKey, history, attachmentDocumentId: attachmentDocumentId || "" });
  }
  const response = await fetch(`${baseUrl}/api/ai/chat/stream/`, { method: "POST", credentials: "include", headers, body });
  if (!response.ok) {
    let msg;
    try { msg = (await response.json())?.message; } catch { msg = `HTTP ${response.status}`; }
    throw new Error(msg || `HTTP ${response.status}`);
  }
  if (!response.body || !response.body.getReader) throw new Error("stream_unsupported");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let acc = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    acc += decoder.decode(value, { stream: true });
    const errIdx = acc.indexOf("[[AI_ERROR]]");
    if (errIdx >= 0) throw new Error(acc.slice(errIdx + "[[AI_ERROR]]".length).trim() || "AI error");
    onChunk?.(acc);
  }
  return acc.trim();
}

// AI помічник із вкладенням: надсилає питання + файл (зображення/скан/pdf/docx) як
// multipart, щоб обійти ліміт JSON-тіла. Модель «бачить» скани/фото напряму (vision).
export function askAiWithAttachmentInApi({ caseNumber, message, helper, helperKey, history, file }) {
  const formData = new FormData();
  formData.append("caseNumber", caseNumber || "");
  formData.append("message", message || "");
  formData.append("helper", helper || "");
  formData.append("helperKey", helperKey || "");
  formData.append("history", JSON.stringify(history || []));
  formData.append("attachment", file);
  return apiFormRequest("/api/ai/chat/", formData);
}

// AI-перевірка одного документа: читає повний текст і повертає структуровані
// зауваження (about / findings[severity,title,detail,fix] / conclusion).
export function reviewDocumentWithAi(documentId) {
  return apiRequest(`/api/documents/${encodeURIComponent(documentId)}/ai-review/`, {
    method: "POST",
    body: {}
  });
}

// AI складання документів зі зразка — .docx-шаблони з полями {{плейсхолдер}}.
export function listDocumentTemplatesFromApi() {
  return apiRequest("/api/documents/templates/");
}

export function uploadDocumentTemplateToApi(file, title = "") {
  const formData = new FormData();
  formData.append("file", file);
  if (title) formData.append("title", title);
  return apiFormRequest("/api/documents/templates/", formData);
}

// AI перетворює звичайний .docx/скан/pdf на шаблон із полями {{...}} (щоб не вставляти дужки вручну).
export function makeTemplateFromDocumentWithAi(file, title = "") {
  const formData = new FormData();
  formData.append("file", file);
  if (title) formData.append("title", title);
  return apiFormRequest("/api/documents/templates/from-document/", formData);
}

export function deleteDocumentTemplateFromApi(templateId) {
  return apiRequest(`/api/documents/templates/${encodeURIComponent(templateId)}/`, { method: "DELETE" });
}

// AI бере .docx-зразок і збирає готовий документ у справу (далі — редагування в ONLYOFFICE).
export function assembleDocumentFromTemplateInApi({ templateId, caseId, instructions = "" }) {
  return apiRequest("/api/documents/assemble/", {
    method: "POST",
    body: { templateId, caseId, instructions }
  });
}

// Індекс усього доступного документообігу (для вибору документа у чат AI-помічника).
export function getAiDocumentIndexFromApi() {
  return apiRequest("/api/ai/documents/index/");
}

// Зберегти чернетку з чату AI-помічника як .docx: у справу (asTemplate=false) або як
// багаторазовий шаблон у «Шаблони документів» (asTemplate=true).
export function saveAiDraftToApi({ caseNumber, text, title = "", asTemplate = false, folder = "" }) {
  return apiRequest("/api/ai/documents/draft/", {
    method: "POST",
    body: { caseNumber, text, title, asTemplate, folder }
  });
}

// Текст документа (для оновлення прев'ю після редагування в ONLYOFFICE).
export function getDocumentTextFromApi(documentId) {
  return apiRequest(`/api/ai/documents/${encodeURIComponent(documentId)}/text/`);
}

// AI робить шаблон із готового тексту (кнопка «Зробити шаблон» у прев'ю).
export function makeTemplateFromTextWithAi({ text, title = "" }) {
  return apiRequest("/api/documents/templates/from-document/", {
    method: "POST",
    body: { text, title }
  });
}

// Скачати .docx із тексту (кнопка «Скачати на комп'ютер») — повертає Blob.
export async function downloadDocxFromTextApi({ text, title = "" }) {
  const baseUrl = apiBaseUrl();
  if (!baseUrl) throw new Error("CRM API base URL is not configured");
  const response = await fetch(`${baseUrl}/api/ai/documents/docx/`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", "X-CSRFToken": readCookie("csrftoken") },
    body: JSON.stringify({ text, title })
  });
  if (!response.ok) throw new Error(await response.text());
  return response.blob();
}

// AI помічники — база знань (per-area editable "skills").
export function getAiSkillsFromApi() {
  return apiRequest("/api/ai/skills/");
}

export function saveAiSkillToApi(areaKey, payload) {
  return apiRequest(`/api/ai/skills/${encodeURIComponent(areaKey)}/`, {
    method: "PUT",
    body: payload
  });
}

export function deleteAiSkillFromApi(areaKey) {
  return apiRequest(`/api/ai/skills/${encodeURIComponent(areaKey)}/`, { method: "DELETE" });
}

// AI помічники — editable per-area quick questions (chat composer chips).
export function saveAiQuestionsToApi(areaKey, questions) {
  return apiRequest(`/api/ai/skills/${encodeURIComponent(areaKey)}/questions/`, {
    method: "PUT",
    body: { questions }
  });
}

// AI помічники — opt-in connected cases (which cases have an AI assistant).
export function getAiAssistantsFromApi() {
  return apiRequest("/api/ai/assistants/");
}

export function connectAiAssistantToApi(caseNumber) {
  return apiRequest("/api/ai/assistants/", { method: "POST", body: { caseNumber } });
}

export function disconnectAiAssistantFromApi(caseNumber) {
  return apiRequest(`/api/ai/assistants/${encodeURIComponent(caseNumber)}/`, { method: "DELETE" });
}

export function setAiAssistantActiveInApi(caseNumber, active) {
  return apiRequest(`/api/ai/assistants/${encodeURIComponent(caseNumber)}/`, {
    method: "PATCH",
    body: { active }
  });
}

// AI помічники — token usage / estimated spend & remaining budget.
export function getAiUsageFromApi() {
  return apiRequest("/api/ai/usage/");
}

// AI помічники — файли-знання (Этап 2): upload/list/delete knowledge documents per area.
export function getAiKnowledgeFromApi(areaKey) {
  return apiRequest(`/api/ai/knowledge/?area=${encodeURIComponent(areaKey)}`);
}

export function uploadAiKnowledgeToApi(areaKey, file) {
  const formData = new FormData();
  formData.append("area", areaKey);
  formData.append("file", file);
  return apiFormRequest("/api/ai/knowledge/", formData);
}

export function deleteAiKnowledgeFromApi(docId) {
  return apiRequest(`/api/ai/knowledge/${docId}/`, { method: "DELETE" });
}

// Export an AI conversation (висновок) to .docx — returns a Blob for download.
export async function exportAiConclusionDocx(payload) {
  const baseUrl = apiBaseUrl();
  if (!baseUrl) throw new Error("CRM API base URL is not configured");
  const response = await fetch(`${baseUrl}/api/ai/export/docx/`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", "X-CSRFToken": readCookie("csrftoken") },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(await response.text());
  return response.blob();
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
