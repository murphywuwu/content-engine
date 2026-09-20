# wiki/

**Notebook layer** — one lesson map per recurring belief. Agent writes; you read.

| Path | Role |
|------|------|
| `_index.md` | Thin map: profile → `pages/<profile>/` (not a W- catalog) |
| `_template.md` | New lesson page shape |
| `pages/<profile>/W-*.md` | That profile’s notebook |
| `pages/_shared/` | Optional cross-profile lessons (rare) |
| `_unfiled.md` | Hang queue |

Craft parts (swipe / atoms / claims) live under **`library/`**, not here.

## What a notebook page is

A short map for one recurring lesson (e.g. “not knowing what to say”):

- what we believe now
- which Needs / Captures / Topics / Runs hang on it (via Obsidian `[[wikilinks]]`)
- which library parts fit or should be avoided
- links to related notebook pages in the **same profile folder**

It is **not** a second index of every vault file. The folder listing is the catalog.

## Agent rules (summary)

See `CLAUDE.md` → § Wiki.

**Must hang** (this profile’s folder, or `_unfiled`): Needs `N-`, Captures `C-`, Topic battles, ship/复盘.  
**Never hang:** Hits `H-`.  
**Do not hang on create:** Products, recommendations, media, library ingest. Cite on a `W-` only when that lesson already depends on them (or user is writing that lesson).

Do not invent a new `W-` when the lesson is unclear — leave unfiled and ask. Index + entry without hang is not stored.
