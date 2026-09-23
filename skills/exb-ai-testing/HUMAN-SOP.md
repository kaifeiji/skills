# AI Testing Workflow SOP

## Goal

Use a real app as an AI Chat testing target, generate a prompt suite from app context, run a visible Playwright validation, analyze the evidence, and publish a report.

This workflow is self-contained in this skill bundle. It runs against the target app and writes evidence to the chosen output root. Resolve `<skill-root>` as the parent of the absolute `SKILL.md` path supplied in the active skill listing; all scripts are invoked from `<skill-root>/tooling/`.

The workspace is not a harness source. If the skill listing lacks an absolute path, stop and report an invalid installation. Never search the workspace, home directory, or drive for the scripts; they are not target-app files and must not be copied into the target app.

## Input

Confirm the following in plain language:

- App URL
- Output language: explicitly choose English (`en`) or Chinese (`zh`)
- Whether to show the browser window (default: visible)
- Viewport choice: `desktop` (`1920x1080`), `pad` (`1024x1366`), or `mobile` (`390x844`)
- Turns per auto-generated case: a positive number, recommended default `5`
- Result output location (default: `artifacts`)
- Test focus (optional)

Optional: the user may provide a test focus or concern area. Apply that lens during prompt generation and analysis; otherwise use the default prompt-generation rules and coverage template.

Use the host's interactive question UI to ask for language, question source, viewport, and turns per auto-generated case together before running the session probe. Label the question-source choices `Auto-generate test questions` / `I will provide test questions`, or `自动生成测试问题` / `我提供测试问题` in Chinese. Keep the workflow pending until the user submits the choices. When no interactive UI is available, ask the same choices in chat and wait for the reply. If user-provided questions are selected, set `suite.questionSource` to `custom`, collect them in a follow-up question, and use their exact count and order instead of generating or padding turns. Otherwise, set `suite.questionSource` to `auto` and write the selected count to `suite.turnsPerCase`.

## User-facing progress

Report only the active phase using the fixed short forms in `SKILL.md`: session check, context collection, case preparation, test execution, or analysis. Use a second sentence only for a required user action. Report paths only when an artifact is ready.

## App slug naming

Read the app title from the loaded page and convert it to a lowercase kebab-case slug, such as:

- explore-san-diego
- central-province
- nycity-map
- wildfire-intel

Use lowercase letters and hyphens in the slug; omit spaces, underscores, and other punctuation.

The slug is generated from the page title and the default config filename always uses a sequence suffix: `<app-slug>-01.json`, then `<app-slug>-02.json`, and so on. The resolved slug is stored in config. The default artifact folder uses the date, config filename stem, and its own run sequence: config `<app-slug>-03.json` produces `<YYYYMMDD>-<app-slug>-03-01`, then `<YYYYMMDD>-<app-slug>-03-02` if needed.

## Environment preparation

Before running the workflow, make sure:

- Node.js LTS is installed
- npm is available
- the project dependencies are installed
- Playwright browser dependencies are installed

Check Node.js, `@playwright/test`, and Chromium before opening the app. Do not use the VS Code browser; the bundled Node scripts must open the app through Playwright Chromium.

If `@playwright/test` is missing, ask the user for approval before running `npm install -D @playwright/test`, because it modifies the target project's `package.json`. If Chromium is missing, ask before running `npx playwright install chromium`. Do not copy this skill's `templates/` or `tooling/` directories into the target app.

Typical setup:

```bash
npm install
npx playwright install chromium
```

If the app requires a visible browser session, make sure the machine has a working display or browser UI support.

## Step 1: Verify Node Playwright, then open the dedicated session

Before running, confirm the App URL and the user's explicit language and viewport choices. Show the browser window and save results under `artifacts` unless the user changes those defaults.

Use the visible Node Playwright browser by default. Do not open a VS Code browser tab for app inspection.

Probe the shared browser profile before collecting context or running cases:

```bash
node "<skill-root>/tooling/probe-session.mjs" https://<app-url>
```

The browser-profile directory is storage, not proof of authentication. The probe validates `window._sessionManager.getMainSession()` against the supplied app URL. A valid session proceeds immediately. If the session is absent or `isMainSessionExpired()` reports expiration, the probe opens the app site's root URL in headed Playwright Chromium. Complete sign-in within two minutes; the probe reads `_sessionManager` every three seconds without reloading the page and continues automatically when authentication succeeds. Context collection and the runner validate the session again; if either reports `signed-out` or `expired`, run the probe again before continuing.

Then:

- Confirm the URL is reachable.
- Confirm the app loads in a real browser.
- Confirm the chat panel is visible when required.
- Refresh auth/session if it is expired or invalid.

If the app is not reachable or the session cannot be established, stop.

Before asking for case or turn planning, ask whether the user has custom questions:

- **Yes:** collect the ordered questions, select the target visible page, and create exactly one case whose turns are those questions.
- **No:** let the Agent generate cases and turns from the accessible visible pages in `appContext.pages`.

