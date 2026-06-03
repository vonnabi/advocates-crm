// Single source of truth for case-document folder auto-filing.
// Previously this logic was copy-pasted into screens/documents.js, forms/documents.js
// and screens/cases.js with diverging fallback order — so the form filed a document
// into one folder while the list inferred another. Keep it here only.

export const CASE_DOCUMENT_FOLDER_NAMES = ["Позови", "Клопотання", "Запити", "Відповіді та ухвали", "Інші документи"];

export function inferCaseDocumentFolder(doc = {}, fallback = "Інші документи") {
  const haystack = [doc.type, doc.name, doc.folder, fallback].map((value) => String(value || "").toLowerCase()).join(" ");
  if (/клопотан|клопа/.test(haystack)) return "Клопотання";
  if (/адвокатськ.*запит|запит|витребуван/.test(haystack)) return "Запити";
  if (/ухвал|відповід|рішенн|постанова/.test(haystack)) return "Відповіді та ухвали";
  if (/позов|позовн|заява/.test(haystack)) return "Позови";
  if (fallback && !CASE_DOCUMENT_FOLDER_NAMES.includes(fallback)) return fallback;
  return CASE_DOCUMENT_FOLDER_NAMES.includes(fallback) ? "Інші документи" : fallback || "Інші документи";
}
