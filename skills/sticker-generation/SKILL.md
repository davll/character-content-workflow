---
name: sticker-generation
description: Generate chat-style stickers, LINE stickers, Telegram stickers, reaction stickers, chibi stickers, sticker grids, or sticker sheets of a registered character while maintaining character consistency. Use when Codex needs to infer a character sheet from the registry, build sticker prompts and artifact paths, then hand off final rendering to the image-generation skill.
---
# Sticker Generation

Run the sticker workflow directly in this skill. Use the `character-registry` skill to query character sheets and prompt-building data. Use the `image-generation` skill for the final rendering step; do not duplicate either skill's CLI command details here.

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
  - `2x2`: `1024x1024`
  - `4x4`: `2048x2048`
- Response provider/model for reasoning: use your own reasoning unless the user explicitly asks for a separate model call. The original workflow used OpenAI `gpt-5.4-mini`.

## Registry Lookup

Do not parse `characters/index.yaml` manually for sheet search or prompt-building data. Use the `character-registry` skill for validation, registry listing, sheet path resolution, and prompt-building data.

Treat character-registry failures as workflow failures. Report the error and stop before writing image outputs. If the registry path is overridden, pass that path through every registry lookup.

## Inputs

Resolve the request into:

- `user_prompt`: non-empty sticker request. If a prompt file is supplied, read it and trim whitespace.
- Optional `requested_layout`: must match `single` or an `MxN` grid such as `1x1`, `2x1`, `2x2`, or `4x4`.
- Optional image handoff preferences: provider, model, size, aspect ratio, resolution, overwrite, dry-run, and verbosity.

Reject empty prompts. Treat `single` and `1x1` as single-sticker layouts. If the user does not provide image size, infer it from the resolved layout using the image size defaults.

## Stage 1: Sticker Inference

Use the `character-registry` skill to validate the registry, then list all registry summaries. Infer structured sticker parameters from that output:

```json
{
  "group_id": "<target group id>",
  "sheet_id": "<selected sheet id>",
  "style": "chibi | standard",
  "layout": "1x1 | 2x1 | 2x2 | 4x4 | other MxN",
  "action": "<core action or expression>",
  "caption": "<caption text or null>",
  "reason": "<why this group/sheet was selected>",
  "warnings": []
}
```

Inference rules:

1. Identify the target character group from character names, group composition, and sheet descriptions returned by `character-registry list-all`.
2. Select a suitable dressed/outfit sheet for stickers from the listed sheets. Avoid base/naked/minimal sheets unless the user explicitly requests them or no dressed sheet exists.
3. Prefer explicit prompt keywords for character, outfit, action, style, and caption.
4. Choose `chibi` for cute, SD, mascot, LINE-like, exaggerated, or chibi requests. Choose `standard` for normal anime proportions or when the user explicitly asks for standard style.
5. Infer whether the user wants a single sticker or a matrix/grid. Use `1x1` for prompts asking for "a sticker", "reaction", or one emotion/action. Use `4x4` for prompts asking for a "set", "various", "sticker sheet", or "random reactions". For other broad themes, infer the most appropriate layout from the request and report the inferred layout in the final response.
6. If `requested_layout` is provided, use that exact layout after inference and adapt the action/expression set to fit it.
7. Extract caption text only when the user requests visible sticker text. Otherwise use `null`.
8. Add warnings for ambiguous character identity, missing dressed sheets, or layout/action conflicts.

After inference, verify the selected sheet by running `get-sheet-path`. Fail before generation if the command fails, the selected sheet path does not exist, or the file is not a PNG/JPEG.

## Stage 2: Prompt Building

Use `get-sheet-path` as the selected reference image path. Use `get-sheet-info` to load the selected sheet's prompt-building data:

- sheet description
- `prompt_building.segments`
- `prompt_building.constraints`
- `prompt_building.system_instructions`

Build the prompt deterministically with the selected sheet as the 1st reference image.

Start with one of these headers:

```text
Generate a chibi chat sticker featuring the character from the 1st input image.
```

```text
Generate a chat sticker featuring the character from the 1st input image.
```

For matrix layouts other than `single`/`1x1`, replace the header with:

```text
Generate a sticker sheet matrix featuring the character from the 1st input image.
```

Then append:

```text
Character Description: <sheet/group description and key registry character description>
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
- <flattened registry segments>

Character Instructions (from registry):
- <each registry system instruction>
```

Use this style rule for `chibi`:

```text
A cute, high-quality chibi/SD (super-deformed) anime sticker, with a large head, small body, exaggerated facial expression, and dynamic posing.
```

Use this style rule for `standard`:

```text
A high-quality digital anime sticker in the character's original proportion and style, featuring an exaggerated facial expression and dynamic posing.
```

For matrix layouts, normalize `single` to `1x1` and any legacy `matrix_MxN` wording to `MxN`, then add:

```text
- Layout: Must be arranged in a clean, symmetric <MxN> grid of individual stickers, separated by white space.
- Consistency: Ensure the character's features, colors, and outfit design are perfectly consistent across all grid cells.
```

Do not add a separate reference-guide section for stickers; the prompt embeds the 1st-image rule in the constraints.

## Stage 3: Artifact Paths

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

With default output directory, write:

- Prompt: `output/character-stickers/<scenario_filename>-<timestamp>/prompt.txt`
- Image: `output/character-stickers/<scenario_filename>-<timestamp>/image.png`

Do not write a manifest or any extra metadata artifact. For dry runs, write the prompt in the run directory and skip image generation.

## Stage 4: Image Generation Handoff

Use the `image-generation` skill for the final rendering step. Provide it this handoff data:

- Prompt file: `output/character-stickers/<scenario_filename>-<timestamp>/prompt.txt`
- Reference image: `<selected_sheet_path>` as the 1st reference image
- Output image: `output/character-stickers/<scenario_filename>-<timestamp>/image.png`
- Provider/model/options: pass through values explicitly requested by the user or inferred by this workflow, including the default image size inferred from the resolved layout when the user did not specify size
- Overwrite/verbosity: pass through `--force` and `--verbose` only when requested

Do not duplicate the image-generation CLI command in this skill. Let the `image-generation` skill decide the exact command shape, provider API key handling, dry-run behavior, and current supported provider details.

For dry runs, write the prompt and report the image-generation handoff that would be made, but do not call the provider.

## Final Response

Report the output image path, prompt path, selected group/sheet, inferred style/layout/size/action/caption, and warnings. If dry-run was used, clearly say image generation was skipped.
