# AI Chat Testing Capabilities

Use this reference to choose realistic AI Chat cases and judge the visible result. Test only what the published app actually exposes to a user.

## What To Test

| User goal | A good result looks like | Check before testing |
| --- | --- | --- |
| Ask about the current page | The answer names the relevant map, table, list, or view and stays within the current app context. | The relevant surface is visible. |
| Ask about app data | The answer uses the correct layer and fields, and distinguishes missing data from a real result. | The layer is connected to a visible page widget. |
| Ask about the map | The answer respects the current extent, visible layers, and selection when the prompt refers to them. | The map and referenced state are visible. |
| Filter, select, or compare records | The requested result appears in the map, table, list, or response and stays consistent across those surfaces. | The app exposes a connected map, table, list, or selection path. |
| Change presentation | A request for a table, list, chart, legend, or feature detail produces the right visible presentation without changing the result's meaning. | The target presentation is visible in the app. |
| Navigate the app | The requested page, view, panel, or dialog actually opens and the response acknowledges only what changed. | A user can reach that destination from the published app. |
| Continue a conversation | Follow-ups retain the intended result set, source, filter, and user goal. | The earlier result is visible and unambiguous. |
| Correct a request | The revised result replaces the earlier mistake without leaving stale filters, selections, or output behind. | The original result or app change can be observed. |
| Handle an unavailable request | The response plainly states the limitation and offers a useful supported alternative. | The data, tool, or destination is genuinely unavailable to the user. |

## Action Capabilities

Test actions through natural user goals and verify the visible app state. The action names below are implementation signals from the Experience Builder client, not promises that every app exposes every action.

| Action family | User goals worth testing | Visible proof | Required context |
| --- | --- | --- | --- |
| Map navigation | Zoom to a result, pan to a place, return home, set a viewpoint, inspect the current extent | Map extent, center, zoom, or viewpoint changes | A visible connected Map widget |
| Map content | Show/hide layers, add or remove runtime layers, list layers, inspect a legend, change basemap | Layer visibility, layer list, legend, or basemap visibly changes | Map widget plus reachable layer/basemap controls |
| Map inspection | Show a popup, inspect a feature, measure distance/area, clear a measurement | Popup opens, measurement graphic/value appears or clears | Map with popup/measurement capability exposed |
| Search and location | Search an address/place, use current location, center the map on a match | Search result, map navigation, or location marker appears | Visible Search/geocoder or location workflow |
| Nearby and spatial discovery | Find nearby facilities, search within a radius, use a point/line/polygon as the search area | Near Me result list/map output and distance/radius are visible | Reachable Near Me widget and its connected facility sources |
| Data and records | Query, filter, count, compare, select, sort, inspect fields, view source details | Map/table/list/response reflects the requested source and condition | A visible widget or action path connected to the source |
| Presentation | Show a table, chart, feature detail, legend, or map result; change the requested representation | The requested renderer or widget visibly appears and preserves meaning | Target renderer/widget is available in the current app |
| Navigation | Open a page/view/window, close a window, switch a view, return to a prior page | URL, page, view, window, or panel visibly changes | Destination is visible/reachable from the published app |
| Widget and panel control | Open/close a panel, toggle a sidebar, use a controller-hosted tool, change widget state | Panel/controller/widget state visibly changes | Widget action is mounted and reachable; do not infer from config alone |
| Sharing and output | Share a map/result, print/export a result, save or download supported output | Share UI, print output, download, or save confirmation is visible | Share/Print/export action is visibly available |

## Subagent Capabilities

These are internal agent capabilities surfaced by the client. Test them only when their result is user-visible; do not treat an agent name or registered tool as proof of availability.

| Subagent capability | What it can contribute | What to verify |
| --- | --- | --- |
| `appGuide` | App purpose, pages, views, widgets, controls, supported workflows, and current app context | Answer names the current visible app surface and does not invent hidden capabilities |
| `dataSource` | Data-source/layer inventory, field resolution, queries, filters, statistics, selections, extent-aware results, and feature details | Correct visible source, fields, conditions, counts, records, or honest limitation |
| `aiActions` | Executes registered widget/framework actions such as map, navigation, sidebar, resource, and general-location actions | Requested app mutation is visible and occurs on the correct target |
| `geoKnowledge` | General place knowledge, geocoding, reverse geocoding, and map targets when no authoritative app source applies | Does not replace an available app data source or overclaim authoritative data |
| `agentBuilder` / custom agents | App-configured workflows that may combine subagents, tools, and outputs | Final visible result, action state, and error/permission handling |
| Renderer selection | Chooses a supported renderer and constructs presentation parameters | Renderer output is visible, appropriate, and not empty/redundant |

## Action Case Patterns

Prefer prompts that expose the full action chain:

- **Direct mutation:** “Show the firehouses near this location on the map.”
- **Ambiguous target:** “Move the map to the hospitals.” Verify clarification or correct source selection.
- **Stateful follow-up:** “Now hide that layer and show libraries instead.” Verify the prior map state is retained.
- **Cross-surface presentation:** “Put those results in a table without changing the filter.” Verify records stay consistent.
- **Navigation plus action:** “Open Map Explorer and search for facilities near this address.” Verify ordering and destination.
- **Unsupported action:** “Export this result” when no export path is visible. Judge honesty, not a confident claim.
- **Correction:** “I meant firehouses, not police stations.” Verify stale selection/filter state is replaced.

For every action case, record the starting visible state, the requested mutation, the visible proof of change, and any unchanged state that should have been preserved.

## How To Judge It

1. Start from what a user can see: current page, map, table, list, selection, filter, or open panel.
2. Treat the visible app result as proof. A confident chat message alone is not proof that an app change occurred.
3. Confirm the requested data source, fields, and presentation match the user's words.
4. Check that unrelated map state, filters, and selections remain intact unless the user asked to change them.
5. For multi-turn cases, verify that later requests refine the active result rather than silently restart with a different source or scope.

## Boundaries

- A layer, service, view, panel, or tool mentioned in configuration is not automatically available to a user or to Chat.
- A configured route, geocoder, print service, or analysis option is testable only when a visible app workflow exposes it.
- Do not expect Chat to perform an action merely because a related widget exists.
- When the app cannot support a request, evaluate whether Chat is honest and helpful rather than treating refusal as a failure.