# Brand — profile `default`

**Role:** How this profile looks when rendered — logo, colors, fonts, display name.  
**Not:** How copy sounds (`./voice.md`), topics (`./pillars.md`), or readers (`./audience.md`).

Rule of thumb: anything that renders to **pixels or color** lives here; anything that only shapes **wording** lives in `voice.md`.

## Identity (rendered)

| Field | Value |
|-------|--------|
| **Display name** | (fill) |
| **Handle** | (fill) |
| **Logo** | `none` (or a media id from `../../media/_index.md`) |

## Colors (tokens)

Hex values. These become theme tokens at render time.

| Token | Hex | Use |
|-------|-----|-----|
| **primary** | (fill) | Headlines, key accents |
| **accent** | (fill) | Highlights, callouts |
| **background** | (fill) | Page background |
| **text** | (fill) | Body text |

## Fonts

| Slot | Font |
|------|------|
| **Heading** | (fill) |
| **Body** | (fill) |

## Render binding (cache — Agent writes)

Filled automatically the first time a run renders. Do not edit by hand.

| Field | Value |
|-------|-------|
| **logo hosted_image_id** | (empty until first render) |
| **theme snapshot** | (empty until first render) |
