# runs/

One folder per **platform run** (“一单”). Same Topic, native rewrite for another network → **another folder**, same `topic_id`.

| Path | Role |
|------|------|
| `_index.md` | Job queue registry (Approach B scan) |
| `_template/` | Files copied into each new run |
| `YYYY-MM-DD-short-slug[-platform]/` | One platform draft |

**Agent** creates/updates files and `_index`; user works in chat only.

See vault root `CLAUDE.md` § Open a run.

## Multi-platform

- Multi-select on 开一单 → **N runs**, not N sections in one draft.  
- `idea.md`: `primary_platform` = `platforms` = this run only.  
- Before brief/draft: **read** `platforms/<platform>.md` (see `platforms/README.md`).  
- `draft.md`: this platform’s copy only, following that craft file.  
- Pack: `pack.md` (or `pack-<platform>.md`); exports → `exports/<slug>/`.  
- Each ship → one `published/_index` row for that `run_id`.  
