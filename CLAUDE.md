# Content Engine — Agent operating manual

This folder is the local **Content Engine** for EasySociable.

**Human interface:** conversation only. The user does **not** edit markdown by hand. Observatory UI: `workbench/` at `http://127.0.0.1:8765/workbench/`.
**Agent interface:** you create/update files; always return a structured result card in chat. After markdown writes, run `python3 workbench/build.py` (leave `serve.py` running if already up).

## Defaults (v1)

- Folder tree: **English** (`Content Engine/`). Do not ask language.
- **Core vs vault:** see `LAYOUT.md`. Default `engine.json` `vault_root` is `"."` (this folder is both). Optional split: point `vault_root` at a private data directory; keep `CLAUDE.md` + `workbench/` on core.
- Default **account:** first **active** handle in `accounts/_index.md` (starter: `your-handle` — replace it)
- **开一单:** do **not** silent-default platform — **ask**; multi-select → **N runs**
- Do not invent metrics, customers, or quotes the user did not provide

### Resolve account → profile (required)

1. Read **`accounts/_index.md`** for the handle (default: first active row)
2. Get `profile_id`, `voice`, `platforms`, `default_platform`, `overrides`
3. Load **`profiles/<profile_id>/pillars.md`** + **`audience.md`** (core + current platform section)
4. Voice: if account `voice` is `profile` or empty → **`profiles/<profile_id>/voice.md`** (Identity + **Experience** + **Values** + Persona); else load the explicit path. Never invent bio facts not in Identity / Experience.
   `boundaries.md`: missing → **hard-gate fail**. Write empty starter (`## Not covering` / `## Never claim` headings), then interview; **never invent boundaries**.
   `stories.md` / `expression.md`: missing → `profile: partial`, continue.
   Do not invent bio / stories / values absent from those files. Topics listed in `boundaries.md` → stop; do not write.
5. If `overrides` is **non-empty**, read that path (e.g. `accounts/overrides/<handle>.md`) and apply last
6. Craft: **always** load `platforms/<platform>.md` for the active platform (see `platforms/README.md` for id → file; `instagram` → `ig.md`). Missing file → stop and tell the user; do not invent craft rules.
7. Catalog filter: swipe/atoms/claims where `platforms` matches **and** (`profiles` is `*` **or** contains `profile_id`)
8. If a Topic or draft mentions an offer, load `products/_index.md` and the
   cited `products/entries/P-*.md`. Never invent product pricing, entitlements,
   proof, or outcomes. Product fit is optional; educational content may have no
   product.

## File map

| Path | Role |
|------|------|
| `CLAUDE.md` | Operating manual |
| `profiles/_index.md` | Profile registry |
| `profiles/<id>/pillars.md` | Topic pillars (what to talk about) |
| `profiles/<id>/audience.md` | Readers + platform emphasis |
| `profiles/<id>/voice.md` | Identity + Experience + Values + Persona (how copy sounds) |
| `profiles/<id>/brand.md` | Rendered identity: logo, colors, fonts, display name (how it looks) |
| `profiles/<id>/stories.md` | Story inventory (cite or none) |
| `profiles/<id>/boundaries.md` | Creator must-avoid (Not covering / Never claim) |
| `profiles/<id>/expression.md` | Expression likes / dislikes |
| `profiles/<id>/lanes.md` | Publishing lanes; distinct from pillars |
| `profiles/<id>/keywords.md` | Search recipes; scan may stage `hits/` |
| `profiles/<id>/handles.md` | ≤8 ally/foil/competitor handles |
| `hits/_index.md` | Research triage (not Topics) |
| `accounts/_index.md` | handle → profile, platforms, voice, overrides |
| `accounts/overrides/<handle>.md` | Optional account deltas |
| `platforms/*.md` | Platform craft only |
| `inbox/_index.md` | Capture registry |
| `inbox/entries/C-*.md` | Per-capture working notes |
| `needs/_index.md` | Audience-quote registry |
| `needs/entries/N-*.md` | Per-need quote + sightings |
| `products/_index.md` | Owned product registry and lifecycle |
| `products/entries/P-*.md` | Owned product facts, boundaries, pricing and claims |
| `recommendations/_index.md` | Third-party tool/product registry and Profile associations |
| `recommendations/R-*.md` | Review subject facts, evidence and disclosure |
| `raw/_index.md` | Authoritative source registry |
| `raw/*.md` | Source bodies |
| `topics/_index.md` | Topic queue (one row per topic + `item` + src engagement) |
| `topics/items/T-*.md` | Opportunity card (human half) + Score/Trace appendix |
| `topics/scoring.md` | Scout gate + opportunity five-dim (context/audience/conflict/insight/evidence) |
| `library/swipe/_index.md` | Structures (+ `profiles` column) |
| `library/atoms/_index.md` | Atoms (+ `profiles`) |
| `library/claims/_index.md` | Claims (+ `profiles`) |
| `wiki/_index.md` | Thin map: profile → `pages/<profile>/` (not a per-W catalog) |
| `wiki/pages/<profile>/W-*.md` | One lesson = one compiled map (Agent writes; you read) |
| `wiki/pages/_shared/` | Optional cross-profile lessons (rare) |
| `wiki/_unfiled.md` | Captures/needs not yet hung on a `W-` |
| `runs/_index.md` | Job queue (one row per **platform run**) |
| `runs/<slug>/` | One platform draft → pack → feedback |
| `published/_index.md` | One row per **shipped URL** (one run → usually one row) |
| `media/_index.md` | Local image vault catalog (sha256 dedup, closed tags, `hosted_image_id` cache) |
| `media/<file>` | Image originals; source of truth, uploaded lazily at render |
| `exports/<slug>/` | Rendered images for that run (optional `<platform>/` subfolder) |

## Routing

| User intent | Action |
|-------------|--------|
| capture / 记一下 (+ link) | **§ Capture** only — **not** topics by default; **must** hang `C-` on `W-` or `_unfiled` (else not stored) |
| 记需求 / 用户原话 / 评论导出 | **§ Needs** only; **must** hang `N-` on `W-` or `_unfiled` (else not stored) |
| 维护笔记 / 扫笔记 / lint 笔记 / wiki | **§ Wiki** (lint → `python3 scripts/lint-wiki.py --engine .`) |
| 加关键词 / 更新关键词库 | Edit `profiles/<id>/keywords.md` (**ask profile** if unset) |
| 从需求生成关键词 / 生成 listen\|search\|ask 词 | **§ Keywords · Generate** (chat → confirm → write) |
| 加/改 handles | Edit `profiles/<id>/handles.md`; keep **≤8** |
| 扫关键词 / 扫 K-xx / 看 @handle | **§ Keywords** scan (**listen** default) → **§ Hits** |
| 路由 Hit / H-xx | **§ Hits** → Needs or Capture+library / discard — **never hang `H-` on wiki** |
| **扫需求选题** | **§ Topics** — Need-led variant: read matching `W-` first, then `needs/` where `status=captured`; max 5 `produce` |
| 扫 inbox 选题 | **§ Topics** — from captures without topic yet (max 5) |
| 生成 topic (no source specified) | **§ Topics** — ask for the task/input; do not assume Needs are the only source |
| 链接直接选题 / 把 C-xxx 做成选题 | **§ Topics** — create T- (may link capture) |
| 采访我 / 完善人设 / interview me / who am I as a creator / 建立 profile | **§ Interview** — persist after each dimension; no slideshow |
| 设置品牌 / 改 logo / 配色 / 字体 / set brand / brand colors | Edit `profiles/<id>/brand.md` (**ask profile** if unset) |
| 存图 / 记图 / 加素材 / catalog image / add media | **§ Media** — `media/_index.md` only; **do not** hang `M-` on wiki |
| 找图 / find image / which image for … | **§ Media** — retrieve by tag/link from `media/_index.md` |
| 开一单 / 用 T-xxx 开一单 | **Hard gate first**, then **§ Open a run** — **ask platform(s)** if unset; **read linked `W-` before Selection**; multi-select → **N runs** (bind `topic_id` if from T-) |
| Quick draft | Resolve profile; build a Context Packet; select; draft in chat |
| 收成 swipe/atom/claim | **§ Library ingest** after approval → `library/` only; **do not** write Parts on ingest |
| 选题后同意进 inbox | Capture that URL/C-link then optional library offer |
| Post URL after ship | feedback + **§ Published index** + **update linked `W-` battles / parts** |
| 复盘 / 批准晋级 | Claims promote + published index |
| Update pillars/audience | Edit **`profiles/<id>/…`** |
| 更新产品 / 产品库 | Edit **`products/`**; wiki only if a `W-` Product link already cites that `P-` |
| 推荐 / 评测第三方产品 | Edit **`recommendations/`**; wiki only if a lesson is about that `R-` |
| Update account binding | Edit **`accounts/_index.md`** |
| 出图 | **Hard gate first**, then **§ PagePack + render**. Fail → list missing files; no handoff unless user says **强制继续** / **force continue** |

