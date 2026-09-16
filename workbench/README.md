# workbench/

Read-only observatory. Source of truth remains the markdown indexes.

| File | Role |
|------|------|
| `template.html` | UI (do not overwrite on later skill updates if the user customized it) |
| `build.py` | Scan indexes → `index.html` |
| `serve.py` | `http://127.0.0.1:8765/workbench/` |
| `index.html` | Generated — safe to rebuild |

```bash
python3 workbench/build.py
python3 workbench/serve.py
```

If port 8765 is already serving this engine, do not start a second server. Rebuild after Agent writes markdown.
