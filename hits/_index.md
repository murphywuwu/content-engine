# Hits index (research triage)

**Role:** Staging board for research hits. Route to Needs or Library — **not** a Topic queue.

Newest on top. Scan may write rows here (include source-post heat). Routing out still needs explicit confirm.

| id | date | profile | platform | keyword_id | source | hit_kind | signal | status | excerpt | src_likes | src_replies | src_bookmarks | src_views | engagement_at | file |
|----|------|---------|----------|------------|--------|----------|--------|--------|---------|-----------|-------------|---------------|-----------|---------------|------|

## Status

| status | Meaning |
|--------|---------|
| `triage` | Waiting for route |
| `routed_need` | Written to `needs/` |
| `routed_library` | Capture + library ingest path |
| `discarded` | Rejected |

## Columns

| Column | Meaning |
|--------|---------|
| `keyword_id` | Primary recipe `K-xx` |
| `src_*` | Source-post heat snapshot (not our results) |

## Agent rules

- Exits: **need** \| **library** \| **discard**. Hits are not Topic inputs.
- On scan: write `keyword_id` + engagement snapshot when known. Do not invent metrics.
- Author hooks ≠ Needs. Zero starter rows — do not invent hits.
