---
name: meme-yaranaika
description: Generate a character-consistent meme illustration inspired by Abe Takakazu's iconic "yaranaika" bench pose and line. Use when the user invokes $meme/yaranaika or asks for one character in a yaranaika-style meme scene, using this skill's template image only as a bench, pose, and hand-gesture reference before handing off to illustration-generation.
---

# Meme Yaranaika

Transform the user's `$meme/yaranaika` request into an `illustration-generation` request. This skill owns only the meme-specific prompt rewrite and template reference handoff.

Use `assets/template.png` as the required external reference image.

## Workflow

1. Read the user request and remove the `$meme/yaranaika` trigger.
2. Verify the remaining prompt is non-empty.
3. Identify the target character from the prompt.
4. Rewrite the prompt into a downstream illustration prompt.
5. If the user requested dry-run behavior, report the downstream prompt and template reference without generating.
6. Otherwise hand off the downstream prompt and `assets/template.png` to `illustration-generation`.

## Target Character

Require the user prompt to name exactly one target character or one registry group that should be rendered as the yaranaika subject.

If no target character is named, stop before handoff and ask the user to specify the character. If multiple unrelated target characters are named and the request does not clearly say which one should perform the pose, stop and ask for clarification.

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
<preserved user request>，角色坐在長椅上，一手停在衣領下方並正在開衣領，衣領被拉開、半露出胸部，致敬 template 圖的「やらないか」招牌坐姿與整體身體朝向。構圖參考 template 圖中的長椅、坐姿、腿部姿勢，以及身體朝向；手部動作以「正在開衣領」為優先，不照抄 template 的邀請手勢。
```

Also include these constraints in the downstream prompt:

- Use the template only for the bench, seated pose, body positioning, hand gesture, and broad composition.
- Do not use the template for facial expression, clothing, character identity, body traits, art style, color palette, or personality.
- Character identity, outfit ownership, body traits, hair, proportions, and stable visual details must come from registry-selected character sheets and the user's prompt, not from the template.
- Do not copy template text, speech bubbles, labels, watermarks, source-specific artifacts, or the original character design unless the user explicitly asks for text.
- Include the phrase `やらないか` as visible dialogue/text only when the user explicitly requests text in the image.

## Reference Handoff

Hand off to `illustration-generation` with:

- Downstream prompt: the rewritten prompt above.
- External reference: `skills/meme-yaranaika/assets/template.png`.
- Template role: `bench/pose/hand-gesture/composition reference for the yaranaika meme scene`.

Do not select registry sheets in this skill. Let `illustration-generation` resolve characters, outfits, sheet references, artifact paths, and final rendering.

## Dry Run

Treat these as dry-run requests: `dry-run`, `只看 prompt`, `不要生成`, `don't generate`, `prompt only`.

In dry-run mode, do not call `illustration-generation`. Report:

- the downstream prompt
- the template image path
- the template role

## Failure Cases

Stop before handoff when:

- the prompt is empty after removing `$meme/yaranaika`
- no target character or group is named
- multiple possible target characters are named without a clear posing subject
- `assets/template.png` is missing

Keep the error short and actionable.

## Example

User request:

```text
$meme/yaranaika Mikhail
```

Downstream prompt:

```text
Mikhail，角色坐在長椅上，一手停在衣領下方並正在開衣領，衣領被拉開、半露出胸部，致敬 template 圖的「やらないか」招牌坐姿與整體身體朝向。構圖參考 template 圖中的長椅、坐姿、腿部姿勢，以及身體朝向；手部動作以「正在開衣領」為優先，不照抄 template 的邀請手勢。

Use the template only for the bench, seated pose, body positioning, hand gesture, and broad composition. Do not use the template for facial expression, clothing, character identity, body traits, art style, color palette, or personality. Character identity, outfit ownership, body traits, hair, proportions, and stable visual details must come from registry-selected character sheets and the user's prompt, not from the template. Do not copy template text, speech bubbles, labels, watermarks, source-specific artifacts, or the original character design unless explicitly requested.
```