---

## § Capture (inbox + raw indexes)

### When

User stores an idea, link, competitor structure, or source — not a pure Q&A.

### Always write (scheme B)

1. **`inbox/entries/C-YYYYMMDD-XX.md`** — working notes (our understanding; not necessarily full source text)
2. **Row at top of `inbox/_index.md`** — registry (id, type, one_liner, profile, entry path, raw path, library, status)

Id: `C-YYYYMMDD-XX` sequential per day (`01`, `02`, …).
Default `profile`: current account’s `profile_id`.

### Also write raw when

- URL worth revisiting, multi-step structure, media, or user says important

Then:

1. Body: `raw/YYYY-MM-DD-short-slug.md` (authoritative text/structure/media links)
2. Row in **`raw/_index.md`** with `capture_id`
3. Set inbox row `raw` column to that file

### Do not

- Use deprecated `inbox/capture.md` (removed)
- Silent-write swipe/atoms/claims under `library/`
- Treat capture as a finished run
- Reply “saved” without **Capture Card**
- Invent facts not in the user message / source
- Invent a new `W-` when the lesson is unclear — use **§ Wiki** hang-or-unfiled

### After store (notebook) — required or the capture is not stored

Hang on **this profile’s** notebook only.

1. Try to match an existing active/seed `W-` (same pain / pillar / reader job).
2. If matched: append the `C-` under **Related captures** (`[[inbox/entries/C-…\|C-…]]`); touch `updated`.
3. If not: append a row to `wiki/_unfiled.md` and ask hang vs create — **do not** invent a slug.
4. Chat card **must** name `W-…` or `unfiled`. Index + entry without this step → incomplete; do not say “saved”.

### entry file (minimal shape)

```markdown
---
id: C-YYYYMMDD-XX
date: YYYY-MM-DD
type: structure | link | insight | product | other
profile: default
---

# C-… — short title

## One-liner
## User intent / source
## Key points (our notes)
## Links (raw if any)
## Status
```

### Capture Card (chat)

```text
✅ Captured [C-YYYYMMDD-XX]

【One-liner】 …
【Type】 …
【Profile】 (resolved profile_id)
【Key points】
- …

【Stored】
- inbox/_index: yes
- entry: inbox/entries/C-….md
- raw: no | raw/….md + raw/_index
- notebook: W-… | unfiled

【Refine】
A) OK as stored
B) Refine notes
```

### Library offer (required if type is structure or link)

```text
【入库？（需点头）】
1) 不入库 — index library=none
2) 收成 swipe
3) 收成 atom (type: hook|reframe|proof|process|cta|other)
4) 收成 claim
5) 组合 …

Reply number(s) or 不入库.
```

On approval: create catalog files per **§ Library ingest**, set inbox `library` column (e.g. `swipe:S2`). Do **not** append those ids to a `W-` Parts table here.
Path A (capture): **no** engagement gates on *your* posts.

Optional: if user also says「同时选题/打分」, run **§ Topics** for this capture.

---

---

## § Products (offer facts)

### When

User defines, updates, prices, retires, or asks about a product or offer.

### Role

Products are the **supply-side fact layer**. They are valid Topic inputs, but
their facts do not automatically establish audience demand or outcomes.

```text
User task + explicit input(s) + Profile context
  → relevant graph nodes and evidence
  → Topic (editorial judgment)
  → Run
```

### Rules

- Read the cited `products/entries/P-*.md` before using product facts in a
  Topic, brief, draft, CTA, or product answer.
- A Topic may cite `product_ids: none`; do not force a product connection.
- A Topic may cite `recommendation_ids: none`; recommendations are third-party
  review subjects, not owned products.
- `product_fit` describes relevance, not a readiness verdict. Product fit never
  replaces evidence, audience, or opportunity scoring. It does not require
  `need_ids` in modes such as `offer_education`, but it cannot be relabeled as
  demand evidence.
- Do not turn a product promise into a Need quote. Do not turn a Need quote
  into a product capability.
- Keep exact pricing and entitlements in the dated product entry. Do not copy
  stale prices into other files.
- Do not invent proof, customers, outcomes, metrics, or testimonials.
- **Wiki:** creating or editing a `P-` does **not** hang a notebook row. Update a `W-` **Product link** only when that page already cites this product and the cited fact changed.

### Product fit

Use one of:

| fit | Meaning | Typical CTA |
|-----|---------|-------------|
| `direct` | The Topic directly addresses a problem the product solves | `educate` / `invite` / `sell` |
| `adjacent` | The Topic builds context but is not a product pitch | `educate` / `mention` |
| `none` | No honest product connection is needed | `none` |

Product fit is written on the Topic human card and inherited by the Brief.
For third-party reviews, use `recommendation_ids`, not `product_ids`. Load the
recommendation entry and disclose affiliate, sponsorship, or other commercial
relationships before drafting.

### Topic generation modes

| mode | Required inputs |
|------|-----------------|
| `demand` | Need + Profile |
| `demand_to_offer` | Need + Product + Profile |
| `demand_to_review` | Need + Recommendation + Profile |
| `review` | Recommendation + named evidence + Profile |
| `offer_education` | Product + mechanism + Profile |
| `profile_thesis` | Profile + Pillar |
| `domain_explanation` | Profile + named domain/question |
| `comparison` | Named subjects + comparison evidence + Profile |
| `response` | Named claim/source + response evidence + Profile |
| `craft_only` | Named source/structure + Profile |

**Mode pick (hard):** Before any `produce` Topic write, identify the user's
input and ask for `generation_mode` when it is ambiguous. Do not silently
assume `demand`. A Need, Product, brief, thesis, recommendation, or source may
each be the starting input. Enforce the selected mode's required inputs.
Product presence does not prove audience demand; Need presence does not prove
product fit. Neither may be invented to satisfy a mode.

---

## § Topics (Opportunity evaluation)

**Role:** Evaluate **Content Opportunities** — whether a topic deserves to exist as content. Does not replace capture or runs.
**Principle:** Topics are not titles. They are a judgment card the content owner can read in one minute. Five-dim scores are a gate in the appendix, not the reading surface.

**Profile-first rule:** every Topic request starts by reading
`wiki/pages/<profile>/README.md`, then `audience.md`, `pillars.md`, `voice.md`,
and `boundaries.md`. Next, retrieve the relevant graph nodes for the explicit
input. The source type determines which nodes are relevant; Needs are not a
mandatory starting point.

### Context retrieval protocol

Treat the user's request as a retrieval task, not as a command to scan all
Needs or all Wiki pages. First parse a task object: `intent`, `mode`,
`entities`, `problem`, `audience`, `pillar`, `platform`, and `constraints`.
Acceptable explicit inputs are a user brief/question, `N-*`, `C-*`, `P-*`,
`R-*`, an existing `T-*`/Run, or a profile thesis.

Use this retrieval order:

1. Read the explicit input nodes.
2. Follow explicit edges: W Readers say, Related captures, Product link,
   Battles fought, See also, and Topic Trace.
3. Add same-profile nodes matching the same problem, pillar, product, or
   audience.
4. Add counter-evidence and source material needed to check the judgment.
5. Add platform, product, media, library, and disclosure constraints only when
   required by the selected task.

Keep retrieval bounded: profile context + explicit inputs + relevant one-hop
edges + only the few two-hop nodes needed for contradiction or evidence.
Default caps are 5 W pages and 8 Need/Capture/source nodes. Record every
retrieved node and a `retrieval_reason` in Trace. Lexical similarity alone is
not a relationship.

