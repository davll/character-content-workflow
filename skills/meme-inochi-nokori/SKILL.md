---
name: meme-inochi-nokori
description: Generate a character-consistent meme illustration inspired by the "また生命が残っているではありませんか" / "不是還有生命嗎?" line, with a calm, detached, almost indifferent gaze and expression. Use when the user invokes $meme/inochi-nokori or asks for one character in this meme scene, using this skill's template image only as an indifferent expression, cool gaze, manga-panel composition, and dialogue-placement reference before handing off to illustration-generation.
---

# Meme Inochi Nokori

Transform the user's `$meme/inochi-nokori` request into an `illustration-generation` request. This skill owns only the meme-specific prompt rewrite and template reference handoff.

Use `assets/template.jpg` as the required external reference image.

## Workflow

1. Read the user request and remove the `$meme/inochi-nokori` trigger.
2. Verify the remaining prompt is non-empty.
3. Identify one target character or one registry group from the prompt.
4. Select the dialogue language and exact visible line.
5. Rewrite the prompt into a downstream illustration prompt.
6. If the user requested dry-run behavior, report the downstream prompt, selected language, selected line, and template reference without generating.
7. Otherwise hand off the downstream prompt and `assets/template.jpg` to `illustration-generation`.

## Target Character

Require the user prompt to name exactly one target character or one registry group that should appear as the meme subject.

If no target character is named, stop before handoff and ask the user to specify the character. If multiple unrelated target characters are named and the request does not clearly say the group should be treated as one subject, stop and ask for clarification.

Do not infer missing character identity from prior turns.

## Language Selection

Choose exactly one visible dialogue line:

- Japanese: `また生命が残っているではありませんか`
- Chinese: `不是還有生命嗎?`

Use Japanese by default.

Use Japanese when the user explicitly requests Japanese text with wording such as `日文`, `日語`, `Japanese`, `jp`, or `ja`, or when no language is specified.

Use Chinese when the user requests Chinese with wording such as `中文`, `Chinese`, `zh`, or `tw`.

If the user requests both Chinese and Japanese, stop before handoff and ask the user to choose one language.

If the user explicitly asks for no text, keep the cool, detached expression and manga-panel mood but omit visible text.

## Prompt Rewrite

Preserve the user's core content, including:

- character name
- outfit hints such as `(outfit=suit)`
- scene additions
- style constraints
- requested expression, mood, or camera notes

Remove only the skill trigger and redundant meme phrasing. Then add meme-specific direction:

```text
<preserved user request>，角色呈現「selected line」迷因式的平靜冷淡反應，眼神淡漠、像是在旁觀受傷倒地或狼狽場面的對象，表情近乎不關心但仍保持優雅與壓倒性的從容。構圖參考 template 圖的冷靜俯視感、半身或近景角色 framing、漠然眼神、安靜壓迫感、漫畫分鏡氣氛，以及對白框或字幕位置。畫面中加入清楚可讀的 selected language 台詞：「<selected line>」
```

When no visible text is requested, replace the final sentence with:

```text
畫面不要加入任何可讀文字、字幕、標語或對白框。
```

Also include these constraints in the downstream prompt:

- Use the template only for indifferent gaze, calm detached expression, cool composure, observing/looking-down mood, manga-panel composition, and dialogue/text placement.
- Do not use the template for clothing, character identity, body traits, art style, color palette, original character design, hair, props, background ownership, or world setting.
- Character identity, outfit ownership, body traits, hair, proportions, and stable visual details must come from registry-selected character sheets and the user's prompt, not from the template.
- Include the exact selected visible line by default unless the user explicitly asks for no text.
- Do not copy unrelated template text, labels, watermarks, source-specific artifacts, original series character details, armor, goddess motifs, constellation symbols, or manga page artifacts.

## Reference Handoff

Hand off to `illustration-generation` with:

- Downstream prompt: the rewritten prompt above.
- External reference: `skills/meme-inochi-nokori/assets/template.jpg`.
- Template role: `indifferent-gaze/calm-detached-expression/manga-panel-composition/dialogue-placement reference for the inochi-nokori meme scene`.

Do not select registry sheets in this skill. Let `illustration-generation` resolve characters, outfits, sheet references, artifact paths, and final rendering.

## Dry Run

Treat these as dry-run requests: `dry-run`, `只看 prompt`, `不要生成`, `don't generate`, `prompt only`.

In dry-run mode, do not call `illustration-generation`. Report:

- the downstream prompt
- the selected dialogue language
- the selected visible line, or `none` when text is disabled
- the template image path
- the template role

## Failure Cases

Stop before handoff when:

- the prompt is empty after removing `$meme/inochi-nokori`
- no target character or group is named
- multiple possible target characters are named without a clear single subject or group subject
- both Chinese and Japanese dialogue are requested
- `assets/template.jpg` is missing

Keep the error short and actionable.

## Example

User request:

```text
$meme/inochi-nokori Mikhail
```

Downstream prompt:

```text
Mikhail，角色呈現「また生命が残っているではありませんか」迷因式的平靜冷淡反應，眼神淡漠、像是在旁觀受傷倒地或狼狽場面的對象，表情近乎不關心但仍保持優雅與壓倒性的從容。構圖參考 template 圖的冷靜俯視感、半身或近景角色 framing、漠然眼神、安靜壓迫感、漫畫分鏡氣氛，以及對白框或字幕位置。畫面中加入清楚可讀的日文台詞：「また生命が残っているではありませんか」

Use the template only for indifferent gaze, calm detached expression, cool composure, observing/looking-down mood, manga-panel composition, and dialogue/text placement. Do not use the template for clothing, character identity, body traits, art style, color palette, original character design, hair, props, background ownership, or world setting. Character identity, outfit ownership, body traits, hair, proportions, and stable visual details must come from registry-selected character sheets and the user's prompt, not from the template. Do not copy unrelated template text, labels, watermarks, source-specific artifacts, original series character details, armor, goddess motifs, constellation symbols, or manga page artifacts.
```

Chinese request:

```text
$meme/inochi-nokori Mikhail 中文
```

Chinese downstream prompt:

```text
Mikhail，角色呈現「不是還有生命嗎?」迷因式的平靜冷淡反應，眼神淡漠、像是在旁觀受傷倒地或狼狽場面的對象，表情近乎不關心但仍保持優雅與壓倒性的從容。構圖參考 template 圖的冷靜俯視感、半身或近景角色 framing、漠然眼神、安靜壓迫感、漫畫分鏡氣氛，以及對白框或字幕位置。畫面中加入清楚可讀的中文台詞：「不是還有生命嗎?」

Use the template only for indifferent gaze, calm detached expression, cool composure, observing/looking-down mood, manga-panel composition, and dialogue/text placement. Do not use the template for clothing, character identity, body traits, art style, color palette, original character design, hair, props, background ownership, or world setting. Character identity, outfit ownership, body traits, hair, proportions, and stable visual details must come from registry-selected character sheets and the user's prompt, not from the template. Do not copy unrelated template text, labels, watermarks, source-specific artifacts, original series character details, armor, goddess motifs, constellation symbols, or manga page artifacts.
```
