# Typography System

Use this local skill when improving typography consistency.

## Goal

All typography must be controlled from one central design system with adaptive fluid typography.

## Check

Page titles, section titles, card titles, body text, labels, buttons, sidebar text, table headers, table cells, badges, inputs, placeholders, modals, popups, dropdowns, tooltips, notifications, AI chat, empty states, error states, and loading states.

## Recommended Tokens

Display, page-title, section-title, card-title, body-lg, body, body-sm, caption, label, button, sidebar, table-header, table-cell, badge, input.

## Rules

- No random hardcoded font sizes.
- No mixed font families.
- No inconsistent font weights.
- Use centralized tokens/classes.
- Test desktop/tablet/mobile.

## Fluid Values

- display: `clamp(24px, 2.2vw, 34px)`
- page-title: `clamp(20px, 1.8vw, 28px)`
- section-title: `clamp(17px, 1.35vw, 22px)`
- card-title: `clamp(15px, 1vw, 17px)`
- body-lg: `clamp(15px, 0.9vw, 16px)`
- body: `clamp(14px, 0.75vw, 15px)`
- body-sm: `clamp(12px, 0.65vw, 13px)`
- caption: `clamp(11px, 0.55vw, 12px)`
- label: `clamp(12px, 0.65vw, 13px)`
- button: `clamp(13px, 0.7vw, 14px)`
- sidebar: `clamp(13px, 0.7vw, 14px)`
- table-header: `clamp(11px, 0.6vw, 12px)`
- table-cell: `clamp(13px, 0.75vw, 14px)`
- badge: `clamp(11px, 0.55vw, 12px)`
- input: `clamp(13px, 0.75vw, 14px)`