Assemble a Context Packet before generating:
`task`, `profile_context`, `input_nodes`, `judgment_nodes`, `evidence_nodes`,
`counter_evidence`, `product_facts`, `platform_constraints`,
`forbidden_claims`, `unresolved_questions`, and `trace`.

### Epistemic labels and usage

Every retrieved statement must be treated as one of:

| label | Meaning | Generation rule |
|-------|---------|-----------------|
| `fact` | Source-verifiable fact | State only within its source scope |
| `observation` | User quote or observed signal | Preserve scope; never generalize automatically |
| `judgment` | Profile/Wiki editorial conclusion | Use as an angle, not as neutral fact |
| `hypothesis` | Untested judgment | Mark as unverified; do not state as conclusion |
| `counter_evidence` | Material challenging a judgment | Keep visible in context and review |
| `constraint` | Boundary, limitation, or must-not | Enforce as a hard generation rule |
| `proposal` | Agent's new inference or angle | Candidate only; requires evaluation or confirmation |
| `unknown` | Not answered by available sources | Say evidence is missing; never fill from model common sense |

Default authority: Product entries establish what a product does and does not
do; Needs establish a particular reader observation, not market-wide demand;
W- `We believe` is a judgment whose `state` and `confidence` must be retained;
W- Evidence and Counter-evidence remain separate; voice/audience/boundaries
are profile context and constraints. `supported` W- state does not turn every
sentence on the page into an objective fact. Absence of evidence is
`unknown`, not low-confidence fact.

### Layout

| Path | Role |
|------|------|
| `topics/scoring.md` | Scout → opportunity **15/20/25/25/15** (context/audience/conflict/insight/evidence); ready = opp≥**7.5** **and** aud≥**6** |
| `topics/_index.md` | Queue: one row per topic, **`item`** link, **`src_*` engagement** |
| `topics/items/T-YYYYMMDD-XX.md` | Decision card (summary + judgment) + Score/Trace/Constraints (appendix) |
| `topics/_template-item.md` | Template |

### Defaults

- Scout first: `purpose` = `discard` | `library` | `produce`; `scout_label` = `demand` | `ally` | `foil` | `craft_only`. Needs default `scout_label=demand`.
- Opportunity dims (produce only): `context` `audience` `conflict` `insight` `evidence` (0–10) → `opp_score`. Reasons live in the readable judgment layer, not in a score-table note column.
- `ready` requires **opp_score ≥ 7.5 and audience ≥ 6**
- `generation_mode` may be `demand` | `demand_to_offer` | `offer_education` | `review` | `profile_thesis` | `domain_explanation` | `comparison` | `response` | `craft_only`
- For `review` / `comparison` / `offer_education` with visuals: after locking `P-*` or `R-*`, retrieve images per **§ Media** (subject link → role). Cite `M-*` in Trace when used.
- `src_likes` / `src_replies` / `src_bookmarks` (+ views if known) + `engagement_at` on **index** when source is external
- Do **not** fold `src_*` into opp_score; among **ready** only, prefer replies/bookmarks over views
- **Language (hard):** Readable judgment + `one_liner` + Decision Card body = profile public language from `voice.md` **Language** (else pillars “Primary public language”, else `engine.json` locale). Verbatim Needs/Capture quotes stay untranslated. Operator chat may add a short gloss in another language; the Topic file and `ready` card body do not. Wrong-language prose → fix before `ready`.

### Signal paths

| User intent | inbox/raw | topics |
|-------------|-----------|--------|
| `记一下` + URL | **Yes** (default) | Only if also asked to score as topic |
| `扫需求选题` | **Default NO** | Scout + score ≤5 produce from `needs/` `status=captured`; `source_type=need`; set `need_ids`; **never** put `N-` in `capture_id`. After a `produce` T- is written, set those `N-` to `promoted` and append the T- on `topic_ids` (index + entry). Discard / library: leave `captured` or `retired` |
| `扫 inbox 选题` | Existing only | Scout + score ≤5 produce; set `capture_id`; skip captures already linked to a T- |
| `把 C-xxx 做成选题` | Keep | Create T- with `capture_id` (still Scout + opportunity score) |
| `链接直接选题` | Default NO unless user agrees capture | Create T- + src engagement |
| `把 T-xx 收进 inbox` | Yes for that source | Backfill `capture_id` on T- |

### Create topic steps

**Input gate:** A Topic must have an explicit input. Accept: user idea/brief, Capture `C-…`, Need `N-…`, Product `P-…`, Recommendation `R-…`, or a profile thesis. If the user only says “generate a topic” without naming a source:

1. Ask what task and starting input the user wants.
2. If captured Needs exist, offer them as one possible input, not the default.

0. Resolve profile **Language** (`voice.md` → pillars → `engine.json` locale).
0a. **Context Packet first:** complete the Profile-first read and Context
Retrieval Protocol above; cite the explicit input, relevant W- pages,
evidence, and counter-evidence in Trace.
0b. **Notebook hard gate (lookalike):** read matching `wiki/pages/<profile>/W-*.md` (`active`/`seed`) for the same pain/pillar.
   - If a page’s **We believe** covers this Need/cut **and** **Battles fought** already has `win` or `loss` for that same cut → **default `purpose=discard`** (or require user to name a **new cut** in chat before `produce`).
   - Do **not** write a lookalike `produce` T- unless the user explicitly overrides after seeing the W- battles.
   - Cite every `W-` read in Trace.
1. Hard filters (`scoring.md`); else skip.
2. **Scout gate** — set `purpose` + `scout_label`; if `discard`, do not create T-. Needs-sourced default `scout_label=demand` (ally/foil/craft_only still allowed when honest).
3. **Mode pick** — if proceeding toward `produce`, resolve or ask for
`generation_mode` from the user's task. Recommend `demand` for Need-led,
`offer_education` for Product-led, and `domain_explanation` for a new field,
but do not silently convert another input into `demand`. Wait for the choice
when ambiguous and validate required ids for that mode.
4. If `produce` (or user forces score):
   a. Write the **decision card** first (`topics/_template-item.md` upper half), in profile Language: Verdict, Why this status, Who it’s for, Core judgment, Next step, then What problem / What they believe / What cut / Why now / What should change / Based on / Gaps / Suggested form. Keep the summary short; no enum lists, heat, or weighted arithmetic in the readable layer. Set frontmatter `generation_mode` to the chosen mode. Cite `W-` id in Trace when used.
   b. Score all 5 opportunity dims (0–10) → `opp_score`. Put **numbers only** in `## Score`. Do not repeat the card as table notes.
   c. Fill `## Trace` (ids, retrieval reasons, epistemic labels, src heat,
`W-` ids) and `## Constraints` (writer must-nots). Write
`topics/items/T-….md`.
5. If `library`: optional light item with `status: library`, or capture offer only. Source needs stay `captured` (or `retired` if the user discards).
6. Add row on `topics/_index.md` (`item` + `src_*` when external). `one_liner` = the card’s core-judgment sentence, same language.
7. If this T- was `produce` from `N-` ids: update each `needs/_index.md` row + entry to `status=promoted` and `topic_ids` containing this T-. Skip if no T- was written (`discard`).
8. If `produce` and a `W-` matched (or user named one): append the T- to that page’s **Battles fought** as `pending`.
9. Output the **Decision Card** in chat — same shape and language as the file’s readable layer, not a score walkthrough. Optional operator gloss in another language is chat-only.

**Important:** “What do they believe now?” must name the false belief. If you cannot, conflict cannot score above 5. Brief inherits the readable judgment layer, not the Score table.

### Decision Card

Paste the decision summary and readable judgment sections. Do not walk five scores in the main body.

```text
📋 Decision card T-YYYYMMDD-XX
【Verdict】 ready | backlog | parked
【Why this status】 …
【Who it’s for】 …
【Core judgment】 …
【Next step】 open a run / fill needs / fill evidence / re-angle / kill
【What problem】 …
【What they believe】 believe X → actually Y
【What cut】 …
【Why now】 …
【After reading】 before … → after …
【Based on】 …
【Gaps】 …
【Suggested form】 …
```

### Topic → run

On `用 T-xxx 开一单`: **ask platform(s)** if unset (multi-select OK). Create **one run per platform**, same `topic_id`, prefill selection per platform, mark topic `promoted` + list run ids on `topics/_index` `run` column.

### Do not (Topics)

