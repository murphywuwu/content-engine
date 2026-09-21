#!/usr/bin/env python3
"""Validate Page Contracts in pack.md (report / self-check)."""

from __future__ import annotations

import argparse
import re
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path

COVER_ROLES = frozenset({"cover", "hook"})
VALID_DENSITY = frozenset({"low", "medium", "high"})
REQUIRED_COLS = (
    "page",
    "page_purpose",
    "page_role",
    "density",
    "slot_summary",
    "media_requirements",
    "reader_action",
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


def section(md: str, name: str) -> str:
    if f"## {name}" not in md:
        return ""
    body = md.split(f"## {name}", 1)[1]
    if "\n## " in body:
        body = body.split("\n## ", 1)[0]
    return body


def parse_contract_rows(md: str) -> list[dict[str, str]]:
    body = section(md, "Page Contracts")
    headers: list[str] = []
    rows: list[dict[str, str]] = []
    for line in body.splitlines():
        if not line.strip().startswith("|") or _is_sep(line):
            continue
        cells = _cells(line)
        if not cells:
            continue
        if not headers:
            headers = [c.lower() for c in cells]
            continue
        if len(cells) < len(headers):
            cells = cells + [""] * (len(headers) - len(cells))
        row = {headers[i]: cells[i] for i in range(len(headers))}
        page = (row.get("page") or "").strip()
        if not page or page.lower() == "page":
            continue
        if page.startswith("<!--") or not re.match(r"^\d+$", page):
            continue
        rows.append(row)
    return rows


def validate_pack(md: str) -> list[Finding]:
    findings: list[Finding] = []
    if "## Page Contracts" not in md:
        findings.append(Finding("missing_section", "Page Contracts"))
        return findings
    for col in REQUIRED_COLS:
        if not re.search(rf"\|\s*{col}\s*\|", md, re.I):
            findings.append(Finding("missing_column", col))
    rows = parse_contract_rows(md)
    if not rows:
        findings.append(Finding("empty_contracts", "no page contract rows"))
        return findings
    for row in rows:
        page = row.get("page", "")
        purpose = (row.get("page_purpose") or "").strip()
        role = (row.get("page_role") or "").strip().lower().split("|")[0].strip()
        density = (row.get("density") or "").strip().lower().split("|")[0].strip()
        slots = (row.get("slot_summary") or "").strip()
        if not purpose or purpose in {"…", "-"}:
            findings.append(Finding("missing_purpose", f"page {page}"))
        if not role or role in {"…", "-"}:
            findings.append(Finding("missing_role", f"page {page}"))
        if density and density not in VALID_DENSITY and "low" not in density:
            # allow "low | medium | high" placeholders only on blank templates
            if not all(p.strip() in VALID_DENSITY or p.strip() in {"", "…"} for p in density.split("|")):
                findings.append(Finding("invalid_density", f"page {page}: {density}"))
        if not slots or slots.startswith("e.g."):
            findings.append(Finding("missing_slots", f"page {page}"))
        if "template" in purpose.lower() or re.search(r"\bTPL-|templateId|template_id", purpose, re.I):
            findings.append(Finding("template_in_contract", f"page {page}"))
    first = rows[0]
    first_role = (first.get("page_role") or "").strip().lower()
    first_roles = {p.strip() for p in re.split(r"[|,/\s]+", first_role) if p.strip()}
    if first_roles and not (first_roles & COVER_ROLES) and "cover" not in first_role and "hook" not in first_role:
        # only warn when role looks filled (not placeholder)
        if first_role and "|" not in first_role and first_role not in {"", "…"}:
            findings.append(Finding("page1_not_cover_hook", first_role))
    for row in rows[1:]:
        role = (row.get("page_role") or "").strip().lower()
        if role in COVER_ROLES:
            findings.append(Finding("cover_after_page1", f"page {row.get('page')}: {role}"))
    return findings


def report(findings: list[Finding]) -> int:
    if not findings:
        print("🩺 Pack lint\n【OK】 Page Contracts valid")
        return 0
    print("🩺 Pack lint")
    for f in findings:
        print(f"【{f.kind}】 {f.detail}")
    return 1


def self_check() -> None:
    good = """## Page Contracts
| page | page_purpose | page_role | density | slot_summary | media_requirements | reader_action |
|------|--------------|-----------|---------|--------------|--------------------|---------------|
| 1 | Open with the product promise | hook | medium | title:1 body:1 | none | continue |
| 2 | Show the real UI | screenshot | medium | image:1 caption:1 | home | continue |
"""
    bad = """## Page Contracts
| page | page_purpose | page_role | density | slot_summary | media_requirements | reader_action |
|------|--------------|-----------|---------|--------------|--------------------|---------------|
| 1 | Use templateId tpl_9 | value | medium | e.g. title:1 | none | continue |
| 2 | More | cover | medium | image:1 | home | continue |
"""
    assert not validate_pack(good), validate_pack(good)
    bad_findings = validate_pack(bad)
    kinds = {f.kind for f in bad_findings}
    assert "template_in_contract" in kinds
    assert "cover_after_page1" in kinds
    assert "missing_slots" in kinds
    with tempfile.TemporaryDirectory() as tmp:
        p = Path(tmp) / "pack.md"
        p.write_text(good, encoding="utf-8")
        assert report(validate_pack(p.read_text(encoding="utf-8"))) == 0
    print("self-check ok")


def main() -> None:
    ap = argparse.ArgumentParser(description="Validate pack.md Page Contracts")
    ap.add_argument("pack", nargs="?", type=Path, help="path to pack.md")
    ap.add_argument("--self-check", action="store_true")
    args = ap.parse_args()
    if args.self_check:
        self_check()
        return
    if not args.pack:
        ap.error("pack path required unless --self-check")
    text = args.pack.read_text(encoding="utf-8")
    raise SystemExit(report(validate_pack(text)))


if __name__ == "__main__":
    main()
