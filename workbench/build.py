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
MEDIA_RE = re.compile(r"\bM-\d{8}-\d{2}\b")
SUBJECT_LINK_RE = re.compile(r"\b(?:P|R)-\d{3}\b")
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


def _bullet_vals(md: str, *keys: str) -> dict[str, str]:
    found: dict[str, str] = {}
    for line in (md or "").splitlines():
        s = line.strip()
        for key in keys:
            if key in found:
                continue
            m = re.match(rf"^(?:[-*]\s*)?\*\*{re.escape(key)}:\*\*\s*(.+)$", s, re.I)
            if not m:
                m = re.match(rf"^(?:[-*]\s*)?\*\*{re.escape(key)}\*\*\s*:\s*(.+)$", s, re.I)
            if not m:
                m = re.match(rf"^(?:[-*]\s*)?{re.escape(key)}\s*:\s*(.+)$", s, re.I)
            if m:
                found[key] = m.group(1).strip()
    return found


def _stage_done_flags(name: str, fm: dict, text: str, index_pack: str = "") -> bool:
    status = str(fm.get("status") or "").strip().upper()
    if name == "idea":
        return bool(_plain_snip(text, 40))
    if name == "brief":
        return bool(fm.get("gate_pass")) or status in {"DRAFTED", "APPROVED", "DONE"} or bool(_section_body(text, "Thesis"))
    if name == "packet":
        return "empty" not in status.lower() and bool(_plain_snip(text, 40))
    if name == "draft":
        return bool(re.search(r"^###\s+", text, re.M)) or bool(_plain_snip(_section_body(text, "x") or text, 60))
    if name == "editor":
        verdict = str(fm.get("verdict") or "").strip().upper()
        return verdict in {"APPROVE", "REWRITE", "HOLD", "APPROVED"} or status in {
            "APPROVED", "APPROVE", "REWRITE", "HOLD", "DONE"
        }
    if name == "rubric":
        total = str(fm.get("total") or "").strip()
        if total.isdigit() and int(total) > 0:
            return True
        if str(fm.get("ship") or "").lower() in {"true", "yes", "1"}:
            return True
        m = re.search(r"\*\*Total:\*\*\s*(\d+)", text)
        return bool(m and int(m.group(1)) > 0)
    if name == "pack":
        if str(index_pack or "").lower() in {"yes", "true", "1"}:
            return True
        if "NOT_REQUIRED" in status or "N/A" in status or status == "SKIP":
            return True
        if status in {"UNUSED", "EMPTY", ""}:
            return False
        try:
            return int(str(fm.get("page_count") or "0")) > 0
        except ValueError:
            return status not in {"UNUSED", "EMPTY"}
    if name == "feedback":
        vals = _bullet_vals(text, "url", "result")
        result = str(fm.get("result") or vals.get("result") or "").strip().lower()
        url = str(vals.get("url") or "").strip()
        if (
            result in {"", "unknown", "win | flat | loss | unknown", "|"}
            or "win | flat" in result
        ):
            result = ""
        if url.startswith("http"):
            return True
        return bool(result) and result not in {"empty"}
    return False


def parse_run_detail(
    folder: Path | None,
    stage_files: dict[str, str],
    *,
    index_status: str = "",
    index_pack: str = "",
    index_notes: str = "",
    topic_id: str = "",
    published_url: str = "",
    published_result: str = "",
) -> dict:
    """Compact stage summaries for the Run inspector (production console)."""
    stages: dict[str, dict] = {}
    thesis = ""
    constraints: list[str] = []
    w_ids: list[str] = []
    draft_excerpt = ""
    editor_verdict = ""
    brief_gate = ""
    selection = {"swipe": "", "atoms": "", "claim": ""}

    for name in STAGE_NAMES:
        rel = stage_files.get(name) or ""
        info: dict = {
            "exists": bool(rel),
            "done": False,
            "path": rel,
            "status": "",
            "summary": "",
        }
        if not rel or not folder:
            stages[name] = info
            continue
        path = ROOT / rel
        if not path.exists():
            stages[name] = info
            continue
        text = path.read_text(encoding="utf-8")
        fm = frontmatter(text)
        info["status"] = str(fm.get("status") or "").strip()
        info["done"] = _stage_done_flags(name, fm, text, index_pack=index_pack)

        if name == "idea":
            vals = _bullet_vals(text, "one_liner", "swipe_id", "atoms", "claim_id", "topic_id")
            info["summary"] = vals.get("one_liner") or _plain_snip(text, 180)
            if vals.get("swipe_id"):
                selection["swipe"] = vals["swipe_id"]
            if vals.get("atoms"):
                selection["atoms"] = vals["atoms"]
            if vals.get("claim_id"):
                selection["claim"] = vals["claim_id"]
            core = _section_body(text, "Core judgment (from Topic — do not reinvent)") or _section_body(text, "Core judgment")
            if core and not thesis:
                thesis = _plain_snip(core, 320)
            cons = _section_body(text, "Constraints (from Topic)") or _section_body(text, "Constraints")
            if cons:
                constraints = _list_snip(cons, 6)
            nb = _section_body(text, "Notebook")
            w_ids = sorted(set(WIKI_PAGE_RE.findall(nb or text)))

        elif name == "brief":
            th = _plain_snip(_section_body(text, "Thesis"), 320)
            info["summary"] = th
            info["thesis"] = th
            if th:
                thesis = th
            info["gate_score"] = str(fm.get("gate_score") or "").strip()
            info["gate_pass"] = bool(fm.get("gate_pass"))
            brief_gate = info["gate_score"]
            fw = _section_body(text, "For whom → what changes")
            info["for_whom"] = _plain_snip(fw, 280)
            info["boundaries"] = _list_snip(_section_body(text, "Boundaries"), 5)
            ev = _section_body(text, "Evidence")
            info["evidence"] = _plain_snip(ev, 240)

        elif name == "packet":
            info["summary"] = _plain_snip(_section_body(text, "Thesis (from brief — one sentence)") or _section_body(text, "Thesis"), 220)
            bans = _section_body(text, "Hard bans") or _section_body(text, "Hard bans / Softly")
            info["bans"] = _list_snip(bans, 5)

        elif name == "draft":
            # Prefer first platform section body
            body = ""
            for plat in ("x", "linkedin", "xiaohongshu", "instagram", "threads", "tiktok"):
                sec = _section_body(text, plat)
                if sec.strip():
                    body = sec
                    break
            if not body:
                body = text
            draft_excerpt = _plain_snip(body, 420)
            info["summary"] = draft_excerpt
            info["excerpt"] = draft_excerpt

        elif name == "editor":
            verdict = str(fm.get("verdict") or "").strip().upper()
            editor_verdict = verdict or info["status"]
            info["verdict"] = editor_verdict
            info["summary"] = editor_verdict
            why = _section_body(text, "Why rewrite")
            info["why"] = _plain_snip(why, 240)
            info["must_fix"] = _list_snip(_section_body(text, "Must fix"), 5)
            info["optional"] = _list_snip(_section_body(text, "Optional"), 4)

        elif name == "rubric":
            total = str(fm.get("total") or "").strip()
            m = re.search(r"\*\*Total:\*\*\s*([^\n]+)", text)
            if m and (not total or total == "0"):
                raw = m.group(1).strip()
                if re.match(r"^\d+", raw):
                    total = raw.split()[0]
            if total == "0":
                total = ""
            info["total"] = total
            info["ship"] = str(fm.get("ship") or "").lower() in {"true", "yes", "1"}
            gate = ""
            gm = re.search(r"\*\*Gate:\*\*\s*([^\n]+)", text)
            if gm:
                gate = gm.group(1).strip()
                if "SHIP (≥8) | HOLD" in gate and not total:
                    gate = ""
            info["gate"] = gate
            info["summary"] = " · ".join([x for x in [total and f"score {total}", gate] if x])

        elif name == "pack":
            info["page_count"] = str(fm.get("page_count") or "").strip()
            info["platform"] = str(fm.get("platform") or "").strip()
            if "NOT_REQUIRED" in info["status"].upper():
                info["summary"] = "not required"
            else:
                info["summary"] = info["status"] or ("ready" if info["done"] else "unused")

        elif name == "feedback":
            vals = _bullet_vals(text, "url", "result", "metrics", "vs claim", "notes")
            result = vals.get("result") or published_result or str(fm.get("result") or "")
            if "win | flat" in result.lower():
                result = ""
            info["url"] = vals.get("url") or published_url or ""
            info["result"] = result
            info["summary"] = result or ("published" if published_url else "")

        stages[name] = info

    # Current stage = first incomplete; published runs land on feedback.
    current = "idea"
    st_l = (index_status or "").lower()
    if st_l == "published":
        current = "feedback"
    else:
        for name in STAGE_NAMES:
            if not stages.get(name, {}).get("done"):
                current = name
                break
        else:
            current = "feedback" if st_l == "published" else "pack"

    next_hint = ""
    m_next = re.search(r"next:\s*([^·|;]+)", index_notes or "", re.I)
    if m_next:
        next_hint = m_next.group(1).strip()

    return {
        "thesis": thesis,
        "constraints": constraints,
        "w_ids": w_ids,
        "topic_id": topic_id,
        "selection": selection,
        "current_stage": current,
        "next_hint": next_hint,
        "editor_verdict": editor_verdict,
        "brief_gate": brief_gate,
        "draft_excerpt": draft_excerpt,
        "stages": stages,
    }


