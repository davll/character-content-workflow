---
name: illustration-generation
description: Generate character-consistent illustrations from registered character sheets and optional reference images. Use when Codex needs to infer scene details, select character registry sheets, build illustration prompts with reference ordering, create illustration artifact paths, then hand off final rendering to the image-generation skill.
---
# Illustration Generation

Run the illustration workflow in this skill. Use the `character-registry` skill for registry validation, sheet selection, sheet paths, and character prompt-building data. Use the `style-registry` skill for visual style inference and style prompt-building data. Use the `image-generation` skill for final rendering, dry-run validation, provider behavior, API key handling, and CLI command shape.

This skill owns only the orchestration contract:

1. Interpret the user request as an illustration scene.
2. Select character sheet references from the character registry.
3. Infer an optional text-only style profile from the style registry.
4. Normalize external references into one ordered handoff list.
5. Build a prompt whose Reference Guide exactly matches that list.
6. Create durable illustration artifacts.
7. Hand off rendering to `image-generation`.

## Defaults

- Character Registry: `characters/index.yaml` when present; `examples/characters/index.yaml` only as the local development fixture fallback
- Style registry: `styles/index.yaml` when present; `examples/styles/index.yaml` only as the local development fixture fallback
- Output directory: `output/illustrations`
- Image provider preference: `openai` unless the user requests another provider
- Image model preference: omit unless requested
- Response provider/model for reasoning: use your own reasoning unless the user explicitly asks for a separate model call.

## Hard Invariants

Fail before writing the final prompt or generating an image when any invariant cannot be satisfied:

1. The illustration request must contain a non-empty prompt. If a prompt file is supplied, read it and trim whitespace.
2. Registry lookup must go through the `character-registry` skill. Do not parse registry YAML manually for sheet search, sheet paths, or prompt-building data.
3. `character-registry` failures are workflow failures. Report the command error and stop before writing image outputs.
4. Every selected registry sheet must resolve through `get-sheet-path`, exist on disk, and be PNG or JPEG.
5. Every external reference must come from either an explicit user-provided path or current-turn uploaded image metadata. Do not infer, glob, reconstruct, or scan for attachment paths.
6. Every external reference must exist and be JPEG or PNG by content signature, not by filename alone.
7. Every uploaded conversation image copied from transient attachment storage must use the copied workspace path for prompt alignment and image-generation handoff.
8. The final prompt's Reference Guide must have exactly one line per handoff reference, in the exact handoff order.
9. No local filesystem path may appear in the prompt text.
10. The image-generation handoff must include explicit prompt, output image, ordered references, and metadata paths.
11. Style registry entries are text-only and must not add Reference Guide lines or image-generation reference paths.

## Registry Resolution

Resolve the registry path before calling `character-registry`:

1. Use an explicit user-provided registry path when supplied.
2. Otherwise use `characters/index.yaml` when it exists.
3. Otherwise, when running inside this skill development repository, use `examples/characters/index.yaml` when it exists.
4. Create `characters/index.yaml` through the `character-registry` first-use workflow only when no usable registry candidate exists.

If the registry path is overridden, pass that path through every registry lookup.

## Style Registry Resolution

Resolve the style registry path before calling `style-registry`:

1. Use an explicit user-provided style registry path when supplied.
2. Otherwise use `styles/index.yaml` when it exists.
3. Otherwise, when running inside this skill development repository, use `examples/styles/index.yaml` when it exists.
4. If no usable style registry exists and no style was explicitly requested, set `selected_style` to `null` and continue.
5. If no usable style registry exists and the user explicitly requested a named registry style, report the missing style registry and stop before writing image outputs.

If the style registry path is overridden, pass that path through every style-registry lookup.

## External References

Codex surfaces uploaded conversation images as image metadata when available, for example:

```text
<image name="[Image #1]" path="/absolute/path/to/upload.jpg">
```

