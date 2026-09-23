# Prompt Generation Rules

Use this reference while authoring `suite.cases` after reading [prompt-generator-template.md](../templates/prompt-generator-template.md). The template defines the required config shape; this file helps choose high-value risks. Return only the config-compatible cases JSON required by the template, without markdown or commentary.

Before claiming an AI Chat capability, load [ai-chat-runtime-capabilities.md](./ai-chat-runtime-capabilities.md). Make positive expectations only for behavior the published app visibly exposes through a user path; a configured feature alone does not prove it is available to Chat.

## Context To Use

Ground cases in the context actually available from the app or tester:

- app URL, title, purpose, domain, and user personas
- current page/view and visible state
- global header/footer controls, including widgets exposed through a controller
- dialog windows only when a visible user path can open them
- accessible pages plus section views, tabs, controllers, and alternate map/view states when evidenced
- widgets mounted in an accessible page's layout, plus their connected maps, data sources, actions, and renderers
- view-scoped or controller-hosted widgets only when the layout graph and visible runtime state show a reachable path
- capability declarations from ExB project source only when that source is supplied

When evidence is incomplete, choose prompts that expose uncertainty instead of assuming unavailable data or capabilities.

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

Use [prompt-scenario-guide.md](./prompt-scenario-guide.md) when selecting a concrete scenario or `watchFor` signal. Do not force a category when the page context cannot support it.

## Balanced Coverage

Treat the suite as a coverage matrix, not a field-question list or a business-analysis-only suite. For every relevant accessible page, distribute turns across the capabilities evidenced by that page. When a page has a loaded business data source, include at least two of these business task types where supported, while preserving turns for other applicable capability areas:

- **Query:** find records matching a place, condition, time, status, or user-provided value.
- **Statistics:** count records or calculate an evidenced sum, average, minimum, maximum, or other supported aggregate.
- **Summary:** group or roll up records by an evidenced category, date, geography, or status and explain the result.
- **Comparison:** compare groups, locations, periods, or categories using a shared metric and clear denominator.
- **Ranking or analysis:** identify highest/lowest results, outliers, concentration, trend, or a meaningful spatial relationship.

Use field-definition or schema-explanation questions only as supporting turns or when the user explicitly asks what a field means. Do not let a case become a field glossary. Across the suite, balance business data tasks with intent and ambiguity, source selection, map and selection state, page or Widget navigation, spatial relationships, app actions, renderer choice, follow-up memory, correction, recovery, and unsupported-capability handling whenever those capabilities are evidenced. If a category is unavailable, substitute another evidenced category and record the limitation in `expectedBehavior` or `watchFor` rather than inventing coverage.

## Conversation Shape

The ordered suite is one realistic conversation that continues across page-targeted cases. Each case normally contributes the approved turn count (`5` unless changed by the user). At least 80% of turns must exercise evidenced app data, fields, actions, or workflows. Across the whole suite, use at most one unsupported or missing-data turn unless the user explicitly requests boundary-focused coverage. Mix direct asks, underspecified goals, visual references such as "this table" or "here", follow-ups, corrections, and source/state changes; make the first turn after a page transition understandable with the inherited conversation context.

Generated turns speak as a user performing the real task now. Express fallback expectations as part of that direct request.

Keep capability families balanced: in a normal five-turn case, aim for about two business/data turns and use the remaining turns for distinct evidenced capabilities such as map state, action or navigation, presentation, ambiguity, continuation, or recovery. Do not let field or schema questions dominate a case.

When the user supplies custom questions, use exactly those questions as the turns of one case. Do not add generated questions, split them into multiple cases, or create cases for other pages unless the user explicitly asks for that.

Prefer a smaller suite of high-value conversations over shallow one-turn checks. Name each case from its visible page title or business goal, and derive its distinct lowercase ASCII kebab-case `id` from that name. Keep the internal app page identifier in `pageId`; values such as `page_4` are not case names. Do not create a separate case merely for a tab, view, or query variation of the same page; cover those transitions inside the page's conversation when relevant.

## Case Quality Gate

Before returning cases, confirm that each one:

- uses only data, widgets, actions, pages, and capabilities evidenced by supplied context
- uses field-level requests grounded in explicitly evidenced business attributes
- resolves every field-level request to a loaded field name or alias in the matched root data source or layer schema
- has a natural user goal rather than an implementation-level command
- directly performs the user task
- can reveal a wrong interpretation, source, action, state transition, presentation, or recovery behavior
- has `expectedBehavior` describing direction rather than exact response wording
- has `watchFor` items that identify plausible observable failure symptoms
Build balanced suites from evidenced capabilities, flexible expected behavior, ambiguity, correction, source selection, map state, and continuation. Use an explicit clarification path when source choice or user intent materially changes the result.
