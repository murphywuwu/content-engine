#!/usr/bin/env python3
"""Lint Content Engine wiki notebooks (report only).

  python3 scripts/lint-wiki.py --engine .
  python3 scripts/lint-wiki.py --self-check

Pages live under wiki/pages/<profile>/W-*.md. wiki/_index.md is a thin
profile→folder map, not a per-note catalog.
"""

from __future__ import annotations

import argparse
import re
import tempfile
from dataclasses import dataclass, field
from pathlib import Path

INVERSE = {
    "related": "related",
    "contradicts": "contradicts",
    "parent": "child",
    "child": "parent",
}

WID_RE = re.compile(r"W-[A-Za-z0-9_-]+")
STATUS_RE = re.compile(r"^status:\s*(?P<status>\S+)\s*$", re.MULTILINE)
PROFILE_RE = re.compile(r"^profile:\s*(?P<profile>\S+)\s*$", re.MULTILINE)
STATE_RE = re.compile(r"^state:\s*(?P<state>\S+)\s*$", re.MULTILINE)
VALID_STATES = frozenset({"hypothesis", "tested", "supported", "weakened", "retired"})
EMPTYISH = frozenset({"", "none", "—", "-", "n/a", "na"})


@dataclass
class Finding:
    kind: str
    detail: str


@dataclass
class Page:
    wid: str
    path: Path
    profile: str
    status: str = ""
    state: str = ""
    see_also: list[tuple[str, str]] = field(default_factory=list)
    contradictions_open: bool = False


def extract_wid(cell: str) -> str:
    cell = (cell or "").replace("\\|", "|").strip()
    m = WID_RE.search(cell)
    return m.group(0) if m else ""


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
        head = cells[0].lower()
        if head in {"id", "rel", "date", "kind", "need_id", "capture_id", "topic_id", "profile"}:
            continue
        if all(c == "" for c in cells):
            continue
        rows.append(line)
    return rows


def parse_notebook_index(index_path: Path) -> list[tuple[str, str]]:
    """Return (profile, path_hint) from thin wiki/_index.md."""
    if not index_path.exists():
        return []
    out: list[tuple[str, str]] = []
    for line in index_path.read_text(encoding="utf-8").splitlines():
        if not line.strip().startswith("|") or _is_sep(line):
            continue
        cells = _cells(line)
        if len(cells) < 2:
            continue
        profile = cells[0].strip().strip("`")
        if not profile or profile.lower() == "profile":
            continue
        path_hint = cells[1].replace("\\|", "|").strip()
        m = re.search(r"\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]", path_hint)
        if m:
            path_hint = m.group(1).strip()
        out.append((profile, path_hint))
    return out


def parse_page(path: Path, profile: str) -> Page:
    text = path.read_text(encoding="utf-8")
    wid = path.stem
    status_m = STATUS_RE.search(text)
    status = status_m.group("status") if status_m else ""
    prof_m = PROFILE_RE.search(text)
    if prof_m and prof_m.group("profile") not in {"*", "PROFILE_ID"}:
        profile = prof_m.group("profile")
    state_m = STATE_RE.search(text)
    state = state_m.group("state") if state_m else ""

    see: list[tuple[str, str]] = []
    if "## See also" in text:
        body = text.split("## See also", 1)[1]
        if "\n## " in body:
            body = body.split("\n## ", 1)[0]
        for line in body.splitlines():
            if not line.strip().startswith("|") or _is_sep(line):
                continue
            cells = _cells(line)
            if len(cells) < 2:
                continue
            rel = cells[0].lower()
            if rel == "rel" or (rel not in INVERSE and rel != "next"):
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

    return Page(
        wid=wid,
        path=path,
        profile=profile,
        status=status,
        state=state,
        see_also=see,
        contradictions_open=contradictions_open,
    )