def _md_section(md: str, name: str) -> str:
    if f"## {name}" not in md:
        return ""
    body = md.split(f"## {name}", 1)[1]
    if "\n## " in body:
        body = body.split("\n## ", 1)[0]
    return body


def _table_rows(section_md: str) -> list[dict[str, str]]:
    for t in extract_tables(section_md):
        if not t["headers"]:
            continue
        key = {h.lower(): h for h in t["headers"]}
        out = []
        for row in t["rows"]:
            out.append({h: row.get(key[h], "").strip() for h in key})
        return out
    return []


def parse_pack_chain(text: str) -> dict:
    """Page Contracts → Media → Template Selection (+ experiment) for run inspector."""
    contracts = []
    for row in _table_rows(_md_section(text, "Page Contracts")):
        page = (row.get("page") or "").strip()
        if not re.match(r"^\d+$", page):
            continue
        contracts.append(
            {
                "page": int(page),
                "page_purpose": (row.get("page_purpose") or "").strip(),
                "page_role": (row.get("page_role") or "").strip(),
                "density": (row.get("density") or "").strip(),
                "slot_summary": (row.get("slot_summary") or "").strip(),
                "media_requirements": (row.get("media_requirements") or "").strip(),
                "reader_action": (row.get("reader_action") or "").strip(),
            }
        )
    media_rows = []
    for row in _table_rows(_md_section(text, "Media")):
        mid = (row.get("media_id") or "").strip()
        if not mid or mid.lower() in {"media_id", "m-…", "m-..."}:
            continue
        media_rows.append(
            {
                "page": (row.get("page") or "").strip(),
                "subject": (row.get("subject") or "").strip(),
                "media_id": mid,
                "role": (row.get("role") or "").strip(),
                "caption": (row.get("caption") or "").strip(),
            }
        )
    templates = []
    for row in _table_rows(_md_section(text, "Template Selection")):
        page = (row.get("page") or "").strip()
        if not re.match(r"^\d+$", page):
            continue
        templates.append(
            {
                "page": int(page),
                "layout_family": (row.get("layout_family") or "").strip(),
                "template_id": (row.get("template_id") or "").strip(),
                "evidence": (row.get("evidence") or "").strip(),
                "reason": (row.get("reason") or "").strip(),
                "mode": (row.get("mode") or "").strip(),
            }
        )
    exp_body = _md_section(text, "Experiment")
    comparable = ""
    variables = ""
    m_comp = re.search(r"\*\*comparable:\*\*\s*(.+)", exp_body, re.I)
    if m_comp:
        comparable = m_comp.group(1).strip()
    m_vars = re.search(r"\*\*variables_changed:\*\*\s*(.+)", exp_body, re.I)
    if m_vars:
        variables = m_vars.group(1).strip()
    meta = {}
    meta_body = _md_section(text, "Meta")
    for key in ("w_ids", "product_ids", "recommendation_ids", "hook_type", "topic_id", "profile", "run_id"):
        m = re.search(rf"\*\*{key}:\*\*\s*(.+)", meta_body, re.I)
        if m:
            meta[key] = m.group(1).strip()
    arc = ""
    m_arc = re.search(r"\*\*one_liner:\*\*\s*(.+)", _md_section(text, "Arc"), re.I)
    if m_arc:
        arc = m_arc.group(1).strip()
    return {
        "arc": arc,
        "meta": meta,
        "contracts": contracts,
        "media": media_rows,
        "templates": templates,
        "experiment": {"comparable": comparable, "variables_changed": variables},
    }


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
                "root_file": f"{path}/README.md",
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
                "state": (meta.get("state") or "").strip(),
                "confidence": (meta.get("confidence") or "").strip(),
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



def _section_body(md: str, heading: str) -> str:
    """Return markdown body under ## heading until next ## or end."""
    pat = re.compile(rf"^##\s+{re.escape(heading)}\s*$", re.M)
    m = pat.search(md or "")
    if not m:
        return ""
    rest = (md or "")[m.end() :]
    nxt = re.search(r"^##\s+", rest, re.M)
    return rest[: nxt.start()] if nxt else rest


def _bullet_field(block: str, key: str) -> str:
    """Parse '- key: value' or '**Key:** value' lines."""
    for line in (block or "").splitlines():
        s = line.strip()
        if not s:
            continue
        # - key: value
        m = re.match(rf"^[-*]\s*{re.escape(key)}\s*:\s*(.*)$", s, re.I)
        if m:
            return m.group(1).strip()
        # **Key:** value  OR  - **Key:** value  (colon inside bold)
        m = re.match(rf"^(?:[-*]\s*)?\*\*{re.escape(key)}:\*\*\s*(.*)$", s, re.I)
        if m:
            return m.group(1).strip()
        # **Key**: value  OR  - **Key**: value
        m = re.match(rf"^(?:[-*]\s*)?\*\*{re.escape(key)}\*\*\s*:\s*(.*)$", s, re.I)
        if m:
            return m.group(1).strip()
    return ""


def _plain_snip(text: str, limit: int = 360) -> str:
    """Collapse markdown noise into a short readable snippet."""
    if not text:
        return ""
    lines = []
    for raw in text.splitlines():
        s = raw.strip()
        if not s or s.startswith("#") or s.startswith("|") or s.startswith("```"):
            continue
        s = re.sub(r"!\[[^\]]*\]\([^)]+\)", "", s)
        s = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", s)
        s = re.sub(r"[*`_]+", "", s)
        s = re.sub(r"^\s*[-*]\s+", "", s)
        s = re.sub(r"^\d+\.\s+", "", s)
        s = s.strip()
        if s:
            lines.append(s)
        if sum(len(x) for x in lines) >= limit:
            break
    out = " ".join(lines).strip()
    if len(out) > limit:
        out = out[: limit - 1].rstrip() + "…"
    return out


def _list_snip(text: str, limit: int = 3) -> list[str]:
    items = []
    for raw in (text or "").splitlines():
        s = raw.strip()
        if not s.startswith(("-", "*", "1.", "2.", "3.", "4.", "5.", "6.")):
            continue
        s = re.sub(r"^\d+\.\s+", "", s)
        s = re.sub(r"^[-*]\s+", "", s)
        s = re.sub(r"\*\*([^*]+)\*\*", r"\1", s)
        s = re.sub(r"[*`_]+", "", s).strip()
        if s:
            items.append(s)
        if len(items) >= limit:
            break
    return items


def context_detail_wiki(md: str, meta: dict | None = None) -> dict:
    meta = meta or frontmatter(md or "")
    status = _section_body(md, "Judgment status")
    believe = _plain_snip(_section_body(md, "We believe"), 420)
    counter = _bullet_field(status, "Counter-evidence") or _bullet_field(status, "Counter evidence")
    next_test = _bullet_field(status, "Next test")
    state_line = _bullet_field(status, "State")
    conf_line = _bullet_field(status, "Confidence")
    return {
        "kind": "wiki",
        "title": (meta.get("title") or "").strip(),
        "belief": believe,
        "counter_evidence": _plain_snip(counter, 180),
        "next_test": _plain_snip(next_test, 180),
        "state": (meta.get("state") or "").strip() or _plain_snip(state_line, 80),
        "confidence": (meta.get("confidence") or "").strip() or _plain_snip(conf_line, 40),
        "status": (meta.get("status") or "").strip(),
    }


