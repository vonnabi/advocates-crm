# AI Agents

These are future in-app CRM AI assistants for lawyers and staff. They are not Codex development agents.

## Document Agent

Purpose: draft, summarize, classify, and prepare documents.
Permissions: access only allowed case documents.
Forbidden: sending or filing documents without confirmation.
Human confirmation: required before export, send, or signature flow.

## Legal Search Agent

Purpose: search internal case materials and connected legal sources.
Permissions: read-only by user role.
Forbidden: unrestricted data access.
Human confirmation: required before relying on generated conclusions.

## Text Drafting Agent

Purpose: draft letters, claims, requests, and client messages.
Permissions: use selected client/case context.
Forbidden: sending messages without confirmation.
Human confirmation: always required.

## Case Summary Agent

Purpose: summarize case status, documents, tasks, deadlines, and finances.
Permissions: same as user case access.
Forbidden: exposing inaccessible cases.
Human confirmation: required for external sharing.

## Deadline Agent

Purpose: detect and monitor deadlines.
Permissions: calendar/tasks/case deadlines.
Forbidden: changing deadlines without confirmation.
Human confirmation: required for edits.

## Client Communication Agent

Purpose: prepare client updates through email, Telegram, SMS.
Permissions: selected client/case only.
Forbidden: sending without explicit confirmation.
Human confirmation: always required.

## Finance Assistant Agent

Purpose: explain invoices, payments, debts, and finance summaries.
Permissions: finance data allowed by role.
Forbidden: changing payments without confirmation.
Human confirmation: required for creation/edit/delete.

## Security Notes

Agents must follow permissions, avoid unrestricted data access, never send messages without confirmation, and avoid legal advice without review/disclaimer where needed.

