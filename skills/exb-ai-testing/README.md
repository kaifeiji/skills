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

Use the skill with the app URL, execution mode, and output root. Everything else follows the default rules. Bundled helper scripts are under `tooling/` after installation.

## Default behavior

- auto-generate app slug
- auto-generate run name
- generate config + prompt suite together
- headed mode is primary
- headless mode is smoke-only
- capture `AssistantRuntime` debug evidence
- produce `analysis.md` and final report
