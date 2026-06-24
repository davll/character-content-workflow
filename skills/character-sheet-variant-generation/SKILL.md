---
name: character-sheet-variant-generation
description: Generate modified character sheet variants from registered base character sheets while preserving character identity and sheet structure. Use when Codex needs to create outfit variants, visual style variants, or mixed variants of a character sheet by selecting the correct registry sheet, building a variant-specific prompt, and handing off rendering to image-generation.
---
# Character Sheet Variant Generation

Run the character sheet variant workflow in this skill. Use the `character-registry` skill for registry validation, base sheet selection, sheet paths, and prompt-building data. Use the `image-generation` skill for final rendering, dry-run validation, provider behavior, API key handling, and CLI command shape.

This skill is for revising a character reference sheet itself. Unlike illustration workflows, it preserves the base sheet's layout, poses, expressions, character ordering, proportions, camera angle, and plain reference-sheet presentation unless the user explicitly asks to change them.

This skill owns only the orchestration contract:

1. Interpret the user request as a character sheet variant.
2. Select one registry sheet as the 1st reference image.
3. Resolve variant type and normalized variant instructions.
4. Build a variant prompt that preserves base sheet structure and registry identity.
5. Create durable character sheet variant artifacts.
6. Hand off rendering to `image-generation`.

## Defaults

- Registry: `characters/index.yaml`
- Output directory: `output/character-sheet-variants`
- Image provider preference: `openai` unless the user requests another provider
- Image model preference: omit unless requested
- Variant type: infer `outfit`, `style`, or `mixed` from the user prompt
- Response provider/model for reasoning: use your own reasoning unless the user explicitly asks for a separate model call.

## Hard Invariants

Fail before writing the final prompt or generating an image when any invariant cannot be satisfied:

1. The request must contain a non-empty character sheet variant prompt. If a prompt file is supplied, read it and trim whitespace.
2. Registry lookup must go through the `character-registry` skill. Do not parse registry YAML manually for sheet search, sheet paths, or prompt-building data.
3. `character-registry` failures are workflow failures. Report the command error and stop before writing image outputs.
4. The selected base registry sheet must resolve through `get-sheet-path`, exist on disk, and be PNG or JPEG.
5. The selected base sheet must be the only reference image and must be passed as the 1st reference image.
6. The prompt must preserve the base sheet layout, character ordering, poses, expressions, body proportions, camera angle, and reference-sheet presentation unless the user explicitly requests changing one of those elements.
7. The prompt must limit changes to the requested outfit, style, or mixed variant instructions.
8. The prompt's Reference Guide must contain exactly one line for the 1st image.
9. The image-generation handoff must include explicit prompt, output image, reference image, metadata path, and dry-run metadata path when used.
10. The real generation metadata path and dry-run metadata path must be distinct.

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

- `user_prompt`: non-empty request for a modified character sheet.
- `variant_hints`: outfit, costume, uniform, clothing, rendering style, medium, era style, art style, linework, coloring, texture, or mixed changes.
- `handoff_options`: provider, model, size, aspect ratio, resolution, overwrite, dry-run, and verbosity, only when requested or inferred by this workflow.

Reject requests that do not ask for a character sheet variant or do not identify enough character/group context to select a registry sheet.

### Stage 2: Registry Selection

Use `character-registry` to validate the registry and list all registry summaries. Infer the target character or group and selected base sheet from the registry output and the user prompt.

Selection heuristics:

1. Identify the target character or group from character names, aliases, group composition, and sheet summaries.
2. For multi-character sheet variants, prefer a combined group sheet when the registry offers one.
3. Use separate sheets only when no combined group sheet fits the request, and warn that preserving a single original sheet layout may be weaker.
4. Select the most relevant base sheet for the requested variant.
5. Prefer the current or default character sheet unless the prompt references a specific existing outfit, age, era, expression set, or style source.
6. Add warnings for ambiguous character identity, missing combined group sheets, unsupported registry data, requests that conflict with registry constraints, or requested changes that would necessarily alter pose/layout/expression.

Build one canonical selected reference:

