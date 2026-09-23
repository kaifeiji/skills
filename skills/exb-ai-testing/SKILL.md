---
name: exb-ai-testing
description: "Use when the user wants to evaluate an Experience Builder app's AI Chat with a real URL, authenticated browser session, multi-turn cases, Playwright evidence, and an analysis report."
---

## Use This Skill When

Use it when the user provides a real Experience Builder app URL and asks to test AI Chat quality, app-aware answers, map/data interactions, navigation, or multi-turn behavior.

Do not use it for unit tests, synthetic prompt benchmarking without a real app, or browser work unrelated to AI Chat. Browser control belongs to the bundled Node Playwright scripts; do not use a VS Code browser tab or another agent browser.

## Script Location

The skill bundle root is the parent directory of the absolute `SKILL.md` path supplied in the active skill listing. Resolve `<skill-root>` from that in-context path without filesystem discovery, then invoke the scripts directly, for example `node "<skill-root>/tooling/probe-session.mjs" <app-url>`. Workspace contents are irrelevant to harness availability. If the active skill listing has no absolute path, stop and report an invalid skill installation. Never search the workspace, home directory, or drive for `*.mjs`, `tooling`, or these script names, and do not copy the scripts into the target app.

## Human Checkpoints

Before running any script, use the current host's available interactive question mechanism to present these three choices in one request:

1. **Output language:** English (`en`) or Chinese (`zh`).
2. **Questions:** use `Auto-generate test questions` / `I will provide test questions` in English, or `自动生成测试问题` / `我提供测试问题` in Chinese. Use these labels verbatim.
3. **Viewport:** desktop (`1920x1080`), pad (`1024x1366`), or mobile (`390x844`).

Wait for the submitted answers as an active HITL checkpoint. End the current turn with the questions pending; do not mark the task blocked or complete, and do not replace the question UI with a status message. If the host has no interactive question tool, ask the same three choices directly in chat and wait for the next user response. If user-provided questions are selected, collect them in a follow-up question and place them in one reviewed case; do not generate additional page cases. Otherwise, generate reviewed cases and turns from visible, accessible pages. Defaults that need no question are: mode `headed`, output root `artifacts`, balanced prompt coverage, and `5` turns per case.

Pause for confirmation before changing dependencies or installing Chromium, after cases are prepared and before execution, and whenever a dialog requires consent, authorization, data access, or another consequential action. Show the user the URL, language, mode, output directory, focus, case IDs, and turn count before the run. Do not automatically accept consequential dialogs. The user may type credentials in the Playwright window; never request or record them in chat or artifacts.

## Progress Updates

Use one terse update for the active phase only. Follow these templates in the selected language; do not add rationale, future steps, or another phase to the same update.

- **Session:** `Checking app session.` If needed: `Complete sign-in in the browser within 2 minutes.`
- **Context:** `Collecting app context.` Completion: `Context saved: <path>`
- **Prompts:** `Preparing test cases.` Completion: `<count> cases ready: <ids>. Approve the run?`
- **Testing:** `Running test <current>/<total>: <case-id>`
- **Analysis:** `Analyzing test results.` Completion: `Analysis saved: <path>. <brief outcome>`

Progress updates are informational and add no approval stops beyond the Human Checkpoints.

## Ownership Boundaries

- **Agent**: collect inputs, invoke prerequisite checks through the bundled scripts, run the session probe, inspect context, derive the slug, author and review cases, run the runner, inspect artifacts, and write `analysis.md`.
- **User**: approve dependency changes, complete authentication, handle consequential dialogs, and approve the case plan.
- **`<skill-root>/tooling/probe-session.mjs`**: quickly check the shared browser profile; open ArcGIS sign-in when needed and persist the completed session in that profile.
- **`<skill-root>/tooling/prepare-app-context.mjs`**: collect app context and accessible pages, derive a unique slug, and write a config with an empty `suite.cases` array. It does not generate or review prompts.
- **`<skill-root>/tooling/run-cases.mjs`**: validate session and Chat UI, run reviewed cases as one continuous conversation across ExB pages, and write evidence. It does not invent cases or decide expected behavior.

