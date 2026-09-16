# Content Engine

Local-first content system for AI-native creators: audience signals → Needs → Topics → Runs → feedback.

This repository is the **core** (operating manual, templates, empty indexes, workbench).  
Your private Needs / Hits / Topics / runs stay in the same folder by default, or in a separate vault via `engine.json` `vault_root` (see [LAYOUT.md](./LAYOUT.md)).

EasySociable (templates, slideshows, Studio Download) is a separate product. This engine does not require it.

## Quick start

```bash
git clone https://github.com/murphywuwu/content-engine.git
cd content-engine
python3 workbench/build.py
python3 workbench/serve.py
```

Open http://127.0.0.1:8765/workbench/

Then tell your Agent (Codex / Claude Code / …):

> Follow `CLAUDE.md` in this folder. Start with interview / profile, then capture audience quotes into `needs/`.

Optional skill (also vendored under `skills/easysociable-content/`): install into your Agent skills path, or point the Agent at that folder.

## Requirements

- Python 3 (workbench build + serve)
- An Agent that can edit markdown (recommended)

No Node.js required for the engine itself.

## Core vs vault

| | |
|--|--|
| **Core** | `CLAUDE.md`, `workbench/`, templates, empty indexes — update via `git pull` |
| **Vault** | Your filled profiles, Needs, Hits, Topics, runs — keep private |

Default: one folder is both (`vault_root: "."`). Details: [LAYOUT.md](./LAYOUT.md).

## Optional: EasySociable CLI

Hosted Brands / Templates / Slideshows still use `@easysociable/cli`.  
`easysociable engine init` can scaffold from a bundled copy, but **this repo is the preferred source**.  
`engine serve` / `build` do not overwrite your local workbench unless you pass `--sync-workbench`.

## License

MIT — see [LICENSE](./LICENSE).
