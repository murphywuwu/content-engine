---
name: easysociable-content
description: >
  Operate the EasySociable Content Engine (profile, needs, products, recommendations, topics, runs, workbench).
  Triggers: 采访我, 完善人设, interview me, who am I as a creator, 建立 profile
  — follow workflows/INTERVIEW.md (engine CLAUDE.md § Interview wins if present).
  Triggers: 记需求, 扫需求选题, 扫关键词, 路由 Hit, capture audience quotes, user needs, 调研需求, 需求落库
  — follow workflows/NEEDS.md + engine CLAUDE.md § Keywords / § Hits / § Needs.
  Triggers: 更新产品, 产品库, product facts, product pricing, product offer
  — follow the engine CLAUDE.md § Products and edit `products/`.
  Triggers: 推荐产品, 评测工具, compare tools, review an AI product
  — edit `recommendations/`; do not treat third-party subjects as owned Products.
  Triggers: 做成选题, 开一单, 出图
  — follow engine CLAUDE.md (§ Topics / § Open a run / § PagePack).
  If no engine exists, copy/clone the Content Engine core (see Create below;
  `easysociable engine init` is optional offline scaffold). Then follow
  Content Engine/CLAUDE.md. Render handoff: easysociable-template (1 page) or
  easysociable-slideshow (2+). Never publish or post.
---

# EasySociable Content

Entry card for agents. **Do not invent a parallel workflow.** Instance SoT is that engine’s `Content Engine/CLAUDE.md`. Workflows here fill gaps or win when newer than the matching § in CLAUDE.md.

## Product boundary

- Teach a **Content Engine** (signal → decision → draft → review → reusable learning).
- **EasySociable** is the **visual production layer** inside that engine — not the content brain, not the whole system.
- For `easysociable-builder` needs research, prefer **L1 system / L2 judgment-review** pains (sustainable publishing) over **L3 visual-tool** friction, unless the user asks for L3.

## Pipeline (do not collapse stages)

```text
Profile / Audience
  → Needs (verbatim audience quotes)
  → optional Product (owned offer facts) or Recommendation (third-party review subject)
  → Pillar (what this profile discusses) + Lane (how it publishes)
  → Topic (decision summary + readable judgment + Score appendix)
  → Run → Pack → Publish / feedback
```

| Stage | Owns | Does not |
|-------|------|----------|
| Needs `N-` | Verbatim reader/operator quotes | Watchlist hooks, Agent rewrites |
| Products `P-` | Owned offer facts, pricing, boundaries | Audience demand or third-party reviews |
| Recommendations `R-` | Third-party subject, evidence, limits, disclosure | Owned product claims |
| Pillars / lanes | Durable subject / publishing mode | A replacement for Needs or evidence |
| Topic `T-` | Human judgment card + opp gate | Being auto-created from heat |
| Workbench | Read-only observatory | Source of truth (markdown indexes are) |

## Hard rules

1. **No invented quotes** — Needs quote cell = verbatim only. Gloss is separate (`layer=L1|L2|L3` allowed in gloss).
2. **Heat ≠ topic** — External source metrics never make `ready`.
3. **Never invent `N-` from a product, vendor claim, or headline.** Match captured needs only.
4. **Topic decision card first** — start with Verdict / Why this status / Who it’s for / Core judgment / Next step, then explain the problem, current belief, angle, timing, expected belief change, evidence gap, and recommended form. **Language:** readable judgment + `one_liner` = profile `voice.md` Language (else pillars / `engine.json` locale); verbatim Needs stay untranslated. Keep scores and IDs in the appendix. Chat output is the readable decision card, not a score walkthrough.
5. **`N-` never in `capture_id`** — needs go in `need_ids` only.
6. **Rebuild workbench** after markdown writes in the engine vault.
7. **Keep ownership explicit** — `products/` is for offers we own or provide;
   `recommendations/` is for third-party tools and products. A Topic may cite
   `product_ids`, `recommendation_ids`, both, or neither.
8. **Ask for Topic `generation_mode` before any `produce` write** — present the
   six modes; recommend `demand` when Need-led; do not silently assume.
   Product/recommendation inputs do not prove audience demand.
9. **Scan stages Hits, not Needs/Topics** — default keyword scan is
   `track=listen` only → `hits/` (`triage`); route to `needs/` or library
   only after confirm. `search` = SEO, `ask` = GEO questions — not default
   social scan. Hits are never Topic inputs.
10. **Generate keywords from evidence** — propose listen/search/ask candidates
    from Needs/audience in chat; write `keywords.md` only after confirm;
    set `seed_from`. Google volume never gates listen.

