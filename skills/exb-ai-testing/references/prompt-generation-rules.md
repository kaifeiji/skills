# Prompt Generation Rules

Use this reference when authoring `suite.cases`. Return the complete config JSON with generated cases in `suite.cases`, as raw JSON.

Before claiming an AI Chat capability, verify that the published app visibly exposes it through a user path. A configured feature, registered tool, agent name, or config entry becomes testable only when a user can reach it.

## Context To Use

Ground cases in context actually available from the app or tester:

- app URL, title, purpose, domain, and user personas
- current page/view and visible state
- global header/footer controls, including widgets exposed through a controller
- dialog windows reachable through a visible user path
- accessible pages plus section views, tabs, controllers, and alternate map/view states when evidenced
- widgets mounted in an accessible page's layout, plus their connected maps, data sources, actions, and renderers
- view-scoped or controller-hosted widgets when the layout graph and visible runtime state show a reachable path
- capability declarations from ExB project source when that source is supplied

When evidence is incomplete, choose prompts that expose uncertainty and make the missing evidence visible.

## Risk Selection

For every relevant accessible page, choose the highest-value risks supported by its context. Across the suite, seek breadth where the app supports it:

- intent understanding and ambiguity
- data-source, field, and statistics choice
- current map, selection, extent, table, or visual-reference grounding
- page, view, tab, controller, or hidden-widget discovery
- multi-step planning and app action ordering
- visible widget/framework actions: map state, layers, basemap, popup, measure, search, nearby, navigation, panels, sharing, printing, and presentation changes
- app data versus generic web/geocoding behavior
- renderer and presentation choice
- follow-up memory, correction, recovery, and state synchronization
- one meaningful missing-data, unavailable-action, or permission boundary when concretely evidenced
- user-visible latency when a realistic task exposes it

Choose a category when the page context supports it.

## Turn Generation Protocol

The Turn Generation Protocol is the single source of truth for turn composition. Every auto-generated case follows it. When any other rule, hint, or example appears to conflict with it, the Turn Generation Protocol takes precedence.

The protocol defines a capability-based turn set. Build each case from the relevant accessible page, adding a turn only when the page evidence supports that capability. Keep unrelated page goals in separate cases.

For each auto-generated case, generate turns in this priority order:

1. **Page Overview / Capability / How-to (required)**  
   One turn about the current page's purpose, visible features, available widgets, or how to perform a task on this page. Ground it in the current page's visible title, layout, widgets, data sources, and reachable actions. Keep the scope to capabilities visible or reachable from the current page.

2. **Query (when the page has a usable data source)**  
   Find records by place, condition, time, status, or user-provided value.

3. **Filter / Rank (when the page has a usable data source)**  
   Narrow, sort, or rank records by an evidenced field or condition. Use a distinct user goal and a distinct query dimension from the Query turn.

4. **Statistics (when the page has a usable data source)**  
   Count, sum, average, min, max, or another supported aggregate. Use a distinct user goal and a distinct aggregation dimension from the Query and Filter / Rank turns.

5. **Functional Widget Action (when the page has reachable actionable widgets)**  
   Add one action turn for each selected functional widget, up to the supported maximum of 5 action turns.

Turn requirements:

- Start with the overview turn for every case.
- Add Query, Filter / Rank, and Statistics turns when the page has the corresponding data source, fields, and supported task.
- Add widget action turns for reachable functional widgets, using one distinct high-value action per selected widget.
- Keep each turn tied to a distinct user goal and let the resulting turn count reflect the page capabilities.
- Record unsupported data, widget, or action paths in `expectedBehavior` or `watchFor`.

Use the numbered sections as capability checks in priority order. An overview-only page produces one turn; data capabilities add their supported task turns; reachable widget actions add their selected action turns. The page evidence determines the final count.

## Business Task Coverage

Query, Filter / Rank, and Statistics are optional sub-tasks that appear only when the page's data source, fields, and widgets support them.

When the page has a loaded business data source, cover the available task types among:

- Query
- Filter / Rank
- Statistics

Use each task type with distinct wording and a distinct user goal. When the page supports only one task type, cover that one fully and record the limitation in `expectedBehavior` or `watchFor`.

Cover only task types the page genuinely supports. Do not add a task type to satisfy a count, and do not reuse the same task with different wording to appear as a second type.

