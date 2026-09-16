# Content Engine layout — core vs vault

The Content Engine is two logical layers. They may live in **one folder** (default) or two.

| Layer | Owns | Updates via |
|-------|------|-------------|
| **Core** | Operating rules, workbench UI, templates, empty indexes, platform craft | Git pull / copy of this tree |
| **Vault** | Your profiles, Needs, Hits, Topics, runs, inbox, published, exports | Your edits / Agent writes |

## Default (mixed)

`engine.json` has `"vault_root": "."` (or omits it). Core and vault are the same directory — what `engine init` and this `starter/` tree produce today. Existing engines need no migration.

## Split (optional)

```json
{
  "schemaVersion": "content-engine.v1",
  "vault_root": "../my-vault",
  "paths": { "...": "relative to vault_root" }
}
```

- **Core** = directory that contains `CLAUDE.md`, `engine.json`, and `workbench/`.
- **Vault** = `vault_root` resolved against core (or an absolute path).
- `paths.*` are always relative to the **vault**.
- Workbench build writes `workbench/index.html` under **core**.
- `python3 workbench/serve.py` serves vault markdown at `/…` and core workbench at `/workbench/…`.

## What belongs where

**Core (safe to open-source / pull):**

- `CLAUDE.md`, `engine.json`, `LAYOUT.md` (this file)
- `workbench/` (`build.py`, `serve.py`, `template.html`)
- `topics/scoring.md`, `topics/_template-item.md`, skeleton indexes
- `needs|_hits|…` → `_template.md`, empty `_index.md`, README only
- `platforms/*.md`, `runs/_template/**`
- Starter `profiles/default/**` fills (not a filled creator vault)

**Vault (keep private):**

- Filled `profiles/<id>/`, `needs/entries`, `hits/entries`, `topics/items`
- `runs/RUN-*`, inbox entries, published rows, export binaries/paths
- Real account handles and overrides

## How to get a core

**Public repo (preferred):**

```bash
git clone https://github.com/murphywuwu/content-engine.git
```

**Maintainers:** edit this repository directly and push. The EasySociable CLI no longer vendors a copy of the core.

`easysociable engine init --yes` clones this repo into `Content Engine/` (never overwrites).

**Mixed → split vault:** `python3 scripts/migrate-split-vault.py --engine "/path/to/Content Engine" --yes`

Workbench files in an existing engine are **not** overwritten on `engine serve` / `engine build` unless you pass `--sync-workbench` or set `EASYSOCIABLE_SYNC_WORKBENCH=1`.
