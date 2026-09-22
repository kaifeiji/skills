# Prompt Generator Template for AI Chat App Testing

You are generating a realistic, exploratory AI Chat test suite for a real app.

Return valid JSON matching the app config structure, with no markdown fences.

## Inputs

Use the following app-specific context:

- app URL
- selected output language (default: English)
- app purpose and user persona
- visible pages and their page-specific content
- configured widgets, maps, tables, filters, and actions
- known data sources and layer names
- observed app state or historical issues
- prepared app context from `_am().appConfig.pages` and `_dataSourceManager.dataSources`
- page-specific large-layout widgets, including their connected data sources and map references
- user goals the app is meant to support
- optional focus area or test direction supplied by the user during HITL setup

## Rules

- Keep prompts natural and realistic.
- Generate one case for each relevant accessible app page found in `appContext.pages`. Do not generate separate cases for views, tabs, or URL query variants within a page.
- Before creating a case, verify that the page can be opened and has visible page content in the dedicated Playwright session.
- Omit pages that are inaccessible, permission-restricted, empty, or do not support a meaningful AI task.
- Each case is a continuous conversation with the requested number of turns; recommend 5 turns by default.
- Use the same requested turn count for every case unless the user explicitly asks for different coverage.
- Mix direct asks, vague goals, corrections, and state-based follow-ups.
- Prefer tasks tied to real app data and app actions.
- If a user-provided focus area exists, bias the prompt suite toward that direction.
- If no focus area is supplied, use the default prompt-generation coverage below.
- Include explicit checks for map state, data source choice, and continuation across turns.
- Avoid repeating known failures verbatim; use nearby variants instead.
- Base capabilities on features evidenced by each page's large-layout widgets, connected data sources, and map references.
- Write all generated prompt text in the selected output language.

## Required JSON structure

```json
{
  "cases": [
    {
      "id": "page-id",
      "title": "human readable page conversation title",
      "pageId": "page-id",
      "pageTitle": "visible page title",
      "widgets": [
        {
          "id": "widget-id",
          "label": "widget label",
          "uri": "widget type",
          "useDataSources": [],
          "useMapWidgetIds": [],
          "references": {}
        }
      ],
      "intent": "one sentence",
      "turns": ["turn 1", "turn 2", "turn 3", "turn 4", "turn 5"],
      "expectedBehavior": "concise expected direction",
      "watchFor": ["likely failure 1", "likely failure 2"],
      "tags": ["tag1", "tag2"]
    }
  ]
}
```

## Coverage to prefer

Across the generated cases, cover:

1. a current map state case
2. a data-source ambiguity case
3. a correction or follow-up case
4. a presentation / renderer case
5. coverage across multiple accessible pages when the app has them
6. a case requiring the assistant to choose among multiple app capabilities
7. a case covering missing or unsupported data

## Output contract

Return only JSON. Use the supplied `appContext.dataSources` to ground source and layer references. Each case must target a distinct accessible page and have:
- an `id`
- a `title`
- a `pageId`
- a `pageTitle`
- a `turns` array with the requested number of turns
- an `intent`
- an `expectedBehavior`
- a `watchFor` list
- a `tags` list

The response contains JSON only: no markdown fences, comments, or explanatory prose.
