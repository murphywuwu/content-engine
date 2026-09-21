#!/usr/bin/env python3
"""Template hard-filter + ranking for Page Contracts (catalog JSON in, selection out)."""

from __future__ import annotations

import argparse
import json
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

COVER_ROLES = frozenset({"cover", "hook"})


@dataclass
class PageContract:
    page: int
    page_purpose: str
    page_role: str
    density: str
    slot_summary: str
    media_requirements: str = "none"
    reader_action: str = "continue"


@dataclass
class Selection:
    page: int
    layout_family: str
    template_id: str
    evidence: str
    reason: str
    mode: str
    score: float


def parse_slot_summary(s: str | dict[str, Any]) -> dict[str, int]:
    if isinstance(s, dict):
        out: dict[str, int] = {}
        for k, v in s.items():
            try:
                out[str(k).lower()] = int(v)
            except (TypeError, ValueError):
                continue
        return out
    out = {}
    for part in [p.strip() for p in s.replace(";", ",").split(",") if p.strip()]:
        if ":" not in part:
            continue
        k, v = part.split(":", 1)
        try:
            out[k.strip().lower()] = int(v.strip())
        except ValueError:
            continue
    return out


def slot_fit(needed: dict[str, int], catalog: dict[str, int]) -> bool:
    if not needed:
        return True
    aliases = {
        "title": ["title", "text", "headline"],
        "body": ["body", "text", "subtitle"],
        "text": ["text", "title", "body"],
        "image": ["image", "screenshot", "media"],
        "screenshot": ["screenshot", "image", "media"],
        "caption": ["caption", "text", "body"],
        "metric": ["metric", "number", "text"],
        "quote": ["quote", "text"],
    }
    for k, n in needed.items():
        keys = aliases.get(k, [k])
        have = sum(catalog.get(a, 0) for a in keys)
        if have < n and "text" in catalog and k in {"title", "body", "caption"}:
            have = catalog.get("text", 0)
        if have < n:
            return False
    return True


def hard_filter(
    contract: PageContract,
    templates: list[dict[str, Any]],
    platform: str,
    canvas: str,
) -> list[dict[str, Any]]:
    needed = parse_slot_summary(contract.slot_summary)
    role = contract.page_role.strip().lower()
    out: list[dict[str, Any]] = []
    for t in templates:
        plats = [str(p).lower() for p in (t.get("platforms") or [])]
        if platform and platform.lower() not in plats and "generic" not in plats:
            continue
        preset = str(t.get("canvasPreset") or t.get("canvas_preset") or "").lower()
        if canvas and preset and canvas.lower() != preset and preset != "custom":
            continue
        roles = {str(r).lower() for r in (t.get("supportedRoles") or t.get("supported_roles") or [])}
        if contract.page == 1:
            if roles and not (roles & COVER_ROLES):
                continue
        elif roles & COVER_ROLES:
            continue
        cat_slots = parse_slot_summary(t.get("slotSummary") or t.get("slot_summary") or {})
        if not slot_fit(needed, cat_slots):
            continue
        out.append(t)
    if role:
        preferred = [
            t
            for t in out
            if role in {str(r).lower() for r in (t.get("supportedRoles") or t.get("supported_roles") or [])}
        ]
        if preferred:
            return preferred
    return out


def score_template(
    contract: PageContract,
    t: dict[str, Any],
    *,
    history: dict[str, dict[str, Any]] | None = None,
    fits: set[str] | None = None,
    avoids: set[str] | None = None,
) -> tuple[float, str, str, str, str]:
    history = history or {}
    fits = fits or set()
    avoids = avoids or set()
    family = str(t.get("layoutFamily") or t.get("layout_family") or t.get("name") or t.get("id") or "")
    reasons: list[str] = []
    score = 0.0

    roles = {str(r).lower() for r in (t.get("supportedRoles") or t.get("supported_roles") or [])}
    if contract.page_role.lower() in roles:
        score += 30
        reasons.append("role match")

    dens = str(t.get("density") or "").lower()
    if dens and dens == contract.density.lower():
        score += 15
        reasons.append("density match")
    elif dens:
        score += 5
        reasons.append("density soft")

    needed = parse_slot_summary(contract.slot_summary)
    cat_slots = parse_slot_summary(t.get("slotSummary") or t.get("slot_summary") or {})
    if slot_fit(needed, cat_slots):
        score += 25
        reasons.append("slots fit")

    if family in avoids:
        score -= 40
        reasons.append("W- avoid")
    if family in fits:
        score += 20
        reasons.append("W- fits")

    hist = history.get(family) or {}
    n = int(hist.get("n") or 0)
    wins = int(hist.get("win") or 0)
    losses = int(hist.get("loss") or 0)
    evidence = "hypothesis"
    if n >= 3 and wins > losses:
        evidence = "tested"
        score += 20
        reasons.append(f"history {wins}w/{losses}l n={n}")
    elif n >= 1:
        score += 5
        reasons.append(f"history n={n}")
    else:
        reasons.append("no history")

    if n == 0 and history:
        score += 3
        reasons.append("explore bonus")

    mode = "champion"
    if n == 0 and history:
        mode = "explore"
    elif n and wins <= losses:
        mode = "challenger"

    return score, evidence, "; ".join(reasons) or "default", mode, family