Use field-definition or schema-explanation questions as supporting turns or when the user explicitly asks what a field means. Keep the case focused on real user tasks.

## Functional Widget Selection

A functional widget is a reachable widget that exposes at least one user-visible action, mutation, navigation, or presentation change.

Pure layout widgets, static display widgets, widgets with no reachable action path, and widgets present only in config but not reachable on the current page stay outside the action-turn set.

For each selected functional widget:

- generate one action turn by default;
- when the widget exposes multiple distinct high-value actions, choose the action that best matches a natural user goal;
- rank widgets by user value, then by reachability, then by action clarity;
- include up to 5 widget action turns per case;
- when no functional widget is reachable, keep the case focused on turns 1–4.

## Custom Questions Exception

Custom questions are an explicit exception to the Turn Generation Protocol.

When custom questions are supplied:

- create exactly one case for the selected visible page;
- use the supplied questions in their supplied order;
- keep the supplied wording, order, and count;
- apply the Turn Generation Protocol when custom questions are absent;
- create cases for other pages when the user explicitly asks for that.

## Case Naming and Page Targeting

- Prefer a smaller suite of high-value conversations over shallow one-turn checks.
- Name each case from its visible page title or business goal, and derive its distinct lowercase ASCII kebab-case `id` from that name.
- Keep the internal app page identifier in `pageId`.
- Cover a tab, view, or query variation of the same page inside that page's conversation.

When custom questions are absent, generate one case for each relevant accessible page in `appContext.pages`. Generate separate cases for views, tabs, or URL query variants when the user explicitly asks for that.

Before creating a case, verify that the page opens and has visible page content in the dedicated Playwright session.

Omit pages that are inaccessible, permission-restricted, empty, or unable to support a meaningful AI task.

Select the target with `pageId` and write its canonical `pageUrl` directly into the case. Derive it from the full config URL with the standard URL API: preserve the original origin, every query parameter in `search` (for example `?draft=true`), and the original hash; update only the pathname to the matched `/page/<encoded-title>` path.

## Conversation Mix

The ordered suite is one realistic conversation that continues across page-targeted cases. Later cases may inherit earlier context.

At least 80% of generated turns exercise evidenced app data, fields, actions, or workflows. Across the whole suite, keep unsupported or missing-data turns to at most one unless the user explicitly requests boundary-focused coverage.

Mix direct asks, underspecified goals, visual references such as "this table" or "here", follow-ups, corrections, and source/state changes. Make the first turn after a page transition understandable with the inherited conversation context.

Generated turns speak as a user performing the real task now. Express fallback expectations as part of that direct request.

## Case Quality Gate

Before returning cases, confirm that each one:

- uses data, widgets, actions, pages, and capabilities evidenced by supplied context;
- uses field-level requests grounded in explicitly evidenced business attributes;
- resolves every field-level request to a loaded field name or alias in the matched root data source or layer schema;
- has a natural user goal rather than an implementation-level command;
- directly performs the user task;
- preserves every query parameter and hash from the config URL in `pageUrl`;
- reveals a wrong interpretation, source, action, state transition, presentation, or recovery behavior;
- has `expectedBehavior` describing direction rather than exact response wording;
- has `watchFor` items that identify plausible observable failure symptoms;
- follows the Turn Generation Protocol when custom questions are absent.

Build balanced suites from evidenced capabilities, flexible expected behavior, ambiguity, correction, source selection, map state, and continuation. Use an explicit clarification path when source choice or user intent materially changes the result.

## Output Contract

Return valid JSON matching the app config structure, as raw JSON.

For every generated case, confirm:

- `pageId` matches a reachable visible page;
- `pageUrl` preserves the original origin, every query parameter in `search`, and the original hash; only the pathname is updated to the matched `/page/<encoded-title>` path;
- `title` is the visible page title or a concise business goal;
- `id` is lowercase ASCII kebab-case derived from `title`;
- turns follow the Turn Generation Protocol when custom questions are absent;
- field-level turns resolve to loaded field names or aliases in the matched root data source or layer schema;
- `expectedBehavior` describes direction rather than exact wording;
- `watchFor` identifies plausible observable failure symptoms;
- `verification.visibleChecks` and `verification.failureSignals` are present when a stable visible outcome can be checked.

Return raw JSON only.