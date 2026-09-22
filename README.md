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