### Agent Input Boundary

During the normal workflow, do not read or use `tooling/*.mjs` implementation code as test context. The agent input is the app URL, generated `config/<app-slug>.json`, the reference rules, and run artifacts. Tooling scripts are executed as black-box workflow components. Read a tooling script only when the user explicitly asks to diagnose or modify the test harness itself.

## Prerequisites

The bundled scripts perform the Node.js, Playwright resolution, and Chromium checks at execution time. The agent must not scan `package.json` or dependency manifests as app/test context. If a dependency is missing, report the exact install command and ask permission before installing. Do not silently modify the target project or copy this skill's directories into it.

Typical setup, only after approval where required:

```bash
npm install
npm install -D @playwright/test
npx playwright install chromium
```

## Workflow

### 1. Probe the shared session

```bash
node "<skill-root>/tooling/probe-session.mjs" <app-url>
```

The browser-profile directory only stores browser state; its existence does not prove that authentication is valid. When a profile exists, the probe opens the real app URL headlessly and uses `window._sessionManager.getMainSession()` to validate it. Because `getMainSession()` filters expired sessions, a valid result returns without showing a browser. For a missing, signed-out, or expired session, the probe derives and opens the site root URL in headed Chromium for sign-in. It reads `_sessionManager` from that page every three seconds without reloading it, continues automatically when a valid session appears, and fails after two minutes. If context collection or execution later reports `signed-out` or `expired`, run the probe again before continuing.

### 2. Collect context

```bash
node "<skill-root>/tooling/prepare-app-context.mjs" \
	<app-url> \
	--language <en|zh>
```

The script reads `document.title`, creates a stable lowercase kebab-case slug, and extracts page, view, mounted-widget, visible strings, and configured data-source context from `window._am().appConfig` through the shared profile at the selected viewport. It does not read runtime data sources from `_dataSourceManager`; appContext dataSources are configuration facts, filtered to IDs referenced by visible entities. It writes `config/<app-slug>.json`; when that slug already exists, it uses `-02`, `-03`, and so on. If the app context is empty, rerun the probe and stop rather than fabricating cases.

### 3. Author and review cases

Use [prompt-generator-template.md](./templates/prompt-generator-template.md) as the required JSON/config contract. Before authoring, load [prompt-generation-rules.md](./references/prompt-generation-rules.md) for risk selection and case-quality checks; load [prompt-scenario-guide.md](./references/prompt-scenario-guide.md) only when choosing a concrete app-grounded scenario or `watchFor` signal. If custom questions were supplied, create exactly one case using them as its ordered turns. Otherwise, create one case for each relevant accessible page, not for tabs, views, or URL variants. Omit inaccessible, empty, permission-restricted, and AI-irrelevant pages.

Each case requires unique `id`, `title`, `pageId`, `pageTitle`, canonical `pageUrl`, one-sentence `intent`, exactly the approved positive number of turns, `expectedBehavior`, a non-empty `watchFor`, and useful `tags`. Use the visible page title for `title` by default; use a concise business goal when that better distinguishes the conversation. Derive `id` from that human-readable name as lowercase ASCII kebab-case. Never use internal IDs such as `page_4`, `widget_12`, or `view_3` as case names. Preserve the real internal page ID only in `pageId`. During case authoring, write the target URL directly into `pageUrl` using the config root URL and matched page title; the runner navigates to this exact case URL. Do not duplicate widget context in a case. At least 80% of turns must target evidenced app data or capabilities; use at most one missing-data or unsupported-capability turn across the suite unless the user requests boundary-focused coverage. Cover challenge behavior primarily through current map state, data-source ambiguity, correction/follow-up, presentation or renderer behavior, continuation across turns, and capability choice. Bias toward the user's focus. Prompts must be natural, grounded in visible capabilities and real data sources, and written in the selected language.

Before execution, validate required fields, turn count, accessible page references, and at least one case. Write reviewed cases to `config/<app-slug>.json`, show the review summary, and wait for approval.

### 4. Execute

```bash
node "<skill-root>/tooling/run-cases.mjs" \
	--config config/<app-slug>.json \
	--mode headed
```

