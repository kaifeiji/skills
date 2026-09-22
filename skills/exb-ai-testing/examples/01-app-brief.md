# Real App Example: Explore San Diego

## Target app

Name: Explore San Diego
URL: https://experiencedev.arcgis.com/experience/4644d725216a490a9074fd096d4b1608/?views=Fun-places

## Purpose

This app presents a tourism-oriented San Diego exploration experience. It mixes map-focused discovery with place data, filters, and view switching.

## Real app context

- The app exposes a map-based experience for exploring San Diego destinations.
- It includes visible place data such as fun places, restaurants, and potentially multiple related datasets.
- It includes multiple views and stateful controls, so the assistant must respect what is currently visible.
- User requests often depend on the current map extent, layer selection, and follow-up corrections.

## Domain risk areas

- current map extent grounding
- source selection when multiple place datasets are visible
- renderer or presentation switching without altering meaning
- follow-up corrections and continuity across turns
- avoiding invented fields or unsupported details

## Example user tasks

- "Which fun places are in the current map area?"
- "Only keep parks or outdoor places."
- "Now compare them as a table instead of a map."
- "No, keep the full map extent and just select those two results."
- "I only want cafes and coffee shops, not restaurants in general."

## Expected evaluation focus

The assistant should stay grounded in the actual San Diego app state, avoid switching to the wrong source, preserve valid context through corrections, and clearly distinguish between filter, selection, and view changes.
