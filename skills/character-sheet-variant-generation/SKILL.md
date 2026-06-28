---
name: character-sheet-variant-generation
description: Generate modified character sheet variants from registered base character sheets while preserving character identity and sheet structure. Use when Codex needs to create outfit, visual style, pose, object/prop, or mixed variants of a character sheet by selecting the correct registry sheet, building a variant-specific prompt, and handing off rendering to image-generation.
---
# Character Sheet Variant Generation

Run the character sheet variant workflow in this skill. Use the `character-registry` skill for registry validation, base sheet selection, sheet paths, and prompt-building data. Use the `object-registry` skill only for object-aware variants that need registered prop/object selection, usage guidance, or object reference image paths. Use the `image-generation` skill for final rendering, dry-run validation, provider behavior, API key handling, and CLI command shape.

This skill is for revising a character reference sheet itself. Unlike illustration workflows, it preserves the base sheet's layout, poses, expressions, character ordering, proportions, camera angle, and plain reference-sheet presentation unless the user explicitly asks to change them.

This skill owns only the orchestration contract:

1. Interpret the user request as a character sheet variant.
2. Select one registry sheet as the 1st reference image.
3. Resolve registered objects/props when the requested variant needs object-aware guidance.
4. Resolve variant type and normalized variant instructions.
5. Build a variant prompt that preserves base sheet structure and registry identity.
6. Create durable character sheet variant artifacts.
7. Hand off rendering to `image-generation`.

## Defaults

- Registry: `characters/index.yaml`
- Object registry: `objects/index.yaml`, only when the request explicitly needs registered object handling
- Output directory: `output/character-sheet-variants`
- Image provider preference: `openai` unless the user requests another provider
- Image model preference: omit unless requested
- Variant type: infer `outfit`, `style`, `pose`, `object`, or `mixed` from the user prompt
- Response provider/model for reasoning: use your own reasoning unless the user explicitly asks for a separate model call.

## Hard Invariants

Fail before writing the final prompt or generating an image when any invariant cannot be satisfied:

1. The request must contain a non-empty character sheet variant prompt. If a prompt file is supplied, read it and trim whitespace.
2. Registry lookup must go through the `character-registry` skill. Do not parse registry YAML manually for sheet search, sheet paths, or prompt-building data.
3. `character-registry` failures are workflow failures. Report the command error and stop before writing image outputs.
4. The selected base registry sheet must resolve through `get-sheet-path`, exist on disk, and be PNG or JPEG.
5. Object lookup for registered objects must go through the `object-registry` skill. Do not parse object registry YAML manually for object search, reference paths, or prompt-building data.
6. When the user explicitly requests a registered object, `object-registry` validation, selected object info, and selected reference resolution failures are workflow failures. Report the command error and stop before writing image outputs.
7. When the request merely contains object-like text but does not explicitly require a registered object, missing object registry data or low-confidence matching should degrade to plain prompt text with a warning.
8. The selected base sheet must always be passed as the 1st reference image.
9. Additional reference images may follow the base sheet for any variant type when the user supplies or requests reference guidance such as clothing design, fabric material, visual style, pose, held-object, equipment, weapon, camera, or prop guidance. Each additional reference must have a declared role and must not override character identity, outfit ownership, body traits, or sheet structure beyond the requested variant change.
10. For variants without additional reference guidance, the selected base sheet remains the only reference image.
11. Object reference images may be passed only when resolved through `object-registry get-reference-path`, must exist on disk, and must be PNG or JPEG.
12. The prompt must preserve the base sheet layout, character ordering, poses, expressions, body proportions, camera angle, and reference-sheet presentation unless the user explicitly requests changing one of those elements.
13. The prompt must limit changes to the requested outfit, style, pose, object, or mixed variant instructions.
14. The prompt's Reference Guide must contain exactly one line for each reference image passed to image-generation.
15. The image-generation handoff must include explicit prompt, output image, reference image path or paths, metadata path, and dry-run metadata path when used.
16. The real generation metadata path and dry-run metadata path must be distinct.

## Registry Resolution

Resolve the registry path before calling `character-registry`:

1. Use an explicit user-provided registry path when supplied.
2. Otherwise use `characters/index.yaml` when it exists.
3. Otherwise, when running inside this skill development repository, use `examples/characters/index.yaml` when it exists.
4. Create `characters/index.yaml` through the `character-registry` first-use workflow only when no usable registry candidate exists.

