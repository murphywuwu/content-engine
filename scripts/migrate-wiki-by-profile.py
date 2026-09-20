#!/usr/bin/env python3
"""Move flat wiki/pages/W-*.md into wiki/pages/<profile>/ (idempotent).

  python3 scripts/migrate-wiki-by-profile.py --engine "/path/to/Content Engine" --yes

Reads frontmatter `profile:` (required for flat files). Rewrites
[[wiki/pages/W-…]] → [[wiki/pages/<profile>/W-…]] inside moved pages.
"""

from __future__ import annotations

import argparse
import re
from pathlib import Path

FM_PROFILE = re.compile(r"^profile:\s*(\S+)\s*$", re.M)
LINK_FLAT = re.compile(r"\[\[wiki/pages/(W-[A-Za-z0-9_-]+)")


def profile_of(path: Path) -> str | None:
    text = path.read_text(encoding="utf-8")
    m = FM_PROFILE.search(text)
    if not m:
        return None
    p = m.group(1).strip().strip("\"'")
    if p in {"*", "PROFILE_ID", "none"}:
        return None
    return p


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--engine", required=True)
    ap.add_argument("--yes", action="store_true")
    args = ap.parse_args()
    engine = Path(args.engine).expanduser().resolve()
    pages = engine / "wiki" / "pages"
    if not pages.is_dir():
        raise SystemExit(f"No wiki/pages: {pages}")
    apply = args.yes
    print(f"engine: {engine}")
    print(f"mode: {'APPLY' if apply else 'DRY-RUN'}")
    for path in sorted(pages.glob("W-*.md")):
        prof = profile_of(path)
        if not prof:
            print(f"- skip {path.name} (no usable profile frontmatter)")
            continue
        dest_dir = pages / prof
        dest = dest_dir / path.name
        print(f"- {'move' if apply else 'would move'} {path.name} → pages/{prof}/")
        if apply:
            dest_dir.mkdir(parents=True, exist_ok=True)
            text = path.read_text(encoding="utf-8")
            text2 = LINK_FLAT.sub(rf"[[wiki/pages/{prof}/\1", text)
            dest.write_text(text2, encoding="utf-8")
            if dest.resolve() != path.resolve():
                path.unlink()
    if not apply:
        print("Re-run with --yes to apply.")


if __name__ == "__main__":
    main()
