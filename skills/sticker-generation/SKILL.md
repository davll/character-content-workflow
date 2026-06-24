---
name: sticker-generation
description: Generate chat-style stickers, LINE stickers, Telegram stickers, reaction stickers, chibi stickers, sticker grids, or sticker sheets of a registered character while maintaining character consistency. Use when Codex needs to infer a character sheet from the registry, build sticker prompts and artifact paths, then hand off final rendering to the image-generation skill.
---
# Sticker Generation

Run the sticker workflow in this skill. Use the `character-registry` skill for registry validation, sheet selection, sheet paths, and prompt-building data. Use the `image-generation` skill for final rendering, dry-run validation, provider behavior, API key handling, and CLI command shape.

This skill owns only the orchestration contract:

1. Interpret the user request as a sticker or sticker sheet.
2. Select one registry sheet as the 1st reference image.
3. Resolve sticker style, layout, size, action, and optional caption.
4. Build a sticker prompt that preserves registry character identity.
5. Create durable sticker artifacts.
6. Hand off rendering to `image-generation`.

## Defaults

- Registry: `characters/index.yaml`
- Output directory: `output/character-stickers`
- Image provider preference: `openai` unless the user requests another provider
- Image model preference: omit unless requested
- Layout defaults:
  - Prompts that ask for "a sticker", "reaction", or one emotion/action default to `1x1`.
  - Prompts that ask for a "set", "various", "sticker sheet", or "random reactions" default to `4x4`.
- Image size defaults:
  - `1x1`: `512x512`
  - `2x1`: `1024x512`
  - `1x2`: `512x1024`
  - `2x2`: `1024x1024`
  - `4x4`: `2048x2048`
- Response provider/model for reasoning: use your own reasoning unless the user explicitly asks for a separate model call.

## Hard Invariants

Fail before writing the final prompt or generating an image when any invariant cannot be satisfied:

1. The sticker request must contain a non-empty prompt. If a prompt file is supplied, read it and trim whitespace.
2. Registry lookup must go through the `character-registry` skill. Do not parse registry YAML manually for sheet search, sheet paths, or prompt-building data.
3. `character-registry` failures are workflow failures. Report the command error and stop before writing image outputs.
4. The selected registry sheet must resolve through `get-sheet-path`, exist on disk, and be PNG or JPEG.
5. The selected registry sheet must be the only reference image and must be passed as the 1st reference image.
6. The prompt must include a 1st-image role rule that limits the reference image to character identity, outfit, traits, and registry-defined consistency.
7. The image-generation handoff must include explicit prompt, output image, reference image, metadata path, and dry-run metadata path when used.
8. The real generation metadata path and dry-run metadata path must be distinct.

## Registry Resolution

Resolve the registry path before calling `character-registry`:

1. Use an explicit user-provided registry path when supplied.
2. Otherwise use `characters/index.yaml` when it exists.
3. Otherwise, when running inside this skill development repository, use `examples/characters/index.yaml` when it exists.
4. Create `characters/index.yaml` through the `character-registry` first-use workflow only when no usable registry candidate exists.

If the registry path is overridden, pass that path through every registry lookup.

## Workflow

### Stage 1: Request Intake

Resolve the request into:

- `user_prompt`: non-empty sticker request.
- `requested_layout`: optional `single` or an `MxN` grid such as `1x1`, `2x1`, `1x2`, `2x2`, or `4x4`.
- `handoff_options`: provider, model, size, aspect ratio, resolution, overwrite, dry-run, and verbosity, only when requested or inferred by this workflow.

Treat `single` and `1x1` as single-sticker layouts. Normalize legacy `matrix_MxN` wording to `MxN`.

### Stage 2: Registry Selection

Use `character-registry` to validate the registry and list all registry summaries. Infer the target character group and selected sheet from the registry output and the user prompt.

Selection heuristics:

1. Identify the target character group from character names, group composition, and sheet summaries.
2. Select a suitable dressed/outfit sheet for stickers from the listed sheets.
3. Avoid base, naked, or minimal sheets unless the user explicitly requests them or no dressed sheet exists.
4. Prefer explicit prompt keywords for character and outfit.
5. Add warnings for ambiguous character identity, missing dressed sheets, unsupported registry data, or low-confidence selection.

Build one canonical selected reference:

```json
{
  "label": "1st image",
  "id": "sheet:<group_id>:<sheet_id>",
  "group_id": "<group id>",
  "sheet_id": "<sheet id>",
  "kind": "registry_sheet",
  "role": "character identity, outfit, and trait reference",
  "target": "<character or group>",
  "handoff_path": "<resolved registry sheet path>",
  "prompt_data": "<pathless sheet summary and prompt-building data>"
}
```

