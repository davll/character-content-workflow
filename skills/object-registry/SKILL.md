---
name: object-registry
description: Query and validate repository object/prop registry data with the bundled object-registry CLI. Use when Codex needs to validate objects/index.yaml, list registered props, resolve object aliases, load prompt-building data for object-aware illustration workflows, or resolve object reference image paths for image generation.
---
# Object Registry

Use the bundled single-file CLI from this skill's own directory. Resolve the script path relative to this `SKILL.md`, not relative to the user's workspace root. Run the command with the active workspace root as the shell working directory so registry and reference paths still resolve against the user's project:

```shell
node <this-skill-directory>/scripts/object-registry.mjs <command> [options]
```

The TypeScript source package lives at `packages/object-registry/`. If the source changes, rebuild the bundled skill script from the workspace root with:

```shell
npm run build:object-registry-skill
```

## Defaults

- Registry file: `objects/index.yaml`
- Working directory: the active workspace root
- Output format: YAML for summaries and prompt-building data; plain text for resolved reference paths

In this skill development repository only, use `examples/objects/index.yaml` as a fallback fixture when `objects/index.yaml` is absent. In normal projects, prefer `REPO_ROOT/objects/index.yaml`; do not treat the example registry as a global default.

## First Use / Registry Creation

If the registry file does not exist in a normal project, create it as part of this skill workflow before calling downstream illustration or image-generation skills. When running inside this skill development repository, prefer the existing `examples/objects/index.yaml` fixture over creating a duplicate root registry unless the user explicitly asks to create one.

Before creating or modifying registry YAML, read `references/registry_schema.md` for the registry structure, field responsibilities, path rules, and safe inference rules.

1. Infer object entries only from explicit user information, existing workspace references, or well-established object facts needed for prompt disambiguation.
2. Add object aliases under `names`, not separate duplicate entries.
3. Add `reference_images` only when a durable image path exists or an uploaded image has been copied into the workspace.
4. Run `validate` immediately after writing the registry.
5. Do not overwrite existing object entries unless the user explicitly asks for replacement.

Minimal empty registry:

```yaml
objects: {}
```

## Commands

For normal projects, the examples below use the default `objects/index.yaml`. In this skill development repository, pass `--file examples/objects/index.yaml` when using the bundled example registry.

Validate the registry:

```shell
node <this-skill-directory>/scripts/object-registry.mjs validate --file objects/index.yaml
```

List searchable object summaries for inference:

```shell
node <this-skill-directory>/scripts/object-registry.mjs list-all --file objects/index.yaml
```

Search for object matches:

```shell
node <this-skill-directory>/scripts/object-registry.mjs search --file objects/index.yaml "<query>"
```

Load prompt-building data for a selected object:

```shell
node <this-skill-directory>/scripts/object-registry.mjs get-object-info --file objects/index.yaml <object_id>
```

Resolve an object reference image path:

```shell
node <this-skill-directory>/scripts/object-registry.mjs get-reference-path --file objects/index.yaml <object_id> <reference_id>
```

## Rules

1. Resolve the bundled `.mjs` path from this skill directory. Use the active workspace root as the shell working directory.
2. Validate the registry before using object IDs or reference IDs in generation workflows.
3. Use `list-all` or `search` for object selection instead of parsing registry YAML manually.
4. Use `get-object-info` for prompt-building data, including names, category, subtype, visual traits, accessories, usage profiles, constraints, and references.
5. Use `get-reference-path` for reference image paths passed to image-generation workflows.
6. Treat non-zero CLI exits as workflow failures when validation or selected reference resolution fails. Report the command error and stop before generating images.
7. If the user provides a custom registry path, pass that same `--file` value to every command in the workflow.
8. Resolve registry candidates in this order for downstream workflows: explicit user path, `objects/index.yaml`, then `examples/objects/index.yaml` only inside this skill development repository.
9. Object registry prompt data may describe prop handling posture and scale, but it must not override character identity, outfit ownership, body traits, skin tone, relationship logic, or scene composition.
