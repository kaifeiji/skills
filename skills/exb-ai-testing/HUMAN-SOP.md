# AI Testing Workflow SOP

## Goal

Use a real app as an AI Chat testing target, generate a prompt suite from app context, run a visible Playwright validation, analyze the evidence, and publish a report.

This workflow is self-contained in this skill bundle. It runs against the target app and writes evidence to the chosen output root.

## Input

Confirm the following in plain language:

- App URL
- Preferred language (default: English; supported values: English and Chinese)
- Whether to show the browser window (default: visible)
- Result output location (default: `artifacts`)
- Test focus (optional)

Optional: the user may provide a test focus or concern area. Apply that lens during prompt generation and analysis; otherwise use the default prompt-generation rules and coverage template.

## App slug naming

Read the app title from the loaded page and convert it to a lowercase kebab-case slug, such as:

- explore-san-diego
- central-province
- nycity-map
- wildfire-intel

Use lowercase letters and hyphens in the slug; omit spaces, underscores, and other punctuation.

The slug is generated from the page title and matches the config filename, run folder name, and artifact naming.

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

Before running, confirm the App URL and preferred language. If the user does not specify otherwise, use English, show the browser window, and save results under `artifacts`.

Use the visible Node Playwright browser by default. Do not open a VS Code browser tab for app inspection.

For an authenticated app, capture the shared state with the bundled helper:

```bash
node tooling/capture-session.mjs https://<app-url> config/.auth/local-exb.json
```

Complete sign-in in the Playwright Chromium window opened by this command. The browser stays open during sign-in; type `READY` in the terminal only after the app is fully loaded. The helper saves the authenticated browser state through a temporary file, so a failed capture does not replace the saved state.

When `config/.auth/local-exb.json` already exists, the helper loads it into the new Chromium context first and refreshes that same state file after successful verification.

The helper waits for network idle before presenting the READY prompt and again after sign-in. AI Chat and blocking modal checks happen only in `run-cases.mjs` immediately before turn execution.

Then:

- Confirm the URL is reachable.
- Confirm the app loads in a real browser.
- Confirm the chat panel is visible when required.
- Refresh auth/session if it is expired or invalid.

If the app is not reachable or the session cannot be established, stop.

The remaining values—slug, run name, auth handling, config generation, report generation—should follow the default rules instead of being re-asked.

## Step 2: Agent prepares config and prompt suite from the shared session

Open the app in Chromium, read `document.title`, generate the slug, then create or update `config/<app-slug>.json` and generate the prompt suite in the same step.

The bundled preparation command accepts the app URL and derives the slug automatically:

```bash
node tooling/prepare-config-and-prompts.mjs \
	https://<app-url> config/<app-slug>.json \
	--storage-state config/.auth/local-exb.json
```

With the default `config/.auth/local-exb.json` location, the explicit `--storage-state` argument can be omitted.

Use the slug consistently in the config filename and in the final run folder name.

The file should contain:

- app URL
- startup settings
- app-specific context notes
- realistic multi-turn prompt cases

Keep the configuration focused on the app target and test suite. Its `storageState` field points to the shared Playwright session file; credentials remain in that state file.
Its `language` field records the selected output language and defaults to `en`.

This is the Agent-to-script handoff. Before starting the runner, confirm that every case has an id, intent, turns, expected behavior, and watch-for list.

## Step 3: Run the scripted Chromium evaluation

Use the bundled runner as the main evaluation path. It launches Chromium directly and drives configured turns with Playwright. There is no VS Code tab or model-operated browser step in this workflow.

```bash
node tooling/run-cases.mjs \
	--config config/<app>.json \
	--output artifacts/<run-name>
```

Add `--case <case-id>` for a focused run.

The runner waits for network idle before each case, then checks the UI. It opens Ask AI with the stable `assistant-anchor` class before language-dependent fallbacks. Config contains app, case data, and the shared `storageState` path, while locator candidates stay in the runner. Each case starts in a fresh page with the same state. Startup failures are recorded under that case and the runner continues with the next case.

This should create artifacts under:

```text
artifacts/<YYYYMMDD-app-slug>-<sequence>/
```

Example:

```text
artifacts/20260922-explore-san-diego-01/
```

Validate that screenshots, result files, and debug evidence are present.

## Step 4: Agent reviews runtime debug evidence

The runner extracts the AssistantRuntime debug transcript from each case while it runs. Review the generated files instead of manually driving another browser session.

The runtime transcript is the internal debug source for turn completion and failure analysis.

The runtime transcript should be captured from `window._assistantRuntime.debugTranscript`, and each case should keep:

- `case-debug.md`
- screenshots for each turn
- `result.json`
- any runtime signal showing `completed` / `failed` state

Review the detailed per-turn transcript in `case-debug.md`, including message metadata and each debug entry's section, title, timestamp, and content. A `timeout` means a transcript was present without a recognized terminal status; `runtime-unavailable` means the page exposed the runtime object but no transcript. These states are recorded as evidence gaps, not successful turns.

If `window._assistantRuntime` is unavailable after a case has actually run, record that fact in that case's debug evidence. Create `case-debug.md` after the case has executed.

## Step 5: Agent analyzes the evidence

After the run has produced real artifacts, write `analysis.md` under `artifacts/<run-name>/`. Keep it focused on turn-by-turn evidence, findings, and impact.

The analysis should be written in the selected language and explain:

- user goal
- starting app state
- expected behavior
- observed behavior
- failure stage
- evidence used
- user-visible impact

Write one block for every turn. English blocks use `User Prompt`, `Agent Response`, `Status`, and `Conclusion`; Chinese blocks use `用户提问`, `Agent 回答`, `状态`, and `结论`. Include the measured turn duration in the status line. Judge the prompt and response first. A successful conclusion is one short sentence. For failures, use `case-debug.md` and the matching turn screenshot only as supporting evidence when the conversation does not establish the cause.

## Completion condition

The workflow is complete only when:

- app session is valid
- config and prompt suite are prepared together
- run evidence exists
- `artifacts/<run-name>/analysis.md` is populated, readable, and complete
