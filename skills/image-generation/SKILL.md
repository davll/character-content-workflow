---
name: image-generation
description: Generate or edit images with the bundled repository-local generate-image CLI or the Codex built-in imagegen provider. Use when Codex needs direct text-to-image generation, image editing from JPEG/PNG/WebP references, provider model listing, image generation dry runs, or another workflow needs a stable image-generation command. Supports OpenAI and xAI providers through environment-variable API keys, plus provider codex inside Codex sessions.
---
# Image Generation

This skill supports two provider classes:

- **CLI providers:** `openai` and `xai`, executed by the bundled
  `generate-image.mjs` CLI.
- **Skill-level provider:** `codex`, executed by Codex through the
  built-in `image_gen` tool. This provider does not require `OPENAI_API_KEY`,
  but it is only available inside Codex sessions and is not a valid
  `--provider` value for the bundled Node CLI.

Use the bundled single-file CLI from this skill's own directory. Resolve the
script path relative to this `SKILL.md`, not relative to the user's workspace
root. Run the command with the active workspace root as the shell working
directory so input and output paths still resolve against the user's project:

```shell
node <this-skill-directory>/scripts/generate-image.mjs <command> [options]
```

When the requested provider is `codex`, do not run the CLI. Follow the Codex
provider workflow below.

The TypeScript source workspace lives at `ts/`, and the CLI source package is `ts/packages/generate-image/`. If the source changes, rebuild the bundled skill scripts with:

```shell
npm --prefix ts run build:skill
```

## Generate

Image provider calls can legitimately run for several minutes. When invoking
`gen` through a shell tool, set the shell timeout to 10 minutes
(`timeout_ms: 600000`) so slow image generation is not misclassified as a
timeout and aborted.

Non-dry-run image generation calls contact the provider over the network. In
Codex sandboxed environments, request elevated permission before the first
non-dry-run `gen` attempt instead of trying once in the sandbox. A sandboxed
network failure can still write `failed` metadata to `--metadata`, and that
metadata file will block the approved retry unless the command uses `--force`
or a fresh metadata path. Dry-runs do not need network elevation.

Prefer prompt files for non-trivial prompts:

```shell
node <this-skill-directory>/scripts/generate-image.mjs gen `
  --provider openai `
  --moderation low `
  --prompt-file path/to/prompt.txt `
  --output path/to/output.png
```

For a short prompt, inline text is allowed:

```shell
node <this-skill-directory>/scripts/generate-image.mjs gen --provider openai --moderation low --prompt-text "Prompt text" --output path/to/output.png
```

Use reference images for image-to-image or editing workflows. References must be JPEG, PNG, or WebP, and their order is the order described in the prompt as `1st image`, `2nd image`, etc.

```shell
node <this-skill-directory>/scripts/generate-image.mjs gen `
  --provider openai `
  --moderation low `
  --reference path/to/ref1.png path/to/ref2.jpg `
  --prompt-file path/to/prompt.txt `
  --output path/to/output.png
```

Use `--provider xai` for xAI image generation/editing. xAI defaults to `XAI_API_KEY`; OpenAI defaults to `OPENAI_API_KEY`.

Use provider `codex` only as a skill-level provider. It is chosen by the Codex
agent, not passed to `generate-image.mjs`.

## Arguments

- `--output` / `-o`: required output image path. The CLI creates the output directory.
- `--metadata <path>`: optional metadata JSON path. When provided, the CLI records the resolved prompt, reference paths, provider/model, options, status, output paths, token usage when available, and errors when generation fails.
- `--prompt-file <path>` or `--prompt-text <text>`: one is required.
- `--provider` / `-p`: CLI-only provider, `openai` or `xai`. Default is `openai`. Do not pass `codex` to the CLI.
- `--model` / `-m`: optional. Defaults are `gpt-image-2` for OpenAI and `grok-imagine-image-quality` for xAI.
- `--reference` / `-r <paths...>`: ordered JPEG/PNG/WebP reference images.
- `--count` / `-c <number>`: optional number of images. When count is greater than 1, extra files are saved with numeric suffixes.
- `--size`, `--quality`, `--aspect-ratio`, `--resolution`, `--moderation`: pass only when the user or upstream workflow needs them. `--moderation` is OpenAI-only.
- `--api-key-env <name>`: environment variable that contains the provider API key.
- `--dry-run`: validate inputs and report requested output paths without calling the provider.
- `--verbose`: print progress logs.
- `--force` / `-f`: overwrite existing outputs.

## Model Listing

```shell
node <this-skill-directory>/scripts/generate-image.mjs models --provider openai
node <this-skill-directory>/scripts/generate-image.mjs models --provider xai
```

The `codex` provider does not support model listing through this skill.

## Provider: codex

Provider `codex` uses Codex's built-in `image_gen` tool instead of the bundled
CLI. Use it when the user explicitly requests `codex`, asks to use Codex
imagegen, or chooses the no-API-key Codex path.

Codex provider behavior:

- Resolve prompts the same way as the CLI path: prefer prompt files for
  non-trivial prompts, otherwise inline prompt text is allowed.
- If local reference images are needed, inspect them first with the available
  image viewing tool so they are visible in the conversation context, then call
  `image_gen`.
- The built-in tool saves generated images under Codex-managed storage by
  default. After generation, copy or move the selected final image into the
  requested `--output` path or the user-specified project path.
- Never overwrite an existing output unless the user asked to overwrite or the
  run is explicitly disposable. Otherwise choose a sibling versioned filename.
- If `--metadata` or an equivalent metadata path is requested, write metadata
  manually after the image is saved. Use `provider: "codex"`, `model:
  "codex-imagegen"`, the resolved prompt, reference paths, options, status,
  output paths, and any error message. Token usage is usually unavailable.
- Treat `--count` as repeated built-in image generations. Do not rely on a
  single built-in call to create multiple distinct files unless the user only
  wants preview variants.
- Options such as `--model`, `--api-key-env`, provider model listing, OpenAI
  `--moderation`, xAI `--aspect-ratio`, and xAI `--resolution` are CLI-provider
  controls and should not be promised for `codex`.

Recommended Codex provider sequence:

1. Resolve and validate the prompt, references, output path, count, overwrite
   behavior, and metadata path.
2. Call the built-in `image_gen` tool with a production-ready prompt.
3. Inspect the generated result for subject, style, composition, text accuracy,
   and any requested invariants.
4. Move or copy the accepted image into the requested workspace output path.
5. Write metadata when requested.
6. Report the final saved path and mention that provider `codex` was used.

## Rules

1. Resolve the bundled `.mjs` path from this skill directory. Use the active workspace root as the shell working directory so relative input/output paths resolve against the user's current project.
2. Always pass an explicit output path.
3. Prefer `--prompt-file` when the prompt includes reference guides, long constraints, or user-provided text.
4. Use API keys only through environment variables and `--api-key-env`; do not add key-file flags.
5. Use `--dry-run` before expensive or risky calls when validating command shape.
6. For non-dry-run `gen` calls, request elevated permission before the first provider call so network access is available and failure metadata is not created by a sandbox-only fetch failure.
7. For OpenAI image generation, pass `--moderation low` by default unless the user or upstream workflow explicitly requests another moderation value. Do not pass `--moderation` for xAI.
8. Use `--force` only when the user asks to overwrite or when regenerating a known disposable artifact. If retrying after a failed metadata file was already written, prefer a fresh metadata path unless the existing run directory is disposable and overwrite was approved.
9. If provider `codex` is selected, use the Codex provider workflow instead of the CLI, and clearly report that it was used.
10. Do not call the old `easy-image-gen` package or use `npm run -w` for skill execution.
