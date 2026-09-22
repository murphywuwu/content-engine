# workbench/

Read-only observatory. Source of truth remains the markdown indexes.

| File | Role |
|------|------|
| `template.html` | UI shell (served live by `serve.py`) |
| `build.py` | Parser + optional offline bake → `index.html` |
| `serve.py` | `http://127.0.0.1:8765/workbench/` + live `/api/graph` |
| `index.html` | Optional baked snapshot for `file://` — safe to rebuild |

```bash
python3 workbench/serve.py
```

With the server running, **Markdown edits refresh the observatory automatically** (no `build.py` required). The browser loads `template.html`, fetches `/api/graph`, and listens to `/api/events` (SSE) for vault changes.

Primary tabs include **Brand** (writes `profiles/<id>/brand.md` tokens) and **Media** (image vault under `media/`). Brand only picks a logo `M-*`; the vault itself lives in Media. Voice, audience, and pillars stay with the Agent.

Optional offline bake (file:// only):

```bash
python3 workbench/build.py
```

If port 8765 is already serving this engine, do not start a second server.
