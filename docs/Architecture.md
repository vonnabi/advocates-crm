# Architecture

Living architecture map for the Advocates Bureau CRM. Update after important
technical decisions. Module details: [[CRM-Modules]]. Code map: [[PROJECT_MAP]].

## Stack at a glance

- **Frontend:** vanilla JS (ES modules), no build step. SPA served by Django.
- **Backend:** Django, JSON API under `/api/`, runs on `127.0.0.1:8001`.
- **Database:** SQLite (`backend/db.sqlite3`) with per-app models + demo seed.
- **Documents:** rich-text `content` field + uploaded files + [[ONLYOFFICE]].

## Frontend

- Entry/orchestrator: `frontend/app.js`; markup `frontend/index.html`.
- Screens: `frontend/js/screens/*.js` — one per module.
- Forms/dialogs: `frontend/js/forms/*.js`, `frontend/js/dialog-openers.js`.
- State: `frontend/js/state.js`; API client: `frontend/js/api.js`.
- Styling: `frontend/styles.css` + `frontend/design-tokens.css`
  (see [[Design-System]], [[Typography-System]], [[Responsive-Rules]], [[UI_PATTERNS]]).
- Asset cache-busting via `?v=...` query on module imports.

## Backend

- Project config: `backend/config/` (`urls.py`, `api.py`, `middleware.py`).
- Django apps: `cases`, `clients`, `finance`, `tasks`, `calendar_app`,
  `communications`, `accounts`.
- API: REST-ish JSON endpoints under `/api/...`; CSRF enforced on mutations
  (see [[Security]]).
- Run locally: `npm run serve` (Django dev server on :8001).

## Database

- SQLite for the prototype; models live in each app's `models.py`.
- Demo data is seeded (`seed_demo`) and flagged with `is_demo`; a Settings
  toggle hides/shows it.

## Authentication & permissions

- Session-based auth; bureau-wide config in `CRMSettings`.
- Role/case access intended to gate visibility (see [[modules/Settings]], [[Security]]).

## File storage & documents

- `CaseDocument` stores rich-text `content` (HTML) plus optional uploaded files.
- File URLs for the document server are signed with a token, not session auth.
- Full editing via [[ONLYOFFICE]] Document Server, with a built-in fallback
  editor when the server is unavailable. See [[modules/Documents]].

## AI integrations

- In-product assistants: [[modules/AI-Assistants]].
- Working/dev agents and prompts: [[AI-Agents]], [[Development-Agents]].

## Deployment

- `render.yaml`, `docker-compose.onlyoffice.yml`. See [[Deployment]], [[ONLYOFFICE]].

## Modules

[[modules/Dashboard]] · [[modules/Cases]] · [[modules/Clients]] ·
[[modules/Documents]] · [[modules/Finance]] · [[modules/Tasks]] ·
[[modules/Calendar]] · [[modules/Mailing]] · [[modules/AI-Assistants]] ·
[[modules/Settings]]

## Open questions

- Final deployment target: Render, VPS, or hybrid?
- Which document formats are production-critical?
- Which roles are required for pilot users?

#doc #architecture