Use `--mode headless` only when selected, and `--case <case-id>` for a focused rerun. Without `--output`, the runner writes `artifacts/YYYYMMDD-<config-slug>-NN` and chooses the next free `NN`; the config slug therefore remains part of the run name. It reuses one browser page and the shared browser cache at `config/.cache/browser-profile`. The first case loads its `pageUrl`; later cases call `window._urlManager.changePage(pageId)` so ExB performs a history-based SPA transition. Do not start a new chat or reset AssistantRuntime between cases: case order is one continuous conversation, and later cases inherit earlier messages. Each case validates `window._sessionManager.getMainSession()`, then performs startup-dialog, assistant-panel, and input-readiness checks. After runtime completion, a turn with an AI renderer remains active until its new renderer UI has mounted, all Jimu loading indicators inside it are gone, and its DOM is stable for one second. Renderer waiting shares the 120-second turn watchdog; timeout is a failed turn and is recorded in `case-debug.json`. For a consequential dialog, ask the user to handle it and rerun. For valid session plus unavailable Chat, report the harness/app limitation and stop.

### 5. Analyze evidence

Before writing the report, load [analysis-report-rules.md](./references/analysis-report-rules.md); it is the authoritative evidence order and report-format contract. Start with `summary.json`, each case's `result.json`, and `case-debug.md`. Always embed each turn's screenshot link in `analysis.md`; only inspect turn screenshots or `case-debug.json` when Markdown is missing, ambiguous, contradictory, or insufficient to establish a user-visible result or cause.

Interpret statuses as follows: `completed` means a terminal runtime signal was observed and any selected renderer finished its UI completion gate; `failed` means runner/runtime/renderer failure; `runtime-unavailable` means the runtime or transcript was unavailable after a real turn. The runner waits indefinitely for network idle before the first turn and uses one 120-second watchdog for runtime and renderer completion. Do not call a turn successful solely because the runner finished. Judge the visible response first and distinguish observed facts from inference.

Write `artifacts/<run-name>/analysis.md` in the selected language, using the exact headings, turn fields, evidence budget, and status rules in `analysis-report-rules.md`. Include measured duration, goal, expected behavior, observed behavior, failure stage, evidence, and user-visible impact. A successful turn gets one short conclusion sentence; failed or inconclusive turns state the likely cause and evidence gap.

## Artifact Contract

```text
config/<app-slug>.json
artifacts/<run-name>/
	run-config.json
	summary.json          # run index
	<case-id>/
		result.json       # turn index
		case-debug.md
		case-debug.json   # AssistantRuntime business-state snapshots
		turn-01.png
		turn-02.png
		...
	analysis.md
```

Startup or preflight failures may additionally produce `preflight-error.json`, `startup-error.png`, or a case `result.json` marked `handoffFailure`. Preserve and report them; do not write a success report over them. The authenticated state is sensitive local data and must not be pasted into chat or committed.

## Completion Checklist

- URL and shared browser session verified.
- Config contains language, URL, app context, and reviewed cases.
- Every executed case has required metadata and the approved turn count.
- `summary.json` accounts for all intended cases.
- Each case has `result.json`, `case-debug.md`, `case-debug.json`, and screenshots or an explicit startup failure artifact.
- Run-root `analysis.md` uses the selected language and required labels, covers every turn, and distinguishes evidence from inference.
- Timeouts, runtime gaps, harness limitations, inaccessible pages, and failures are visible in the report.

## References

- [HUMAN-SOP.md](./HUMAN-SOP.md): operator walkthrough
- [README.md](./README.md): installation and development loop
- [config-template.json](./templates/config-template.json): config shape
- [prompt-generator-template.md](./templates/prompt-generator-template.md): case rules
- [references/README.md](./references/README.md): phase-based reference index
- [probe-session.mjs](./tooling/probe-session.mjs): shared session probe
- [prepare-app-context.mjs](./tooling/prepare-app-context.mjs): context collection
- [run-cases.mjs](./tooling/run-cases.mjs): execution and evidence
- [viewport-utils.mjs](./tooling/viewport-utils.mjs): desktop/pad/mobile presets
