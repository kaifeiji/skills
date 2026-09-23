# Skills

Personal agent skill catalog. Each installable skill lives under `skills/<skill-name>/` and can be installed with the public `skills` CLI.

## Install

Install one skill into the current project:

```bash
npx skills add https://github.com/kaifeiji/skills --skill <skill-name>
```

Install globally for the detected agent profile:

```bash
npx skills add https://github.com/kaifeiji/skills --skill <skill-name> --global
```

## Local skill development

Install this repository as a global skill for continued local development:

```bash
npx skills add ./ --skill <skill-name> --global --yes
```

Development loop:

1. Modify `skills/<skill-name>/SKILL.md`, the templates, or `tooling/`.
2. Run `npx skills add ./ --skill <skill-name> --global --yes` again.
3. Start a new agent/chat session so it reloads the skill.
4. Run the skill with a real app URL and inspect the generated case artifacts and debug files.

## Available Skills

- `exb-ai-testing`: App-aware AI Chat testing workflow for Experience Builder apps.
