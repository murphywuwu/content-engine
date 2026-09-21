# Media index

Local image vault. Newest rows on top. Image files live beside this index (or in
subfolders); this table is the catalog.

| id | file | sha256 | caption | tags | role | links | rights | hosted_image_id |
|----|------|--------|---------|------|------|-------|--------|-----------------|

Zero starter rows.

## Fields

- **id** — `M-YYYYMMDD-XX`, stable, never reused.
- **file** — path relative to `media/` (e.g. `M-20260917-01.png`).
- **sha256** — content hash. Same hash = same asset; never import a duplicate.
- **caption** — one line describing the image content (e.g. `Notion pricing · annual toggle`).
- **tags** — space-separated, from the closed set below (coarse kind).
- **role** — closed surface for retrieval among one subject's images:
  `logo` | `home` | `pricing` | `settings` | `compare` | `proof` | `other`
- **links** — `P-*` / `R-*` / `C-*` / `RUN-*` / `brand` this asset belongs to.
  Own offers use `P-*`; third-party review subjects use `R-*`.
- **rights** — source or licence note (e.g. `own-screenshot`, `product-press-kit`).
- **hosted_image_id** — cache of the uploaded id; empty until first render.

## Tag set (closed)

| tag | Meaning |
|-----|---------|
| `logo` | Brand logo / mark |
| `avatar` | Profile / handle avatar |
| `product` | Product screenshot or shot |
| `screenshot` | UI / app screenshot |
| `photo` | Photograph |
| `diagram` | Chart, diagram, illustration |
| `bg` | Background / texture |

## Hard gates

- If `tags` include `product` or `screenshot`, `links` **must** include a subject
  `P-*` or `R-*`. No subject → do not ingest; ask which product/recommendation.
- Prefer exactly one primary subject in `links` for product screenshots.
- Retrieval for reviews: filter by subject link first, then `role`, then `caption`.

## Agent rules

- Dedup by `sha256` before adding a row; if the hash exists, reuse that id.
- Tag + role + subject link on ingest so later retrieval by content need works.
- Do **not** upload here. Upload happens once, at render time; write the
  returned id back into `hosted_image_id`.
- Never store binaries inside `runs/` — reference a media id instead.
