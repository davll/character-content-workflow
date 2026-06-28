---
name: style-registry
description: Query and validate repository visual style registry data for rendering style, line quality, texture, palette mood, lighting language, simplification rules, and style-specific prompt-building constraints.
---
# Style Registry

Use the bundled single-file CLI from this skill's own directory. Resolve the script path relative to this `SKILL.md`, not relative to the user's workspace root. Run the command with the active workspace root as the shell working directory so registry paths resolve against the user's project:

```shell
node <this-skill-directory>/scripts/style-registry.mjs <command> [options]
```

The TypeScript source package lives at `packages/style-registry/`. If the source changes, rebuild the bundled skill script from the workspace root with:

```shell
npm run build:style-registry-skill
```

## Defaults

- Registry file: `styles/index.yaml`
- Working directory: the active workspace root
- Output format: YAML for style summaries and prompt-building data

In this skill development repository, the seed fixture lives at `examples/styles/index.yaml`. Downstream workflows should prefer a project-local `styles/index.yaml` when it exists, then fall back to `examples/styles/index.yaml` only for local development and examples.

## Scope

This skill manages text-only visual style profiles for prompt building. It may describe rendering medium, line quality, texture, palette mood, lighting, detail simplification, cute/soft/dramatic treatment, and style-specific avoid rules.

It must not manage character identity, outfit ownership, body proportions, character relationships, pose control, scene location, reference image paths, provider/model options, or image-generation behavior.

## Commands

Validate the registry:

```shell
node <this-skill-directory>/scripts/style-registry.mjs validate --file styles/index.yaml
```

List searchable style summaries for style inference:

```shell
node <this-skill-directory>/scripts/style-registry.mjs list-all --file styles/index.yaml
```

Load prompt-building data for a selected style:

```shell
node <this-skill-directory>/scripts/style-registry.mjs get-style-info --file styles/index.yaml <style_id>
```

## Downstream Workflow Contract

1. Resolve the default registry path as `styles/index.yaml`.
2. Validate the registry before using it.
3. Use `list-all` for style inference instead of parsing `styles/index.yaml` manually.
4. Use `get-style-info` for selected style prompt-building data.
5. Treat style-registry failures as workflow failures only when the user explicitly requested a named style that cannot be resolved.
6. If no style is requested, allow downstream workflows to use their own default style without failing.
7. Do not add style registry entries to image reference ordering. A style profile is text-only unless it separately references an actual image through another workflow.

## Inference Rules

- Match user style cues against style IDs, aliases in `names`, and concise summaries from `list-all`.
- Keep explicit style cues in the user prompt; do not remove them before scene inference.
- If character registry data still contains legacy `prompt_building.descriptions.style`, treat it only as a low-priority legacy/default hint.
- Explicit user style text has priority over uploaded style reference images, selected style registry profiles, and workflow defaults.
- If the user provides both a registry style cue and an external style reference image, use the registry profile for reusable prompt vocabulary and the external image only for broad rendering style, line quality, color mood, or lighting treatment.

## Conflict Rules

Use this precedence:

```text
Safety/policy > explicit user request > character identity registry > scene plan > style registry > generic beautification
```

Character registry constraints always beat style registry constraints. A style profile may simplify rendering detail, but it must not erase identity-critical traits such as tattoos, skin tone contrast, outfit ownership, body proportions, or important markings.

When a style profile conflicts with character preservation, keep the character constraint, narrow the style instruction, and add a workflow warning.

## Editing Registry YAML

Before creating or modifying style registry YAML, read `references/style_registry_schema.md`. Validate immediately after editing.