def context_detail_product(md: str, meta: dict | None = None, audience: str = "") -> dict:
    meta = meta or frontmatter(md or "")
    boundaries = _section_body(md, "Boundaries")
    do_not = _section_body(md, "Do not say")
    if not do_not and "### Do not say" in (md or ""):
        # Nested under Claims
        m = re.search(r"^###\s+Do not say\s*$", md or "", re.M)
        if m:
            rest = (md or "")[m.end() :]
            nxt = re.search(r"^###\s+|^##\s+", rest, re.M)
            do_not = rest[: nxt.start()] if nxt else rest
    return {
        "kind": "product",
        "title": (meta.get("name") or "").strip(),
        "promise": _plain_snip(_section_body(md, "Product promise"), 320),
        "what_it_is": _plain_snip(_section_body(md, "What it is"), 360),
        "best_for": _plain_snip(_section_body(md, "Best for"), 240),
        "not_for": _plain_snip(_section_body(md, "Not for"), 240),
        "boundaries": _plain_snip(boundaries, 280),
        "do_not_say": _list_snip(do_not, 4),
        "audience": audience or "",
        "status": (meta.get("status") or "").strip(),
    }


def context_detail_capture(md: str, meta: dict | None = None, one_liner: str = "") -> dict:
    meta = meta or frontmatter(md or "")
    intent = _section_body(md, "User intent / source")
    notes = _section_body(md, "Key points (our notes)")
    steal = ""
    if "### What to steal / foil" in (notes or ""):
        steal = notes.split("### What to steal / foil", 1)[1]
        if "\n### " in steal:
            steal = steal.split("\n### ", 1)[0]
    url = _bullet_field(intent, "URL")
    handle = _bullet_field(intent, "Handle")
    heat = _bullet_field(intent, "Heat") or _bullet_field(intent, "Heat (2026-09-21)")
    # Heat line may be "Heat (date): ..." — also try loose match
    if not heat:
        for line in (intent or "").splitlines():
            if "heat" in line.lower() and ":" in line:
                heat = line.split(":", 1)[1].strip()
                break
    return {
        "kind": "capture",
        "title": one_liner or "",
        "one_liner": _plain_snip(_section_body(md, "One-liner") or one_liner, 280),
        "source_url": url,
        "handle": handle,
        "heat": _plain_snip(heat, 120),
        "notes": _list_snip(steal or notes, 4),
        "type": (meta.get("type") or "").strip(),
        "status": "",
    }


def context_detail_claim(md: str, meta: dict | None = None, one_liner: str = "") -> dict:
    meta = meta or frontmatter(md or "")
    claim = ""
    # Body after first H1 (claim files often use "# 主张（Objective）")
    parts = re.split(r"^#\s+.+$", md or "", maxsplit=1, flags=re.M)
    if len(parts) > 1:
        body = parts[1]
        if "\n## " in body:
            body = body.split("\n## ", 1)[0]
        claim = _plain_snip(body, 420)
    if not claim:
        for heading in ("主张（Objective）", "主张", "Objective", "Claim"):
            body = _section_body(md, heading)
            if body:
                claim = _plain_snip(body, 420)
                break
    if not claim:
        claim = one_liner
    return {
        "kind": "claim",
        "title": one_liner or (meta.get("id") or ""),
        "claim": claim,
        "applies_when": _list_snip(_section_body(md, "Applies when"), 3),
        "avoid_when": _list_snip(_section_body(md, "Avoid when"), 3),
        "status": (meta.get("status") or "").strip(),
        "confidence": (meta.get("confidence") or "").strip(),
    }


def context_detail_swipe(md: str, meta: dict | None = None, one_liner: str = "") -> dict:
    meta = meta or frontmatter(md or "")
    return {
        "kind": "swipe",
        "title": one_liner or "",
        "when_to_use": _list_snip(_section_body(md, "When to use"), 3),
        "when_to_avoid": _list_snip(_section_body(md, "When to avoid"), 3),
        "beats": _list_snip(_section_body(md, "Beats / pages (argument structure only — no full copy)")
                            or _section_body(md, "Beats / pages"), 4),
        "constraints": _list_snip(_section_body(md, "Constraints"), 3),
        "form": (meta.get("form") or "").strip(),
        "status": (meta.get("status") or "").strip(),
        "tags": meta.get("tags") if isinstance(meta.get("tags"), list) else [],
    }


def context_detail_atom(md: str, meta: dict | None = None, one_liner: str = "") -> dict:
    meta = meta or frontmatter(md or "")
    body = _section_body(md, "Atom") or _section_body(md, "Text") or ""
    if not body:
        # first paragraph after H1
        parts = (md or "").split("\n# ", 1)
        chunk = parts[1] if len(parts) > 1 else (md or "")
        if "\n## " in chunk:
            chunk = chunk.split("\n## ", 1)[0]
        body = chunk
    return {
        "kind": "atom",
        "title": one_liner or "",
        "text": _plain_snip(body, 360) or one_liner,
        "atom_type": (meta.get("type") or "").strip(),
        "status": (meta.get("status") or "").strip(),
    }


def context_detail_need(quote: str = "", speaker: str = "", frequency: str = "", status: str = "") -> dict:
    return {
        "kind": "need",
        "title": quote or "",
        "quote": quote or "",
        "speaker": speaker or "",
        "frequency": frequency or "",
        "status": status or "",
    }


