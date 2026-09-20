#!/usr/bin/env python3
"""Scan Content Engine indexes → workbench/index.html (read-only)."""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path

from roots import load_roots

_WB = Path(__file__).resolve().parent
CORE, VAULT = load_roots(_WB)
ROOT = VAULT  # data indexes / entries (vault); may equal CORE when vault_root is "."
OUT = _WB / "index.html"
TPL = _WB / "template.html"

PILLAR_HEAD = re.compile(r"^###\s+(P\d+)\s+[—–-]\s+(.+)$", re.M)
# Known Chinese titles keyed by English heading from pillars.md (profile-agnostic fallbacks by P-id still OK for current vault).
PILLAR_ZH_BY_EN = {
    "Agency content problems": "机构内容生产问题",
    "AI content systems": "AI 内容系统",
    "Building EasySociable": "建造 EasySociable",
}
PILLAR_ZH_BY_ID = {
    "P1": "机构内容生产问题",
    "P2": "AI 内容系统",
    "P3": "建造 EasySociable",
}
CAPTURE_RE = re.compile(r"C-\d{8}-\d{2}")
SWIPE_RE = re.compile(r"\bS\d+\b")
ATOM_RE = re.compile(r"\bA-[a-z0-9-]+\b")
CLAIM_RE = re.compile(r"\bC-(?!\d{8})[a-z0-9-]+\b")
RUN_RE = re.compile(r"RUN-[A-Za-z0-9-]+")
PRODUCT_RE = re.compile(r"\bP-[A-Za-z0-9-]+\b")
RECOMMENDATION_RE = re.compile(r"\bR-[A-Za-z0-9-]+\b")
WIKI_PAGE_RE = re.compile(r"\bW-[A-Za-z0-9-]+\b")
WIKI = re.compile(r"\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]")


def parse_pillars_file(path: Path) -> dict:
    if not path.exists():
        return {}
    out = {}
    for m in PILLAR_HEAD.finditer(path.read_text(encoding="utf-8")):
        pid, title = m.group(1), m.group(2)
        title = re.sub(r"\s*\([^)]*\)\s*$", "", title).strip()
        out[pid] = {
            "en": title,
            "zh": PILLAR_ZH_BY_EN.get(title) or PILLAR_ZH_BY_ID.get(pid, title),
        }
    return out


def parse_registry() -> tuple[list[dict], list[dict], dict]:
    """profiles, accounts, pillars_by_profile."""
    profiles = []
    for row in table_with(read("profiles/_index.md"), "id", "path", "voice", "one_liner", "accounts"):
        if not row["id"] or row["id"].startswith("---"):
            continue
        path = row["path"].strip().strip("`") or f"profiles/{row['id']}/"
        if not path.endswith("/"):
            path = f"{path}/"
        voice = row["voice"].strip().strip("`")
        voice = re.split(r"\s*\(", voice, 1)[0].strip().strip("`")
        profiles.append(
            {
                "id": row["id"],
                "path": path,
                "voice": voice,
                "one_liner": row["one_liner"],
                "accounts": [a.strip() for a in row["accounts"].split(",") if a.strip()],
            }
        )

    accounts = []
    for row in table_with(
        read("accounts/_index.md"),
        "handle",
        "profile_id",
        "voice",
        "platforms",
        "default_platform",
        "overrides",
        "status",
    ):
        if not row["handle"] or row["handle"].startswith("---"):
            continue
        accounts.append(
            {
                "handle": row["handle"],
                "profile_id": row["profile_id"],
                "voice": row["voice"],
                "platforms": row["platforms"],
                "default_platform": row["default_platform"],
                "overrides": row["overrides"],
                "status": row["status"],
            }
        )

    pillars_by_profile = {}
    for p in profiles:
        pillars_by_profile[p["id"]] = parse_pillars_file(ROOT / p["path"] / "pillars.md")
    return profiles, accounts, pillars_by_profile


def read(rel: str) -> str:
    return (ROOT / rel).read_text(encoding="utf-8")


def extract_tables(md: str) -> list[dict]:
    blocks: list[list[str]] = []
    cur: list[str] = []
    for line in md.splitlines():
        stripped = line.strip()
        if stripped.startswith("|"):
            cur.append(line)
        elif not stripped:
            # Blank lines inside a GFM table must not split the block,
            # or later rows are parsed as a new headerless table.
            continue
        elif cur:
            blocks.append(cur)
            cur = []
    if cur:
        blocks.append(cur)
    tables = []
    for block in blocks:
        rows = []
        for line in block:
            raw = line.replace("\\|", "\x1e")
            cells = [c.replace("\x1e", "|").strip() for c in raw.strip().strip("|").split("|")]
            rows.append(cells)
        if len(rows) < 2:
            continue
        headers = [h.strip() for h in rows[0]]
        if all(set(h) <= set("-: ") for h in rows[1]):
            body = rows[2:]
        else:
            body = rows[1:]
        recs = []
        for row in body:
            if not any(row):
                continue
            rec = {}
            for i, h in enumerate(headers):
                rec[h] = row[i].strip() if i < len(row) else ""
            recs.append(rec)
        tables.append({"headers": headers, "rows": recs})
    return tables


def table_with(md: str, *need: str) -> list[dict]:
    need_l = [n.lower() for n in need]
    for t in extract_tables(md):
        hs = [h.lower() for h in t["headers"]]
        if all(n in hs for n in need_l):
            key = {h.lower(): h for h in t["headers"]}
            out = []
            for row in t["rows"]:
                out.append({n: row.get(key[n], "") for n in need_l})
            return out
    return []


def extract_runs_table(md: str) -> list[dict]:
    out = []
    for t in extract_tables(md):
        hs = [h.lower() for h in t["headers"]]
        if all(n in hs for n in ["run_id", "path", "date", "status"]):
            key = {h.lower(): h for h in t["headers"]}
            for row in t["rows"]:
                out.append({
                    "run_id": row.get(key.get("run_id", ""), "").strip(),
                    "path": row.get(key.get("path", ""), "").strip(),
                    "date": row.get(key.get("date", ""), "").strip(),
                    "scheduled": (
                        row.get(key.get("scheduled", ""), "")
                        or row.get(key.get("scheduled_date", ""), "")
                        or row.get(key.get("schedule", ""), "")
                    ).strip(),
                    "status": row.get(key.get("status", ""), "").strip(),
                    "account": row.get(key.get("account", ""), "").strip(),
                    "profile": row.get(key.get("profile", ""), "").strip(),
                    "primary_platform": row.get(key.get("primary_platform", ""), "").strip(),
                    "platforms": row.get(key.get("platforms", ""), "").strip(),
                    "topic_id": row.get(key.get("topic_id", ""), "").strip(),
                    "pillar": row.get(key.get("pillar", ""), "").strip(),
                    "one_liner": row.get(key.get("one_liner", ""), "").strip(),
                    "pack": row.get(key.get("pack", ""), "").strip(),
                    "export": row.get(key.get("export", ""), "").strip(),
                    "notes": row.get(key.get("notes", ""), "").strip(),
                })
            return out
    return []


def hit_int(row: dict, key: str) -> int:
    try:
        return int(str(row.get(key, "") or "0").strip() or 0)
    except ValueError:
        return 0


