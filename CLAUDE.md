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
| capture / 记一下 (+ link) | **§ Capture** only — **not** topics by default; hang on `W-` or `_unfiled` |
| 记需求 / 用户原话 / 评论导出 | **§ Needs** only; hang on `W-` or `_unfiled` |
| 维护笔记 / 扫笔记 / lint 笔记 / wiki | **§ Wiki** (lint → `python3 scripts/lint-wiki.py --engine .`) |
| 加关键词 / 更新关键词库 | Edit `profiles/<id>/keywords.md` (**ask profile** if unset) |
| 从需求生成关键词 / 生成 listen\|search\|ask 词 | **§ Keywords · Generate** (chat → confirm → write) |
| 加/改 handles | Edit `profiles/<id>/handles.md`; keep **≤8** |
| 扫关键词 / 扫 K-xx / 看 @handle | **§ Keywords** scan (**listen** default) → **§ Hits** |
| 路由 Hit / H-xx | **§ Hits** → Needs or Capture+library / discard |
| **扫需求选题** | **§ Topics** — **read matching `W-` first**, then from `needs/` where `status=captured`; max 5 `produce` |
| 扫 inbox 选题 | **§ Topics** — from captures without topic yet (max 5) |
| 生成 topic (no source specified) | **§ Topics** — offer captured needs or ask which explicit input to use |
| 链接直接选题 / 把 C-xxx 做成选题 | **§ Topics** — create T- (may link capture) |
| 采访我 / 完善人设 / interview me / who am I as a creator / 建立 profile | **§ Interview** — persist after each dimension; no slideshow |
| 设置品牌 / 改 logo / 配色 / 字体 / set brand / brand colors | Edit `profiles/<id>/brand.md` (**ask profile** if unset) |
| 存图 / 记图 / 加素材 / catalog image / add media | **§ Media** — add row to `media/_index.md` (dedup by sha256, tag) |
| 找图 / find image / which image for … | **§ Media** — retrieve by tag/link from `media/_index.md` |
| 开一单 / 用 T-xxx 开一单 | **Hard gate first**, then **§ Open a run** — **ask platform(s)** if unset; **read linked `W-` before Selection**; multi-select → **N runs** (bind `topic_id` if from T-) |
| Quick draft | Resolve profile; selection; draft in chat |
| 收成 swipe/atom/claim | **§ Library ingest** after approval → files under `library/` |
| 选题后同意进 inbox | Capture that URL/C-link then optional library offer |
| Post URL after ship | feedback + **§ Published index** + **update linked `W-` battles / parts** |
| 复盘 / 批准晋级 | Claims promote + published index |
| Update pillars/audience | Edit **`profiles/<id>/…`** |
| 更新产品 / 产品库 | Edit **`products/`**; keep dates and source of truth |
| 推荐 / 评测第三方产品 | Edit **`recommendations/`**; record evidence and disclosure |
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

### After store (notebook)

1. Try to match an existing active/seed `W-` (same pain / pillar / reader job).  
2. If matched: append the `C-` under **Related captures** on that page; touch `updated`.  
3. If not: append a row to `wiki/_unfiled.md` and ask hang vs create — **do not** invent a slug.

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

On approval: create catalog files per **§ Library ingest**, set inbox `library` column (e.g. `swipe:S2`).  
Path A (capture): **no** engagement gates on *your* posts.  

Optional: if user also says「同时选题/打分」, run **§ Topics** for this capture.

---

---

## § Products (offer facts)

### When

User defines, updates, prices, retires, or asks about a product or offer.

### Role

Products are the **supply-side fact layer**. They are not audience needs,
external discoveries, or content opportunities.

