# Prompt Scenario Guide

## Purpose

This guide is a source of prompt ideas for exploring the quality of AI Chat in ArcGIS Experience Builder (ExB). It is not a catalog of test cases and is not intended to provide exhaustive coverage of every agent, action, renderer, or widget.

The goal is to help each team adapt a small number of natural prompts to its own app, data, and workflows—and expose how well AI Chat understands the user, discovers app capabilities, coordinates work, acts on the app, presents results, and carries context forward.

> **Do not test only whether AI Chat can execute a command. Test whether it can understand what the user wants, find the right data and capabilities in the app, plan sensible steps, act correctly, present the result appropriately, and keep the conversation connected to app state.**

## Mental Model

Use this path to understand where a prompt succeeds or breaks down:

| Stage | Core question |
|---|---|
| **Understand** | What is the user really trying to accomplish? |
| **Find** | Which data source, widget, action, field, or app capability is relevant? |
| **Plan** | Is this one operation or a sequence of dependent steps? |
| **Act** | Were the correct query, analysis, AI Action, and app changes performed? |
| **Present** | Is the result best shown as text, table, chart, legend, feature info, filter, share output, or a combination? |
| **Continue** | Can the next turn build on both the conversation and the current app state? |

## How to Use This Guide

Start with a realistic user goal, then vary the conditions around it. Prefer prompts that sound like something a person would naturally ask over prompts that expose implementation names.

- Use the app's real layer names, field vocabulary, configured widgets, and common user tasks.
- Ground field-level prompts in fields and business attributes explicitly evidenced by the supplied context.
- Phrase scenarios in the voice of a user performing the task now.
- Mix explicit commands with implicit goals and underspecified requests.
- Run short multi-turn conversations rather than treating every prompt as an isolated input.
- Observe both the answer and the resulting app state.
- Record where the failure occurred along the mental model instead of judging only the final text.

## Balanced Prompt Mix

When the app exposes business data, include some real data tasks such as lookup, filtering, counting, aggregation, grouping, comparison, ranking, trend, or spatial analysis. These should share the suite with prompts for intent ambiguity, data-source selection, current map or selection state, page and Widget navigation, app actions, renderer choice, follow-up memory, correction, and recovery. Field-definition prompts are supporting schema checks, not a substitute for this broader coverage.


## 01 Data Understanding and Insights

### Attribute, Statistical, and Comparative Reasoning

**What to test**: Whether AI Chat correctly interprets business language, binds it to the right fields and values, chooses a suitable query or aggregation, and explains the result without inventing unsupported conclusions.

**Prompt ideas**:
- `Which regions contribute the most revenue, and is the distribution concentrated?`
- `How did this year's incident count change from last year?`
- `Are there any stores that look unusual compared with similar stores?`

**Watch for**:
- Field name versus field alias, coded values, nulls, units, currency, and date semantics.
- Correct grouping, sorting, aggregation, comparison baseline, and denominator.
- A clear boundary between observations in the data and inferred explanations.
- Whether the response changes the map only when the user's intent calls for it.


### Spatial and Map-Aware Reasoning

**What to test**: Whether AI Chat can translate natural spatial language into the appropriate relationship, distance, boundary, or current-map constraint.

**Prompt ideas**:
- `Which schools are near the highest-crash intersections?`
- `How many shelters are inside these evacuation zones?`
- `What patterns stand out in the area currently visible on the map?`

**Watch for**:
- The difference between within, intersects, overlaps, nearest, and within a distance.
- Whether units, spatial reference, boundary source, and map extent are handled correctly.
- Whether a named place should be resolved from app data or geocoded externally.
- Whether “here,” “these,” or “visible” is grounded in the current app state.


## 02 Data Source Discovery and Ambiguity

### Choosing the Right Source

**What to test**: Whether AI Chat selects the source that best matches the user's meaning—not merely the source with the closest title or field name.

Use apps that contain similar layers, multiple maps or scenes, derived/output data sources, selection views, related data, or fields with overlapping meanings.

