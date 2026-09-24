# EXB AI Testing Skill

This is the distributable skill bundle for EXB AI Chat testing.

## Install

Install the published skill from GitHub into the current project:

```bash
npx skills add https://github.com/kaifeiji/skills.git --skill exb-ai-testing
```

Install the published skill globally:

```bash
npx skills add https://github.com/kaifeiji/skills.git --skill exb-ai-testing --global
```

For local skill development, run this from the repository root after editing the skill:

```bash
npx skills add . --skill exb-ai-testing --global --yes
```

The local command refreshes the installed skill; it does not install the target app's dependencies. The first test run performs the Node.js, `@playwright/test`, and Chromium checks described below.

## Included assets

- SKILL.md
- HUMAN-SOP.md
- templates/
- examples/ (`config-example.json`, `analysis-example.md`, and `case-debug-example.md`)
- tooling/

## Usage

Use the skill with the App URL. Before execution it asks the user to choose English or Chinese, a viewport, and whether to auto-generate questions or provide custom questions. Auto-generated turns follow page capabilities; custom questions retain their exact wording, count, and order. It shows the browser window by default and saves results under `artifacts`. A test focus and alternate save location are optional. Browser execution mode remains internal.

Config and artifact names are enforced:

```text
config/<app-slug>-NN.json
artifacts/<YYYYMMDD>-<app-slug>-NN-MM/
```

`NN` is the config sequence starting at `01`; `MM` is the run sequence for that config. Custom output names that do not match these patterns are rejected.

The first step is to check Node.js, `@playwright/test`, and Playwright Chromium. Do not open the app in the VS Code browser. If `@playwright/test` or Chromium is missing, ask the user before installing it. The app must be opened by the bundled Node Playwright scripts.

Each case artifact includes a readable `case-debug.md` summary and a `case-debug.json` AssistantRuntime business-state snapshot for deeper investigation. The JSON intentionally omits compiled graphs, dependencies, functions, promises, and portal objects.

App context collection creates configured data sources through ExB's runtime manager, waits for child layers, and stores plain layer and field metadata for referenced roots. Runtime objects are not serialized.

## Workflow

See [SKILL.md](./SKILL.md) for agent execution rules and [HUMAN-SOP.md](./HUMAN-SOP.md) for the detailed operator workflow. The final readable output is `analysis.md` in the run artifact directory.