def discover_pages(pages_dir: Path) -> tuple[dict[tuple[str, str], Page], list[Finding]]:
    pages: dict[tuple[str, str], Page] = {}
    findings: list[Finding] = []
    if not pages_dir.is_dir():
        return pages, findings
    for path in sorted(pages_dir.rglob("W-*.md")):
        rel = path.relative_to(pages_dir)
        if len(rel.parts) == 1:
            findings.append(Finding("misplaced", f"{rel} (put under pages/<profile>/)"))
            profile = "_"
        else:
            profile = rel.parts[0]
        page = parse_page(path, profile)
        key = (page.profile if page.profile != "_" else profile, page.wid)
        if key in pages:
            findings.append(Finding("duplicate", f"{key[0]}/{key[1]}"))
        pages[key] = page
    return pages, findings


def unfiled_count(unfiled_path: Path) -> int:
    if not unfiled_path.exists():
        return 0
    return len(_data_rows(unfiled_path.read_text(encoding="utf-8")))


def lint_engine(engine: Path) -> list[Finding]:
    wiki = engine / "wiki"
    pages_dir = wiki / "pages"
    findings: list[Finding] = []

    notebooks = parse_notebook_index(wiki / "_index.md")
    for profile, path_hint in notebooks:
        candidates = [
            engine / path_hint if path_hint else Path(),
            wiki / path_hint if path_hint else Path(),
            pages_dir / profile,
        ]
        if not any(c.is_dir() for c in candidates if str(c) not in {".", ""}):
            findings.append(Finding("missing_notebook", f"{profile} path={path_hint!r}"))
        root_candidates = [
            engine / path_hint / "README.md" if path_hint else Path(),
            wiki / path_hint / "README.md" if path_hint else Path(),
            pages_dir / profile / "README.md",
        ]
        if not any(c.is_file() for c in root_candidates if str(c) not in {".", ""}):
            findings.append(Finding("missing_root", profile))

    pages, extra = discover_pages(pages_dir)
    findings.extend(extra)

    # pages keyed for see-also within profile
    by_prof_wid = pages
    wid_only: dict[str, list[tuple[str, str]]] = {}
    for (prof, wid), page in pages.items():
        wid_only.setdefault(wid, []).append((prof, wid))

    for (prof, wid), page in pages.items():
        if not page.state:
            findings.append(Finding("missing_state", f"{prof}/{wid}"))
        elif page.state not in VALID_STATES:
            findings.append(Finding("invalid_state", f"{prof}/{wid}: {page.state}"))
        if page.status.lower() == "stale":
            findings.append(Finding("stale", f"{prof}/{wid}"))
        if page.contradictions_open:
            findings.append(Finding("contradictions", f"{prof}/{wid}"))
        if len(page.see_also) > 5:
            findings.append(Finding("overflow", f"{prof}/{wid} has {len(page.see_also)} see-also"))
        # frontmatter profile should match folder (except _shared)
        if page.profile not in {prof, "*", "_shared"} and prof not in {"_", "_shared"}:
            if page.profile and prof != page.profile:
                findings.append(Finding("profile_mismatch", f"{page.path.name}: folder={prof} fm={page.profile}"))

    for (prof, wid), page in pages.items():
        for rel, target in page.see_also:
            if rel == "next":
                continue
            want = INVERSE.get(rel)
            if not want:
                continue
            other = by_prof_wid.get((prof, target))
            if other is None:
                # fallback: unique wid elsewhere
                alts = wid_only.get(target) or []
                if len(alts) == 1:
                    other = by_prof_wid.get(alts[0])
                else:
                    findings.append(
                        Finding("unpaired", f"{prof}/{wid} {rel}→{target} (missing page)")
                    )
                    continue
            if not any(r == want and t == wid for r, t in other.see_also):
                findings.append(
                    Finding(
                        "unpaired",
                        f"{prof}/{wid} {rel}→{target} needs {other.profile}/{target} {want}→{wid}",
                    )
                )

    n_unfiled = unfiled_count(wiki / "_unfiled.md")
    if n_unfiled:
        findings.append(Finding("unfiled", f"{n_unfiled} rows"))

    return findings


