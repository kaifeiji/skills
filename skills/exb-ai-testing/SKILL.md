---
name: exb-ai-testing
description: "App-aware AI Chat testing workflow for Experience Builder apps: validate session and app state, generate a prompt suite, run scripted Chromium Playwright cases, capture AssistantRuntime debug evidence, and write readable analysis artifacts."
---

# EXB AI Testing

Use this skill to evaluate a real Experience Builder app's AI Chat quality in a repeatable, evidence-driven way.

## HITL input

Ask the user in plain language:

- **App URL**: required
- **Preferred language**: optional, default `English`; supported values are `English` and `Chinese`
- **Whether to show the browser window**: optional, default visible
- **Result output location**: optional, default `artifacts`
- **Test focus**: optional, such as map filtering, data-source selection, or navigation
- **Turn count**: optional, recommend 5 turns; the user may choose another count

Use only the bundled Node Playwright browser for app inspection and execution. Do not open the app in the VS Code browser or another agent browser as part of this workflow.
Use the selected language for generated prompts, user-facing analysis, and localized debug labels. Store it as `language` in the generated config and use `en` when the user does not choose a language.

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

- before any app navigation, verify Node.js, `@playwright/test`, and Chromium; if a dependency is missing, ask for permission before installing it

- read the app title in the dedicated Playwright Chromium session and generate a stable kebab-case app slug from it
- keep the authenticated storage state in `config/.auth/` and reference it from config
- generate config and prompt suite together by default
- recommend 5 turns per app and let the user specify the turn count
- default the generated config language to `en` (English)
- generate run name as `YYYYMMDD-app-slug-seq`
- generate `analysis.md` inside the standard run folder
- show the browser window for the main evidence run
- use background execution for smoke checks

## App slug rules

- derive the slug automatically from the loaded app's `document.title`
- lowercase only
- kebab-case only
- no spaces, underscores, or punctuation
- keep it stable across runs for the same app

## Environment Prerequisites

- Node.js LTS
- npm
- `@playwright/test` installed in the target project when using browser/session tooling
- Playwright Chromium installed

Typical setup:

```bash
npm install
npm install -D @playwright/test
npx playwright install chromium
```

Do not silently modify the target project's `package.json`. If `@playwright/test` is missing, tell the user that `npm install -D @playwright/test` adds a development dependency and ask for approval before running it. If Chromium is missing, ask for approval before running `npx playwright install chromium`. Do not copy this skill's `templates/` or `tooling/` directories into the target app.

Bundled references and helpers:

- [HUMAN-SOP.md](./HUMAN-SOP.md)
- [README.md](./README.md)
- [config-template.json](./templates/config-template.json)
- [prompt-generator-template.md](./templates/prompt-generator-template.md)
- [prepare-config-and-prompts.mjs](./tooling/prepare-config-and-prompts.mjs)
- [capture-session.mjs](./tooling/capture-session.mjs)
- [run-cases.mjs](./tooling/run-cases.mjs)

## Workflow

1. Agent verifies Node Playwright prerequisites and requests approval for any missing dependency
2. Node Playwright opens the app, captures/reuses session state, and handles login or blocking dialogs
3. Agent prepares cases for distinct relevant app pages; each case is one reviewed multi-turn flow
4. Agent writes evidence to the standard run folder
5. Agent reviews evidence and writes `analysis.md` inside the run folder
6. `analysis.md` is the final readable deliverable in the run folder

## Agent and script handoff

The workflow has explicit ownership boundaries:

- **Session phase**: `capture-session.mjs` opens the dedicated Playwright Chromium window and writes a reusable storage state.
- **Agent phase**: talk to the user, inspect app context through that session state, derive the slug, create one realistic multi-turn case for each relevant app page, confirm the turn count and intent, and choose the output directory.
- **Script phase**: receive a reviewed config with `storageState`, launch Chromium with that state, execute each `suite.cases[].turns[]` flow in a fresh page, and write per-turn screenshots, `result.json`, `case-debug.md`, and `summary.json`.
- **Agent phase after execution**: read the artifacts, classify findings, and write `analysis.md`.

The script runner executes configured cases; it does not generate prompts or decide what the app should be tested for. A config with no cases is an incomplete Agent-to-script handoff.

The session source is the Playwright Chromium window opened by the skill. Prompt inspection and case execution reuse its saved state; a VS Code browser tab is not part of this handoff.

Only `run-cases.mjs` handles blocking modals and verifies or opens AI Chat, immediately before executing configured turns. `capture-session.mjs` captures authentication only, and `prepare-config-and-prompts.mjs` reads app context only.

Session handoff is required before prompt preparation or case execution. The preparation script and runner both stop before browser work when no storage state is supplied.

Each browser phase waits for Playwright `networkidle` with a bounded timeout before checking the app UI. Apps with persistent connections continue through the UI readiness check when network idle is not reached.

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
4. keep screenshots, `result.json`, and `analysis.md` inside the run folder
5. use the transcript as supporting evidence; screenshots remain primary evidence for user-visible claims

Each `case-debug.md` renders the detailed AssistantRuntime transcript per turn, including `messageId`, status, start/end timestamps, section titles, timestamps, and entry content. It also includes the runtime snapshot before submission, the snapshot after waiting, detected runtime status, and final runtime keys. A final case-level snapshot alone is insufficient because a later timeout can hide earlier turn evidence. Distinguish `timeout` (transcript exists without a terminal status) from `runtime-unavailable` (the runtime object exists without a transcript).

If no runtime entries are available after a real case was executed, include that absence in the case's actual debug record. Create `case-debug.md` and `analysis.md` only after their respective execution and analysis stages.

## Scripted case runner contract

Run the configured app flow through the bundled runner:

```bash
node tooling/run-cases.mjs \
	--config config/<app-slug>.json \
	--output artifacts/<run-name>
```

The runner must:

- launch Playwright's `chromium` directly as the browser control surface
- execute every `suite.cases[].turns[]` flow in order, using a fresh page for each case
- use the built-in locator candidates; locator ownership stays inside the runner
- open Ask AI with `button.assistant-anchor[aria-haspopup="true"]` before language-dependent fallbacks
- accept `--storage-state <path>` for an authenticated session
- write `summary.json` at the run root
- after the app flow starts, write `result.json`, `case-debug.md`, and turn screenshots; startup failures receive a run-level error artifact

If built-in locators cannot find the chat UI, preserve the failure artifacts and report the harness limitation. Browser interaction stays with the runner and config remains focused on app and case data.

## Output contract

- `config/<app-slug>.json`
- `artifacts/<run-name>/`
- `artifacts/<run-name>/summary.json`
- `artifacts/<run-name>/result.json`
- `artifacts/<run-name>/case-debug.md`
- `artifacts/<run-name>/analysis.md` after evidence analysis

## Per-turn analysis format

Write one block for every turn. For English, use exactly: `User Prompt`, `Agent Response`, `Status`, and `Conclusion`. For Chinese, use exactly: `用户提问`, `Agent 回答`, `状态`, and `结论`. Include the measured turn duration in the status line.

Analyze the user prompt and agent response first. For a successful turn, write one short conclusion sentence. For a failed turn, state the likely cause from the conversation; use `case-debug.md` and the matching screenshot only when the conversation is inconclusive or needs supporting evidence.

## Completion condition

The workflow is complete when:

- URL is reachable
- app/session is valid
- prompt suite is generated
- run evidence is present
- `case-debug.md` exists for each executed case
- `artifacts/<run-name>/analysis.md` is populated after the run
- `analysis.md` is readable and complete inside that same run folder
