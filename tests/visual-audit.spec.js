import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

test.describe.configure({ mode: "serial" });
test.skip(!process.env.RUN_VISUAL_AUDIT, "Run with npm run test:visual to capture CRM visual audit screenshots.");
test.setTimeout(180_000);

const auditRoot = path.join(process.cwd(), "output", "ui-audit", "visual-regression");
const widths = [320, 375, 390, 430, 768, 1024, 1280, 1440, 1920];
const views = [
  "dashboard",
  "cases",
  "clients",
  "calendar",
  "tasks",
  "documents",
  "mailings",
  "ai",
  "planner",
  "analytics",
  "finance",
  "osint",
  "settings"
];

const primaryDialogs = [
  { view: "clients", trigger: "#add-client", dialog: "#client-dialog", name: "client-dialog" },
  { view: "cases", trigger: "#create-case-from-list", dialog: "#case-dialog", name: "case-dialog" },
  { view: "calendar", trigger: "#add-event", dialog: "#event-dialog", name: "event-dialog" },
  { view: "tasks", trigger: "[data-add-task]", dialog: "#task-dialog", name: "task-dialog" },
  { view: "documents", trigger: "[data-documents-add]", dialog: "#document-dialog", name: "document-dialog" }
];

const menuStates = [
  { view: "clients", selector: ".clients-table [data-action-menu-trigger]", name: "clients-action-menu" },
  { view: "cases", selector: ".case-list-table [data-action-menu-trigger]", name: "cases-action-menu" },
  { view: "tasks", selector: ".tasks-table [data-action-menu-trigger], .task-list [data-action-menu-trigger]", name: "tasks-action-menu" },
  { view: "documents", selector: "#documents [data-document-row] [data-action-menu-trigger], #documents [data-action-menu-trigger]", name: "documents-action-menu" },
  { view: "finance", selector: "#finance [data-action-menu-trigger]", name: "finance-action-menu" }
];

const dropdownStates = [
  { view: "cases", selector: "#cases .document-custom-select-button", name: "cases-filter" },
  { view: "clients", selector: "#clients .document-custom-select-button", name: "clients-filter" },
  { view: "calendar", selector: "#calendar .document-custom-select-button", name: "calendar-filter" },
  { view: "documents", selector: "#documents .document-custom-select-button", name: "documents-filter" },
  { view: "finance", selector: "#finance .document-custom-select-button", name: "finance-filter" },
  { view: "osint", selector: "#osint .document-custom-select-button", name: "osint-filter" }
];

function ensureCleanAuditRoot() {
  fs.rmSync(auditRoot, { recursive: true, force: true });
  fs.mkdirSync(auditRoot, { recursive: true });
}

async function waitForApp(page) {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(document.body.dataset.view));
  await expect(page.locator(".nav-item[data-view='dashboard']")).toBeVisible();
}

async function openMobileNavigation(page) {
  await page.locator("[data-mobile-menu]").click();
  await expect.poll(() => page.evaluate(() => document.body.classList.contains("sidebar-drawer-open"))).toBeTruthy();
}

async function openView(page, view, width) {
  if (width < 1024) {
    await openMobileNavigation(page);
  }

  await page.locator(`.nav-item[data-view="${view}"]`).click();
  await expect(page.locator(`#${view}`), `${view} should be active`).toHaveClass(/active/);

  if (width < 1024) {
    await expect(page.locator("[data-sidebar-overlay]")).toBeHidden();
  }

  await page.waitForTimeout(80);
}

async function hardOverflow(page) {
  return page.evaluate(() => ({
    documentOverflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
    bodyOverflow: Math.max(0, document.body.scrollWidth - document.body.clientWidth),
    viewportWidth: document.documentElement.clientWidth,
    viewportHeight: document.documentElement.clientHeight
  }));
}