HTTP_RE = re.compile(r"https?://[^\s\]\)>'\"|]+")


def wiki_path(cell: str) -> str:
    m = WIKI.search(cell or "")
    if not m:
        raw = (cell or "").strip().strip("`")
        return raw if raw.endswith(".md") and "://" not in raw else ""
    p = m.group(1).strip()
    if p.endswith(".md"):
        return p
    return p


def run_folder_from_cell(cell: str) -> str:
    p = wiki_path(cell)
    parts = [x for x in p.replace("\\", "/").split("/") if x]
    if len(parts) >= 2 and parts[0] == "runs":
        return parts[1]
    return ""


def frontmatter(text: str) -> dict[str, str]:
    if not text.startswith("---"):
        return {}
    end = text.find("\n---", 3)
    if end < 0:
        return {}
    meta = {}
    for line in text[4:end].splitlines():
        if ":" not in line:
            continue
        k, v = line.split(":", 1)
        meta[k.strip()] = v.strip().strip("\"'")
    return meta


def parse_library(cell: str) -> list[tuple[str, str]]:
    if not cell or cell.strip() in ("none", "—", "-"):
        return []
    out = []
    for part in cell.split(";"):
        part = part.strip()
        if ":" not in part:
            continue
        kind, rest = part.split(":", 1)
        kind = kind.strip().lower()
        kind = {"atoms": "atom", "claims": "claim", "swipes": "swipe"}.get(kind, kind)
        for tok in rest.split(","):
            tok = tok.strip()
            if tok:
                out.append((kind, tok))
    return out


def nid(kind: str, ident: str) -> str:
    return f"{kind}:{ident}"


def vault_file(path: str) -> str:
    path = path.replace("\\", "/").lstrip("/")
    if path and not path.endswith(".md") and "." not in Path(path).name:
        # folder wiki → idea.md if run folder
        pass
    return f"Content Engine/{path}"


def obsidian_uri(engine_rel: str) -> str:
    file_enc = vault_file(engine_rel).replace(" ", "%20")
    return f"obsidian://open?vault=Obsidian%20Vault&file={file_enc}"


def node(
    kind: str,
    ident: str,
    label: str,
    path: str,
    extra: dict,
) -> dict:
    d = {
        "id": nid(kind, ident),
        "kind": kind,
        "ident": ident,
        "label": label,
        "path": path,
        "obsidian": obsidian_uri(path) if path else "",
        **extra,
    }
    return d


def ids_in(text: str) -> dict[str, list[str]]:
    return {
        "capture": sorted(set(CAPTURE_RE.findall(text or ""))),
        "swipe": sorted(set(SWIPE_RE.findall(text or ""))),
        "atom": sorted(set(ATOM_RE.findall(text or ""))),
        "claim": sorted(set(CLAIM_RE.findall(text or ""))),
        "run": sorted(set(RUN_RE.findall(text or ""))),
    }


def field_ids(val: str, kind: str) -> list[str]:
    v = (val or "").strip()
    if not v or v.lower() == "none":
        return []
    return ids_in(v).get(kind, [])


STAGE_NAMES = (
    "idea",
    "brief",
    "packet",
    "draft",
    "editor",
    "rubric",
    "pack",
    "feedback",
)


def run_stage_files(folder: Path, folder_name: str) -> dict[str, str]:
    """Stage name → vault-relative .md path (only files that exist)."""
    base = f"runs/{folder_name}"
    out: dict[str, str] = {}
    for name in STAGE_NAMES:
        p = folder / f"{name}.md"
        if p.exists():
            out[name] = f"{base}/{name}.md"
    if "pack" not in out:
        packs = sorted(folder.glob("pack-*.md"))
        if packs:
            out["pack"] = f"{base}/{packs[0].name}"
    return out


def parse_feedback_metrics(text: str) -> dict:
    out = {"has_numbers": False, "result": ""}
    fm = frontmatter(text)
    if fm.get("result"):
        out["result"] = fm["result"]
    if re.search(r"(views|likes|replies|bookmarks)\s*:", text, re.I):
        out["has_numbers"] = True
    return out


ENGAGEMENT_SNAP_RE = re.compile(
    r"(?:engagement\s+snapshot|snapshot\s+engagement)[^\n:]*:\s*(.+?)(?:\n|$)",
    re.I,
)
ENGAGEMENT_SECTION_RE = re.compile(
    r"^##\s+(?:Engagement\s+snapshot|Snapshot\s+metrics(?:\s*\([^)]*\))?)\s*\n+(.*?)(?=^##\s|\Z)",
    re.I | re.M | re.S,
)
ENGAGEMENT_KIND = r"likes?|replies|reply|bookmarks?|views?"
ENGAGEMENT_NUM = r"~?\d[\d,]*(?:\.\d+)?[kKmMbB]?"
# kind-first: likes 113 / likes: 3
ENGAGEMENT_KIND_NUM_RE = re.compile(
    rf"\b({ENGAGEMENT_KIND})\s*[:=]?\s*({ENGAGEMENT_NUM})\b",
    re.I,
)
# num-first: 1086 likes / ~92.9k views
ENGAGEMENT_NUM_KIND_RE = re.compile(
    rf"({ENGAGEMENT_NUM})\s+({ENGAGEMENT_KIND})\b",
    re.I,
)
ENGAGEMENT_AT_RE = re.compile(r"@\s*(\d{4}-\d{2}-\d{2})")
ENGAGEMENT_FETCH_AT_RE = re.compile(
    r"(?:fetch|at\s+capture|snapshot_at)\s*[:=]?\s*(\d{4}-\d{2}-\d{2})",
    re.I,
)


def _empty_engagement() -> dict[str, str]:
    return {
        "src_likes": "",
        "src_replies": "",
        "src_bookmarks": "",
        "src_views": "",
        "engagement_at": "",
    }


def _normalize_metric_kind(kind: str) -> str:
    k = kind.lower()
    if k.startswith("like"):
        return "likes"
    if k.startswith("repl"):
        return "replies"
    if k.startswith("bookmark"):
        return "bookmarks"
    if k.startswith("view"):
        return "views"
    return k


def _parse_compact_count(raw: str) -> str:
    """'92.9k' → '92900'; '1.1M' → '1100000'; '9,574' → '9574'."""
    s = raw.strip().lstrip("~").replace(",", "")
    if not s:
        return ""
    m = re.fullmatch(r"(\d+(?:\.\d+)?)([kKmMbB])?", s)
    if not m:
        digits = re.sub(r"[^\d]", "", s)
        return digits
    n = float(m.group(1))
    suf = (m.group(2) or "").lower()
    if suf == "k":
        n *= 1_000
    elif suf == "m":
        n *= 1_000_000
    elif suf == "b":
        n *= 1_000_000_000
    return str(int(round(n)))


def _fill_engagement_from_blob(out: dict[str, str], blob: str) -> None:
    if not blob:
        return
    # Prefer kind-first matches (list form), then num-first (capture prose).
    for kind, num in ENGAGEMENT_KIND_NUM_RE.findall(blob):
        key = f"src_{_normalize_metric_kind(kind)}"
        if key in out and not out[key]:
            out[key] = _parse_compact_count(num)
    for num, kind in ENGAGEMENT_NUM_KIND_RE.findall(blob):
        key = f"src_{_normalize_metric_kind(kind)}"
        if key in out and not out[key]:
            out[key] = _parse_compact_count(num)
    if not out["engagement_at"]:
        at = ENGAGEMENT_AT_RE.search(blob) or ENGAGEMENT_FETCH_AT_RE.search(blob)
        if at:
            out["engagement_at"] = at.group(1)


