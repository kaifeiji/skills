# Analysis Report Rules

Return Markdown only. Use the selected output language consistently across the whole report.

## Inputs

Use the artifacts available for the executed run. When the run summary filename is needed, use `summary.json`.

## Debug Evidence Budget

Keep the debug narrative short. Use at most one short debug excerpt per finding, and only when it proves a material product fact the screenshot cannot prove by itself, such as:

- the selected data source or field;
- a concrete action error;
- a renderer field/record configuration that conflicts with the visible result;
- a 403, timeout, 429, or missing-field limitation.

Routine lifecycle lines such as `Status: completed`, `Completed.`, `Thinking`, `Working`, `Renderer emitted`, generic query-step labels, and repeated prompt/system metadata belong outside the findings. When the screenshot already proves the issue, rely on the screenshot.

## Causal Confidence

Separate what the user can see from why it happened:

- **Observed:** directly visible in the screenshot or final user-facing response.
- **Supported cause:** an internal state, selected source/field, or concrete error that agrees with the observed result.
- **Hypothesis:** a plausible explanation without confirming evidence; label it as uncertain.
- **Unknown:** the artifacts do not establish a cause; state the evidence gap instead of assigning blame.

Use `verification.visibleChecks` and `verification.failureSignals` as a lightweight review contract when present. They guide classification and remain non-automated. A runner completion signal supplements, and a visible check remains the primary signal. Add `Key Debug` for a supported cause or a concrete error; label hypotheses as uncertain.

## Report Structure

Return `Test Scope`, followed by one case section per executed case.

Each case section uses the case title as an `##` heading. Put its turns directly beneath that heading as `### Turn N: <short title>`.

`Test Scope` starts with four concise bullets:

- `App Title`: the title recorded for the tested app.
- `App URL`: the canonical tested URL.
- `Result Summary`: case and turn totals plus a short status breakdown.
- `Scope`: tested pages, workflows, and evidence boundaries.

Every turn contains, in this order, using only the selected-language labels:

1. the embedded, clickable screenshot and visible-state observation;
2. `Status`, using the required icon;
3. `User Prompt`;
4. `Answer Summary`, based on visible pixels, with the debug Final assistant message as support;
5. `Duration`;
6. the judgment and user impact;
7. one `Key Debug` when the status is non-success and the line proves the cause.

## Turn Generation Protocol Reference

The Turn Generation Protocol defined in the prompt-generation rules is the single source of truth for turn composition. Use it as the expected shape for every auto-generated case.

Expected turn types, in priority order:

1. **Page Overview / Capability / How-to (required)**  
   One turn about the current page's purpose, visible features, available widgets, or how to perform a task on this page.

2. **Query (when the page has a usable data source)**  
   Find records by place, condition, time, status, or user-provided value.

3. **Filter / Rank (when the page has a usable data source)**  
   Narrow, sort, or rank records by an evidenced field or condition.

4. **Statistics (when the page has a usable data source)**  
   Count, sum, average, min, max, or another supported aggregate.

5. **Functional Widget Action (when the page has reachable actionable widgets)**  
   One action turn per selected functional widget, up to 5 action turns.

Custom questions are an explicit exception. When custom questions are supplied, the supplied questions and their order define the expected turns.

## Turn Classification

Classify each turn against its intended type:

- Page Overview / Capability / How-to
- Query
- Filter / Rank
- Statistics
- Functional Widget Action
- Custom Question (when custom questions are supplied)

When a turn does not fit its intended type, report the mismatch as a finding when it affects the user-visible result or the case's ability to test the intended behavior.

## Protocol Consistency

Check whether the generated case follows the Turn Generation Protocol:

- Is the required page overview turn present?
- Are query, filter/rank, and statistics turns present when the page supports them?
- Are query, filter/rank, and statistics turns distinct in user goal and query dimension?
- Were any task types added only to satisfy a count, rather than because the page supports them?
- Is the widget action turn limited to reachable functional widgets and at most 5?
- Does the turn set reflect the page capabilities identified by the protocol?
- Are custom questions used exactly as supplied, without added or rewritten turns?

Report protocol mismatches as findings when they affect the user-visible result or the case's ability to test the intended behavior.

## Status Rules

- `✅ Success`: the requested user goal is substantially visible; keep the evaluation brief. A verified zero-match result counts as a complete query result.
- `⚠️ Partial Success`: some answer/result is visible but a field, renderer, action, page state, or context is incomplete; analyze the gap.
- `❌ Failure`: the user goal was not completed without a concrete system exception; explain the broken chain.
- `🚨 Error`: a concrete action error, data-source error, 403, 429, timeout, or other exception blocked the result; explain the error chain.

A missing-data or unsupported-capability turn counts as success when:

- the case expects transparent missing-data handling; and
- supplemental evidence confirms that the intended app data source returned no matching records or lacks the requested field or capability.

When the intended source was not queried, the wrong source was used, or the query failed, classify the observable gap or error instead.

## Writing Style

Write for scanning. Keep `Answer Summary` and `Judgment` to one short sentence each. Lead with the visible result and user impact; omit repeated goal, routine lifecycle detail, and background explanation. Add `Key Debug` when it establishes the cause of a non-success status.

Keep performance analysis inside the relevant turn when latency affects that turn's user-visible experience. Keep the report focused on per-case and per-turn findings.

## Review Perspective

Use a human tester perspective. Look for:

- Did the assistant understand what a normal user meant?
- Did it choose app data/actions over generic web/geocoding when app data existed?
- Did it use the current page, map, table, visible layer, selection, extent, or open widget correctly?
- Did it mutate the app when the user wanted mutation?
- Did it act in the right order, especially for widgets inside controllers or hidden panels?
- Did it provide natural, honest, non-internal wording?
- Did it overclaim success after partial or failed work?
- Did it return plausible but wrong statistics?
- Did it select the right renderer and avoid empty or redundant renderers?
- Was it slow, and if so which phase appears expensive?

## Breakdown Model

Classify failures by stage:

- `Understand`: misread user intent or visual reference
- `Find`: chose wrong data source, widget, field, page, view, or action
- `Plan`: wrong sequence, missing dependency, overconfident plan, unnecessary step
- `Act`: action/query/tool failed, acted on wrong target, hidden widget not ready
- `Present`: misleading final answer, internal text, wrong renderer, bad wording
- `Continue`: stale context, bad follow-up, failed correction handling
- `Performance`: avoidable latency, expensive irrelevant context, slow LLM call
- `Observability`: artifacts insufficient to diagnose

## Output Format

The English example below is shown in English. For a Chinese report, replace every heading and field label with its exact Chinese counterpart and keep the whole report in Chinese.

### English Example

```markdown
# Run Analysis: <suite or app name>

## Test Scope

- **App Title:** ...
- **App URL:** ...
- **Result Summary:** 1 case; 5 turns: 3 ✅ Success, 1 ⚠️ Partial Success, 1 ❌ Failure.
- **Scope:** Starting page/state, workflows, and evidence boundaries.

## <Case title>

### Turn N: <short title>

[![Turn N screenshot](./<case-id>/turn-NN.png)](./<case-id>/turn-NN.png)

- **Status:** ✅ Success | ⚠️ Partial Success | ❌ Failure | 🚨 Error
- **User Prompt:** ...
- **Answer Summary:** ...
- **Duration:** ...
- **Judgment:** ...
- **Key Debug:** ... (for a non-success status when causally useful)