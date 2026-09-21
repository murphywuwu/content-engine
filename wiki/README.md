# wiki/

**Notebook layer** — the Profile entry point for one connected knowledge graph. Agent writes; you read.

| Path | Role |
|------|------|
| `_index.md` | Thin map: profile → `pages/<profile>/` (not a W- catalog) |
| `_template.md` | New lesson page shape |
| `pages/<profile>/README.md` | Profile notebook root and graph navigation |
| `pages/<profile>/W-*.md` | That profile’s notebook |
| `pages/_shared/` | Optional cross-profile lessons (rare) |
| `_unfiled.md` | Hang queue |

Craft parts (swipe / atoms / claims) live under **`library/`**, not here.

## What a notebook page is

A W- page is a Profile-scoped judgment node (for example “not knowing what to say”):

- what we believe now
- which Needs / Captures / Topics / Runs hang on it (via Obsidian `[[wikilinks]]`)
- which library parts fit or should be avoided
- links to related notebook pages in the **same profile folder**
- state: hypothesis, tested, supported, weakened, or retired
- counter-evidence and the next experiment

It is **not** a second index of every vault file. The folder listing is the catalog.

## Agent rules (summary)

See `CLAUDE.md` → § Wiki.

**Graph rule:** folders separate ownership and lifecycle; wikilinks connect the nodes. Profile, Need, Capture, Product, Topic, Run, Published, W-, and Library are all node types in one graph.
**Must hang** (this profile’s folder, or `_unfiled`): Needs `N-`, Captures `C-`, Topic battles, ship/复盘.
**Never hang:** Hits `H-`.
**Do not hang on create:** Products, recommendations, media, library ingest. Cite on a `W-` only when that lesson already depends on them (or user is writing that lesson).

Do not invent a new `W-` when the lesson is unclear — leave unfiled and ask. Index + entry without hang is not stored.
