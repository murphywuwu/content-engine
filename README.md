# Content Engine

Content Engine is a local-first workspace for turning audience signals into
repeatable content:

**signals → Needs → Topics → Runs → feedback**

It is deliberately simple. The source of truth is a folder of Markdown files,
indexes, templates, and rules that an AI coding agent can read and update. The
workbench is a local, read-only view of that folder.

This repository is the engine core. It is not a hosted content service, an
image-template product, or an npm package. EasySociable is optional and is not
required to use the engine.

## Install in five steps

### 1. Download the engine

```bash
git clone https://github.com/murphywuwu/content-engine.git
cd content-engine
```

### 2. Check Python

```bash
python3 --version
```

Python 3 is enough. No Python packages are required.

### 3. Build the local workbench

```bash
python3 workbench/build.py
```

### 4. Start the workbench

```bash
python3 workbench/serve.py
```

Open <http://127.0.0.1:8765/workbench/>. Rebuild after the Agent changes
Markdown by running `python3 workbench/build.py`.

### 5. Connect an Agent and start the first session

Open this folder in an Agent that can edit local files, then send:

> Read `CLAUDE.md` in this folder and follow it. Start with the Interview flow:
> help me complete my profile and boundaries, then show me what will be saved
> before writing it.

The first session establishes who is creating the content and for whom. Do not
start by asking for a finished post: without a profile, audience, voice, and
boundaries, drafts will be plausible but ungrounded.

After the profile is ready:

```text
Record these audience quotes as Needs: <paste quotes or notes>
Scan the captured Needs and propose up to five Topics.
Open a run from <topic id>; ask me which platform to use.
```

The Agent should not invent audience quotes, metrics, biography, customer
proof, or product claims.

## What you need

- Python 3
- An AI agent that can read and edit files, such as Codex or Claude Code
- Git, if you install by cloning this repository

You do not need Node.js, a database, or an account for the local engine.

## How the engine works

The engine separates evidence from production:

1. **Capture** — store an idea, link, or source in `inbox/` and optionally
   `raw/`.
2. **Needs** — preserve real audience language and recurring problems.
3. **Topics** — turn captured Needs or sources into ranked opportunities.
4. **Runs** — create one platform-specific draft and feedback loop per run.
5. **Published** — record the shipped URL so later feedback can be traced back.

A link is not automatically a content idea, a topic is not automatically a
draft, and a draft is not published content.

## Core and vault

By default, this folder is both the engine core and your private vault:
`engine.json` uses `"vault_root": "."`.

| Part | Contains | Update policy |
| --- | --- | --- |
| Core | `CLAUDE.md`, `workbench/`, templates, rules, empty indexes | Update from this repository |
| Vault | profiles, Needs, Hits, Topics, runs, and published records | Keep private and back up |

To keep reusable engine rules separate from private data, point `vault_root` in
`engine.json` to another directory. See [LAYOUT.md](./LAYOUT.md).

## Optional EasySociable integration

EasySociable's hosted Brands, Templates, Slideshows, and Studio Download are
separate products. The local Content Engine does not require them.

If you already use the EasySociable CLI, its optional content skill can be
installed with:

```bash
easysociable install --skills content --yes
```

The CLI is not part of this repository. Do not install it merely to run the
local engine or its workbench.

## Split an existing mixed engine

If you already have one folder with both rules and data:

```bash
python3 scripts/migrate-split-vault.py --engine "/path/to/Content Engine" --yes
```

This clones a fresh core beside it and sets `vault_root` to the old folder.

## Troubleshooting

**The workbench is blank or stale**
Run `python3 workbench/build.py` after the Agent changes Markdown, then refresh
the browser.

**Port 8765 is already in use**
Open <http://127.0.0.1:8765/workbench/> first. It may already be serving this
engine; do not start another server.

**The Agent edits the wrong folder**
Launch it from the directory containing both `CLAUDE.md` and `engine.json`, and
ask it to confirm the current workspace before the first write.

## License

MIT — see [LICENSE](./LICENSE).