def parse_topic_item(md: str) -> dict:
    """Extract decision + generation provenance from a Topic item file."""
    out: dict = {
        "verdict": "",
        "why_status": "",
        "who_for": "",
        "core_judgment": "",
        "next_step": "",
        "problem": "",
        "believe_now": "",
        "cut": "",
        "why_now": "",
        "change_after": "",
        "based_on": "",
        "gaps": "",
        "suggested_form": "",
        "trace": {},
        "context_packet": {},
        "constraints": [],
        "provenance": [],
    }
    if not md:
        return out

    # Decision card bold fields
    decision = md
    # Prefer content before Score / Trace appendix
    split = re.search(r"^##\s+Score\b|^##\s+Trace\b|^###\s+Score\b|^###\s+Trace\b", md, re.M)
    if split:
        decision = md[: split.start()]

    # Decision fields are written as **Label:** value (colon inside bold).
    field_map = {
        "Verdict": "verdict",
        "Why this status": "why_status",
        "Who it's for": "who_for",
        "Who it\u2019s for": "who_for",
        "Core judgment": "core_judgment",
        "Next step": "next_step",
        "Product link": "product_link",
        "Generation path": "generation_path",
    }
    for label, key in field_map.items():
        m = re.search(rf"\*\*{re.escape(label)}:\*\*\s*(.+)$", decision, re.M)
        if not m:
            m = re.search(rf"\*\*{re.escape(label)}\*\*\s*:\s*(.+)$", decision, re.M)
        if m and not out.get(key):
            out[key] = m.group(1).strip()

    section_map = {
        "What problem does this solve?": "problem",
        "What do they believe now?": "believe_now",
        "What cut are we making?": "cut",
        "Why now?": "why_now",
        "What should change after reading?": "change_after",
        "What is this based on?": "based_on",
        "Current gaps": "gaps",
        "Suggested form": "suggested_form",
    }
    for heading, key in section_map.items():
        body = _section_body(decision, heading).strip()
        if body:
            # Keep short: first paragraph / bullets collapsed
            lines = [ln.strip() for ln in body.splitlines() if ln.strip() and not ln.strip().startswith("#")]
            out[key] = "\n".join(lines[:8])

    # Trace subsection (## Trace or ### Trace)
    trace_body = ""
    for h in ("Trace", "Score / trace appendix"):
        # Prefer ### Trace inside appendix
        m = re.search(r"^###\s+Trace\s*$", md, re.M)
        if m:
            rest = md[m.end() :]
            nxt = re.search(r"^###\s+|^##\s+", rest, re.M)
            trace_body = rest[: nxt.start()] if nxt else rest
            break
        body = _section_body(md, h)
        if body and "source:" in body.lower():
            # if whole appendix, try to find Trace inside
            m2 = re.search(r"^###\s+Trace\s*$", body, re.M)
            if m2:
                rest = body[m2.end() :]
                nxt = re.search(r"^###\s+", rest, re.M)
                trace_body = rest[: nxt.start()] if nxt else rest
            else:
                trace_body = body
            break
    else:
        m = re.search(r"^###\s+Trace\s*$", md, re.M)
        if m:
            rest = md[m.end() :]
            nxt = re.search(r"^###\s+|^##\s+", rest, re.M)
            trace_body = rest[: nxt.start()] if nxt else rest

    trace: dict[str, str] = {}
    for line in (trace_body or "").splitlines():
        s = line.strip().lstrip("-").strip()
        if ":" not in s:
            continue
        key, val = s.split(":", 1)
        key, val = key.strip().lower(), val.strip()
        if not key or val.lower().startswith("none"):
            if key:
                trace[key] = ""
            continue
        trace[key] = val
    out["trace"] = trace

    # Context Packet
    cp_body = ""
    m = re.search(r"^###\s+Context Packet\s*$", md, re.M)
    if m:
        rest = md[m.end() :]
        nxt = re.search(r"^###\s+|^##\s+", rest, re.M)
        cp_body = rest[: nxt.start()] if nxt else rest
    else:
        cp_body = _section_body(md, "Context Packet")
    packet: dict[str, str] = {}
    for line in (cp_body or "").splitlines():
        s = line.strip().lstrip("-").strip()
        if ":" not in s:
            continue
        key, val = s.split(":", 1)
        packet[key.strip().lower()] = val.strip()
    out["context_packet"] = packet

    # Constraints bullets
    cons = _section_body(md, "Constraints") or ""
    if not cons:
        m = re.search(r"^###\s+Constraints\s*$", md, re.M)
        if m:
            rest = md[m.end() :]
            nxt = re.search(r"^###\s+|^##\s+", rest, re.M)
            cons = rest[: nxt.start()] if nxt else rest
    constraints = []
    for line in cons.splitlines():
        s = line.strip()
        if s.startswith("-"):
            constraints.append(s.lstrip("-").strip())
    out["constraints"] = constraints[:12]

    # Provenance rows from packet + trace (structured for UI)
    prov = []
    role_sources = [
        ("input", packet.get("input_nodes") or trace.get("source") or ""),
        ("judgment", packet.get("judgment_nodes") or ""),
        ("evidence", packet.get("evidence_nodes") or ""),
        ("counter_evidence", packet.get("counter_evidence") or ""),
        ("constraint", packet.get("forbidden_claims") or ""),
    ]
    # Also pull swipe/atoms/claims from trace
    for role, blob in [
        ("craft", trace.get("swipe") or ""),
        ("craft", trace.get("atoms") or ""),
        ("claim", trace.get("claim") or ""),
        ("need", trace.get("need_ids") or ""),
        ("product", trace.get("product_ids") or ""),
        ("capture", trace.get("capture_id") or ""),
        ("wiki", " ".join(WIKI_PAGE_RE.findall(trace.get("source") or ""))),
    ]:
        role_sources.append((role, blob))

    seen: set[tuple[str, str]] = set()
    epistemic = trace.get("epistemic_label") or ""
    reason = trace.get("retrieval_reason") or ""

    def _ids_from(blob: str) -> list[tuple[str, str]]:
        found: list[tuple[str, str]] = []
        for kind, rx in [
            ("product", PRODUCT_RE),
            ("recommendation", RECOMMENDATION_RE),
            ("need", re.compile(r"\bN-\d{8}-\d{2}\b")),
            ("capture", CAPTURE_RE),
            ("wiki", WIKI_PAGE_RE),
            ("swipe", SWIPE_RE),
            ("atom", ATOM_RE),
            ("claim", CLAIM_RE),
            ("run", RUN_RE),
            ("media", MEDIA_RE),
            ("topic", re.compile(r"\bT-\d{8}-\d{2}\b")),
        ]:
            for ident in rx.findall(blob or ""):
                found.append((kind, ident))
        return found

    for role, blob in role_sources:
        for kind, ident in _ids_from(blob):
            key = (role, ident)
            if key in seen:
                continue
            seen.add(key)
            # epistemic snippet mentioning this id
            epi = ""
            for part in re.split(r"[;；]", epistemic):
                if ident in part:
                    epi = part.strip()
                    break
            why = ""
            for part in re.split(r"[;；]", reason):
                if ident in part or (role == "input" and "explicit" in part.lower()) or (role == "judgment" and "judgment" in part.lower()):
                    why = part.strip()
                    break
            prov.append(
                {
                    "role": role,
                    "kind": kind,
                    "ident": ident,
                    "epistemic": epi,
                    "reason": why,
                }
            )
    out["provenance"] = prov
    return out



def parse_media(md: str | None = None) -> list[dict]:
    if md is None:
        md = read("media/_index.md")
    # Prefer schema with role; fall back for older indexes.
    rows = table_with(
        md,
        "id", "file", "sha256", "caption", "tags", "role", "links", "rights", "hosted_image_id",
    )
    if not rows:
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
        links = [l for l in re.split(r"[\s,]+", (row.get("links") or "").strip()) if l]
        subjects = SUBJECT_LINK_RE.findall(" ".join(links))
        out.append(
            {
                "id": ident,
                "file": f,
                "src": src,
                "sha256": (row.get("sha256") or "").strip(),
                "caption": (row.get("caption") or "").strip(),
                "tags": [t for t in re.split(r"\s+", (row.get("tags") or "").strip()) if t],
                "role": (row.get("role") or "").strip(),
                "links": links,
                "subjects": subjects,
                "rights": (row.get("rights") or "").strip(),
                "hosted_image_id": hosted,
                "hosted": bool(hosted),
            }
        )
    return out


_BRAND_ROWS = {
    "display_name": ("identity", "**Display name**"),
    "handle": ("identity", "**Handle**"),
    "logo": ("identity", "**Logo**"),
    "primary": ("colors", "**primary**"),
    "accent": ("colors", "**accent**"),
    "background": ("colors", "**background**"),
    "text": ("colors", "**text**"),
    "heading_font": ("fonts", "**Heading**"),
    "body_font": ("fonts", "**Body**"),
}
_HEX_RE = re.compile(r"^#[0-9A-Fa-f]{6}$")
_LOGO_RE = re.compile(r"^M-\d{8}-\d{2}$")
_PROFILE_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,64}$")


def _clean_brand_cell(raw: str) -> str:
    s = raw.strip().strip("`").strip()
    s = re.sub(r"\s*\(.*$", "", s).strip().strip("`").strip()
    if s.lower() in {"", "(fill)", "none", "—", "-"}:
        return ""
    return s


def parse_brand_file(text: str) -> dict:
    """Token fields only. Render binding is ignored."""
    section = ""
    found: dict[str, str] = {}
    for line in text.splitlines():
        if line.startswith("## "):
            low = line.lower()
            if "render binding" in low:
                break
            if "identity" in low:
                section = "identity"
            elif "color" in low:
                section = "colors"
            elif "font" in low:
                section = "fonts"
            else:
                section = ""
            continue
        if not section or not line.strip().startswith("|"):
            continue
        for key, (sec, label) in _BRAND_ROWS.items():
            if sec == section and label.lower() in line.lower():
                cells = [c.strip() for c in line.strip().strip("|").split("|")]
                if len(cells) >= 2:
                    found[key] = _clean_brand_cell(cells[1])
                break
    return {key: found.get(key, "") for key in _BRAND_ROWS}


