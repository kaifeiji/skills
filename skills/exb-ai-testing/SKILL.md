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
2. **Questions:** use exactly two options in the selected output language. For English, use `Auto-generate test questions` and `I will provide test questions`; for Chinese, use `自动生成测试问题` and `我提供测试问题`. Keep the English and Chinese labels out of the same option list.
3. **Viewport:** desktop (`1920x1080`), pad (`1024x1366`), or mobile (`390x844`).

The Turn Generation Protocol determines the turns for auto-generated cases. Custom questions determine their own wording, order, and count.

Wait for the submitted answers as an active HITL checkpoint. End the current turn with the questions pending; do not mark the task blocked or complete, and do not replace the question UI with a status message. If the host has no interactive question tool, ask the same three choices directly in chat and wait for the next user response. If user-provided questions are selected, set `suite.questionSource` to `custom`, collect the questions in a follow-up question, and use their exact count and order; do not generate additional page cases or pad the case. Otherwise, set `suite.questionSource` to `auto` and generate turns according to the Turn Generation Protocol in `prompt-generation-rules.md`. Defaults that need no question are: mode `headed`, output root `artifacts`, and balanced prompt coverage.

Pause for confirmation before changing dependencies or installing Chromium, after cases are prepared and before execution, and whenever a dialog requires consent, authorization, data access, or another consequential action. Show the user the URL, language, mode, output directory, focus, case IDs, and turn count before the run. Do not automatically accept consequential dialogs. The user may type credentials in the Playwright window; never request or record them in chat or artifacts.

## Progress Updates

Use one terse update for the active phase only. Follow these templates in the selected language; do not add rationale, future steps, or another phase to the same update.

- **Session:** `Checking app session.` If needed: `Complete sign-in in the browser within 2 minutes.`
- **Context:** `Collecting app context.` Completion: `Context saved: <path>`
- **Prompts:** `Preparing test cases.` Completion: `<count> cases ready: <ids>. Approve the run?`
- **Testing:** `Running test <current>/<total>: <case-id>`
- **Analysis:** `Analyzing test results.` Completion: `Analysis saved: <path>. <brief outcome>`

Report only the current phase, user decisions, approvals, and concrete outcomes. Keep internal hypotheses, command troubleshooting, parameter guesses, and retry narration out of user-facing updates.

Progress updates are informational and add no approval stops beyond the Human Checkpoints.

## Ownership Boundaries

- **Agent**: collect inputs, invoke prerequisite checks through the bundled scripts, run the session probe, inspect context, derive the slug, author and review cases, run the runner, inspect artifacts, and write `analysis.md`.
- **User**: approve dependency changes, complete authentication, handle consequential dialogs, and approve the case plan.
- **`<skill-root>/tooling/probe-session.mjs`**: quickly check the shared browser profile; open ArcGIS sign-in when needed and persist the completed session in that profile.
- **`<skill-root>/tooling/prepare-app-context.mjs`**: collect app context and accessible pages, derive a unique slug, and write a config with an empty `suite.cases` array. It does not generate or review prompts.
- **`<skill-root>/tooling/run-cases.mjs`**: validate session and Chat UI, run reviewed cases as one continuous conversation across ExB pages, and write evidence. It does not invent cases or decide expected behavior.

### Runner Invocation Contract

Run the cases runner with the run artifact directory that contains `run-config.json`:

```bash
node "<skill-root>/tooling/run-cases.mjs" "<run-directory>"
```

`<run-directory>` contains `run-config.json` and the reviewed suite. When an argument-format error appears, pass this containing directory and retry once. Use the documented directory form directly.

### Agent Input Boundary

During the normal workflow, do not read or use `tooling/*.mjs` implementation code as test context. The agent input is the app URL, generated `config/<app-slug>-NN.json`, the reference rules, and run artifacts. Tooling scripts are executed as black-box workflow components. Read a tooling script only when the user explicitly asks to diagnose or modify the test harness itself.

## Prerequisites

The bundled scripts perform the Node.js, Playwright resolution, and Chromium checks at execution time. The agent must not scan `package.json` or dependency manifests as app/test context. If a dependency is missing, report the exact install command and ask permission before installing. Do not silently modify the target project or copy this skill's directories into it.

Typical setup, only after approval where required:

```bash
npm install
npm install -D @playwright/test
npx playwright install chromium
```

## Workflow

1. **Probe the shared session** and confirm the app is accessible with a valid browser session.
2. **Collect app context** from the visible page state, reachable widgets, data sources, and fields.
3. **Author and review cases** using the Turn Generation Protocol and the referenced generation rules, with custom questions treated as an explicit exception.
4. **Execute the reviewed cases** in a single continuous conversation flow and preserve app state across turns.
5. **Analyze the evidence** against user-visible behavior, then publish the final report with the required artifacts and status classification.

This is the high-level flow. The detailed generation and review rules remain in the reference files, and the approval gates remain in the human checkpoints.