For the selected sheet:

1. Use deterministic ID `sheet:<group_id>:<sheet_id>`.
2. Verify it with `get-sheet-path`.
3. Load prompt-building data with `get-sheet-info`.
4. Use sheet summary, `prompt_building.descriptions`, `prompt_building.constraints`, and `prompt_building.system_instructions`.

### Stage 3: Sticker Plan

Infer a compact sticker plan from the prompt, selected reference, and warnings:

```json
{
  "group_id": "<target group id>",
  "sheet_id": "<selected sheet id>",
  "style": "chibi | standard",
  "layout": "1x1 | 2x1 | 2x2 | 4x4 | other MxN",
  "size": "<inferred or requested image size>",
  "action": "<core action, expression, reaction set, or theme>",
  "caption": "<caption text or null>",
  "reason": "<why this group/sheet/style/layout was selected>",
  "warnings": []
}
```

Planning heuristics:

1. Choose `chibi` for cute, SD, mascot, LINE-like, exaggerated, or chibi requests.
2. Choose `standard` for normal anime proportions or when the user explicitly asks for standard style.
3. Use `1x1` for prompts asking for "a sticker", "reaction", or one emotion/action.
4. Use `4x4` for prompts asking for a "set", "various", "sticker sheet", or "random reactions".
5. For other broad themes, infer the most appropriate layout from the request and report it in the final response.
6. If `requested_layout` is provided, use that exact layout after inference and adapt the action/expression set to fit it.
7. Extract caption text only when the user requests visible sticker text. Otherwise use `null`.
8. If the user does not provide image size, infer it from the resolved layout using the image size defaults.
9. Add warnings for layout/action conflicts, unsupported layout sizes, ambiguous captions, or prompts that request too many distinct reactions for the layout.

### Stage 4: Artifact And Reference Normalization

Create the run directory and reserve artifact paths.

Create a timestamp in this shape:

```text
YYYY-MM-DD_HH-MM-SS
```

Infer a concise scenario filename from the selected group, sticker style, layout, and action/theme, such as:

```text
<group_id>_<style>_<layout>_<sanitized_action_or_theme>
```

Sanitize the scenario filename by lowercasing, replacing non-ASCII letters or digits with `_`, collapsing repeated `_`, trimming leading/trailing `_`, and limiting it to 90 characters.

Create the run directory:

```text
OUTPUT_DIR/<scenario_filename>-<timestamp>
```

With default output directory, reserve these paths:

- Prompt: `output/character-stickers/<scenario_filename>-<timestamp>/prompt.txt`
- Image: `output/character-stickers/<scenario_filename>-<timestamp>/image.png`
- Metadata: `output/character-stickers/<scenario_filename>-<timestamp>/metadata.json`
- Dry-run metadata: `output/character-stickers/<scenario_filename>-<timestamp>/metadata.dry-run.json`

Canonical reference validation:

1. The selected reference ID must match `sheet:<group_id>:<sheet_id>`.
2. The selected reference `handoff_path` must be the path resolved by `get-sheet-path`.
3. The prompt must describe the selected reference as `1st image`.
4. The image-generation handoff must pass exactly one reference image, in that same position.

### Stage 5: Prompt Building

Build one final sticker prompt from the sticker plan, selected reference prompt data, and warnings. The prompt-building stage may use IDs, labels, roles, targets, descriptions, sheet summaries, and prompt-building data, but must not mention local filesystem paths.

#### Registry Prompt-Building Fidelity

Treat registry `prompt_building.descriptions`, `constraints`, and `system_instructions` as source-of-truth semantic content.

The prompt builder may reorganize wording for readability, merge duplicate ideas, and adapt phrasing into the final prompt structure, but must not weaken, omit, sanitize, generalize, or contradict registry-provided character facts, outfit details, body traits, identity details, relationship logic, or constraints.

If a registry description is explicit, preserve its explicitness unless it directly conflicts with a higher-priority safety policy or with another registry constraint. In that case, add a warning explaining which registry text was changed and why.

Prompt header:

```text
Generate a chibi chat sticker featuring the character from the 1st input image.
```

Use this header for `standard`:

```text
Generate a chat sticker featuring the character from the 1st input image.
```

For matrix layouts other than `single`/`1x1`, use this header instead:

