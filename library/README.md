# library/

Reusable craft catalog (Approach B). **Not** the notebook layer — that is `wiki/`.

| Path | What | Run selection |
|------|------|----------------|
| `swipe/` | Full-post beat order | 0–1 structure; **none OK** |
| `atoms/` | Techniques per role (hook, cta, proof, …) | Match roles; **none OK** |
| `claims/` | Falsifiable angles | 0–1 claim; **none OK** |

Selection always starts at each folder’s `_index.md`, **after** reading the lesson page (`wiki/pages/<profile>/W-*.md`) “Parts that fit / Do not do” when a `W-` is linked.

Filter rows by **platform** and **profiles** (`*` = all profiles). Drop atom/swipe `dead` and claim `retired`. Prefer atom `working`. Claim `status` is epistemology; rank claims by `win/n`.

Use history = `published/_index`. Claim proposition evidence = `## Evidence` in the claim file (not in swipe/atoms).

Ingest only via `CLAUDE.md` → § Library ingest (user approval required).