Treat each `path` value in current-turn uploaded image metadata as an external reference candidate. Preserve the order in which current-turn uploaded images and user-typed reference paths appear in the user request. Assign deterministic external IDs in that order:

```text
external:1
external:2
external:3
```

Do not use paths from previous turns unless the user explicitly repeats them in the current request.

## Workflow

### Stage 1: Request Intake

Resolve the request into:

- `user_prompt`: non-empty illustration request.
- `style_cues`: style words, aliases, or preservation requests from the prompt, such as "paper craft style", "水彩繪本風", "retro manga", "cute chibi", "厚塗", or "保持原本 anime style".
- `external_inputs`: explicit JPEG/PNG paths and current-turn uploaded image paths, in user-supplied order.
- `handoff_options`: provider, model, size, aspect ratio, resolution, overwrite, dry-run, and verbosity, only when requested or needed by this workflow.

Validate that each external input has an explicit source path. Defer durable copying until Stage 4, after the run directory exists.

Do not remove style cues from the user prompt. Keep them available for scene inference, external reference role classification, and style profile matching.

### Stage 2: Registry Selection

Use `character-registry` to validate the registry and list all registry summaries. Infer selected character sheets from the registry output and the user prompt.

Do not rely on `prompt_building.descriptions.style` from the character registry as the main style source. If those legacy fields exist, treat them only as low-priority default hints when no explicit user style or style registry profile is selected.

Selection heuristics:

1. Identify target characters and groups from character names, group composition, relationships, and sheet summaries.
2. For multi-character illustrations, prefer a combined group sheet when the registry offers one. Use separate sheets only when no combined group sheet fits the request.
3. Match explicit outfit, age, style, or scenario cues when present.
4. If no outfit is specified, choose the best dressed/default illustration sheet. Avoid base, naked, or minimal sheets unless explicitly requested or no dressed sheet exists.
5. Add warnings for ambiguous character identity, outfit conflicts, missing suited sheets, unsupported registry data, or low-confidence selection.

For every selected sheet:

1. Use deterministic ID `sheet:<group_id>:<sheet_id>`.
2. Verify it with `get-sheet-path`.
3. Load prompt-building data with `get-sheet-info`.
4. Use sheet summary, `prompt_building.descriptions`, `prompt_building.constraints`, and `prompt_building.system_instructions`.

### Stage 3: Scene And Style Plan

After scene inference and character sheet selection, resolve optional style data:

1. If a style registry candidate exists, validate it with `style-registry`.
2. Run `list-all` and infer a selected style from the user prompt, `style_cues`, style IDs, aliases, and summaries.
3. If a style matches, call `get-style-info` and store the pathless prompt-building data in `selected_style.prompt_data`.
4. If the user explicitly requested a named style and it cannot be resolved, treat this as a workflow failure before writing image outputs.
5. If no style was requested or no registry file exists, set `selected_style` to `null` and continue with this workflow's existing default style behavior.

Style precedence:

```text
explicit user style text > uploaded style reference image > selected style registry profile > default style
```

If user provides both a style registry cue and a style reference image, use the style registry for reusable prompt vocabulary. Use the external style image only for broad rendering style, line quality, color mood, or lighting treatment. Neither source may override character identity, outfit ownership, proportions, markings, or explicit scene action.

Infer a compact scene plan from the prompt, selected sheets, external inputs, and warnings:

```json
{
  "scene": {
    "characters": ["<character or group names>"],
    "location": "<scene location>",
    "action": "<core action or interaction>",
    "mood": "<emotional tone>",
    "composition": "<camera and layout intent>"
  },
  "selected_style": {
    "id": "style:<style_id>",
    "style_id": "<style id>",
    "target": "whole image",
    "role": "rendering style and visual treatment",
    "confidence": 0.0,
    "reason": "<why this style was selected>",
    "prompt_data": "<style prompt-building data without paths>"
  },
  "selected_sheets": [
    {
      "id": "sheet:<group_id>:<sheet_id>",
      "group_id": "<group id>",
      "sheet_id": "<sheet id>",
      "target": "<character or group>",
      "role": "character identity and outfit reference",
      "confidence": 0.0,
      "reason": "<why this sheet was selected>"
    }
  ],
  "external_references": [
    {
      "id": "external:<1-based index>",
      "source_path": "<explicit source path>",
      "role": "pose | interaction | background | prop | style | character | other",
      "target": "<what the reference applies to>",
      "description": "<what this reference contains>",
      "confidence": 0.0,
      "reason": "<how the image should be used>"
    }
  ],
  "warnings": []
}
```

