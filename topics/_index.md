# Topics index (production queue)

One row = one topic. Full scorecard in **`item`** file.  
Same topic on multiple platforms = **one topic row**; open **N runs** sharing `topic_id`.  
Statuses live here and in the item—**not** folder names.

Newest on top.

| id | date | opp | aud | status | purpose | scout | platform | pillar | lane | generation_mode | one_liner | item | source_type | src_url | src_handle | src_likes | src_replies | src_bookmarks | engagement_at | capture_id | need_ids | product_ids | product_fit | recommendation_ids | run |
| -- | ---- | --- | --- | ------ | ------- | ----- | -------- | ------ | --------- | ---- | ----------- | ------- | ---------- | --------- | ----------- | ------------- | ------------- | ---------- | --- | --- | --- | --- |

## Status values

| status | Meaning |
|--------|---------|
| `draft` | Created, not fully scored |
| `scored` | Has scores; not yet triaged |
| `ready` | opp ≥ 7.5 **and** aud ≥ 6 (dual gate) |
| `backlog` | opp/aud mid — re-angle, research, or wait |
| `parked` | opp < 6 or aud < 5 or hard-filter fail |
| `library` | Scout purpose library (structure later; not produce-ready) |
| `promoted` | Opened as a run (`run` column set) |
| `killed` | User rejected |

## Columns (key)

| Column | Meaning |
|--------|---------|
| `opp` | Opportunity score (weighted 5-dim: context/audience/conflict/insight/evidence) |
| `aud` | Audience dimension score (hard floor ≥ 6 for ready) |
| `item` | Wikilink to `topics/items/T-….md` |
| `lane` | Publishing lane: teach, build, review, compare, offer, or profile-defined |
| `generation_mode` | How the Topic was formed; see `topics/_template-item.md` |
| `source_type` | `inbox` \| `user` \| `need` \| `product` \| `recommendation` |
| `src_*` | **Source post** engagement snapshot — not your publish metrics |
| `capture_id` | Set only if linked to inbox `C-…`. **Never** put `N-` here; needs live on the item as `need_ids` |
| `need_ids` | Audience evidence cited by the Topic; demand evidence, not product proof |
| `product_ids` | Optional product facts cited by the Topic |
| `product_fit` | `direct` \| `adjacent` \| `none`; editorial relevance only |
| `recommendation_ids` | Optional third-party subjects used for review or comparison |
| `run` | One or more `RUN-…` ids after open (comma-separated if multi-platform siblings) |

## Rules

- Max **5** new **`produce`** topics per promotion session
- Topics require an explicit user, need, product, recommendation, or profile input.
- Scout first; never `ready` on high `src_*` or opp_score alone (need audience ≥ 6 too)
- Scoring: `topics/scoring.md` (opportunity dimensions)
- Product fit is optional and never replaces Need evidence or opportunity scoring.
- `记一下` + URL: **inbox first**, not topics, unless user also asks to score as topic
- On 开一单: append all new run ids to `run`
