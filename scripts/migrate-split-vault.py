#!/usr/bin/env python3
"""Split a mixed Content Engine folder into core + vault.

Default layout after migration (next to your current engine):

  <parent>/
    content-engine-core/     # fresh clone; engine.json vault_root → ../<old-engine-name>
    <old-engine-name>/       # becomes the vault (your data stays here)

Usage:
  python3 migrate-split-vault.py --engine "/path/to/Content Engine"
  python3 migrate-split-vault.py --engine "/path/to/Content Engine" --core-name content-engine-core --yes

Requires git + network (clones https://github.com/murphywuwu/content-engine.git).
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

REPO = "https://github.com/murphywuwu/content-engine.git"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--engine", required=True, help="Path to existing mixed Content Engine")
    ap.add_argument("--core-name", default="content-engine-core", help="Sibling folder name for new core clone")
    ap.add_argument("--repo", default=REPO)
    ap.add_argument("--yes", action="store_true", help="Apply (otherwise dry-run)")
    args = ap.parse_args()

    engine = Path(args.engine).expanduser().resolve()
    if not (engine / "CLAUDE.md").exists():
        print(f"error: {engine} is not a Content Engine (missing CLAUDE.md)", file=sys.stderr)
        return 2

    parent = engine.parent
    core = parent / args.core_name
    rel_vault = Path("..") / engine.name

    print(f"engine (vault): {engine}")
    print(f"new core:       {core}")
    print(f"vault_root:     {rel_vault.as_posix()}")
    if core.exists():
        print(f"error: {core} already exists", file=sys.stderr)
        return 2

    if not args.yes:
        print("dry-run only. Re-run with --yes to clone core and write vault_root.")
        return 0

    subprocess.check_call(["git", "clone", "--depth", "1", args.repo, str(core)])
    # Detach so users don't accidentally push private notes to the public remote.
    shutil.rmtree(core / ".git", ignore_errors=True)

    ej_path = core / "engine.json"
    data = json.loads(ej_path.read_text(encoding="utf-8"))
    data["vault_root"] = rel_vault.as_posix()
    ej_path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")

    print("done.")
    print(f"  cd {core}")
    print("  python3 workbench/build.py")
    print("  python3 workbench/serve.py")
    print("Data stays in the old folder; core only holds CLAUDE.md + workbench + templates.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
