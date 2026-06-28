import { apiRequest, saveDocumentToApi, shouldUseApi } from "./api.js";
import { docContentToHtml, docContentToDisplayHtml, sanitizeDocHtml, isHtmlDocContent } from "./doc-html.js";

export function createDialogOpeners({
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
}) {
  function escapeHtml(value = "") {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function todayIso() {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function isNeutralDemoAdminUser(user) {
    return state.dataSource === "api"
      && state.demoDataStatus?.enabled === false
      && !state.sessionAuthenticated
      && user?.role === "Адміністратор";
  }

  function displayManagerName(user) {
    if (isNeutralDemoAdminUser(user)) return "Admin";
    return String(user?.name || "").trim();
  }

  function clientManagerOptions(currentValue = "") {
    const emptyApiMode = state.dataSource === "api" && state.demoDataStatus?.enabled === false;
    const fallbackManagers = emptyApiMode ? [] : ["Іваненко А.Ю.", "Мельник Н.П.", "Кравчук А.В."];
    const names = [
      displayManagerName(state.currentUser),
      ...(state.settingsUsers || [])
        .filter((user) => user.role !== "Видалений" && user.active !== false)
        .map(displayManagerName),
      String(currentValue || "").trim(),
      ...fallbackManagers
    ].filter(Boolean);
    const uniqueNames = [...new Set(names)];
    return uniqueNames.length ? uniqueNames : ["Admin"];
  }

  function syncClientManagerOptions(form, currentValue = "") {
    const managerSelect = form.elements.manager;
    if (!managerSelect) return;
    const options = clientManagerOptions(currentValue);
    const selectedValue = options.includes(currentValue) ? currentValue : options[0];
    managerSelect.innerHTML = options.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("");
    managerSelect.value = selectedValue;
  }

  function syncCaseResponsibleOptions(form, currentValue = "") {
    const responsibleSelect = form.elements.responsible;
    if (!responsibleSelect) return;
    const options = clientManagerOptions(currentValue);
    const selectedValue = options.includes(currentValue) ? currentValue : options[0];
    responsibleSelect.innerHTML = options.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("");
    responsibleSelect.value = selectedValue;
  }

  function emptyCaseParty() {
    return { name: "", status: "", address: "", contact: "", email: "" };
  }

  function casePartyRows(item = {}) {
    if (Array.isArray(item.parties) && item.parties.length) return item.parties;
    const hasLegacyParty = [item.court, item.authorityType, item.authorityAddress, item.authorityContact, item.authorityEmail]
      .some((value) => String(value || "").trim() && value !== "Не вказано");
    if (!hasLegacyParty) return [emptyCaseParty()];
    return [{
      name: item.court === "Не вказано" ? "" : item.court || "",
      status: item.authorityType || "",
      address: item.authorityAddress || "",
      contact: item.authorityContact || "",
      email: item.authorityEmail || ""
    }];
  }

  function renderCasePartyEditor(form, parties = [emptyCaseParty()]) {
    const list = form.querySelector("[data-case-party-list]");
    if (!list) return;
    const rows = parties.length ? parties : [emptyCaseParty()];
    list.innerHTML = rows.map((party, index) => `
      <fieldset class="case-party-editor-row" data-case-party-row>
        <legend>Сторона ${index + 1}</legend>
        <label>Найменування сторони по справі
          <input name="partyName" value="${escapeHtml(party.name || "")}" placeholder="Суд, РТЦК та СП, фізична особа, юридична особа" />
        </label>
        <label>Статус сторони по справі
          <input name="partyStatus" value="${escapeHtml(party.status || "")}" placeholder="Позивач, відповідач, третя сторона, державний орган" />
        </label>
        <label>Адреса сторони по справі
          <input name="partyAddress" value="${escapeHtml(party.address || "")}" placeholder="Адреса сторони" />
        </label>
        <label>Контакт сторони по справі
          <input name="partyContact" value="${escapeHtml(party.contact || "")}" placeholder="Телефон або контактна особа" />
        </label>
        <label>Email сторони по справі
          <input name="partyEmail" type="email" value="${escapeHtml(party.email || "")}" placeholder="email@example.com" />
        </label>
        <button class="ghost danger-text" type="button" data-remove-case-party ${rows.length === 1 ? "disabled" : ""}>Видалити сторону</button>
      </fieldset>
    `).join("");
  }

  function syncTaskCoexecutorOptions(form, values = []) {
    const menu = form.querySelector(".task-coexecutors-menu");
    if (!menu) return;
    const normalized = Array.isArray(values)
      ? values.filter(Boolean)
      : String(values || "").split(",").map((value) => value.trim()).filter(Boolean);
    const options = [...new Set([...clientManagerOptions(), ...normalized])];
    menu.innerHTML = options.map((name) => `
      <label><input name="coexecutors" type="checkbox" value="${escapeHtml(name)}" /> ${escapeHtml(name)}</label>
    `).join("");
    setCoexecutorChecks(form, normalized);
  }

  function openClientDialog(clientId = null) {
    const form = $("#client-form");
    form.reset();
    form.elements.clientId.value = "";
    form.elements.showPhoto.checked = false;
    form.elements.photoUrl.value = "";
    $("#client-dialog-title").textContent = "Новий клієнт";
    syncClientManagerOptions(form);

    if (clientId !== null && clientId !== undefined) {
      const client = clientById(clientId);
      if (!client) {
        setupClientCustomSelects(form);
        $("#client-dialog").showModal();
        return;
      }
      form.elements.clientId.value = client.id;
      form.elements.name.value = client.name;
      form.elements.phone.value = client.phone;
      form.elements.email.value = client.email;
      form.elements.address.value = client.address || "";
      form.elements.telegramUsername.value = client.telegramUsername || "";
      form.elements.showPhoto.checked = Boolean(client.showPhoto && client.photoUrl);
      form.elements.photoUrl.value = client.photoUrl || "";
      form.elements.request.value = client.request;
      form.elements.status.value = client.status;
      form.elements.source.value = client.source;
      syncClientManagerOptions(form, client.manager);
      $("#client-dialog-title").textContent = "Редагувати клієнта";
    }

    setupClientCustomSelects(form);
    $("#client-dialog").showModal();
  }

  function parseDisplayDate(displayDate) {
    if (!displayDate || displayDate === "Не вказано") return "";
    const [day, month, yearWithTime] = displayDate.split(".");
    const year = yearWithTime?.split(" ")[0];
    if (!day || !month || !year) return "";
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  function closeDocumentSelectMenus(form, except = null) {
    form.querySelectorAll(".document-custom-select.is-open").forEach((selectShell) => {
      if (selectShell === except) return;
      selectShell.classList.remove("is-open");
      selectShell.querySelector(".document-custom-select-button")?.setAttribute("aria-expanded", "false");
      const menu = selectShell.querySelector(".document-custom-select-menu");
      if (menu) menu.hidden = true;
    });
  }

  function syncDocumentCustomSelect(select) {
    const shell = select.nextElementSibling?.classList?.contains("document-custom-select")
      ? select.nextElementSibling
      : null;
    if (!shell) return;
    const selected = select.selectedOptions?.[0] || select.options[0];
    const buttonText = shell.querySelector("[data-document-select-value]");
    const menu = shell.querySelector(".document-custom-select-menu");
    shell.classList.toggle("is-disabled", select.disabled);
    if (buttonText) buttonText.textContent = selected?.textContent || "";
    if (!menu) return;
    menu.innerHTML = [...select.options].filter((option) => !option.hidden).map((option) => `
      <button class="document-custom-select-option ${option.value === select.value ? "is-selected" : ""} ${option.disabled ? "is-disabled" : ""} ${option.dataset.proceduralOption === "true" ? "is-procedural-option" : ""}" type="button" role="option" data-value="${escapeHtml(option.value)}" aria-selected="${option.value === select.value ? "true" : "false"}" ${option.disabled ? "disabled" : ""}>
        <span aria-hidden="true">✓</span>
        <strong>${escapeHtml(option.textContent || "")}</strong>
      </button>
    `).join("");
  }

  function setupDocumentCustomSelects(form) {
    form.querySelectorAll(".document-editor-field > select").forEach((select) => {
      select.classList.add("document-native-select");
      select.tabIndex = -1;
      select.setAttribute("aria-hidden", "true");
      let shell = select.nextElementSibling?.classList?.contains("document-custom-select")
        ? select.nextElementSibling
        : null;
      if (!shell) {
        shell = document.createElement("div");
        shell.className = "document-custom-select";
        shell.innerHTML = `
          <button class="document-custom-select-button" type="button" aria-haspopup="listbox" aria-expanded="false">
            <span data-document-select-value></span>
            <span class="document-custom-select-chevron" aria-hidden="true"></span>
          </button>
          <div class="document-custom-select-menu" role="listbox" hidden></div>
        `;
        select.insertAdjacentElement("afterend", shell);
        shell.querySelector(".document-custom-select-button")?.addEventListener("click", () => {
          if (select.disabled) return;
          const isOpen = shell.classList.contains("is-open");
          closeDocumentSelectMenus(form, isOpen ? null : shell);
          shell.classList.toggle("is-open", !isOpen);
          shell.querySelector(".document-custom-select-button")?.setAttribute("aria-expanded", String(!isOpen));
          const menu = shell.querySelector(".document-custom-select-menu");
          if (menu) menu.hidden = isOpen;
        });
        shell.querySelector(".document-custom-select-menu")?.addEventListener("click", (event) => {
          const optionButton = event.target.closest(".document-custom-select-option");
          if (!optionButton) return;
          select.value = optionButton.dataset.value || "";
          select.dispatchEvent(new Event("change", { bubbles: true }));
          syncDocumentCustomSelect(select);
          closeDocumentSelectMenus(form);
        });
      }
      if (!select.dataset.documentSelectSyncBound) {
        select.dataset.documentSelectSyncBound = "true";
        select.addEventListener("change", () => syncDocumentCustomSelect(select));
      }
      syncDocumentCustomSelect(select);
    });
    if (!form.dataset.documentCustomSelectsBound) {
      form.dataset.documentCustomSelectsBound = "true";
      form.addEventListener("click", (event) => {
        if (event.target.closest(".document-custom-select")) return;
        closeDocumentSelectMenus(form);
      });
      form.addEventListener("keydown", (event) => {
        if (event.key === "Escape") closeDocumentSelectMenus(form);
      });
    }
  }

  function setupCaseCustomSelects(form) {
    form.querySelectorAll("label > select").forEach((select) => {
      select.classList.add("document-native-select");
      select.tabIndex = -1;
      select.setAttribute("aria-hidden", "true");
      let shell = select.nextElementSibling?.classList?.contains("document-custom-select")
        ? select.nextElementSibling
        : null;
      if (!shell) {
        shell = document.createElement("div");
        shell.className = "document-custom-select case-custom-select";
        shell.innerHTML = `
          <button class="document-custom-select-button" type="button" aria-haspopup="listbox" aria-expanded="false">
            <span data-document-select-value></span>
            <span class="document-custom-select-chevron" aria-hidden="true"></span>
          </button>
          <div class="document-custom-select-menu" role="listbox" hidden></div>
        `;
        select.insertAdjacentElement("afterend", shell);
        shell.querySelector(".document-custom-select-button")?.addEventListener("click", () => {
          if (select.disabled) return;
          const isOpen = shell.classList.contains("is-open");
          closeDocumentSelectMenus(form, isOpen ? null : shell);
          shell.classList.toggle("is-open", !isOpen);
          shell.querySelector(".document-custom-select-button")?.setAttribute("aria-expanded", String(!isOpen));
          const menu = shell.querySelector(".document-custom-select-menu");
          if (menu) menu.hidden = isOpen;
        });
        shell.querySelector(".document-custom-select-menu")?.addEventListener("click", (event) => {
          const optionButton = event.target.closest(".document-custom-select-option");
          if (!optionButton) return;
          select.value = optionButton.dataset.value || "";
          select.dispatchEvent(new Event("change", { bubbles: true }));
          syncDocumentCustomSelect(select);
          closeDocumentSelectMenus(form);
        });
      }
      if (!select.dataset.caseSelectSyncBound) {
        select.dataset.caseSelectSyncBound = "true";
        select.addEventListener("change", () => syncDocumentCustomSelect(select));
      }
      syncDocumentCustomSelect(select);
    });
    if (!form.dataset.caseCustomSelectsBound) {
      form.dataset.caseCustomSelectsBound = "true";
      form.addEventListener("click", (event) => {
        if (event.target.closest(".document-custom-select")) return;
        closeDocumentSelectMenus(form);
      });
      form.addEventListener("keydown", (event) => {
        if (event.key === "Escape") closeDocumentSelectMenus(form);
      });
    }
  }

  function setupClientCustomSelects(form) {
    form.querySelectorAll("label > select, .task-subtask-editor-row > select").forEach((select) => {
      select.classList.add("document-native-select");
      select.tabIndex = -1;
      select.setAttribute("aria-hidden", "true");
      let shell = select.nextElementSibling?.classList?.contains("document-custom-select")
        ? select.nextElementSibling
        : null;
      if (!shell) {
        shell = document.createElement("div");
        shell.className = "document-custom-select client-custom-select";
        shell.innerHTML = `
          <button class="document-custom-select-button" type="button" aria-haspopup="listbox" aria-expanded="false">
            <span data-document-select-value></span>
            <span class="document-custom-select-chevron" aria-hidden="true"></span>
          </button>
          <div class="document-custom-select-menu" role="listbox" hidden></div>
        `;
        select.insertAdjacentElement("afterend", shell);
        shell.querySelector(".document-custom-select-button")?.addEventListener("click", () => {
          const isOpen = shell.classList.contains("is-open");
          closeDocumentSelectMenus(form, isOpen ? null : shell);
          shell.classList.toggle("is-open", !isOpen);
          shell.querySelector(".document-custom-select-button")?.setAttribute("aria-expanded", String(!isOpen));
          const menu = shell.querySelector(".document-custom-select-menu");
          if (menu) menu.hidden = isOpen;
        });
        shell.querySelector(".document-custom-select-menu")?.addEventListener("click", (event) => {
          const optionButton = event.target.closest(".document-custom-select-option");
          if (!optionButton) return;
          select.value = optionButton.dataset.value || "";
          select.dispatchEvent(new Event("change", { bubbles: true }));
          syncDocumentCustomSelect(select);
          closeDocumentSelectMenus(form);
        });
      }
      if (!select.dataset.clientSelectSyncBound) {
        select.dataset.clientSelectSyncBound = "true";
        select.addEventListener("change", () => syncDocumentCustomSelect(select));
      }
      syncDocumentCustomSelect(select);
    });
    if (!form.dataset.clientCustomSelectsBound) {
      form.dataset.clientCustomSelectsBound = "true";
      form.addEventListener("click", (event) => {
        if (event.target.closest(".document-custom-select")) return;
        closeDocumentSelectMenus(form);
      });
      form.addEventListener("keydown", (event) => {
        if (event.key === "Escape") closeDocumentSelectMenus(form);
      });
    }
  }

  function openCaseDialog(caseId = null) {
    const form = $("#case-form");
    form.reset();
    $("#case-client").innerHTML = state.clients.map((client) => `<option value="${client.id}">${escapeHtml(client.name)}</option>`).join("");
    form.elements.caseId.value = "";
    form.elements.number.value = "";
    $("#case-dialog-title").textContent = "Нова справа";
    $("#case-submit-button").textContent = "Створити справу";
    syncCaseResponsibleOptions(form);

    if (caseId !== null && caseId !== undefined) {
      const item = caseById(caseId);
      if (!item) {
        $("#case-dialog").showModal();
        return;
      }
      form.elements.caseId.value = item.id;
      form.elements.number.value = item.id;
      form.elements.clientId.value = item.clientId;
      form.elements.title.value = item.title;
      form.elements.type.value = item.type;
      form.elements.status.value = item.status;
      syncCaseResponsibleOptions(form, item.responsible);
      $("#case-dialog-title").textContent = "Редагувати справу";
      $("#case-submit-button").textContent = "Зберегти справу";
    }

    setupCaseCustomSelects(form);
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
    renderCasePartyEditor(form, casePartyRows(item));
    if (!form.dataset.partyEditorBound) {
      form.dataset.partyEditorBound = "true";
      form.addEventListener("click", (event) => {
        const addButton = event.target.closest("[data-add-case-party]");
        if (addButton) {
          const current = collectCaseParties(form);
          renderCasePartyEditor(form, [...current, emptyCaseParty()]);
          return;
        }
        const removeButton = event.target.closest("[data-remove-case-party]");
        if (removeButton) {
          const rows = [...form.querySelectorAll("[data-case-party-row]")];
          if (rows.length <= 1) return;
          removeButton.closest("[data-case-party-row]")?.remove();
          renderCasePartyEditor(form, collectCaseParties(form));
        }
      });
    }
    $("#authority-dialog").showModal();
  }

  function collectCaseParties(form) {
    return [...form.querySelectorAll("[data-case-party-row]")].map((row) => ({
      name: row.querySelector('[name="partyName"]')?.value.trim() || "",
      status: row.querySelector('[name="partyStatus"]')?.value.trim() || "",
      address: row.querySelector('[name="partyAddress"]')?.value.trim() || "",
      contact: row.querySelector('[name="partyContact"]')?.value.trim() || "",
      email: row.querySelector('[name="partyEmail"]')?.value.trim() || ""
    })).filter((party) => Object.values(party).some(Boolean));
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
    const findInFolders = (list = folders, path = []) => {
      for (let folderIndex = 0; folderIndex < list.length; folderIndex += 1) {
        const folder = list[folderIndex];
        const folderPath = [...path, folderIndex];
        const files = folder.files || [];
        const fileIndex = doc?.documentId
          ? files.findIndex((file) => file.documentId === doc.documentId)
          : files.findIndex((file) => file.name === doc?.name);
        if (fileIndex >= 0) return {
          folder,
          folderIndex: folderPath[0],
          folderPath,
          file: files[fileIndex],
          fileIndex
        };
        const nested = findInFolders(folder.children || [], folderPath);
        if (nested) return nested;
      }
      return null;
    };
    return findInFolders();
  }

  function folderByPath(folders = [], path = []) {
    let current = null;
    let list = folders;
    for (const index of path) {
      current = list[Number(index)];
      if (!current) return null;
      list = current.children || [];
    }
    return current;
  }

  function getDocumentPayload(caseId, encoded) {
    const item = caseById(caseId);
    const [source, first, second] = encoded.split(":");
    if (source === "procedural") {
      const docIndex = Number(first);
      return { item, source, docIndex, doc: item.documents[docIndex], linked: findFolderFileByDocument(item, item.documents[docIndex]) };
    }
    if (source === "folderPath") {
      const folderPath = String(first || "").split(".").map((value) => Number(value)).filter((value) => Number.isInteger(value));
      const fileIndex = Number(second);
      const folder = folderByPath(caseFolders(item), folderPath);
      const file = folder?.files?.[fileIndex];
      const docIndex = file?.documentId
        ? item.documents.findIndex((doc) => doc.documentId === file.documentId)
        : item.documents.findIndex((doc) => doc.name === file?.name);
      return { item, source, folderIndex: folderPath[0] ?? -1, folderPath, fileIndex, folder, file, docIndex, doc: item.documents[docIndex] };
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

  function openDocumentFile(documentData) {
    if (!documentData) return;
    if (documentData.fileUrl) {
      window.open(absoluteCrmUrl(documentData.fileUrl), "_blank", "noopener");
      return;
    }
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

  function safeFileName(value = "document") {
    return String(value || "document")
      .trim()
      .replace(/[\\/:*?"<>|]+/g, "-")
      .replace(/\s+/g, " ")
      .slice(0, 90) || "document";
  }

  function defaultDocumentContent(item, client, form = null) {
    const title = form?.elements.name?.value || "Новий документ";
    const type = form?.elements.type?.value || "Документ";
    return [
      `${type}`,
      "",
      `Назва: ${title}`,
      `Справа: №${item?.id || ""}`,
      `Клієнт: ${client?.name || "Не вказано"}`,
      "",
      "Текст документа:",
      "",
      "Опишіть зміст звернення, правову позицію, прохальну частину або перелік документів.",
      "",
      "Додатки:",
      "1. Документи на підтвердження обставин.",
      "2. Інші матеріали справи.",
      "",
      "З повагою,",
      item?.responsible || "Адвокат"
    ].join("\n");
  }

  function buildDocumentExport(documentData, previewContext = {}) {
    if (!documentData) return;
    const item = previewContext.caseId ? caseById(previewContext.caseId) : previewContext.item || null;
    const client = item ? clientById(item.clientId) : null;
    const folderName = previewContext.folderName || previewContext.editContext?.folder?.name || previewContext.editContext?.linked?.folder?.name || documentData.folder || "Не вказано";
    const body = documentData.content || documentData.comment || defaultDocumentContent(item, client);
    const title = documentData.name || "Документ";
    const baseName = safeFileName(title).replace(/\.(docx?|pdf|html?|txt)$/i, "");
    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; color: #111827; line-height: 1.45; }
    h1 { font-size: 14px; line-height: 1.2; margin: 0 0 12px; }
    .meta { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
    .meta td { border: 1px solid #d9e2ef; padding: 7px 9px; font-size: 12px; }
    .meta td:first-child { width: 160px; color: #5b6b82; font-weight: 700; }
    .content { font-size: 14px; }
    .content.is-plain { white-space: pre-wrap; }
    .content h1, .content h2, .content h3 { font-size: 15px; margin: 12px 0 6px; }
    .content p { margin: 0 0 8px; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <table class="meta">
    <tr><td>Справа</td><td>${escapeHtml(item ? `№${item.id}` : documentData.caseId || "Не вказано")}</td></tr>
    <tr><td>Клієнт</td><td>${escapeHtml(client?.name || documentData.client || "Не вказано")}</td></tr>
    <tr><td>Папка</td><td>${escapeHtml(folderName)}</td></tr>
    <tr><td>Тип</td><td>${escapeHtml(documentData.type || "Не вказано")}</td></tr>
    <tr><td>Статус</td><td>${escapeHtml(documentData.status || "Без статусу")}</td></tr>
  </table>
  <div class="content${isHtmlDocContent(body) ? "" : " is-plain"}">${docContentToDisplayHtml(body)}</div>
</body>
</html>`;
    const text = [
      title,
      "",
      `Справа: ${item ? `№${item.id}` : documentData.caseId || "Не вказано"}`,
      `Клієнт: ${client?.name || documentData.client || "Не вказано"}`,
      `Папка: ${folderName}`,
      `Тип: ${documentData.type || "Не вказано"}`,
      `Статус: ${documentData.status || "Без статусу"}`,
      "",
      body
    ].join("\n");
    return { baseName, body, client, folderName, html, item, text, title };
  }

  function downloadExportBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function bytesFromString(value) {
    return new TextEncoder().encode(value);
  }

  function crc32(bytes) {
    let crc = -1;
    for (const byte of bytes) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit += 1) {
        crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
      }
    }
    return (crc ^ -1) >>> 0;
  }

  function numberBytes(value, length) {
    return Array.from({ length }, (_, index) => (value >>> (index * 8)) & 0xff);
  }

  function zipStore(entries) {
    const chunks = [];
    const central = [];
    let offset = 0;
    entries.forEach(({ name, content }) => {
      const nameBytes = bytesFromString(name);
      const dataBytes = typeof content === "string" ? bytesFromString(content) : content;
      const checksum = crc32(dataBytes);
      const localHeader = new Uint8Array([
        ...numberBytes(0x04034b50, 4), ...numberBytes(20, 2), ...numberBytes(0, 2),
        ...numberBytes(0, 2), ...numberBytes(0, 2), ...numberBytes(0, 2),
        ...numberBytes(checksum, 4), ...numberBytes(dataBytes.length, 4),
        ...numberBytes(dataBytes.length, 4), ...numberBytes(nameBytes.length, 2),
        ...numberBytes(0, 2)
      ]);
      chunks.push(localHeader, nameBytes, dataBytes);
      central.push({ checksum, dataBytes, nameBytes, offset });
      offset += localHeader.length + nameBytes.length + dataBytes.length;
    });
    const centralStart = offset;
    central.forEach(({ checksum, dataBytes, nameBytes, offset: localOffset }) => {
      const header = new Uint8Array([
        ...numberBytes(0x02014b50, 4), ...numberBytes(20, 2), ...numberBytes(20, 2),
        ...numberBytes(0, 2), ...numberBytes(0, 2), ...numberBytes(0, 2),
        ...numberBytes(0, 2), ...numberBytes(checksum, 4),
        ...numberBytes(dataBytes.length, 4), ...numberBytes(dataBytes.length, 4),
        ...numberBytes(nameBytes.length, 2), ...numberBytes(0, 2),
        ...numberBytes(0, 2), ...numberBytes(0, 2), ...numberBytes(0, 2),
        ...numberBytes(0, 4), ...numberBytes(localOffset, 4)
      ]);
      chunks.push(header, nameBytes);
      offset += header.length + nameBytes.length;
    });
    const centralSize = offset - centralStart;
    chunks.push(new Uint8Array([
      ...numberBytes(0x06054b50, 4), ...numberBytes(0, 2), ...numberBytes(0, 2),
      ...numberBytes(entries.length, 2), ...numberBytes(entries.length, 2),
      ...numberBytes(centralSize, 4), ...numberBytes(centralStart, 4),
      ...numberBytes(0, 2)
    ]));
    return new Blob(chunks, { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  }

  function makeDocxBlob(exportData) {
    const paragraphs = exportData.text.split("\n").map((line) => (
      `<w:p><w:r><w:t xml:space="preserve">${escapeHtml(line)}</w:t></w:r></w:p>`
    )).join("");
    return zipStore([
      {
        name: "[Content_Types].xml",
        content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
          + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
          + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
          + '<Default Extension="xml" ContentType="application/xml"/>'
          + '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
          + "</Types>"
      },
      {
        name: "_rels/.rels",
        content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
          + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
          + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
          + "</Relationships>"
      },
      {
        name: "word/document.xml",
        content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
          + '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
          + `<w:body>${paragraphs}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>`
          + '<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body>'
          + "</w:document>"
      }
    ]);
  }

  function bytesFromBinary(value) {
    return Uint8Array.from(value, (char) => char.charCodeAt(0));
  }

  function wrapPdfText(text = "", maxLength = 88) {
    const rows = [];
    String(text || "").split("\n").forEach((paragraph) => {
      const words = paragraph.split(/\s+/).filter(Boolean);
      if (!words.length) {
        rows.push("");
        return;
      }
      let line = "";
      words.forEach((word) => {
        if (word.length > maxLength) {
          if (line) rows.push(line);
          for (let index = 0; index < word.length; index += maxLength) {
            rows.push(word.slice(index, index + maxLength));
          }
          line = "";
          return;
        }
        const next = line ? `${line} ${word}` : word;
        if (next.length > maxLength) {
          rows.push(line);
          line = word;
        } else {
          line = next;
        }
      });
      if (line) rows.push(line);
    });
    return rows;
  }

  function canvasToJpegBytes(canvas) {
    return new Promise((resolve) => {
      canvas.toBlob(async (blob) => {
        if (!blob) {
          resolve(new Uint8Array());
          return;
        }
        resolve(new Uint8Array(await blob.arrayBuffer()));
      }, "image/jpeg", .92);
    });
  }

  async function renderPdfPageImage(lines, pageIndex, pageCount) {
    const canvas = document.createElement("canvas");
    canvas.width = 1240;
    canvas.height = 1754;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#111827";
    ctx.textBaseline = "top";
    ctx.font = "700 28px Arial, sans-serif";
    let y = 92;
    lines.forEach((line, index) => {
      ctx.font = index === 0 ? "700 30px Arial, sans-serif" : "22px Arial, sans-serif";
      ctx.fillText(line, 96, y);
      y += index === 0 ? 52 : 34;
    });
    ctx.fillStyle = "#64748b";
    ctx.font = "18px Arial, sans-serif";
    ctx.fillText(`${pageIndex + 1} / ${pageCount}`, 1080, 1668);
    return canvasToJpegBytes(canvas);
  }

  async function makePdfBlob(exportData) {
    const rows = wrapPdfText(exportData.text);
    const pageSize = 44;
    const pages = [];
    for (let index = 0; index < rows.length || index === 0; index += pageSize) {
      pages.push(rows.slice(index, index + pageSize));
    }
    const images = [];
    for (let index = 0; index < pages.length; index += 1) {
      images.push(await renderPdfPageImage(pages[index], index, pages.length));
    }
    const chunks = [];
    const offsets = [];
    let position = 0;
    const pushBytes = (bytes) => {
      chunks.push(bytes);
      position += bytes.length;
    };
    const pushString = (value) => pushBytes(bytesFromString(value));
    const addObject = (number, parts) => {
      offsets[number] = position;
      pushString(`${number} 0 obj\n`);
      parts.forEach((part) => typeof part === "string" ? pushString(part) : pushBytes(part));
      pushString("\nendobj\n");
    };
    pushString("%PDF-1.4\n");
    addObject(1, ["<< /Type /Catalog /Pages 2 0 R >>"]);
    const pageObjects = images.map((_, index) => 3 + (index * 3));
    addObject(2, [`<< /Type /Pages /Kids [${pageObjects.map((number) => `${number} 0 R`).join(" ")}] /Count ${pageObjects.length} >>`]);
    images.forEach((imageBytes, index) => {
      const pageObject = 3 + (index * 3);
      const contentObject = pageObject + 1;
      const imageObject = pageObject + 2;
      const imageName = `Im${index}`;
      const stream = `q\n595 0 0 842 0 0 cm\n/${imageName} Do\nQ`;
      addObject(pageObject, [`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /${imageName} ${imageObject} 0 R >> >> /Contents ${contentObject} 0 R >>`]);
      addObject(contentObject, [`<< /Length ${bytesFromString(stream).length} >>\nstream\n${stream}\nendstream`]);
      addObject(imageObject, [
        `<< /Type /XObject /Subtype /Image /Width 1240 /Height 1754 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imageBytes.length} >>\nstream\n`,
        imageBytes,
        "\nendstream"
      ]);
    });
    const xrefPosition = position;
    pushString(`xref\n0 ${offsets.length}\n0000000000 65535 f \n`);
    for (let index = 1; index < offsets.length; index += 1) {
      pushString(`${String(offsets[index]).padStart(10, "0")} 00000 n \n`);
    }
    pushString(`trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xrefPosition}\n%%EOF`);
    return new Blob(chunks, { type: "application/pdf" });
  }

  async function performDocumentExport(documentData, previewContext = {}, format = "word") {
    const exportData = buildDocumentExport(documentData, previewContext);
    if (!exportData) return;
    if (format === "pdf") {
      downloadExportBlob(await makePdfBlob(exportData), `${exportData.baseName}.pdf`);
      showToast(`Експортовано PDF «${exportData.title}».`);
      return;
    }
    if (format === "html") {
      downloadExportBlob(
        new Blob(["\ufeff", exportData.html], { type: "text/html;charset=utf-8" }),
        `${exportData.baseName}.html`
      );
    } else if (format === "txt") {
      downloadExportBlob(
        new Blob(["\ufeff", exportData.text], { type: "text/plain;charset=utf-8" }),
        `${exportData.baseName}.txt`
      );
    } else {
      downloadExportBlob(
        makeDocxBlob(exportData),
        `${exportData.baseName}.docx`
      );
    }
    showToast(`Експортовано документ «${exportData.title}».`);
  }

  function openDocumentExportDialog(documentData, previewContext = {}) {
    if (!documentData) return;
    const dialog = $("#document-export-dialog");
    if (!dialog) {
      performDocumentExport(documentData, previewContext, "word");
      return;
    }
    const item = previewContext.caseId ? caseById(previewContext.caseId) : previewContext.item || null;
    state.pendingDocumentExport = { documentData, previewContext, format: "word" };
    $("#document-export-name").textContent = documentData.name || "Документ";
    $("#document-export-case").textContent = item
      ? `№${item.id} · файл буде збережено на комп'ютер`
      : "Файл буде збережено на комп'ютер";
    const formatBadge = dialog.querySelector(".document-export-file > span");
    const formatLabels = {
      html: "HTML",
      pdf: "PDF",
      txt: "TXT",
      word: "DOC"
    };
    const setExportFormat = (format = "word") => {
      const normalized = formatLabels[format] ? format : "word";
      if (state.pendingDocumentExport) state.pendingDocumentExport.format = normalized;
      dialog.querySelectorAll('input[name="documentExportFormat"]').forEach((input) => {
        input.checked = input.value === normalized;
        input.closest("label")?.classList.toggle("is-selected", input.value === normalized);
      });
      if (formatBadge) formatBadge.textContent = formatLabels[normalized];
    };
    dialog.querySelectorAll('input[name="documentExportFormat"]').forEach((input) => {
      input.onchange = () => setExportFormat(input.value);
      const label = input.closest("label");
      if (label) label.onclick = () => setExportFormat(input.value);
    });
    setExportFormat("word");
    $("#document-export-cancel").onclick = () => {
      state.pendingDocumentExport = null;
      dialog.close();
    };
    $("#document-export-confirm").onclick = () => {
      const pending = state.pendingDocumentExport;
      if (!pending) return;
      const format = pending.format || dialog.querySelector('input[name="documentExportFormat"]:checked')?.value || "word";
      dialog.close();
      state.pendingDocumentExport = null;
      performDocumentExport(pending.documentData, pending.previewContext, format);
    };
    dialog.showModal();
  }

  function exportStoredDocument(documentData, previewContext = {}) {
    openDocumentExportDialog(documentData, previewContext);
  }

  function normalizedServerUrl(value = "") {
    return String(value || "").trim().replace(/\/+$/, "");
  }

  function isLocalOnlyOfficeUrl(value = "") {
    try {
      const url = new URL(normalizedServerUrl(value));
      return ["localhost", "127.0.0.1", "0.0.0.0", "host.docker.internal", "host.lima.internal"].includes(url.hostname);
    } catch (_error) {
      return false;
    }
  }

  function isOnlyOfficeCloudUrl(value = "") {
    try {
      return new URL(normalizedServerUrl(value)).hostname.endsWith(".docs.onlyoffice.com");
    } catch (_error) {
      return false;
    }
  }

  function loadOnlyOfficeApi(documentServerUrl) {
    return new Promise((resolve, reject) => {
      if (window.DocsAPI?.DocEditor) {
        resolve();
        return;
      }
      const src = `${documentServerUrl}/web-apps/apps/api/documents/api.js`;
      const existing = document.querySelector(`script[data-onlyoffice-api="${src}"]`);
      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error("ONLYOFFICE API load failed")), { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.dataset.onlyofficeApi = src;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("ONLYOFFICE API load failed"));
      document.head.append(script);
    });
  }

  function officeEditorSetupView(documentData, settings, reason = "") {
    const serverUrl = normalizedServerUrl(settings.documentServerUrl);
    const serverAccessUrl = normalizedServerUrl(settings.serverAccessUrl);
    const formatLabel = onlyOfficeFileType(documentData).toUpperCase();
    return `
      <div class="office-editor-empty">
        <span aria-hidden="true">${escapeHtml(reason ? "!" : formatLabel || "DOC")}</span>
        <h3>${escapeHtml(reason || "ONLYOFFICE ще не підключено")}</h3>
        <p>Щоб відкривати та редагувати документи як у Word або Google Docs, CRM має передати файл через окремий Document Server.</p>
        <div class="office-editor-checklist">
          <strong>Що потрібно для бойового режиму</strong>
          <ul>
            <li>Document Server URL у налаштуваннях: ${escapeHtml(serverUrl || "не вказано")}</li>
            <li>CRM URL для Document Server: ${escapeHtml(serverAccessUrl || "не вказано")}</li>
            <li>Callback URL, щоб CRM отримувала збережену версію</li>
            <li>JWT secret для захищеного обміну</li>
          </ul>
        </div>
        <small>Документ: ${escapeHtml(documentData?.name || "Не вибрано")}</small>
      </div>
    `;
  }

  function onlyOfficeFileType(documentData = {}, documentUrl = "") {
    const candidates = [
      documentData.fileName,
      documentData.name,
      documentData.type,
      cleanUrl(documentUrl).split("?")[0].split("#")[0]
    ];
    for (const candidate of candidates) {
      const match = String(candidate || "").trim().toLowerCase().match(/\.?([a-z0-9]+)$/);
      const ext = match?.[1] || "";
      if (["doc", "docx", "odt", "rtf", "txt", "pdf", "xls", "xlsx", "ods", "csv", "ppt", "pptx", "odp"].includes(ext)) {
        return ext;
      }
    }
    return "docx";
  }

  function onlyOfficeDocumentType(fileType = "docx") {
    if (["xls", "xlsx", "ods", "csv"].includes(fileType)) return "cell";
    if (["ppt", "pptx", "odp"].includes(fileType)) return "slide";
    if (fileType === "pdf") return "pdf";
    return "word";
  }

  function officeSubtitle(fileType = "docx") {
    if (fileType === "pdf") return "Перегляд PDF через ONLYOFFICE Document Server.";
    if (["xls", "xlsx", "ods", "csv"].includes(fileType)) return "Робота з таблицею через ONLYOFFICE Document Server.";
    if (["ppt", "pptx", "odp"].includes(fileType)) return "Робота з презентацією через ONLYOFFICE Document Server.";
    return "Повноцінне редагування документа через ONLYOFFICE Document Server.";
  }

  function onlyOfficeDocumentKey(documentData = {}, fileType = "docx", documentUrl = "") {
    const raw = [
      documentData.documentId || documentData.id || Date.now(),
      fileType,
      documentData.fileName || documentData.name || "",
      documentUrl
    ].join("-");
    let hash = 0;
    for (let index = 0; index < raw.length; index += 1) {
      hash = ((hash << 5) - hash + raw.charCodeAt(index)) | 0;
    }
    return `crm-${String(documentData.documentId || documentData.id || "document")}-${fileType}-${Math.abs(hash)}`.slice(0, 120);
  }

  function setOfficeSaveStatus(dialog, label, statusName = "idle") {
    const el = dialog?.querySelector(".office-editor-save-status");
    if (!el) return;
    el.dataset.state = statusName;
    el.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"></path></svg>${escapeHtml(label)}`;
  }

  function updateDocumentContentInState(documentData, content) {
    const ids = new Set(
      [documentData.documentId, documentData.id]
        .filter((value) => value !== undefined && value !== null && value !== "")
        .map((value) => String(value))
    );
    const matches = (doc) => {
      const candidates = [doc.documentId, doc.id]
        .filter((value) => value !== undefined && value !== null && value !== "")
        .map((value) => String(value));
      return candidates.some((value) => ids.has(value));
    };
    (state.cases || []).forEach((caseItem) => {
      (caseItem.documents || []).forEach((doc) => {
        if (matches(doc)) doc.content = content;
      });
    });
    const walkFolders = (folders = []) => {
      folders.forEach((folder) => {
        (folder.documents || []).forEach((doc) => {
          if (matches(doc)) doc.content = content;
        });
        walkFolders(folder.children || []);
      });
    };
    walkFolders(state.documentArchiveFolders || []);
    documentData.content = content;
  }

  function builtInDocEditorView(documentData) {
    const html = docContentToHtml(documentData.content || documentData.comment || "");
    return `
      <div class="builtin-doc-editor">
        <div class="builtin-doc-toolbar" role="toolbar" aria-label="Форматування документа">
          <div class="builtin-doc-toolbar-group">
            <button type="button" data-doc-cmd="undo" title="Скасувати (Ctrl+Z)" aria-label="Скасувати">↶</button>
            <button type="button" data-doc-cmd="redo" title="Повторити (Ctrl+Y)" aria-label="Повторити">↷</button>
          </div>
          <span class="builtin-doc-toolbar-sep"></span>
          <select class="builtin-doc-block" data-doc-block title="Стиль абзацу">
            <option value="P">Звичайний текст</option>
            <option value="H1">Заголовок 1</option>
            <option value="H2">Заголовок 2</option>
            <option value="H3">Заголовок 3</option>
          </select>
          <span class="builtin-doc-toolbar-sep"></span>
          <div class="builtin-doc-toolbar-group">
            <button type="button" data-doc-cmd="bold" title="Жирний (Ctrl+B)" aria-label="Жирний"><b>Ж</b></button>
            <button type="button" data-doc-cmd="italic" title="Курсив (Ctrl+I)" aria-label="Курсив"><i>К</i></button>
            <button type="button" data-doc-cmd="underline" title="Підкреслений (Ctrl+U)" aria-label="Підкреслений"><u>П</u></button>
            <button type="button" data-doc-cmd="strikeThrough" title="Закреслений" aria-label="Закреслений"><s>З</s></button>
          </div>
          <span class="builtin-doc-toolbar-sep"></span>
          <div class="builtin-doc-toolbar-group">
            <button type="button" data-doc-cmd="insertUnorderedList" title="Маркований список" aria-label="Маркований список">•</button>
            <button type="button" data-doc-cmd="insertOrderedList" title="Нумерований список" aria-label="Нумерований список">1.</button>
          </div>
          <span class="builtin-doc-toolbar-sep"></span>
          <div class="builtin-doc-toolbar-group">
            <button type="button" data-doc-cmd="justifyLeft" title="Вирівняти ліворуч" aria-label="Ліворуч">⯇</button>
            <button type="button" data-doc-cmd="justifyCenter" title="По центру" aria-label="По центру">≡</button>
            <button type="button" data-doc-cmd="justifyRight" title="Вирівняти праворуч" aria-label="Праворуч">⯈</button>
          </div>
          <span class="builtin-doc-toolbar-sep"></span>
          <div class="builtin-doc-toolbar-group">
            <button type="button" data-doc-cmd="removeFormat" title="Очистити форматування" aria-label="Очистити форматування">⌫</button>
          </div>
        </div>
        <div class="builtin-doc-editor-page">
          <div class="builtin-doc-editor-area" contenteditable="true" spellcheck="true" role="textbox" aria-multiline="true" aria-label="Текст документа">${html}</div>
        </div>
      </div>
    `;
  }

  function mountBuiltInDocEditor(documentData, dialog, body) {
    const subtitle = dialog.querySelector("#office-editor-subtitle");
    if (subtitle) subtitle.textContent = "Повноцінне редагування документа у вбудованому редакторі CRM.";
    body.innerHTML = builtInDocEditorView(documentData);
    const area = body.querySelector(".builtin-doc-editor-area");
    const toolbar = body.querySelector(".builtin-doc-toolbar");
    const blockSelect = body.querySelector("[data-doc-block]");
    if (!area) return;
    setOfficeSaveStatus(dialog, "Збережено", "saved");
    const hasBackendId = documentData.id !== undefined && documentData.id !== null && documentData.id !== "";
    let lastSaved = sanitizeDocHtml(area.innerHTML);
    let timer = null;
    let saving = false;

    const persist = async () => {
      const content = sanitizeDocHtml(area.innerHTML);
      if (content === lastSaved) return;
      const pending = content;
      updateDocumentContentInState(documentData, content);
      if (shouldUseApi(state) && hasBackendId) {
        saving = true;
        setOfficeSaveStatus(dialog, "Зберігаємо…", "saving");
        try {
          await saveDocumentToApi({
            id: documentData.id,
            caseId: documentData.caseId,
            documentId: documentData.documentId,
            name: documentData.name,
            type: documentData.type,
            folder: documentData.folder,
            status: documentData.status,
            submitted: documentData.submitted,
            responseDue: documentData.responseDue,
            comment: documentData.comment,
            content: pending,
            responsible: documentData.responsible,
            url: documentData.url
          });
        } catch (_error) {
          saving = false;
          setOfficeSaveStatus(dialog, "Не збережено", "error");
          showToast("Не вдалося зберегти документ. Перевірте з'єднання.", "warning");
          return;
        }
        saving = false;
      }
      lastSaved = pending;
      setOfficeSaveStatus(dialog, "Збережено", "saved");
    };

    const scheduleSave = () => {
      if (!saving) setOfficeSaveStatus(dialog, "Редагування…", "saving");
      clearTimeout(timer);
      timer = setTimeout(persist, 700);
    };

    const syncBlockSelect = () => {
      if (!blockSelect) return;
      let node = document.getSelection()?.anchorNode || null;
      while (node && node !== area && node.nodeType !== 1) node = node.parentNode;
      let tag = "P";
      while (node && node !== area) {
        const name = node.tagName;
        if (name && /^(H1|H2|H3|P)$/.test(name)) { tag = name; break; }
        node = node.parentNode;
      }
      blockSelect.value = tag;
    };

    // Toolbar: run commands without losing the editor selection.
    toolbar?.addEventListener("mousedown", (event) => {
      const button = event.target.closest("[data-doc-cmd]");
      if (!button) return;
      event.preventDefault();
      area.focus();
      document.execCommand(button.dataset.docCmd, false);
      scheduleSave();
      syncBlockSelect();
    });
    blockSelect?.addEventListener("change", () => {
      area.focus();
      document.execCommand("formatBlock", false, blockSelect.value);
      scheduleSave();
    });

    area.addEventListener("input", scheduleSave);
    area.addEventListener("keyup", syncBlockSelect);
    area.addEventListener("mouseup", syncBlockSelect);

    const flush = () => {
      clearTimeout(timer);
      persist().finally(() => renderAll());
    };
    dialog.addEventListener("close", flush, { once: true });
    area.focus();
    syncBlockSelect();
  }

  async function openOfficeEditor(documentData, previewContext = {}) {
    const dialog = $("#office-editor-dialog");
    const body = $("#office-editor-body");
    const title = $("#office-editor-title");
    const subtitle = $("#office-editor-subtitle");
    if (!dialog || !body || !title || !subtitle || !documentData) return;
    const settings = state.settingsIntegrationSettings?.ONLYOFFICE || {};
    const documentServerUrl = normalizedServerUrl(settings.documentServerUrl);
    const callbackUrl = onlyOfficeResourceUrl(documentData.onlyOfficeCallbackUrl || settings.callbackUrl || "", settings);
    const documentUrl = onlyOfficeResourceUrl(documentData.fileUrl || documentData.url || "", settings);
    const fileType = onlyOfficeFileType(documentData, documentUrl);
    const documentType = onlyOfficeDocumentType(fileType);
    const saveStatus = dialog.querySelector(".office-editor-save-status");
    title.textContent = documentData.name || "ONLYOFFICE";
    subtitle.textContent = officeSubtitle(fileType);
    if (saveStatus) {
      saveStatus.title = fileType === "pdf" ? "PDF відкрито у режимі перегляду" : "ONLYOFFICE зберігає документ через callback у CRM";
      saveStatus.innerHTML = `
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"></path></svg>
        ${fileType === "pdf" ? "Перегляд" : "Автозбереження"}
      `;
    }
    const canUseBuiltInEditor = documentType === "word";
    // A saved CRM document (backendDocId) opens in ONLYOFFICE via the server-signed config alone —
    // that config carries the signed file URL, so a missing client-side documentUrl must NOT
    // short-circuit to the built-in editor. Only bail when there is no Document Server URL, or no
    // way at all to resolve a file URL (neither a client url nor a backend id to fetch a config).
    const backendDocId = documentData.id ?? documentData.documentId;
    const hasBackendConfig = backendDocId !== undefined && backendDocId !== null && backendDocId !== "";
    dialog.showModal();
    if (isOnlyOfficeCloudUrl(documentServerUrl) && (!settings.serverAccessUrl || isLocalOnlyOfficeUrl(settings.serverAccessUrl))) {
      body.innerHTML = officeEditorSetupView(
        documentData,
        settings,
        "ONLYOFFICE Cloud не бачить локальний CRM URL"
      );
      showToast("Для ONLYOFFICE Cloud потрібен публічний HTTPS URL CRM.", "warning");
      return;
    }
    if (!documentServerUrl || (!documentUrl && !hasBackendConfig)) {
      if (canUseBuiltInEditor) {
        mountBuiltInDocEditor(documentData, dialog, body);
      } else {
        body.innerHTML = officeEditorSetupView(documentData, settings, documentServerUrl ? "Потрібен URL файлу" : "");
      }
      return;
    }
    body.innerHTML = `<div class="office-editor-loading"><strong>Завантажуємо ONLYOFFICE...</strong><span>${escapeHtml(documentServerUrl)}</span></div><div id="onlyoffice-editor-container" class="onlyoffice-editor-container"></div>`;
    try {
      // Prefer the server-signed config: a JWT-enabled Document Server only accepts a config
      // signed with the shared jwtSecret, and that secret must never reach the browser. The
      // unsigned client-built config below is a fallback for unsaved docs / a JWT-off dev server.
      let editorConfig = null;
      if (hasBackendConfig) {
        try {
          editorConfig = await apiRequest(`/api/documents/${backendDocId}/onlyoffice/config/`);
        } catch (_configError) {
          editorConfig = null;
        }
      }
      if (!editorConfig && !documentUrl) {
        // No server-signed config and no client-side URL — nothing valid to hand ONLYOFFICE.
        // Throw so the catch below falls back to the built-in editor instead of a broken config.
        throw new Error("ONLYOFFICE config unavailable");
      }
      if (!editorConfig) {
        editorConfig = {
          document: {
            fileType,
            key: onlyOfficeDocumentKey(documentData, fileType, documentUrl),
            title: documentData.fileName || documentData.name || `document.${fileType}`,
            url: documentUrl
          },
          documentType,
          editorConfig: {
            callbackUrl,
            lang: "uk",
            mode: fileType === "pdf" ? "view" : "edit",
            user: {
              id: "crm-user",
              name: state.currentUser?.name || "CRM user"
            }
          },
          height: "100%",
          width: "100%"
        };
      }
      await loadOnlyOfficeApi(documentServerUrl);
      const container = document.querySelector("#onlyoffice-editor-container");
      if (!container || !window.DocsAPI?.DocEditor) throw new Error("ONLYOFFICE API unavailable");
      body.querySelector(".office-editor-loading")?.remove();
      window.__crmOnlyOfficeEditor?.destroyEditor?.();
      window.__crmOnlyOfficeEditor = new window.DocsAPI.DocEditor("onlyoffice-editor-container", editorConfig);
    } catch (_error) {
      if (canUseBuiltInEditor) {
        mountBuiltInDocEditor(documentData, dialog, body);
        showToast("ONLYOFFICE недоступний — відкрито вбудований редактор CRM.", "info");
      } else {
        body.innerHTML = officeEditorSetupView(documentData, settings, "Не вдалося завантажити ONLYOFFICE");
        showToast("ONLYOFFICE не відкрився. Перевірте Document Server URL.", "warning");
      }
    }
  }

  function cleanUrl(value = "") {
    return String(value || "").trim();
  }

  function absoluteCrmUrl(value = "") {
    const url = cleanUrl(value);
    if (!url) return "";
    if (/^https?:\/\//i.test(url)) return url;
    return new URL(url, window.location.origin).href;
  }

  function onlyOfficeResourceUrl(value = "", settings = {}) {
    const url = absoluteCrmUrl(value);
    const serverAccessUrl = normalizedServerUrl(settings.serverAccessUrl);
    if (!url || !serverAccessUrl) return url;
    try {
      const target = new URL(url);
      if (target.origin !== window.location.origin) return url;
      const base = new URL(serverAccessUrl);
      const localAccessHosts = new Set(["localhost", "127.0.0.1", "host.docker.internal", "host.lima.internal"]);
      if (!localAccessHosts.has(window.location.hostname) && localAccessHosts.has(base.hostname)) return url;
      target.protocol = base.protocol;
      target.host = base.host;
      return target.href;
    } catch (_error) {
      return url.replace(window.location.origin, serverAccessUrl);
    }
  }

  function openStoredDocument(documentData, previewContext = {}) {
    if (!documentData) return;
    const dialog = $("#document-preview-dialog");
    const content = $("#document-preview-content");
    const title = $("#document-preview-title");
    const fileButton = $("#document-preview-file");
    const editButton = $("#document-preview-edit");
    const exportButton = $("#document-preview-export");
    const caseButton = $("#document-preview-case");
    if (!dialog || !content || !title || !fileButton || !editButton || !exportButton || !caseButton) {
      openDocumentFile(documentData);
      return;
    }
    const item = previewContext.caseId ? caseById(previewContext.caseId) : previewContext.item || null;
    const client = item ? clientById(item.clientId) : null;
    const folderName = previewContext.folderName || previewContext.editContext?.folder?.name || previewContext.editContext?.linked?.folder?.name || "Не вказано";
    const hasFile = Boolean(documentData.fileUrl || documentData.url || documentData.fileObject);
    const fileName = documentData.fileName || (documentData.fileObject && documentData.fileObject.name) || "";
    const source = documentData.source || (documentData.url ? "Посилання" : fileName ? "Файл" : "Опис без файлу");
    title.textContent = documentData.name || "Документ";
    content.innerHTML = `
      <div class="document-preview-hero ${hasFile ? "has-file" : ""}">
        <span aria-hidden="true">${hasFile ? "PDF" : "DOC"}</span>
        <div>
          <strong>${escapeHtml(documentData.name || "Документ")}</strong>
          <p>${escapeHtml(item ? `№${item.id} · ${client?.name || "Клієнт не вказаний"}` : "Документ без прив'язки до справи")}</p>
        </div>
      </div>
      <dl class="document-preview-meta">
        <div><dt>Справа</dt><dd>${escapeHtml(item ? `№${item.id}` : "Не вказано")}</dd></div>
        <div><dt>Клієнт</dt><dd>${escapeHtml(client?.name || "Не вказано")}</dd></div>
        <div><dt>Папка</dt><dd>${escapeHtml(folderName)}</dd></div>
        <div><dt>Тип</dt><dd>${escapeHtml(documentData.type || "Не вказано")}</dd></div>
        <div><dt>Статус</dt><dd>${escapeHtml(documentData.status || "Без статусу")}</dd></div>
        <div><dt>Дата подання</dt><dd>${escapeHtml(documentData.submitted || "-")}</dd></div>
        <div><dt>Строк відповіді</dt><dd>${escapeHtml(documentData.responseDue || "-")}</dd></div>
        <div><dt>Джерело</dt><dd>${escapeHtml(source)}</dd></div>
      </dl>
      <div class="document-preview-file-state ${hasFile ? "ready" : "empty"}">
        <strong>${hasFile ? "Файл готовий до відкриття" : "Файл ще не додано"}</strong>
        <span>${escapeHtml(hasFile ? (fileName || documentData.fileUrl || documentData.url || "Документ має посилання або файл") : "Додайте файл або посилання, щоб кнопка відкривала реальний PDF, Word чи скан.")}</span>
      </div>
      <div class="document-preview-comment">
        <strong>Коментар</strong>
        <p>${escapeHtml(documentData.comment || "Коментар по документу ще не додано.")}</p>
      </div>
      <div class="document-preview-body">
        <strong>Текст документа</strong>
        <div class="document-preview-richtext">${docContentToDisplayHtml(documentData.content, "Текст документа ще не додано. Відкрийте редагування, заповніть чернетку і експортуйте файл.")}</div>
      </div>
    `;
    fileButton.disabled = !hasFile;
    fileButton.textContent = hasFile ? "Відкрити файл" : "Файл не додано";
    fileButton.onclick = () => openDocumentFile(documentData);
    editButton.disabled = !previewContext.caseId || !previewContext.editContext;
    editButton.textContent = hasFile ? "Редагувати" : "Додати файл";
    editButton.onclick = () => {
      if (!previewContext.caseId || !previewContext.editContext) return;
      dialog.close();
      openDocumentDialog(previewContext.caseId, previewContext.editContext, previewContext.returnView || "documents");
    };
    exportButton.onclick = () => exportStoredDocument(documentData, previewContext);
    caseButton.disabled = !item;
    caseButton.onclick = () => {
      if (!item) return;
      dialog.close();
      state.selectedCaseId = item.id;
      state.caseScreen = "detail";
      state.openCaseSection = "documents";
      renderAll?.();
      switchView?.("cases");
    };
    dialog.showModal();
  }

  function openDocumentDialog(caseId, editContext = null, returnView = null) {
    const form = $("#document-form");
    form.reset();
    state.documentDialogReturnView = returnView || ($("#documents")?.classList.contains("active") ? "documents" : "cases");
    const requestedCaseId = caseId || state.selectedCaseId || state.cases[0]?.id || "";
    let item = caseById(requestedCaseId) || state.cases[0] || null;
    form.elements.caseId.value = item?.id || "";
    form.elements.originalCaseId.value = item?.id || "";
    if (form.elements.documentTargetMode) {
      // With no cases yet, default to the standalone Документообіг folder ("archive") mode.
      form.elements.documentTargetMode.value = state.cases.length ? "case" : "archive";
    }
    const targetModeCard = form.querySelector("[data-document-target-mode]");
    const destinationCard = form.querySelector("[data-document-destination]");
    const clientSelect = form.elements.targetClientId;
    const caseSelect = form.elements.targetCaseId;
    const destinationSummary = form.querySelector("[data-document-destination-summary]");
    const shouldShowDestination = Boolean(editContext) || state.documentDialogReturnView === "documents";
    const proceduralTypeFolders = new Map([
      ["Позов", "Позови"],
      ["Клопотання", "Клопотання"],
      ["Адвокатський запит", "Запити"],
      ["Ухвала / відповідь", "Відповіді та ухвали"]
    ]);
    const proceduralFolderNames = new Set([...proceduralTypeFolders.values()]);
    const setDocumentTypeValue = (value = "Інше") => {
      const typeSelect = form.elements.type;
      const allowedValues = new Set([...typeSelect.options].map((option) => option.value));
      typeSelect.value = allowedValues.has(value) ? value : "Інше";
    };
    [...form.elements.type.options].forEach((option) => {
      option.dataset.proceduralOption = String(proceduralTypeFolders.has(option.value));
    });
    const isProceduralType = () => proceduralTypeFolders.has(form.elements.type?.value || "");
    const ensureFolderOptionByName = (folderName) => {
      const folderSelect = form.elements.folder;
      if (!folderSelect || !folderName) return "";
      const option = [...folderSelect.options].find((itemOption) => itemOption.textContent === folderName);
      return option?.value || "";
    };

    const caseLabel = (caseItem) => {
      const client = clientById(caseItem.clientId);
      return `№${caseItem.id} · ${client?.name || "Клієнт"} · ${caseItem.title || "Без назви"}`;
    };
    const fillFolderOptions = () => {
      const folders = item ? caseFolders(item) : [];
      $("#document-folder").innerHTML = [
        ...folders.map((folder, index) => `<option value="${index}">${escapeHtml(folder.name)}</option>`),
        `<option value="__new__">+ Створити нову папку</option>`
      ].join("");
    };
    const syncNewFolderField = () => {
      const folderSelect = form.elements.folder;
      const newFolderInput = form.elements.newFolderName;
      const proceduralNote = form.querySelector("[data-document-procedural-note]");
      const newFolderLabel = form.querySelector("[data-document-new-folder-label]");
      const fixedFolder = form.querySelector("[data-document-fixed-folder]");
      const typeField = form.querySelector("[data-document-type-field]");
      const folderSelectShell = folderSelect.nextElementSibling?.classList?.contains("document-custom-select")
        ? folderSelect.nextElementSibling
        : null;
      if (!folderSelect || !newFolderInput) return;
      const procedural = isProceduralType();
      typeField?.classList.toggle("is-procedural-type", procedural);
      if (procedural) {
        const targetFolderName = proceduralTypeFolders.get(form.elements.type.value);
        const targetFolderValue = ensureFolderOptionByName(targetFolderName);
        if (targetFolderValue !== "") folderSelect.value = targetFolderValue;
        [...folderSelect.options].forEach((option) => {
          option.hidden = false;
          option.disabled = option.value !== targetFolderValue;
        });
        newFolderInput.value = "";
        newFolderInput.required = false;
        newFolderInput.hidden = true;
        if (newFolderLabel) newFolderLabel.hidden = true;
        if (fixedFolder) {
          fixedFolder.hidden = false;
          fixedFolder.textContent = targetFolderName;
        }
        if (folderSelectShell) folderSelectShell.hidden = true;
        syncDocumentCustomSelect(folderSelect);
        newFolderInput.closest(".document-editor-field")?.classList.add("is-procedural-document");
        if (proceduralNote) {
          proceduralNote.hidden = false;
          proceduralNote.textContent = `Процесуальний документ: буде у блоці 6 і в папці «${targetFolderName}» блоку 7.`;
        }
        return;
      }
      const selectedFolderName = folderSelect.selectedOptions?.[0]?.textContent || "";
      [...folderSelect.options].forEach((option) => {
        const isProceduralFolder = proceduralFolderNames.has(option.textContent || "");
        option.hidden = isProceduralFolder;
        option.disabled = false;
      });
      if (proceduralFolderNames.has(selectedFolderName)) {
        const fallback = [...folderSelect.options].find((option) => !option.hidden && option.value !== "__new__");
        folderSelect.value = fallback?.value || "__new__";
      }
      newFolderInput.hidden = false;
      if (newFolderLabel) newFolderLabel.hidden = false;
      if (fixedFolder) fixedFolder.hidden = true;
      if (folderSelectShell) folderSelectShell.hidden = false;
      if (proceduralNote) proceduralNote.hidden = true;
      syncDocumentCustomSelect(folderSelect);
      newFolderInput.closest(".document-editor-field")?.classList.remove("is-procedural-document");
      const isCreatingFolder = folderSelect.value === "__new__";
      newFolderInput.required = isCreatingFolder;
      newFolderInput.placeholder = isCreatingFolder ? "Наприклад: Докази" : "Підпапка у вибраній папці";
      newFolderInput.closest(".document-editor-field")?.classList.toggle("is-subfolder-mode", !isCreatingFolder);
    };
    const fillArchiveOptions = () => {
      const archiveSelect = form.elements.archiveFolderId;
      if (!archiveSelect) return;
      const archiveFolders = Array.isArray(state.documentArchiveFolders) ? state.documentArchiveFolders : [];
      const normalize = (folders) => folders.forEach((folder) => {
        if (!Array.isArray(folder.documents)) folder.documents = [];
        if (!Array.isArray(folder.children)) folder.children = [];
        normalize(folder.children);
      });
      normalize(archiveFolders);
      if (!archiveSelect.value && archiveFolders[0]) archiveSelect.value = archiveFolders[0].id;
      const picker = form.querySelector('[data-document-archive-picker="document-form"]');
      const renderPickerFolder = (folder, depth = 0) => `
        <button class="document-archive-picker-node ${archiveSelect.value === folder.id ? "active" : ""}" type="button" data-document-archive-pick="${escapeHtml(folder.id)}" style="--level:${depth}">
          <span aria-hidden="true">›</span>
          <i class="folder-icon" aria-hidden="true"></i>
          <strong>${escapeHtml(folder.name)}</strong>
          <em>${folder.documents.length}</em>
        </button>
        ${(folder.children || []).map((child) => renderPickerFolder(child, depth + 1)).join("")}
      `;
      if (picker) {
        picker.innerHTML = archiveFolders.map((folder) => renderPickerFolder(folder)).join("") || `<p>Архівних папок ще немає.</p>`;
        picker.querySelectorAll("[data-document-archive-pick]").forEach((button) => {
          button.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            archiveSelect.value = button.dataset.documentArchivePick || "";
            picker.querySelectorAll("[data-document-archive-pick]").forEach((node) => {
              const active = node.dataset.documentArchivePick === archiveSelect.value;
              node.classList.toggle("active", active);
              node.setAttribute("aria-pressed", String(active));
            });
          });
          button.setAttribute("aria-pressed", String(archiveSelect.value === button.dataset.documentArchivePick));
        });
      }
    };
    const syncDestinationSummary = () => {
      if (!destinationSummary) return;
      destinationSummary.textContent = item ? `Обрано: №${item.id}` : "Оберіть справу";
    };
    const applyDestinationCase = (nextCaseId) => {
      const nextItem = caseById(nextCaseId);
      if (!nextItem) return;
      item = nextItem;
      form.elements.caseId.value = item.id;
      fillFolderOptions();
      syncNewFolderField();
      syncDestinationSummary();
      setupDocumentCustomSelects(form);
    };
    const fillCaseSelect = (clientId, preferredCaseId = "") => {
      if (!caseSelect) return;
      const clientCases = state.cases.filter((caseItem) => String(caseItem.clientId) === String(clientId));
      caseSelect.innerHTML = clientCases.length
        ? clientCases.map((caseItem) => `<option value="${escapeHtml(caseItem.id)}">${escapeHtml(caseLabel(caseItem))}</option>`).join("")
        : `<option value="">У клієнта поки немає справ</option>`;
      const selectedCase = clientCases.find((caseItem) => caseItem.id === preferredCaseId) || clientCases[0] || null;
      caseSelect.value = selectedCase?.id || "";
      if (selectedCase) applyDestinationCase(selectedCase.id);
    };
    const fillClientSelect = () => {
      if (!clientSelect || !caseSelect) return;
      const caseClientIds = new Set(state.cases.map((caseItem) => String(caseItem.clientId)));
      const clients = state.clients.filter((client) => caseClientIds.has(String(client.id)));
      const selectedClient = item ? clientById(item.clientId) : clients[0] || null;
      clientSelect.innerHTML = clients.length
        ? clients.map((client) => `<option value="${client.id}">${escapeHtml(client.name)}</option>`).join("")
        : `<option value="">Клієнтів зі справами немає</option>`;
      clientSelect.value = selectedClient?.id || "";
      fillCaseSelect(clientSelect.value, item?.id || "");
    };

    const syncDocumentTargetMode = () => {
      const targetMode = form.elements.documentTargetMode?.value || "case";
      if (targetModeCard) targetModeCard.hidden = !editContext && state.documentDialogReturnView !== "documents";
      if (destinationCard) destinationCard.hidden = !shouldShowDestination || targetMode !== "case";
      form.querySelectorAll("[data-document-case-destination]").forEach((field) => {
        field.hidden = targetMode === "archive";
      });
      form.querySelectorAll("[data-document-archive-destination]").forEach((field) => {
        field.hidden = targetMode !== "archive";
      });
    };
    form.querySelectorAll('input[name="documentTargetMode"]').forEach((input) => {
      input.onchange = syncDocumentTargetMode;
    });
    syncDocumentTargetMode();
    fillClientSelect();
    fillFolderOptions();
    syncNewFolderField();
    fillArchiveOptions();
    syncDestinationSummary();
    if (clientSelect) {
      clientSelect.onchange = () => {
        fillCaseSelect(clientSelect.value);
        setupDocumentCustomSelects(form);
      };
    }
    if (caseSelect) {
      caseSelect.onchange = () => applyDestinationCase(caseSelect.value);
    }
    if (form.elements.folder) {
      form.elements.folder.onchange = () => {
        syncNewFolderField();
        syncDocumentCustomSelect(form.elements.folder);
      };
    }
    if (form.elements.type) {
      form.elements.type.onchange = () => {
        syncNewFolderField();
        syncDocumentCustomSelect(form.elements.folder);
      };
    }
    setupDocumentCustomSelects(form);
    syncDocumentTargetMode();
    form.elements.editSource.value = "";
    form.elements.docIndex.value = "";
    form.elements.folderIndex.value = "";
    form.elements.fileIndex.value = "";
    form.classList.toggle("is-editing-document", Boolean(editContext));
    $("#document-dialog-title").textContent = "Новий документ";
    $("#document-submit-button").textContent = "Додати документ";
    setDocumentTypeValue("Інше");
    if (form.elements.documentSourceMode) {
      form.elements.documentSourceMode.value = "onlyoffice";
    }
    const syncDocumentSourceMode = () => {
      const target = form.elements.documentSourceMode?.value || "onlyoffice";
      const button = $("#document-submit-button");
      form.querySelectorAll("[data-document-source-panel]").forEach((panel) => {
        panel.hidden = Boolean(editContext) || panel.dataset.documentSourcePanel !== target;
      });
      if (!button) return;
      button.textContent = editContext
        ? "Зберегти документ"
        : target === "onlyoffice"
          ? "Створити документ"
          : "Додати документ";
    };
    form.querySelectorAll('input[name="documentSourceMode"]').forEach((input) => {
      input.onchange = syncDocumentSourceMode;
    });
    const fileInput = form.elements.file;
    const fileNameLabel = form.querySelector("[data-document-file-name]");
    if (fileInput && fileNameLabel) {
      fileNameLabel.textContent = fileInput.files?.[0]?.name || "Файл не вибрано";
      fileInput.onchange = () => {
        fileNameLabel.textContent = fileInput.files?.[0]?.name || "Файл не вибрано";
      };
    }
    const draftButton = form.querySelector("[data-document-fill-draft]");
    if (draftButton) {
      draftButton.onclick = () => {
        const client = item ? clientById(item.clientId) : null;
        form.elements.content.value = defaultDocumentContent(item, client, form);
        form.elements.content.focus();
      };
    }

    if (editContext) {
      const data = editContext.file || editContext.doc;
      const linked = editContext.linked || (editContext.doc ? findFolderFileByDocument(item, editContext.doc) : null);
      form.elements.originalCaseId.value = item?.id || "";
      if (form.elements.documentTargetMode) form.elements.documentTargetMode.value = "case";
      form.elements.editSource.value = editContext.source;
      form.elements.docIndex.value = editContext.docIndex ?? "";
      form.elements.folderIndex.value = editContext.folderIndex ?? linked?.folderIndex ?? "";
      form.elements.fileIndex.value = editContext.fileIndex ?? linked?.fileIndex ?? "";
      form.elements.name.value = data?.name || "";
      form.elements.url.value = data?.url || "";
      setDocumentTypeValue(data?.type || "Інше");
      form.elements.submitted.value = parseDisplayDate(data?.submitted);
      form.elements.responseDue.value = parseDisplayDate(data?.responseDue);
      form.elements.status.value = data?.status || "Чернетка";
      form.elements.comment.value = data?.comment || "";
      form.elements.content.value = data?.content || "";
      form.elements.folder.value = String(editContext.folderIndex ?? linked?.folderIndex ?? 0);
      syncNewFolderField();
      if (form.elements.documentSourceMode) {
        form.elements.documentSourceMode.value = data?.url ? "google" : data?.fileName || data?.fileUrl ? "upload" : "onlyoffice";
      }
      $("#document-dialog-title").textContent = "Редагувати документ";
      $("#document-submit-button").textContent = "Зберегти документ";
    }
    syncNewFolderField();
    setupDocumentCustomSelects(form);
    syncNewFolderField();
    syncDocumentTargetMode();
    syncDocumentSourceMode();
    $("#document-dialog").showModal();
  }

  function taskPriority(task = {}) {
    if (task.priority) return task.priority;
    if (["Терміново", "Срочно"].includes(task.status)) return "Високий";
    if (["Не терміново", "Не срочно"].includes(task.status)) return "Низький";
    return "Середній";
  }

  function setCoexecutorChecks(form, values = []) {
    const normalized = Array.isArray(values)
      ? values
      : String(values || "").split(",").map((value) => value.trim()).filter(Boolean);
    form.querySelectorAll('input[name="coexecutors"]').forEach((input) => {
      input.checked = normalized.includes(input.value);
    });
    syncCoexecutorSummary(form);
  }

  function syncCoexecutorSummary(form) {
    const selected = [...form.querySelectorAll('input[name="coexecutors"]:checked')].map((input) => input.value);
    const summary = form.querySelector("[data-coexecutors-summary]");
    if (!summary) return;
    summary.textContent = selected.length
      ? selected.length === 1
        ? selected[0]
        : `Обрано: ${selected.length}`
      : "Не обрано";
  }

  function subtaskStatusTone(status = "") {
    const text = String(status).toLowerCase();
    if (text.includes("викон")) return "green";
    if (text.includes("перевір") || text.includes("очіку")) return "amber";
    if (text.includes("робот") || text.includes("нов")) return "blue";
    return "blue";
  }

  function updateSubtaskStatusTone(select) {
    if (!select) return;
    select.className = `task-status-select task-subtask-status-select tone-${subtaskStatusTone(select.value)}`;
  }

  function subtaskEditorRow(subtask = {}) {
    const title = escapeHtml(subtask.title || "");
    const status = subtask.status || "Нова";
    return `
      <div class="task-subtask-editor-row">
        <input name="subtaskTitle" value="${title}" placeholder="Назва підзадачі" />
        <select name="subtaskStatus" class="task-status-select task-subtask-status-select tone-${subtaskStatusTone(status)}">
          ${["Нова", "В роботі", "На перевірці", "Очікує", "Виконано"].map((item) => `<option value="${item}" ${status === item ? "selected" : ""}>${item}</option>`).join("")}
        </select>
        <button type="button" data-remove-subtask-row aria-label="Видалити підзадачу">×</button>
      </div>
    `;
  }

  function renderTaskSubtaskEditor(form, subtasks = []) {
    const editor = form.querySelector("#task-subtasks-editor");
    if (!editor) return;
    editor.innerHTML = subtasks.length
      ? subtasks.map((subtask) => subtaskEditorRow(subtask)).join("")
      : `<p class="task-subtasks-editor-empty">Підзадач ще немає. Додайте першу підзадачу нижче.</p>`;
  }

  function defaultTaskSubtasks(task = {}) {
    return [
      { title: "Перевірити вихідні матеріали", status: task.status === "Виконано" ? "Виконано" : "В роботі" },
      { title: "Підготувати результат по задачі", status: task.status === "Виконано" ? "Виконано" : "Нова" }
    ];
  }

  function appendSubtaskRow(form, subtask = { status: "Нова" }) {
    const editor = form.querySelector("#task-subtasks-editor");
    if (!editor) return;
    editor.querySelector(".task-subtasks-editor-empty")?.remove();
    editor.insertAdjacentHTML("beforeend", subtaskEditorRow(subtask));
    setupClientCustomSelects(form);
    editor.querySelector(".task-subtask-editor-row:last-child input")?.focus();
  }

  function openSubtaskDialog(caseId, taskIndex, subtaskIndex = null, returnView = null) {
    const item = caseById(caseId);
    const task = item?.tasks?.[taskIndex];
    if (!item || !task) return;
    const form = $("#subtask-form");
    form.reset();
    state.taskDialogReturnView = returnView || ($("#tasks")?.classList.contains("active") ? "tasks" : "cases");
    form.elements.caseId.value = caseId;
    form.elements.taskIndex.value = taskIndex;
    form.elements.subtaskIndex.value = subtaskIndex === null || subtaskIndex === undefined ? "" : subtaskIndex;
    form.elements.status.value = "Нова";
    syncCaseResponsibleOptions(form, task.responsible || item.responsible);
    form.elements.due.value = parseDisplayDate(task.due);
    $("#subtask-parent-title").textContent = task.title || "Основна задача";
    $("#subtask-parent-case").textContent = `№${item.id} · ${item.title}`;
    $("#subtask-dialog-title").textContent = "Додати підзадачу";
    $("#subtask-submit-button").textContent = "Додати підзадачу";

    if (subtaskIndex !== null && subtaskIndex !== undefined) {
      const subtasks = task.subtasks?.length ? task.subtasks : defaultTaskSubtasks(task);
      const subtask = subtasks[Number(subtaskIndex)];
      if (!subtask) return;
      form.elements.title.value = subtask.title || "";
      form.elements.status.value = subtask.status || "Нова";
      syncCaseResponsibleOptions(form, subtask.responsible || task.responsible || item.responsible);
      form.elements.due.value = parseDisplayDate(subtask.due);
      $("#subtask-dialog-title").textContent = "Редагувати підзадачу";
      $("#subtask-submit-button").textContent = "Зберегти підзадачу";
    }

    updateSubtaskStatusTone(form.elements.status);
    form.elements.status.onchange = () => updateSubtaskStatusTone(form.elements.status);
    setupClientCustomSelects(form);
    $("#subtask-dialog").showModal();
    form.elements.title.focus();
  }

  function openTaskDialog(caseId, taskIndex = null, returnView = null, options = {}) {
    const form = $("#task-form");
    form.reset();
    const subtaskMode = options.subtaskMode || "";
    const isEditingTask = taskIndex !== null && taskIndex !== undefined;
    const openedFromCaseDetail = $("#cases")?.classList.contains("active")
      && state.caseScreen === "detail"
      && returnView !== "tasks";
    const shouldLockCase = Boolean(caseId)
      && (isEditingTask || returnView === "cases" || returnView === "planner" || openedFromCaseDetail);
    const taskCaseField = form.querySelector(".task-case-field");
    const taskCaseLocked = form.querySelector("[data-task-case-locked]");
    form.dataset.originalCaseId = caseId || "";
    $("#task-case-select").innerHTML = state.cases.map((item) => `<option value="${item.id}">№${item.id} · ${escapeHtml(item.title)}</option>`).join("");
    form.elements.caseId.value = caseId;
    const taskCase = caseById(caseId);
    if (taskCaseField && taskCaseLocked) {
      taskCaseField.classList.toggle("is-locked", shouldLockCase);
      taskCaseLocked.hidden = !shouldLockCase;
      taskCaseLocked.textContent = taskCase ? `№${taskCase.id} · ${taskCase.title}` : "Справа не вибрана";
    }
    form.elements.taskIndex.value = "";
    state.taskDialogReturnView = returnView || ($("#tasks")?.classList.contains("active") ? "tasks" : "cases");
    form.elements.showInCalendar.checked = true;
    form.elements.plannerManual.checked = returnView === "planner";
    form.elements.plannerImportant.checked = false;
    form.elements.priority.value = "Середній";
    form.elements.status.value = returnView === "planner" ? "Заплановано" : "Нова";
    syncCaseResponsibleOptions(form, caseById(caseId)?.responsible);
    form.elements.reminderEnabled.checked = returnView === "planner";
    form.elements.reminderBefore.value = "За 1 день";
    form.elements.reminderChannel.value = "CRM";
    form.elements.plannerDate.value = "";
    form.elements.plannerTime.value = "";
    syncTaskCoexecutorOptions(form, []);
    renderTaskSubtaskEditor(form, []);
    form.querySelector("#task-add-subtask").onclick = () => appendSubtaskRow(form);
    form.querySelector("#task-subtasks-editor").onclick = (event) => {
      const button = event.target.closest("[data-remove-subtask-row]");
      if (!button) return;
      button.closest(".task-subtask-editor-row")?.remove();
      if (!form.querySelector(".task-subtask-editor-row")) renderTaskSubtaskEditor(form, []);
    };
    form.querySelector("#task-subtasks-editor").onchange = (event) => {
      if (event.target.matches('select[name="subtaskStatus"]')) {
        updateSubtaskStatusTone(event.target);
        syncDocumentCustomSelect(event.target);
      }
    };
    form.querySelector(".task-coexecutors-picker")?.removeAttribute("open");
    form.querySelector(".task-coexecutors-menu").onchange = () => syncCoexecutorSummary(form);
    $("#task-dialog-title").textContent = "Нова задача";
    $("#task-submit-button").textContent = "Додати задачу";
    if (taskIndex !== null) {
      const task = caseById(caseId)?.tasks[taskIndex];
      if (!task) return;
      form.elements.taskIndex.value = taskIndex;
      form.elements.title.value = task.title;
      form.elements.description.value = task.description || "";
      form.elements.status.value = task.status;
      form.elements.priority.value = taskPriority(task);
      syncCaseResponsibleOptions(form, task.responsible || caseById(caseId)?.responsible);
      form.elements.due.value = parseDisplayDate(task.due);
      form.elements.plannerDate.value = task.plannerDate || parseDisplayDate(task.plannerDateText || "");
      form.elements.plannerTime.value = task.plannerTime || "";
      syncTaskCoexecutorOptions(form, task.coexecutors || []);
      renderTaskSubtaskEditor(form, task.subtasks || defaultTaskSubtasks(task));
      form.elements.showInCalendar.checked = Boolean(task.showInCalendar);
      form.elements.plannerManual.checked = Boolean(task.plannerManual);
      form.elements.plannerImportant.checked = Boolean(task.plannerImportant);
      form.elements.reminderEnabled.checked = Boolean(task.reminderEnabled);
      form.elements.reminderBefore.value = task.reminderBefore || "За 1 день";
      form.elements.reminderChannel.value = task.reminderChannel || "CRM";
      form.elements.comment.value = task.comment || "";
      $("#task-dialog-title").textContent = subtaskMode === "new"
        ? "Додати підзадачу"
        : subtaskMode === "edit"
          ? "Редагувати підзадачу"
          : "Редагувати задачу";
      $("#task-submit-button").textContent = subtaskMode ? "Зберегти підзадачі" : "Зберегти задачу";
      if (subtaskMode === "new") appendSubtaskRow(form);
    }
    setupClientCustomSelects(form);
    $("#task-dialog").showModal();
  }

  function openEventDialog(context = {}, actionIndex = null) {
    const form = $("#event-form");
    form.reset();
    form.dataset.caseProceduralContext = Boolean(context.caseId && !context.eventId) ? "true" : "false";
    $("#event-client").innerHTML = state.clients.map((client) => `<option value="${client.id}">${escapeHtml(client.name)}</option>`).join("");
    $("#event-case").innerHTML = state.cases.map((item) => `<option value="${item.id}">№${item.id} · ${escapeHtml(item.title)}</option>`).join("");
    const initialCaseId = context.caseId || state.selectedCaseId || state.cases[0]?.id || "";
    const initialCase = caseById(initialCaseId);
    const linkFields = form.querySelector("[data-event-link-fields]");
    const shouldHideLinkFields = Boolean(context.caseId) && !context.eventId;
    if (linkFields) linkFields.hidden = shouldHideLinkFields;
    form.elements.caseId.value = initialCaseId;
    form.elements.actionIndex.value = "";
    form.elements.eventId.value = "";
    form.elements.date.value = state.calendarDate || todayIso();
    form.elements.time.value = "09:00";
    form.elements.endTime.value = "10:00";
    form.elements.status.value = "Заплановано";
    form.elements.type.value = context.caseId && !context.eventId ? "Адвокат" : "Судове засідання";
    form.elements.authority.value = initialCase?.court === "Не вказано" ? "" : initialCase?.court || "";
    form.elements.location.value = initialCase?.authorityAddress || "";
    syncCaseResponsibleOptions(form, initialCase?.responsible);
    form.elements.recurrence.value = "Не повторювати";
    form.elements.reminderEnabled.checked = false;
    form.elements.reminderBefore.value = "За 1 день";
    form.elements.reminderChannels.value = "CRM";
    form.elements.reminderRecipients.value = "Відповідальний юрист + клієнт";
    $("#event-dialog h2").textContent = "Нова подія";
    $("#event-submit-button").textContent = "Додати подію";
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
      syncCaseResponsibleOptions(form, meta.responsible);
      form.elements.recurrence.value = meta.recurrence;
      form.elements.reminderEnabled.checked = Boolean(meta.reminderEnabled);
      form.elements.reminderBefore.value = meta.reminderBefore || "За 1 день";
      form.elements.reminderChannels.value = meta.reminderChannels || "CRM";
      form.elements.reminderRecipients.value = meta.reminderRecipients || "Відповідальний юрист + клієнт";
      form.elements.description.value = sourceEvent.description || "";
      $("#event-dialog h2").textContent = "Редагувати подію";
      $("#event-submit-button").textContent = "Зберегти подію";
    }
    if (actionIndex !== null && context.caseId) {
      const action = caseProceduralItems(caseById(context.caseId))[actionIndex];
      if (!action || Array.isArray(action)) return;
      form.elements.actionIndex.value = actionIndex;
      form.elements.title.value = action.action || "";
      form.elements.type.value = action.initiator || "Адвокат";
      form.elements.date.value = parseDisplayDate(action.initiated);
      form.elements.time.value = action.time || "09:00";
      form.elements.due.value = parseDisplayDate(action.due);
      form.elements.status.value = action.status || "Заплановано";
      form.elements.description.value = action.description || "";
      $("#event-dialog h2").textContent = "Редагувати процесуальну дію";
      $("#event-submit-button").textContent = "Зберегти дію";
    }
    $("#event-case").onchange = (event) => {
      const selectedCase = caseById(event.currentTarget.value);
      if (!selectedCase) return;
      form.elements.client.value = selectedCase.clientId;
      form.elements.authority.value = selectedCase.court === "Не вказано" ? "" : selectedCase.court || "";
      form.elements.location.value = selectedCase.authorityAddress || "";
      form.elements.responsible.value = selectedCase.responsible || form.elements.responsible.value;
      syncCaseResponsibleOptions(form, form.elements.responsible.value);
      syncDocumentCustomSelect(form.elements.client);
      syncDocumentCustomSelect(form.elements.responsible);
    };
    $("#event-client").onchange = (event) => {
      const clientCase = state.cases.find((item) => item.clientId === Number(event.currentTarget.value));
      if (clientCase) {
        form.elements.caseId.value = clientCase.id;
        form.elements.authority.value = clientCase.court === "Не вказано" ? "" : clientCase.court || "";
        form.elements.location.value = clientCase.authorityAddress || "";
        form.elements.responsible.value = clientCase.responsible || form.elements.responsible.value;
        syncCaseResponsibleOptions(form, form.elements.responsible.value);
        syncDocumentCustomSelect(form.elements.caseId);
        syncDocumentCustomSelect(form.elements.responsible);
      }
    };
    const syncReminderState = () => {
      const enabled = Boolean(form.elements.reminderEnabled.checked);
      const settings = form.querySelector("[data-event-reminder-settings]");
      const toggleCopy = form.querySelector(".event-reminder-toggle > span:first-child");
      const channels = String(form.elements.reminderChannels.value || "CRM").split("+").map((item) => item.trim());
      const hasExternal = channels.some((channel) => ["Telegram", "SMS"].includes(channel));
      const hint = form.querySelector("[data-event-reminder-hint]");
      [form.elements.reminderBefore, form.elements.reminderChannels, form.elements.reminderRecipients].forEach((select) => {
        select.disabled = !enabled;
        syncDocumentCustomSelect(select);
      });
      if (settings) settings.hidden = !enabled;
      form.classList.toggle("event-reminder-enabled", enabled);
      if (toggleCopy) {
        toggleCopy.innerHTML = enabled
          ? "<strong>Нагадування увімкнено</strong><em>Налаштуйте коли, кому і через які канали нагадати.</em>"
          : "<strong>Нагадування вимкнено</strong><em>Увімкніть, якщо потрібно нагадати через CRM або зовнішні канали.</em>";
      }
      if (!hint) return;
      if (!enabled) {
        hint.hidden = true;
        hint.innerHTML = "";
        return;
      }
      hint.hidden = false;
      hint.innerHTML = `
        <strong>CRM-нагадування буде видно в системі.</strong>
        <span>${hasExternal ? "Telegram/SMS потраплять у план відправки і спрацюють після підключення провайдерів та контактів отримувача." : "Зовнішні повідомлення не плануються."}</span>
      `;
    };
    setupClientCustomSelects(form);
    form.elements.reminderEnabled.onchange = syncReminderState;
    form.elements.reminderChannels.onchange = syncReminderState;
    syncReminderState();
    $("#event-dialog").showModal();
  }

  function openFolderDialog(caseId, folderIndex = null, returnView = null) {
    const form = $("#folder-form");
    form.reset();
    form.elements.caseId.value = caseId;
    form.elements.folderIndex.value = "";
    state.folderDialogReturnView = returnView || ($("#documents")?.classList.contains("active") ? "documents" : "cases");
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
    if (payload.type === "client") {
      const client = state.clients.find((clientItem) => clientItem.id === Number(payload.clientId));
      if (!client) return;
      const relatedCases = state.cases.filter((caseItem) => caseItem.clientId === client.id);
      state.pendingDocumentDelete = payload;
      $("#delete-document-title").textContent = "Видалити клієнта?";
      $("#delete-document-text").textContent = relatedCases.length
        ? `Клієнт «${client.name}» має ${relatedCases.length} пов'язані справи. Разом із клієнтом буде видалено пов'язані справи, події, документи та фінансові записи.`
        : `Ви впевнені, що хочете видалити клієнта «${client.name}»?`;
      $("#delete-document-confirm").textContent = "Так, видалити";
      $("#delete-document-dialog").showModal();
      return;
    }
    if (payload.type === "clients") {
      const selectedIds = new Set((payload.clientIds || []).map((id) => String(id)));
      const clients = state.clients.filter((client) => selectedIds.has(String(client.id)));
      if (!clients.length) return;
      const relatedCases = state.cases.filter((caseItem) => selectedIds.has(String(caseItem.clientId)));
      state.pendingDocumentDelete = {
        ...payload,
        clientIds: clients.map((client) => client.id)
      };
      $("#delete-document-title").textContent = "Видалити клієнтів?";
      $("#delete-document-text").textContent = relatedCases.length
        ? `Ви вибрали ${clients.length} клієнтів. Разом із ними буде видалено ${relatedCases.length} пов'язаних справ, події, документи та фінансові записи цих справ.`
        : `Ви впевнені, що хочете видалити ${clients.length} клієнтів?`;
      $("#delete-document-confirm").textContent = "Так, видалити";
      $("#delete-document-dialog").showModal();
      return;
    }
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
    const folder = payload.folderPath?.length ? folderByPath(caseFolders(item), payload.folderPath) : caseFolders(item)[payload.folderIndex];
    const file = payload.type === "procedural"
      ? item.documents[payload.docIndex]
      : folder?.files[payload.fileIndex] || payload.file || payload.doc;
    if (!file) return;
    payload.documentId = payload.documentId || file.documentId || file.id || "";
    payload.documentName = payload.documentName || file.name || file.title || "";
    state.pendingDocumentDelete = payload;
    $("#delete-document-title").textContent = "Удалить документ?";
    $("#delete-document-text").textContent = `Вы уверены, что хотите удалить документ «${file.name}»?`;
    $("#delete-document-confirm").textContent = "Да, удалить";
    $("#delete-document-dialog").showModal();
  }

  return {
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
  };
}