If no style is matched:

```json
"selected_style": null
```

External-reference planning rules:

1. Return one `external_references` item for every user-provided external input. Do not drop weak or unclear references; keep them with low confidence and a warning.
2. Classify each external reference by semantic role.
3. External references supplement the scene only through their declared role. They must not override registry character identity, outfit ownership, or stable physical traits.

### Stage 4: Artifact And Reference Normalization

Create the run directory and build one canonical ordered reference list. This list is the single source of truth for prompt labels and image-generation handoff paths.

Create a timestamp in this shape:

```text
YYYY-MM-DD_HH-MM-SS
```

Infer a concise scenario filename from the selected group/character and scene, such as:

```text
<group_id>_<sanitized_action_or_scene>
```

Sanitize the scenario filename by lowercasing, replacing non-ASCII letters or digits with `_`, collapsing repeated `_`, trimming leading/trailing `_`, and limiting it to 80 characters.

Create the run directory:

```text
OUTPUT_DIR/<scenario_filename>-<timestamp>
```

With default output directory, reserve these paths:

- Prompt: `output/illustrations/<scenario_filename>-<timestamp>/prompt.txt`
- Image: `output/illustrations/<scenario_filename>-<timestamp>/image.png`
- Metadata: `output/illustrations/<scenario_filename>-<timestamp>/metadata.json`
- Dry-run metadata: `output/illustrations/<scenario_filename>-<timestamp>/metadata.dry-run.json`
- Copied transient references: `output/illustrations/<scenario_filename>-<timestamp>/references/external-N.<ext>`

Reference ordering:

1. Registry character or group sheets first, in the order characters should be resolved.
2. External references next, preserving the user-supplied external-reference order.
3. Change external order only when the user explicitly requests a different order.

Style registry profiles are text-only. Do not add them to this reference ordering, do not create a `Reference Guide` line for them, and do not pass them as image-generation references unless a separate actual image reference exists.

External path normalization:

1. Verify every external source path exists and is JPEG or PNG by content signature before deciding whether to preserve or copy it.
2. Preserve user-supplied local reference paths that are already durable project/workspace artifacts.
3. Copy Codex attachment paths, `.codex\codex-remote-attachments` paths, and other transient upload/cache paths into the run directory under `references/external-N.<ext>`.
4. Preserve the detected content-signature extension when copying uploaded references.
5. Use copied workspace paths in `handoff_path` whenever a copy was made.

Canonical-list shape:

```json
[
  {
    "label": "1st image",
    "id": "sheet:<group_id>:<sheet_id>",
    "kind": "registry_sheet",
    "role": "character identity and outfit reference",
    "target": "<character or group>",
    "handoff_path": "<resolved registry sheet path>",
    "prompt_data": "<pathless sheet summary and prompt-building data>"
  },
  {
    "label": "2nd image",
    "id": "external:1",
    "kind": "external",
    "role": "pose",
    "target": "<target>",
    "source_path": "<original explicit path>",
    "handoff_path": "<durable source path or copied workspace path>",
    "prompt_data": "<pathless role, target, and description>"
  }
]
```

Canonical-list validation:

1. Every registry reference ID matches `sheet:<group_id>:<sheet_id>`.
2. Every selected registry sheet ID is unique.
3. Every user-provided external reference appears exactly once as `external:<1-based index>`.
4. No unknown or duplicate external reference IDs exist.
5. Every copied uploaded reference has a `handoff_path` inside the run directory.