Do not combine custom questions with automatically generated page cases unless the user explicitly requests that.

The remaining values—slug, run name, auth handling, config generation, report generation—should follow the default rules instead of being re-asked.

## Step 2: Agent collects context and prepares config from the shared session

Open the app in Chromium, read `document.title`, generate a unique slug, then create `config/<app-slug>-01.json` or the next available numbered config. The script collects context only; the Agent authors and reviews the prompt suite afterward.

The bundled preparation command accepts the app URL and derives the slug automatically:

```bash
node "<skill-root>/tooling/prepare-app-context.mjs" \
	https://<app-url>
```

Use the resolved slug consistently in the config filename and final artifact folder name. The helper writes `config/<base-slug>-01.json`, then `config/<base-slug>-02.json`, and so on without replacing an existing config.

The file should contain:

- app URL
- startup settings
- app-specific context notes
- referenced configured data sources with loaded layers and field schemas
- an empty `suite.cases` array for reviewed multi-turn prompt cases

Keep the configuration focused on the app target and test suite. Authentication remains in the shared browser profile, not in config.
Its `language` field records the selected output language and defaults to `en`.

Do not inspect the bundled `tooling/*.mjs` files while generating cases or analyzing product behavior. Use the generated config, the reference rules, and the artifacts; inspect tooling only for an explicit harness diagnosis or implementation change.

This is the Agent-to-script handoff. Before starting the runner, confirm that every case has an id, intent, turns, expected behavior, and watch-for list.

## Step 3: Run the scripted Chromium evaluation

Use the bundled runner as the main evaluation path. It launches Chromium directly and drives configured turns with Playwright. There is no VS Code tab or model-operated browser step in this workflow.

```bash
node "<skill-root>/tooling/run-cases.mjs" \
	--config config/<app-slug>-NN.json \
	--mode headed
```

Add `--case <case-id>` for a focused run.

The runner performs one full load for the first case, then reuses the same browser page. Later cases call ExB's URL manager to switch pages through browser history without reloading. The Assistant thread is intentionally preserved across cases, so the suite order is one continuous conversation. It opens Ask AI with the stable `assistant-anchor` class before language-dependent fallbacks. After runtime completion, selected AI renderers must mount, clear their loading indicators, and remain stable for one second before evidence is captured. Startup failures and renderer timeouts are recorded under that case and the runner continues with the next case.

The runner reuses the shared browser cache at `.cache/browser-profile` in the repository root by default, but validates the current session through `window._sessionManager` rather than trusting the profile directory. Run `probe-session.mjs` again whenever the runner reports `signed-out` or `expired`. Use `--cache-dir <dir>` to select another profile.

This should create artifacts under:

```text
artifacts/<YYYYMMDD>-<app-slug>-<config-sequence>-<run-sequence>/
```

Example:

```text
artifacts/20260923-<app-slug>-03-01/
```

Validate that screenshots, result files, and debug evidence are present.

## Step 4: Agent reviews runtime debug evidence

The runner extracts the AssistantRuntime debug transcript from each case while it runs. Review the generated files instead of manually driving another browser session.

The runtime transcript is the internal debug source for turn completion and failure analysis. Context collection uses static `window._am().appConfig`; it intentionally does not persist `_dataSourceManager` runtime objects.

The runtime transcript should be captured from `window._assistantRuntime.debugTranscript`, and each case should keep:

- `case-debug.md`
- `case-debug.json`
- screenshots for each turn
- `result.json`
- any runtime signal showing `completed` / `failed` state

Review the readable per-turn transcript in `case-debug.md`; use `case-debug.json` when the summarized evidence is insufficient and the captured AssistantRuntime business-state snapshots or `rendererWait` evidence need inspection. It intentionally excludes runtime dependencies, compiled graphs, promises, functions, and portal objects. Runtime and renderer completion share a 120-second turn watchdog; `runtime-unavailable` means the page exposed the runtime object but no usable state. Treat any externally interrupted run as an evidence gap, not a successful turn.

If `window._assistantRuntime` is unavailable after a case has actually run, record that fact in that case's debug evidence. Create `case-debug.md` after the case has executed.

## Step 5: Agent analyzes the evidence

After the run has produced real artifacts, write `analysis.md` under `artifacts/<run-name>/`. Keep it focused on turn-by-turn evidence, findings, and impact.

Load [analysis-report-rules.md](./references/analysis-report-rules.md) before writing. The analysis should be written in the selected language and explain:

- user goal
- starting app state
- expected behavior
- observed behavior
- failure stage
- evidence used
- user-visible impact

Write one concise block for every turn using the exact headings, status rules, and evidence order in `analysis-report-rules.md`. Judge the visible prompt and response first; use `case-debug.md` and the matching screenshot only when they establish a material cause.

## Completion condition

The workflow is complete only when:

- app session is valid
- config and prompt suite are prepared together
- run evidence exists
- `artifacts/<run-name>/analysis.md` is populated, readable, and complete
