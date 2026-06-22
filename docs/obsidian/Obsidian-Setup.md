# Obsidian Setup

## How To Open

1. Open Obsidian.
2. Choose "Open folder as vault".
3. Select the project root folder:
   `/Users/vovaladyga/Dev/crm-prototype`
4. Start from `docs/00-Start-Here.md`.

The project root is preferred over only `docs/`, because it also exposes `AGENTS.md`, `project-agents/`, and `skills/`.

## How To Use

- Use this folder as the project knowledge base.
- Keep notes short and close to real project decisions.
- Update docs after important CRM changes.
- Use Obsidian links like `[[Architecture]]`.
- No Obsidian plugins are required.

## Codex Usage

Before important tasks, Codex should read:

1. `AGENTS.md`
2. relevant docs in `docs/`
3. relevant `project-agents/*.md`
4. relevant `skills/*/SKILL.md`

## Connection Between Files

- `AGENTS.md`: project-wide working rules.
- `project-agents/`: role-specific development instructions.
- `skills/`: repeatable workflows for common task types.
- `docs/`: project knowledge base.
- `.obsidian/`: local vault settings, workspace, and bookmarks for this project.

## Recommended Task Flow

1. Start from `AGENTS.md`.
2. Open `docs/00-Start-Here.md`.
3. Open the relevant module note from `docs/modules/`.
4. Choose the matching file from `project-agents/`.
5. Choose the matching local skill from `skills/`.
6. Inspect affected source code.
7. Plan, edit, verify, and update docs when the decision is important.

## Important Distinction

- `project-agents/` describes how Codex should work on the codebase.
- `docs/AI-Agents.md` describes future AI assistants inside the CRM product.
