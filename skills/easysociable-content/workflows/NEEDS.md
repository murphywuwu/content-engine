# Needs (audience quotes)

Not a fourth skill. If the engine `CLAUDE.md` already has **§ Needs**, follow that section **unless this file is newer** — then this file wins for Needs-only rules.

Do **not** invent quotes. Do **not** scan the watchlist to mint needs. Do **not** create a slideshow.

## Triggers

- 记需求 / 用户原话 / 评论导出
- 扫需求选题
- 扫关键词 / 用关键词扫需求 / 扫 K-xx（research only — see **Keyword scan** below）
- capture audience quotes / user needs
- 调研需求 / 需求落库 / 重新调研并落库

## Research axis (easysociable-builder default)

Product teaches **Content Engines**; EasySociable is the **visual layer**. When researching or screening needs for this profile:

| Layer | Means | Default |
|-------|--------|---------|
| **L1** | System / sustainability — what to say, what to publish next, memory, pipeline, consistency | **Prefer** |
| **L2** | Judgment / review / approval — AI polished but empty; bottleneck moved to human check | **Prefer** |
| **L3** | Visual / tool friction — Canva, Figma, “looks AI”, brand kit paste | Keep only if user asks; else do not promote as primary |

Put `layer=L1|L2|L3` in **`## Our gloss` only** — never in the index `quote` cell.

**Reject:** course/toolkit CTAs, product demos dressed as pains, watchlist viral titles as quotes, Agent-paraphrased “quotes”, wrong-ICP “idk what to post” with no system angle.

## Rules

- Quote cell = **verbatim**. Gloss goes in `## Our gloss`, never in the index `quote` column.
- Status is only `captured` | `promoted` | `retired`. **Never** `clustered`. Merge is not a new status.
- Synonym merge: propose, wait for user yes, then keep the surviving `N-` as `captured`, `frequency += 1`, append a sighting. Retire a mistaken duplicate and note it on the surviving sighting. No hosted clustering.
- Do not mark `promoted` without a `T-` whose `need_ids` contain this `N-`. `topic_ids` non-empty ≡ `promoted`.
- Never write `N-` into topic `capture_id`.
- Hard gate (graphics): once `needs/` exists, `needs/_index.md` needs ≥ **3** `N-` rows. First-session **target** is **5** (under 5 still passes the hard gate). Do not invent quotes to hit the number.
- Quotes may include DMs / students. Keep local. Redact PII if used as published copy.
- After Needs writes: rebuild workbench (`python3 workbench/build.py` or `easysociable engine build`).

## Delete vs retire

- `retired` = soft discard while the user may still want the row visible.
- If the user says **删除 / 删掉 retired / 可以直接删了**: **delete** the entry file(s) and remove the index row(s). Do not leave ghost `retired` rows. Rebuild workbench.
- Do not delete `captured` or `promoted` without an explicit ask.

## Keyword generate (from Needs)

When user asks to generate keywords from needs: follow engine **§ Keywords · Generate**.  
Prefer `track=listen` seeds from verbatim Needs; propose in chat; write only on confirm with `seed_from=need:N-…`.  
Optional: derive `search` (SEO) or `ask` (GEO question) pairs — not for default social scan.

## Keyword / handle scan → Hits → route

Load `profiles/<id>/keywords.md` (and/or `handles.md`).  
Default scan: up to **5** rows with **`track=listen` + `status=active`** (or named `K-xx` / `@handle`). Prefer L1/L2 `pain`/`question`.

Meaningful hits → write `hits/` (`H-…`, `status=triage`, `keyword_id`, heat when known) + chat cards.  
**Needs / library only after route confirm** (engine **§ Hits**). Author posts are not Needs; comments may be. Structure/foil → library via Capture + ingest approval.

On **X**: `x_*` first. Other platforms only with a working host backend; else ask for paste. Hits are never Topic inputs. Do not default-scan `search`/`ask` rows into Hits.

## Ingest paths

1. Pasted quote — 「记需求：……」 / “capture audience quotes: …”
2. Comment / DM export or screenshot — extract quotes; one `N-` each; confirm with the user when unsure.
3. URL / thread — fetch with host research tools; store the **commenter's** words, not the author's hook. On **X**: `x_*` first, then agent-reach if needed.
4. After a consult — 「刚才那通咨询记需求」.
5. Keyword / research pass — screen for L1/L2; **confirm** then write `N-` for verbatim hits; update `_index.md` research note briefly.

Forbidden: Agent-rewritten sentences as quote; watchlist/keyword viral titles as need; FAQ templates with no original quote; silent batch write from a scan.

## Write

1. New `needs/entries/N-YYYYMMDD-XX.md` from `needs/_template.md`
2. New row at the top of `needs/_index.md`
3. Rebuild workbench
4. Chat card:

```text
✅ Need N-YYYYMMDD-XX
【Quote】 …
【Source】 comment | dm | consult | faq | student | other
【Layer】 L1 | L2 | L3
【Frequency】 1
【Stored】 needs/_index + needs/entries/N-….md
【Merge】 new | merged into N-… (frequency now k, status still captured)
```

## 扫需求选题

Input set: `needs/_index.md` rows with `status=captured` (`topic_ids` empty). Max **5** `produce`. Prefer L1/L2 glosses for this profile unless the user asks otherwise.

Then **§ Topics**: Input gate Need ID `N-…`; `source_type=need`; `need_ids` lists the `N-` (never in `capture_id`); default `scout_label=demand`. **Before any `produce` write, ask the user to choose `generation_mode`** (six modes; recommend `demand` when Need-led). Still run hard filters and that mode’s required-input gate.

When `produce` creates a `T-` from an `N-`: update `needs/_index.md` + the entry to `status=promoted` and `topic_ids` containing that `T-`. Discard / library: leave `captured` or `retired` — do not mark `promoted` without a T-.

Audience exception (first activation): `source_type=need` **and** `need_ids` non-empty → matching at least one need gloss counts as one strong audience check; do **not** require a full ICP from `audience.md` / `pillars.md`. `ready` still needs `opp_score ≥ 7.5` **and** `audience ≥ 6`.

Prefer scanning needs before inbox. Inbox is structure / competitor context.
