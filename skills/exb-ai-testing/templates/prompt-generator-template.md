# Prompt Generator Template for AI Chat App Testing

You are generating a realistic, exploratory AI Chat test suite for a real app.

Return valid JSON matching the app config structure, with no markdown fences.

## Inputs

Use the following app-specific context:

- app URL
- selected output language (default: English)
- app purpose and user persona
- visible pages and their page-specific content
- global header/footer widgets and their nested child widgets, when present
- app dialogs (windows) and their mounted widgets, when a user-visible trigger exists
- widgets mounted in accessible page layouts, plus their maps, tables, filters, and actions
- runtime-verified AI Chat capabilities; do not infer AI actions, agents, or renderers from ordinary ExB configuration
- known data sources and layer names
- observed app state from the current dedicated Playwright session
- prepared app context from `_am().appConfig.pages`, configured data sources, and visible strings
- page-specific widget entity trees, including connected data sources and map references
- user goals the app is meant to support
- optional focus area or test direction supplied by the user during HITL setup
- approved `suite.turnsPerCase` value from the HITL setup

## Rules

- Keep prompts natural and realistic.
- Write every generated turn in the voice of a user performing the actual task now.
- Phrase a boundary check as a direct task plus the expected fallback, for example: `Query this address; if there is no matching record, say so clearly.`
- If custom questions are supplied, create exactly one case for the selected visible page and use the questions in their supplied order as its turns. Do not add generated turns or cases for other pages.
- If custom questions are not supplied, generate one case for each relevant accessible page in `appContext.pages`. Do not generate separate cases for views, tabs, or URL query variants within a page.
- Before creating a case, verify that the page can be opened and has visible page content in the dedicated Playwright session.
- Select the target with `pageId` and write its canonical `pageUrl` directly into the case. Derive it from the full config URL with the standard URL API: preserve the original origin, every query parameter in `search` (for example `?draft=true`), and the original hash; only update the pathname to the matched `/page/<encoded-title>` path. Never reconstruct the URL from origin alone or discard `search`/`hash`.
- Omit pages that are inaccessible, permission-restricted, empty, or do not support a meaningful AI task.
- The ordered suite is one continuous Assistant conversation. Each auto-generated case contributes exactly `suite.turnsPerCase` turns on its target page, and later cases may inherit earlier context. Use `5` only when `suite.turnsPerCase` is absent and the default was not changed.
- Use the visible page title for the case `title` by default, or a concise business goal when it better identifies the conversation.
- Derive case `id` from `title` as lowercase ASCII kebab-case. Keep internal page/widget/view IDs in their dedicated fields.
- Use exactly the approved `suite.turnsPerCase` count for every auto-generated case. Do not use the five-turn example below as a fixed requirement. If custom questions are supplied, use their exact count and order instead.
- Mix direct asks, vague goals, corrections, and state-based follow-ups.
- Prefer tasks tied to real app data and visible app actions, including map, search, layer, nearby, navigation, presentation, sharing, and printing workflows when evidenced.
- At least 80% of generated turns must target data, fields, actions, or workflows positively evidenced in the supplied context.
- For each data-bearing case, include at least two business questions when supported: record lookup/filter, count or aggregate, grouped summary, comparison, ranking, trend/outlier, or spatial analysis. Keep remaining turns distributed across other evidenced capabilities such as map state, source choice, navigation/action, renderer, ambiguity, follow-up, and recovery. Use field-definition questions only to support those tasks or when explicitly requested; do not generate a field glossary.
- Build field-specific turns from names or aliases explicitly listed in `appContext.dataSources[].fields` or `appContext.dataSources[].layers[].fields`. When a source is unavailable or has no loaded fields, use its evidenced page, layer, map, and widget workflows for that case.
- Across the entire suite, reserve at most one turn for a context-grounded missing-data or unsupported-capability boundary.
- Create challenge coverage primarily through ambiguity, corrections, source choice, current extent/state, follow-up memory, and presentation requirements.
- Test an action only when its widget/action path is visible and reachable; a client registration or config entry alone is not evidence of user availability.
- For action cases, require visible proof of the mutation or presentation change and verify that unrelated state is preserved.
- If a user-provided focus area exists, bias the prompt suite toward that direction.
- If no focus area is supplied, use the default prompt-generation coverage below.
- Include explicit checks for map state, data source choice, and continuation across turns.
- When a stable visible outcome can be checked, add a `verification` object with one to three `visibleChecks` and one to three `failureSignals`. Keep these checks observable and tolerant of natural-language variation; do not invent exact values that the app context does not establish. This is a review contract for the analysis phase, not a runner assertion.
- Base capabilities on each visible page's widget entity tree, connected data sources, map references, visible strings, and runtime-verified AI capabilities.
- Do not use hidden pages, unmounted widgets, runtime-only data sources, or internal agent names as user-facing capabilities.
- Write all generated prompt text in the selected output language.

## Output

```json
{
  "cases": [
    {
      "id": "general-plan-zoning",
      "title": "General Plan & Zoning",
      "pageId": "page-id",
      "pageTitle": "visible page title",
      "pageUrl": "canonical published page URL",
      "intent": "one sentence",
      "turns": ["Turn 1 through Turn N, where N equals suite.turnsPerCase"],
      "expectedBehavior": "concise expected direction",
      "watchFor": ["likely failure 1", "likely failure 2"],
      "verification": {
        "visibleChecks": ["The requested map or renderer result is visibly present"],
        "failureSignals": ["The response claims success but the requested result is absent"]
      },
      "tags": ["tag1", "tag2"]
    }
  ]
}
```

Across the generated cases, cover:

1. one or more record lookup, filtered query, count, aggregate, grouped summary, comparison, ranking, trend, outlier, or spatial-analysis tasks when supported
2. a current map, selection, extent, table, or visual-reference state case
3. a data-source, field, or capability ambiguity case
4. a page, view, Widget, navigation, or app-action case when evidenced
5. a correction, follow-up, recovery, or state-synchronization case
6. a presentation / renderer choice case
7. coverage across multiple accessible pages when the app has them
8. a case requiring the assistant to choose among multiple app capabilities
9. optionally, one suite-level turn covering a meaningful missing-data or unsupported boundary

Return only JSON. Use the supplied `appContext.dataSources` to ground source and layer references. Each case must target a distinct accessible page and have:
- an `id`
- a `title`
- a `pageId`
- a `pageTitle`
- a `pageUrl`
- a `turns` array with the requested number of turns
- an `intent`
- an `expectedBehavior`
- a `watchFor` list
- a `tags` list
- an optional `verification` object when the case has stable visible checks

For custom questions, return exactly one case even when the app has multiple visible pages. Its `turns` must match the supplied questions exactly and in order.

The response contains JSON only: no markdown fences, comments, or explanatory prose.