```text
Need (demand evidence) + Profile (identity) + optional Product (offer facts)
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
  replaces `need_ids`, evidence, audience, or opportunity scoring.
- Do not turn a product promise into a Need quote. Do not turn a Need quote
  into a product capability.
- Keep exact pricing and entitlements in the dated product entry. Do not copy
  stale prices into other files.
- Do not invent proof, customers, outcomes, metrics, or testimonials.

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
| `demand` | Needs + Profile |
| `demand_to_offer` | Needs + Product + Profile |
| `demand_to_review` | Needs + Recommendation + Profile |
| `review` | Recommendation + Profile + evidence |
| `offer_education` | Product + Profile + mechanism |
| `profile_thesis` | Profile + Pillar |

**Mode pick (hard):** Before any `produce` Topic write (扫需求选题 / 做成选题 / 生成 topic / 把 N-|C- 做成选题), **ask the user to choose `generation_mode`**. Recommend `demand` when the input is Need-led; do **not** silently assume. Enforce that mode’s required inputs. Product or Recommendation presence never proves audience demand and never raises a Topic to `ready` by itself.

---

## § Topics (Opportunity evaluation)

**Role:** Evaluate **Content Opportunities** — whether a topic deserves to exist as content. Does not replace capture or runs.  
**Principle:** Topics are not titles. They are a judgment card the content owner can read in one minute. Five-dim scores are a gate in the appendix, not the reading surface.

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

1. If needs exist with `status=captured`, offer **扫需求选题**.
2. Otherwise ask which explicit input to use.

0. Resolve profile **Language** (`voice.md` → pillars → `engine.json` locale).  
0b. **Notebook hard gate (lookalike):** read matching `wiki/pages/<profile>/W-*.md` (`active`/`seed`) for the same pain/pillar.  
   - If a page’s **We believe** covers this Need/cut **and** **Battles fought** already has `win` or `loss` for that same cut → **default `purpose=discard`** (or require user to name a **new cut** in chat before `produce`).  
   - Do **not** write a lookalike `produce` T- unless the user explicitly overrides after seeing the W- battles.  
   - Cite every `W-` read in Trace.  
1. Hard filters (`scoring.md`); else skip.
2. **Scout gate** — set `purpose` + `scout_label`; if `discard`, do not create T-. Needs-sourced default `scout_label=demand` (ally/foil/craft_only still allowed when honest).
3. **Mode pick** — if proceeding toward `produce`, **ask** `generation_mode` (six modes). Recommend `demand` for Need-led input; wait for user choice. Do not write a `produce` T- before the choice. Validate required ids for that mode.
4. If `produce` (or user forces score):
   a. Write the **decision card** first (`topics/_template-item.md` upper half), in profile Language: Verdict, Why this status, Who it’s for, Core judgment, Next step, then What problem / What they believe / What cut / Why now / What should change / Based on / Gaps / Suggested form. Keep the summary short; no enum lists, heat, or weighted arithmetic in the readable layer. Set frontmatter `generation_mode` to the chosen mode. Cite `W-` id in Trace when used.
   b. Score all 5 opportunity dims (0–10) → `opp_score`. Put **numbers only** in `## Score`. Do not repeat the card as table notes.
   c. Fill `## Trace` (ids, src heat, `W-` ids) and `## Constraints` (writer must-nots). Write `topics/items/T-….md`.
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
- Silently pick `generation_mode` (always ask before `produce`)
- Skip Scout gate or opportunity scoring on `produce` topics
- Skip the decision card readable layer on `produce`
- Put `N-` in `capture_id` (needs go in `need_ids` only)

---

## § Swipe / atom library

- **Catalog:** `library/swipe/_index.md` / `library/atoms/_index.md` / `library/claims/_index.md` are the selection entrypoints (Approach B).  
- **Notebook hard gate:** when a Topic links a `W-`, read that page’s **Parts that fit / Do not do** before opening library indexes; Open card must cite `W-…` or `W-: none`.  
- **Hit-status:** `trial` | `working` | `dead` (not claim epistemology).  
- **Hits cache:** index columns `n` `win` `loss` from **our** `published.result`.  
- **Use history:** `published/_index.md` (columns `swipe` / `atoms`). **Do not** put an Evidence table in swipe/atom files.  
- **New item:** template + index row under `library/`; default `trial`, n=win=loss=0.  
- **From capture / run:** only via **§ Library ingest**. Never silent seed from runs.

---

## § Wiki (notebook / lesson map)

Triggers: 维护笔记 / 扫笔记 / lint 笔记 / hang on W- / create lesson.

**Role:** Compiled lesson pages under `wiki/pages/<profile>/W-*.md` (one notebook per profile). Not a second inventory of needs/topics/runs. Not craft parts (`library/`). `wiki/_index.md` only maps profile → folder.

### Rules

- One recurring lesson → one `W-` **inside that profile’s folder**. Prefer merge over near-duplicate pages.  
- Agent writes pages; human reads. Schema = this section + `wiki/_template.md`.  
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

Chat card:

```text
🩺 Wiki lint
【Unpaired】 …
【Stale】 …
【Unfiled】 n rows
【Contradictions】 …
【Missing/orphan】 …
Reply 批准 fix: … / 再观察
```

### When other sections must touch wiki

| Event | Wiki action |
|-------|-------------|
| Capture stored | Hang `C-` or unfiled |
| Need ingested | Hang `N-`; may revise **We believe** / contradictions / still missing |
| Topic `produce` written | Append T- to **Battles** as `pending` on matching `W-` |
| Before Scout (扫需求选题) | **Hard:** read matching `W-`; apply lookalike gate (§ Topics 0b) |
| Before run Selection | **Hard:** read linked `W-` parts table; cite `W-` on Open card |
| Ship / 复盘 | Update battle result + parts fits/avoid + believe line if learned |

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