```json
{
  "label": "1st image",
  "id": "sheet:<group_id>:<sheet_id>",
  "group_id": "<group id>",
  "sheet_id": "<sheet id>",
  "kind": "registry_sheet",
  "role": "base character sheet identity, layout, and trait reference",
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

If `descriptions.reference_logic` conflicts with this skill's requirement to preserve the original sheet layout, poses, expressions, character ordering, and reference-sheet presentation, ignore the conflicting `reference_logic` content and add a warning.

### Stage 3: Variant Plan

Infer a compact variant plan from the prompt, selected reference, and warnings:

```json
{
  "group_id": "<target group id>",
  "sheet_id": "<selected base sheet id>",
  "variant_type": "outfit | style | mixed",
  "variant_instruction": "<short normalized description of the requested change>",
  "outfit_change": "<normalized outfit portion or null>",
  "style_change": "<normalized style portion or null>",
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

Planning heuristics:

1. Infer `outfit` when the requested change is clothing, costume, armor, uniform, accessories worn as clothing, or dress code.
2. Infer `style` when the requested change is rendering style, medium, era, genre aesthetics, line art, color treatment, texture, pixel art, watercolor, oil painting, manga screentone, 90s anime, or similar visual treatment.
3. Infer `mixed` when both outfit and style changes are requested.
4. For `mixed`, keep outfit and style changes separate in the plan and prompt.
5. Treat requested layout, pose, expression, character ordering, or camera changes as explicit exceptions to the default preservation rule, and warn about the changed preservation scope.
6. Add warnings for ambiguous variant type, broad style terms, conflicting outfit/style requests, or requests that would alter registry-defined identity traits.

### Stage 4: Artifact And Reference Normalization

Create the run directory and reserve artifact paths.

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

With default output directory, reserve these paths:

- Prompt: `output/character-sheet-variants/<scenario_filename>-<timestamp>/prompt.txt`
- Image: `output/character-sheet-variants/<scenario_filename>-<timestamp>/image.png`
- Metadata: `output/character-sheet-variants/<scenario_filename>-<timestamp>/metadata.json`
- Dry-run metadata: `output/character-sheet-variants/<scenario_filename>-<timestamp>/metadata.dry-run.json`

Canonical reference validation:

1. The selected reference ID must match `sheet:<group_id>:<sheet_id>`.
2. The selected reference `handoff_path` must be the path resolved by `get-sheet-path`.
3. The prompt must describe the selected reference as `1st image`.
4. The prompt's Reference Guide must contain exactly one line for the 1st image.
5. The image-generation handoff must pass exactly one reference image, in that same position.

### Stage 5: Prompt Building

Build one final image prompt from the variant plan, selected reference prompt data, and warnings. All templates must preserve the character sheet structure and use the base sheet as the source of truth.

The prompt-building stage may use IDs, labels, roles, targets, descriptions, sheet summaries, and prompt-building data, but must not mention local filesystem paths.

#### Registry Prompt-Building Fidelity

Treat registry `prompt_building.descriptions`, `constraints`, and `system_instructions` as source-of-truth semantic content.

The prompt builder may reorganize wording for readability, merge duplicate ideas, and adapt phrasing into the final prompt structure, but must not weaken, omit, sanitize, generalize, or contradict registry-provided character facts, outfit details, body traits, identity details, relationship logic, or constraints.

If a registry description is explicit, preserve its explicitness unless it directly conflicts with a higher-priority safety policy, the user's explicit variant request, or another registry constraint. In that case, add a warning explaining which registry text was changed and why.

Shared header:

```text
Create a revised character reference sheet based on the 1st input image.

Preserve the exact character sheet format, canvas composition, character ordering, standing positions, pose silhouettes, facial expressions, body proportions, camera angle, and plain reference-sheet presentation from the 1st image.

The 1st image is the source of truth for character identity, face shapes, hairstyles, skin tones, body types, height relationships, proportions, and stable character-specific details.
```

Outfit variant template:

```text
Variant Type: Outfit variant.
Requested Change: <variant_instruction>

Only change the requested clothing, costume, uniform, or worn accessories. Preserve the characters' faces, hairstyles, bodies, expressions, pose silhouettes, layout, rendering style, and reference-sheet presentation.

For multi-character sheets, assign outfit changes explicitly to each character. Do not swap outfits, colors, accessories, body traits, or identities between characters.
```

Style variant template:

```text
Variant Type: Style variant.
Requested Change: <variant_instruction>

Only change the visual rendering style, medium, line quality, color treatment, texture, or era aesthetic requested by the user. Preserve the character designs, outfits, accessories, faces, hairstyles, bodies, expressions, pose silhouettes, layout, and reference-sheet presentation.

Do not redesign clothing, props, anatomy, facial features, hairstyles, or character proportions unless the user explicitly requested that as part of the style.
```

Mixed variant template:

```text
Variant Type: Mixed outfit and style variant.
Outfit Change: <normalized outfit portion>
Style Change: <normalized style portion>

Apply only the requested outfit changes and requested visual style changes. Preserve all other identity, design, layout, pose, expression, and proportion details from the 1st image.

For multi-character sheets, keep each character's requested outfit and identity separate. Do not let the style change alter character design or outfit ownership.
```

Registry data section:

```text
Base Sheet Description:
<sheet summary>

Character Traits:
- <flattened registry descriptions relevant to identity and stable traits>

Visual Constraints:
- <each registry constraint, rewritten as a preservation requirement>

Character Instructions:
- <each relevant registry system instruction>

Reference Guide:
1st image: ONLY for the base character sheet identity, exact sheet layout, character ordering, poses, expressions, proportions, outfit ownership, and stable visual traits. Preserve these details except for the explicitly requested variant changes.
```

Prompt invariants:

1. Preserve the sheet layout by default. This is a feature, not a mistake, for character sheet variant generation.
2. The selected registry sheet is the source of truth for character identity, outfit ownership, proportions, stable physical traits, and sheet structure.
3. Use the 1st image only for base sheet identity, exact sheet layout, character ordering, poses, expressions, proportions, outfit ownership, and stable visual traits.
4. Use the minimal description principle only to avoid unnecessary duplication, not to remove registry facts.
5. Registry constraints take precedence over generic style or outfit language. If a constraint defines height, skin tone contrast, outfit ownership, body type, or relationship logic, explicitly preserve it.
6. For multi-character sheets, name each character and specify which requested change applies to that character.
7. Prevent feature bleeding by saying which character owns which outfit, accessory, color, body trait, and position when the sheet includes more than one character.
8. Do not add a scene, background, action, dramatic camera angle, sticker styling, or illustration-only composition unless the user explicitly asks for it.
9. Do not mention registry commands, local paths, or internal inference.
10. The Reference Guide must contain exactly one line for the 1st image unless future workflow changes add more references.
11. If any registry `prompt_building.descriptions` item is omitted, softened, generalized, or materially rephrased, record a warning in the workflow output explaining the original registry text, the changed prompt text, and the reason.
12. Do not add unsolicited softening, sanitizing, or tone-limiting language such as "non-explicit", "not eroticized", "suitable", "tasteful", or equivalent wording when the user did not request it and no higher-priority safety policy requires it. If such a policy-based change is required, keep the change as narrow as possible and record a warning explaining the exact registry or user-prompt wording that was changed.

### Stage 6: Handoff And Final Report

Before handing off, perform a final alignment check:

1. The prompt's Reference Guide has exactly one entry for the 1st image.
2. The image-generation handoff passes exactly one reference image.
3. The reference path passed to image-generation is the selected reference `handoff_path`.
4. No guide line exists in the prompt unless its matching reference path is passed to image-generation.
5. No reference path is passed to image-generation unless its matching guide line exists in the prompt.
6. The real generation metadata path and dry-run metadata path are distinct.

Use the `image-generation` skill for the final rendering step. Provide this handoff data:

- Prompt file: `output/character-sheet-variants/<scenario_filename>-<timestamp>/prompt.txt`
- Reference image: selected reference `handoff_path` as the 1st reference image
- Output image: `output/character-sheet-variants/<scenario_filename>-<timestamp>/image.png`
- Metadata output for real generation: `output/character-sheet-variants/<scenario_filename>-<timestamp>/metadata.json`
- Metadata output for image-generation dry-run validation: `output/character-sheet-variants/<scenario_filename>-<timestamp>/metadata.dry-run.json`
- Provider/model/options: pass through values explicitly requested by the user or inferred by this workflow
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
- variant type
- variant instruction
- selected template
- reference order
- warnings

If dry-run was used, clearly say image generation was skipped or only validated, depending on the user request.
