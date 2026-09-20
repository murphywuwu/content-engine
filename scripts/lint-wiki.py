#!/usr/bin/env python3
"""Lint Content Engine wiki notebook pages (report only).

  python3 scripts/lint-wiki.py --engine .
  python3 scripts/lint-wiki.py --self-check

Checks: unpaired see-also, overflow (>5), stale status, unfiled backlog,
open contradictions, missing index files, orphan pages.
"""

from __future__ import annotations

import argparse
import re
import sys
import tempfile
from dataclasses import dataclass, field
from pathlib import Path

INVERSE = {
    "related": "related",
    "contradicts": "contradicts",
    "parent": "child",
    "child": "parent",
}
# `next` is allowed one-way; still counted in overflow.

WID_RE = re.compile(r"W-[A-Za-z0-9_-]+")


def extract_wid(cell: str) -> str:
    """Bare W-… or [[…W-…]] / [[…\\|W-…]]."""
    cell = (cell or "").replace("\\|", "|").strip()
    m = WID_RE.search(cell)
    return m.group(0) if m else ""
STATUS_RE = re.compile(r"^status:\s*(?P<status>\S+)\s*$", re.MULTILINE)
EMPTYISH = frozenset({"", "none", "—", "-", "n/a", "na"})


@dataclass
class Finding:
    kind: str
    detail: str


@dataclass
class Page:
    wid: str
    path: Path
    status: str = ""
    see_also: list[tuple[str, str]] = field(default_factory=list)
    contradictions_open: bool = False


def _cells(line: str) -> list[str]:
    raw = line.replace("\\|", "\x1e")
    return [c.replace("\x1e", "|").strip() for c in raw.strip().strip("|").split("|")]


def _is_sep(line: str) -> bool:
    cells = _cells(line)
    return bool(cells) and all(re.fullmatch(r":?-{3,}:?", c or "") for c in cells)


def _data_rows(section: str) -> list[str]:
    rows = []
    for line in section.splitlines():
        if not line.strip().startswith("|"):
            continue
        if _is_sep(line):
            continue
        cells = _cells(line)
        if not cells:
            continue
        # skip header-ish first cells
        head = cells[0].lower()
        if head in {"id", "rel", "date", "kind", "need_id", "capture_id", "topic_id"}:
            continue
        if all(c == "" for c in cells):
            continue
        rows.append(line)
    return rows


def parse_index(index_path: Path) -> list[tuple[str, str, str]]:
    """Return (id, status, file) rows from wiki/_index.md."""
    if not index_path.exists():
        return []
    text = index_path.read_text(encoding="utf-8")
    out: list[tuple[str, str, str]] = []
    for line in text.splitlines():
        if not line.strip().startswith("|"):
            continue
        if _is_sep(line):
            continue
        cells = _cells(line)
        if len(cells) < 9:
            continue
        wid = extract_wid(cells[0])
        if not wid:
            continue
        status, file_cell = cells[2], cells[8]
        out.append((wid, status, file_cell))
    return out


def parse_page(path: Path) -> Page:
    text = path.read_text(encoding="utf-8")
    wid = path.stem
    status_m = STATUS_RE.search(text)
    status = status_m.group("status") if status_m else ""

    see: list[tuple[str, str]] = []
    if "## See also" in text:
        body = text.split("## See also", 1)[1]
        # stop at next ## if any
        if "\n## " in body:
            body = body.split("\n## ", 1)[0]
        for line in body.splitlines():
            if not line.strip().startswith("|") or _is_sep(line):
                continue
            cells = _cells(line)
            if len(cells) < 2:
                continue
            rel = cells[0].lower()
            if rel not in INVERSE and rel != "next":
                continue
            if rel == "rel":
                continue
            target = extract_wid(cells[1])
            if target:
                see.append((rel, target))

    contradictions_open = False
    if "## Contradictions" in text:
        body = text.split("## Contradictions", 1)[1]
        if "\n## " in body:
            body = body.split("\n## ", 1)[0]
        bullets = []
        for line in body.splitlines():
            s = line.strip()
            if s.startswith("-"):
                bullets.append(s.lstrip("-").strip().lower())
        if bullets and not all(b in EMPTYISH for b in bullets):
            contradictions_open = True

    return Page(wid=wid, path=path, status=status, see_also=see, contradictions_open=contradictions_open)


