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
- observed app state or historical issues
- prepared app context from `_am().appConfig.pages`, configured data sources, and visible strings
- page-specific widget entity trees, including connected data sources and map references
- user goals the app is meant to support
- optional focus area or test direction supplied by the user during HITL setup

## Rules

- Keep prompts natural and realistic.
- If custom questions are supplied, create exactly one case for the selected visible page and use the questions in their supplied order as its turns. Do not add generated turns or cases for other pages.
- If custom questions are not supplied, generate one case for each relevant accessible page in `appContext.pages`. Do not generate separate cases for views, tabs, or URL query variants within a page.
- Before creating a case, verify that the page can be opened and has visible page content in the dedicated Playwright session.
- Select the target with `pageId` and write its canonical `pageUrl` directly into the case. Build it from the config root URL plus `/page/` and the matched page title transformed with spaces to `-`, periods to `_`, then URL-encoded.
- Omit pages that are inaccessible, permission-restricted, empty, or do not support a meaningful AI task.
- The ordered suite is one continuous Assistant conversation. Each case contributes the requested number of turns on its target page, and later cases may inherit earlier context; recommend 5 turns per case by default.
- Use the visible page title for the case `title` by default, or a concise business goal when it better identifies the conversation.
- Derive case `id` from `title` as lowercase ASCII kebab-case. Keep internal page/widget/view IDs only in their dedicated fields; never use values such as `page_4`, `widget_12`, or `view_3` as a case `id` or `title`.
- Use the same requested turn count for every case unless the user explicitly asks for different coverage.
- Mix direct asks, vague goals, corrections, and state-based follow-ups.
- Prefer tasks tied to real app data and visible app actions, including map, search, layer, nearby, navigation, presentation, sharing, and printing workflows when evidenced.
- At least 80% of generated turns must target data, fields, actions, or workflows positively evidenced in the supplied context. Do not invent likely-sounding fields to create negative tests.
- Across the entire suite, include at most one missing-data or unsupported-capability turn, and only when the context gives a concrete reason that boundary matters. Do not add one to every case.
- Create non-happy-path coverage primarily through ambiguity, corrections, source choice, current extent/state, follow-up memory, and presentation requirements rather than nonexistent fields.
- Test an action only when its widget/action path is visible and reachable; a client registration or config entry alone is not evidence of user availability.
- For action cases, require visible proof of the mutation or presentation change and verify that unrelated state is preserved.
- If a user-provided focus area exists, bias the prompt suite toward that direction.
- If no focus area is supplied, use the default prompt-generation coverage below.
- Include explicit checks for map state, data source choice, and continuation across turns.
- Avoid repeating known failures verbatim; use nearby variants instead.
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
      "turns": ["turn 1", "turn 2", "turn 3", "turn 4", "turn 5"],
      "expectedBehavior": "concise expected direction",
      "watchFor": ["likely failure 1", "likely failure 2"],
      "tags": ["tag1", "tag2"]
    }
  ]
}
```

For automatically generated cases, prefer coverage across:

Across the generated cases, cover:

1. a current map state case
2. a data-source ambiguity case
3. a correction or follow-up case
4. a presentation / renderer case
5. coverage across multiple accessible pages when the app has them
6. a case requiring the assistant to choose among multiple app capabilities
7. optionally, one suite-level turn covering a meaningful missing-data or unsupported boundary

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

For custom questions, return exactly one case even when the app has multiple visible pages. Its `turns` must match the supplied questions exactly and in order.

The response contains JSON only: no markdown fences, comments, or explanatory prose.