```text
Generate a sticker sheet matrix featuring the character from the 1st input image.
```

Prompt structure:

```text
Character Summary: <sheet/group summary and key registry character traits>
Sticker Concept: <inferred action>
Caption Text: <caption, only if non-null>

Constraints:
- Style: <style rule>
- Layout: <matrix rule, only for matrix layouts>
- Consistency: <matrix consistency rule, only for matrix layouts>
- Sticker Outlining: The character must be fully outlined with a thick, clean white die-cut border.
- Background: Isolated on a completely solid, plain white background.
- Character Identity: Keep the character's face, hair, skin, outfit, and relative height difference consistent with the 1st input image.
- The 1st image is ONLY for character identity, outfit, and trait reference.

Visual Constraints:
- <each registry constraint>

Character Traits (from registry):
- <flattened registry descriptions>

Character Instructions (from registry):
- <each registry system instruction>
```

Style rules:

- Chibi: `A cute, high-quality chibi/SD (super-deformed) anime sticker, with a large head, small body, exaggerated facial expression, and dynamic posing.`
- Standard: `A high-quality digital anime sticker in the character's original proportion and style, featuring an exaggerated facial expression and dynamic posing.`

For matrix layouts, add:

```text
- Layout: Must be arranged in a clean, symmetric <MxN> grid of individual stickers, separated by white space.
- Consistency: Ensure the character's features, colors, and outfit design are perfectly consistent across all grid cells.
```

Prompt invariants:

1. The selected registry sheet is the source of truth for character identity, outfit ownership, proportions, and stable physical traits.
2. The 1st image must be used only for character identity, outfit, and trait reference.
3. Registry constraints take precedence over generic sticker styling.
4. Preserve explicit registry `descriptions`, especially character identity, outfit ownership, body traits, relationship logic, and constraints.
5. Do not weaken specific registry wording into vague references such as "same fit" or "as shown" when the registry provides explicit semantic detail.
6. For multi-character stickers, bind each character to visible outfit, pose, expression, body proportion, and relative height relationship.
7. For matrix layouts, specify the grid size and keep each cell visually separated by white space.
8. Do not add a separate Reference Guide section for stickers; the prompt embeds the 1st-image rule in the constraints.
9. If any registry `prompt_building.descriptions` item is omitted, softened, generalized, or materially rephrased, record a warning in the workflow output explaining the original registry text, the changed prompt text, and the reason.
10. Do not add unsolicited softening, sanitizing, or tone-limiting language such as "non-explicit", "not eroticized", "suitable", "tasteful", or equivalent wording when the user did not request it and no higher-priority safety policy requires it. If such a policy-based change is required, keep the change as narrow as possible and record a warning explaining the exact registry or user-prompt wording that was changed.

### Stage 6: Handoff And Final Report

Before handing off, perform a final alignment check:

1. The prompt describes the selected reference as `1st image`.
2. The image-generation handoff passes exactly one reference image.
3. The reference path passed to image-generation is the selected reference `handoff_path`.
4. The real generation metadata path and dry-run metadata path are distinct.
5. The default image size inferred from the resolved layout is included in handoff options when the user did not specify size.

Use the `image-generation` skill for the final rendering step. Provide this handoff data:

- Prompt file: `output/character-stickers/<scenario_filename>-<timestamp>/prompt.txt`
- Reference image: selected reference `handoff_path` as the 1st reference image
- Output image: `output/character-stickers/<scenario_filename>-<timestamp>/image.png`
- Metadata output for real generation: `output/character-stickers/<scenario_filename>-<timestamp>/metadata.json`
- Metadata output for image-generation dry-run validation: `output/character-stickers/<scenario_filename>-<timestamp>/metadata.dry-run.json`
- Provider/model/options: pass through values explicitly requested by the user or inferred by this workflow, including the default image size inferred from the resolved layout when the user did not specify size
- Overwrite/verbosity: pass through only when requested

Write metadata by default through the image-generation handoff. For user-requested dry-run-only workflows, write the prompt and call image-generation in dry-run mode with `metadata.dry-run.json`, then report the image-generation handoff that was validated without calling the provider. For validation dry-runs before real generation, also use `metadata.dry-run.json`; the later real generation must use `metadata.json`.

Do not duplicate the image-generation CLI command in this skill.

## Final Response

Report:

- output image path
- prompt path
- metadata path
- dry-run metadata path when used
- selected group/sheet
- inferred style/layout/size/action/caption
- warnings

If dry-run was used, clearly say image generation was skipped or only validated, depending on the user request.
