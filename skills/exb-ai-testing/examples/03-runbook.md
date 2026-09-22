# Real Example Runbook: Explore San Diego

## Goal

Validate how an AI Chat assistant behaves in the San Diego Explore app and produce a complete evidence-backed report.

## Inputs

- App URL: https://experiencedev.arcgis.com/experience/4644d725216a490a9074fd096d4b1608/?views=Fun-places
- App summary: tourism and place discovery app with map-centered exploration
- Target risk areas: map-state grounding, source choice, correction handling, and renderer/presentation changes

## Step 1: Validate app access

```bash
curl -I "https://experiencedev.arcgis.com/experience/4644d725216a490a9074fd096d4b1608/?views=Fun-places"
```

Check:

- the page loads successfully
- the app is visible in a browser context
- the Chat panel is actually present and usable
- any required auth/session is already active

If the app cannot be reached or the chat is not visible, stop before running the test.

## Step 2: Create the app config

Read the app title in Chromium and let the preparation script derive the slug:

```bash
node tooling/prepare-config-and-prompts.mjs \
  "https://experiencedev.arcgis.com/experience/4644d725216a490a9074fd096d4b1608/?views=Fun-places"
```

This matches the app's actual context and the real run pattern.

## Step 3: Generate the prompt suite

Use the real examples from the app context:

- restaurant filtering and renderer changes
- fun places in current map area
- correction handling after changing the target set
- app-state continuity across turns

The suite should reflect the actual app's capabilities and avoid over-generalized prompts.

## Step 4: Run the scripted Chromium evaluation

Use the generated config with the bundled runner:

```bash
node tooling/run-cases.mjs \
  --config config/<generated-app-slug>.json \
  --mode headed \
  --output artifacts/<run-name>
```

Expected output location:

```text
artifacts/<YYYYMMDD-explore-san-diego>/
```

Artifacts to verify after the run:

- screenshots after each turn
- result files per case
- debug transcript if available
- no empty or partial evidence set

## Step 5: Analyze the evidence

Write the Chinese conclusions to:

```text
artifacts/<run-name>/analysis.md
```

The analysis should call out:

- whether the assistant grounded itself to the current visible map
- whether it stayed on the correct source
- whether it handled correction correctly
- whether it invented unsupported details
- whether the result was presented appropriately

## Step 6: Build the final report

```bash
node tooling/build-report.mjs artifacts/<run-name>
```

This report should render the summary, screenshots, and run evidence in one place.

## Exit condition

The workflow is only complete when the real app run produces valid artifacts, the analysis is evidence-based, and the report builds successfully.
