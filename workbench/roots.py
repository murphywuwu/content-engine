"""Resolve Content Engine CORE vs VAULT roots from engine.json."""

from __future__ import annotations

import json
from pathlib import Path


def load_roots(workbench_dir: Path | None = None) -> tuple[Path, Path]:
    """Return (CORE, VAULT).

    CORE = parent of workbench/ (CLAUDE.md, engine.json, workbench/).
    VAULT = engine.json vault_root resolved against CORE (default: same as CORE).
    """
    wb = (workbench_dir or Path(__file__).resolve().parent).resolve()
    core = wb.parent
    vault = core
    engine_json = core / "engine.json"
    if engine_json.exists():
        try:
            data = json.loads(engine_json.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            data = {}
        raw = data.get("vault_root", ".")
        vr = str(raw if raw is not None else ".").strip() or "."
        vault_path = Path(vr)
        vault = vault_path.resolve() if vault_path.is_absolute() else (core / vault_path).resolve()
    return core, vault