Topic modes (ask before `produce`; recommend `demand` when Need-led):

```text
demand             = Needs + Profile
demand_to_offer    = Needs + Product + Profile
demand_to_review   = Needs + Recommendation + Profile
review             = Recommendation + evidence + Profile
offer_education    = Product + mechanism + Profile
profile_thesis     = Profile + Pillar
```

## Create / serve / build

**Primary (public core — preferred):** clone the Content Engine repo, then run
workbench from that folder. See `LAYOUT.md` (core vs vault; optional
`engine.json` `vault_root`).

```bash
git clone https://github.com/murphywuwu/content-engine.git
cd content-engine
python3 workbench/build.py
python3 workbench/serve.py --no-open
```

Monorepo maintainers can still sync from `apps/cli/content-engine/` via
`node apps/cli/content-engine/scripts/export-public-core.mjs`.

**Optional offline scaffold** (still never overwrites existing files):

```bash
easysociable engine init --root <parent-or-engine> --yes
easysociable engine serve --engine <parent>/Content Engine --no-open
easysociable engine build --engine <parent>/Content Engine
# Add --sync-workbench only to refresh workbench files from the CLI package.
```

On a dedicated agent computer (e.g. Grok Bot), prefer `/workspace/Content Engine`.

`python3` is required for the workbench. Observatory: `http://127.0.0.1:8765/workbench/` — top tabs include **需求库 / Needs**. If `serve.py` is already up, do not start a second server; rebuild only.

`engine init` may add missing starter files (e.g. `products/`, `recommendations/`)
to older vaults without overwriting user files. It does not invent recommendation
entries. Engine methodology updates should come from git/core copy, not from
republishing the CLI.

## Operate

1. Resolve account → profile (engine `CLAUDE.md`).
2. Route by intent (table below). Prefer engine `CLAUDE.md` sections; use `workflows/*` when that file is newer or the § is missing.
3. Always return the structured chat card the section defines.
4. Rebuild workbench after writes.

| Intent | Action |
|--------|--------|
| 采访我 / interview me / 完善人设 / 建立 profile | **workflows/INTERVIEW.md** (not a render) |
| 记需求 / 用户原话 / capture audience quotes / 调研需求 / 需求落库 | **workflows/NEEDS.md** (not a render) |
| 加关键词 / 生成 listen\|search\|ask 词 / 扫关键词 / 路由 Hit | Engine **§ Keywords** + **§ Hits** — three-track recipes; scan listen→Hits |
| 更新产品 / 产品库 / product facts | Engine **§ Products** — update owned offer facts and dated pricing |
| 推荐产品 / 评测工具 / compare or review | `recommendations/` — collect evidence and disclosure before Topic |
| 扫需求选题 | **NEEDS.md** then Topics from `needs/` `status=captured` — **ask `generation_mode` first** |
| 做成选题 / 生成 topic | engine **§ Topics** — explicit input; **ask `generation_mode` before write** |
| 开一单 / 用 T-… 开一单 | engine **§ Open a run** (ask platform; multi → N runs) |
| 1 page image | **easysociable-template** (after hard gate) |
| 2+ pages on tiktok / instagram / linkedin / threads | **easysociable-slideshow** (after hard gate) |
| x / xiaohongshu images | **easysociable-template** only (after hard gate) |

## Render hard gate

**Before any template/slideshow call:** Identity in `profiles/<active>/voice.md` — Role / What I build / Point of view — no `(fill)` and non-empty; `boundaries.md` exists with Not covering and Never claim both non-empty. If `needs/` exists, `needs/_index.md` ≥ **3** `N-` rows; if `needs/` is absent, skip that count. Public handle MAY stay `(fill)`.

On fail: **stay in this skill**. List missing files. Do not call template or slideshow. User must say **强制继续** / **force continue** to proceed.

```bash
easysociable engine validate --run <run-dir> --require-pack --require-knowledge
```

Slideshow packs need an **Arc** line first. Do not default Cover → Point → Steps → Recap → CTA. Page 1 is not automatically `cover`. Handoff: **easysociable-slideshow** (`references/ARC.md`).

## Research (Needs)

- Prefer host research tools. On **X**: built-in `x_*` first; fall back to agent-reach / `twitter` only if insufficient.
- Store **commenter** words when scraping threads. Do not invent `N-` when a platform tool is missing—stop and ask for paste.

## Out of scope

No social posting, Content MCP, Local API, or SQLite content library.
