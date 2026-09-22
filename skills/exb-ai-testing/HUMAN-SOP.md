# AI Testing Workflow SOP

## Goal

Use a real app as an AI Chat testing target, generate a prompt suite from app context, run a visible Playwright validation, analyze the evidence, and publish a report.

This workflow is self-contained in this skill; it does not depend on an external project or repository.

## Input

Only these three inputs must be confirmed up front:

- app URL
- execution mode: headed or headless
- output root for artifacts and reports

Optional: the user may also provide a test focus or concern area. If they do, prioritize that lens during prompt generation and analysis. If they do not, use the default prompt-generation rules and coverage template.

## App slug naming

Use a lowercase kebab-case slug such as:

- explore-san-diego
- central-province
- nycity-map
- wildfire-intel

Do not use spaces, uppercase letters, underscores, or special characters.

The slug must match the config filename, run folder name, and artifact naming.

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

## Step 1: Confirm the front-door decision and check app availability

Before running, confirm only these three things:

- app URL
- headed or headless mode
- output root

Then:

- Confirm the URL is reachable.
- Confirm the app loads in a real browser.
- Confirm the chat panel is visible when required.
- Refresh auth/session if it is expired or invalid.

If the app is not reachable or the session cannot be established, stop.

The remaining values—slug, run name, auth handling, config generation, report generation—should follow the default rules instead of being re-asked.

## Step 2: Prepare config and prompt suite together

Create or update `config/<app-slug>.json` and generate the prompt suite in the same step.

Use the slug consistently in the config filename and in the final run folder name.

The file should contain:

- app URL
- startup settings
- app-specific context notes
- realistic multi-turn prompt cases

Keep the configuration focused on the app target and test suite only. Keep auth/session separate.

This is one combined step: config generation and prompt generation happen together.

## Step 3: Run the visible Playwright evaluation

Use the visible/headed Playwright mode as the main evaluation path.

```bash
TEST_CONFIG=config/<app>.json npm run test:e2e:visible
```

Use headless mode only as a quick smoke check or regression shortcut, not as the primary evidence source.

If you prefer the skill-local version, run the bundled scripts from `tooling/`.

This should create artifacts under:

```text
artifacts/playwright/<YYYYMMDD-app-slug>-<sequence>/
```

Example:

```text
artifacts/playwright/20260922-explore-san-diego-01/
```

Validate that screenshots, result files, and debug evidence are present.

## Step 4: Capture runtime debug evidence

Before analysis, extract the AssistantRuntime debug transcript from each case.

This is required because the original ai-testing workflow treats the runtime transcript as the internal debug source for turn completion and failure analysis.

The runtime transcript should be captured from `window._assistantRuntime.debugTranscript`, and each case should keep:

- `case-debug.md`
- screenshots for each turn
- `result.json`
- any runtime signal showing `completed` / `failed` state

If `window._assistantRuntime` is unavailable, record that fact in `case-debug.md` and continue with the visible screenshot evidence.

## Step 5: Analyze the evidence

Use the run artifacts to write `analysis.md`.

When building the final report, prefer the skill-local Node tooling; validation is included in the same step:

```bash
node tooling/build-report.mjs artifacts/playwright/<run-name>
```

The analysis should explain:

- user goal
- starting app state
- expected behavior
- observed behavior
- failure stage
- evidence used
- user-visible impact

## Step 6: Build and open the report

```bash
node tooling/build-report.mjs artifacts/playwright/<run-name>
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
