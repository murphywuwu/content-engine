# Media vault

Your local image library. Drop images in this folder, register them in
`_index.md`, and the Agent can find and reuse them by **subject link** (`P-*` /
`R-*`), `role`, and tag.

- **Source of truth is local.** Files here are the originals.
- **Belong to a product first.** Product / screenshot assets must link a `P-*`
  (owned offer) or `R-*` (third-party review subject) at ingest.
- **Upload is lazy.** Images upload to hosted render only when a run renders,
  and the returned id is cached in `_index.md` (`hosted_image_id`).
- **Dedup by hash.** Same `sha256` = same asset; no re-import.

See `../CLAUDE.md` → § Media for the Agent workflow.
