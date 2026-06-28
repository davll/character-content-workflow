# Style Registry Schema Reference

This reference explains how to create or modify visual style registry YAML safely. It is an agent-facing semantic guide, not a replacement for the TypeScript/Zod schema or CLI validation.

## Top-Level Shape

```yaml
styles: {}
```

`styles` stores reusable text-only style profiles for prompt building. Style IDs must be stable lowercase snake_case, such as `paper_craft` or `watercolor_storybook`.

## Style Entries

```yaml
styles:
  paper_craft:
    names:
      - paper craft
      - paper cutout
      - 紙雕
    summary: Soft cute layered paper craft style with simplified handcrafted shapes.
    prompt_building:
      descriptions:
        rendering:
          - Layered cut-paper construction with visible paper fibers and softly rounded edges.
      constraints:
        - Preserve character identity while simplifying fine detail.
      system_instructions:
        - Apply style instructions after character identity and outfit constraints.
```

Required fields:

- `names`: aliases, localized names, and search phrases used for style inference.
- `summary`: concise selection-oriented text.

Optional `prompt_building` fields:

- `descriptions`: topic buckets for rendering style, line quality, texture, palette, lighting, mood, and simplification language.
- `constraints`: style-specific hard rules and avoid rules.
- `system_instructions`: prompt-construction behavior for downstream workflows.

## Responsibilities

Use style profiles for:

- rendering medium
- texture
- line quality
- palette mood
- lighting language
- detail simplification
- cute, soft, dramatic, retro, handmade, or painterly treatment
- style-specific avoid rules

Do not use style profiles for:

- character identity
- outfit ownership
- body proportions or height relationships
- skin tone contrast
- tattoos or important character markings
- character relationships or personality dynamics
- pose or scene-location control
- reference image paths
- provider, model, image size, or generation options

## Prompt-Building Order

Downstream workflows should place style content in a dedicated `Style Direction` section. Character and outfit content stays in `Character and Outfit Handling`.

When combining constraints, use character registry constraints first, then style registry constraints. If style simplification conflicts with identity preservation, preserve the identity-critical character detail and narrow the style instruction.

## Legacy Character Style Fields

Existing character registry entries may contain:

```yaml
prompt_building:
  descriptions:
    style:
      - detailed digital anime
```

Do not require immediate migration. Treat these entries as low-priority legacy/default hints only. New reusable style definitions belong in a project-local `styles/index.yaml`. This repository's seed examples live in `examples/styles/index.yaml`.

## Validation Examples

Validate:

```shell
node .agents/skills/style-registry/scripts/style-registry.mjs validate --file examples/styles/index.yaml
```

List inference summaries:

```shell
node .agents/skills/style-registry/scripts/style-registry.mjs list-all --file examples/styles/index.yaml
```

Load one prompt-building profile:

```shell
node .agents/skills/style-registry/scripts/style-registry.mjs get-style-info --file examples/styles/index.yaml paper_craft
```
