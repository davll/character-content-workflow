---
name: meme-igiari
description: Generate a character-consistent meme illustration inspired by the Ace Attorney-style "異議あり!" / "Objection!" pointing pose and intense rebuttal expression. Use when the user invokes $meme/igiari or asks for one character in this objection-style scene, using this skill's template image only as a pointing gesture, expression, dramatic courtroom-composition, and text-placement reference before handing off to illustration-generation.
---

# Meme Igiari

Transform the user's `$meme/igiari` request into an `illustration-generation` request. This skill owns only the meme-specific prompt rewrite and template reference handoff.

Use `assets/template.jpg` as the required external reference image.

## Workflow

1. Read the user request and remove the `$meme/igiari` trigger.
2. Verify the remaining prompt is non-empty.
3. Identify one target character or one registry group from the prompt.
4. Select the text language and exact visible line.
5. Rewrite the prompt into a downstream illustration prompt.
6. If the user requested dry-run behavior, report the downstream prompt, selected language, selected line, and template reference without generating.
7. Otherwise hand off the downstream prompt and `assets/template.jpg` to `illustration-generation`.

## Target Character

Require the user prompt to name exactly one target character or one registry group that should appear as the objection subject.

If no target character is named, stop before handoff and ask the user to specify the character. If multiple unrelated target characters are named and the request does not clearly say the group should be treated as one subject, stop and ask for clarification.

Do not infer missing character identity from prior turns.

## Language Selection

Choose exactly one visible line:

- Japanese: `異議あり！`
- Chinese: `異議！`
- English: `Objection!`

Use Japanese by default.

Use Japanese when the user explicitly requests Japanese text with wording such as `日文`, `日語`, `Japanese`, `jp`, or `ja`, or when no language is specified.

Use Chinese when the user requests Chinese with wording such as `中文`, `Chinese`, `zh`, or `tw`.

Use English when the user requests English with wording such as `英文`, `English`, `en`, or `Objection`.

If the user requests more than one language, stop before handoff and ask the user to choose one language.

If the user explicitly asks for no text, keep the objection pose and expression but omit visible text.

## Prompt Rewrite

Preserve the user's core content, including:

- character name
- outfit hints such as `(outfit=suit)`
- scene additions
- style constraints
- requested expression, mood, or camera notes

Remove only the skill trigger and redundant meme phrasing. Then add meme-specific direction:

```text
<preserved user request>，角色呈現「selected line」式的強烈反駁瞬間，手臂向前指向畫面外或鏡頭方向，表情堅定、激昂、自信，帶有法庭辯論高潮的戲劇張力。構圖參考 template 圖的指向手勢、上半身姿勢、表情強度、鏡頭角度、速度感與文字位置。畫面中加入清楚可讀的 selected language 台詞：「<selected line>」
```

When no visible text is requested, replace the final sentence with:

```text
畫面不要加入任何可讀文字、字幕、標語或對白框。
```

Also include these constraints in the downstream prompt:

- Use the template only for pointing gesture, hand direction, upper-body pose, facial intensity, courtroom-rebuttal mood, dramatic composition, camera tension, and text placement.
- Do not use the template for clothing, character identity, body traits, art style, color palette, original character design, hair, props, background ownership, or world setting.
- Character identity, outfit ownership, body traits, hair, proportions, and stable visual details must come from registry-selected character sheets and the user's prompt, not from the template.
- Include the exact selected visible line by default unless the user explicitly asks for no text.
- Do not copy unrelated template text, labels, watermarks, source-specific artifacts, original series character details, legal badges, UI elements, or game-specific logos.

## Reference Handoff

Hand off to `illustration-generation` with:

- Downstream prompt: the rewritten prompt above.
- External reference: `skills/meme-igiari/assets/template.jpg`.
- Template role: `pointing-gesture/expression/dramatic-courtroom-composition/text-placement reference for the igiari objection meme scene`.

Do not select registry sheets in this skill. Let `illustration-generation` resolve characters, outfits, sheet references, artifact paths, and final rendering.

## Dry Run

Treat these as dry-run requests: `dry-run`, `只看 prompt`, `不要生成`, `don't generate`, `prompt only`.

In dry-run mode, do not call `illustration-generation`. Report:

- the downstream prompt
- the selected text language
- the selected visible line, or `none` when text is disabled
- the template image path
- the template role

## Failure Cases

Stop before handoff when:

- the prompt is empty after removing `$meme/igiari`
- no target character or group is named
- multiple possible target characters are named without a clear single subject or group subject
- more than one visible text language is requested
- `assets/template.jpg` is missing

Keep the error short and actionable.

## Example

User request:

```text
$meme/igiari Mikhail
```

Downstream prompt:

```text
Mikhail，角色呈現「異議あり！」式的強烈反駁瞬間，手臂向前指向畫面外或鏡頭方向，表情堅定、激昂、自信，帶有法庭辯論高潮的戲劇張力。構圖參考 template 圖的指向手勢、上半身姿勢、表情強度、鏡頭角度、速度感與文字位置。畫面中加入清楚可讀的日文台詞：「異議あり！」

Use the template only for pointing gesture, hand direction, upper-body pose, facial intensity, courtroom-rebuttal mood, dramatic composition, camera tension, and text placement. Do not use the template for clothing, character identity, body traits, art style, color palette, original character design, hair, props, background ownership, or world setting. Character identity, outfit ownership, body traits, hair, proportions, and stable visual details must come from registry-selected character sheets and the user's prompt, not from the template. Do not copy unrelated template text, labels, watermarks, source-specific artifacts, original series character details, legal badges, UI elements, or game-specific logos.
```

Chinese request:

```text
$meme/igiari Mikhail 中文
```

Chinese downstream prompt:

```text
Mikhail，角色呈現「異議！」式的強烈反駁瞬間，手臂向前指向畫面外或鏡頭方向，表情堅定、激昂、自信，帶有法庭辯論高潮的戲劇張力。構圖參考 template 圖的指向手勢、上半身姿勢、表情強度、鏡頭角度、速度感與文字位置。畫面中加入清楚可讀的中文台詞：「異議！」

Use the template only for pointing gesture, hand direction, upper-body pose, facial intensity, courtroom-rebuttal mood, dramatic composition, camera tension, and text placement. Do not use the template for clothing, character identity, body traits, art style, color palette, original character design, hair, props, background ownership, or world setting. Character identity, outfit ownership, body traits, hair, proportions, and stable visual details must come from registry-selected character sheets and the user's prompt, not from the template. Do not copy unrelated template text, labels, watermarks, source-specific artifacts, original series character details, legal badges, UI elements, or game-specific logos.
```

English request:

```text
$meme/igiari Mikhail English
```

English downstream prompt:

```text
Mikhail，角色呈現「Objection!」式的強烈反駁瞬間，手臂向前指向畫面外或鏡頭方向，表情堅定、激昂、自信，帶有法庭辯論高潮的戲劇張力。構圖參考 template 圖的指向手勢、上半身姿勢、表情強度、鏡頭角度、速度感與文字位置。畫面中加入清楚可讀的英文台詞：「Objection!」

Use the template only for pointing gesture, hand direction, upper-body pose, facial intensity, courtroom-rebuttal mood, dramatic composition, camera tension, and text placement. Do not use the template for clothing, character identity, body traits, art style, color palette, original character design, hair, props, background ownership, or world setting. Character identity, outfit ownership, body traits, hair, proportions, and stable visual details must come from registry-selected character sheets and the user's prompt, not from the template. Do not copy unrelated template text, labels, watermarks, source-specific artifacts, original series character details, legal badges, UI elements, or game-specific logos.
```