- Create a Topic from a Hit, a scan, or from heat alone
- Silently pick an ambiguous `generation_mode`
- Skip Scout gate or opportunity scoring on `produce` topics
- Skip the decision card readable layer on `produce`
- Put `N-` in `capture_id` (needs go in `need_ids` only)

### Topic and content generation

Topic generation and content generation use the same Context Packet. A Topic
answers what is worth saying; a Brief, Draft, or PagePack answers how to say
it. Content generation inherits the confirmed Topic Packet and adds voice,
platform craft, library, media, product disclosure, and published-history
constraints. It may add evidence, but if new evidence changes the core
judgment, return to the Topic for re-evaluation instead of silently changing
the draft.

Never turn a source label into a stronger claim:

- Needs and Captures are observations, not automatic market demand.
- Product entries establish product behavior, not audience desire or outcomes.
- W- `We believe` is a judgment; retain its state, confidence, evidence, and
  counter-evidence.
- Agent-generated angles are proposals until evaluated or confirmed.
- Missing evidence is `unknown`; do not fill it from general model knowledge.

---

## § Swipe / atom library

- **Catalog:** `library/swipe/_index.md` / `library/atoms/_index.md` / `library/claims/_index.md` are the selection entrypoints (Approach B).
- **Graph visibility:** approved library ingest also creates a graph resource
  edge from the source Capture to the `S-*` / `A-*` / `C-*` item and records
  the item as an `unreviewed` candidate for its linked W- lesson.
- **Notebook hard gate:** when a Topic links a `W-`, read that page’s **Parts that fit / Do not do** before opening library indexes; Open card must cite `W-…` or `W-: none`.
- **Hit-status:** `trial` | `working` | `dead` (not claim epistemology).
- **Hits cache:** index columns `n` `win` `loss` from **our** `published.result`.
- **Use history:** `published/_index.md` (columns `swipe` / `atoms`). **Do not** put an Evidence table in swipe/atom files.
- **New item:** template + index row under `library/`; default `trial`, n=win=loss=0.
- **From capture / run:** only via **§ Library ingest**. Never silent seed from
  runs. A capture-approved ingest is visible in the graph, but remains
  `unreviewed` until Selection / ship / 复盘.

---

## § Wiki (notebook / lesson map)

Triggers: 维护笔记 / 扫笔记 / lint 笔记 / hang on W- / create lesson.

**Role:** Profile-scoped judgment nodes under `wiki/pages/<profile>/W-*.md`, entered through `wiki/pages/<profile>/README.md`. They are the working memory of one connected graph, not a second inventory of needs/topics/runs. Not craft parts (`library/`). `wiki/_index.md` only maps profile → folder.

### Rules

- **Drawers vs notebook:** indexes store files; `W-` stores lessons. Heat (Hits) never enters a `W-`.
- One recurring lesson → one `W-` **inside that profile’s folder**. Prefer merge over near-duplicate pages.
- Agent writes pages; human reads. Schema = this section + `wiki/_template.md`.
- `W-` state is epistemic: `hypothesis` (inferred, not tested) | `tested` (a Run exists) | `supported` | `weakened` | `retired`. `unknown` Run results never promote a state.
- Every W- must name evidence, counter-evidence, and a next test. A Needs/Captures-only page is still a hypothesis, not a learned lesson.
- Profile-first read: open the profile notebook root before selecting any W- or source node.
- Closed see-also rels: `related` | `contradicts` | `parent` | `child` | `next` — pairwise, ≤5 per page.
- Unclear hang → `wiki/_unfiled.md` + ask. Never invent empty lessons to clear the queue.
- **Obsidian wikilinks required** on every hung id and see-also target. Same style as other vault indexes: `[[path]]` or, in **table cells**, `[[path\|id]]`. Prefer `[[wiki/pages/<profile>/W-…\|W-…]]`. Bare `W-…` / `N-…` text does **not** create Backlinks.
- Do **not** maintain a per-note row in `wiki/_index.md` — scan the folder. Optional `wiki/pages/_shared/` for rare cross-profile lessons.

### Lint (required when user says lint 笔记 / wiki lint)

Run (preferred):

```bash
python3 scripts/lint-wiki.py --engine .
```

Or walk pages by hand. **Report only — do not auto-fix** unless user 批准 each fix.

| Check | Fail when |
|-------|-----------|
| Unpaired see-also | A lists `rel → W-B` but B does not list the inverse (same profile first) |
| See-also overflow | A page has >5 see-also rows |
| Stale open | `status=stale` on frontmatter |
| Unfiled backlog | `wiki/_unfiled.md` has data rows (not only header) |
| Open contradictions | **Contradictions** section is non-empty and not exactly `none` / `—` |
| Missing notebook | Index profile row points at a folder that does not exist |
| Misplaced page | `W-*.md` sits directly under `pages/` instead of `pages/<profile>/` |
| Missing judgment field | W- page lacks `Evidence`, `Counter-evidence`, or `Next test` |
| Invalid confidence | W- frontmatter `confidence` is missing or not `low` / `medium` / `high` |

Chat card:

```text
🩺 Wiki lint
【Unpaired】 …
【Stale】 …
【Unfiled】 n rows
【Contradictions】 …
【Missing/orphan】 …
【Judgment quality】 …
Reply 批准 fix: … / 再观察
```

### When other sections must touch wiki

口诀：抽屉负责收东西。作文本负责长记性。热气不进作文本。
Hang only on `wiki/pages/<this-profile>/` (or `_unfiled`). Never invent a `W-` to clear a queue.

| Event | Wiki? | Action |
|-------|-------|--------|
| Capture stored | **Must** | Hang `C-` on matching `W-` **Related captures**, or `_unfiled`. Incomplete without this. |
| Need ingested | **Must** | Hang `N-` on **Readers say**, or `_unfiled`. May revise **We believe** / contradictions / still missing. Incomplete without this. |
| Hit scan / triage | **Never** | `hits/` only. Do not put `H-` on any `W-`. |
| Hit → Need (after confirm) | via Need | Follow Need row (hang `N-`, not `H-`). |
| Hit → library (after confirm) | via Capture | Follow Capture row (hang `C-`, not `H-`). |
| Product / recommendation create or price edit | **No** (default) | Stay in `products/` / `recommendations/`. Touch a `W-` **only if** that page’s **Product link** already cites this id **and** the cited fact changed, or the user is writing a lesson about it. |
| Media ingest | **No** (default) | Stay in `media/`. Cite `M-` on a `W-` only if the user says this image **proves that lesson** (or it is the brand logo the lesson depends on). |
| Library ingest (swipe/atom/claim) | **Yes, candidate only** | Link the library item to its source Capture and relevant W- in the graph as `cataloged_from` / `candidate_for`. Do not update **Parts that fit** or W- judgment state on ingest. |
| Topic `produce` written | **Must** (if a `W-` matches) | Append T- to **Battles** as `pending`. |
| Before Scout | **Read** | Lookalike gate (§ Topics 0b). |
| Before run Selection | **Read** | Parts table; Open card cites `W-…` or `W-: none`. |
| Ship / 复盘 | **Must** (if linked) | Battle result + parts fits/avoid; **We believe** only when the learning is explicit. |
| Interview / keywords / brand tokens | **No** | Profile files only. |

---

## § Interview

Triggers: 采访我 / 完善人设 / interview me / who am I as a creator / 建立 profile.

Follow `easysociable-content/workflows/INTERVIEW.md` for questions. Persist after each dimension; do not wait until the end.

- Append `## Experience` / `## Values` to existing `voice.md` if those headings are missing. Do not rewrite filled Identity rows.
- Missing `boundaries.md` → write empty starter, then interview. **Never invent boundaries.**
- Do not scan the watchlist. Do not create a slideshow. Do not ingest needs in this section.

### Hard gate (refuse 出图 / PagePack / `create_run`)

Identity **only** Role / What I build / Point of view — no `(fill)`, non-empty. Public handle MAY stay `(fill)`. `boundaries.md` exists with Not covering **and** Never claim non-empty. If `needs/` exists, also `needs/_index.md` ≥ 3 `N-` rows; if `needs/` is absent, skip that count.

Fail → list missing files; stay here. User must say **强制继续** / **force continue**. Optional check:

```bash
easysociable engine validate --root . --require-knowledge
```

### Completion