def unfiled_count(unfiled_path: Path) -> int:
    if not unfiled_path.exists():
        return 0
    text = unfiled_path.read_text(encoding="utf-8")
    # table after first heading
    return len(_data_rows(text))


def lint_engine(engine: Path) -> list[Finding]:
    wiki = engine / "wiki"
    pages_dir = wiki / "pages"
    findings: list[Finding] = []

    index_rows = parse_index(wiki / "_index.md")
    index_ids = {r[0] for r in index_rows}
    index_by_id = {r[0]: r for r in index_rows}

    pages: dict[str, Page] = {}
    if pages_dir.is_dir():
        for path in sorted(pages_dir.glob("W-*.md")):
            page = parse_page(path)
            pages[page.wid] = page

    for wid, status, file_cell in index_rows:
        if status.strip().lower() == "stale" or (
            wid in pages and pages[wid].status.lower() == "stale"
        ):
            findings.append(Finding("stale", wid))
        # strip [[wikilink]] / alias for path resolve
        path_hint = file_cell.replace("\\|", "|").strip()
        m_link = re.search(r"\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]", path_hint)
        if m_link:
            path_hint = m_link.group(1).strip()
        ok = False
        if path_hint or wid:
            candidates = [
                engine / path_hint if path_hint else Path(),
                wiki / path_hint if path_hint else Path(),
                pages_dir / f"{wid}.md",
                engine / f"{path_hint}.md" if path_hint and not path_hint.endswith(".md") else Path(),
            ]
            ok = any(c.is_file() for c in candidates if str(c) not in {".", ""})
        if not ok:
            findings.append(Finding("missing", f"{wid} file={file_cell!r}"))

    for wid, page in pages.items():
        if wid not in index_ids:
            findings.append(Finding("orphan", str(page.path.relative_to(engine))))
        if len(page.see_also) > 5:
            findings.append(Finding("overflow", f"{wid} has {len(page.see_also)} see-also"))
        if page.contradictions_open:
            findings.append(Finding("contradictions", wid))
        if page.status.lower() == "stale" and not any(
            f.kind == "stale" and f.detail == wid for f in findings
        ):
            findings.append(Finding("stale", wid))

    # unpaired see-also (skip next as one-way)
    for wid, page in pages.items():
        for rel, target in page.see_also:
            if rel == "next":
                continue
            want = INVERSE.get(rel)
            if not want:
                continue
            other = pages.get(target)
            if other is None:
                findings.append(Finding("unpaired", f"{wid} {rel}→{target} (missing page)"))
                continue
            if not any(r == want and t == wid for r, t in other.see_also):
                findings.append(
                    Finding("unpaired", f"{wid} {rel}→{target} needs {target} {want}→{wid}")
                )

    n_unfiled = unfiled_count(wiki / "_unfiled.md")
    if n_unfiled:
        findings.append(Finding("unfiled", f"{n_unfiled} rows"))

    # silence unused
    _ = index_by_id
    return findings


def format_report(findings: list[Finding]) -> str:
    buckets: dict[str, list[str]] = {
        "unpaired": [],
        "overflow": [],
        "stale": [],
        "unfiled": [],
        "contradictions": [],
        "missing": [],
        "orphan": [],
    }
    for f in findings:
        buckets.setdefault(f.kind, []).append(f.detail)

    def join(xs: list[str]) -> str:
        return ", ".join(xs) if xs else "—"

    lines = [
        "🩺 Wiki lint",
        f"【Unpaired】 {join(buckets['unpaired'] + buckets.get('overflow', []))}",
        f"【Stale】 {join(buckets['stale'])}",
        f"【Unfiled】 {join(buckets['unfiled']) if buckets['unfiled'] else '0 rows'}",
        f"【Contradictions】 {join(buckets['contradictions'])}",
        f"【Missing/orphan】 {join(buckets['missing'] + buckets['orphan'])}",
        "Reply 批准 fix: … / 再观察",
    ]
    return "\n".join(lines)