def select_for_contracts(
    contracts: list[PageContract],
    templates: list[dict[str, Any]],
    *,
    platform: str,
    canvas: str,
    history: dict[str, dict[str, Any]] | None = None,
    fits: set[str] | None = None,
    avoids: set[str] | None = None,
) -> list[Selection]:
    picks: list[Selection] = []
    for c in contracts:
        cands = hard_filter(c, templates, platform, canvas)
        if not cands:
            picks.append(
                Selection(
                    page=c.page,
                    layout_family="",
                    template_id="",
                    evidence="hypothesis",
                    reason="no candidate passed hard filter",
                    mode="gap",
                    score=0.0,
                )
            )
            continue
        ranked = []
        for t in cands:
            score, evidence, reason, mode, fam = score_template(
                c, t, history=history, fits=fits, avoids=avoids
            )
            ranked.append((score, evidence, reason, mode, fam, t))
        ranked.sort(key=lambda x: x[0], reverse=True)
        score, evidence, reason, mode, fam, t = ranked[0]
        picks.append(
            Selection(
                page=c.page,
                layout_family=fam,
                template_id=str(t.get("id") or t.get("templateId") or ""),
                evidence=evidence,
                reason=reason,
                mode=mode,
                score=score,
            )
        )
    return picks


def selection_card(picks: list[Selection]) -> str:
    lines = ["🎴 Template Selection"]
    for p in picks:
        lines.append(
            f"【Page {p.page}】 {p.layout_family or '—'} / {p.template_id or 'gap'} · {p.mode} · {p.evidence}"
        )
        lines.append(f"  reason: {p.reason}")
    return "\n".join(lines)


def explore_quota(picks: list[Selection]) -> dict[str, int]:
    """Report champion/challenger/explore mix (target ~70/20/10 when enough history)."""
    counts = {"champion": 0, "challenger": 0, "explore": 0, "gap": 0}
    for p in picks:
        counts[p.mode if p.mode in counts else "gap"] = counts.get(p.mode if p.mode in counts else "gap", 0) + 1
    return counts


def self_check() -> None:
    catalog = [
        {
            "id": "tpl-cover-a",
            "layoutFamily": "Poster Hook",
            "platforms": ["linkedin", "generic"],
            "canvasPreset": "1:1",
            "supportedRoles": ["cover", "hook"],
            "density": "medium",
            "slotSummary": {"title": 1, "body": 1},
        },
        {
            "id": "tpl-shot-a",
            "layoutFamily": "Screenshot Stack",
            "platforms": ["linkedin"],
            "canvasPreset": "1:1",
            "supportedRoles": ["screenshot"],
            "density": "medium",
            "slotSummary": {"image": 1, "caption": 1},
        },
        {
            "id": "tpl-shot-b",
            "layoutFamily": "Screenshot Wide",
            "platforms": ["linkedin"],
            "canvasPreset": "1:1",
            "supportedRoles": ["screenshot"],
            "density": "high",
            "slotSummary": {"image": 1, "caption": 1},
        },
        {
            "id": "tpl-cover-late",
            "layoutFamily": "Bad Cover Late",
            "platforms": ["linkedin"],
            "canvasPreset": "1:1",
            "supportedRoles": ["cover"],
            "density": "medium",
            "slotSummary": {"image": 1, "caption": 1},
        },
    ]
    contracts = [
        PageContract(1, "open", "hook", "medium", "title:1, body:1"),
        PageContract(2, "ui", "screenshot", "medium", "image:1, caption:1"),
    ]
    cands2 = hard_filter(contracts[1], catalog, "linkedin", "1:1")
    assert all("cover" not in (t.get("supportedRoles") or []) for t in cands2), cands2

    picks = select_for_contracts(
        contracts,
        catalog,
        platform="linkedin",
        canvas="1:1",
        history={"Screenshot Stack": {"n": 4, "win": 3, "loss": 1}},
        fits={"Screenshot Stack"},
    )
    assert picks[0].template_id == "tpl-cover-a", picks[0]
    assert picks[1].layout_family == "Screenshot Stack", picks[1]
    assert picks[1].evidence == "tested", picks[1]
    card = selection_card(picks)
    assert "Template Selection" in card and "Screenshot Stack" in card
    print("self-check ok")
    print(card)
    print("quota", explore_quota(picks))


def main() -> None:
    ap = argparse.ArgumentParser(description="Select templates for Page Contracts")
    ap.add_argument("--self-check", action="store_true")
    ap.add_argument("--contracts", type=Path, help="JSON list of page contracts")
    ap.add_argument("--catalog", type=Path, help="JSON list of template catalog rows")
    ap.add_argument("--platform", default="")
    ap.add_argument("--canvas", default="")
    ap.add_argument("--history", type=Path, help="JSON map layoutFamily → {n,win,loss}")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    if args.self_check:
        self_check()
        return
    if not args.contracts or not args.catalog:
        ap.error("--contracts and --catalog required unless --self-check")
    contracts_raw = json.loads(args.contracts.read_text(encoding="utf-8"))
    catalog = json.loads(args.catalog.read_text(encoding="utf-8"))
    history = json.loads(args.history.read_text(encoding="utf-8")) if args.history else {}
    contracts = [PageContract(**c) for c in contracts_raw]
    picks = select_for_contracts(
        contracts, catalog, platform=args.platform, canvas=args.canvas, history=history
    )
    if args.json:
        print(json.dumps([asdict(p) for p in picks], ensure_ascii=False, indent=2))
    else:
        print(selection_card(picks))


if __name__ == "__main__":
    main()
