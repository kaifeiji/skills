# Run Analysis: NYCityMap - Holistic testing

## Test Scope

- **App Title:** NYCityMap - Holistic testing
- **App URL:** https://experiencedev.arcgis.com/experience/<app-id>/
- **Result Summary:** 2 cases; 6 turns: 5 ✅ Success, 1 ⚠️ Partial Success.
- **Scope:** Visible Lot Info and Map Explorer pages; hidden Info page excluded. The report starts with case-debug.md and supplements with screenshots only when needed.

## Lot Info overview

### Turn 1: Lot Info capabilities

[![Turn 1 screenshot](./lot-info-overview/turn-01.png)](./lot-info-overview/turn-01.png)

- **Status:** ✅ Success
- **User Prompt:** What can I do on this Lot Info page?
- **Answer Summary:** The assistant explains address, BBL, and BIN lookup, lot/building details, districts, and related City resources.
- **Duration:** 13.3s
- **Judgment:** The response is page-specific and gives a useful overview without inventing a lookup result.

## Map Explorer and Near Me

### Turn 1: Map Explorer information

[![Turn 1 screenshot](./map-explorer-near-me/turn-01.png)](./map-explorer-near-me/turn-01.png)

- **Status:** ⚠️ Partial Success
- **User Prompt:** What information is available on this Map Explorer page?
- **Answer Summary:** The assistant asks for a widget or location instead of explaining the visible page and its tools.
- **Duration:** 11.6s
- **Judgment:** The assistant underuses the available page context.
- **Key Debug:** The plan recognized the Map Explorer tools, but the response requested an additional widget reference.
