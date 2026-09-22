---
name: exb-ai-testing
description: "App-aware AI Chat testing workflow for Experience Builder apps: validate session and app state, generate a prompt suite, run scripted Chromium Playwright cases, capture AssistantRuntime debug evidence, analyze artifacts, and package the final report."
---

# EXB AI Testing

Use this skill to evaluate a real Experience Builder app's AI Chat quality in a repeatable, evidence-driven way.

## HITL input

Ask the user in plain language:

- **App 地址**：必填
- **是否显示浏览器窗口**：可选，默认显示
- **结果保存位置**：可选，默认 `artifacts`
- **测试重点**：可选，例如地图筛选、数据源选择或导航

Translate “显示浏览器窗口” to the internal runner mode; use the visible browser by default and use background execution only for an explicit smoke check.

## Optional focus area

The user may also provide a test focus, for example:

- map usability
- data-source ambiguity
- route and navigation
- filters and selection logic
- chart and summary quality
- access or auth edge cases

If absent, apply the default prompt-generation rules from the template.

## Default rules

- read the app title in Chromium and generate a stable kebab-case app slug from it
- keep the authenticated storage state in `config/.auth/` and reference it from config
- generate config and prompt suite together by default
- generate run name as `YYYYMMDD-app-slug-seq`
- generate `analysis.md` and report in the standard run folder
- show the browser window for the main evidence run
- use background execution for smoke checks

## App slug rules

- derive the slug automatically from the loaded app's `document.title`
- lowercase only
- kebab-case only
- no spaces, underscores, or punctuation
- keep it stable across runs for the same app

## Environment prerequisites

- Node.js LTS
- npm
- Playwright installed in the target project when using browser/session tooling
- Chromium installed

Typical setup:

```bash
npm install
npm install -D @playwright/test
npx playwright install chromium
```

Bundled references and helpers:

- [HUMAN-SOP.md](./HUMAN-SOP.md)
- [README.md](./README.md)
- [config-template.json](./templates/config-template.json)
- [prompt-generator-template.md](./templates/prompt-generator-template.md)
- [prepare-config-and-prompts.mjs](./tooling/prepare-config-and-prompts.mjs)
- [capture-session.mjs](./tooling/capture-session.mjs)
- [run-cases.mjs](./tooling/run-cases.mjs)
- [build-report.mjs](./tooling/build-report.mjs)

## Workflow

1. Script opens a dedicated Playwright Chromium session and captures auth state when needed
2. Agent uses that session state to inspect the app and prepare reviewed prompt cases
3. Agent hands the config, including `storageState`, to the script runner
4. Script runner executes Chromium cases and writes evidence
5. Agent reviews evidence and writes `analysis.md`
6. Agent builds the final HTML report

## Agent and script handoff

The workflow has explicit ownership boundaries:

- **Session phase**: `capture-session.mjs` opens the dedicated Playwright Chromium window and writes a reusable storage state.
- **Agent phase**: talk to the user, inspect app context through that session state, derive the slug, create realistic cases, confirm case intent, and choose the output directory.
- **Script phase**: receive a reviewed config with `storageState`, launch Chromium with that state, execute `suite.cases[].turns[]` in order, isolate cases in separate pages, and write screenshots, `result.json`, `case-debug.md`, and `summary.json`.
- **Agent phase after execution**: read the artifacts, classify findings, write `analysis.md`, and invoke the report builder.

The script runner executes cases; it does not generate prompts or decide what the app should be tested for. A config with no cases is an incomplete Agent-to-script handoff.

The session source is the Playwright Chromium window opened by the skill. Prompt inspection and case execution reuse its saved state; a VS Code browser tab is not part of this handoff.

## Runtime debug capture contract

The runner uses the app's `assistantRuntime` debug transcript as internal execution evidence.

Required runtime evidence:

- `window._assistantRuntime.debugTranscript`
- per-turn statuses such as `pending`, `running`, `completed`, and `failed`
- turn metadata such as `messageId`, `startedAt`, `endedAt`, and debug entries
- visible evidence from screenshots and app state

The workflow must:

1. poll the runtime until each turn reaches `completed` or `failed`
2. collect the debug transcript for every turn
3. write the transcript to `case-debug.md`
4. keep screenshots and `result.json` alongside the runtime transcript
5. use the transcript as supporting evidence; screenshots remain primary evidence for user-visible claims

If no runtime entries are available after a real case was executed, include that absence in the case's actual debug record. Create `case-debug.md`, `analysis.md`, and the report only at their respective execution and analysis stages.

## Scripted case runner contract

Run configured cases through the bundled runner:

```bash
node tooling/run-cases.mjs \
	--config config/<app-slug>.json \
	--mode headed \
	--output artifacts/<run-name>
```

The runner must:

- launch Playwright's `chromium` directly as the browser control surface
- execute `suite.cases[].turns[]` in order and continue to the next case after a case failure
- use the built-in locator candidates; locator ownership stays inside the runner
- accept `--case <case-id>` for a focused run and `--storage-state <path>` for an authenticated session
- write `summary.json` at the run root
- after a case starts, write its `result.json`, `case-debug.md`, and turn screenshots; startup failures receive a case-level error artifact

If built-in locators cannot find the chat UI, preserve the failure artifacts and report the harness limitation. Browser interaction stays with the runner and config remains focused on app and case data.

## Output contract

- `config/<app-slug>.json`
- `artifacts/<run-name>/`
- `artifacts/<run-name>/summary.json`
- `artifacts/<run-name>/<case-id>/result.json`
- `artifacts/<run-name>/<case-id>/case-debug.md`
- `analysis.md` after evidence analysis
- report under `report/index.html` after analysis is complete

## Report expectations

The final report should surface:

- summary
- key findings by case
- evidence screenshots and excerpts
- failure stage: Understand / Find / Plan / Act / Present / Continue
- impact and recommended next actions

## Completion condition

The workflow is complete when:

- URL is reachable
- app/session is valid
- prompt suite is generated
- run evidence is present
- `case-debug.md` exists for each executed case
- `analysis.md` is populated after the run
- HTML report is built successfully after analysis