def _format_brand_value(key: str, raw: str) -> str:
    value = str(raw or "").strip()
    if "|" in value or "\n" in value:
        raise ValueError(f"{key} cannot contain |")
    if key == "logo":
        if not value or value.lower() == "none":
            return "`none`"
        if not _LOGO_RE.fullmatch(value):
            raise ValueError("logo must be none or M-YYYYMMDD-XX")
        return f"`{value}`"
    if key in {"primary", "accent", "background", "text"}:
        if not value:
            return "(fill)"
        if not _HEX_RE.fullmatch(value):
            raise ValueError(f"{key} must be #RRGGBB")
        return value.upper()
    if len(value) > 80:
        raise ValueError(f"{key} is too long")
    return value or "(fill)"


def apply_brand_fields(text: str, raw_fields: dict) -> str:
    """Replace token cells. Leave ## Render binding and all prose untouched."""
    marker = "## Render binding"
    if marker not in text:
        raise ValueError("brand.md missing Render binding section")
    head, tail = text.split(marker, 1)
    formatted = {key: _format_brand_value(key, raw_fields.get(key, "")) for key in _BRAND_ROWS}
    lines = head.splitlines()
    section = ""
    seen: set[str] = set()
    out: list[str] = []
    for line in lines:
        if line.startswith("## "):
            low = line.lower()
            if "identity" in low:
                section = "identity"
            elif "color" in low:
                section = "colors"
            elif "font" in low:
                section = "fonts"
            else:
                section = ""
            out.append(line)
            continue
        if section and line.strip().startswith("|"):
            for key, (sec, label) in _BRAND_ROWS.items():
                if sec != section or label.lower() not in line.lower():
                    continue
                parts = line.split("|")
                if len(parts) < 4:
                    break
                parts[2] = f" {formatted[key]} "
                line = "|".join(parts)
                seen.add(key)
                break
        out.append(line)
    missing = [k for k in _BRAND_ROWS if k not in seen]
    if missing:
        raise ValueError("brand.md missing rows: " + ", ".join(missing))
    new_head = "\n".join(out)
    if head.endswith("\n"):
        new_head += "\n"
    return new_head + marker + tail


def load_brands(profiles: list[dict]) -> list[dict]:
    brands = []
    for p in profiles:
        rel = f"{p['path']}brand.md"
        fp = ROOT / rel
        if not fp.is_file():
            continue
        row = parse_brand_file(fp.read_text(encoding="utf-8"))
        row["profile_id"] = p["id"]
        row["path"] = rel
        brands.append(row)
    return brands


_MEDIA_EXT = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
}


def save_media_upload(
    vault: Path,
    data: bytes,
    filename: str,
    *,
    role: str = "logo",
    caption: str = "",
    tags: str = "logo",
    links: str = "brand",
    rights: str = "own-upload",
) -> dict:
    """Write bytes into media/ and prepend a catalog row. Dedupes by sha256."""
    import hashlib
    from datetime import date

    if not data:
        raise ValueError("empty file")
    if len(data) > 5_000_000:
        raise ValueError("file too large (max 5MB)")
    ext = Path(filename or "").suffix.lower()
    if ext not in _MEDIA_EXT:
        raise ValueError("use png, jpg, webp, or svg")
    role = (role or "logo").strip()
    if role not in {"logo", "home", "pricing", "settings", "compare", "proof", "other"}:
        raise ValueError("bad role")
    media_dir = vault.resolve() / "media"
    media_dir.mkdir(parents=True, exist_ok=True)
    index_path = media_dir / "_index.md"
    if not index_path.is_file():
        raise ValueError("media/_index.md missing")
    digest = hashlib.sha256(data).hexdigest()
    index_text = index_path.read_text(encoding="utf-8")
    existing = parse_media(index_text)
    for row in existing:
        if row.get("sha256") == digest:
            return {
                "id": row["id"],
                "file": row["file"],
                "sha256": digest,
                "role": row.get("role") or role,
                "duplicate": True,
            }
    today = date.today().strftime("%Y%m%d")
    nums = [int(n) for n in re.findall(rf"M-{today}-(\d{{2}})", index_text)]
    mid = f"M-{today}-{max(nums, default=0) + 1:02d}"
    rel_file = f"{mid}{ext}"
    (media_dir / rel_file).write_bytes(data)
    # Keep uploads incomplete until Agent/human writes a real caption.
    raw_cap = (caption or "").strip().replace("|", " ")[:80]
    if raw_cap and raw_cap != Path(filename).stem:
        cap = raw_cap
    else:
        cap = "(needs description)"
    tag_s = " ".join(t for t in re.split(r"\s+", tags.strip()) if t) or "logo"
    row = (
        f"| {mid} | {rel_file} | {digest} | {cap} | {tag_s} | {role} | "
        f"{links.strip() or 'brand'} | {rights.strip() or 'own-upload'} | |"
    )
    lines = index_text.splitlines()
    out: list[str] = []
    inserted = False
    for i, line in enumerate(lines):
        out.append(line)
        if (
            not inserted
            and line.strip().startswith("|")
            and set(line.replace("|", "").strip()) <= set("-: ")
        ):
            # header separator — insert newest row next
            out.append(row)
            inserted = True
    if not inserted:
        raise ValueError("media index table missing")
    index_path.write_text("\n".join(out) + ("\n" if index_text.endswith("\n") else ""), encoding="utf-8")
    return {
        "id": mid,
        "file": rel_file,
        "sha256": digest,
        "role": role,
        "duplicate": False,
        "src": f"media/{rel_file}",
    }


_MEDIA_ID_RE = re.compile(r"^M-\d{8}-\d{2}$")


def delete_media(vault: Path, ids: list[str]) -> dict:
    """Remove media catalog rows and local files. Clears brand.md logo refs that pointed at them."""
    wanted = []
    for raw in ids or []:
        mid = str(raw or "").strip()
        if not _MEDIA_ID_RE.fullmatch(mid):
            raise ValueError(f"bad media id: {mid}")
        wanted.append(mid)
    if not wanted:
        raise ValueError("no media ids")
    wanted_set = set(wanted)
    media_dir = vault.resolve() / "media"
    index_path = media_dir / "_index.md"
    if not index_path.is_file():
        raise ValueError("media/_index.md missing")
    index_text = index_path.read_text(encoding="utf-8")
    catalog = {m["id"]: m for m in parse_media(index_text)}
    missing = sorted(wanted_set - set(catalog))
    if missing:
        raise ValueError("unknown media: " + ", ".join(missing))
    lines = index_text.splitlines()
    kept: list[str] = []
    removed_files: list[str] = []
    for line in lines:
        if line.strip().startswith("|"):
            cells = [c.strip() for c in line.strip().strip("|").split("|")]
            if cells and _MEDIA_ID_RE.fullmatch(cells[0].strip("`")) and cells[0].strip("`") in wanted_set:
                mid = cells[0].strip("`")
                f = catalog[mid].get("file") or ""
                if f:
                    removed_files.append(f)
                continue
        kept.append(line)
    index_path.write_text("\n".join(kept) + ("\n" if index_text.endswith("\n") else ""), encoding="utf-8")
    deleted = []
    for f in removed_files:
        name = Path(str(f)).name
        if not name or name != str(f).replace("\\", "/").split("/")[-1]:
            continue
        fp = (media_dir / name).resolve()
        try:
            fp.relative_to(media_dir)
        except ValueError:
            continue
        if fp.is_file():
            fp.unlink()
        deleted.append(name)
    cleared_brands = []
    profiles = vault.resolve() / "profiles"
    if profiles.is_dir():
        for brand_path in profiles.glob("*/brand.md"):
            text = brand_path.read_text(encoding="utf-8")
            parsed = parse_brand_file(text)
            logo = parsed.get("logo") or ""
            if logo not in wanted_set:
                continue
            fields = {**parsed, "logo": "none"}
            brand_path.write_text(apply_brand_fields(text, fields), encoding="utf-8")
            cleared_brands.append(brand_path.parent.name)
    return {
        "deleted_ids": sorted(wanted_set),
        "deleted_files": deleted,
        "cleared_brand_logos": cleared_brands,
    }



_MEDIA_ROLES = {"logo", "home", "pricing", "settings", "compare", "proof", "other"}


