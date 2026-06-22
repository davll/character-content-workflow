---
name: character-sheet-variant-generation
description: Generate modified character sheet variants from registered base character sheets while preserving character identity and sheet structure. Use when Codex needs to create outfit variants, visual style variants, or mixed variants of a character sheet by selecting the correct registry sheet, building a variant-specific prompt, and handing off rendering to image-generation.
---
# Character Sheet Variant Generation

Run the character sheet variant workflow directly in this skill. Use the `character-registry` skill to query base character sheets and prompt-building data. Use the `image-generation` skill for the final rendering step; do not duplicate either skill's CLI command details here.

This skill is for revising a character reference sheet itself. Unlike illustration workflows, the prompt should preserve the base sheet's layout, poses, expressions, character ordering, proportions, and plain reference-sheet presentation unless the user explicitly asks to change them.

## Defaults

- Registry: `characters/index.yaml`
- Output directory: `output/character-sheet-variants`
- Image provider preference: `openai` unless the user requests another provider
- Image model preference: omit unless requested
- Variant type: infer `outfit`, `style`, or `mixed` from the user prompt
- Response provider/model for reasoning: use your own reasoning unless the user explicitly asks for a separate model call

## Registry Lookup

Resolve the registry path before calling `character-registry`:

1. Use an explicit user-provided registry path when supplied.
2. Otherwise use `characters/index.yaml` when it exists.
3. Otherwise, when running inside this skill development repository, use `examples/characters/index.yaml` when it exists.
4. Create `characters/index.yaml` through the `character-registry` first-use workflow only when no usable registry candidate exists.

Do not parse the selected registry YAML manually for sheet search or prompt-building data. Use the `character-registry` skill for validation, registry listing, sheet path resolution, and prompt-building data.

Treat character-registry failures as workflow failures. Report the error and stop before writing image outputs. If the registry path is overridden, pass that path through every registry lookup.

## Inputs

Resolve the request into:

- `user_prompt`: non-empty request for a modified character sheet. If a prompt file is supplied, read it and trim whitespace.
- Optional variant hints: outfit, costume, uniform, clothing, rendering style, medium, era style, art style, linework, coloring, texture, or mixed changes.
- Optional image handoff preferences: provider, model, size, aspect ratio, resolution, overwrite, dry-run, and verbosity.

Reject empty prompts.

## Stage 1: Variant Inference

Use the `character-registry` skill to validate the registry, then list all registry summaries. Infer structured variant parameters from that output and the user prompt:

```json
{
  "group_id": "<target group id>",
  "sheet_id": "<selected base sheet id>",
  "variant_type": "outfit | style | mixed",
  "variant_instruction": "<short normalized description of the requested change>",
  "preserve": [
    "character identity",
    "base sheet layout",
    "character ordering",
    "poses",
    "facial expressions",
    "body proportions"
  ],
  "reason": "<why this group/sheet and variant type were selected>",
  "warnings": []
}
```

Inference rules:

1. Identify the target character or group from character names, aliases, group composition, and sheet descriptions returned by `character-registry list-all`.
2. For multi-character sheet variants, prefer a combined group sheet when the registry offers one. Use separate sheets only when no combined group sheet fits the request, and warn that preserving a single original sheet layout may be weaker.
3. Select the most relevant base sheet for the requested variant. Prefer the current or default character sheet unless the prompt references a specific existing outfit, age, era, expression set, or style source.
4. Infer `outfit` when the requested change is clothing, costume, armor, uniform, accessories worn as clothing, or dress code.
5. Infer `style` when the requested change is rendering style, medium, era, genre aesthetics, line art, color treatment, texture, pixel art, watercolor, oil painting, manga screentone, 90s anime, or similar visual treatment.
6. Infer `mixed` when both outfit and style changes are requested. Keep the two change lists separate in the prompt.
7. Add warnings for ambiguous character identity, missing combined group sheets, requests that conflict with registry constraints, or requested changes that would necessarily alter pose/layout/expression.

After inference, verify the selected sheet with `get-sheet-path`. Fail before generation if the command fails, the selected sheet path does not exist, or the file is not a PNG/JPEG.

## Stage 2: Reference Resolution

Use `get-sheet-path` as the selected base sheet reference image path. Use `get-sheet-info` to load the selected sheet's prompt-building data:

- sheet description
- `prompt_building.segments`
- `prompt_building.constraints`
- `prompt_building.system_instructions`

The base sheet is always the 1st reference image. Keep local file paths out of the final prompt; refer to it only as the `1st image`.

## Stage 3: Prompt Building

Build one final image prompt from the selected template. All templates must preserve the character sheet structure and use the base sheet as the source of truth.

### Shared Header

Start every prompt with:

```text
Create a revised character reference sheet based on the 1st input image.

Preserve the exact character sheet format, canvas composition, character ordering, standing positions, pose silhouettes, facial expressions, body proportions, camera angle, and plain reference-sheet presentation from the 1st image.

The 1st image is the source of truth for character identity, face shapes, hairstyles, skin tones, body types, height relationships, proportions, and stable character-specific details.
```

### Outfit Variant Template

Use this section for `outfit` variants:

```text
Variant Type: Outfit variant.
Requested Change: <variant_instruction>

Only change the requested clothing, costume, uniform, or worn accessories. Preserve the characters' faces, hairstyles, bodies, expressions, pose silhouettes, layout, rendering style, and reference-sheet presentation.

For multi-character sheets, assign outfit changes explicitly to each character. Do not swap outfits, colors, accessories, body traits, or identities between characters.
```

### Style Variant Template

Use this section for `style` variants:

