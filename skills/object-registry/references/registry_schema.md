# Object Registry Schema Reference

This reference explains how to create or modify object registry YAML safely. It is an agent-facing semantic guide, not a replacement for the TypeScript/Zod schema or CLI validation.

## Top-Level Shape

```yaml
objects: {}
```

`objects` stores reusable props or object designs that downstream generation workflows can resolve by aliases and convert into prompt guidance.

## Objects

```yaml
objects:
  vintage_rangefinder:
    names:
      - Vintage 35mm rangefinder
      - Compact rangefinder camera
    category: camera
    subtype: 35mm rangefinder
    summary: Compact vintage-style 35mm rangefinder camera.
    visual_traits:
      - compact silver-and-black metal rangefinder body
      - flat top plate with a slim viewfinder window
      - small lens close to the body
    accessories:
      - thin neck or wrist strap
    usage_profiles:
      carrying:
        - held one-handed at waist or chest height
    constraints:
      - Keep the body compact, flat-topped, and lighter in handling than a larger SLR.
    reference_images:
      - id: front_angle
        path: references/cameras/vintage_rangefinder-front.png
        role: object_design
        prompt_usage: Use only for compact rangefinder body shape, scale, lens placement, viewfinder window placement, and strap details.
```

- `names`: Display names, aliases, localized names, and search names that help match user prompts.
- `category`: Broad class such as `camera`, `weapon`, `tool`, `instrument`, `bag`, `vehicle`, `accessory`, or `other`.
- `subtype`: Optional category-specific subtype.
- `summary`: Concise selection-oriented description.
- `visual_traits`: Reusable visual design details.
- `accessories`: Expected or common accessories.
- `usage_profiles`: Map from usage mode to handling and prompt guidance.
- `constraints`: Hard rules that prevent common visual mistakes.
- `reference_images`: Optional durable images for object design reference.

## Reference Images

Each reference image entry has:

- `id`: Stable reference ID for CLI lookup.
- `path`: Path relative to the object registry root.
- `role`: Semantic role such as `object_design`.
- `prompt_usage`: Pathless instruction for how to use the reference in a Reference Guide.

Path rules:

- Paths must be relative to the registry root.
- Paths must stay inside the registry root after resolution.
- Paths must point to an existing file.
- Files must be JPEG or PNG by content signature.
- Do not use absolute paths.
- Do not use paths that escape with `..`.

## Prompt-Building Rules

Object prompt data may add details about:

- Object body shape, scale, silhouette, material, color, and visible mechanisms.
- Expected accessories such as straps, cases, cables, tools, or mounts.
- Usage posture and handling when the usage profile explicitly describes it.
- Constraints to prevent category confusion, size drift, or incorrect handling.

Object prompt data must not override:

- Character identity.
- Outfit ownership.
- Body proportions or skin tone.
- Relationship logic.
- Scene composition, unless the selected usage profile explicitly describes object handling.

## Camera Guidance

Use the `camera` category with subtypes for camera-specific handling. Initial supported camera subtypes include `35mm rangefinder` and `35mm SLR`.

Rangefinder guidance should emphasize:

- Compact, flatter body.
- Flat top plate and separate viewfinder-window silhouette.
- Smaller lens.
- Casual carrying.
- Shooting pose close to one eye but less bulky than SLR.
- Thin leather or woven neck/wrist strap when applicable.

SLR guidance should emphasize:

- Larger body.
- Prominent prism hump.
- Right-hand grip.
- Left hand supporting the lens when shooting.
- Bulkier and heavier carrying posture.
- More visible strap.

## Safe Inference Rules

- It is safe to infer object IDs and aliases from explicit names in the user prompt.
- It is safe to add category-specific usage profiles when they describe well-established visible handling for the object type.
- It is safe to add reference images only from concrete existing workspace paths or uploaded files copied into the workspace.
- It is not safe to invent reference image paths.
- It is not safe to let object details change character identity, outfits, body traits, or ownership.
- Validate after writing so the CLI can catch schema, alias, path, and image-signature issues.