### Stage 5: Prompt Building

Build one final image prompt from the scene plan, selected sheet prompt data, selected style prompt data, warnings, and canonical reference list. The prompt-building stage may use IDs, labels, kinds, roles, targets, descriptions, sheet summaries, and prompt-building data, but must not see or mention local filesystem paths.

#### Registry Prompt-Building Fidelity

Treat registry `prompt_building.descriptions`, `constraints`, and `system_instructions` as source-of-truth semantic content.

The prompt builder may reorganize wording for readability, merge duplicate ideas, and adapt phrasing into the final prompt structure, but must not weaken, omit, sanitize, generalize, or contradict registry-provided character facts, outfit details, body traits, identity details, relationship logic, or constraints.

If a registry description is explicit, preserve its explicitness unless it directly conflicts with a higher-priority safety policy or with another registry constraint. In that case, add a warning explaining which registry text was changed and why.

Use this structure:

```text
A high-quality illustration of <character names> <action> at <location>.

Scene Direction:
<expanded scene, mood, interaction, posing, and character positions>

Character and Outfit Handling:
<registry-derived traits and outfit details needed for correctness; do not over-describe details already clear in the registry sheets unless a constraint requires it>

Style Direction:
<style-registry-derived rendering, texture, line quality, palette, lighting, mood, and detail rules; keep style text out of Character and Outfit Handling>

Composition:
<camera angle, framing, spatial relationship, depth, lighting, and background>

Visual Constraints:
- <each registry constraint, rewritten into prompt-friendly language>
- <each compatible style registry constraint, after character constraints>

Character Instructions:
- <each relevant registry system instruction>

Style Instructions:
- <each relevant style registry system instruction>

### Reference Guide:
1st image: <role-specific instruction>
2nd image: <role-specific instruction>
```

Prompt invariants:

1. Registry sheets are the source of truth for character identity, outfit ownership, proportions, and stable physical traits.
2. Use each reference image only for its declared role. A character sheet is not a pose, composition, lighting, or background reference unless the user explicitly asks for that.
3. Registry constraints take precedence over generic scene expansion. Explicitly encode constraints involving height, skin tone contrast, face/body proportions, outfit ownership, relationship logic, or other identity-drift risks.
4. For multi-character images, bind each character to visible outfit, prop, body position, action, gaze, and interaction. State left/right, foreground/background, physical contact, and spatial relationship when relevant.
5. Prevent feature bleeding when characters touch, overlap, exchange objects, or wear visually similar items.
6. External pose, background, style, and prop references must not override registry character identity or clothing.
7. Do not copy registry sheet layout artifacts: standing order, neutral pose, gray panels, divider lines, character name labels, annotation text, reference-sheet framing, or plain reference composition. Scene composition comes from the prompt unless the user explicitly asks to copy a sheet layout or pose.
8. If the selected sheet is a combined group sheet, use it for all characters in that group and preserve the group's internal identity distinctions.
9. Character registry constraints beat style registry constraints. Style may simplify rendering detail but must not erase identity-critical traits such as tattoos, skin tone contrast, outfit ownership, body proportions, or important markings.
10. Place style profile descriptions in `Style Direction`, not `Character and Outfit Handling`.
11. Style constraints appear after character constraints. Omit or narrow any style constraint that conflicts with character preservation and record a warning.
12. Keep the prompt as a generation prompt, not a reasoning trace. Do not mention registry commands, local paths, or internal inference.
13. Apply the minimal description principle only to avoid unnecessary duplication, not to remove registry facts. Rely on registry sheets for stable visual traits, but preserve explicit registry `descriptions`, especially character identity, outfit ownership, body traits, relationship logic, and constraints. Do not weaken specific registry wording into vague references such as "same fit" or "as shown" when the registry provides an explicit semantic detail.
14. Avoid static portrait output unless requested. Add body language, eye contact, expression, interaction, or motion.
15. Derive the Reference Guide from the canonical reference list. Do not invent, omit, or reorder guide entries during prose writing.
16. Style profiles do not add extra Reference Guide lines.
17. If any registry `prompt_building.descriptions` item is omitted, softened, generalized, or materially rephrased, record a warning in the workflow output explaining the original registry text, the changed prompt text, and the reason. Do not silently alter registry semantics.
18. Do not add unsolicited softening, sanitizing, or tone-limiting language such as "non-explicit", "not eroticized", "suitable", "tasteful", or equivalent wording when the user did not request it and no higher-priority safety policy requires it. If such a policy-based change is required, keep the change as narrow as possible and record a warning explaining the exact registry or user-prompt wording that was changed.