def _normalize_media_links(links: str | list[str] | None) -> list[str]:
    if isinstance(links, list):
        tokens = [str(x).strip() for x in links if str(x).strip()]
    else:
        tokens = [t for t in re.split(r"[\s,]+", str(links or "").strip()) if t]
    allowed: list[str] = []
    for tok in tokens:
        if tok == "brand" or tok.startswith(("P-", "R-", "C-", "RUN-", "W-")):
            if tok not in allowed:
                allowed.append(tok)
        else:
            raise ValueError(f"bad link token: {tok}")
    return allowed


def media_is_described(row: dict) -> bool:
    """True when caption looks intentional (not upload / camera dump leftovers)."""
    cap = str(row.get("caption") or "").strip()
    if not cap:
        return False
    file_name = str(row.get("file") or "").strip()
    stem = Path(file_name).stem if file_name else ""
    if stem and cap == stem:
        return False
    mid = str(row.get("id") or "").strip()
    if mid and cap == mid:
        return False
    low = cap.lower()
    if low in {"image", "photo", "upload", "img", "untitled", "(fill)", "(needs description)", "needs description"}:
        return False
    # Camera / messenger export names are not human descriptions.
    if re.match(r"^(img_|dsc_|screenshot|screen ?shot|photo_|微信图片|截屏|图片)", low):
        return False
    if re.search(r"_\d{8,}", cap):
        return False
    if re.fullmatch(r"M-\d{8}-\d{2}", cap):
        return False
    return True


def update_media_card(vault: Path, payload: dict) -> dict:
    """Update caption / role / links for one media row (complete the image card)."""
    mid = str((payload or {}).get("id") or "").strip()
    if not _MEDIA_ID_RE.fullmatch(mid):
        raise ValueError(f"bad media id: {mid}")
    media_dir = vault.resolve() / "media"
    index_path = media_dir / "_index.md"
    if not index_path.is_file():
        raise ValueError("media/_index.md missing")
    index_text = index_path.read_text(encoding="utf-8")
    catalog = {m["id"]: m for m in parse_media(index_text)}
    if mid not in catalog:
        raise ValueError(f"unknown media: {mid}")
    current = catalog[mid]

    caption = payload.get("caption", current.get("caption") or "")
    caption = str(caption or "").strip().replace("|", " ")[:120]
    if not caption:
        raise ValueError("caption required")

    role = str(payload.get("role", current.get("role") or "other") or "other").strip()
    if role not in _MEDIA_ROLES:
        raise ValueError("bad role")

    if "links" in (payload or {}):
        allowed = _normalize_media_links(payload.get("links"))
    else:
        allowed = list(current.get("links") or [])
    # Keep brand only when no semantic targets — optional leftover from uploads.
    semantic = [t for t in allowed if t != "brand"]
    link_cell = " ".join(semantic) if semantic else ("brand" if "brand" in allowed or not allowed else " ".join(allowed))
    if not semantic and "brand" in allowed:
        link_cell = "brand"
    elif semantic:
        link_cell = " ".join(semantic)

    lines = index_text.splitlines()
    out: list[str] = []
    found = False
    for line in lines:
        if line.strip().startswith("|"):
            cells = [c.strip() for c in line.strip().strip("|").split("|")]
            if cells and _MEDIA_ID_RE.fullmatch(cells[0].strip("`")) and cells[0].strip("`") == mid:
                while len(cells) < 9:
                    cells.append("")
                cells[3] = caption
                cells[5] = role
                cells[6] = link_cell
                line = "| " + " | ".join(cells) + " |"
                found = True
        out.append(line)
    if not found:
        raise ValueError(f"unknown media: {mid}")
    index_path.write_text("\n".join(out) + ("\n" if index_text.endswith("\n") else ""), encoding="utf-8")
    row = next(m for m in parse_media(index_path.read_text(encoding="utf-8")) if m["id"] == mid)
    return {
        "id": mid,
        "caption": row["caption"],
        "role": row.get("role", ""),
        "links": row["links"],
        "subjects": row.get("subjects", []),
        "described": media_is_described(row),
    }


def update_media_links(vault: Path, media_id: str, links: str | list[str]) -> dict:
    """Back-compat: links-only write."""
    return update_media_card(vault, {"id": media_id, "links": links})