def parse_engagement_snapshot(text: str) -> dict[str, str]:
    """Parse engagement into src_* fields from Capture / Raw notes.

    Supports:
    - Compact: `engagement snapshot: likes 113 / replies 18 / ... @ 2026-08-30`
    - Capture prose: `Engagement snapshot (fetch DATE): ~92.9k views · 1086 likes · ...`
    - Raw list under `## Engagement snapshot` with `- likes: 3`
    Parenthetical secondary demos after the primary snapshot are ignored.
    """
    out = _empty_engagement()
    if not text:
        return out
    m = ENGAGEMENT_SNAP_RE.search(text)
    if m:
        blob = m.group(1).split("(", 1)[0]
        # Date often sits in the label: Engagement snapshot (fetch 2026-08-25)
        label = text[m.start() : m.start(1)]
        _fill_engagement_from_blob(out, blob)
        if not out["engagement_at"]:
            at = ENGAGEMENT_FETCH_AT_RE.search(label) or ENGAGEMENT_AT_RE.search(label)
            if at:
                out["engagement_at"] = at.group(1)
        return out
    sec = ENGAGEMENT_SECTION_RE.search(text)
    if sec:
        _fill_engagement_from_blob(out, sec.group(1))
    return out


def merge_engagement(*parts: dict[str, str]) -> dict[str, str]:
    out = _empty_engagement()
    for part in parts:
        for k, v in part.items():
            if k in out and v and not out[k]:
                out[k] = v
    return out

def parse_wiki_notebooks(md: str | None = None) -> list[dict]:
    """Thin registry: profile → notebook folder (not a per-W catalog)."""
    if md is None:
        md = read("wiki/_index.md")
    rows = table_with(md, "profile", "path", "one_liner")
    out = []
    for row in rows:
        profile = (row.get("profile") or "").strip().strip("`")
        if not profile or profile.lower() == "profile":
            continue
        path = wiki_path(row.get("path") or "") or (row.get("path") or "").strip().strip("`")
        if path.endswith(".md"):
            path = path[: -len(".md")]
        out.append(
            {
                "profile": profile,
                "path": path,
                "one_liner": (row.get("one_liner") or "").strip(),
            }
        )
    return out


def parse_wiki_pages() -> list[dict]:
    """Scan wiki/pages/<profile>/W-*.md (and legacy flat pages/W-*.md)."""
    pages_root = ROOT / "wiki" / "pages"
    out: list[dict] = []
    if not pages_root.is_dir():
        return out

    paths = sorted(pages_root.rglob("W-*.md"))
    for path in paths:
        if path.name.startswith("_"):
            continue
        rel = path.relative_to(ROOT).as_posix()
        try:
            rel_pages = path.relative_to(pages_root)
        except ValueError:
            continue
        parts = rel_pages.parts
        if len(parts) == 1:
            profile_from_dir = ""
        else:
            profile_from_dir = parts[0]

        text = path.read_text(encoding="utf-8") if path.is_file() else ""
        meta = frontmatter(text)
        wid = (meta.get("id") or path.stem).strip()
        if not wid.startswith("W-"):
            wid = path.stem
        title = (meta.get("title") or "").strip()
        if not title:
            for line in text.splitlines():
                if line.startswith("# "):
                    title = line[2:].strip()
                    break
        profile = (meta.get("profile") or profile_from_dir or "").strip()
        if profile == "*":
            profile = profile_from_dir or "*"
        believe = ""
        if "## We believe" in text:
            body = text.split("## We believe", 1)[1]
            if "\n## " in body:
                body = body.split("\n## ", 1)[0]
            for line in body.splitlines():
                s = line.strip()
                if s and not s.startswith("#"):
                    believe = s
                    break
        out.append(
            {
                "id": wid,
                "title": title,
                "status": (meta.get("status") or "").strip(),
                "pillar": (meta.get("pillar") or "").strip(),
                "profile": profile,
                "need_count": "",
                "runs": "",
                "one_liner": believe,
                "file": rel,
                "updated": (meta.get("updated") or "").strip(),
            }
        )
    return out


def parse_media(md: str | None = None) -> list[dict]:
    if md is None:
        md = read("media/_index.md")
    rows = table_with(
        md,
        "id", "file", "sha256", "caption", "tags", "links", "rights", "hosted_image_id",
    )
    out = []
    for row in rows:
        ident = (row.get("id") or "").strip().strip("`")
        if not ident.startswith("M-"):
            continue
        f = (row.get("file") or "").strip().strip("`")
        src = f if f.startswith("media/") else (f"media/{f}" if f else "")
        hosted = (row.get("hosted_image_id") or "").strip()
        out.append(
            {
                "id": ident,
                "file": f,
                "src": src,
                "sha256": (row.get("sha256") or "").strip(),
                "caption": (row.get("caption") or "").strip(),
                "tags": [t for t in re.split(r"\s+", (row.get("tags") or "").strip()) if t],
                "links": [l for l in re.split(r"[\s,]+", (row.get("links") or "").strip()) if l],
                "rights": (row.get("rights") or "").strip(),
                "hosted_image_id": hosted,
                "hosted": bool(hosted),
            }
        )
    return out


