# AI Testing Workflow SOP

## Goal

Use a real app as an AI Chat testing target, generate an evidence-based case suite from visible app context, run a Playwright validation, review the evidence, and publish a concise analysis report.

This document is the workflow skeleton. The detailed rules live in the skill and the reference files; this SOP keeps the human-facing structure and approval points.

## 1. Confirm the test setup

Before the session probe, confirm the following with the user:

- app URL
- output language: English (`en`) or Chinese (`zh`)
- viewport: desktop, pad, or mobile
- whether the browser window is visible
- test focus or concern area, if any

Use the interactive question UI or chat fallback to collect these values together. Keep the workflow pending until the user submits them.

When custom questions are provided, treat them as the exact case input and do not pad or rewrite them. When auto-generation is selected, let the Turn Generation Protocol determine the turns from page capabilities.

## 2. Prepare the environment

Check that the required runtime dependencies are available before opening the app:

- Node.js / npm
- Playwright test dependency
- Chromium/browser support

Ask for approval before installing or changing project dependencies. Use the bundled skill scripts and do not copy the harness files into the target app.

## 3. Validate the app session

Run the session probe to confirm that the shared browser profile is valid and that the real app is accessible.

If sign-in or session refresh is required, complete it in the browser before continuing. Do not mark the task as complete or blocked while the user is still resolving authentication.

## 4. Collect app context

Gather the visible app context and the reachable page/widget state needed for case generation:

- page title and page-level purpose
- visible widgets and actions
- connected data sources and fields
- app state that user can actually access
- dialogs, tabs, or alternate views that are visible and relevant

The output should be a config with the app context and an empty `suite.cases` list before case generation begins.

The config filename is mandatory: `config/<app-slug>-NN.json`, with `NN` starting at `01` and incrementing. The runner creates the default artifact folder as `artifacts/<YYYYMMDD>-<app-slug>-NN-MM/`; `MM` increments for repeated runs of the same config. Do not create or extend an artifact path manually. Invalid custom output names are rejected.

## 5. Author the case suite

Generate one case per relevant accessible page for auto-mode, and only use the supplied questions in order for custom-question mode.

Apply the Turn Generation Protocol as the authoritative generation rule:

1. Page Overview / Capability / How-to
2. Query, when supported
3. Filter / Rank, when supported
4. Statistics, when supported
5. Functional Widget Action, when supported and reachable

Do not invent unsupported actions, data sources, or fields. When a turn type is not supported, omit it and record the limitation in `expectedBehavior` or `watchFor`.

## 6. Review before execution

Before running the cases, review the generated suite for:

- page relevance and reachability
- schema-grounded field references
- realistic, user-facing prompts
- turn protocol compliance in auto mode
- expected behavior and failure signals
- output JSON validity

Do not start execution until the case plan has been approved.

## 7. Run the validation

Execute the reviewed cases in one continuous conversation flow, keeping the app state and prior context intact across the run.

Invoke the runner with the reviewed config file:

```bash
node "<skill-root>/tooling/run-cases.mjs" --config "config/<app-slug>-NN.json"
```

Let the runner create the artifact directory. For a caller-selected location, pass one correctly formatted directory with `--output`; never nest it under a previous artifact directory.

During execution, check for:

- app/session availability
- assistant runtime readiness
- prompt delivery and result capture
- renderer or action output visibility
- failures or incomplete user-visible state

If a consequential dialog or permission gate appears, pause and ask the user to resolve it before continuing.

## 8. Analyze the evidence

Review the run artifacts in the proper order:

- per-case evidence and screenshots
- run summary and debug material
- visible app state vs. assistant output

Judge the result based on user-visible behavior, not runner completion alone. Distinguish observed facts from inference and only add debug evidence when it materially explains the product result.

## 9. Publish the outcome

Write the final analysis report in the selected language and keep it grounded in the visible evidence.

The report should state:

- what the app and page were
- what the user asked
- what the assistant did and what the user could observe
- whether the outcome was success, partial, failure, or error
- the likely cause only when supported by evidence

## Guardrails

- Do not add steps, pages, or actions that are not visible in the app.
- Do not treat config entries or agent names as proof of capability.
- Do not rely on fixed turn counts when the Turn Generation Protocol applies.
- Do not mix custom-question mode with auto-generated page cases unless the user explicitly requests it.
- Keep the workflow focused on real user-visible behavior and evidence.

## Relevant references

- `SKILL.md` for the execution contract and checkpoints
- `references/prompt-generation-rules.md` for turn composition and validation rules
- `references/analysis-report-rules.md` for evidence review and report structure