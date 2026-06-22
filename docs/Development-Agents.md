# Development Agents

These are Codex working modes for building the CRM.

## Logic Agent

Use for business logic, data flow, API, backend integration, validation, roles, and state.

## UI/CSS Agent

Use for responsive layout, typography, spacing, icons, visual hierarchy, menus, modals, and design consistency.

## Content/UX Agent

Use for visible wording, labels, helper text, legal terminology, empty states, and confirmation messages.

## QA/Review Agent

Use for final review, screenshots, responsive checks, accessibility, console errors, and regression risk.

## Agent Selection Matrix

| If The Task Is About | Primary Agent | Supporting Agent |
| --- | --- | --- |
| Backend/API/data persistence/forms/validation | Logic Agent | QA/Review Agent |
| Layout/CSS/spacing/icons/modals/dropdowns | UI/CSS Agent | QA/Review Agent |
| Responsive behavior and mobile drawer | UI/CSS Agent | QA/Review Agent |
| Interface text and legal terminology | Content/UX Agent | UI/CSS Agent if text overflows |
| Full module audit | QA/Review Agent | Logic Agent + UI/CSS Agent as needed |
| Deployment/security/readiness | Logic Agent | QA/Review Agent |

## Skill Pairing

| Agent | Typical Skills |
| --- | --- |
| Logic Agent | `skills/crm-module-audit/SKILL.md`, `skills/crm-deployment/SKILL.md` |
| UI/CSS Agent | `skills/crm-frontend-polish/SKILL.md`, `skills/responsive-ui-audit/SKILL.md`, `skills/typography-system/SKILL.md` |
| Content/UX Agent | `skills/crm-module-audit/SKILL.md` |
| QA/Review Agent | `skills/crm-module-audit/SKILL.md`, `skills/responsive-ui-audit/SKILL.md` |

CRM AI agents are separate future in-app assistants. See [[AI-Agents]].
