# AI Testing Workflow SOP

## Goal

Use a real app as an AI Chat testing target, generate a prompt suite from app context, run a visible Playwright validation, analyze the evidence, and publish a report.

This workflow is self-contained in this skill bundle. It runs against the target app and writes evidence to the chosen output root.

## Input

Confirm the following in plain language:

- App 地址
- 是否显示浏览器窗口（默认显示）
- 结果保存位置（默认 `artifacts`）
- 测试重点（可选）

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

Typical setup:

```bash
npm install
npx playwright install chromium
```

If the app requires a visible browser session, make sure the machine has a working display or browser UI support.

## Step 1: Open the dedicated Playwright session

Before running, confirm the App 地址. If the user does not specify otherwise, show the browser window and save results under `artifacts`.

Keep `headed` and `headless` as internal runner settings; the user-facing choice is whether the browser window is visible.

For an authenticated app, capture the shared state with the bundled helper:

```bash
node tooling/capture-session.mjs https://<app-url> config/.auth/local-exb.json
```

Complete sign-in in the Playwright Chromium window opened by this command. The browser stays open during sign-in; type `READY` in the terminal only after the app is fully loaded. The helper verifies the Ask AI/chat UI before replacing the session file, so an invalid state is not saved.

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

Use the slug consistently in the config filename and in the final run folder name.

The file should contain:

- app URL
- startup settings
- app-specific context notes
- realistic multi-turn prompt cases

Keep the configuration focused on the app target and test suite. Its `storageState` field points to the shared Playwright session file; credentials remain in that state file.

This is the Agent-to-script handoff. Before starting the runner, confirm that every case has an id, intent, turns, expected behavior, and watch-for list.

## Step 3: Run the scripted Chromium evaluation

Use the bundled runner as the main evaluation path. It launches Chromium directly and drives configured turns with Playwright. There is no VS Code tab or model-operated browser step in this workflow.

```bash
node tooling/run-cases.mjs \
	--config config/<app>.json \
	--mode headed \
	--output artifacts/<run-name>
```

Use `--mode headless` for a quick smoke check or regression shortcut; use the visible mode for primary evidence. Add `--case <case-id>` for a focused run.

The runner owns all DOM locator candidates. It opens Ask AI with the stable `assistant-anchor` class before language-dependent fallbacks. Config contains app, case data, and the shared `storageState` path, while locator candidates stay in the runner. Each case starts in a fresh page with the same state. Startup failures are recorded under that case and the runner continues with the next case.

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

Review the per-turn runtime evidence in `case-debug.md`. A `timeout` means a transcript was present without a recognized terminal status; `runtime-unavailable` means the page exposed the runtime object but no transcript. These states are recorded as evidence gaps, not successful turns.

If `window._assistantRuntime` is unavailable after a case has actually run, record that fact in that case's debug evidence. Create `case-debug.md` after the case has executed.

## Step 5: Agent analyzes the evidence

After the run has produced real artifacts, use them to write `analysis.md`; this file is created during evidence analysis.

When building the final report, use the bundled Node tooling:

```bash
node tooling/build-report.mjs artifacts/<run-name>
```

The analysis should explain:

- user goal
- starting app state
- expected behavior
- observed behavior
- failure stage
- evidence used
- user-visible impact

## Step 6: Agent builds and opens the report

```bash
node tooling/build-report.mjs artifacts/<run-name>
```

If a local HTML viewer or launcher is available, open the generated report directory afterward.

The report should highlight the summary, high-impact findings, evidence, and recommended next actions.

## Completion condition

The workflow is complete only when:

- app session is valid
- config and prompt suite are prepared together
- run evidence exists
- analysis.md is populated
- report is built successfully
