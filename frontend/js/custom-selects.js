function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function closeScreenCustomSelects(root = document, except = null) {
  root.querySelectorAll(".screen-custom-select.is-open").forEach((shell) => {
    if (shell === except) return;
    shell.classList.remove("is-open");
    shell.querySelector(".document-custom-select-button")?.setAttribute("aria-expanded", "false");
    const menu = shell.querySelector(".document-custom-select-menu");
    if (menu) menu.hidden = true;
  });
}

function optionButton(option, select) {
  return `
    <button class="document-custom-select-option ${option.value === select.value ? "is-selected" : ""}" type="button" role="option" data-value="${escapeHtml(option.value)}" aria-selected="${option.value === select.value ? "true" : "false"}">
      <span aria-hidden="true">✓</span>
      <strong>${escapeHtml(option.textContent || "")}</strong>
    </button>
  `;
}

export function syncScreenCustomSelect(select) {
  const shell = select.nextElementSibling?.classList?.contains("screen-custom-select")
    ? select.nextElementSibling
    : null;
  if (!shell) return;
  const selected = select.selectedOptions?.[0] || select.options[0];
  const buttonText = shell.querySelector("[data-document-select-value]");
  const menu = shell.querySelector(".document-custom-select-menu");
  if (buttonText) buttonText.textContent = selected?.textContent || "";
  if (!menu) return;
  menu.innerHTML = [...select.children].map((child) => {
    if (child.tagName === "OPTGROUP") {
      return `
        <div class="document-custom-select-group">${escapeHtml(child.label || "")}</div>
        ${[...child.children].map((option) => optionButton(option, select)).join("")}
      `;
    }
    return optionButton(child, select);
  }).join("");
}

export function setupScreenCustomSelects(root = document, selector = "select") {
  const targetRoot = root || document;
  targetRoot.querySelectorAll(selector).forEach((select) => {
    select.classList.add("screen-native-select");
    select.tabIndex = -1;
    select.setAttribute("aria-hidden", "true");
    let shell = select.nextElementSibling?.classList?.contains("screen-custom-select")
      ? select.nextElementSibling
      : null;
    if (!shell) {
      shell = document.createElement("div");
      shell.className = "document-custom-select screen-custom-select";
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
        closeScreenCustomSelects(targetRoot, isOpen ? null : shell);
        shell.classList.toggle("is-open", !isOpen);
        shell.querySelector(".document-custom-select-button")?.setAttribute("aria-expanded", String(!isOpen));
        const menu = shell.querySelector(".document-custom-select-menu");
        if (menu) menu.hidden = isOpen;
      });
      shell.querySelector(".document-custom-select-menu")?.addEventListener("click", (event) => {
        const option = event.target.closest(".document-custom-select-option");
        if (!option) return;
        select.value = option.dataset.value || "";
        select.dispatchEvent(new Event("change", { bubbles: true }));
        syncScreenCustomSelect(select);
        closeScreenCustomSelects(targetRoot);
      });
    }
    if (!select.dataset.screenSelectSyncBound) {
      select.dataset.screenSelectSyncBound = "true";
      select.addEventListener("change", () => syncScreenCustomSelect(select));
    }
    syncScreenCustomSelect(select);
  });
  if (!targetRoot.dataset.screenSelectsBound) {
    targetRoot.dataset.screenSelectsBound = "true";
    targetRoot.addEventListener("click", (event) => {
      if (event.target.closest(".screen-custom-select")) return;
      closeScreenCustomSelects(targetRoot);
    });
    targetRoot.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeScreenCustomSelects(targetRoot);
    });
  }
  if (!document.documentElement.dataset.screenSelectsDocumentBound) {
    document.documentElement.dataset.screenSelectsDocumentBound = "true";
    document.addEventListener("click", (event) => {
      if (event.target.closest(".screen-custom-select")) return;
      closeScreenCustomSelects(document);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeScreenCustomSelects(document);
    });
  }
}
