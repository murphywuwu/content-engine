# Runs index (production jobs)

One row = one **platform run** (one folder). Same Topic on multiple platforms = **multiple rows** sharing `topic_id` — **not** one folder with many platform variants.

Newest on top. Agent updates on open / status change / export / kill.

| run_id | path | date | status | account | profile | primary_platform | platforms | topic_id | pillar | one_liner | pack | export | notes |
| ------ | ---- | ---- | ------ | ------- | ------- | ---------------- | --------- | -------- | ------ | --------- | ---- | ------ | ----- |

## Status values

| status       | Meaning                                          |
| ------------ | ------------------------------------------------ |
| `open`       | Folder created; brief not done                   |
| `brief`      | Brief wait / in progress                         |
| `draft`      | Drafting / editing                               |
| `scored`     | Rubric done; ship or hold                        |
| `ready`      | SHIP — copy ready to post (and/or pack ready)    |
| `scheduled`  | Scheduled — date planned, awaiting manual post   |
| `published`  | This platform shipped (or user declared done)    |
| `hold`       | Rubric hold / blocked                            |
| `killed`     | Abandoned                                        |
| `superseded` | Replaced by another run                          |
| `partial`    | **Legacy** — do not use for new runs             |

## Columns

| Column | Meaning |
|--------|---------|
| `path` | Wikilink to run folder |
| `scheduled` | (Optional) Planned publish date `YYYY-MM-DD` (or in `notes` as `scheduled: YYYY-MM-DD`) |
| `primary_platform` | **This** run’s platform (craft + publish target) |
| `platforms` | Must equal `primary_platform` (single value; index compat) |
| `pack` | `no` \| `yes` (image pack written for this run) |
| `export` | `no` \| `yes` (files under `exports/<slug>/`) |
| `topic_id` | `T-…` or none (siblings share the same id) |

## Rules

- On **开一单**: **ask platform(s)** if unset; **one folder + one row per platform**; `status=open`.
- On status change: update this table (source of truth for queue scan).
- On ship: row in **`published/_index`** + here → `published`.
- Do not store draft body or image binaries here.
