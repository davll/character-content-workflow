# Character Registry Schema Reference

This reference explains how to create or modify character registry YAML safely. It is an agent-facing semantic guide, not a replacement for the TypeScript/Zod schema or CLI validation.

## Top-Level Shape

```yaml
characters: {}
groups: {}
```

- `characters` stores durable character identity data.
- `groups` stores generation-ready units. A group can represent one character or multiple characters together.
- Character sheet images belong under `groups.<group_id>.sheets`, not directly under `characters`.

## `characters`

Use `characters` for stable identity information that remains true across outfits and scenes.

```yaml
characters:
  mike:
    names:
      - Mikhail Oryol
      - Mike
    characteristics:
      - tall build
      - confident expression
```

- `names`: Display names, aliases, localized names, or search names that help match user prompts.
- `characteristics`: Durable traits that are safe to reuse across contexts, such as body type, face shape, personality cues, or recurring visual identity.

Do not put outfit-specific details here unless they are truly permanent. If a detail only appears in one reference sheet, put it in that sheet's summary or prompt-building data.

## `groups`

Use `groups` for the unit that downstream generation workflows select.

```yaml
groups:
  mike:
    characters:
      - mike
    sheets: {}
    prompt_building:
      descriptions: {}
      constraints: []
      system_instructions: []
```

- A single-character group is useful for solo stickers or illustrations.
- A multi-character group is useful when a combined sheet defines proportions, height relationships, outfit ownership, or pair dynamics.
- Every ID in `characters` must exist in the top-level `characters` map.
- Preserve existing sheets when updating a group unless the user explicitly asks to replace them.

## `sheets`

Use `sheets` for concrete visual references that can be passed to image generation.

```yaml
sheets:
  navy_uniform:
    path: sheets/mike-navy-uniform.png
    summary: Full-body reference sheet for Mikhail Oryol in a navy uniform.
    prompt_building:
      descriptions:
        outfit_details:
          - Mikhail wears the navy uniform shown in the sheet.
      constraints:
        - Preserve Mikhail's facial structure, proportions, and uniform ownership.
      system_instructions: []
```

- `path`: Required. Must be a relative path from the registry root.
- `summary`: Required. Concise sheet-selection text for scene inference. Describe what the sheet contains and when to choose it.
- `prompt_building`: Optional but recommended when the sheet includes important generation guidance.

Keep `summary` short and selection-oriented. Put prompt-building semantic material in `prompt_building.descriptions`, not in `summary`.

Only add a sheet when there is a concrete existing image path from the user prompt, an uploaded image copied into the workspace, or a known workspace file. Do not invent sheet paths.

## `prompt_building`

`prompt_building` can appear at group level and sheet level. Downstream workflows merge group-level and sheet-level prompt-building data.

### `descriptions`

Use `descriptions` for positive semantic description material grouped by topic. These entries are input material for prompt builders; they are not literal prompt snippets and are not guaranteed to appear verbatim in a final prompt. A prompt builder may flatten, filter, reorder, restructure, or rewrite them for the target workflow.

```yaml
descriptions:
  characteristics:
    - Mikhail has the face, proportions, and posture shown in the reference sheet.
  outfit_details:
    - Mikhail wears the shown navy uniform.
```

Good description keys are short topic names such as `style`, `relationship`, `characteristics`, `outfit_details`, or `reference_logic`.

Keep descriptions factual, positive, and descriptive. Do not use descriptions for hard preservation rules, failure-prevention rules, prompt construction behavior, or system-level policy. Put hard rules in `constraints`; put prompt construction behavior in `system_instructions`.

Use `reference_logic` only for guidance about how the reference image itself should be used. Do not put workflow-specific policy in `reference_logic`, such as whether an illustration workflow should copy layout or whether a character-sheet variant workflow should preserve sheet layout.

Good `reference_logic` example:

```yaml
reference_logic:
  - Use this combined sheet for both characters' identities, relative scale, and outfit ownership.
```

Bad `reference_logic` example:

```yaml
reference_logic:
  - Do not copy the layout or pose from the reference image.
```

### `constraints`

Use `constraints` for hard rules that prevent identity drift or reference confusion.

```yaml
constraints:
  - Preserve the height relationship shown in the combined sheet.
  - Do not swap Mikhail's outfit with Hiroshi's outfit.
```

Constraints should be explicit, testable, and tied to visible failure modes: wrong character identity, swapped clothing, altered body proportions, incorrect skin tone contrast, missing accessories, or copied reference layout.

### `system_instructions`

Use `system_instructions` sparingly for higher-level behavior instructions that should affect prompt construction.

```yaml
system_instructions:
  - Treat the combined sheet as the source of truth for both characters' relative scale and outfit ownership.
```

Do not use this field for ordinary descriptive details that belong in `descriptions` or `summary`.

## Path Rules

- Sheet paths must be relative to the registry root.
- Sheet paths must stay inside the registry root after resolution.
- Do not use absolute paths.
- Do not use paths that escape with `..`.
- Validate after writing so the CLI can catch path and schema issues.

## Safe Inference Rules

- It is safe to infer character IDs and group IDs from clear user-provided names.
- It is safe to add aliases from names explicitly supplied by the user or visible in existing registry context.
- It is safe to create a character or group without sheets when no sheet image path is available.
- It is not safe to invent a sheet path, outfit details, or visual traits that are not supplied by the user, existing files, or existing registry context.
- It is not safe to overwrite an existing registry, character, group, or sheet unless the user explicitly asks for replacement.
- If generation requires a sheet but none exists, stop and ask for a character sheet image path.

## Initialization Examples

Minimal empty registry:

```yaml
characters: {}
groups: {}
```

Safe character and group without a sheet:

```yaml
characters:
  aiko:
    names:
      - Aiko
    characteristics: []
groups:
  aiko:
    characters:
      - aiko
    sheets: {}
    prompt_building:
      descriptions: {}
      constraints: []
      system_instructions: []
```

Single-character group with a known sheet:

```yaml
characters:
  aiko:
    names:
      - Aiko
    characteristics:
      - short black hair
groups:
  aiko:
    characters:
      - aiko
    sheets:
      default:
        path: sheets/aiko-default.png
        summary: Full-body reference sheet for Aiko in her default outfit.
        prompt_building:
          descriptions:
            characteristics:
              - Aiko's identity, outfit, and proportions are defined by the default sheet.
          constraints:
            - Preserve Aiko's face, hairstyle, outfit, and body proportions from the sheet.
          system_instructions: []
    prompt_building:
      descriptions: {}
      constraints: []
      system_instructions: []
```

Multi-character group with a combined sheet:

```yaml
characters:
  mike:
    names:
      - Mikhail Oryol
    characteristics: []
  hiroshi:
    names:
      - Hiroshi Amano
    characteristics: []
groups:
  mike_and_hiroshi:
    characters:
      - mike
      - hiroshi
    sheets:
      navy_uniform:
        path: sheets/mike_x_hiroshi-navy_uniforms.png
        summary: Combined character sheet for Mikhail Oryol and Hiroshi Amano wearing navy uniforms.
        prompt_building:
          descriptions:
            reference_logic:
              - Use this combined sheet for both characters' identities, relative scale, and uniform ownership.
          constraints:
            - Do not swap Mikhail and Hiroshi's faces, body proportions, or uniforms.
          system_instructions:
            - Treat the combined sheet as the source of truth for both characters together.
    prompt_building:
      descriptions: {}
      constraints: []
      system_instructions: []
```
