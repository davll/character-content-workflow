---
name: character-registry
description: Query and validate repository character registry data with the bundled character-registry CLI. Use when Codex needs to validate characters/index.yaml, list registered characters/groups/sheets for inference, resolve selected sheet image paths, or load sheet prompt-building data for sticker, illustration, or other character-consistent generation workflows.
---
# Character Registry

Use the bundled single-file CLI from the workspace root:

```powershell
node scripts/character-registry.mjs <command> [options]
```

The TypeScript source package lives at `packages/character-registry/`. If the source changes, rebuild the bundled skill script from the workspace root with:

```powershell
npm run build:character-registry-skill
```

## Defaults

- Registry file: `characters/index.yaml`
- Working directory: the active workspace root
- Output format: YAML for registry summaries and prompt-building data; plain text for resolved sheet paths

## First Use / Registry Creation

If the registry file does not exist, create it as part of this skill workflow before calling downstream sticker, illustration, or image-generation skills.

1. Infer initial registry data from the user's prompt:
   - `characters`: character IDs, display names, aliases, and durable visual/personality characteristics.
   - `groups`: single-character or multi-character groups that the user is asking to use together.
   - `sheets`: only add a sheet when the prompt or workspace context gives a concrete existing character sheet image path.
   - `prompt_building`: include reusable prompt segments, constraints, and system instructions when they are explicit or strongly implied by the user request.
2. Write `characters/index.yaml` with valid registry YAML.
3. Run `validate` immediately after writing the file.
4. If the prompt does not provide enough information for a valid sheet path, create only the safe character and group entries, report that a character sheet image path is needed, and stop before image generation.
5. Do not overwrite an existing registry unless the user explicitly asks to replace it.

Minimal empty registry:

```yaml
characters: {}
groups: {}
```

Example initialized registry:

```yaml
characters:
  mike:
    names:
      - Mike
    characteristics:
      - red hair
      - tall build
groups:
  mike:
    characters:
      - mike
    sheets:
      default:
        path: sheets/mike-default.png
        description: Full-body reference sheet for Mike in his default outfit.
        prompt_building:
          segments:
            character:
              - Mike, red hair, tall build
          constraints:
            - Preserve Mike's facial structure, hair color, and body proportions.
          system_instructions: []
    prompt_building:
      segments: {}
      constraints: []
      system_instructions: []
```

## Commands

Validate the registry:

```powershell
node scripts/character-registry.mjs validate --file characters/index.yaml
```

List searchable character, group, and sheet summaries for inference:

```powershell
node scripts/character-registry.mjs list-all --file characters/index.yaml
```

Resolve a selected sheet image path:

```powershell
node scripts/character-registry.mjs get-sheet-path --file characters/index.yaml <group_id> <sheet_id>
```

Load prompt-building data for a selected sheet:

```powershell
node scripts/character-registry.mjs get-sheet-info --file characters/index.yaml <group_id> <sheet_id>
```

## Rules

1. Run the bundled `.mjs` with `node` from the active workspace root so relative registry and sheet paths resolve against the user's project.
2. Validate the registry before using sheet IDs in sticker, illustration, or image workflows.
3. Use `list-all` for character/group/sheet selection instead of parsing `characters/index.yaml` manually.
4. Use `get-sheet-path` for reference image paths passed to image-generation workflows.
5. Use `get-sheet-info` for prompt-building data, including sheet description, `prompt_building.segments`, `prompt_building.constraints`, and `prompt_building.system_instructions`.
6. Treat non-zero CLI exits as workflow failures. Report the command error and stop before generating images.
7. If the user provides a custom registry path, pass that same `--file` value to every command in the workflow.
