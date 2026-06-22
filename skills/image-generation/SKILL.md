---
name: image-generation
description: Generate or edit images with the bundled repository-local generate-image CLI. Use when Codex needs direct text-to-image generation, image editing from JPEG/PNG/WebP references, provider model listing, image generation dry runs, or another workflow needs a stable image-generation command. Supports OpenAI and xAI providers through environment-variable API keys.
---
# Image Generation

Use the bundled single-file CLI from this skill's own directory. Resolve the
script path relative to this `SKILL.md`, not relative to the user's workspace
root. Run the command with the active workspace root as the shell working
directory so input and output paths still resolve against the user's project:

```shell
node <this-skill-directory>/scripts/generate-image.mjs <command> [options]
```

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
  --prompt-file path/to/prompt.txt `
  --output path/to/output.png
```

For a short prompt, inline text is allowed:

```shell
node <this-skill-directory>/scripts/generate-image.mjs gen --provider openai --prompt-text "Prompt text" --output path/to/output.png
```

Use reference images for image-to-image or editing workflows. References must be JPEG, PNG, or WebP, and their order is the order described in the prompt as `1st image`, `2nd image`, etc.

```shell
node <this-skill-directory>/scripts/generate-image.mjs gen `
  --provider openai `
  --reference path/to/ref1.png path/to/ref2.jpg `
  --prompt-file path/to/prompt.txt `
  --output path/to/output.png
```

Use `--provider xai` for xAI image generation/editing. xAI defaults to `XAI_API_KEY`; OpenAI defaults to `OPENAI_API_KEY`.

## Arguments

- `--output` / `-o`: required output image path. The CLI creates the output directory.
- `--metadata <path>`: optional metadata JSON path. When provided, the CLI records the resolved prompt, reference paths, provider/model, options, status, output paths, token usage when available, and errors when generation fails.
- `--prompt-file <path>` or `--prompt-text <text>`: one is required.
- `--provider` / `-p`: `openai` or `xai`. Default is `openai`.
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

## Rules

1. Resolve the bundled `.mjs` path from this skill directory. Use the active workspace root as the shell working directory so relative input/output paths resolve against the user's current project.
2. Always pass an explicit output path.
3. Prefer `--prompt-file` when the prompt includes reference guides, long constraints, or user-provided text.
4. Use API keys only through environment variables and `--api-key-env`; do not add key-file flags.
5. Use `--dry-run` before expensive or risky calls when validating command shape.
6. For non-dry-run `gen` calls, request elevated permission before the first provider call so network access is available and failure metadata is not created by a sandbox-only fetch failure.
7. Use `--force` only when the user asks to overwrite or when regenerating a known disposable artifact. If retrying after a failed metadata file was already written, prefer a fresh metadata path unless the existing run directory is disposable and overwrite was approved.
8. Do not call the old `easy-image-gen` package or use `npm run -w` for skill execution.
