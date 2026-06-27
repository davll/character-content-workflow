---
name: meme-death-pose
description: Generate a character-consistent meme illustration inspired by the classic Yamcha-style death pose: one character lying face-down in a side-prone pose inside a circular crater after impact. Use when the user invokes $meme/death-pose or asks for one character in a Yamcha death pose / ヤムチャ死亡ポーズ / 飲茶死亡姿勢 scene, using this skill's template image as a strict face-down pose, back-facing-up body-layout, crater-composition, and impact-scene reference before handing off to illustration-generation.
---

# Meme Death Pose

Transform the user's `$meme/death-pose` request into an `illustration-generation` request. This skill owns only the meme-specific prompt rewrite and template reference handoff.

Use `assets/template.jpg` as the required external reference image.

## Workflow

1. Read the user request and remove the `$meme/death-pose` trigger.
2. Verify the remaining prompt is non-empty.
3. Identify one target character or one registry group from the prompt.
4. Rewrite the prompt into a downstream illustration prompt.
5. If the user requested dry-run behavior, report the downstream prompt and template reference without generating.
6. Otherwise hand off the downstream prompt and `assets/template.jpg` to `illustration-generation`.

## Target Character

Require the user prompt to name exactly one target character or one registry group that should appear as the meme subject.

If no target character is named, stop before handoff and ask the user to specify the character. If multiple unrelated target characters are named and the request does not clearly say the group should be treated as one subject, stop and ask for clarification.

Do not infer missing character identity from prior turns.

## Prompt Rewrite

Preserve the user's core content, including:

- character name
- outfit hints such as `(outfit=suit)`
- scene additions
- style constraints
- requested expression, mood, or camera notes
- explicit requests for text, captions, or no text

Remove only the skill trigger and redundant meme phrasing. Then add meme-specific direction:

```text
<preserved user request>，角色以臉朝下、背部朝上的側趴姿勢倒在圓形隕石坑或爆炸坑中央，呈現經典死亡姿勢迷因的戰鬥後倒地場面。以 template 圖作為嚴格姿勢來源：重現相同的 face-down side-prone body layout、頭部朝向坑底的位置、背部與肩膀作為主要可見身體面、軀幹角度、四肢位置、身體在坑洞中的位置、俯視鏡頭角度、圓形坑洞比例、碎裂地面放射方向與整體 pose silhouette。角色身份、服裝、髮型、體型比例與穩定視覺細節由 registry character sheet 決定，將這些角色細節自然套用到 template 的姿勢上。氣氛是誇張但非血腥的敗北瞬間，像被巨大衝擊打進地面後留下的喜劇式戰鬥餘韻。
```

If the user explicitly requests visible text, include the requested exact text and place it as a caption, subtitle, or small meme label without covering the character.

If the user does not explicitly request visible text, add:

```text
畫面不要加入任何可讀文字、字幕、標語、對白框或水印。
```

Also include these constraints in the downstream prompt:

- Treat the template as the strict primary source for death-pose silhouette, face-down side-prone body layout, back-facing-up torso, head turned toward the crater floor, limb placement, body orientation, crater shape, broken-ground layout, impact-scene composition, and camera angle.
- Transfer the registry character into the template pose: adapt outfit folds, hair, accessories, and body proportions around the pose while keeping the pose recognizable.
- Treat registry-selected character sheets and the user's prompt as the source for character identity, outfit ownership, body traits, hair, proportions, and stable visual details.
- Keep the scene stylized, comedic, and non-graphic, with dust, scuffs, cracked earth, and impact debris instead of realistic injury detail.
- Use the template for pose and composition only; use the character sheets for the character. Keep source-series character design, clothing, setting, text, labels, and watermarks out of the generated image.

## Reference Handoff

Hand off to `illustration-generation` with:

- Downstream prompt: the rewritten prompt above.
- External reference: `skills/meme-death-pose/assets/template.jpg`.
- Template role: `strict face-down death-pose silhouette/back-facing-up body-layout/limb-placement/crater-composition/broken-ground/impact-scene reference for the death-pose meme scene`.

Do not select registry sheets in this skill. Let `illustration-generation` resolve characters, outfits, sheet references, artifact paths, and final rendering.

## Dry Run

Treat these as dry-run requests: `dry-run`, `只看 prompt`, `不要生成`, `don't generate`, `prompt only`.

In dry-run mode, do not call `illustration-generation`. Report:

- the downstream prompt
- the template image path
- the template role

## Failure Cases

Stop before handoff when:

- the prompt is empty after removing `$meme/death-pose`
- no target character or group is named
- multiple possible target characters are named without a clear single subject or group subject
- `assets/template.jpg` is missing

Keep the error short and actionable.

## Example

User request:

```text
$meme/death-pose Mikhail
```

Downstream prompt:

```text
Mikhail，角色以臉朝下、背部朝上的側趴姿勢倒在圓形隕石坑或爆炸坑中央，呈現經典死亡姿勢迷因的戰鬥後倒地場面。以 template 圖作為嚴格姿勢來源：重現相同的 face-down side-prone body layout、頭部朝向坑底的位置、背部與肩膀作為主要可見身體面、軀幹角度、四肢位置、身體在坑洞中的位置、俯視鏡頭角度、圓形坑洞比例、碎裂地面放射方向與整體 pose silhouette。角色身份、服裝、髮型、體型比例與穩定視覺細節由 registry character sheet 決定，將這些角色細節自然套用到 template 的姿勢上。氣氛是誇張但非血腥的敗北瞬間，像被巨大衝擊打進地面後留下的喜劇式戰鬥餘韻。

畫面不要加入任何可讀文字、字幕、標語、對白框或水印。

Treat the template as the strict primary source for death-pose silhouette, face-down side-prone body layout, back-facing-up torso, head turned toward the crater floor, limb placement, body orientation, crater shape, broken-ground layout, impact-scene composition, and camera angle. Transfer the registry character into the template pose: adapt outfit folds, hair, accessories, and body proportions around the pose while keeping the pose recognizable. Treat registry-selected character sheets and the user's prompt as the source for character identity, outfit ownership, body traits, hair, proportions, and stable visual details. Keep the scene stylized, comedic, and non-graphic, with dust, scuffs, cracked earth, and impact debris instead of realistic injury detail. Use the template for pose and composition only; use the character sheets for the character. Keep source-series character design, clothing, setting, text, labels, and watermarks out of the generated image.
```
