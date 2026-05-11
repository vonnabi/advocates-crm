# Frontend modules

This folder is for small JavaScript modules that are split out of the main prototype file.

- `chrome.js` wires the topbar menus, notification controls, profile actions, sidebar collapse, and demo link actions.
- `dialog-openers.js` fills and opens create/edit dialogs for clients, cases, tasks, events, folders, documents, and delete confirmations.
- `dialogs.js` wires modal close buttons and the shared delete confirmation flow.
- `forms/case-details.js` wires case essence, authority, and finance form submissions.
- `forms/case-items.js` wires case task and document folder form submissions.
- `forms/cases.js` wires case create/edit form submission.
- `forms/clients.js` wires client create/edit form submission.
- `forms/documents.js` wires document create/edit submission, folder placement, file metadata, and history updates.
- `forms/events.js` wires calendar event and case procedural action form submissions.
- `state.js` loads static JSON demo data and creates the initial application state.
- `navigation.js` persists and restores the active view, view history, selected cards, and sidebar state.
- `ui.js` contains shared formatting helpers, status tones, badges, profile photos, and SVG icons.
- `screens/ai.js` renders AI helper cards, the case assistant chat, and the knowledge base summary.
- `screens/analytics.js` renders analytics filters, KPI metrics, and summary panels.
- `screens/calendar.js` renders the calendar, event card, reminders, date navigation, and calendar-derived task entries.
- `screens/cases.js` renders the cases list, case preview, case detail screen, and related case UI helpers.
- `screens/clients.js` renders the clients list, client profile, and client mailing preview.
- `screens/dashboard.js` renders the dashboard metrics, upcoming events, and finance summary.
- `screens/documents.js` renders the global documents table and document status rows.
- `screens/finance.js` renders finance metrics and the case finance table.
- `screens/mailings.js` renders the mailing workflow, campaigns, templates, automation, preview, and mailing actions.
- `screens/osint.js` renders OSINT metrics, checks, and the selected check summary.
- `screens/planner.js` renders the planner summary, daily task plan, and team workload block.
- `screens/settings.js` renders bureau settings, users, integrations, and notification toggles.
- `screens/tasks.js` renders the tasks list, task detail card, task filters, drag ordering, and shared task derivation.

Next candidates for extraction:

- any other smaller secondary pages that are added later.