**Prompt ideas**:
- `Which cities have a population above one million?`
- `Compare assessed value for these two addresses.`
- `Use the authoritative county boundaries for this analysis.`

**Watch for**:
- Correct distinction among similarly named sources such as `Cities`, `Major Cities`, and `Cities_WGS84`.
- Preference for the source that is active, authoritative, sufficiently complete, and fit for the requested operation.
- Sensible fallback when the first candidate produces no records or lacks a required field.
- A clarifying question when source choice materially changes the answer.


### Combining Sources and Recognizing Missing Data

**What to test**: Whether AI Chat recognizes when a request needs more than one source—and when the app simply does not contain the required information.

**Prompt ideas**:
- `Compare population with hospital coverage by county.`
- `Which selected projects are in high-risk zones?`
- `Show average household income for these neighborhoods.`

**Watch for**:
- Correct join, relationship, or spatial overlay logic across sources.
- Compatible geography, time period, units, and level of aggregation.
- No silent substitution of a convenient but semantically different field.
- A transparent limitation or clarification instead of a fabricated result when data is absent.


## 03 Framework and Orchestration

### Cross-Capability Tasks

**What to test**: Whether the framework coordinates data discovery, querying, spatial reasoning, AI Actions, and rendering as one coherent user task.

**Prompt ideas**:
- `Find the three closest hospitals to this location, show them on the map, compare capacity, and give me directions to the largest one.`
- `Identify the five counties with the highest unemployment, map them, and compare their populations.`

**Watch for**:
- A sensible sequence of dependent steps rather than unrelated tool calls.
- Reuse of intermediate results instead of repeated discovery or conflicting queries.
- Correct handoff of source, filter, selection, geometry, and field context between capabilities.
- A final response that reflects what actually completed in the app.


### Dependency, Partial Success, and Coordination

**What to test**: Whether the framework notices dependencies, handles partial results, and keeps state consistent when one step cannot complete.

**Prompt ideas**:
- `Find underserved neighborhoods, chart the gap, then share the result.`
- `Select the affected parcels and open their details in the table.`

**Watch for**:
- Later steps do not run on invalid or empty intermediate results.
- Completed work is distinguished from skipped or failed work.
- Retries do not duplicate layers, filters, selections, or app actions.
- The user receives a useful next step when only part of the goal is supported.


## 04 Planner and Intent

### From Commands to Goals

**What to test**: Whether the planner understands direct instructions, implied intent, and user goals that do not name a specific action or renderer.

**Prompt ideas**:
- `Filter the map to stores with sales above $1M.`
- `I only care about the high-performing stores.`
- `Help me understand why sales are lower in this region.`

**Watch for**:
- Whether an informational question is answered without unnecessary app mutation.
- Whether an implicit goal is translated into a reasonable plan without overreaching.
- Whether the planner chooses query, analysis, filter, selection, navigation, or presentation based on intent rather than keywords.
- Whether assumptions are visible when they affect the result.


### Ambiguity and Clarification

**What to test**: Whether the planner can distinguish harmless ambiguity from ambiguity that changes the task.

**Prompt ideas**:
- `Show me California.`
- `Take me to the best site.`
- `Compare these with the others.`

**Watch for**:
- Whether “show” means navigate, filter, select, query, or open feature information in the current context.
- Whether terms such as “best,” “near,” and “recent” require a definition.
- Focused clarification rather than a broad or repetitive question.
- No confident execution when multiple interpretations would produce meaningfully different results.


## 05 App Manipulation and AI Actions

### Navigate and Change the View

**What to test**: Whether natural user goals trigger the correct navigation, map, scene, layer, widget, panel, or extent action.

**Prompt ideas**:
- `Take me to the analysis page and open the results panel.`
- `Switch to imagery, hide parcels, and zoom to downtown.`
- `Show level three of this building.`

**Watch for**:
- The correct target when an app has similar pages, widgets, maps, or layers.
- Action ordering when one UI state must exist before the next action.
- Preservation of unrelated app settings and user context.
- A response that does not claim the app changed unless the action succeeded.


### Explore, Create, and Modify