async function textOverflowCandidates(page, activeView) {
  return page.evaluate((view) => {
    const root = document.querySelector(`#${view}`) || document.body;
    return [...root.querySelectorAll("h1,h2,h3,h4,p,span,strong,small,button,th,td,label,a,em")]
      .filter((node) => {
        const style = window.getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        const text = (node.textContent || "").replace(/\s+/g, " ").trim();
        if (style.visibility === "hidden" || style.display === "none" || rect.width < 8 || rect.height < 8) return false;
        if (!text) return false;
        const intentionalEllipsis =
          style.textOverflow === "ellipsis" &&
          (style.overflow === "hidden" || style.overflowX === "hidden") &&
          style.whiteSpace === "nowrap";
        if (intentionalEllipsis) return false;
        return node.scrollWidth > node.clientWidth + 2 || node.scrollHeight > node.clientHeight + 2;
      })
      .slice(0, 30)
      .map((node) => ({
        tag: node.tagName.toLowerCase(),
        className: String(node.className || "").slice(0, 90),
        text: (node.textContent || "").replace(/\s+/g, " ").trim().slice(0, 120),
        clientWidth: node.clientWidth,
        scrollWidth: node.scrollWidth
      }));
  }, activeView);
}

async function screenshot(page, width, name) {
  const dir = path.join(auditRoot, `w${width}`);
  fs.mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: path.join(dir, `${name}.png`), fullPage: true });
}

async function writeJson(name, data) {
  fs.mkdirSync(auditRoot, { recursive: true });
  fs.writeFileSync(path.join(auditRoot, name), `${JSON.stringify(data, null, 2)}\n`);
}