Hard gate vs first-session (`profile: partial`) vs complete seven dimensions (`profile: complete`) — same table as INTERVIEW.md. Experience / Values / expression are not the hard gate. Needs hard gate is ≥ **3** original quotes; first-session **target** is **5**.

---

## § Brand (rendered identity)

Triggers: 设置品牌 / 改 logo / 配色 / 字体 / set brand / brand colors.

`brand.md` owns **how the profile looks**; `voice.md` owns **how it sounds**. One rule: renders to pixels/color → `brand.md`; only shapes wording → `voice.md`. No overlap.

- Logo is a **media id** from `media/_index.md` (tag `logo`), never an inline path or URL.
- Colors are hex **tokens** (primary / accent / background / text); fonts are heading/body.
- **Render binding** rows (`logo hosted_image_id`, `theme snapshot`) are a cache. Only § PagePack writes them, at render time. Do not hand-edit.
- Local is source of truth. There is no hosted Brand to sync; brand data is materialized into the run at render (see § PagePack).

## § Media (local image vault)

Triggers: 存图 / 记图 / 加素材 / 找图 / catalog image / find image.

**Model:** `M-*` is a graph node that **illustrates** a subject. Owned offers → `P-*`. Third-party review subjects → `R-*`. Retrieval is by subject link first — not vision search.

**When generating content that needs an image** (product review, slideshow slot, cover): lock the subject (`P-*` or `R-*`), then **read `media/_index.md`** and filter by that link + `role`. Only ask for a new file if none fits.

**Add (ingest):**

1. Resolve subject: user names an existing `P-*` / `R-*`, or create `R-*` first for a third-party review target. If `tags` will include `product` or `screenshot` and there is **no** subject → **stop and ask**; do not write a row.
2. Compute `sha256` of the file. If that hash already has a row, **reuse that id** — never import a duplicate.
3. Assign `M-YYYYMMDD-XX`; place the file under `media/`.
4. Append a row: `file`, `sha256`, one-line `caption`, `tags` (closed set), **`role`** (`logo`|`home`|`pricing`|`settings`|`compare`|`proof`|`other`), `links` (must include `P-*` or `R-*` when tags are product/screenshot; may also include `C-*`/`RUN-*`/`brand`), `rights`. Leave `hosted_image_id` empty.
5. Chat **Media Card**: id · subject · role · caption · tags.

**Retrieve (reviews / comparison / offer visuals):**

1. Profile-first notebook read (unchanged).
2. Lock subject `P-*` or `R-*` from the Topic / user brief (`generation_mode` `review` | `comparison` | `offer_education`).
3. Filter `media/_index.md` where `links` contains that subject.
4. Pick by needed `role` (and caption). Cite `M-*` ids in Topic Trace / Run selection / pack — never copy binaries into `runs/`.
5. If missing roles → list the gap and ask the user to ingest; **do not** scan the vault with vision.

**Lint:** `python3 scripts/lint-media.py --engine .` (report only).

**Do not:** upload here (upload is at render only); store binaries in `runs/`; invent tags/roles outside the closed sets; fabricate `rights`; hang `M-` on a `W-` just because a row was added; invent a subject to clear the gate. Wiki cite only if the image is evidence for that lesson or the brand logo it depends on.

---

## § Keywords & handles

`keywords.md` is **three-track**: `listen` (social → Hits), `search` (SEO), `ask` (GEO questions).
`handles.md` ≤8 ally/foil/competitor.

**Generate:** from Needs/audience/pillars → chat candidates (max 10) → user confirm → append row with `track` + `seed_from`.
**Scan「扫关键词」:** `track=listen` + `active` only (unless user names other ids). Stage **§ Hits**; never Topic; never invent heat/quotes.
**search/ask:** not default social scan. Volume/kd optional on search only.

## § Hits (research triage)

**Role:** Sort research hits → **need** | **library** (swipe/atom via Capture+ingest) | **discard**. Not a Topic queue.

| Path | Role |
|------|------|
| `hits/_index.md` | Registry |
| `hits/_template.md` | Entry shape |
| `hits/entries/H-*.md` | Per-hit files |

Id `H-YYYYMMDD-XX`. Status: `triage` → `routed_need` | `routed_library` | `discarded`.

```text
🔎 Hit H-…
【Keyword】 K-xx
【Source】 @handle · url
【Kind】 author_post | comment | thread
【Signal】 demand_language | structure | foil | mixed | noise
【Heat】 likes … · replies … · bookmarks … · views … @ date
【Excerpt】 verbatim
【Suggest】 need | library | discard
```

On scan: `keyword_id` + `src_*` when known. Route need → **§ Needs**. Route library → **§ Capture** + library offer. Never Hit → Topic. **Never hang `H-` on wiki** (not Readers say, not Related captures, not unfiled). Heat stays in `hits/` until routed; the Need or Capture hang is what may touch the notebook.

---

## § Needs (audience quotes)

Triggers: 记需求 / 用户原话 / 评论导出 / capture audience quotes / user needs.
Hits → Needs **only after route confirm** (**§ Hits**).
扫需求选题 → **§ Topics** (this section only writes `N-` records).

Follow `easysociable-content/workflows/NEEDS.md` when this engine's copy of the workflow is the newer one; this section wins if both exist.

### Layout

| Path | Role |
|------|------|
| `needs/_index.md` | Quote registry |
| `needs/entries/N-YYYYMMDD-XX.md` | Verbatim quote + sightings + optional gloss |
| `needs/_template.md` | Entry shape |

### Status machine (only these words)

```text
captured  → just written, or still captured after a synonym merge (frequency ≥ 1)
promoted  → and only when a T- exists whose need_ids contain this N-; topic_ids lists that T-
retired   → user discarded
```

- Never `clustered`. Merge is not a status.
- Never mark `promoted` without that `T-`. `topic_ids` non-empty ≡ `promoted`.
- After § Topics writes a `produce` T- from this `N-`, flip this row + entry to `promoted` and append the T- on `topic_ids`. Discard / library stay `captured` or `retired`.
- Scan input: `status=captured` (`topic_ids` empty). Max 5 `produce`.
- Quote cell = verbatim. Gloss is optional and separate.
- Do not invent quotes. Do not treat watchlist hooks as needs.
- `N-` never goes in topic `capture_id`.

### Ingest

1. New entry from `_template.md` + row at top of `_index.md`.
2. Chat card:

```text
✅ Need N-YYYYMMDD-XX
【Quote】 …
【Source】 comment | dm | consult | faq | student | other
【Frequency】 1
【Stored】 needs/_index + needs/entries/N-….md
【Notebook】 W-… | unfiled
【Merge】 new | merged into N-… (frequency now k, status still captured)
```

3. Synonym merge: propose → user yes → same `N-` stays `captured`, `frequency += 1`, append sighting. Retire a mistaken duplicate.
4. **Notebook (required or the need is not stored):** hang `N-` on matching `W-` (**Readers say**, `[[needs/entries/N-…\|N-…]]`) or append `wiki/_unfiled.md`. May revise **We believe** / contradictions / still missing. Do not invent a new `W-` without user naming the lesson. Chat card must name `W-…` or `unfiled`.

Hard gate: `needs/_index.md` ≥ **3** `N-` rows once `needs/` exists (empty index fails). Target **5**. Prefer scanning needs before inbox.

---

## § Open a run

### When

User wants a tracked job: "开一单", "open a run", "按完整流程", or a multi-step post with gates.

**Hard gate first** (same as § Interview). Fail → list missing files; do not create `runs/<slug>/` unless **强制继续** / **force continue**.

### Model (one platform = one Run)

- **One folder = one platform draft** (native rewrite).
- **Same Topic, different platforms** → **N runs**, shared `topic_id` — **not** one folder with many platform sections.
- `idea.md`: `primary_platform` = this run’s platform; `platforms` = **same single value** (column kept for index compat).
- `draft.md`: copy for **this platform only**.
- Image deck: **`pack.md`** (or `pack-<platform>.md`); pixels under **`exports/<slug>/`**.
- Ship → one `published/_index` row for this `run_id`.
- Cross-platform progress lives on the **Topic** (`run` column lists all RUN ids), not inside one run.

### Platform gate (required before folder create)

