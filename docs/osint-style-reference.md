# OSINT style reference

This file fixes OSINT as the current visual baseline for the CRM.
Measurements were taken from the live local UI at `1440px` viewport with computed browser styles.

Reference artifacts:
- Screenshot: `/tmp/osint-style-reference-1440.png`
- Raw computed styles: `/tmp/osint-style-reference.json`

## Overall Principle

OSINT is a compact SaaS screen. It uses dense spacing, small bold labels, strong numeric hierarchy, 8px card radii, and restrained blue action states.

Use this page as the visual reference for:
- top page headers
- KPI blocks
- cards and panels
- tabs
- filters and buttons
- right sidebar panels
- list rows
- badges
- icon containers
- chart labels

## Typography Scale From OSINT

| UI element | Size | Line height | Weight | Notes |
|---|---:|---:|---:|---|
| Page title | 13px | 14.56px | 950 | Example: `OSINT` in top header. |
| Page subtitle / eyebrow | 6.75px | 8.37px | 600 | Example: `Юридичне бюро`. |
| Sidebar item | 8.25px | 9.24px | 850 | 34px row height, icon + text grid. |
| Primary tab | 7.5px | 8.4px | 850 | Active tab uses blue underline. |
| Secondary tab | 7.5px | 8.4px | 850 | Same as primary, tighter panel use. |
| Search input | 7.75px | 9.61px | 850 | Compact, bold placeholder/text. |
| Date range button | 7.5px | 8.4px | 850 | 40px high, 8px radius. |
| Primary action button | 7.5px | 8.4px | 850 | 40px high, 7px radius. |
| KPI label | 7.75px | 9.145px | 800 | Muted color, upper small hierarchy. |
| KPI value | 13px | 14.56px | 950 | Main number in KPI cards. |
| KPI delta/helper | 6.75px | 8.37px | 600 | Green/red state text. |
| Main panel title | 9.75px | 11.505px | 950 | Big chart/card headers. |
| Right panel title | 8.75px | 10.325px | 950 | Right column titles. |
| Chart legend item | 9px | 11.16px | 750 | Colored label rows. |
| Chart axis label | 12px | 14.88px | 700 | SVG text; visually larger by browser SVG rendering. |
| Donut legend value | 9px | 11.16px | 900 | Percent/count values. |
| Mention row title | 11px | 13.2px | 900 | Strong title in feed rows. |
| Mention row meta/date | 10px | 12.2px | 750 | Source/date/secondary lines. |
| Badge | 6.75px | 7.56px | 850 | Pill status badge. |
| List hint | 10.5px | 13.02px | 850 | Example: `+14 згадок...`. |
| Graph node text | 9px | 11.16px | 850 | Relationship graph node labels. |
| Graph legend | 8px | 9.92px | 750 | Small legend labels. |
| Bar list label | 8px | 9.92px | 750 | Data type distribution labels. |
| Bar list value | 8px | 9.92px | 900 | Small numeric values. |
| Active case title | 10.5px | 12.18px | 900 | Right active cases list. |
| Progress label | 10.5px | 11.76px | 750 | `Прогрес аналізу`. |
| Quick action button | 7.5px | 8.4px | 850 | 40px high, icon + label. |

## Spacing And Component Sizes

| Component | Size / spacing | Notes |
|---|---:|---|
| Page content gap | 10-14px | OSINT uses tight vertical rhythm. |
| KPI grid gap | 10px | Six compact cards on desktop. |
| KPI card | min-height 60px computed, CSS target 88px before compact overrides | Padding 8-12px, radius 8px. |
| KPI icon bubble | 32px computed | Radius 8px or circular depending state. |
| Panel padding | 12px | Main OSINT cards. |
| Main chart height | 172px | Keeps chart compact. |
| Source donut | 112px in source panel, 150px in wider panel | Donut hole via pseudo-element. |
| Mention row icon | 32px | Circular source icon. |
| Mention row padding | 5px 0 | Dense feed rows. |
| Quick action button | 40px high | Touch-safe while still compact. |
| Top filter controls | 40px high | Search/date/report button. |

## Icon System

| Icon placement | Size | Container |
|---|---:|---|
| Sidebar icon | about 18px visual | nav grid row, 34px height |
| KPI icon | 18px inside 32px bubble | colored soft background |
| Search icon | token small icon, muted | inline in 40px input |
| Quick action icon | 13px computed | no bubble, blue action color |
| Source icon | 32px circle | source-specific tone |
| Source card icon | 34px box, inner icon 18px | 9px radius |
| Notification badge | 18px circle | 7px text |

## Color Hierarchy

| Role | Color |
|---|---|
| Main text | `rgb(21, 32, 51)` |
| Muted text | `rgb(104, 117, 138)` |
| Action blue | `rgb(31, 78, 121)` |
| Positive green | `rgb(27, 155, 105)` / `#27ae6f` |
| Danger red | `#ef4444` / `rgb(220, 38, 38)` |
| Card background | `#fff` |
| Soft panel background | `#f8fbff`, `#f7fbff` |
| Border | `var(--line)` |

## Blocks To Mirror Across CRM

1. Top header:
   - Page title: 13px / 950.
   - Subtitle: 6.75px / 600.
   - Header controls: compact, 32-44px blocks.

2. KPI row:
   - Label small and muted.
   - Number bold and dark.
   - Icon bubble on the right.
   - No oversized text.

3. Main panels:
   - Title around 9.75px / 950.
   - 12px padding.
   - Card radius 8px.
   - Chart/list content compact.

4. Right column:
   - Title around 8.75px / 950.
   - Row titles 10-10.5px.
   - Meta 10px or below.
   - Progress and badges compact.

5. Lists/tables:
   - Dense rows.
   - Primary item title bold.
   - Secondary metadata muted and smaller.
   - Badges small pills.

6. Buttons:
   - 7.5px / 850 for compact controls.
   - 40px height for main controls and quick actions.
   - Icons 13-18px depending context.

## Current Token Mapping Recommendation

The central design tokens should map CRM-wide typography to the OSINT baseline:

| Token | OSINT target |
|---|---:|
| `--font-size-page-title` | 13px desktop compact |
| `--font-size-section-title` | 9.75px |
| `--font-size-card-title` | 8.75-9.75px |
| `--font-size-body` | 7.75-8px |
| `--font-size-body-sm` | 6.75-7.5px |
| `--font-size-caption` | 6.75px |
| `--font-size-button` | 7.5px |
| `--font-size-sidebar` | 8.25px |
| `--font-size-table-header` | 7.5-8px |
| `--font-size-table-cell` | 7.75-8px |
| `--font-size-badge` | 6.75px |
| `--font-size-kpi-value` | 13px |

## Notes

- OSINT already uses the desired compact look better than most screens.
- The main CRM inconsistency is not only font size, but hierarchy: some screens use card/right-panel titles and body text too large compared to OSINT.
- For the next typography pass, align every page to this OSINT scale first, then adjust only where readability demands it.