def build_graph() -> dict:
    nodes: dict[str, dict] = {}
    edges: list[dict] = []
    profiles, accounts, pillars_by_profile = parse_registry()

    def add_node(n: dict) -> None:
        nodes[n["id"]] = n

    def edge(a: str, b: str, rel: str) -> None:
        if a in nodes and b in nodes:
            edges.append({"from": a, "to": b, "rel": rel})

    for p in profiles:
        base = p["path"].rstrip("/") + "/"
        files = {}
        for name in ("README", "voice", "brand", "audience", "pillars", "lanes", "keywords", "handles"):
            rel = f"{base}{name}.md"
            if (ROOT / rel).exists():
                files[name.lower()] = rel
        readme = files.get("readme") or files.get("pillars") or f"{base}pillars.md"
        add_node(
            node(
                "profile",
                p["id"],
                p["one_liner"] or p["id"],
                readme,
                {
                    "one_liner": p["one_liner"],
                    "voice": p["voice"],
                    "accounts": p["accounts"],
                    "pillar_ids": list(pillars_by_profile.get(p["id"], {}).keys()),
                    "files": files,
                    "dir": base,
                },
            )
        )
    for a in accounts:
        add_node(
            node(
                "account",
                a["handle"],
                a["handle"],
                "accounts/_index.md",
                {
                    "profile_id": a["profile_id"],
                    "platforms": a["platforms"],
                    "default_platform": a["default_platform"],
                    "status": a["status"],
                    "voice": a["voice"],
                    "overrides": a["overrides"],
                },
            )
        )
        if a["profile_id"]:
            edges.append(
                {"from": nid("account", a["handle"]), "to": nid("profile", a["profile_id"]), "rel": "uses_profile"}
            )

    for row in table_with(read("inbox/_index.md"), "id", "date", "type", "one_liner", "platforms", "profile", "entry", "raw", "library", "status"):
        ident = row["id"]
        if not ident.startswith("C-"):
            continue
        entry = wiki_path(row["entry"]) or f"inbox/entries/{ident}"
        if not entry.endswith(".md"):
            entry = f"{entry}.md"
        raw_path = wiki_path(row["raw"])
        add_node(
            node(
                "capture",
                ident,
                row["one_liner"],
                entry,
                {
                    "date": row["date"],
                    "type": row["type"],
                    "platforms": row["platforms"],
                    "profile": row["profile"],
                    "status": row["status"],
                    "library_cell": row["library"],
                    "raw_path": raw_path,
                    "has_raw": bool(raw_path),
                    "ingested": row["status"] == "ingested",
                },
            )
        )
        for kind, lib_id in parse_library(row["library"]):
            edges.append({"from": nid("capture", ident), "to": nid(kind, lib_id), "rel": "ingested_as"})

    needs_md = read("needs/_index.md")
    needs_rows = table_with(
        needs_md,
        "id",
        "date",
        "profile",
        "source_type",
        "quote",
        "speaker",
        "frequency",
        "status",
        "topic_ids",
        "file",
    )
    for row in needs_rows:
        ident = row["id"]
        if not ident.startswith("N-"):
            continue
        fpath = wiki_path(row["file"]) or f"needs/entries/{ident}.md"
        if not fpath.endswith(".md"):
            fpath = f"{fpath}.md"
        topic_ids = (row.get("topic_ids") or "").strip()
        quote = (row.get("quote") or "").strip()
        add_node(
            node(
                "need",
                ident,
                quote or f"Need {ident}",
                fpath,
                {
                    "date": row["date"],
                    "profile": row["profile"],
                    "source_type": row["source_type"],
                    "quote": quote,
                    "speaker": row.get("speaker", "") or "",
                    "frequency": row.get("frequency", "") or "1",
                    "status": row["status"],
                    "topic_ids": topic_ids,
                },
            )
        )
        # Topic edges are wired after topic nodes exist (see post-pass below).

    hits_path = ROOT / "hits" / "_index.md"
    if hits_path.exists():
        hits_rows = table_with(
            hits_path.read_text(encoding="utf-8"),
            "id",
            "date",
            "profile",
            "platform",
            "keyword_id",
            "source",
            "hit_kind",
            "signal",
            "status",
            "excerpt",
            "src_likes",
            "src_replies",
            "src_bookmarks",
            "src_views",
            "engagement_at",
            "file",
        )
        if not hits_rows:
            hits_rows = table_with(
                hits_path.read_text(encoding="utf-8"),
                "id",
                "date",
                "profile",
                "platform",
                "source",
                "hit_kind",
                "signal",
                "status",
                "excerpt",
                "file",
            )
        for row in hits_rows:
            ident = row["id"]
            if not ident.startswith("H-"):
                continue
            fpath = wiki_path(row["file"]) or f"hits/entries/{ident}.md"
            if not fpath.endswith(".md"):
                fpath = f"{fpath}.md"
            excerpt = (row.get("excerpt") or "").strip()
            keyword_id = (row.get("keyword_id") or "").strip()
            if not keyword_id:
                m = re.search(r"\bK-\d{2}\b", row.get("source", "") or "")
                if m:
                    keyword_id = m.group(0)
            eng = {
                "src_likes": row.get("src_likes", "") or "",
                "src_replies": row.get("src_replies", "") or "",
                "src_bookmarks": row.get("src_bookmarks", "") or "",
                "src_views": row.get("src_views", "") or "",
                "engagement_at": row.get("engagement_at", "") or "",
            }
            source_url = ""
            if fpath and (ROOT / fpath).exists():
                body = read(fpath)
                eng = merge_engagement(eng, parse_engagement_snapshot(body))
                fm = re.match(r"^---\n(.*?)\n---", body, re.S)
                if fm:
                    murl = re.search(r"^source_url:\s*(\S+)", fm.group(1), re.M)
                    if murl:
                        source_url = murl.group(1).strip()
                    if not keyword_id:
                        mk = re.search(r"^keyword_id:\s*(\S+)", fm.group(1), re.M)
                        if mk:
                            keyword_id = mk.group(1).strip()
            add_node(
                node(
                    "hit",
                    ident,
                    excerpt or f"Hit {ident}",
                    fpath,
                    {
                        "date": row["date"],
                        "profile": row["profile"],
                        "platform": row.get("platform", "") or "",
                        "keyword_id": keyword_id,
                        "source": row.get("source", "") or keyword_id,
                        "hit_kind": row.get("hit_kind", "") or "",
                        "signal": row.get("signal", "") or "",
                        "status": row["status"],
                        "excerpt": excerpt,
                        "source_url": source_url,
                        "src_likes": eng.get("src_likes", "") or "",
                        "src_replies": eng.get("src_replies", "") or "",
                        "src_bookmarks": eng.get("src_bookmarks", "") or "",
                        "src_views": eng.get("src_views", "") or "",
                        "engagement_at": eng.get("engagement_at", "") or "",
                        "src_heat_note": "来源帖热度，不是你的帖",
                    },
                )
            )

    # Keyword recipes (profile listening config) + hit counts for Hits rail
    keywords: list[dict] = []
    for p in profiles:
        kpath = ROOT / p["path"].rstrip("/") / "keywords.md"
        if not kpath.exists():
            continue
        krows = table_with(
            kpath.read_text(encoding="utf-8"),
            "id",
            "track",
            "query",
            "platform",
            "intent",
            "layer",
            "pillar",
            "why",
            "weight",
            "status",
            "seed_from",
            "pair_id",
            "volume",
            "kd",
            "serp_intent",
            "volume_source",
            "volume_at",
            "ask_engines",
            "last_scanned",
        )
        if not krows:
            krows = table_with(
                kpath.read_text(encoding="utf-8"),
                "id",
                "query",
                "platform",
                "intent",
                "layer",
                "pillar",
                "why",
                "weight",
                "status",
                "last_scanned",
            )
        for row in krows:
            kid = (row.get("id") or "").strip()
            if not kid.startswith("K-"):
                continue
            track = (row.get("track") or "").strip() or "listen"
            keywords.append(
                {
                    "id": kid,
                    "profile": p["id"],
                    "track": track,
                    "query": row.get("query", "") or "",
                    "platform": row.get("platform", "") or "",
                    "intent": row.get("intent", "") or "",
                    "layer": row.get("layer", "") or "",
                    "pillar": row.get("pillar", "") or "",
                    "why": row.get("why", "") or "",
                    "weight": row.get("weight", "") or "",
                    "status": row.get("status", "") or "",
                    "seed_from": row.get("seed_from", "") or "",
                    "pair_id": row.get("pair_id", "") or "",
                    "volume": row.get("volume", "") or "",
                    "kd": row.get("kd", "") or "",
                    "serp_intent": row.get("serp_intent", "") or "",
                    "volume_source": row.get("volume_source", "") or "",
                    "volume_at": row.get("volume_at", "") or "",
                    "ask_engines": row.get("ask_engines", "") or "",
                    "last_scanned": row.get("last_scanned", "") or "",
                    "path": f"{p['path'].rstrip('/')}/keywords.md",
                }
            )

    products_path = ROOT / "products" / "_index.md"
    if products_path.exists():
        product_rows = table_with(
            products_path.read_text(encoding="utf-8"),
            "id",
            "name",
            "status",
            "audience",
            "price",
            "effective_from",
            "file",
        )
        for row in product_rows:
            ident = row["id"]
            if not ident.startswith("P-"):
                continue
            fpath = wiki_path(row["file"]) or f"products/entries/{ident}.md"
            if not fpath.endswith(".md"):
                fpath = f"{fpath}.md"
            add_node(
                node(
                    "product",
                    ident,
                    row["name"] or ident,
                    fpath,
                    {
                        "status": row["status"],
                        "audience": row["audience"],
                        "price": row["price"],
                        "effective_from": row["effective_from"],
                    },
                )
            )

    recommendations_path = ROOT / "recommendations" / "_index.md"
    if recommendations_path.exists():
        recommendation_rows = table_with(
            recommendations_path.read_text(encoding="utf-8"),
            "id",
            "name",
            "status",
            "category",
            "profiles",
            "pillars",
            "last_researched",
            "relationship",
            "file",
        )
        for row in recommendation_rows:
            ident = row["id"]
            if not ident.startswith("R-"):
                continue
            fpath = wiki_path(row["file"]) or f"recommendations/{ident}.md"
            if not fpath.endswith(".md"):
                fpath = f"{fpath}.md"
            add_node(
                node(
                    "recommendation",
                    ident,
                    row["name"] or ident,
                    fpath,
                    {
                        "status": row["status"],
                        "category": row["category"],
                        "profiles": row["profiles"],
                        "pillars": row["pillars"],
                        "last_researched": row["last_researched"],
                        "relationship": row["relationship"],
                    },
                )
            )

    for row in table_with(read("raw/_index.md"), "id", "date", "capture_id", "file", "type", "source_url", "one_liner"):
        ident = row["id"]
        fpath = wiki_path(row["file"])
        if fpath and not fpath.endswith(".md"):
            fpath = f"{fpath}.md"
        add_node(
            node(
                "raw",
                ident,
                row["one_liner"],
                fpath,
                {
                    "date": row["date"],
                    "type": row["type"],
                    "source_url": row["source_url"],
                    "capture_id": row["capture_id"],
                },
            )
        )
        if row["capture_id"]:
            edge(nid("capture", row["capture_id"]), nid("raw", ident), "has_raw")

    topic_md = read("topics/_index.md")
    # Current: opp + aud (5C opportunity). Legacy: craft + fit, then single total.
    topic_rows = table_with(
        topic_md,
        "id",
        "date",
        "opp",
        "aud",
        "status",
        "purpose",
        "scout",
        "platform",
        "pillar",
        "lane",
        "generation_mode",
        "one_liner",
        "item",
        "source_type",
        "src_url",
        "src_handle",
        "src_likes",
        "src_replies",
        "src_bookmarks",
        "engagement_at",
        "capture_id",
        "need_ids",
        "product_ids",
        "product_fit",
        "recommendation_ids",
        "run",
    )
    if topic_rows:
        topic_rows = [
            {
                **row,
                "craft": row.get("opp", "") or "",
                "fit": row.get("aud", "") or "",
            }
            for row in topic_rows
        ]
    if not topic_rows:
        topic_rows = table_with(
            topic_md,
            "id",
            "date",
            "craft",
            "fit",
            "status",
            "purpose",
            "scout",
            "platform",
            "pillar",
            "one_liner",
            "item",
            "source_type",
            "src_url",
            "src_handle",
            "src_likes",
            "src_replies",
            "src_bookmarks",
            "engagement_at",
            "capture_id",
            "run",
        )
    if not topic_rows:
        topic_rows = [
            {
                **row,
                "craft": row["total"],
                "fit": "",
                "purpose": "",
                "scout": "",
            }
            for row in table_with(
                topic_md,
                "id",
                "date",
                "total",
                "status",
                "platform",
                "pillar",
                "one_liner",
                "item",
                "source_type",
                "src_url",
                "src_handle",
                "src_likes",
                "src_replies",
                "src_bookmarks",
                "engagement_at",
                "capture_id",
                "run",
            )
        ]

    for row in topic_rows:
        ident = row["id"]
        if not ident.startswith("T-"):
            continue
        item = wiki_path(row["item"])
        if item and not item.endswith(".md"):
            item = f"{item}.md"
        usage = "killed" if row["status"] == "killed" else ("promoted" if row["run"].strip() else "unused")
        craft = row.get("craft", "") or ""
        fit = row.get("fit", "") or ""
        # Sort key: opp (aliased as craft) / legacy total
        total = craft or row.get("total", "") or ""
        profile = ""
        if item and (ROOT / item).exists():
            fm = re.match(r"^---\n(.*?)\n---", read(item), re.S)
            if fm:
                mprof = re.search(r"^profile:\s*(\S+)", fm.group(1), re.M)
                if mprof:
                    profile = mprof.group(1).strip()
        add_node(
            node(
                "topic",
                ident,
                row["one_liner"],
                item,
                {
                    "date": row["date"],
                    "total": total,
                    "opp": craft,
                    "aud": fit,
                    "craft": craft,
                    "fit": fit,
                    "purpose": row.get("purpose", "") or "",
                    "scout": row.get("scout", "") or "",
                    "status": row["status"],
                    "platform": row["platform"],
                    "pillar": row["pillar"],
                    "lane": row.get("lane", "") or "",
                    "generation_mode": row.get("generation_mode", "") or "",
                    "profile": profile,
                    "source_type": row["source_type"],
                    "src_url": row["src_url"],
                    "src_handle": row["src_handle"],
                    "src_likes": row["src_likes"],
                    "src_replies": row["src_replies"],
                    "src_bookmarks": row["src_bookmarks"],
                    "engagement_at": row["engagement_at"],
                    "capture_id": row["capture_id"],
                    "need_ids": row.get("need_ids", "") or "",
                    "product_ids": row.get("product_ids", "") or "",
                    "product_fit": row.get("product_fit", "") or "",
                    "recommendation_ids": row.get("recommendation_ids", "") or "",
                    "run_id": row["run"].strip(),
                    "usage": usage,
                    "src_heat_note": "来源帖热度，不是你的帖",
                },
            )
        )
        if row["capture_id"]:
            edge(nid("topic", ident), nid("capture", row["capture_id"]), "from_capture")
        if row["run"].strip().startswith("RUN-"):
            edge(nid("topic", ident), nid("run", row["run"].strip()), "opened_run")
        # Index cells are enough for edges; item frontmatter may repeat the same ids.
        for need_id in re.findall(r"\bN-\d{8}-\d{2}\b", row.get("need_ids", "") or ""):
            edge(nid("topic", ident), nid("need", need_id), "from_need")
        for product_id in PRODUCT_RE.findall(row.get("product_ids", "") or ""):
            edge(nid("topic", ident), nid("product", product_id), "uses_product")
        for recommendation_id in RECOMMENDATION_RE.findall(row.get("recommendation_ids", "") or ""):
            edge(nid("topic", ident), nid("recommendation", recommendation_id), "reviews")
        if item and (ROOT / item).exists():
            body = read(item)
            fm = re.match(r"^---\n(.*?)\n---", body, re.S)
            if fm:
                mneeds = re.search(r"^need_ids:\s*(.*)$", fm.group(1), re.M)
                if mneeds:
                    for need_id in re.findall(r"\bN-\d{8}-\d{2}\b", mneeds.group(1)):
                        edge(nid("topic", ident), nid("need", need_id), "from_need")
                mproducts = re.search(r"^product_ids:\s*(.*)$", fm.group(1), re.M)
                if mproducts:
                    for product_id in PRODUCT_RE.findall(mproducts.group(1)):
                        edge(nid("topic", ident), nid("product", product_id), "uses_product")
                mrecommendations = re.search(r"^recommendation_ids:\s*(.*)$", fm.group(1), re.M)
                if mrecommendations:
                    for recommendation_id in RECOMMENDATION_RE.findall(mrecommendations.group(1)):
                        edge(nid("topic", ident), nid("recommendation", recommendation_id), "reviews")
            chunk = body
            m = re.search(r"^## Suggested production.*?(?=^## |\Z)|^## Trace.*?(?=^## |\Z)", body, re.M | re.S)
            if m:
                chunk = m.group(0)
            for line in chunk.splitlines():
                if ":" not in line:
                    continue
                key, rest = line.split(":", 1)
                key, rest = key.strip().lower(), rest.strip()
                if rest.lower().startswith("none"):
                    continue
                if "swipe" in key:
                    for sid in ids_in(rest)["swipe"]:
                        edges.append({"from": nid("topic", ident), "to": nid("swipe", sid), "rel": "suggested"})
                elif "atom" in key:
                    for aid in ids_in(rest)["atom"]:
                        edges.append({"from": nid("topic", ident), "to": nid("atom", aid), "rel": "suggested"})
                elif "claim" in key:
                    for cid in ids_in(rest)["claim"]:
                        edges.append({"from": nid("topic", ident), "to": nid("claim", cid), "rel": "suggested"})

    for n in nodes.values():
        if n["kind"] != "need":
            continue
        for tid in re.findall(r"\bT-\d{8}-\d{2}\b", n.get("topic_ids") or ""):
            edge(n["id"], nid("topic", tid), "evidence_for")

    for row in table_with(
        read("library/swipe/_index.md") if (ROOT / "library/swipe/_index.md").exists() else read("swipe/_index.md"),
        "id",
        "file",
        "platforms",
        "profiles",
        "form",
        "beats_or_pages",
        "status",
        "n",
        "win",
        "loss",
        "one_liner",
        "source",
    ):
        ident = row["id"]
        fpath = row["file"]
        if fpath and not fpath.startswith("library/swipe/") and not fpath.startswith("swipe/"):
            fpath = f"library/swipe/{fpath}" if (ROOT / "library/swipe").is_dir() else f"swipe/{fpath}"
        if fpath and fpath.startswith("swipe/") and (ROOT / "library/swipe").is_dir():
            fpath = f"library/{fpath}"
        if fpath and not fpath.endswith(".md"):
            fpath = f"{fpath}.md"
        add_node(
            node(
                "swipe",
                ident,
                row["one_liner"],
                fpath,
                {
                    "platforms": row["platforms"],
                    "profiles": row["profiles"],
                    "form": row["form"],
                    "beats": row["beats_or_pages"],
                    "status": row["status"],
                    "n": hit_int(row, "n"),
                    "win": hit_int(row, "win"),
                    "loss": hit_int(row, "loss"),
                    "source_cell": row["source"],
                    "lib": True,
                },
            )
        )
        for cid in CAPTURE_RE.findall(row["source"]):
            edge(nid("swipe", ident), nid("capture", cid), "sourced_from")

    atoms_index = "library/atoms/_index.md" if (ROOT / "library/atoms/_index.md").exists() else "wiki/atoms/_index.md"
    for row in table_with(
        read(atoms_index),
        "id",
        "file",
        "type",
        "platforms",
        "profiles",
        "status",
        "n",
        "win",
        "loss",
        "one_liner",
    ):
        ident = row["id"]
        fpath = row["file"]
        if fpath and not fpath.startswith("library/atoms/") and not fpath.startswith("wiki/atoms/"):
            fpath = f"library/atoms/{fpath}" if (ROOT / "library/atoms").is_dir() else f"wiki/atoms/{fpath}"
        if fpath and fpath.startswith("wiki/atoms/") and (ROOT / "library/atoms").is_dir():
            fpath = f"library/atoms/{fpath.split('/')[-1]}"
        if fpath and not fpath.endswith(".md"):
            fpath = f"{fpath}.md"
        add_node(
            node(
                "atom",
                ident,
                row["one_liner"],
                fpath,
                {
                    "atom_type": row["type"],
                    "platforms": row["platforms"],
                    "profiles": row["profiles"],
                    "status": row["status"],
                    "n": hit_int(row, "n"),
                    "win": hit_int(row, "win"),
                    "loss": hit_int(row, "loss"),
                    "lib": True,
                },
            )
        )
        if fpath and (ROOT / fpath).exists():
            for cid in CAPTURE_RE.findall(read(fpath)):
                edge(nid("atom", ident), nid("capture", cid), "sourced_from")

    claims_index = "library/claims/_index.md" if (ROOT / "library/claims/_index.md").exists() else "wiki/claims/_index.md"
    for row in table_with(
        read(claims_index),
        "id",
        "file",
        "type",
        "platforms",
        "profiles",
        "status",
        "n",
        "win",
        "loss",
        "one_liner",
    ):
        ident = row["id"]
        fpath = row["file"]
        if fpath and not fpath.startswith("library/claims/") and not fpath.startswith("wiki/claims/"):
            fpath = f"library/claims/{fpath}" if (ROOT / "library/claims").is_dir() else f"wiki/claims/{fpath}"
        if fpath and fpath.startswith("wiki/claims/") and (ROOT / "library/claims").is_dir():
            fpath = f"library/claims/{fpath.split('/')[-1]}"
        if fpath and not fpath.endswith(".md"):
            fpath = f"{fpath}.md"
        evidence_runs = []
        if (ROOT / fpath).exists():
            body = read(fpath)
            for cid in CAPTURE_RE.findall(body):
                edge(nid("claim", ident), nid("capture", cid), "sourced_from")
            in_ev = False
            for line in body.splitlines():
                if line.startswith("## Evidence"):
                    in_ev = True
                    continue
                if in_ev and line.startswith("## "):
                    break
                if in_ev:
                    evidence_runs += RUN_RE.findall(line)
        add_node(
            node(
                "claim",
                ident,
                row["one_liner"],
                fpath,
                {
                    "claim_type": row["type"],
                    "platforms": row["platforms"],
                    "profiles": row["profiles"],
                    "status": row["status"],
                    "n": hit_int(row, "n"),
                    "win": hit_int(row, "win"),
                    "loss": hit_int(row, "loss"),
                    "evidence_runs": evidence_runs,
                    "has_evidence": bool(evidence_runs),
                    "lib": True,
                },
            )
        )

    for row in extract_runs_table(read("runs/_index.md")):
        ident = row["run_id"]
        if not ident.startswith("RUN-"):
            continue
        folder_wiki = wiki_path(row["path"])
        folder = folder_wiki.replace("runs/", "").strip("/")
        rdir = ROOT / "runs" / folder if folder else None
        stage_files = run_stage_files(rdir, folder) if rdir and rdir.is_dir() and folder else {}
        stages = {n: n in stage_files for n in STAGE_NAMES}
        idea_path = stage_files.get("idea") or (f"runs/{folder}/idea.md" if folder else "")
        selection = {"swipe": "none", "atoms": "none", "claim": "none"}
        supersedes = ""
        superseded_by = ""
        capture_ids = []
        scheduled_date = row.get("scheduled", "").strip()
        if idea_path and (ROOT / idea_path).exists():
            idea = read(idea_path)
            fm = frontmatter(idea)
            supersedes = fm.get("supersedes", "")
            superseded_by = fm.get("superseded_by", "")
            if not scheduled_date:
                scheduled_date = str(
                    fm.get("scheduled")
                    or fm.get("scheduled_date")
                    or fm.get("scheduled_at")
                    or fm.get("publish_at")
                    or ""
                ).strip()
            for line in idea.splitlines():
                if "swipe_id" in line:
                    selection["swipe"] = line.split(":", 1)[-1].strip().lstrip("- ").replace("**swipe_id:**", "").strip()
                if "**atoms:**" in line or line.strip().startswith("- **atoms:**"):
                    selection["atoms"] = line.split(":", 1)[-1].strip().lstrip("- ").replace("**atoms:**", "").strip()
                if "hypothesis" in line and "swipe_why" not in line:
                    selection["claim"] = line.split(":", 1)[-1].strip().lstrip("- ").replace("**hypothesis:**", "").strip()
                if "claim_id" in line:
                    selection["claim"] = line.split(":", 1)[-1].strip().lstrip("- ").replace("**claim_id:**", "").strip()
                if "capture_ids" in line:
                    capture_ids = CAPTURE_RE.findall(line)
            sm = re.search(r"\*\*swipe_id:\*\*\s*(\S+)", idea)
            if sm:
                selection["swipe"] = sm.group(1)
            am = re.search(r"\*\*atoms:\*\*\s*(.+)", idea)
            if am:
                selection["atoms"] = am.group(1).strip()
            cm = re.search(r"\*\*(?:claim_id|hypothesis):\*\*\s*(\S+)", idea)
            if cm:
                selection["claim"] = cm.group(1)
            if not scheduled_date:
                m_sch = re.search(r"\*\*(?:scheduled|schedule|publish_at):\*\*\s*(\S+)", idea)
                if m_sch:
                    scheduled_date = m_sch.group(1).strip()
        if not scheduled_date and row["notes"]:
            m_note = re.search(r"(?:scheduled|schedule|plan):\s*(\d{4}-\d{2}-\d{2})", row["notes"], re.I)
            if m_note:
                scheduled_date = m_note.group(1).strip()
        if row["status"].lower() == "scheduled" and not scheduled_date:
            scheduled_date = row["date"]

        metrics = {}
        ship_urls = []
        fb = rdir / "feedback.md" if rdir else None
        if fb and fb.exists():
            fb_text = fb.read_text(encoding="utf-8")
            metrics = parse_feedback_metrics(fb_text)
            ship_urls = [u.rstrip(".,;") for u in HTTP_RE.findall(fb_text)]
        is_published = row["status"].lower() == "published"
        is_scheduled = (bool(scheduled_date) and not is_published) or (row["status"].lower() == "scheduled")
        add_node(
            node(
                "run",
                ident,
                row["one_liner"],
                f"runs/{folder}" if folder else "",
                {
                    "date": row["date"],
                    "scheduled_date": scheduled_date,
                    "is_scheduled": is_scheduled,
                    "is_published": is_published,
                    "published_date": row["date"] if is_published else "",
                    "published_url": "",
                    "published_result": "",
                    "status": row["status"],
                    "account": row["account"],
                    "profile": row["profile"],
                    "primary_platform": row["primary_platform"],
                    "platforms": row["platforms"],
                    "topic_id": row["topic_id"] if row["topic_id"] != "none" else "",
                    "pillar": row["pillar"],
                    "pack": row["pack"],
                    "export": row["export"],
                    "notes": row["notes"],
                    "folder": folder,
                    "stages": stages,
                    "stage_files": stage_files,
                    "selection": selection,
                    "supersedes": supersedes,
                    "superseded_by": superseded_by,
                    "metrics": metrics,
                    "ship_urls": ship_urls,
                    "open_file": idea_path,
                    "obsidian": obsidian_uri(idea_path) if idea_path else "",
                },
            )
        )
        if row["topic_id"] not in ("", "none"):
            edge(nid("run", ident), nid("topic", row["topic_id"]), "from_topic")
        for cid in capture_ids:
            edge(nid("run", ident), nid("capture", cid), "from_capture")
        for sid in field_ids(selection["swipe"], "swipe"):
            edge(nid("run", ident), nid("swipe", sid), "uses")
        for aid in field_ids(selection["atoms"], "atom"):
            edge(nid("run", ident), nid("atom", aid), "uses")
        for cid in field_ids(selection["claim"], "claim"):
            edge(nid("run", ident), nid("claim", cid), "uses")
        if supersedes.startswith("RUN-"):
            edges.append({"from": nid("run", ident), "to": nid("run", supersedes), "rel": "supersedes"})

    folder_to_run = {
        n["folder"]: n["ident"] for n in nodes.values() if n["kind"] == "run" and n.get("folder")
    }

    for row in table_with(
        read("published/_index.md"),
        "date",
        "platform",
        "url",
        "run",
        "pillar",
        "swipe",
        "atoms",
        "claim",
        "result",
        "notes",
    ):
        if not row["url"].startswith("http"):
            continue
        run_cell = row["run"]
        run_folder = run_folder_from_cell(run_cell)
        run_id = (RUN_RE.findall(run_cell) or [""])[0]
        if not run_id and run_folder in folder_to_run:
            run_id = folder_to_run[run_folder]
        run_node = nodes.get(nid("run", run_id)) if run_id else None
        profile = (run_node or {}).get("profile", "")
        ident = f"{row['date']}-{row['platform']}-{run_id or 'unknown'}"
        add_node(
            node(
                "published",
                ident,
                row["url"],
                "",
                {
                    "date": row["date"],
                    "platform": row["platform"],
                    "url": row["url"],
                    "run_id": run_id,
                    "run_folder": run_folder,
                    "profile": profile,
                    "topic_id": (run_node or {}).get("topic_id", "") or "",
                    "pillar": row["pillar"],
                    "swipe": row["swipe"],
                    "atoms": row["atoms"],
                    "claim": row["claim"],
                    "result": row["result"],
                    "notes": row["notes"],
                    "reviewable": row["result"] in ("win", "flat", "loss"),
                    "obsidian": obsidian_uri("published/_index.md"),
                    "path": "published/_index.md",
                },
            )
        )
        if run_id:
            edge(nid("published", ident), nid("run", run_id), "from_run")
            if run_node:
                run_node["published_date"] = row["date"] or run_node.get("published_date", "")
                run_node["published_url"] = row["url"]
                run_node["published_result"] = row["result"]
                run_node["is_published"] = True
        for sid in field_ids(row["swipe"], "swipe"):
            edge(nid("published", ident), nid("swipe", sid), "uses")
        for aid in field_ids(row["atoms"], "atom"):
            edge(nid("published", ident), nid("atom", aid), "uses")
        for cid in field_ids(row["claim"], "claim"):
            edge(nid("published", ident), nid("claim", cid), "uses")

    # Capture → source_url from Raw + engagement from entry/raw notes
    for n in list(nodes.values()):
        if n["kind"] != "capture":
            continue
        raw_node = None
        for e in edges:
            if e["rel"] != "has_raw" or e["from"] != n["id"]:
                continue
            raw_node = nodes.get(e["to"])
            if raw_node and raw_node.get("source_url"):
                n["source_url"] = raw_node["source_url"]
                n["raw_id"] = raw_node["ident"]
            break
        entry_text = read(n["path"]) if n.get("path") and (ROOT / n["path"]).exists() else ""
        raw_text = ""
        raw_path = ""
        if raw_node and raw_node.get("path"):
            raw_path = raw_node["path"]
        elif n.get("raw_path"):
            raw_path = n["raw_path"] if str(n["raw_path"]).endswith(".md") else f'{n["raw_path"]}.md'
        if raw_path and (ROOT / raw_path).exists():
            raw_text = read(raw_path)
        eng = merge_engagement(
            parse_engagement_snapshot(entry_text),
            parse_engagement_snapshot(raw_text),
        )
        for k, v in eng.items():
            if v:
                n[k] = v

    # drop edges to missing nodes
    edges = [e for e in edges if e["from"] in nodes and e["to"] in nodes]
    seen = set()
    uniq = []
    for e in edges:
        k = (e["from"], e["to"], e["rel"])
        if k not in seen:
            seen.add(k)
            uniq.append(e)

    run_uses: dict[str, set[str]] = {}
    for e in uniq:
        if e["rel"] != "uses":
            continue
        src = nodes.get(e["from"])
        dst = e["to"]
        if not src:
            continue
        if src["kind"] == "run":
            run_uses.setdefault(dst, set()).add(src["id"])
        elif src["kind"] == "published":
            run_uses.setdefault(dst, set()).add(nid("run", src["run_id"]) if src.get("run_id") else src["id"])
    for n in nodes.values():
        if n["kind"] in ("swipe", "atom", "claim"):
            n["refs"] = len(run_uses.get(n["id"], ()))

    # flat pillars: prefer first profile for legacy callers; JS uses pillars_by_profile
    flat_pillars = {}
    for pid in sorted(pillars_by_profile.keys()):
        for k, v in pillars_by_profile[pid].items():
            flat_pillars.setdefault(k, v)

    return {
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
        "vault": str(ROOT),
        "core_root": str(CORE),
        "vault_root": str(VAULT),
        "vault_equals_core": CORE.resolve() == VAULT.resolve(),
        "profiles": profiles,
        "accounts": accounts,
        "pillars_by_profile": pillars_by_profile,
        "pillars": flat_pillars,
        "needs_index_present": (ROOT / "needs" / "_index.md").exists(),
        "hits_index_present": (ROOT / "hits" / "_index.md").exists(),
        "products_index_present": (ROOT / "products" / "_index.md").exists(),
        "keywords": keywords,
        "media": parse_media(),
        "media_index_present": (ROOT / "media" / "_index.md").exists(),
        "wiki": parse_wiki_pages(),
        "wiki_notebooks": parse_wiki_notebooks(),
        "wiki_index_present": (ROOT / "wiki" / "_index.md").exists(),
        "nodes": list(nodes.values()),
        "edges": uniq,
    }