Reference guide role formats:

- Character registry sheet: `<Nth> image: ONLY for <character or group>'s identity, outfit ownership, relative scale/proportions, and stable physical traits. Do not copy the sheet layout, standing order, neutral pose, labels, annotations, background panels, or reference-sheet framing. Scene composition comes from the prompt unless the user explicitly requests copying the sheet layout or pose.`
- External character image: `<Nth> image: ONLY for <target character>'s extra identity details. Do not copy unrelated clothing, background, or pose.`
- Pose/interaction image: `<Nth> image: ONLY for pose, body positioning, physical interaction, and composition. Do not copy character identity, outfit, or background.`
- Background/environment image: `<Nth> image: ONLY for architecture, lighting, environmental mood, and scenery. Do not copy characters or foreground objects.`
- Object/prop image: `<Nth> image: ONLY for the design and details of <target prop>.`
- Style image: `<Nth> image: ONLY for broad rendering style, line quality, color mood, or lighting treatment. Do not copy characters or composition unless requested.`
- Other/unclear image: `<Nth> image: Use only for <declared role or target>. Do not override registry character identity, outfit, or composition instructions.`

If a registry sheet includes `descriptions.reference_logic`, merge only reference-specific usage guidance into its Reference Guide line. Do not merge workflow-specific policy. If registry `descriptions.reference_logic` conflicts with this skill's reference rules, ignore the conflicting registry content and add a warning.

### Stage 6: Handoff And Final Report

Before handing off, perform a final alignment check:

1. The prompt's Reference Guide has exactly the same number of entries as the canonical reference list.
2. The `1st image`, `2nd image`, etc. labels match the exact reference path order passed to `image-generation`.
3. No reference path is passed to `image-generation` unless its matching guide line exists in the prompt.
4. No guide line exists in the prompt unless its matching reference path is passed to `image-generation`.
5. No transient uploaded attachment path is passed when a copied workspace reference path exists.
6. The real generation metadata path and dry-run metadata path are distinct.

Use the `image-generation` skill for the final rendering step. Provide this handoff data:

- Prompt file: `output/illustrations/<scenario_filename>-<timestamp>/prompt.txt`
- Reference images: every canonical `handoff_path`, in order
- Output image: `output/illustrations/<scenario_filename>-<timestamp>/image.png`
- Metadata output for real generation: `output/illustrations/<scenario_filename>-<timestamp>/metadata.json`
- Metadata output for image-generation dry-run validation: `output/illustrations/<scenario_filename>-<timestamp>/metadata.dry-run.json`
- Provider/model/options: pass through only values explicitly requested by the user or inferred by this workflow
- Overwrite/verbosity: pass through only when requested

Write metadata by default through the image-generation handoff. When validating with image-generation dry-run before real generation, use `metadata.dry-run.json` for the dry-run handoff and reserve `metadata.json` for the real generation handoff.

Do not duplicate the image-generation CLI command in this skill.

## Final Response

Report:

- output image path
- prompt path
- metadata path
- dry-run metadata path when used
- selected group/sheet references
- external reference roles
- reference IDs and final reference order
- copied uploaded-reference paths when applicable
- inferred scene
- warnings

If dry-run was used, clearly say image generation was skipped or only validated, depending on the user request.
