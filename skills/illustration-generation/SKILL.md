---
name: illustration-generation
description: Generate character-consistent illustrations from registered character sheets and optional reference images. Use when Codex needs to infer scene details, select character registry sheets, build illustration prompts with reference ordering, create illustration artifact paths, then hand off final rendering to the image-generation skill.
---
# Illustration Generation

Run the illustration workflow in this skill. Use the `character-registry` skill to query character sheets and prompt-building data. Use the `image-generation` skill for the final rendering step; do not duplicate either skill's CLI command details here.

## Defaults

- Registry: `characters/index.yaml`
- Output directory: `output/illustrations`
- Image provider preference: `openai` unless the user requests another provider
- Image model preference: omit unless requested
- Response provider/model for reasoning: use your own reasoning unless the user explicitly asks for a separate model call.

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

- `user_prompt`: non-empty illustration request. If a prompt file is supplied, read it and trim whitespace.
- Optional external reference images: JPEG/PNG paths supplied by the user or uploaded image metadata paths included in the current user message.
- Optional image handoff preferences: provider, model, size, aspect ratio, resolution, overwrite, dry-run, and verbosity.

Reject empty prompts. Verify external reference paths exist and are JPEG/PNG before using them.

## Uploaded Conversation Images

Codex surfaces uploaded conversation images as image metadata when available, for example:

```text
<image name="[Image #1]" path="/absolute/path/to/upload.jpg">
```

Treat each `path` value in current-turn uploaded image metadata as an external reference candidate. Use only explicit paths supplied by the current user message or explicit paths the user typed. Do not infer, glob, or reconstruct attachment paths from `.codex`, `codex-remote-attachments`, thread IDs, attachment IDs, hashes, timestamps, or "latest file" directory scans.

For uploaded conversation images:

1. Preserve the order in which uploaded images appear in the current user message. Map them to `external:1`, `external:2`, etc. unless the user also supplied earlier explicit external reference paths; in that case, keep one user-supplied external-reference order across all paths as presented.
2. Verify each path with a literal-path filesystem existence check before using it.
3. Verify the file is JPEG or PNG by content signature, not by filename alone.
4. Treat the original upload path as transient host state. Do not pass `.codex` attachment paths directly to image generation when creating a durable workflow artifact.
5. After the workflow run directory exists, copy each validated uploaded image into that run directory under `references/external-N.<ext>`, preserving the detected format extension.
6. Use the copied workspace path, not the original upload path, in the resolved reference list, prompt/reference alignment checks, and image-generation handoff.
7. If an uploaded image path is inaccessible, missing, or not JPEG/PNG, fail before prompt writing or generation and report which reference failed.

## Stage 1: Scene Inference

Use the `character-registry` skill to validate the registry, then list all registry summaries. Infer structured illustration parameters from that output and the user prompt:

```json
{
  "scene": {
    "characters": ["<character or group names>"],
    "location": "<scene location>",
    "action": "<core action or interaction>",
    "mood": "<emotional tone>",
    "composition": "<camera and layout intent>"
  },
  "reference_images": [
    {
      "id": "sheet:<group_id>:<sheet_id>",
      "kind": "registry_sheet",
      "group_id": "<target group id>",
      "sheet_id": "<selected sheet id>",
      "role": "character identity and outfit reference",
      "description": "<what this reference contains>",
      "target": "<character or group this reference applies to>",
      "confidence": 0.0,
      "reason": "<why this sheet was selected>"
    },
    {
      "id": "external:<1-based index>",
      "kind": "external",
      "path": "<original reference path>",
      "role": "pose | background | prop | style | character | other",
      "description": "<what this reference contains>",
      "target": "<what the reference applies to>",
      "confidence": 0.0,
      "reason": "<how the image should be used>"
    }
  ],
  "warnings": []
}
```

Inference rules:

1. Identify target characters and groups from character names, group composition, relationships, and sheet summaries returned by `character-registry list-all`.
2. For multi-character illustrations, prefer a combined group sheet when the registry offers one. Use separate sheets only when no combined group sheet fits the request.
3. Match outfit or scenario cues explicitly when present. If no outfit is specified, choose the best dressed/default illustration sheet; avoid base/naked/minimal sheets unless explicitly requested or no dressed sheet exists.
4. Parse the scene into location, action, mood, camera angle, character positions, physical interaction, and important props.
5. Classify every user-provided external reference by semantic role. Registry character sheets come first; external references follow in the order supplied unless scene logic requires a clearer order.
6. Add warnings for ambiguous character identity, outfit conflicts, missing suited sheets, unclear external reference roles, or requests that require unsupported registry data.
7. Use deterministic reference IDs: registry sheet references must be `sheet:<group_id>:<sheet_id>`, and external references must be `external:<1-based index>`.
8. Return one `reference_images` item for every selected registry sheet and every user-provided external reference. Do not drop external references; if a reference is weak or unclear, keep it in the list with a low confidence score and a warning.