**What to test**: Whether AI Chat chooses and coordinates the right action for exploration or modification, especially when the user states a goal rather than naming a tool.

**Prompt ideas**:
- `Measure a walkable route from here to the nearest shelter.`
- `Draw an area around these incidents and use it for the next analysis.`
- `Add the approved project layer and edit this feature's status.`

**Watch for**:
- Correct choice among query, measurement, directions, draw, analysis, add data, selection, and edit actions.
- Required input, permissions, and user confirmation for consequential changes.
- Whether newly created geometry or data becomes usable context in the next turn.
- Graceful handling when the necessary action or widget is not configured.


## 06 Chat and App State Linkage

### App State as Conversation Context

**What to test**: Whether AI Chat treats the live app—not only previous messages—as part of the user's context.

**Prompt ideas**:
- After zooming manually: `What's interesting here?`
- After selecting features: `Compare these.`
- After switching maps or scenes: `How many cities are visible now?`

**Watch for**:
- Current extent, active map/scene, visible layers, selected features, active filters, open widget, and current building level.
- Whether stale app state is mistaken for the current state.
- A clear response when no usable selection or referent exists.
- Results scoped to the state the user can actually see.


### AI Actions as New App State

**What to test**: Whether actions taken by AI Chat become reliable context for later user interaction and conversation.

**Prompt ideas**:
- `Filter to high-risk parcels.` → user pans the map → `Which of those are visible now?`
- `Select the top five stores.` → user clears two selections → `Chart the remaining ones.`

**Watch for**:
- Synchronization among chat memory, source data, output data, selection, filter, and extent.
- Whether manual user changes take precedence over older AI-created state.
- No state drift after alternating between chat actions and direct app interactions.


## 07 Presentation and Renderers

### Choosing the Representation

**What to test**: Whether AI Chat selects a representation that fits the user's goal and can change that representation as the conversation evolves.

**Prompt ideas**:
- `What are the top ten stores by revenue?`
- `Show the full details.`
- `Compare their revenue visually.`
- `Where is the largest one, and what do we know about it?`

**Watch for**:
- Concise text for a direct fact, a **table** for detailed records, and a **chart** for comparison or trend.
- **Feature info** tied to the intended feature and current selection.
- A **legend** that explains the active map symbology, not an unrelated layer.
- A **filter** that accurately represents the requested scope and remains synchronized with the result.
- **Share** output that preserves the intended app state and does not imply unsupported persistence.
- Representation changes that reuse the same result set rather than silently changing its meaning.


### Renderer Boundaries and Combinations

**What to test**: Whether AI Chat uses one or several renderers only when they add value.

**Prompt ideas**:
- `Explain what these colors mean, then list only the critical facilities.`
- `Chart the selected counties and give me a shareable view of the result.`

**Watch for**:
- Correct field binding, visible columns, labels, ordering, units, and chart type.
- Consistency among the table, chart, map, legend, feature info, and filter.
- No empty or redundant renderer when a short text answer is enough.
- Clear separation between displaying a result and changing the underlying app state.


## 08 Context-Aware Multi-Turn Conversation

### Follow-Up and Reference Resolution

**What to test**: Whether AI Chat carries forward the right entities, source, filters, time period, result set, and presentation intent across incomplete follow-ups.

**Prompt ideas**:

> `Show me the top ten stores by sales.`  
> `Only keep the ones in California.`  
> `What about last year?`  
> `Which one changed the most?`  
> `Show me where it is.`  
> `Open it in the table.`

**Watch for**:
- Correct resolution of “ones,” “last year,” “which one,” and “it.”
- Whether new constraints refine the existing result or incorrectly restart the task.
- Stable use of the intended source when multiple similar sources are available.
- A clarification when the referent becomes ambiguous after the app state changes.


### Topic Shifts and Context Scope

**What to test**: Whether AI Chat retains relevant context without allowing stale context to contaminate a new task.

**Prompt ideas**:
- `Now compare those with the statewide average.`
- `That's enough about stores. What layers are available for evacuation planning?`

**Watch for**:
- Clean transition between related follow-ups and a genuinely new topic.
- No accidental reuse of an old geography, time period, selection, or filter.
- The ability to summarize or restate the active scope when needed.


