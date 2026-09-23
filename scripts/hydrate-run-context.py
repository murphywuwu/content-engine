#!/usr/bin/env python3
"""Materialize a Run's selected Topic/Library bodies into packet.md."""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

WORKBENCH = Path(__file__).resolve().parents[1] / "workbench"
sys.path.insert(0, str(WORKBENCH))
import build  # noqa: E402


def receipt_markdown(hydration: dict) -> str:
    rows = [
        "## Context Hydration Receipt",
        "",
        f"**Status:** {'PASS' if not hydration['errors'] else 'BLOCKED'}",
        "",
        "| role | id | source | lines | source_hash | status |",
        "|---|---|---|---:|---|---|",
    ]
    for entry in hydration["entries"]:
        rows.append(
            "| {role} | {id} | {source} | {lines} | `{hash}` | {status} |".format(
                role=entry["role"],
                id=entry["id"],
                source=entry.get("source", "—"),
                lines=entry.get("line_count", "—"),
                hash=entry.get("source_hash", "—"),
                status=entry["status"],
            )
        )
    if hydration["errors"]:
        rows += ["", "### Validation errors", ""]
        rows.extend(f"- {error}" for error in hydration["errors"])
    return "\n".join(rows) + "\n"


def replace_receipt(packet: str, receipt: str) -> str:
    pattern = r"(?ms)^## Context Hydration Receipt\n.*?(?=^## |\Z)"
    if re.search(pattern, packet):
        return re.sub(pattern, receipt, packet, count=1)
    return packet.rstrip() + "\n\n" + receipt


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--run", required=True, help="RUN-... id")
    parser.add_argument("--allow-drift", action="store_true")
    args = parser.parse_args()
    graph = build.build_graph()
    node = next((n for n in graph["nodes"] if n.get("ident") == args.run), None)
    if not node or node.get("kind") != "run":
        print(f"Run not found: {args.run}", file=sys.stderr)
        return 2
    detail = node["run_detail"]
    hydration = build.hydrate_run_context(
        topic_id=node.get("topic_id", ""),
        selection={
            "swipes": build.field_ids(node["selection"].get("swipe", ""), "swipe"),
            "atoms": build.field_ids(node["selection"].get("atoms", ""), "atom"),
            "claims": build.field_ids(node["selection"].get("claim", ""), "claim"),
        },
        topic_strategy=detail.get("topic_strategy") or {},
    )
    if hydration["errors"] and not args.allow_drift:
        print("\n".join(hydration["errors"]), file=sys.stderr)
        return 1
    packet_rel = node.get("stage_files", {}).get("packet", "")
    packet_path = build.ROOT / packet_rel
    if not packet_path.exists():
        print(f"packet.md not found: {packet_rel}", file=sys.stderr)
        return 2
    packet_path.write_text(
        replace_receipt(packet_path.read_text(encoding="utf-8"), receipt_markdown(hydration)),
        encoding="utf-8",
    )
    print(f"hydrated {args.run} -> {packet_rel}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
