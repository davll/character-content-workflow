# Character Content Workflow

Character Content Workflow provides Codex skills for character-based creative workflows. It helps Codex keep character references organized, generate images from prompts and references, and create character-consistent illustrations or stickers.

## Skills

This repository includes four skills:

- `character-registry`: Query and validate character registry data, list available characters/groups/sheets, resolve sheet image paths, and load prompt-building data for generation workflows.
- `image-generation`: Generate or edit images with the bundled image generation CLI. It supports OpenAI and xAI providers through environment variables.
- `illustration-generation`: Create character-consistent illustrations from registered character sheets and optional reference images.
- `sticker-generation`: Create chat-style stickers, LINE/Telegram-style stickers, reaction stickers, chibi stickers, or sticker sheets from registered characters.

## Install

### Install in a Project

Install the skills into a project:

```shell
npx skills add davll/character-content-workflow --all
```

This installs the skills under:

```text
REPO/.agents/skills/
```

### Global Install

Install the skills globally:

```shell
npx skills add davll/character-content-workflow -g
```

## API Keys

Image generation uses provider API keys from environment variables:

Bash:

```bash
export OPENAI_API_KEY="..."
export XAI_API_KEY="..."
```

PowerShell:

```powershell
$env:OPENAI_API_KEY="..."
$env:XAI_API_KEY="..."
```

Inside a project, you can also define the same variables in a `.env` file:

```dotenv
OPENAI_API_KEY=...
XAI_API_KEY=...
```

Use `OPENAI_API_KEY` for OpenAI image generation and `XAI_API_KEY` for xAI image generation.

## Character Registry

The default registry path in a project is:

```text
characters/index.yaml
```

Sheet paths are relative to the location of `index.yaml`. For example, if the registry is `characters/index.yaml`, then `sheets/example.png` resolves to `characters/sheets/example.png`.

For example, [`examples/characters/index.yaml`](examples/characters/index.yaml) registers two characters, a shared group, and the [character sheet image](examples/characters/sheets/mike_x_hiroshi-navy_uniforms.png) that generation workflows should use:

```yaml
---
characters:
  mike:
    names:
      - Mikhail Oryol
      - Михаил Орёл
      - ミハイル・オリョール
      - 米哈伊爾・奧廖爾
  hiroshi:
    names:
      - Hiroshi Amano
      - 天野宏
      - あまの ひろし
groups:
  mike_and_hiroshi:
    characters: [mike, hiroshi]
    sheets:
      navy_uniform:
        path: sheets/mike_x_hiroshi-navy_uniforms.png
        description: Character sheet for Mikhail Oryol and Hiroshi Amano, they are wearing navy uniforms.
```

The generation skills use the registry to find character sheets, preserve character identity, and build safer prompts for illustrations and stickers.

## Example Requests

After installing the skills, you can ask Codex things like:

> **$character-registry** Validate my character registry.

> **$sticker-generation** Create a chibi sticker sheet for Mikhail with happy, angry, surprised, and sleepy reactions.

> **$illustration-generation** Generate an illustration of Mikhail and Hiroshi walking through a rainy city street at night.

> **$image-generation** Generate an image with this prompt and save it to output/example.png.

## Development

Install dependencies:

```powershell
npm install
```

Build packages:

```powershell
npm run build
```

Run tests:

```powershell
npm test
```

Rebuild bundled skill scripts after changing source packages:

```powershell
npm run build:skill
```

You can also rebuild specific bundled skill scripts:

```powershell
npm run build:generate-image-skill
npm run build:character-registry-skill
```

Sync built skills into `.agents/skills/` for local testing:

```powershell
npm run sync:agents-skills
```