After inference, verify every selected sheet with `get-sheet-path`. Fail before generation if any selected sheet command fails, path does not exist, or file is not a PNG/JPEG.

## Stage 2: Reference Resolution

Create a numbered reference sequence. This sequence is the source of truth for both prompt text and image-generation handoff.

Build a resolved reference list with IDs, original paths, and final handoff paths for workflow use, then build pathless prompt reference guide data for prompt construction. The prompt-building stage may see IDs, kinds, roles, targets, descriptions, characters, sheet IDs, and prompt-building data, but must not see or mention local filesystem paths.

Reference ordering:

1. Selected registry character or group sheets, in the order characters should be resolved.
2. External character references, if they are needed for additional identity not in the registry.
3. External pose, interaction, background, object, prop, and style references in user-supplied order.

For each registry sheet, run `get-sheet-info` and use:

- sheet summary
- `prompt_building.descriptions`
- `prompt_building.constraints`
- `prompt_building.system_instructions`

Keep path data out of the prompt except through ordered reference labels such as `1st image` and `2nd image`.

Before prompt building, validate:

1. Every registry reference ID matches `sheet:<group_id>:<sheet_id>`.
2. Every selected registry sheet ID is unique.
3. Every user-provided external reference appears exactly once as `external:<1-based index>`.
4. No unknown or duplicate external reference IDs exist.
5. Every uploaded conversation image reference has an explicit source path from the current user message and, after Stage 4, a copied workspace path under the run directory.

## Stage 3: Prompt Building

Build one final image prompt using the selected references. Follow registry `system_instructions`, use `descriptions` as semantic content building blocks, and enforce every registry `constraint`.

## Registry Prompt-Building Fidelity

Treat registry `prompt_building.descriptions`, `constraints`, and `system_instructions` as source-of-truth semantic content.

The prompt builder may reorganize wording for readability, merge duplicate ideas, and adapt phrasing into the final prompt structure, but must not weaken, omit, sanitize, generalize, or contradict registry-provided character facts, outfit details, body traits, identity details, relationship logic, or constraints.

If a registry description is explicit, preserve its explicitness unless it directly conflicts with a higher-priority safety policy or with another registry constraint. In that case, add a warning explaining which registry text was changed and why.

## Character Consistency Guardrails

Apply these rules to every prompt before writing the final artifact:

1. Treat registry sheets as the source of truth for character identity, outfit ownership, proportions, and stable physical traits.
2. Use reference images for their declared role only. A character sheet is not a pose, composition, lighting, or background reference unless the user explicitly asks for that.
3. For multi-character images, name each character in the scene direction and state their spatial relationship, action, gaze, and interaction. Do not rely on "both characters" alone.
4. Explicitly preserve registry constraints that prevent identity drift, such as height relationships, skin tone contrast, face/body proportions, and outfit assignment.
5. Prevent feature bleeding by saying which character owns which visible outfit, prop, body position, and interaction when the scene includes close contact or overlapping poses.
6. If a prompt asks for a pose, background, style, or prop from an external reference, state that the external reference must not override registry character identity or clothing.
7. Do not copy registry sheet layout artifacts: standing order, neutral pose, gray panels, divider lines, character name labels, annotation text, reference-sheet framing, or plain reference composition. The illustration's character placement, action, interaction, viewing angle, background, and composition must come from Scene Direction and Composition unless the user explicitly asks to copy a character sheet layout or pose.
8. If the selected sheet is a combined group sheet, use it for all characters in that group and keep the group's internal identity distinctions intact.

Use this structure:

```text
A high-quality illustration of <character names> <action> at <location>.

Scene Direction:
<expanded scene, mood, interaction, posing, and character positions>

Character and Outfit Handling:
<registry-derived traits and outfit details needed for correctness; do not over-describe details already clear in the registry sheets unless a constraint requires it>

Composition:
<camera angle, framing, spatial relationship, depth, lighting, and background>

Visual Constraints:
- <each registry constraint, rewritten into prompt-friendly language>

Character Instructions:
- <each relevant registry system instruction>

### Reference Guide:
1st image: <role-specific instruction>
2nd image: <role-specific instruction>
```

Prompt-building rules:

1. Apply the minimal description principle only to avoid unnecessary duplication, not to remove registry facts. Rely on registry sheets for stable visual traits, but preserve explicit registry `descriptions`, especially character identity, outfit ownership, body traits, relationship logic, and constraints. Do not weaken specific registry wording into vague references such as "same fit" or "as shown" when the registry provides an explicit semantic detail.
2. Constraints take precedence over generic scene expansion. If a constraint defines height, skin tone contrast, outfit ownership, or relationship logic, explicitly encode that logic.
3. Use spatial safety for multi-character scenes: state left/right, foreground/background, who touches whom, who looks at whom, and which outfit belongs to which character.
4. Use cinematic language: concrete camera angle, focal length feel, lighting direction, atmosphere, and background details.
5. Avoid static portrait output unless requested. Add body language, eye contact, expression, interaction, or motion.
6. Keep the prompt as a generation prompt, not a reasoning trace. Do not mention registry commands, local file paths, or internal inference.
7. Derive the Reference Guide from the final resolved reference sequence. Do not invent, omit, or reorder reference guide entries during prose writing.
8. The Reference Guide must contain exactly one line per reference, in the same order as the handoff reference list.
9. If any registry `prompt_building.descriptions` item is omitted, softened, generalized, or materially rephrased, record a warning in the workflow output explaining the original registry text, the changed prompt text, and the reason. Do not silently alter registry semantics.

