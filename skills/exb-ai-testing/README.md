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

Use the skill with the App URL. It shows the browser window by default, uses English by default, and saves results under `artifacts`. English and Chinese are supported. A test focus and alternate save location are optional. Browser execution mode remains internal.

The first step is to check Node.js, `@playwright/test`, and Playwright Chromium. Do not open the app in the VS Code browser. If `@playwright/test` or Chromium is missing, ask the user before installing it. The app must be opened by the bundled Node Playwright scripts.

## Workflow

See [SKILL.md](./SKILL.md) for agent execution rules and [HUMAN-SOP.md](./HUMAN-SOP.md) for the detailed operator workflow. The final readable output is `analysis.md` in the run artifact directory.
