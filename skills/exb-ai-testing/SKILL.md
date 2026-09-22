---
name: exb-ai-testing
description: "App-aware AI Chat testing workflow for Experience Builder apps: validate session and app state, generate a prompt suite, run visible Playwright checks, capture AssistantRuntime debug evidence, analyze artifacts, and package the final report."
---

# EXB AI Testing

Use this skill to evaluate a real Experience Builder app's AI Chat quality in a repeatable, evidence-driven way.

## Required HITL input

Before execution, the user only needs to provide:

- app URL
- execution mode: `headed` or `headless`
- output root for artifacts and reports

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

- auto-generate a stable kebab-case app slug
- keep auth/session separate from config and report output
- generate config and prompt suite together by default
- generate run name as `YYYYMMDD-app-slug-seq`
- generate `analysis.md` and report in the standard run folder
- use headed mode as the main evidence path
- use headless mode only as a smoke check

## App slug rules

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
- [build-report.mjs](./tooling/build-report.mjs)

## Workflow

1. Validate URL and app availability
2. Validate session/auth readiness
3. Prepare config and prompt suite together
4. Run visible Playwright evaluation
5. Capture `window._assistantRuntime.debugTranscript` and `case-debug.md`
6. Analyze evidence and write `analysis.md`
7. Build the final HTML report

## Runtime debug capture contract

This skill explicitly covers the original `assistantRuntime` debug extraction pattern.

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

If no runtime entries are available, write a placeholder `case-debug.md` explaining the absence of runtime debug instead of silently omitting the file.

## Output contract

- `config/<app-slug>.json`
- `artifacts/playwright/<run-name>/`
- `analysis.md`
- report under `report/index.html`

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
- `case-debug.md` exists for each case
- `analysis.md` is populated
- HTML report is built successfully
