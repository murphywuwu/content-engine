# Wiki index (notebook map)

One row = **one profile notebook**. Lesson pages live under `pages/<profile>/W-*.md`.  
This file is **not** a catalog of every `W-` — the folder is the source of truth.

| profile | path | one_liner |
|---------|------|-----------|
| | [[wiki/pages/PROFILE]] | |

## Agent rules

- Create `wiki/pages/<profile>/` when the profile gets its first lesson (match `profiles/_index.md` id).  
- New lesson → `wiki/pages/<profile>/W-….md` + frontmatter `profile: <id>`.  
- Read / hang / Selection hard gates: only that profile’s folder (plus optional `wiki/pages/_shared/` if it exists).  
- Cross-profile links are rare; if used, wikilink the **full path**.  
- Do not maintain a per-note row here — status / one_liner live on the page frontmatter + title.
