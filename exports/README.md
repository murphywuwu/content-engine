# exports/

**Rendered image packs only** (slideshow skill / Gateway). Not drafts.

## Layout

One run = one platform, so the slug already scopes the platform. Optional `<platform>/` subfolder still OK.

```text
exports/
  <run-folder-slug>/          # same name as runs/YYYY-MM-DD-slug[-platform]
    01.png
    02.png
    …
    manifest.json             # optional: job_id, deck_hint, page_count
```

Example: `exports/2026-08-26-angle-linkedin/01.png`

## Pointers

- `runs/.../pack.md` → `export_path: exports/<slug>/`  
- `runs/_index` column `export`: `no` \| `yes`  
- **Do not** put binaries in `published/` — only URLs after ship  

## Until slideshow skill is wired

Folder may stay empty. Agent must not invent images; pack render status stays `not_requested` / `blocked`.