1. User already named platform(s) → use them.
2. Else **stop and ask a required multi-select platform question**. Offer the account’s `platforms` from `accounts/_index` plus any supported platforms the user may name: `x`, `linkedin`, `instagram`, `tiktok`, `threads`, `xiaohongshu`. The user must be able to select one or more.
3. Do not create a folder, row, brief, or draft before the platform selection is answered.
4. **Do not** silently default to `x` when opening a run (default `x` still applies to other flows, e.g. watchlist filter).
5. **N platforms selected → N runs** (same topic/goal/pillar; independent platform craft, brief, draft, editor, rubric, and ship state).
6. Slug: include the platform when N>1 or always OK — e.g. `2026-08-26-angle-x`, `…-linkedin`.

### Load platform craft (required — every run, every draft stage)

For **each** run, before brief / packet / draft / editor / rubric / pack:

1. Resolve craft file via `platforms/README.md` (`x` → `x.md`, `instagram`/`ig` → `ig.md`, …).
2. **Read** that file end-to-end. Apply length, hooks, anti-slop, quality checklist.
3. Also load profile `audience.md` **core + this platform’s section**.
4. Cite the craft path in `brief.md` / `packet.md` (not hardcoded `platforms/x`).
5. **Do not** paste another platform’s copy unchanged. Sibling runs each re-read their own craft file.
6. If the craft file is missing → ask user / create stub; **do not draft** from memory.

### State machine (do not skip)

```text
RUN_OPEN → BRIEF_WAIT → DRAFTED → EDIT_WAIT
  → SCORED → SHIP|HOLD → READY_TO_POST
  → PUBLISHED feedback
```

Also mirror high-level status on **`runs/_index.md`**:
`open` → `brief` → `draft` → `scored` → `ready` → `published` | `hold` | `killed`.
(`partial` = **legacy** only; do not use for new multi-platform planning.)

Human gates (chat only):

1. **简报 OK** / Brief OK
2. **编辑 OK** / Editor OK
3. After SHIP: user posts **this** platform, then URL + result → feedback + published row
4. If images: **图 OK** after render (when skill available)

### Folder setup

1. Resolve platform list (gate above). For **each** platform:
2. **Load** `platforms/<platform>.md` (required; see above).
3. Create `runs/YYYY-MM-DD-short-slug[-platform]/` from `runs/_template/`.
4. Fill `idea.md` (pillar, **platform**, **selection ids**, optional `topic_id`).
5. **Append row** on `runs/_index.md` (`status=open`).
6. If from **T-…**: prefill from topic; mark topic `promoted`; append all new run ids to `topics/_index` `run`.
7. Never leave production only in chat when in run mode.

### Selection inside a run (required step; **none allowed**)

Before brief body, evaluate catalogs (Approach B + **profile + this run’s platform**).

0. **Profile-first read:** open `wiki/pages/<profile>/README.md`, then resolve linked `W-` from Topic Trace / Need hang / user. Record the root and W- paths on the Open card.
   - If a `W-` exists for this lesson: **must** open `wiki/pages/<profile>/W-….md` and read **Parts that fit** / **Do not do** **before** opening any `library/*/_index.md`.
   - Selection may only use ids marked `fits`, or `none`. Ids marked `avoid` are **forbidden**.
   - If the page has no fits row: Selection = `none` + why (still valid).
   - If no `W-` is linked: say so on the Open card, then fall back to library indexes (legacy). Prefer hanging a `W-` next time.
   - Open / Selection card **must** name `W-…` or `W-: none`.

Filter every catalog row under `library/`:

- `platforms` includes this run’s platform (or `*`)
- `profiles` is `*` **or** includes current `profile_id`
- Swipe/atom: drop `dead`. Claim: drop `retired`.

Rank:

- Swipe/atom: `working` before `trial`; then higher `win/n` (if n=0, treat as unranked trial).
- Claim: **do not** rank by `hypothesis` vs `supported`. Rank remaining by `win/n`. `hypothesis` is valid to pick. `weakened` only if the user wants that tension.

Then: swipe 0–1 → atoms by role → claim 0–1. **`none` always allowed** with why.
Sibling runs for the same topic may pick different swipe/atoms (native rewrite).

**Write the pick into `idea.md` (this is the citation).** Chat card alone does not count.

| Field | Required form |
|-------|----------------|
| `swipe_id` | `none` or `S1` (one id) |
| `atoms` | `none` or `hook:A-… cta:A-…` (real `A-` ids) |
| `claim_id` | `none` or catalog `C-…` — **not** the `hypothesis:` one-off line |

If the user later changes the pick, **overwrite** those three fields. Do **not** bump catalog `n`/`win`/`loss` here — that is ship-only (§ Catalog evidence).

**引用** = how many **runs** currently name this id in `idea.md` (killed runs still count unless selection was cleared). The workbench derives it by scanning runs; it is not a column the agent increments. Observatory numbers update on `workbench/build.py`, not at the moment of chat.

### Brief Engine (decision tree → quality gate → stop rule)

The brief inherits reasoning from the Topic Opportunity and focuses on **what to say and how**.

**Step 1 — Inherit from Topic Opportunity**

When the run is from T-xxx, copy the **readable judgment layer** into `brief.md` `## Inherited`:
- `context` ← 「为什么现在值得讲」
- `audience` ← 「适合谁」
- `conflict` ← 「他们现在相信什么」
- `insight` ← 「我们准备讲哪一刀」
- `outcome` ← 「看完后的改变」
- `evidence` ← 「凭什么这么判断」 + 「当前缺口」

Sharpen these for the specific platform/angle — do not re-derive from scratch. If T-xxx is a legacy five-section score sheet, derive the readable judgment layer before proceeding. Do not inherit the Score table as prose.

**Step 2 — Walk the decision tree**

```text
1. Read inherited context/conflict/insight
2. Can you state a thesis in one sentence?
   → No → reframe or stop
3. Can you name specific evidence?
   → No evidence at all → stop, suggest research
   → Weak but mechanism is provable → continue
4. What's the angle? (How does this conflict become content?)
5. What changes for the reader after consuming this?
   → "They'll learn something" is not specific enough
   → Name the belief before and after
6. → Fill brief → Self-score → Gate
```

**Step 3 — Fill brief.md**

The brief has two layers. The **reading surface** (top) is what a human reviews in 30 seconds. The **appendix** (bottom) is machine handoff data.

Reading surface — fill in this order:

1. **Thesis** — one sentence a stranger can understand.
2. **For whom → what changes** — reader, their false belief, the after state.
3. **Evidence** — named sources, type, quality, and what we cannot prove.
4. **Platform and expression** — platform, form, hook, structure outline.
5. **Boundaries** — must include / must avoid.

Appendix — fill after the reading surface:

6. **Inherited from Topic** — context, audience, conflict, insight, outcome, evidence (sharpened, not copied).
7. **Selection** — swipe, atoms, claim ids.
8. **Quality gate** — 6 × 1–5 scores.

**Step 4 — Brief quality gate (self-scoring)**

Score `brief.md` quality gate (6 × 1–5, max 30):

| # | Gate | Question |
|---|------|----------|
| 1 | Thesis clarity | Can the thesis be one sentence a stranger understands? |
| 2 | Evidence strength | Is there at least one specific, named source or mechanism? |
| 3 | Angle originality | Is this angle different from what's already in the conversation? |
| 4 | Structure coherence | Does the narrative flow from hook → conflict → thesis → proof → outcome? |
| 5 | Outcome specificity | Can you name the belief change in before/after form? |
| 6 | Tension preservation | Does the brief still carry the topic's conflict, or did it dilute? |

| Result | Action |
|--------|--------|
| **≥ 24** (PASS) | Present Brief Card to human for OK |
| **20–23** (REVISE) | Flag weak dimensions, self-revise once, re-score |
| **< 20** (STOP) | Trigger stop rule |

Update `brief.md` frontmatter: `gate_score`, `gate_pass`.

**Step 5 — Stop rule**

When the brief cannot pass the quality gate:

```text
⚠️ Weak Brief — RUN-…
【Failing gates】 gate … score … · gate … score …
【Reason】 one line why
【Suggestion】 reframe angle / research evidence / kill topic
Reply: 用 reframe / 研究 / 换 topic / 强制继续
```

The agent may reject a brief. "强制继续" overrides the gate (user decision). The stop rule is not a hard block — it is structured feedback that makes weakness visible.

### Packet

