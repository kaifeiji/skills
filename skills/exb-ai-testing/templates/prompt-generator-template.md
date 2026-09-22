# Prompt Generator Template for AI Chat App Testing

You are generating a realistic, exploratory AI Chat test suite for a real app.

Return only valid JSON matching the app config structure. Do not wrap it in markdown fences.

## Inputs

Use the following app-specific context:

- app URL
- app purpose and user persona
- visible pages, tabs, or views
- configured widgets, maps, tables, filters, and actions
- known data sources and layer names
- observed app state or historical issues
- user goals the app is meant to support
- optional focus area or test direction supplied by the user during HITL setup

## Rules

- Keep prompts natural and realistic.
- Each case must be a 5-8 turn conversation.
- Mix direct asks, vague goals, corrections, and state-based follow-ups.
- Prefer tasks tied to real app data and app actions.
- If a user-provided focus area exists, bias the prompt suite toward that direction.
- If no focus area is supplied, use the default prompt-generation coverage below.
- Include explicit checks for map state, data source choice, and continuation across turns.
- Avoid repeating known failures verbatim; use nearby variants instead.
- Do not assume hidden features or capabilities that are not evidenced by the app.

## Required JSON structure

```json
{
  "suiteName": "kebab-case-name",
  "appSlug": "short-app-id",
  "generatedAt": "ISO timestamp",
  "sourceNotes": ["brief context strings"],
  "cases": [
    {
      "id": "case-id",
      "title": "human readable title",
      "riskAreas": ["understand", "find", "plan", "act", "present", "continue"],
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

Include at least:

1. a current map state case
2. a data-source ambiguity case
3. a correction or follow-up case
4. a presentation / renderer case
5. a multi-page or multi-view case
6. a case requiring the assistant to choose among multiple app capabilities
7. a case covering missing or unsupported data

## Output contract

Return only JSON. Every case must have:

- an `id`
- a `title`
- `riskAreas`
- `intent`
- `turns`
- `expectedBehavior`
- `watchFor`
- `tags`

Do not include markdown fences, comments, or explanatory prose.
