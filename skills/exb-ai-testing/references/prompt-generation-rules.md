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

The protocol defines suite-level coverage, not a fixed turn list for every page. A case represents one coherent business goal. Split distinct goals into separate cases even when they run on the same page.

For each accessible page, identify these goal groups when supported by evidence:

1. **Orientation**: understand the page, a visible capability, or how to begin a task.
2. **Data investigation**: find, compare, filter, rank, or summarize records using evidenced fields.
3. **Action or state change**: complete a meaningful map, widget, navigation, sharing, presentation, or workflow action.
4. **Recovery or ambiguity**: clarify an underspecified request, correct a prior request, or handle one evidenced unavailable-data or permission boundary.

Create one case per distinct goal group that has a meaningful user outcome. A page supporting both data investigation and a map/widget action normally produces two cases, not one five-turn case. An orientation-only page may produce one short case. Do not split a single simple task into artificial variants merely to increase case count.

Within a case, use the fewest turns that exercise its goal, usually 2-4. A one-turn case is valid for a complete, observable task; a case over four turns needs a concrete dependency between every adjacent turn. Use a realistic sequence such as request -> constraint -> follow-up, request -> visible result -> correction, or ambiguous request -> clarification -> completion. Do not begin every case with an overview question, and do not force Query, Filter / Rank, Statistics, and widget actions into one conversation.

Across the suite, cover the supported Query, Filter / Rank, Statistics, and functional widget-action capabilities. Put each capability in the case where it best fits the user's goal. Record unsupported data, widget, or action paths in `expectedBehavior` or `watchFor`.

## Business Task Coverage

Query, Filter / Rank, and Statistics are optional suite-level task types that appear only when the page's data source, fields, and widgets support them.

When the page has a loaded business data source, cover the available task types among:

- Query
- Filter / Rank
- Statistics

Use each task type with distinct wording and a distinct user goal. Distribute them across cases when they represent separate user outcomes. When the page supports only one task type, cover that one fully and record the limitation in `expectedBehavior` or `watchFor`.

Cover only task types the page genuinely supports. Do not add a task type to satisfy a count, and do not reuse the same task with different wording to appear as a second type.

Use field-definition or schema-explanation questions as supporting turns or when the user explicitly asks what a field means. Keep the case focused on real user tasks.

## Functional Widget Selection

A functional widget is a reachable widget that exposes at least one user-visible action, mutation, navigation, or presentation change.

Pure layout widgets, static display widgets, widgets with no reachable action path, and widgets present only in config but not reachable on the current page stay outside the action-turn set.

For each selected functional widget:

- create an action case when its action has a distinct user outcome;
- when the widget exposes multiple distinct high-value actions, choose the action that best matches a natural user goal;
- rank widgets by user value, then by reachability, then by action clarity;
- keep one case focused on one widget action or one tightly coupled workflow;
- when no functional widget is reachable, omit action cases.

## Custom Questions Exception

Custom questions are an explicit exception to the Turn Generation Protocol.

When custom questions are supplied:

- create exactly one case for the selected visible page;
- use the supplied questions in their supplied order;
- keep the supplied wording, order, and count;
- apply the Turn Generation Protocol when custom questions are absent;
- create cases for other pages when the user explicitly asks for that.

## Case Naming and Page Targeting

- Prefer a small suite of high-value, goal-focused conversations over one catch-all conversation or shallow one-turn checks.
- Name each case from its visible page title or business goal, and derive its distinct lowercase ASCII kebab-case `id` from that name.
- Keep the internal app page identifier in `pageId`.
- Cover a tab, view, or query variation of the same page inside that page's conversation.

When custom questions are absent, generate one or more cases for each relevant accessible page in `appContext.pages`, based on the distinct supported goal groups. Generate separate cases for views, tabs, or URL query variants when the user explicitly asks for that.

Before creating a case, verify that the page opens and has visible page content in the dedicated Playwright session.

Omit pages that are inaccessible, permission-restricted, empty, or unable to support a meaningful AI task.

Select the target with `pageId` and preserve the generated case's canonical `pageUrl` when it already exists. The generated value is authoritative because it uses the app's page-path format. When a URL must be created, derive it from the full config URL with the standard URL API: preserve the original origin, every query parameter in `search` (for example `?draft=true`), and the original hash; replace spaces in the visible page title with hyphens before URL encoding the pathname segment. For example, `User Guide` maps to `/page/User-Guide?draft=true`, not `/page/User%20Guide?draft=true`.

## Conversation Mix

The ordered suite is one realistic conversation that continues across page-targeted cases. Later cases may inherit earlier context.

At least 80% of generated turns exercise evidenced app data, fields, actions, or workflows. Across the whole suite, keep unsupported or missing-data turns to at most one unless the user explicitly requests boundary-focused coverage.

Mix direct asks, underspecified goals, visual references such as "this table" or "here", follow-ups, corrections, and source/state changes. Vary opening language across cases: begin with the user's task, decision, or problem rather than repeatedly asking what the page can do. Make the first turn after a page transition understandable with the inherited conversation context.

Generated turns speak as a user performing the real task now. Express fallback expectations as part of that direct request.

## Case Quality Gate

Before returning cases, confirm that each one:

- uses data, widgets, actions, pages, and capabilities evidenced by supplied context;
- uses field-level requests grounded in explicitly evidenced business attributes;
- resolves every field-level request to a loaded field name or alias in the matched root data source or layer schema;
- has a natural user goal rather than an implementation-level command;
- directly performs the user task;
- preserves every query parameter and hash from the config URL in `pageUrl`;
- preserves an existing generated `pageUrl` as the authoritative canonical page URL;
- represents spaces in a newly derived page path as hyphens before URL encoding (for example, `User Guide` becomes `/page/User-Guide`);
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