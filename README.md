# Character Content Workflow

Character Content Workflow provides Codex skills for character-based creative workflows. It helps Codex keep character references organized, generate images from prompts and references, and create character-consistent illustrations or stickers.

## Skills

This repository includes five skills:

- `character-registry`: Query and validate character registry data, list available characters/groups/sheets, resolve sheet image paths, and load prompt-building data for generation workflows.
- `object-registry`: Query and validate reusable object/prop registry data, list available props, resolve object aliases, load object prompt-building guidance, and resolve object reference image paths.
- `image-generation`: Generate or edit images with the bundled image generation CLI. It supports OpenAI and xAI providers through environment variables.
- `illustration-generation`: Create character-consistent illustrations from registered character sheets and optional reference images.
- `sticker-generation`: Create chat-style stickers, LINE/Telegram-style stickers, reaction stickers, chibi stickers, or sticker sheets from registered characters.

## Recommended Skills

- **brainstorming:** `npx skills add https://github.com/obra/superpowers --skill brainstorming`

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
        summary: Character sheet for Mikhail Oryol and Hiroshi Amano, they are wearing navy uniforms.
```

The generation skills use the registry to find character sheets, preserve character identity, and build safer prompts for illustrations and stickers.

## Object Registry

The default object registry path in a project is:

```text
objects/index.yaml
```

Reference image paths are relative to the location of `index.yaml`. For example, if the registry is `objects/index.yaml`, then `references/cameras/leica_m4-front.png` resolves to `objects/references/cameras/leica_m4-front.png`.

This development repository includes an example registry at [`examples/objects/index.yaml`](examples/objects/index.yaml). Generation skills should still prefer a real project registry at `REPO_ROOT/objects/index.yaml`; the example registry is only a development-repo fallback. Cameras are the first supported example category:

```yaml
objects:
  leica_m4:
    names:
      - Leica M4
      - ライカM4
    category: camera
    subtype: 35mm rangefinder
    summary: Compact vintage 35mm rangefinder camera with a flat body and small lens.
    visual_traits:
      - compact black-and-silver metal rangefinder body
    usage_profiles:
      carrying:
        - carried casually at waist or chest height with one hand around the compact body
    constraints:
      - Do not draw the Leica M4 as a bulky SLR, DSLR, or camera with a prism hump.
```

Illustration workflows and object-aware character sheet variant workflows use the object registry after character selection to preserve prop design, scale, accessories, usage posture, and reference-image ordering without overriding character identity or outfit ownership.

## Example Requests

After installing the skills, you can ask Codex things like:

> **$character-registry** Validate my character registry.

> **$object-registry** Validate my object registry and list available camera props.

> **$sticker-generation** Create a chibi sticker sheet for Mikhail with happy, angry, surprised, and sleepy reactions.

> **$illustration-generation** Generate an illustration of Mikhail and Hiroshi walking through a rainy city street at night.

> **$image-generation** Generate an image with this prompt and save it to output/example.png.

## Development

Install dependencies:

```shell
npm install
```

Build packages:

```shell
npm run build
```

Run tests:

```shell
npm test
```

Rebuild bundled skill scripts after changing source packages:

```shell
npm run build:skill
```

You can also rebuild specific bundled skill scripts:

```shell
npm run build:generate-image-skill
npm run build:character-registry-skill
npm run build:object-registry-skill
```

Sync built skills into `.agents/skills/` for local testing:

```shell
npm run sync:agents-skills
```
