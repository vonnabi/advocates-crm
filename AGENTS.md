# AGENTS.md

## Project

Advocates Bureau CRM is a legal CRM system for a law firm. It includes clients, cases, documents, calendar, tasks, mailing, finance, analytics, OSINT, settings, and future AI assistants.

## Core Rules For Codex

- Do not make random changes.
- Always inspect the project structure before coding.
- Read relevant files from `docs/` before important work.
- Choose the correct development agent from `project-agents/`.
- Choose the relevant local skill from `skills/`.
- Create a short implementation plan before coding.
- Preserve architecture, localization, routes, business logic, permissions, and security.
- Prefer existing components, tokens, and patterns.
- Run lint, build, or tests when available and relevant.
- Summarize changed files, checks, and risks.

## Standard Workflow

Before any task:

1. Read `AGENTS.md`.
2. Read relevant documentation in `docs/`.
3. Read the relevant file in `project-agents/`.
4. Read the relevant local skill in `skills/`.
5. Inspect affected code.
6. Create a short implementation plan.
7. Apply controlled changes.
8. Run lint/build/tests if available and relevant.
9. Summarize changed files and risks.

## Task Routing Matrix

Use this matrix before choosing files to edit.

| Task Type | Development Agent | Local Skill | Docs To Read First |
| --- | --- | --- | --- |
| Business logic, API, saving data, validation, permissions | `project-agents/logic-agent.md` | `skills/crm-module-audit/SKILL.md` | `docs/Architecture.md`, relevant `docs/modules/*.md` |
| Visual UI polish, layout, spacing, icons, menus, modals | `project-agents/ui-css-agent.md` | `skills/crm-frontend-polish/SKILL.md` | `docs/Design-System.md`, `docs/UI_PATTERNS.md`, relevant module note |
| Responsive desktop/tablet/mobile work | `project-agents/ui-css-agent.md` + `project-agents/qa-review-agent.md` | `skills/responsive-ui-audit/SKILL.md` | `docs/Responsive-Rules.md`, `docs/Design-System.md` |
| Typography consistency | `project-agents/ui-css-agent.md` | `skills/typography-system/SKILL.md` | `docs/Typography-System.md`, `docs/Design-System.md` |
| Visible wording, labels, empty/error/success text | `project-agents/content-ux-agent.md` | `skills/crm-module-audit/SKILL.md` | `docs/Glossary.md`, relevant module note |
| Module audit or readiness check | `project-agents/qa-review-agent.md` | `skills/crm-module-audit/SKILL.md` | `docs/READINESS_AUDIT.md`, relevant module note |
| Production/deployment work | `project-agents/logic-agent.md` + `project-agents/qa-review-agent.md` | `skills/crm-deployment/SKILL.md` | `docs/Deployment.md`, `docs/Security.md`, `docs/Architecture.md` |

## Development Agents

- Logic Agent: `project-agents/logic-agent.md`
- UI/CSS Agent: `project-agents/ui-css-agent.md`
- Content/UX Agent: `project-agents/content-ux-agent.md`
- QA/Review Agent: `project-agents/qa-review-agent.md`

## Important Distinction

Codex development agents are instructions for building this CRM.

CRM AI agents are future in-app assistants for lawyers and staff. They are documented separately in `docs/AI-Agents.md`.
