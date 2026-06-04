// Shared helpers for rich-text document content.
// The built-in document editor stores HTML in `content`; older documents and
// quick drafts store plain text. These helpers let the editor, preview and
// export paths treat both transparently.

const HTML_TAG_RE = /<\/?(p|div|br|h[1-6]|ul|ol|li|b|i|u|strong|em|span|a|blockquote|table|tr|td)\b[^>]*>/i;

export function isHtmlDocContent(value = "") {
  return HTML_TAG_RE.test(String(value || ""));
}

function escapeText(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// Strip anything unsafe before injecting stored HTML into the DOM or an export.
export function sanitizeDocHtml(value = "") {
  let html = String(value || "");
  html = html.replace(/<\s*(script|style|iframe|object|embed|link|meta)\b[\s\S]*?<\/\s*\1\s*>/gi, "");
  html = html.replace(/<\s*(script|style|iframe|object|embed|link|meta)\b[^>]*\/?>/gi, "");
  html = html.replace(/\son\w+\s*=\s*"[^"]*"/gi, "");
  html = html.replace(/\son\w+\s*=\s*'[^']*'/gi, "");
  html = html.replace(/\son\w+\s*=\s*[^\s>]+/gi, "");
  html = html.replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*\2/gi, '$1="#"');
  return html;
}

// Plain text → simple paragraph HTML for the editor surface.
export function plainToDocHtml(value = "") {
  const text = String(value || "");
  if (text.trim() === "") return "<p><br></p>";
  return text
    .split("\n")
    .map((line) => (line.trim() === "" ? "<p><br></p>" : `<p>${escapeText(line)}</p>`))
    .join("");
}

// Any stored content → safe HTML ready for a contenteditable surface or export.
export function docContentToHtml(value = "") {
  const str = String(value || "");
  return isHtmlDocContent(str) ? sanitizeDocHtml(str) : plainToDocHtml(str);
}

// HTML → readable plain text (for .txt-style exports and quick-draft textareas).
export function docHtmlToPlainText(value = "") {
  let html = String(value || "");
  if (!isHtmlDocContent(html)) return html;
  html = html.replace(/<\s*br\s*\/?>/gi, "\n");
  html = html.replace(/<li\b[^>]*>/gi, "• ");
  html = html.replace(/<\/\s*(p|div|h[1-6]|li|tr)\s*>/gi, "\n");
  html = html.replace(/<[^>]+>/g, "");
  html = html
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#039;/gi, "'");
  return html.replace(/\n{3,}/g, "\n\n").trim();
}

// Render stored content for read-only views: HTML as-is (sanitized), text escaped.
export function docContentToDisplayHtml(value = "", fallback = "") {
  const str = String(value || "");
  if (str.trim() === "") return escapeText(fallback);
  return isHtmlDocContent(str) ? sanitizeDocHtml(str) : escapeText(str);
}