function writeMarkdownReport(audit, states) {
  const checkedWidths = [...new Set(audit.map((item) => item.width))].sort((a, b) => a - b);
  const checkedViews = [...new Set(audit.map((item) => item.view))].sort();
  const hardOverflow = audit.filter((item) => item.documentOverflow > 2 || item.bodyOverflow > 2);
  const textIssues = audit
    .map((item) => ({
      width: item.width,
      view: item.view,
      count: item.textOverflowCandidates?.length || 0,
      samples: item.textOverflowCandidates?.slice(0, 3) || []
    }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count || a.width - b.width || a.view.localeCompare(b.view));

  const stateGroups = states.reduce((groups, item) => {
    groups[item.type] = (groups[item.type] || 0) + 1;
    return groups;
  }, {});

  const lines = [
    "# CRM Visual Audit",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Coverage",
    "",
    `- Widths: ${checkedWidths.join(", ")}`,
    `- Main views: ${checkedViews.length} (${checkedViews.join(", ")})`,
    `- Main screenshots: ${audit.length}`,
    `- State screenshots: ${states.length}`,
    `- State coverage: ${Object.entries(stateGroups).map(([key, value]) => `${key} ${value}`).join(", ") || "none"}`,
    "",
    "## Hard Layout Checks",
    "",
    hardOverflow.length
      ? `- Horizontal overflow found: ${hardOverflow.length}`
      : "- Horizontal overflow found: 0",
    "",
    "## Text Overflow Candidates",
    "",
    textIssues.length
      ? textIssues.flatMap((item) => [
          `### ${item.view} · ${item.width}px · ${item.count} candidates`,
          "",
          ...item.samples.map((sample) => `- ${sample.tag}.${sample.className || "-"}: ${sample.text || "(empty)"}`),
          ""
        ]).join("\n")
      : "- No text overflow candidates detected.",
    "",
    "## Artifacts",
    "",
    "- Screenshots: `output/ui-audit/visual-regression/w*/`",
    "- Raw main audit: `output/ui-audit/visual-regression/audit.json`",
    "- Raw state audit: `output/ui-audit/visual-regression/states.json`",
    ""
  ];

  fs.writeFileSync(path.join(auditRoot, "report.md"), lines.join("\n"));
}

test.beforeAll(() => {
  ensureCleanAuditRoot();
});

test("captures all main CRM screens across responsive widths", async ({ page }) => {
  const report = [];

  for (const width of widths) {
    await page.setViewportSize({ width, height: width < 768 ? 852 : 1000 });
    await waitForApp(page);

    if (width < 1024) {
      await expect(page.locator("[data-mobile-menu]")).toBeVisible();
      await openMobileNavigation(page);
      await expect(page.locator("#primary-sidebar")).toBeVisible();
      await screenshot(page, width, "mobile-drawer");
      await page.keyboard.press("Escape");
      await expect(page.locator("[data-sidebar-overlay]")).toBeHidden();
    } else {
      await expect(page.locator("[data-mobile-menu]")).toBeHidden();
      await expect(page.locator("#primary-sidebar")).toBeVisible();
    }

    for (const view of views) {
      await openView(page, view, width);
      const section = page.locator(`#${view}`);
      const textLength = await section.evaluate((node) => node.textContent.trim().length);
      expect(textLength, `${width}px ${view} should render content`).toBeGreaterThan(20);

      const overflow = await hardOverflow(page);
      const candidates = await textOverflowCandidates(page, view);
      report.push({ width, view, ...overflow, textOverflowCandidates: candidates });

      expect(overflow.documentOverflow, `${width}px ${view} document overflow`).toBeLessThanOrEqual(2);
      expect(overflow.bodyOverflow, `${width}px ${view} body overflow`).toBeLessThanOrEqual(2);
      await screenshot(page, width, view);
    }
  }

  await writeJson("audit.json", report);
});

test("captures shared dialogs, dropdowns and action menus", async ({ page }) => {
  const width = 1440;
  const report = [];
  await page.setViewportSize({ width, height: 1000 });
  await waitForApp(page);

  for (const state of dropdownStates) {
    await openView(page, state.view, width);
    const control = page.locator(state.selector).first();
    if ((await control.count()) === 0 || !(await control.isVisible())) continue;
    await control.click({ timeout: 3_000 });
    await page.waitForTimeout(80);
    const overflow = await hardOverflow(page);
    report.push({ type: "dropdown", name: state.name, view: state.view, ...overflow });
    expect(overflow.documentOverflow, `${state.name} document overflow`).toBeLessThanOrEqual(2);
    expect(overflow.bodyOverflow, `${state.name} body overflow`).toBeLessThanOrEqual(2);
    await screenshot(page, width, state.name);
    await page.keyboard.press("Escape");
  }

  for (const state of menuStates) {
    await openView(page, state.view, width);
    const trigger = page.locator(state.selector).first();
    if ((await trigger.count()) === 0 || !(await trigger.isVisible())) continue;
    await trigger.click();
    await expect(page.locator(".row-action-menu:not([hidden])")).toBeVisible();
    const overflow = await hardOverflow(page);
    report.push({ type: "action-menu", name: state.name, view: state.view, ...overflow });
    expect(overflow.documentOverflow, `${state.name} document overflow`).toBeLessThanOrEqual(2);
    expect(overflow.bodyOverflow, `${state.name} body overflow`).toBeLessThanOrEqual(2);
    await screenshot(page, width, state.name);
    await page.mouse.click(20, 20);
    await expect(page.locator(".row-action-menu:not([hidden])")).toHaveCount(0);
  }

  for (const dialogState of primaryDialogs) {
    await openView(page, dialogState.view, width);
    const trigger = page.locator(dialogState.trigger).first();
    if ((await trigger.count()) === 0 || !(await trigger.isVisible())) continue;
    await trigger.click();
    await expect(page.locator(dialogState.dialog)).toHaveJSProperty("open", true);
    const overflow = await hardOverflow(page);
    report.push({ type: "dialog", name: dialogState.name, view: dialogState.view, ...overflow });
    expect(overflow.documentOverflow, `${dialogState.name} document overflow`).toBeLessThanOrEqual(2);
    expect(overflow.bodyOverflow, `${dialogState.name} body overflow`).toBeLessThanOrEqual(2);
    await screenshot(page, width, dialogState.name);
    await page.keyboard.press("Escape");
  }

  await writeJson("states.json", report);
  const audit = JSON.parse(fs.readFileSync(path.join(auditRoot, "audit.json"), "utf8"));
  writeMarkdownReport(audit, report);
});