def format_report(findings: list[Finding]) -> str:
    buckets: dict[str, list[str]] = {
        "unpaired": [],
        "overflow": [],
        "stale": [],
        "unfiled": [],
        "contradictions": [],
        "missing_notebook": [],
        "missing_root": [],
        "missing_state": [],
        "invalid_state": [],
        "misplaced": [],
        "duplicate": [],
        "profile_mismatch": [],
    }
    for f in findings:
        buckets.setdefault(f.kind, []).append(f.detail)

    def join(xs: list[str]) -> str:
        return ", ".join(xs) if xs else "—"

    missing = (
        buckets["missing_notebook"]
        + buckets["missing_root"]
        + buckets["missing_state"]
        + buckets["invalid_state"]
        + buckets["misplaced"]
        + buckets["duplicate"]
        + buckets["profile_mismatch"]
    )
    lines = [
        "🩺 Wiki lint",
        f"【Unpaired】 {join(buckets['unpaired'] + buckets.get('overflow', []))}",
        f"【Stale】 {join(buckets['stale'])}",
        f"【Unfiled】 {join(buckets['unfiled']) if buckets['unfiled'] else '0 rows'}",
        f"【Contradictions】 {join(buckets['contradictions'])}",
        f"【Missing/orphan】 {join(missing)}",
        "Reply 批准 fix: … / 再观察",
    ]
    return "\n".join(lines)


def self_check() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        wiki = root / "wiki"
        pages = wiki / "pages" / "demo"
        pages.mkdir(parents=True)
        (root / "CLAUDE.md").write_text("# test\n", encoding="utf-8")
        (wiki / "_index.md").write_text(
            """# Wiki index
| profile | path | one_liner |
|---------|------|-----------|
| demo | [[wiki/pages/demo]] | demo notebook |
| gone | [[wiki/pages/gone]] | missing folder |
""",
            encoding="utf-8",
        )
        (pages / "README.md").write_text("# Demo notebook\n", encoding="utf-8")
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
profile: demo
state: hypothesis
---
# A
## Contradictions
- open fight
## See also
| rel | id | note |
|-----|-----|------|
| related | [[wiki/pages/demo/W-B\\|W-B]] | |
""",
            encoding="utf-8",
        )
        (pages / "W-B.md").write_text(
            """---
id: W-B
status: stale
profile: demo
state: hypothesis
---
# B
## Contradictions
- none
## See also
| rel | id | note |
|-----|-----|------|
| related | [[wiki/pages/demo/W-X\\|W-X]] | broken |
""",
            encoding="utf-8",
        )
        (wiki / "pages" / "W-FLAT.md").write_text(
            """---
id: W-FLAT
status: seed
profile: demo
state: hypothesis
---
# Flat
## Contradictions
- none
## See also
| rel | id | note |
|-----|-----|------|
""",
            encoding="utf-8",
        )

        findings = lint_engine(root)
        kinds = {f.kind for f in findings}
        assert "stale" in kinds, findings
        assert "unfiled" in kinds, findings
        assert "contradictions" in kinds, findings
        assert "missing_notebook" in kinds, findings
        assert "misplaced" in kinds, findings
        assert "unpaired" in kinds, findings

        clean = root / "clean"
        (clean / "wiki" / "pages" / "p1").mkdir(parents=True)
        (clean / "CLAUDE.md").write_text("#\n", encoding="utf-8")
        (clean / "wiki" / "_index.md").write_text(
            """# Wiki index
| profile | path | one_liner |
|---------|------|-----------|
| p1 | [[wiki/pages/p1]] | ok |
""",
            encoding="utf-8",
        )
        (clean / "wiki" / "pages" / "p1" / "README.md").write_text("# p1\n", encoding="utf-8")
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
    ap = argparse.ArgumentParser(description="Lint wiki notebooks (report only)")
    ap.add_argument("--engine", help="Content Engine root")
    ap.add_argument("--self-check", action="store_true")
    ap.add_argument("--json", action="store_true")
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