If the registry path is overridden, pass that path through every registry lookup.

## Object Registry Resolution

Resolve the object registry path only when the request explicitly needs registered object handling:

1. Use an explicit user-provided object registry path when supplied.
2. Otherwise use `objects/index.yaml` when it exists.
3. Otherwise, when running inside this skill development repository, use `examples/objects/index.yaml` when it exists. This is a development fixture fallback only.
4. If no object registry exists, skip object enrichment with a warning unless the user explicitly asked to create or use registered objects.

If the object registry path is overridden, pass that path through every object registry lookup.

## Workflow

### Stage 1: Request Intake

Resolve the request into:

- `user_prompt`: non-empty request for a modified character sheet.
- `variant_hints`: outfit, costume, uniform, clothing, rendering style, medium, era style, art style, linework, coloring, texture, pose, hand placement, held object, weapon, camera, prop, equipment, or mixed changes.
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

### Stage 3: Object Resolution

Run this stage only when the request is likely to produce an `object` variant or a `mixed` variant with object changes, or when the user explicitly says to use a registered object/prop. Otherwise skip this stage.

Use `object-registry` to validate the object registry, list or search searchable object summaries, and resolve object mentions from the user prompt after character sheet selection and before variant planning.

Detection rules:

1. Treat phrases such as `registered object`, `registered prop`, `from object-registry`, or an explicit object ID as an explicit registered-object request.
2. Match object aliases from `list-all` or `search` against object mentions in the user prompt. Alias matching should handle localized names when present in registry `names`.
3. Confirm each selected object with `get-object-info`.
4. Bind objects to characters when the prompt clearly says forms such as `<character> holds <object>`, `<character> has <object>`, `<character> carrying <object>`, `<character> wearing <object>`, or localized equivalents such as `<character> 拿著 <object>`.
5. Warn but continue when object ownership is ambiguous.
6. Warn but continue when the prompt contains object-like text but no registry object matches, unless the user explicitly requested a registered object.

Usage inference:

1. `holding`, `walking with`, `carrying`, `拿著` -> `carrying`.
2. `taking a photo`, `shooting`, `aiming camera` -> `shooting`.
3. `around neck`, `hanging from neck` -> `around_neck`.
4. `equipped`, `wearing`, `strapped`, `holstered` -> the closest matching registry usage profile.
5. Use `carrying` as the default when an object is held but no active use is stated.
6. Warn but continue when usage confidence is low or the inferred usage profile is absent.

Object plan shape:

```json
{
  "selected_objects": [
    {
      "id": "object:<object_id>",
      "object_id": "<object id>",
      "target_character": "<bound character or null>",
      "usage_mode": "<usage profile name or null>",
      "role": "registered object design and handling reference",
      "confidence": 0.0,
      "reason": "<why this object was selected and how usage was inferred>",
      "prompt_data": "<object-registry get-object-info output>",
      "reference_id": "<selected reference image id or null>",
      "handoff_path": "<resolved reference path or null>"
    }
  ],
  "warnings": []
}
```

Object prompt data may describe object design, accessories, scale, and handling posture, but it must not override character identity, outfit ownership, body traits, skin tone, relationship logic, or base sheet structure. If an object reference image is used, resolve it with `object-registry get-reference-path`.

### Stage 4: Variant Plan

Infer a compact variant plan from the prompt, selected reference, selected objects, and warnings:

```json
{
  "group_id": "<target group id>",
  "sheet_id": "<selected base sheet id>",
  "variant_type": "outfit | style | pose | object | mixed",
  "variant_instruction": "<short normalized description of the requested change>",
  "outfit_change": "<normalized outfit portion or null>",
  "style_change": "<normalized style portion or null>",
  "pose_change": "<normalized pose, gesture, hand placement, or body-orientation portion or null>",
  "object_change": "<normalized object, prop, weapon, camera, or equipment portion or null>",
  "selected_objects": [
    {
      "id": "object:<object_id>",
      "object_id": "<object id>",
      "target_character": "<bound character or null>",
      "usage_mode": "<usage profile name or null>",
      "role": "registered object design and handling reference",
      "prompt_data": "<object-registry get-object-info output>"
    }
  ],
  "additional_references": [
    {
      "label": "<2nd image or later>",
      "kind": "outfit | material | pose | object | style | external | other",
      "role": "<narrow reference role>",
      "target": "<object, prop, pose, or style target>",
      "handoff_path": "<resolved reference path>"
    }
  ],
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
3. Infer `pose` when the requested change is pose silhouette, gesture, hand placement, body orientation, expression set, action stance, or camera-facing body angle.
4. Infer `object` when the requested change adds, removes, or revises a visible prop, weapon, camera, equipment item, instrument, bag, vehicle, or other held/worn/carried object that is not simply clothing.
5. Infer `mixed` when more than one variant category is requested, such as outfit plus style, pose plus object, or style plus object.
6. For `mixed`, keep outfit, style, pose, and object changes separate in the plan and prompt.
7. Treat requested layout, pose, expression, character ordering, or camera changes as explicit exceptions to the default preservation rule, and warn about the changed preservation scope.
8. Add warnings for ambiguous variant type, broad style terms, conflicting variant requests, unclear object identity, unsupported reference images, or requests that would alter registry-defined identity traits.

### Stage 5: Artifact And Reference Normalization

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
4. Every passed reference image must have exactly one matching Reference Guide line in the same order.
5. Additional references must be ordered after the base sheet and must be limited to their declared roles, such as clothing design, fabric material, pose mechanics, held-object design, object scale, equipment silhouette, or visual style treatment.
6. Variants without additional reference guidance should pass only the selected base sheet as the 1st reference image.
7. Every object reference ID must match `object:<object_id>:<reference_id>`.
8. Every object reference path must resolve through `object-registry get-reference-path`.

### Stage 6: Prompt Building

Build one final image prompt from the variant plan, selected reference prompt data, selected object prompt data, and warnings. All templates must preserve the character sheet structure and use the base sheet as the source of truth.

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
Variant Type: Mixed variant.
Outfit Change: <normalized outfit portion or null>
Style Change: <normalized style portion or null>
Pose Change: <normalized pose portion or null>
Object Change: <normalized object portion or null>

Apply only the requested outfit, style, pose, and object changes. Preserve all other identity, design, layout, expression, and proportion details from the 1st image.

For multi-character sheets, keep each character's requested changes and identity separate. Do not let a style, pose, or object change alter character design, outfit ownership, anatomy, or unrelated character-specific traits.
```

Pose variant template:

```text
Variant Type: Pose variant.
Requested Change: <variant_instruction>

Only change the requested pose silhouettes, gestures, hand placement, body orientation, expression set, or stance. Preserve the characters' identities, outfits, body proportions, rendering style, base sheet format, character ordering, and reference-sheet presentation unless the user explicitly requested a layout change.

If the pose change requires moving hands, arms, legs, hair, clothing folds, or carried accessories, adapt only those details needed to support the requested pose.
```

Object variant template:

```text
Variant Type: Object/prop variant.
Requested Change: <variant_instruction>

Only add, remove, or revise the requested visible object, prop, weapon, camera, equipment item, instrument, bag, vehicle, or held/carried accessory. Preserve the characters' identities, faces, hairstyles, bodies, outfits, rendering style, base sheet format, character ordering, and reference-sheet presentation unless the requested object interaction requires a minimal pose or hand-placement change.

Bind each object to the intended character, body side, hand, carrying posture, scale, and visible placement. Do not let object details alter character identity, outfit ownership, anatomy, or unrelated design elements.
```

Object guidance section, only when registered objects were selected:

```text
Object and Prop Handling:
<object-registry-derived object design, accessories, scale, usage profile guidance, constraints, and character/object bindings>
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
<2nd image and later, only when additional references are passed>: ONLY for the declared reference role, such as clothing design, fabric material, pose mechanics, object design, object scale, equipment silhouette, or visual style treatment. Do not copy unrelated character identity, clothing ownership, background, lighting, composition, labels, or artifacts.
```

Prompt invariants:

1. Preserve the sheet layout by default. This is a feature, not a mistake, for character sheet variant generation.
2. The selected registry sheet is the source of truth for character identity, outfit ownership, proportions, stable physical traits, and sheet structure.
3. Use the 1st image only for base sheet identity, exact sheet layout, character ordering, poses, expressions, proportions, outfit ownership, and stable visual traits.
4. Use the minimal description principle only to avoid unnecessary duplication, not to remove registry facts.
5. Registry constraints take precedence over generic style or outfit language. If a constraint defines height, skin tone contrast, outfit ownership, body type, or relationship logic, explicitly preserve it.
6. For multi-character sheets, name each character and specify which requested change applies to that character.
7. Prevent feature bleeding by saying which character owns which outfit, accessory, color, body trait, and position when the sheet includes more than one character.
8. Do not add a scene, background, dramatic camera angle, sticker styling, or illustration-only composition unless the user explicitly asks for it. Pose or object variants may add only the minimal action language needed to describe the requested sheet pose or object interaction.
9. Do not mention registry commands, local paths, or internal inference.
10. The Reference Guide must contain exactly one line per passed reference image, in order, and each line must narrowly limit that reference to its declared role.
11. Additional references may guide outfit cut, garment construction, fabric material, rendering style, pose mechanics, or object design, but they must not override character identity, outfit ownership, body traits, or unrelated sheet structure.
12. Object registry references supplement object design only through their declared role. They must not override character identity, outfit, base sheet structure, or unrelated pose/layout details.
13. Bind each selected object to the correct character when ownership is clear. State the bound character, object name, usage mode, scale, and placement in the prompt.
14. If a selected object has constraints or usage profile guidance, preserve those details unless they conflict with character-registry constraints or the user's explicit variant request.
15. If any registry `prompt_building.descriptions` item is omitted, softened, generalized, or materially rephrased, record a warning in the workflow output explaining the original registry text, the changed prompt text, and the reason.
16. Do not add unsolicited softening, sanitizing, or tone-limiting language such as "non-explicit", "not eroticized", "suitable", "tasteful", or equivalent wording when the user did not request it and no higher-priority safety policy requires it. If such a policy-based change is required, keep the change as narrow as possible and record a warning explaining the exact registry or user-prompt wording that was changed.

Reference guide role formats:

- Character registry sheet: `<Nth> image: ONLY for <character or group>'s base character sheet identity, exact sheet layout, character ordering, poses, expressions, proportions, outfit ownership, and stable visual traits. Preserve these details except for the explicitly requested variant changes.`
- Outfit/clothing reference: `<Nth> image: ONLY for the requested garment design, silhouette, construction, closures, layering, pattern placement, or accessory details. Do not copy character identity, body traits, pose, background, labels, or unrelated clothing ownership.`
- Material reference: `<Nth> image: ONLY for fabric/material texture, surface finish, weave, sheen, translucency, color behavior, or pattern treatment. Do not copy object identity, garment shape, character identity, pose, background, labels, or composition.`
- Object registry reference: `<Nth> image: ONLY for <target object>'s object design, scale, silhouette, materials, visible mechanisms, accessories, and registered reference usage. Do not copy background, lighting, hands, pose, unrelated objects, character identity, or clothing.`
- Pose/interaction image: `<Nth> image: ONLY for pose mechanics, body positioning, physical interaction, or hand placement. Do not copy character identity, outfit, background, or unrelated objects.`
- Style image: `<Nth> image: ONLY for broad rendering style, line quality, color mood, or lighting treatment. Do not copy characters, clothing, objects, layout, or composition unless requested.`
- Other/unclear image: `<Nth> image: Use only for <declared role or target>. Do not override registry character identity, outfit, object guidance, or base sheet structure.`

### Stage 7: Handoff And Final Report

Before handing off, perform a final alignment check:

1. The prompt's Reference Guide has one entry for every reference image passed to image-generation, in the same order.
2. The image-generation handoff passes the selected base sheet as the 1st reference image.
3. The 1st reference path passed to image-generation is the selected reference `handoff_path`.
4. No guide line exists in the prompt unless its matching reference path is passed to image-generation.
5. No reference path is passed to image-generation unless its matching guide line exists in the prompt.
6. No object reference path is passed to `image-generation` unless it resolved through `object-registry get-reference-path`.
7. The real generation metadata path and dry-run metadata path are distinct.

Use the `image-generation` skill for the final rendering step. Provide this handoff data:

- Prompt file: `output/character-sheet-variants/<scenario_filename>-<timestamp>/prompt.txt`
- Reference images: selected reference `handoff_path` as the 1st reference image, followed only by explicitly required outfit/material/pose/object/style references with matching Reference Guide lines
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
- selected objects, object ownership, and usage modes when used
- variant type
- variant instruction
- selected template
- reference order
- warnings

If dry-run was used, clearly say image generation was skipped or only validated, depending on the user request.
