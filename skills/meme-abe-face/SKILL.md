---
name: meme-abe-face
description: Generate a character-consistent meme illustration inspired by Abe Takakazu's iconic relaxed/ecstatic facial expression. Use when the user invokes $meme/abe-face or asks for one character with the Abe face / 阿部高和舒爽表情, using this skill's template image only as a facial-expression, brushwork, and eye-mouth line reference before handing off to illustration-generation. No title, dialogue, or speech bubble is added by default.
---

# Meme Abe Face

Transform the user's `$meme/abe-face` request into an `illustration-generation` request. This skill owns only the meme-specific prompt rewrite and template reference handoff.

Use `assets/template.jpg` as the required external reference image.

## Workflow

1. Read the user request and remove the `$meme/abe-face` trigger.
2. Verify the remaining prompt is non-empty.
3. Identify one target character or one registry group from the prompt.
4. Rewrite the prompt into a downstream illustration prompt.
5. If the user requested dry-run behavior, report the downstream prompt and template reference without generating.
6. Otherwise hand off the downstream prompt and `assets/template.jpg` to `illustration-generation`.

## Target Character

Require the user prompt to name exactly one target character or one registry group that should show the expression.

If no target character is named, stop before handoff and ask the user to specify the character. If multiple unrelated target characters are named and the request does not clearly say the group should be treated as one subject, stop and ask for clarification.

Do not infer missing character identity from prior turns.

## Prompt Rewrite

Preserve the user's core content, including:

- character name
- outfit hints such as `(outfit=suit)`
- scene additions
- style constraints
- requested camera notes
- requested mood, unless it conflicts with the Abe-face expression

Remove only the skill trigger and redundant meme phrasing. Then add meme-specific direction:

```text
<preserved user request>，角色做出致敬阿部高和經典舒爽表情的臉部演技：雙眼半闔、眉眼呈現粗黑筆刷式的放鬆弧線，鼻梁與鼻翼用簡潔而有力的黑色線條暗示，嘴唇微張或放鬆下垂，整體神韻是舒爽、恍惚、滿足又帶一點喜感的迷因表情。構圖可依使用者要求安排，但臉部表情必須清楚可見；不加入標題、台詞、對白框或文字。
```

Also include these constraints in the downstream prompt:

- Use the template only for the facial expression, half-lidded eyes, eyebrow/eye brushwork, nose and mouth line economy, relaxed ecstatic mood, and broad facial acting.
- Do not use the template for character identity, face shape, hair, clothing, body traits, art style, color palette, original character design, pose, scene, or world setting.
- Character identity, outfit ownership, body traits, hair, proportions, and stable visual details must come from registry-selected character sheets and the user's prompt, not from the template.
- No visible text, title, dialogue, speech bubble, captions, labels, watermarks, source-specific artifacts, or original series character details unless the user explicitly asks for text.
- If the user's requested art style is not manga-like, preserve the user's requested style while translating only the facial acting and line-weight spirit from the template.

## Reference Handoff

Hand off to `illustration-generation` with:

- Downstream prompt: the rewritten prompt above.
- External reference: `skills/meme-abe-face/assets/template.jpg`.
- Template role: `facial-expression/brushwork/half-lidded-eyes/nose-mouth-line-reference for the Abe-face meme expression`.

Do not select registry sheets in this skill. Let `illustration-generation` resolve characters, outfits, sheet references, artifact paths, and final rendering.

## Dry Run

Treat these as dry-run requests: `dry-run`, `只看 prompt`, `不要生成`, `don't generate`, `prompt only`.

In dry-run mode, do not call `illustration-generation`. Report:

- the downstream prompt
- the template image path
- the template role

## Failure Cases

Stop before handoff when:

- the prompt is empty after removing `$meme/abe-face`
- no target character or group is named
- multiple possible target characters are named without a clear single expression subject or group subject
- `assets/template.jpg` is missing

Keep the error short and actionable.

## Example

User request:

```text
$meme/abe-face Mikhail
```

Downstream prompt:

```text
Mikhail，角色做出致敬阿部高和經典舒爽表情的臉部演技：雙眼半闔、眉眼呈現粗黑筆刷式的放鬆弧線，鼻梁與鼻翼用簡潔而有力的黑色線條暗示，嘴唇微張或放鬆下垂，整體神韻是舒爽、恍惚、滿足又帶一點喜感的迷因表情。構圖可依使用者要求安排，但臉部表情必須清楚可見；不加入標題、台詞、對白框或文字。

Use the template only for the facial expression, half-lidded eyes, eyebrow/eye brushwork, nose and mouth line economy, relaxed ecstatic mood, and broad facial acting. Do not use the template for character identity, face shape, hair, clothing, body traits, art style, color palette, original character design, pose, scene, or world setting. Character identity, outfit ownership, body traits, hair, proportions, and stable visual details must come from registry-selected character sheets and the user's prompt, not from the template. No visible text, title, dialogue, speech bubble, captions, labels, watermarks, source-specific artifacts, or original series character details unless the user explicitly asks for text. If the user's requested art style is not manga-like, preserve the user's requested style while translating only the facial acting and line-weight spirit from the template.
```