def self_check() -> None:
    """Tiny fixture engine; asserts expected findings. No frameworks."""
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        wiki = root / "wiki"
        pages = wiki / "pages"
        pages.mkdir(parents=True)
        (root / "CLAUDE.md").write_text("# test\n", encoding="utf-8")

        (wiki / "_index.md").write_text(
            """# Wiki index
| id | title | status | pillar | profile | need_count | runs | one_liner | file | updated |
|----|-------|--------|--------|---------|------------|------|-----------|------|---------|
| W-A | A | active | none | * | 0 | 0 | believe A | pages/W-A.md | 2026-01-01 |
| W-B | B | stale | none | * | 0 | 0 | believe B | pages/W-B.md | 2026-01-01 |
| W-MISS | Gone | active | none | * | 0 | 0 | x | pages/W-MISS.md | 2026-01-01 |
""",
            encoding="utf-8",
        )
        (wiki / "_unfiled.md").write_text(
            """# Wiki unfiled
| date | kind | id | note | suggested_W |
|------|------|-----|------|-------------|
| 2026-01-01 | capture | C-1 | hang later | |
""",
            encoding="utf-8",
        )
        (pages / "W-A.md").write_text(
            """---
id: W-A
status: active
---
# A
## Contradictions
- open fight with old claim
## See also
| rel | id | note |
|-----|-----|------|
| related | [[wiki/pages/W-B\\|W-B]] | |
| related | [[wiki/pages/W-ORPHAN\\|W-ORPHAN]] | |
""",
            encoding="utf-8",
        )
        (pages / "W-B.md").write_text(
            """---
id: W-B
status: stale
---
# B
## Contradictions
- none
## See also
| rel | id | note |
|-----|-----|------|
| related | [[wiki/pages/W-X\\|W-X]] | broken |
""",
            encoding="utf-8",
        )
        (pages / "W-ORPHAN.md").write_text(
            """---
id: W-ORPHAN
status: seed
---
# Orphan
## Contradictions
- none
## See also
| rel | id | note |
|-----|-----|------|
| related | [[wiki/pages/W-A\\|W-A]] | |
""",
            encoding="utf-8",
        )

        findings = lint_engine(root)
        kinds = {f.kind for f in findings}
        assert "stale" in kinds, findings
        assert "unfiled" in kinds, findings
        assert "contradictions" in kinds, findings
        assert "missing" in kinds, findings
        assert "orphan" in kinds, findings
        assert "unpaired" in kinds, findings

        # clean engine: empty tables → no findings
        clean = root / "clean"
        (clean / "wiki" / "pages").mkdir(parents=True)
        (clean / "CLAUDE.md").write_text("#\n", encoding="utf-8")
        (clean / "wiki" / "_index.md").write_text(
            """# Wiki index
| id | title | status | pillar | profile | need_count | runs | one_liner | file | updated |
|----|-------|--------|--------|---------|------------|------|-----------|------|---------|
""",
            encoding="utf-8",
        )
        (clean / "wiki" / "_unfiled.md").write_text(
            """# Wiki unfiled
| date | kind | id | note | suggested_W |
|------|------|-----|------|-------------|
""",
            encoding="utf-8",
        )
        assert lint_engine(clean) == [], lint_engine(clean)
    print("self-check ok")


def main() -> None:
    ap = argparse.ArgumentParser(description="Lint wiki notebook pages (report only)")
    ap.add_argument("--engine", help="Content Engine root")
    ap.add_argument("--self-check", action="store_true", help="Run fixture asserts and exit")
    ap.add_argument("--json", action="store_true", help="Print findings as kind:detail lines")
    args = ap.parse_args()

    if args.self_check:
        self_check()
        return

    if not args.engine:
        raise SystemExit("Pass --engine PATH or --self-check")

    engine = Path(args.engine).expanduser().resolve()
    if not (engine / "CLAUDE.md").exists():
        raise SystemExit(f"Not an engine: {engine}")
    if not (engine / "wiki").is_dir():
        raise SystemExit(f"No wiki/: {engine}")

    findings = lint_engine(engine)
    if args.json:
        for f in findings:
            print(f"{f.kind}:{f.detail}")
        raise SystemExit(1 if findings else 0)

    print(format_report(findings))
    raise SystemExit(1 if findings else 0)


if __name__ == "__main__":
    main()
