# Dashboard Style Reference

Dashboard is the primary visual reference for the CRM interface.

Use this page when polishing other modules so `Clients`, `Cases`, `Documents`, `Calendar`, `Tasks`, `Finance`, `OSINT`, and `Settings` feel like the same product.

## Source Files

- `frontend/js/screens/dashboard.js`
- `frontend/styles.css`
- `frontend/design-tokens.css`

## Visual Principles

- Dense but calm legal SaaS UI.
- White panels on light grey page background.
- 8px card radius.
- Thin blue-grey borders.
- Soft shadows, no heavy decoration.
- Compact text.
- Short labels.
- Icons explain status where possible.
- Right panels use the same card language as main content.

## Page Structure

Use this hierarchy:

1. Page header from global layout.
2. Optional hero/work summary panel.
3. KPI grid.
4. Main content grid.
5. Right-side support column where useful.
6. Compact empty states inside the same cards.

## Spacing Pattern

Dashboard uses compact spacing:

- page/module grid gap: about 14px;
- panel padding: about 16px on desktop;
- KPI grid gap: about 12px;
- card internal gap: about 14px;
- row padding: about 12px vertical;
- compact right-column row gap: about 10px.

When another page looks too airy, reduce it toward this Dashboard rhythm before inventing a new layout.

## Typography Pattern

Use centralized typography tokens from [[Typography-System]].

Dashboard hierarchy:

- page/section titles: compact bold;
- card titles: bold and short;
- card descriptions: muted, small, one line when possible;
- table/list row title: bold, compact;
- row metadata: muted small text;
- KPI value: large only inside KPI cards;
- buttons: compact semibold.

Avoid large standalone text in right panels, table rows, and cards unless it is a KPI value.

## KPI Cards

Dashboard KPI cards are the reference:

- 1 compact label;
- 1 strong value;
- optional trend/hint;
- 1 circular soft icon on the right;
- consistent hover state;
- no long paragraphs.

Other KPI cards should follow this structure.

## Cards And Panels

Dashboard cards use:

- `panel` as the base;
- title + short description in `.dashboard-card-head`;
- rows or mini-grid below;
- action button in the card header or footer;
- no nested decorative cards unless the data needs grouping.

## Rows And Lists

Dashboard row pattern:

- fixed date/status column when needed;
- main title column;
- optional status/action icon;
- muted metadata below title;
- one border between rows.

This is the preferred pattern for dense lists.

## Icons

Use Dashboard icon sizing as the baseline:

- status icon container: about 24px;
- status glyph: about 12px;
- KPI icon container: about 42px;
- KPI glyph: about 21px;
- quick action icon: about 16px.

Do not mix huge icons with compact table text.

## Right Panels

Right panels should follow Dashboard side cards:

- compact card title;
- muted description;
- short rows;
- small status icons;
- action buttons with consistent height;
- no oversized text blocks.

If a right panel becomes too tall, collapse secondary information or move it into tabs/accordion.

## Buttons

Use the Dashboard button rhythm:

- primary for main action;
- secondary for navigation/open actions;
- compact height;
- icon + text only when it adds clarity;
- full-width only in narrow cards or mobile.

## What To Avoid

- Huge right-panel text.
- Random font sizes.
- Big empty areas in tables.
- Overwide action columns.
- Menus far away from the item they control.
- Status text where a compact icon is enough.
- Cards inside cards unless there is a real repeated item.

## Application Order

When polishing a module:

1. Match Dashboard typography.
2. Match Dashboard card padding and gaps.
3. Match Dashboard KPI structure.
4. Match Dashboard row/list density.
5. Match Dashboard right panel style.
6. Check responsive behavior.
7. Update the relevant module note.
