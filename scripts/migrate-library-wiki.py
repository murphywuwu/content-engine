#!/usr/bin/env python3
"""Move craft catalogs into library/ and leave wiki/ for notebook pages.

  python3 scripts/migrate-library-wiki.py --engine "/path/to/Content Engine" --yes

Idempotent: skips moves that are already done. Rewrites common path strings in
indexes and CLAUDE.md if present under the engine (vault CLAUDE only if diverged).
"""

from __future__ import annotations

import argparse
import re
import shutil
from pathlib import Path

MOVES = (
    ("swipe", "library/swipe"),
    ("wiki/atoms", "library/atoms"),
    ("wiki/claims", "library/claims"),
)

PATH_REWRITES = (
    ("wiki/atoms/", "library/atoms/"),
    ("wiki/claims/", "library/claims/"),
    ("`swipe/`", "`library/swipe/`"),
    ("swipe/_index.md", "library/swipe/_index.md"),
)


def move_tree(engine: Path, src: str, dest: str, apply: bool) -> str:
    s, d = engine / src, engine / dest
    if d.exists():
        return f"skip {src} → {dest} (dest exists)"
    if not s.exists():
        return f"skip {src} (missing)"
    if apply:
        d.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(s), str(d))
    return f"{'moved' if apply else 'would move'} {src} → {dest}"


def ensure_wiki_scaffold(engine: Path, apply: bool) -> list[str]:
    out = []
    pages = engine / "wiki" / "pages"
    for rel, content_name in (
        ("wiki/pages", None),
    ):
        p = engine / rel
        if not p.exists():
            out.append(f"{'mkdir' if apply else 'would mkdir'} {rel}")
            if apply:
                p.mkdir(parents=True, exist_ok=True)
    # Drop stale wiki/atoms|claims dirs if empty leftovers
    for stale in ("wiki/atoms", "wiki/claims"):
        sp = engine / stale
        if sp.is_dir() and not any(sp.iterdir()):
            out.append(f"{'rmdir' if apply else 'would rmdir'} {stale}")
            if apply:
                sp.rmdir()
    return out


def rewrite_paths(engine: Path, apply: bool) -> list[str]:
    notes = []
    # Prefer rewriting vault indexes that still point at old folders
    candidates = list(engine.rglob("*.md"))
    skip_parts = {".git", "node_modules", "__pycache__", "exports", ".obsidian"}
    for path in candidates:
        if any(p in skip_parts for p in path.parts):
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except OSError:
            continue
        new = text
        for a, b in PATH_REWRITES:
            new = new.replace(a, b)
        # file: column cells that are bare filenames under old trees stay ok;
        # only rewrite explicit old prefixes in link-like paths.
        if new == text:
            continue
        rel = path.relative_to(engine)
        notes.append(f"{'rewrote' if apply else 'would rewrite'} {rel}")
        if apply:
            path.write_text(new, encoding="utf-8")
    return notes


def merge_engine_json(engine: Path, apply: bool) -> str:
    import json

    p = engine / "engine.json"
    if not p.exists():
        return "skip engine.json (missing)"
    data = json.loads(p.read_text(encoding="utf-8"))
    paths = data.setdefault("paths", {})
    changed = []
    if "library" not in paths:
        paths["library"] = "library"
        changed.append("paths.library")
    if paths.get("swipe") == "swipe":
        # keep key for old readers optional: point at library/swipe
        paths["swipe"] = "library/swipe"
        changed.append("paths.swipe→library/swipe")
    if not changed:
        return "engine.json paths ok"
    if apply:
        p.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return f"{'merged' if apply else 'would merge'} engine.json ({', '.join(changed)})"


def main() -> None:
    ap = argparse.ArgumentParser(description="Migrate swipe/atoms/claims into library/; wiki for notes")
    ap.add_argument("--engine", required=True, help="Content Engine root")
    ap.add_argument("--yes", action="store_true", help="Apply changes (default dry-run)")
    args = ap.parse_args()
    engine = Path(args.engine).expanduser().resolve()
    if not (engine / "CLAUDE.md").exists():
        raise SystemExit(f"Not an engine: {engine}")
    apply = args.yes
    print(f"engine: {engine}")
    print(f"mode: {'APPLY' if apply else 'DRY-RUN'}")
    for src, dest in MOVES:
        print("-", move_tree(engine, src, dest, apply))
    for line in ensure_wiki_scaffold(engine, apply):
        print("-", line)
    print("-", merge_engine_json(engine, apply))
    for line in rewrite_paths(engine, apply):
        print("-", line)
    if not apply:
        print("Re-run with --yes to apply.")


if __name__ == "__main__":
    main()