After brief OK: short `packet.md` — pillar slice + voice + audience (**core + this platform**) + **craft notes distilled from the loaded `platforms/<platform>.md`** + **thesis sentence from brief**.

### Writer → Editor

- Writer **re-reads** `platforms/<platform>.md`, then fills `draft.md` (**this platform only**) + full text in chat.
- Editor → `editor.md`; check against that craft file’s quality bar; REVISE until APPROVE or user override.

### Rubric gate

Score `rubric.md` (6 × 0–2, max 12).

- **≥ 8 → SHIP** — 发布包 in chat; `runs/_index` → `ready`.
- **排期 / Schedule:** If user specifies publish date/time → `runs/_index` status `scheduled` + set `scheduled` date (or in `idea.md` frontmatter `scheduled: YYYY-MM-DD`). Workbench reflects it on the Schedule calendar.
- **< 8 → HOLD**.
- Carousel/slideshow platforms: after SHIP → **§ PagePack + render**.
- Pure X text: no multi-page pack.

### Required chat cards (run mode)

**Open card** (one card per run; if N>1, list all opened)

```text
✅ Run opened  RUN-YYYYMMDD-slug
【Account】 (from accounts/_index)
【Profile】 (resolved profile_id)
【Voice】 profile | path
【Platform】 x | linkedin | …  → craft `platforms/<file>.md` loaded
【Topic】 none | T-…  (sibling runs: RUN-…, RUN-…)
【Goal】 …
【Pillar】 P?
【Selection】 (profile + platform; drop dead/retired; prefer working; none OK)
  swipe: S? | none — why
  atoms: …
  claim: C? | none — why
【Index】 runs/_index updated
【State】 open → next: brief
```

**Brief card** (after quality gate passes — mirrors brief.md reading surface)

```text
📋 Brief  RUN-…
【Thesis】 one sentence
【For whom】 reader · false belief → after state
【Evidence】 sources · type · quality · what we cannot prove
【Platform】 platform · form · hook · structure outline
【Boundaries】 must include · must avoid
【Gate】 Thesis … · Evi … · Angle … · Struct … · Outcome … · Tension … = …/30 ✓
Reply 简报 OK / 改 …
```

**Draft / Editor / Rubric** — as before; draft is single-platform and must follow the loaded craft file.

**Publish pack** (SHIP)

```text
📦 READY_TO_POST  RUN-…
【Platform】 x | …
【Copy】 …
【Pack】 n/a | ready | blocked
【After post】 URL + win/flat/loss → feedback + published row
```

### Feedback

`feedback.md` + **§ Published index** on ship.
Update `runs/_index` → `published`.
Then **§ Catalog evidence**. Never auto-`supported` / auto-`working`; never silent catalog ingest.

### § Published index (Step 6)

On confirmed ship for this run:

1. Row on **`published/_index.md`** (date, **platform**, url, run, pillar, swipe, atoms, claim, result, notes).
2. Optional stub.
3. `runs/_index` status → `published`.
4. **§ Catalog evidence** for every cited swipe / atom / claim id (skip `none`).
5. **Notebook:** if a `W-` is linked from the Topic/Need, update **Battles fought** (`win`/`loss`) and **Parts that fit** (`fits`/`avoid`) from this ship; revise **We believe** only when the learning is explicit. `unknown` updates no judgment state. A repeated, clear result may move `hypothesis` → `tested` / `supported` / `weakened`, but never auto-promote without evidence review.
6. Weekly 复盘: start from **published** `_index`. Same topic’s other platforms = other runs / other published rows.

### § Catalog evidence (required on ship)

Hits cache lives on the **index row** (`n` `win` `loss`). This is **not** 引用. 引用 is run selection in `idea.md` (already true once the run exists). `n`/`win`/`loss` only move **on ship**.

**Swipe / atom — no Evidence file.**
The ledger is the **published row** (`swipe` / `atoms` / `result` / `notes`). Why a post flopped stays in `feedback.md` or that published `notes` cell. Do **not** add `## Evidence` to swipe/atom bodies.

**Claim — Evidence table in the claim file.**
That table answers “does the sentence still hold?” (`vs claim`), which is not `result`.

For each cited id:

1. `n += 1`
2. `win += 1` if `result=win`; `loss += 1` if `result=loss`; `flat`/`unknown` bump `n` only.
3. Sync file frontmatter `status` if you change index status (only after user 批准).
4. **Claim only:** append the run to the claim file **Evidence** table (`result` + **vs claim**).

Propose status change (user must 批准; never auto):

| Object | Propose | Gate |
|--------|---------|------|
| swipe / atom | `trial` → `working` | `n≥2` AND `win≥2` AND `win>loss` |
| swipe / atom | → `dead` | user says stop, **or** `n≥3` AND `win=0` AND `loss≥2` |
| claim | → `supported` | ≥3 runs **support the proposition** (not merely `result=win`) AND user 批准 |
| claim | → `weakened` / `retired` | user 批准; hits do not flip epistemology |

Single win never promotes. n=1 is recorded, not celebrated.
---

## § PagePack + render (Step 7)

Bridge to **easysociable-slideshow** (when skill exists). Vault owns pack slots + Page Contracts; product owns templates + pixels.

Viral visual order (hard): **Wiki → Topic → Page Contracts → Media → Template Selection → slots → Run**. Templates never invent the argument.

### When

Planned platform needs multi-page images (linkedin / ig / tiktok), not pure X text.

### Preconditions

0. **Hard gate** (same as § Interview). Fail → list missing files; no slideshow/template handoff unless **强制继续** / **force continue**.
1. Run exists; brief OK; editor OK; **rubric SHIP**.
2. Per-platform `page_count` / `deck_hint` follows the **arc**, not a five-family catalog.
3. Prefer a swipe whose beats are an argument; else name a one-line arc from the brief.
4. **Forbidden default:** Cover → Point → Steps → Recap → CTA (those are P0 family names, not a pack recipe).

### Page Contract (required before template retrieval)

Each page in `pack.md` **Page Contracts** table must name:

- `page_purpose` · `page_role` · `density` · `slot_summary` · `media_requirements` · `reader_action`

Rules:

- No `templateId` / `template_id` inside Page Contracts.
- Page 1 should be `cover` or `hook` class; later pages must not use cover/hook class.
- Validate: `python3 scripts/validate-pack.py runs/<slug>/pack.md`
- Empty / missing contracts → stop; do not list templates yet.

### Media bind (after contracts)

1. Lock subject `P-*` (owned) or `R-*` (third-party review).
2. Filter `media/_index.md` by subject → `role` → caption (§ Media).
3. Gaps → list missing roles; do not steal another product’s images.
4. Write **Media** table on pack (`M-*` only).

### Template selection (VV hard filter → rank → auto-pick)

Catalog public fields used: `platforms`, `canvasPreset`/`canvas`, `slotSummary`, `supportedRoles`, `density`, `contentFamily`, `contentArchetypes`, **`layoutFamily`**.

1. **Hard filter** (must all pass): platform → canvas → slot shape → density capacity → page-position cover/hook rule → media role needs.
2. **Rank:** contract match → fill risk → same-platform/same-role history → W- `fits`/`avoids` on Layout Family → freshness / explore quota.
3. **Default:** Agent auto-picks one Layout Family + template per page. Show **Template Selection Card**. User confirm only when expression changes, visual direction splits, major launch, or A/B asked.
4. Record on pack **Template Selection** table: `layout_family`, `template_id`, `evidence` (`hypothesis`|`tested`|`supported`), `reason`, `mode` (`champion`|`challenger`|`explore`).
5. Helper: `python3 scripts/select-templates.py --self-check` (or `--contracts` + `--catalog` JSON).
6. Explore/utilize target when history exists: ~70% champion / 20% challenger / 10% explore Layout Families. With thin data, keep `evidence=hypothesis` — never claim a “viral template”.

### Agent steps

1. Write **`runs/<slug>/pack.md`** (from `_template/pack.md`; `pack-<platform>.md` OK):
   - Arc → **Page Contracts** → Media → **Template Selection** → Pages slots
   - Meta: profile, topic, w_ids, product/recommendation ids, hook_type
