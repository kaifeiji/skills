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

把当前仓库作为全局 skill 安装一次即可持续调试。默认安装方式是 symlink，后续修改本目录会直接进入 agent 看到的 skill，不需要反复从远端拉取：

```bash
npx skills add ./ --skill exb-ai-testing --global --yes
```

如果之前使用过 `--copy`，先切回 symlink：

```bash
npx skills remove exb-ai-testing --global --yes
npx skills add ./ --skill exb-ai-testing --global --yes
```

开发循环：

1. 修改 `skills/exb-ai-testing/SKILL.md`、模板或 `tooling/`。
2. 新开一次 agent/chat 会话，让它重新加载 skill。
3. 用实际 app URL 执行 skill，检查生成的 case artifacts 和 debug 文件。
4. 需要确认安装来源时运行 `npx skills list --global --json`；不要运行 `skills update`，它会把本地调试版本换成远端版本。

只做结构检查时，可以在仓库根目录运行：

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