## 09 Recovery, Correction, and Change of Mind

### Correcting Meaning or Data Choice

**What to test**: Whether AI Chat revises the plan and app state when the user corrects an interpretation.

**Prompt ideas**:
- `Show stores in California.` → `No, I meant Northern California.`
- `That's not the layer I meant. Use Major Cities.`
- `Compare 2024 and 2025.` → `Actually, use 2023 instead of 2024.`

**Watch for**:
- Replanning from the corrected constraint rather than layering it on top of the mistake.
- Removal or replacement of stale output layers, filters, selections, charts, and summaries.
- Preservation of still-valid parts of the user's goal.
- A concise acknowledgement of what changed.


### Undo, Retry, and Failure Recovery

**What to test**: Whether AI Chat can recover from failed operations or reverse its own prior actions without leaving hidden state behind.

**Prompt ideas**:
- `Undo that filter but keep the selection.`
- `The table is empty. Try the next most relevant parcel layer.`
- `Keep the analysis result, but return the map to my previous extent.`

**Watch for**:
- Precise reversal of the requested change rather than a broad reset.
- Safe retry behavior with no duplicate output data or repeated mutations.
- Honest reporting of what was and was not recoverable.
- Conversation memory aligned with the recovered app state.


## 10 Unsupported and Out-of-Bounds Requests

### Missing Capability, Data, or Permission

**What to test**: Whether AI Chat recognizes the boundary of the configured app, available data, user permissions, and supported analysis.

**Prompt ideas**:
- `Forecast this neighborhood's population for the next ten years.`
- `Find the closest restaurant to my live location.`
- `Edit all parcels in this result.`

**Watch for**:
- No fabricated forecast, location, layer, widget, permission, or completed action.
- A specific explanation of what is missing: data, capability, configuration, context, or authorization.
- A useful supported alternative, such as describing available historical trends or asking the user to choose a starting location.
- No exposure of hidden configuration, credentials, private data, or internal implementation details.


### Requests Outside App Scope

**What to test**: Whether AI Chat stays helpful without pretending that unrelated knowledge or operations are grounded in the app.

**Prompt ideas**:
- `What will the weather be here next month?`
- `Delete the source service behind this layer.`
- `Tell me confidential attributes that are not displayed in the app.`

**Watch for**:
- Clear distinction between app-grounded answers and general guidance.
- Safe refusal or redirection for destructive, private, or inaccessible operations.
- No attempt to bypass the app's configured capabilities or the user's access.


## 11 Make a Prompt More Revealing

Use these variations to turn an ordinary prompt into a higher-value exploration without creating a large case inventory.

| Start with | Make it more revealing |
|---|---|
| One obvious layer | Add similar layers or multiple maps |
| One familiar field | Add aliases, coded values, units, nulls, or competing fields |
| One condition | Combine attribute, temporal, and spatial constraints |
| One action | Express a multi-step user goal |
| An explicit command | State the desired outcome without naming the action |
| Complete information | Omit a material detail and observe clarification behavior |
| A fresh chat | Continue from a prior result or correction |
| Default app state | Change extent, visibility, selection, filter, or active widget first |
| A single result view | Ask the representation to evolve across turns |
| A valid request | Remove required data, capability, permission, or context |
| Chat-only interaction | Alternate between direct app interaction and chat |


## 12 Lightweight Evaluation Notes

When sharing a finding, capture just enough context to make it reproducible and diagnosable:

- **User goal**: What outcome was the user seeking?
- **Starting app state**: Which page, map/scene, visible layers, selection, filter, and extent mattered?
- **Prompt sequence**: What did the user say, including corrections and follow-ups?
- **Observed result**: What did AI Chat say and what changed in the app?
- **Breakdown stage**: Understand, Find, Plan, Act, Present, or Continue?
- **Expected direction**: What behavior would better match the user's intent?

Prefer describing the user-visible impact over naming a presumed internal component. A single natural prompt that exposes a coordination or state problem is often more useful than many narrowly scripted command checks.

