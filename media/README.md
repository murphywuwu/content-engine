# Media vault

Your local image library. Drop images in this folder, register them in
`_index.md`, and the Agent can find and reuse them by tag or link.

- **Source of truth is local.** Files here are the originals.
- **Upload is lazy.** Images upload to hosted render only when a run renders,
  and the returned id is cached in `_index.md` (`hosted_image_id`).
- **Dedup by hash.** Same `sha256` = same asset; no re-import.

See `../CLAUDE.md` → § Media for the Agent workflow.
