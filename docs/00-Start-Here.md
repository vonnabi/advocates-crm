# Start Here

This is the entry point for the Advocates Bureau CRM project knowledge base.

Open the `docs/` folder in Obsidian or read it directly as Markdown.

## Recommended Reading Order

- [[Architecture]]
- [[CRM-Modules]]
- [[Design-System]]
- [[Dashboard-Style-Reference]]
- [[Responsive-Rules]]
- [[Typography-System]]
- [[AI-Agents]]
- [[Development-Agents]]
- [[Deployment]]
- [[Security]]
- [[ROADMAP]]
- [[Decisions]]
- [[Glossary]]
- [[PROJECT_MAP]]
- [[READINESS_AUDIT]]
- [[NEXT_STEPS]]
- [[UI_PATTERNS]]
- [[obsidian/Obsidian-Setup]]
- [[obsidian/Obsidian-Index]]

## Codex Workflow

Before important work, Codex should read `AGENTS.md`, this folder, the relevant module note, the relevant project agent, and the relevant local skill.

## Task Routing

| Work | Read Agent | Read Skill | Read Docs |
| --- | --- | --- | --- |
| Logic/API/data saving | `project-agents/logic-agent.md` | `skills/crm-module-audit/SKILL.md` | [[Architecture]], relevant [[CRM-Modules]] note |
| UI/CSS/design polish | `project-agents/ui-css-agent.md` | `skills/crm-frontend-polish/SKILL.md` | [[Design-System]], [[UI_PATTERNS]] |
| Responsive/mobile/tablet | `project-agents/ui-css-agent.md`, `project-agents/qa-review-agent.md` | `skills/responsive-ui-audit/SKILL.md` | [[Responsive-Rules]] |
| Typography | `project-agents/ui-css-agent.md` | `skills/typography-system/SKILL.md` | [[Typography-System]] |
| Text/labels/UX wording | `project-agents/content-ux-agent.md` | `skills/crm-module-audit/SKILL.md` | [[Glossary]], relevant module note |
| QA/readiness | `project-agents/qa-review-agent.md` | `skills/crm-module-audit/SKILL.md` | [[READINESS_AUDIT]], [[NEXT_STEPS]] |
| Deployment | `project-agents/logic-agent.md`, `project-agents/qa-review-agent.md` | `skills/crm-deployment/SKILL.md` | [[Deployment]], [[Security]] |