**When generating content that needs an image** (product review, slideshow slot, cover), **read `media/_index.md` first** and reuse an existing asset by tag/link. Only ask the user for a new file if none fits.

**Add (ingest):**

1. Compute `sha256` of the file. If that hash already has a row, **reuse that id** — never import a duplicate.
2. Assign `M-YYYYMMDD-XX`; place the file under `media/`.
3. Append a row: `file`, `sha256`, one-line `caption`, `tags` (closed set only), `links` (`P-*`/`C-*`/`R-*`/`RUN-*`/`brand`), `rights`. Leave `hosted_image_id` empty.

**Retrieve:** filter `media/_index.md` by tag and/or link to find the right image for the content need. Cite the media id in the pack/draft.

**Do not:** upload here (upload is at render only); store binaries in `runs/`; invent tags outside the closed set; fabricate `rights`.

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

On scan: `keyword_id` + `src_*` when known. Route need → **§ Needs**. Route library → **§ Capture** + library offer. Never Hit → Topic.

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
【Merge】 new | merged into N-… (frequency now k, status still captured)
```

3. Synonym merge: propose → user yes → same `N-` stays `captured`, `frequency += 1`, append sighting. Retire a mistaken duplicate.
4. **Notebook:** hang `N-` on matching `W-` (**Readers say**) or append `wiki/_unfiled.md`. May revise **We believe** / contradictions / still missing. Do not invent a new `W-` without user naming the lesson.

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

0. **Notebook hard gate:** resolve linked `W-` from Topic Trace / Need hang / user.  
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
5. **Notebook:** if a `W-` is linked from the Topic/Need, update **Battles fought** (`win`/`loss`) and **Parts that fit** (`fits`/`avoid`) from this ship; revise **We believe** only when the learning is explicit.  
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

Bridge to **easysociable-slideshow** (when skill exists). Vault owns pack slots; product owns templates + pixels.

### When

Planned platform needs multi-page images (linkedin / ig / tiktok), not pure X text.

### Preconditions

0. **Hard gate** (same as § Interview). Fail → list missing files; no slideshow/template handoff unless **强制继续** / **force continue**.  
1. Run exists; brief OK; editor OK; **rubric SHIP**.  
2. Per-platform `page_count` / `deck_hint` follows the **arc**, not a five-family catalog.  
3. Prefer a swipe whose beats are an argument; else name a one-line arc from the brief.  
4. **Forbidden default:** Cover → Point → Steps → Recap → CTA (those are P0 family names, not a pack recipe).

### Agent steps

1. Write **`runs/<slug>/pack.md`** (from `_template/pack.md`; `pack-<platform>.md` OK):  
   - this run is already one platform  
   - **Arc** one-liner + recipe **before** Pages  
   - slots, language, pillar, swipe_id, claim_id  
   - page 1 `role` is not automatically `cover`  
2. **Pack Card** in chat — user may `改 pack：…`.  
3. **Materialize local assets (single-direction, at render only):** for the logo in `profiles/<id>/brand.md` and any slot images that reference a `media/` id with an **empty** `hosted_image_id`, upload once and cache the returned id back into `media/_index.md` (and `brand.md` render binding). Pass `brand.md` colors/fonts as **inline theme tokens** — no hosted Brand record is required.  
   ```bash
   easysociable images upload --file media/<file>   # → returns image id → write to hosted_image_id
   ```
4. Hand off to **easysociable-slideshow**: it picks templates by platform + canvas + slot shape, then opens Studio. Topology lock means a wrong arc needs a **new Run**, not slot rewrite.  
5. **Render / Download:** pixels leave the product from Studio Download (not CLI render). After the user downloads, copy files under **`exports/<slug>/`** if needed; set pack `job_id`, `export_path`, status `done`; set `runs/_index` `pack`/`export` to yes. If slideshow skill is **not** available: status `not_requested` / blocked — **do not fake images**.  
6. User **图 OK** or revise slots (same topology) / new Run (different arc).

### Pack Card

```text
📑 Pack  RUN-…  platform=linkedin|tiktok|ig
【Arc】 one-liner / recipe
【Pages】 N
【deck_hint】 …
【Outline】 P1… Pn
【export_path】 exports/<slug>/
【Render】 done | blocked (no skill) | failed
```

### Do not

- Cram multiple platforms into one run / one pack  
- Pack for pure X text  
- Private template AST — public slots only  
- Invent metrics in slots  
- Skip SHIP before quality pack  
- Store binaries inside `runs/` (use **exports/**)  
- Default Cover → Point → Steps → Recap → CTA  
- Skip the Arc line and fill P0 family names as a tutorial  

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
