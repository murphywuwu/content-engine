#!/usr/bin/env python3
"""Lint media/_index.md subject + role gates (report only)."""

from __future__ import annotations

import argparse
import re
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path

SUBJECT_RE = re.compile(r"\b(?:P|R)-\d{3}\b")
PRODUCTISH = frozenset({"product", "screenshot"})
VALID_ROLES = frozenset(
    {"logo", "home", "pricing", "settings", "compare", "proof", "other", ""}
)


@dataclass
class Finding:
    kind: str
    detail: str


def _cells(line: str) -> list[str]:
    raw = line.replace("\\|", "\x1e")
    return [c.replace("\x1e", "|").strip() for c in raw.strip().strip("|").split("|")]


def _is_sep(line: str) -> bool:
    cells = _cells(line)
    return bool(cells) and all(re.fullmatch(r":?-{3,}:?", c or "") for c in cells)


def parse_rows(md: str) -> list[dict[str, str]]:
    lines = md.splitlines()
    headers: list[str] = []
    rows: list[dict[str, str]] = []
    for i, line in enumerate(lines):
        if not line.strip().startswith("|"):
            continue
        if _is_sep(line):
            continue
        cells = _cells(line)
        if not cells:
            continue
        if not headers:
            low = [c.lower() for c in cells]
            if "id" in low and "file" in low:
                headers = low
            continue
        if len(cells) < len(headers):
            cells = cells + [""] * (len(headers) - len(cells))
        row = {headers[j]: cells[j] for j in range(len(headers))}
        ident = (row.get("id") or "").strip().strip("`")
        if not ident.startswith("M-"):
            continue
        rows.append(row)
    return rows


def lint_engine(engine: Path) -> list[Finding]:
    path = engine / "media" / "_index.md"
    findings: list[Finding] = []
    if not path.exists():
        findings.append(Finding("missing_index", str(path)))
        return findings
    text = path.read_text(encoding="utf-8")
    if "| role |" not in text.lower().replace(" ", "") and "role |" not in text.lower():
        # tolerate spacing variants
        if not re.search(r"\|\s*role\s*\|", text, re.I):
            findings.append(Finding("missing_role_column", "media/_index.md"))
    for row in parse_rows(text):
        ident = row.get("id", "")
        tags = {t for t in re.split(r"\s+", (row.get("tags") or "").strip()) if t}
        links = (row.get("links") or "").strip()
        role = (row.get("role") or "").strip().lower()
        subjects = SUBJECT_RE.findall(links)
        if tags & PRODUCTISH and not subjects:
            findings.append(
                Finding("missing_subject", f"{ident}: product/screenshot needs P-* or R-* in links")
            )
        if role and role not in VALID_ROLES:
            findings.append(Finding("invalid_role", f"{ident}: {role}"))
    return findings


def report(findings: list[Finding]) -> int:
    if not findings:
        print("🩺 Media lint\n【OK】 no findings")
        return 0
    buckets: dict[str, list[str]] = {}
    for f in findings:
        buckets.setdefault(f.kind, []).append(f.detail)
    print("🩺 Media lint")
    for kind, details in buckets.items():
        print(f"【{kind}】 " + "; ".join(details))
    return 1


def retrieve_by_subject(rows: list[dict[str, str]], subject: str, role: str = "") -> list[dict[str, str]]:
    out = []
    for row in rows:
        links = row.get("links") or ""
        if subject not in SUBJECT_RE.findall(links) and subject not in links:
            continue
        if role and (row.get("role") or "").strip().lower() != role:
            continue
        out.append(row)
    return out


def self_check() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        media = root / "media"
        media.mkdir()
        (media / "_index.md").write_text(
            "| id | file | sha256 | caption | tags | role | links | rights | hosted_image_id |\n"
            "|----|------|--------|---------|------|------|-------|--------|-----------------|\n"
            "| M-20260921-01 | a.png | aaa | Home | screenshot | home | | own | |\n"
            "| M-20260921-02 | b.png | bbb | Price | screenshot | pricing | R-001 | own | |\n",
            encoding="utf-8",
        )
        bad = lint_engine(root)
        assert any(f.kind == "missing_subject" for f in bad), bad
        assert not any("M-20260921-02" in f.detail for f in bad if f.kind == "missing_subject"), bad
        rows = parse_rows((media / "_index.md").read_text(encoding="utf-8"))
        hit = retrieve_by_subject(rows, "R-001", "pricing")
        assert len(hit) == 1 and hit[0]["id"] == "M-20260921-02", hit
        assert retrieve_by_subject(rows, "R-001", "home") == []
    print("self-check ok")


def main() -> None:
    ap = argparse.ArgumentParser(description="Lint media catalog (report only)")
    ap.add_argument("--engine", type=Path, default=Path("."))
    ap.add_argument("--self-check", action="store_true")
    args = ap.parse_args()
    if args.self_check:
        self_check()
        return
    raise SystemExit(report(lint_engine(args.engine.resolve())))


if __name__ == "__main__":
    main()