def _self_check() -> None:
    # ponytail: tiny parser asserts; expand if capture/raw formats drift again.
    d = parse_engagement_snapshot(
        "- **engagement snapshot:** likes 113 / replies 18 / bookmarks 17 / views 9574 @ 2026-08-30\n"
    )
    assert d == {
        "src_likes": "113",
        "src_replies": "18",
        "src_bookmarks": "17",
        "src_views": "9574",
        "engagement_at": "2026-08-30",
    }, d
    c = parse_engagement_snapshot(
        "6. **Engagement snapshot (fetch 2026-08-25):** ~92.9k views · 1086 likes · 1380 bookmarks · 738 replies · 70 reposts.\n"
    )
    assert c["src_views"] == "92900" and c["src_likes"] == "1086", c
    assert c["src_bookmarks"] == "1380" and c["src_replies"] == "738", c
    assert c["engagement_at"] == "2026-08-25", c
    r = parse_engagement_snapshot(
        "## Engagement snapshot\n\n- likes: 3\n- replies: 3\n- views: 426\n- bookmarks: 2\n- snapshot_at: 2026-09-13\n"
    )
    assert r["src_likes"] == "3" and r["src_views"] == "426" and r["engagement_at"] == "2026-09-13", r
    m = parse_engagement_snapshot(
        "## Snapshot metrics (at capture)\n\n- Views: ~8091\n- Likes: 103\n- Bookmarks: 29\n- Replies: 20\n"
    )
    assert m["src_views"] == "8091" and m["src_likes"] == "103", m
    assert m["src_bookmarks"] == "29" and m["src_replies"] == "20", m
    print("parse_engagement_snapshot self-check ok")

    dummy_md = (
        "| run_id | path | date | scheduled | status | account | profile | primary_platform | platforms | topic_id | pillar | one_liner | pack | export | notes |\n"
        "|--------|------|------|-----------|--------|---------|---------|------------------|-----------|----------|--------|-----------|------|--------|-------|\n"
        "| RUN-1  | [[runs/r1]] | 2026-09-16 | 2026-09-18 | scheduled | a | p | x | x | T-1 | P1 | Test run | no | no | ok |\n"
    )
    res = extract_runs_table(dummy_md)
    assert len(res) == 1 and res[0]["run_id"] == "RUN-1" and res[0]["scheduled"] == "2026-09-18", res
    print("extract_runs_table self-check ok")

    media_md = (
        "| id | file | sha256 | caption | tags | links | rights | hosted_image_id |\n"
        "|----|------|--------|---------|------|-------|--------|-----------------|\n"
        "| M-20260917-01 | logo.png | abc123 | Brand logo | logo brand | brand, P-001 | own-screenshot | img_9 |\n"
        "| (fill) | | | | | | | |\n"
    )
    mres = parse_media(media_md)
    assert len(mres) == 1, mres
    assert mres[0]["id"] == "M-20260917-01" and mres[0]["src"] == "media/logo.png", mres
    assert mres[0]["tags"] == ["logo", "brand"] and mres[0]["links"] == ["brand", "P-001"], mres
    assert mres[0]["hosted"] is True, mres
    print("parse_media self-check ok")
    core, vault = load_roots(_WB)
    assert core == _WB.parent
    assert vault == core or (core / "engine.json").exists()
    print(f"roots self-check ok core={core} vault={vault}")


def main() -> None:
    graph = build_graph()
    html = TPL.read_text(encoding="utf-8")
    payload = json.dumps(graph, ensure_ascii=False)
    html = html.replace("/*__GRAPH__*/null", payload)
    OUT.write_text(html, encoding="utf-8")
    print(f"wrote {OUT} ({len(graph['nodes'])} nodes, {len(graph['edges'])} edges)")


if __name__ == "__main__":
    import sys

    if "--self-check" in sys.argv:
        _self_check()
    else:
        main()
