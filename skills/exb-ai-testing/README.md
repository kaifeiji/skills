# EXB AI Testing Skill

This is the distributable skill bundle for EXB AI Chat testing.

## Install

Install into the current project:

```bash
npx skills add https://github.com/kaifeiji --skill exb-ai-testing
```

Install globally:

```bash
npx skills add https://github.com/kaifeiji --skill exb-ai-testing --global
```

## Included assets

- SKILL.md
- HUMAN-SOP.md
- templates/
- examples/ (`config-example.json`, `analysis-example.md`, and `case-debug-example.md`)
- tooling/

## Usage

Use the skill with the App URL. Before execution it asks the user to choose English or Chinese and a viewport. It shows the browser window by default and saves results under `artifacts`. A test focus and alternate save location are optional. Browser execution mode remains internal.

The first step is to check Node.js, `@playwright/test`, and Playwright Chromium. Do not open the app in the VS Code browser. If `@playwright/test` or Chromium is missing, ask the user before installing it. The app must be opened by the bundled Node Playwright scripts.

Each case artifact includes a readable `case-debug.md` summary and a `case-debug.json` AssistantRuntime business-state snapshot for deeper investigation. The JSON intentionally omits compiled graphs, dependencies, functions, promises, and portal objects.

App context collection uses configured `appConfig` data sources and visible page/widget references; it does not read runtime data source manager objects.

## Workflow

See [SKILL.md](./SKILL.md) for agent execution rules and [HUMAN-SOP.md](./HUMAN-SOP.md) for the detailed operator workflow. The final readable output is `analysis.md` in the run artifact directory.
