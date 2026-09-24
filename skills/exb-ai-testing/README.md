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

## Included assets

- SKILL.md
- HUMAN-SOP.md
- templates/
- examples/
- tooling/
- references/

## Usage

The workflow is:

1. /exb-ai-testing {app URL}
2. Complete sign-in in the browser if required.
3. Review the generated or provided test questions.
4. Approve the test run.
5. Review the generated `analysis.md` report and test artifacts.

## Workflow

See [SKILL.md](./SKILL.md) for agent execution rules and [HUMAN-SOP.md](./HUMAN-SOP.md) for the detailed operator workflow. The final readable output is `analysis.md` in the run artifact directory.