```text
Variant Type: Style variant.
Requested Change: <variant_instruction>

Only change the visual rendering style, medium, line quality, color treatment, texture, or era aesthetic requested by the user. Preserve the character designs, outfits, accessories, faces, hairstyles, bodies, expressions, pose silhouettes, layout, and reference-sheet presentation.

Do not redesign clothing, props, anatomy, facial features, hairstyles, or character proportions unless the user explicitly requested that as part of the style.
```

### Mixed Variant Template

Use this section for `mixed` variants:

```text
Variant Type: Mixed outfit and style variant.
Outfit Change: <normalized outfit portion>
Style Change: <normalized style portion>

Apply only the requested outfit changes and requested visual style changes. Preserve all other identity, design, layout, pose, expression, and proportion details from the 1st image.

For multi-character sheets, keep each character's requested outfit and identity separate. Do not let the style change alter character design or outfit ownership.
```

### Registry Data

Append registry-derived information after the selected template:

```text
Base Sheet Description:
<sheet description>

Character Traits:
- <flattened registry segments relevant to identity and stable traits>

Visual Constraints:
- <each registry constraint, rewritten as a preservation requirement>

Character Instructions:
- <each relevant registry system instruction>

Reference Guide:
1st image: ONLY for the base character sheet identity, exact sheet layout, character ordering, poses, expressions, proportions, outfit ownership, and stable visual traits. Preserve these details except for the explicitly requested variant changes.
```

Prompt-building rules:

1. Preserve the sheet layout by default. This is a feature, not a mistake, for character sheet variant generation.
2. Use the minimal description principle: rely on the 1st image for stable visual details and repeat only details needed by registry constraints or the requested variant.
3. Constraints take precedence over generic style or outfit language. If a registry constraint defines height, skin tone contrast, outfit ownership, body type, or relationship logic, explicitly preserve it.
4. For multi-character sheets, name each character and specify which requested change applies to that character.
5. Prevent feature bleeding by saying which character owns which outfit, accessory, color, body trait, and position when the sheet includes more than one character.
6. Do not add a scene, background, action, dramatic camera angle, sticker styling, or illustration-only composition unless the user explicitly asks for it.
7. Do not mention registry commands, local file paths, or internal inference in the final prompt.
8. The Reference Guide must contain exactly one line for the 1st image unless future workflow changes add more references.

## Stage 4: Artifact Paths

Create a timestamp in this shape:

```text
YYYY-MM-DD_HH-MM-SS
```

Infer a concise scenario filename from the selected group, variant type, and requested change, such as:

```text
<group_id>_<variant_type>_<sanitized_variant_instruction>
```

Sanitize the scenario filename by lowercasing, replacing non-ASCII letters or digits with `_`, collapsing repeated `_`, trimming leading/trailing `_`, and limiting it to 90 characters.

Create the run directory:

```text
OUTPUT_DIR/<scenario_filename>-<timestamp>
```

With default output directory, write:

- Prompt: `output/character-sheet-variants/<scenario_filename>-<timestamp>/prompt.txt`
- Image: `output/character-sheet-variants/<scenario_filename>-<timestamp>/image.png`
- Metadata: `output/character-sheet-variants/<scenario_filename>-<timestamp>/metadata.json`
- Dry-run metadata: `output/character-sheet-variants/<scenario_filename>-<timestamp>/metadata.dry-run.json`

Write metadata by default through the image-generation handoff. The metadata path must be explicit; do not rely on image-generation to infer a metadata path. For dry runs, write the prompt in the run directory and use image-generation dry-run metadata to record the skipped generation request.

When validating with image-generation dry-run before real generation, use `metadata.dry-run.json` for the dry-run handoff and reserve `metadata.json` for the real generation handoff. Do not reuse the real metadata path for dry-run, because the generated dry-run metadata would block the later real generation unless overwrite was requested.

## Stage 5: Image Generation Handoff

Use the `image-generation` skill for the final rendering step. Provide it this handoff data:

- Prompt file: `output/character-sheet-variants/<scenario_filename>-<timestamp>/prompt.txt`
- Reference image: `<selected_base_sheet_path>` as the 1st reference image
- Output image: `output/character-sheet-variants/<scenario_filename>-<timestamp>/image.png`
- Metadata output for real generation: `output/character-sheet-variants/<scenario_filename>-<timestamp>/metadata.json`
- Metadata output for image-generation dry-run validation: `output/character-sheet-variants/<scenario_filename>-<timestamp>/metadata.dry-run.json`
- Provider/model/options: pass through values explicitly requested by the user or inferred by this workflow
- Overwrite/verbosity: pass through `--force` and `--verbose` only when requested

Before handing off, perform a final sequence alignment check:

1. The prompt's Reference Guide has exactly one entry for the 1st image.
2. The selected base sheet path is the only reference path passed to image-generation.
3. No guide line exists in the prompt unless its matching reference path is passed to image-generation.
4. No reference path is passed to image-generation unless its matching guide line exists in the prompt.

Do not duplicate the image-generation CLI command in this skill. Let the `image-generation` skill decide the exact command shape, provider API key handling, dry-run behavior, and current supported provider details. The handoff must include the explicit metadata output path so image-generation passes `--metadata`.

For user-requested dry-run-only workflows, write the prompt and call image-generation in dry-run mode with `metadata.dry-run.json`, then report the image-generation handoff that was validated without calling the provider. For validation dry-runs before real generation, also use `metadata.dry-run.json`; the later real generation must use `metadata.json`.

## Final Response

Report the output image path, prompt path, metadata path, selected group/sheet, variant type, variant instruction, selected template, reference order, and warnings. If dry-run was used, clearly say image generation was skipped.