def save_brand(vault: Path, payload: dict) -> dict:
    """Write token fields of profiles/<id>/brand.md. Does not touch render binding."""
    pid = str((payload or {}).get("profile_id") or "").strip()
    if not _PROFILE_RE.fullmatch(pid):
        raise ValueError("bad profile id")
    root = vault.resolve()
    index = root / "profiles" / "_index.md"
    if not index.is_file() or not re.search(rf"^\|\s*{re.escape(pid)}\s*\|", index.read_text(encoding="utf-8"), re.M):
        raise ValueError("unknown profile")
    path = (root / "profiles" / pid / "brand.md").resolve()
    if root not in path.parents or not path.is_file():
        raise ValueError("brand.md missing")
    logo = str(payload.get("logo") or "").strip()
    if logo and logo.lower() != "none":
        media_path = root / "media" / "_index.md"
        media = parse_media(media_path.read_text(encoding="utf-8")) if media_path.is_file() else []
        row = next((m for m in media if m["id"] == logo), None)
        if not row:
            raise ValueError("logo is not in the media vault")
        if row.get("role") != "logo" and "logo" not in (row.get("tags") or []):
            raise ValueError("logo must use a media row tagged logo")
    text = path.read_text(encoding="utf-8")
    binding = ""
    if "## Render binding" in text:
        binding = text.split("## Render binding", 1)[1]
    updated = apply_brand_fields(text, payload)
    if "## Render binding" not in updated or updated.split("## Render binding", 1)[1] != binding:
        raise ValueError("refusing to change render binding")
    path.write_text(updated, encoding="utf-8")
    saved = parse_brand_file(updated)
    saved["profile_id"] = pid
    saved["path"] = f"profiles/{pid}/brand.md"
    return saved


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
        cap_detail: dict = {}
        source_url = ""
        if entry and (ROOT / entry).exists():
            cap_md = read(entry)
            cap_detail = context_detail_capture(cap_md, one_liner=row["one_liner"])
            cap_detail["status"] = row["status"]
            source_url = cap_detail.get("source_url") or ""
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
                    "source_url": source_url,
                    "context_detail": cap_detail,
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
                    "context_detail": context_detail_need(
                        quote=quote,
                        speaker=row.get("speaker", "") or "",
                        frequency=row.get("frequency", "") or "1",
                        status=row["status"],
                    ),
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
            prod_detail: dict = {}
            if fpath and (ROOT / fpath).exists():
                prod_detail = context_detail_product(read(fpath), audience=row["audience"])
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
                        "context_detail": prod_detail,
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

    def _media_declared_targets(links: list[str]) -> list[tuple[str, str]]:
        """Semantic link targets only. `brand` is a catalog tag, not a graph edge."""
        out: list[tuple[str, str]] = []
        for link in links or []:
            if link.startswith("P-"):
                out.append(("product", link))
            elif link.startswith("R-"):
                out.append(("recommendation", link))
            elif link.startswith("C-"):
                out.append(("capture", link))
            elif link.startswith("RUN-"):
                out.append(("run", link))
            elif link.startswith("W-"):
                out.append(("wiki", link))
        return out

    for m in parse_media():
        add_node(
            node(
                "media",
                m["id"],
                m["caption"] or m["id"],
                m["src"] or "media/_index.md",
                {
                    "file": m["file"],
                    "src": m["src"],
                    "sha256": m["sha256"],
                    "caption": m["caption"],
                    "tags": m["tags"],
                    "role": m.get("role", ""),
                    "links": m["links"],
                    "subjects": m.get("subjects", []),
                    "rights": m["rights"],
                    "hosted_image_id": m["hosted_image_id"],
                    "hosted": m["hosted"],
                    "graph_status": "cataloged",
                    "orphan_links": [],
                },
            )
        )
        media_id = nid("media", m["id"])
        for sub in m.get("subjects") or []:
            kind = "product" if sub.startswith("P-") else "recommendation"
            edge(media_id, nid(kind, sub), "illustrates")
        for link in m.get("links") or []:
            if link.startswith("C-"):
                edge(nid("capture", link), media_id, "has_media")
            elif link.startswith("RUN-"):
                edge(nid("run", link), media_id, "uses_media")
            elif link.startswith("W-"):
                edge(media_id, nid("wiki", link), "reference_for")

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
        card: dict = {}
        if item and (ROOT / item).exists():
            card = parse_topic_item(read(item))
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
                    "verdict": card.get("verdict") or row["status"],
                    "why_status": card.get("why_status") or "",
                    "who_for": card.get("who_for") or "",
                    "core_judgment": card.get("core_judgment") or row["one_liner"],
                    "next_step": card.get("next_step") or "",
                    "problem": card.get("problem") or "",
                    "believe_now": card.get("believe_now") or "",
                    "cut": card.get("cut") or "",
                    "why_now": card.get("why_now") or "",
                    "change_after": card.get("change_after") or "",
                    "gaps": card.get("gaps") or "",
                    "suggested_form": card.get("suggested_form") or "",
                    "trace": card.get("trace") or {},
                    "context_packet": card.get("context_packet") or {},
                    "constraints": card.get("constraints") or [],
                    "provenance": card.get("provenance") or [],
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
        swipe_detail: dict = {}
        if fpath and (ROOT / fpath).exists():
            swipe_detail = context_detail_swipe(read(fpath), one_liner=row["one_liner"])
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
                    "context_detail": swipe_detail,
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
        atom_detail: dict = {}
        if fpath and (ROOT / fpath).exists():
            atom_detail = context_detail_atom(read(fpath), one_liner=row["one_liner"])
            atom_detail["atom_type"] = atom_detail.get("atom_type") or row["type"]
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
                    "context_detail": atom_detail,
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
        claim_detail: dict = {}
        if (ROOT / fpath).exists():
            body = read(fpath)
            claim_detail = context_detail_claim(body, one_liner=row["one_liner"])
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
                    "context_detail": claim_detail,
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
        pack_chain: dict = {}
        pack_rel = stage_files.get("pack")
        if pack_rel and (ROOT / pack_rel).exists():
            pack_chain = parse_pack_chain(read(pack_rel))
        is_published = row["status"].lower() == "published"
        is_scheduled = (bool(scheduled_date) and not is_published) or (row["status"].lower() == "scheduled")
        topic_id = row["topic_id"] if row["topic_id"] != "none" else ""
        run_detail = parse_run_detail(
            rdir if rdir and rdir.is_dir() else None,
            stage_files,
            index_status=row["status"],
            index_pack=row.get("pack", "") or "",
            index_notes=row.get("notes", "") or "",
            topic_id=topic_id,
        )
        # Prefer idea-file selection when richer; keep index/idea scrape as fallback.
        for k in ("swipe", "atoms", "claim"):
            got = (run_detail.get("selection") or {}).get(k) or ""
            if got and got.lower() != "none":
                selection[k] = got
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
                    "published_evidence_tier": "",
                    "published_layout_family": "",
                    "status": row["status"],
                    "account": row["account"],
                    "profile": row["profile"],
                    "primary_platform": row["primary_platform"],
                    "platforms": row["platforms"],
                    "topic_id": topic_id,
                    "pillar": row["pillar"],
                    "pack": row["pack"],
                    "export": row["export"],
                    "notes": row["notes"],
                    "folder": folder,
                    "stages": stages,
                    "stage_files": stage_files,
                    "selection": selection,
                    "pack_chain": pack_chain,
                    "supersedes": supersedes,
                    "superseded_by": superseded_by,
                    "metrics": metrics,
                    "ship_urls": ship_urls,
                    "open_file": idea_path,
                    "obsidian": obsidian_uri(idea_path) if idea_path else "",
                    "run_detail": run_detail,
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
        for mrow in pack_chain.get("media") or []:
            mid = mrow.get("media_id") or ""
            if mid.startswith("M-") and nid("media", mid) in nodes:
                edge(nid("run", ident), nid("media", mid), "uses_media")
        if supersedes.startswith("RUN-"):
            edges.append({"from": nid("run", ident), "to": nid("run", supersedes), "rel": "supersedes"})

    folder_to_run = {
        n["folder"]: n["ident"] for n in nodes.values() if n["kind"] == "run" and n.get("folder")
    }

    pub_rows = table_with(
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
        "evidence_tier",
        "layout_family",
        "notes",
    )
    if not pub_rows:
        pub_rows = table_with(
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
        )
    for row in pub_rows:
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
        evidence_tier = (row.get("evidence_tier") or "").strip() or "unknown"
        layout_family = (row.get("layout_family") or "").strip()
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
                    "evidence_tier": evidence_tier,
                    "layout_family": layout_family,
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
                run_node["published_evidence_tier"] = evidence_tier
                run_node["published_layout_family"] = layout_family
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

    # Wiki judgment nodes + typed edges from notebook pages
    pages_root = ROOT / "wiki" / "pages"
    if pages_root.is_dir():
        for path in sorted(pages_root.rglob("W-*.md")):
            text = path.read_text(encoding="utf-8") if path.is_file() else ""
            meta = frontmatter(text)
            wid = (meta.get("id") or path.stem).strip()
            if not wid.startswith("W-"):
                wid = path.stem
            try:
                rel_pages = path.relative_to(pages_root)
            except ValueError:
                continue
            profile = (meta.get("profile") or (rel_pages.parts[0] if len(rel_pages.parts) > 1 else "")).strip()
            title = (meta.get("title") or "").strip()
            if not title:
                for line in text.splitlines():
                    if line.startswith("# "):
                        title = line[2:].strip()
                        break
            rel = path.relative_to(ROOT).as_posix()
            wiki_detail = context_detail_wiki(text, meta)
            add_node(
                node(
                    "wiki",
                    wid,
                    title or wid,
                    rel,
                    {
                        "profile": profile,
                        "status": (meta.get("status") or "").strip(),
                        "state": (meta.get("state") or "").strip(),
                        "confidence": (meta.get("confidence") or "").strip(),
                        "pillar": (meta.get("pillar") or "").strip(),
                        "updated": (meta.get("updated") or "").strip(),
                        "context_detail": wiki_detail,
                    },
                )
            )
            wiki_id = nid("wiki", wid)
            if profile:
                edge(nid("profile", profile), wiki_id, "owns")

            def section(name: str) -> str:
                if f"## {name}" not in text:
                    return ""
                body = text.split(f"## {name}", 1)[1]
                if "\n## " in body:
                    body = body.split("\n## ", 1)[0]
                return body

            for m in CAPTURE_RE.finditer(section("Related captures")):
                edge(nid("capture", m.group(0)), wiki_id, "informs")
            for m in re.finditer(r"N-\d{8}-\d{2}", section("Readers say")):
                edge(nid("need", m.group(0)), wiki_id, "supports")
            for m in re.finditer(r"\bP-\d{3}\b", section("Product link")):
                edge(wiki_id, nid("product", m.group(0)), "uses")

            battles = section("Battles fought")
            for line in battles.splitlines():
                if not line.strip().startswith("|"):
                    continue
                for tid in re.findall(r"T-\d{8}-\d{2}", line):
                    edge(wiki_id, nid("topic", tid), "generates")
                for rid in RUN_RE.findall(line):
                    edge(wiki_id, nid("run", rid), "tests")

            parts = section("Parts that fit")
            for line in parts.splitlines():
                if not line.strip().startswith("|"):
                    continue
                low = line.lower()
                rel_name = "avoids" if "avoid" in low else "fits"
                for sid in SWIPE_RE.findall(line):
                    edge(wiki_id, nid("swipe", sid), rel_name)
                for aid in ATOM_RE.findall(line):
                    edge(wiki_id, nid("atom", aid), rel_name)
                for cid in CLAIM_RE.findall(line):
                    edge(wiki_id, nid("claim", cid), rel_name)

            # Cataloged but not yet fits/avoid — discovery edges only.
            candidates = section("Library candidates")
            for line in candidates.splitlines():
                if not line.strip().startswith("|"):
                    continue
                for sid in SWIPE_RE.findall(line):
                    edge(wiki_id, nid("swipe", sid), "candidates")
                for aid in ATOM_RE.findall(line):
                    edge(wiki_id, nid("atom", aid), "candidates")
                for cid in CLAIM_RE.findall(line):
                    edge(wiki_id, nid("claim", cid), "candidates")

            layout_rows = []
            for row in _table_rows(section("Layout families")):
                fam = (row.get("layout_family") or "").strip()
                if not fam or fam.lower() in {"layout_family", "e.g. screenshot stack"} or fam.startswith("e.g."):
                    continue
                layout_rows.append(
                    {
                        "layout_family": fam,
                        "verdict": (row.get("verdict") or "").strip(),
                        "platform": (row.get("platform") or "").strip(),
                        "evidence_tier": (row.get("evidence_tier") or "").strip(),
                        "run_id": (RUN_RE.findall(row.get("run_id") or "") or [""])[0],
                        "note": (row.get("note") or "").strip(),
                    }
                )
                rid = layout_rows[-1]["run_id"]
                if rid and nid("run", rid) in nodes:
                    edge(wiki_id, nid("run", rid), "layout_tested_by")
            nodes[wiki_id]["layout_families"] = layout_rows

            see = section("See also")
            for line in see.splitlines():
                if not line.strip().startswith("|"):
                    continue
                cells = [c.strip() for c in line.strip().strip("|").split("|")]
                if len(cells) < 2:
                    continue
                rel_label = cells[0].lower().replace("\\|", "|")
                if rel_label == "rel":
                    continue
                if rel_label in {"related", "contradicts", "parent", "child", "next"}:
                    target = (WIKI_PAGE_RE.findall(cells[1].replace("\\|", "|")) or [""])[0]
                    if target and target != wid:
                        edge(wiki_id, nid("wiki", target), rel_label)

    # Pack meta w_ids → wiki tests run (wiki nodes exist now)
    for n in list(nodes.values()):
        if n["kind"] != "run":
            continue
        w_blob = ((n.get("pack_chain") or {}).get("meta") or {}).get("w_ids") or ""
        for wid in re.findall(r"\bW-[A-Za-z0-9-]+\b", w_blob):
            edge(nid("wiki", wid), n["id"], "tests")

    # Re-link media after wiki/product/run exist — edge() requires both ends.
    for n in list(nodes.values()):
        if n.get("kind") != "media":
            continue
        media_id = n["id"]
        for sub in n.get("subjects") or []:
            kind = "product" if sub.startswith("P-") else "recommendation"
            edge(media_id, nid(kind, sub), "illustrates")
        for link in n.get("links") or []:
            if link.startswith("C-"):
                edge(nid("capture", link), media_id, "has_media")
            elif link.startswith("RUN-"):
                edge(nid("run", link), media_id, "uses_media")
            elif link.startswith("W-"):
                edge(media_id, nid("wiki", link), "reference_for")

    # Media card + graph status after all target nodes exist (wiki is late).
    for n in nodes.values():
        if n.get("kind") != "media":
            continue
        declared = _media_declared_targets(n.get("links") or [])
        missing = [ident for kind, ident in declared if nid(kind, ident) not in nodes]
        resolved = len(declared) - len(missing)
        described = media_is_described(n)
        n["described"] = described
        n["orphan_links"] = missing
        if declared and resolved == 0:
            n["graph_status"] = "orphaned"
        elif resolved > 0:
            n["graph_status"] = "linked"
        elif described:
            n["graph_status"] = "described"
        else:
            n["graph_status"] = "cataloged"

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
        "brands": load_brands(profiles),
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
    pack = parse_pack_chain(
        "## Meta\n\n- **w_ids:** W-demo\n- **hook_type:** contrarian\n\n"
        "## Arc\n\n- **one_liner:** Speed moves the bottleneck\n\n"
        "## Page Contracts\n\n"
        "| page | page_purpose | page_role | density | slot_summary | media_requirements | reader_action |\n"
        "|------|--------------|-----------|---------|--------------|--------------------|---------------|\n"
        "| 1 | Open | hook | medium | title:1 body:1 | none | continue |\n\n"
        "## Media\n\n"
        "| page | subject | media_id | role | caption |\n"
        "|------|---------|----------|------|---------|\n"
        "| 1 | P-001 | M-20260921-01 | home | UI |\n\n"
        "## Template Selection\n\n"
        "| page | layout_family | template_id | evidence | reason | mode |\n"
        "|------|---------------|-------------|----------|--------|------|\n"
        "| 1 | Poster Hook | tpl-a | hypothesis | role match | explore |\n\n"
        "## Experiment\n\n- **variables_changed:** layout\n- **comparable:** yes\n"
    )
    assert pack["arc"].startswith("Speed"), pack
    assert pack["contracts"][0]["page_role"] == "hook", pack
    assert pack["media"][0]["media_id"] == "M-20260921-01", pack
    assert pack["templates"][0]["layout_family"] == "Poster Hook", pack
    assert pack["experiment"]["comparable"] == "yes", pack
    print("parse_engagement_snapshot self-check ok")
    print("parse_pack_chain self-check ok")

    dummy_md = (
        "| run_id | path | date | scheduled | status | account | profile | primary_platform | platforms | topic_id | pillar | one_liner | pack | export | notes |\n"
        "|--------|------|------|-----------|--------|---------|---------|------------------|-----------|----------|--------|-----------|------|--------|-------|\n"
        "| RUN-1  | [[runs/r1]] | 2026-09-16 | 2026-09-18 | scheduled | a | p | x | x | T-1 | P1 | Test run | no | no | ok |\n"
    )
    res = extract_runs_table(dummy_md)
    assert len(res) == 1 and res[0]["run_id"] == "RUN-1" and res[0]["scheduled"] == "2026-09-18", res
    print("extract_runs_table self-check ok")

    media_md = (
        "| id | file | sha256 | caption | tags | role | links | rights | hosted_image_id |\n"
        "|----|------|--------|---------|------|------|-------|--------|-----------------|\n"
        "| M-20260917-01 | logo.png | abc123 | Brand logo | logo | logo | brand, P-001 | own-screenshot | img_9 |\n"
        "| (fill) | | | | | | | | |\n"
    )
    mres = parse_media(media_md)
    assert len(mres) == 1, mres
    assert mres[0]["id"] == "M-20260917-01" and mres[0]["src"] == "media/logo.png", mres
    assert mres[0]["tags"] == ["logo"] and mres[0]["links"] == ["brand", "P-001"], mres
    assert mres[0]["role"] == "logo" and mres[0]["subjects"] == ["P-001"], mres
    assert mres[0]["hosted"] is True, mres
    print("parse_media self-check ok")
    brand_src = (
        "## Identity (rendered)\n\n"
        "| Field | Value |\n|---|---|\n"
        "| **Display name** | (fill) |\n"
        "| **Handle** | (fill) |\n"
        "| **Logo** | `none` (or a media id) |\n\n"
        "## Colors (tokens)\n\n"
        "| Token | Hex | Use |\n|---|---|---|\n"
        "| **primary** | (fill) | Headlines |\n"
        "| **accent** | (fill) | Highlights |\n"
        "| **background** | (fill) | Page |\n"
        "| **text** | (fill) | Body |\n\n"
        "## Fonts\n\n"
        "| Slot | Font |\n|---|---|\n"
        "| **Heading** | (fill) |\n"
        "| **Body** | (fill) |\n\n"
        "## Render binding (cache — Agent writes)\n\n"
        "| Field | Value |\n|---|---|\n"
        "| **logo hosted_image_id** | img_keep |\n"
    )
    assert parse_brand_file(brand_src)["logo"] == "", parse_brand_file(brand_src)
    brand_out = apply_brand_fields(
        brand_src,
        {
            "display_name": "Murphy",
            "handle": "@murphywuwu",
            "logo": "none",
            "primary": "#112233",
            "accent": "",
            "background": "#ffffff",
            "text": "#111111",
            "heading_font": "Inter",
            "body_font": "",
        },
    )
    assert "img_keep" in brand_out.split("## Render binding", 1)[1], brand_out
    parsed = parse_brand_file(brand_out)
    assert parsed["display_name"] == "Murphy" and parsed["primary"] == "#112233", parsed
    assert parsed["accent"] == "" and parsed["logo"] == "" and parsed["heading_font"] == "Inter", parsed
    try:
        _format_brand_value("primary", "red")
        raise AssertionError("hex should fail")
    except ValueError:
        pass
    print("brand token self-check ok")
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
