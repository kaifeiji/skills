# Skills

Personal agent skill catalog. Each installable skill lives under `skills/<skill-name>/` and can be installed with the public `skills` CLI.

## Install

Install one skill into the current project:

```bash
npx skills add https://github.com/kaifeiji/skills --skill exb-ai-testing
```

Install globally for the detected agent profile:

```bash
npx skills add https://github.com/kaifeiji/skills --skill exb-ai-testing --global
```

For non-interactive installs, add `--yes`. To copy files instead of creating symlinks, add `--copy`.

## Local skill development

Install this repository as a global skill once for continued local development. The default installation mode is a symlink, so later changes in this directory are immediately visible to the agent without pulling from the remote repository again:

```bash
npx skills add ./ --skill exb-ai-testing --global --yes
```

If you previously used `--copy`, switch back to a symlink first:

```bash
npx skills remove exb-ai-testing --global --yes
npx skills add ./ --skill exb-ai-testing --global --yes
```

Development loop:

1. Modify `skills/exb-ai-testing/SKILL.md`, the templates, or `tooling/`.
2. Start a new agent/chat session so it reloads the skill.
3. Run the skill with a real app URL and inspect the generated case artifacts and debug files.
4. Run `npx skills list --global --json` to confirm the installation source. Do not run `skills update`, because it replaces the local development version with the remote version.

For structural checks only, run the following from the repository root:

```bash
npx skills add ./ --skill exb-ai-testing --list
node --check skills/exb-ai-testing/tooling/run-cases.mjs
```

## Available Skills

- `exb-ai-testing`: App-aware AI Chat testing workflow for Experience Builder apps.

## Repository Layout

```text
skills/
└── exb-ai-testing/
    ├── SKILL.md
    ├── HUMAN-SOP.md
    ├── README.md
    ├── examples/
    ├── templates/
    └── tooling/
```

## Verify

From this repository root:

```bash
npx skills add ./ --skill exb-ai-testing --list
```