Reference guide role formats:

- Character registry sheet: `<Nth> image: ONLY for <character or group>'s identity, outfit ownership, relative scale/proportions, and stable physical traits. Do not copy the sheet layout, standing order, neutral pose, labels, annotations, background panels, or reference-sheet framing. Scene composition comes from the prompt unless the user explicitly requests copying the sheet layout or pose.`
- External character image: `<Nth> image: ONLY for <target character>'s extra identity details. Do not copy unrelated clothing, background, or pose.`
- Pose/structure image: `<Nth> image: ONLY for pose, body positioning, physical interaction, and composition. Do not copy character identity, outfit, or background.`
- Background/environment image: `<Nth> image: ONLY for architecture, lighting, environmental mood, and scenery. Do not copy characters or foreground objects.`
- Object/prop image: `<Nth> image: ONLY for the design and details of <target prop>.`
- Style image: `<Nth> image: ONLY for broad rendering style, line quality, color mood, or lighting treatment. Do not copy characters or composition unless requested.`

If a registry sheet includes `descriptions.reference_logic`, merge only reference-specific usage guidance into its reference guide line. Do not merge workflow-specific policy. If registry `descriptions.reference_logic` conflicts with this skill's reference rules, ignore the conflicting registry content and add a warning.

## Stage 4: Artifact Paths

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

With default output directory, write:

- Prompt: `output/illustrations/<scenario_filename>-<timestamp>/prompt.txt`
- Image: `output/illustrations/<scenario_filename>-<timestamp>/image.png`
- Metadata: `output/illustrations/<scenario_filename>-<timestamp>/metadata.json`
- Dry-run metadata: `output/illustrations/<scenario_filename>-<timestamp>/metadata.dry-run.json`
- Uploaded external references: `output/illustrations/<scenario_filename>-<timestamp>/references/external-N.<ext>`

Write metadata by default through the image-generation handoff. The metadata path must be explicit; do not rely on image-generation to infer a metadata path.
When validating with image-generation dry-run before real generation, use `metadata.dry-run.json` for the dry-run handoff and reserve `metadata.json` for the real generation handoff. Do not reuse the real metadata path for dry-run, because the generated dry-run metadata would block the later real generation unless overwrite was requested.

Copy validated uploaded conversation images into `references/` before writing the final prompt or handing off to image generation. Preserve user-supplied local reference paths that are already project/workspace artifacts unless they come from Codex attachment storage such as `.codex\codex-remote-attachments`; copy Codex attachment paths into `references/` because they are session/cache state, not durable workflow artifacts.

## Stage 5: Image Generation Handoff

Use the `image-generation` skill for the final rendering step. Provide it this handoff data:

- Prompt file: `output/illustrations/<scenario_filename>-<timestamp>/prompt.txt`
- Reference images: all resolved registry paths and copied/durable external reference paths in the exact order used by the prompt's Reference Guide
- Output image: `output/illustrations/<scenario_filename>-<timestamp>/image.png`
- Metadata output for real generation: `output/illustrations/<scenario_filename>-<timestamp>/metadata.json`
- Metadata output for image-generation dry-run validation: `output/illustrations/<scenario_filename>-<timestamp>/metadata.dry-run.json`
- Provider/model/options: pass through only values explicitly requested by the user or inferred by this workflow
- Overwrite/verbosity: pass through only when requested

Before handing off, perform a final sequence alignment check:

1. The prompt's Reference Guide has exactly the same number of entries as the resolved reference list.
2. The `1st image`, `2nd image`, etc. labels match the exact reference path order passed to image-generation.
3. No reference path is passed to image-generation unless its matching guide line exists in the prompt.
4. No guide line exists in the prompt unless its matching reference path is passed to image-generation.
5. No transient uploaded attachment path is passed to image-generation when a copied workspace reference path should exist.

Do not duplicate the image-generation CLI command in this skill. Let the `image-generation` skill decide the exact command shape, provider API key handling, validation behavior, and current supported provider details. The handoff must include the explicit metadata output path so image-generation passes `--metadata`.

## Final Response

Report the output image path, prompt path, metadata path, dry-run metadata path when used, selected group/sheet references, external reference roles, reference IDs, reference order, copied uploaded-reference paths when applicable, inferred scene, and warnings. If dry-run was used, clearly say image generation was skipped or only validated, depending on the user request.
