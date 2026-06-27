---
name: meme-mind-ur-own-business
description: Generate a character-consistent meme illustration inspired by the "我勸你少管閒事" pointing-at-camera pressure meme. Use when the user invokes $meme/mind-ur-own-business or asks for one character in this meme scene, using this skill's template image only as a facial-expression, pressure mood, pointing gesture, close-up composition, and title-placement reference before handing off to illustration-generation.
---

# Meme Mind Ur Own Business

Transform the user's `$meme/mind-ur-own-business` request into an `illustration-generation` request. This skill owns only the meme-specific prompt rewrite and template reference handoff.

Use `assets/template.jpg` as the required external reference image.

## Workflow

1. Read the user request and remove the `$meme/mind-ur-own-business` trigger.
2. Verify the remaining prompt is non-empty.
3. Identify the target character from the prompt.
4. Rewrite the prompt into a downstream illustration prompt.
5. If the user requested dry-run behavior, report the downstream prompt and template reference without generating.
6. Otherwise hand off the downstream prompt and `assets/template.jpg` to `illustration-generation`.

## Target Character

Require the user prompt to name exactly one target character or one registry group that should be rendered as the meme subject.

If no target character is named, stop before handoff and ask the user to specify the character. If multiple unrelated target characters are named and the request does not clearly say which one should perform the gesture, stop and ask for clarification.

Do not infer missing character identity from prior turns.

## Prompt Rewrite

Preserve the user's core content, including:

- character name
- outfit hints such as `(outfit=suit)`
- scene additions
- style constraints
- requested expression, mood, or camera notes

Remove only the skill trigger and redundant meme phrasing. Then add meme-specific direction:

```text
<preserved user request>，角色以近距離正面構圖面向鏡頭，瞪大眼睛並露出嚴肅、帶有警告意味的表情，整體氣氛有明顯施壓感與壓迫感。角色伸出一隻手指直接指向鏡頭，手勢在前景放大，像是在當面警告觀眾。畫面下方必須加入清楚可讀的粗黑中文標題文字「我勸你少管閒事」。
```

Also include these constraints in the downstream prompt:

- Use the template only for the wide-eyed serious expression, pressure mood, pointing-at-camera gesture, close-up framing, and bottom title placement.
- Do not use the template for animal species, fur pattern, character identity, body traits, art style, color palette, or personality.
- Character identity, outfit ownership, body traits, hair, proportions, and stable visual details must come from registry-selected character sheets and the user's prompt, not from the template.
- The visible title text must be exactly `我勸你少管閒事`.
- Do not copy template blur, low-resolution artifacts, watermarks, source-specific artifacts, or the original animal design.

## Reference Handoff

Hand off to `illustration-generation` with:

- Downstream prompt: the rewritten prompt above.
- External reference: `skills/meme-mind-ur-own-business/assets/template.jpg`.
- Template role: `wide-eyed serious expression / pressure mood / pointing-at-camera gesture / close-up composition / bottom title-placement reference for the 我勸你少管閒事 meme scene`.

Do not select registry sheets in this skill. Let `illustration-generation` resolve characters, outfits, sheet references, artifact paths, and final rendering.

## Dry Run

Treat these as dry-run requests: `dry-run`, `只看 prompt`, `不要生成`, `don't generate`, `prompt only`.

In dry-run mode, do not call `illustration-generation`. Report:

- the downstream prompt
- the template image path
- the template role

## Failure Cases

Stop before handoff when:

- the prompt is empty after removing `$meme/mind-ur-own-business`
- no target character or group is named
- multiple possible target characters are named without a clear gesturing subject
- `assets/template.jpg` is missing

Keep the error short and actionable.

## Example

User request:

```text
$meme/mind-ur-own-business Mikhail
```

Downstream prompt:

```text
Mikhail，角色以近距離正面構圖面向鏡頭，瞪大眼睛並露出嚴肅、帶有警告意味的表情，整體氣氛有明顯施壓感與壓迫感。角色伸出一隻手指直接指向鏡頭，手勢在前景放大，像是在當面警告觀眾。畫面下方必須加入清楚可讀的粗黑中文標題文字「我勸你少管閒事」。

Use the template only for the wide-eyed serious expression, pressure mood, pointing-at-camera gesture, close-up framing, and bottom title placement. Do not use the template for animal species, fur pattern, character identity, body traits, art style, color palette, or personality. Character identity, outfit ownership, body traits, hair, proportions, and stable visual details must come from registry-selected character sheets and the user's prompt, not from the template. The visible title text must be exactly `我勸你少管閒事`. Do not copy template blur, low-resolution artifacts, watermarks, source-specific artifacts, or the original animal design.
```
