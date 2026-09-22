# EXB AI Testing Skill

This is the distributable skill bundle for EXB AI Chat testing.

## Install

Install into the current project:

```bash
npx skills add <repository-url> --skill exb-ai-testing
```

Install globally:

```bash
npx skills add <repository-url> --skill exb-ai-testing --global
```

## Included assets

- SKILL.md
- HUMAN-SOP.md
- templates/
- examples/
- tooling/

## Usage

Use the skill with the App 地址. By default it shows the browser window and saves results under `artifacts`. A test focus and alternate save location are optional. `headed` and `headless` remain internal runner settings.

## Default behavior

- generate app slug from the loaded app title
- auto-generate run name
- generate config + prompt suite together
- reuse one Playwright storage state across session capture, prompt inspection, and case execution
- visible browser mode is primary
- background browser mode is smoke-only
- cases run through the bundled Chromium Playwright runner
- selector candidates are fixed inside the runner for consistent app coverage
- capture `AssistantRuntime` debug evidence
- produce `analysis.md` and final report

## Scripted execution

After preparing a config and prompt suite, run cases with the skill-local runner:

```bash
node tooling/run-cases.mjs \
	--config config/<app-slug>.json \
	--mode headed \
	--output artifacts/<run-name>
```

The Agent prepares and reviews the cases first. The runner then uses Playwright `chromium` directly, executes all turns in order, and writes `summary.json` plus per-case `result.json`, `case-debug.md`, and screenshots. Each case gets a fresh page; startup errors are recorded in that case's artifacts. Use `--case <case-id>` for a focused run. The config carries the required shared `storageState`; an explicit `--storage-state <path>` can override it. Config stores app, case, and session-state references; locator candidates are owned by the runner. The Agent creates `analysis.md` and the report after the run artifacts exist.

Config preparation accepts the app URL, shared session state, and derives the slug from the page title:

```bash
node tooling/prepare-config-and-prompts.mjs \
	https://<app-url> config/<app-slug>.json \
	--storage-state config/.auth/local-exb.json
```

Capture the shared state in the dedicated Playwright Chromium window and pass it into preparation:

```bash
node tooling/capture-session.mjs https://<app-url> config/.auth/local-exb.json
node tooling/prepare-config-and-prompts.mjs \
	https://<app-url> config/<app-slug>.json \
	--storage-state config/.auth/local-exb.json
```

The generated config carries the same `storageState` to the runner. Prompt inspection and case execution therefore share one session source. Ask AI is located by the stable `assistant-anchor` class before language-dependent attributes.