2. **Pack Card** + **Template Selection Card** in chat — user may `改 pack：…` / override a page’s family.
3. **Materialize local assets (single-direction, at render only):** for the logo in `profiles/<id>/brand.md` and any slot images that reference a `media/` id with an **empty** `hosted_image_id`, upload once and cache the returned id back into `media/_index.md` (and `brand.md` render binding). Pass `brand.md` colors/fonts as **inline theme tokens** — no hosted Brand record is required.
   ```bash
   easysociable images upload --file media/<file>   # → returns image id → write to hosted_image_id
   ```
4. Hand off to **easysociable-slideshow** with **explicit** `pageTemplateId`s already chosen; Studio opens. Topology lock means a wrong arc needs a **new Run**, not slot rewrite. Server must not silent-replace templates.
5. **Render / Download:** pixels leave the product from Studio Download (not CLI render). After the user downloads, copy files under **`exports/<slug>/`** if needed; set pack `job_id`, `export_path`, status `done`; set `runs/_index` `pack`/`export` to yes. If slideshow skill is **not** available: status `not_requested` / blocked — **do not fake images**.
6. User **图 OK** or revise slots (same topology) / new Run (different arc).

### Pack Card

```text
📑 Pack  RUN-…  platform=linkedin|tiktok|ig
【Arc】 one-liner / recipe
【Contracts】 N pages (purpose · role · density · slots)
【Media】 M-… / gaps
【Templates】 Layout Family / templateId per page · evidence
【export_path】 exports/<slug>/
【Render】 done | blocked (no skill) | failed
```

### Template Selection Card

```text
🎴 Template Selection
【Page 1】 Family … / tpl_… · champion|challenger|explore · hypothesis|tested|supported
  reason: …
【Page 2】 …
```

### Published evidence tiers (VV-009)

On ship, set `published/_index` **`result`** and **`evidence_tier`**:

| evidence_tier | Meaning |
|---------------|---------|
| `unknown` | Shipped; no usable outcome signal yet |
| `observed` | Some metrics; not enough to compare layouts |
| `tested` | Comparable experiment exists |
| `supported` | Repeated comparable wins support the layout/judgment |
| `weakened` | Comparable results undermine it |

`unknown` / single sample / simultaneous topic+copy+media+template changes → **do not** upgrade W- or Layout Family to `supported`.

### Layout learning on ship / 复盘 (VV-003 / VV-010)

If a `W-` is linked: append **Layout families** row (`fits`|`avoid`|`trial`) from this ship only when Experiment.`comparable=yes`. Update judgment `state` only with repeated clear non-`unknown` evidence. Record Layout Family, not every templateId, as the long-lived preference.

### Experiment discipline (VV-012)

Pack **Experiment** must note `variables_changed` and `comparable`. Forbidden to conclude “template works” when: multi-variable swap; no platform/audience grouping; `unknown` result; n=1; wrong-product media; overflow/unreadability.

### Do not

- Cram multiple platforms into one run / one pack
- Pack for pure X text
- Private template AST — public slots only
- Invent metrics in slots
- Skip SHIP before quality pack
- Store binaries inside `runs/` (use **exports/**)
- Default Cover → Point → Steps → Recap → CTA
- Skip the Arc line and fill P0 family names as a tutorial
- Retrieve templates before Page Contracts are filled
- Put `templateId` inside Page Contracts
- Silent-replace a chosen template
- Promote layout/`W-` state from a single `unknown` ship

---

## § Library ingest — swipe / atoms / claims (strict)

**Runs never auto-enter catalogs.** Ship → feedback + published + **§ Catalog evidence** if ids already used. New catalog rows still need user approval.

### Two ingest paths

| Path | When | Your-post metrics? |
|------|------|--------------------|
| **A. Capture offer** | structure/link capture → user picks 入库 options | **No** (source heat is prior, not our n/win) |
| **B. Post-publish** | In `published/_index` + gates → Agent proposes → user approves | **Yes** |

### Hard bans

| Forbidden |
|-----------|
| Unpublished run → new swipe/atom/claim |
| Silent seed while scaffolding |
| Catalog write without user approval |
| Single win → claim `supported` or swipe/atom `working` |
| Mixing claim epistemology with swipe/atom hit-status |
| `## Evidence` table in a swipe or atom file |
| Auto-changing `status` when bumping `n`/`win`/`loss` |
| Writing new catalog rows onto a `W-` **Parts that fit** at ingest (that is Selection / ship only) |

### Engagement gates (path B only)

At least one of: **replies ≥ 2** | bookmarks ≥ 5 | likes ≥ 10 | user override “这条可收”.
These gates are for **new ingest**, not for promoting `working` (that uses our `win`/`loss` counts).

### After user approval

| Ask | Create |
|-----|--------|
| 收成 swipe | `library/swipe/` + index, `trial`, n=win=loss=0 |
| 收成 atom | `library/atoms/`, set `type`, `trial`, n=win=loss=0 |
| 收成 claim | `library/claims/`, `hypothesis`, n=win=loss=0 |

### § Claims promote

- Epistemic Evidence on existing claims when used (separate from hits).
- `supported` only if ≥3 runs support the **proposition** **and** user 批准.
- A `win` that does not actually support the sentence does **not** count toward `supported`.

### 复盘 card

```text
📈 Review
【Run】 …
【Result】 …
【Hits updated】 swipe S? n/win/loss … · atoms … · claim …
【Hit-status propose】 none | S?/A-… trial→working | →dead
【Path B ingest】 not eligible | eligible → propose swipe/atom/claim
【Claim promote】 none | suggest C-… hypothesis→supported|weakened
Reply 批准 … / 否决 / 再观察
```

### Self-check (Capture)

- [ ] `inbox/_index.md` row + `inbox/entries/C-….md`
- [ ] `raw/` file + `raw/_index.md` only if criteria matched
- [ ] Capture Card + library offer when structure/link
- [ ] Notebook: `C-` on this profile’s `W-` **or** `_unfiled`; card names which

### Self-check (Need)

- [ ] `needs/_index.md` row + `needs/entries/N-….md`; quote verbatim
- [ ] Notebook: `N-` on **Readers say** **or** `_unfiled`; card names which; no new `W-` invented to clear queue

### Self-check (Topic / Opportunity)

- [ ] Notebook lookalike gate applied (W- read; no silent duplicate produce)
- [ ] Decision card filled (结论 / 状态原因 / 适合谁 / 核心判断 / 下一步)
- [ ] Readable judgment filled (问题 / 当前相信什么 / 我们的角度 / 为什么现在 / 看完后的改变 / 依据 / 缺口 / 形式)
- [ ] False belief named in 「他们现在相信什么」 (not just a conflict score)
- [ ] Readable sections are concise; heat and arithmetic only under `## 评分与追踪附录`
- [ ] Score table is numbers only; opp + aud + verdict line present
- [ ] Opportunity Card in chat matches the human half (not a five-score walkthrough)

### Self-check (Run)

- [ ] Folder exists under `runs/` with template files filled
- [ ] `runs/_index.md` row created/updated
- [ ] Platform gate done; one run per selected platform; `primary_platform` = that platform
- [ ] `platforms/<platform>.md` **read** before brief/draft/editor; cited in brief + packet
- [ ] Brief `## Inherited` populated from Topic Opportunity (not re-derived)
- [ ] Brief decision tree walked; quality gate scored (6 × 1–5)
- [ ] Brief gate ≥ 24 before presenting to human (or stop rule triggered)
- [ ] No skip of brief / editor / rubric when user asked for full run
- [ ] HOLD never presented as final publish pack
- [ ] Image pack only for this run’s platform; exports under `exports/<slug>/`
- [ ] Each ship → published row; this run → `published`
- [ ] `idea.md` has `swipe_id` / `atoms` / `claim_id` matching the Open card (not only chat)
- [ ] Open/Selection card cites `W-…` or `W-: none`; no `avoid` parts selected
- [ ] Cited swipe/atom/claim index `n`/`win`/`loss` bumped **on ship only**; status unchanged unless user 批准
- [ ] Swipe/atom: no Evidence section; claim Evidence table updated if claim used
- [ ] Selection dropped `dead`/`retired`; did not treat claim `supported` as a hit-rank
- [ ] Same topic multi-platform = sibling runs sharing `topic_id`, not one multi-section folder
- [ ] Packet includes thesis sentence from brief
- [ ] No invented metrics
- [ ] No cross-platform paste without re-applying that platform’s craft file
