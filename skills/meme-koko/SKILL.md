---
name: meme-koko
description: Generate a character-consistent meme illustration inspired by the "koko" pointing scene with the visible title "こ⇧こ⇩". Use when the user invokes $meme/koko or asks for characters walking together with one explicit character pointing the way, using this skill's template image as a pose/composition/background reference before handing off to illustration-generation.
---

# Meme Koko

Transform the user's `$meme/koko` request into an `illustration-generation` request. This skill owns only the meme-specific prompt rewrite and template reference handoff.

Use `assets/template.jpg` as the required external reference image.

## Workflow

1. Read the user request and remove the `$meme/koko` trigger.
2. Verify the remaining prompt is non-empty.
3. Identify the pointing character from explicit wording only.
4. Add the fixed visible title `こ⇧こ⇩`.
5. Rewrite the prompt into a downstream illustration prompt.
6. If the user requested dry-run behavior, report the downstream prompt, selected title, and template reference without generating.
7. Otherwise hand off the downstream prompt and `assets/template.jpg` to `illustration-generation`.

## Pointing Character

Require the user to explicitly name who points the way. Accept clear patterns such as:

- `<character> 指路`
- `其中 <character> 指路`
- `<character> 手指向前方`
- `<character> points ahead`
- `<character> points the way`

If the pointing character is missing or ambiguous, stop before handoff and ask the user to specify who is pointing. Do not infer the pointing character. Do not default to the last listed character.

## Prompt Rewrite

Preserve the user's core content, including:

- character names
- groups or relationships
- outfit hints such as `(outfit=hawaiian_summer)`
- scene additions
- style constraints

Remove only the skill trigger and redundant pointing phrasing. Then add meme-specific direction:

```text
<preserved user request>，其中 <pointing character> 手指向道路前方，致敬 template 圖的「ここ」指路手勢。所有角色正在一起走路。構圖嚴格參考 template 圖的走路隊形、角色間距、鏡頭角度，以及道路/街景背景。畫面上方加入清楚可讀的標題文字：「こ⇧こ⇩」，標題文字底下保留乾淨留白區域，不要讓角色、背景細節、雜訊或其他元素穿過或壓住標題。
```

Also include these constraints in the downstream prompt:

- Use the template only for pose, interaction, composition, camera feel, and background.
- Character identity, outfit ownership, body traits, hair, proportions, and stable visual details must come from registry-selected character sheets, not from the template.
- Include the exact visible title `こ⇧こ⇩` by default unless the user explicitly asks for no text.
- Reserve a clean blank/negative-space title area beneath and around the title so the text remains readable.
- Do not copy template text, subtitles, labels, watermarks, or source-specific artifacts. Only add the skill-specified title `こ⇧こ⇩` unless the user explicitly requests different text.

## Reference Handoff

Hand off to `illustration-generation` with:

- Downstream prompt: the rewritten prompt above.
- External reference: `skills/meme-koko/assets/template.jpg`.
- Template role: `pose/interaction/composition/background reference for the koko pointing scene`.

Do not select registry sheets in this skill. Let `illustration-generation` resolve characters, outfits, sheet references, artifact paths, and final rendering.

## Dry Run

Treat these as dry-run requests: `dry-run`, `只看 prompt`, `不要生成`, `don't generate`, `prompt only`.

In dry-run mode, do not call `illustration-generation`. Report:

- the downstream prompt
- the selected title
- the template image path
- the template role

## Failure Cases

Stop before handoff when:

- the prompt is empty after removing `$meme/koko`
- the pointing character is missing
- the pointing character is ambiguous
- `assets/template.jpg` is missing

Keep the error short and actionable.

## Example

User request:

```text
$meme/koko Mikhail & Hiroshi 一起走路，其中 Hiroshi 指路
```

Downstream prompt:

```text
Mikhail & Hiroshi 一起走路，其中 Hiroshi 手指向道路前方，致敬 template 圖的「ここ」指路手勢。所有角色正在一起走路。構圖嚴格參考 template 圖的走路隊形、角色間距、鏡頭角度，以及道路/街景背景。畫面上方加入清楚可讀的標題文字：「こ⇧こ⇩」，標題文字底下保留乾淨留白區域，不要讓角色、背景細節、雜訊或其他元素穿過或壓住標題。

Use the template only for pose, interaction, composition, camera feel, and background. Character identity, outfit ownership, body traits, hair, proportions, and stable visual details must come from registry-selected character sheets, not from the template. Include the exact visible title `こ⇧こ⇩` by default unless the user explicitly asks for no text. Reserve a clean blank/negative-space title area beneath and around the title so the text remains readable. Do not copy template text, subtitles, labels, watermarks, or source-specific artifacts. Only add the skill-specified title `こ⇧こ⇩` unless explicitly requested.
```
