# Needs index

Registry of **audience quotes**. Source of truth for need lifecycle.

Newest rows on top. **Zero starter rows** — do not invent quotes.

| id | date | profile | source_type | quote | speaker | frequency | status | topic_ids | file |
|----|------|---------|-------------|-------|---------|-----------|--------|-----------|------|

## Columns

| Column | Meaning |
|--------|---------|
| `id` | `N-YYYYMMDD-XX`, increment per day (same shape as `C-` / `D-` / `T-`) |
| `date` | First sighting date |
| `profile` | Default current `profile_id` |
| `source_type` | `comment` \| `dm` \| `consult` \| `faq` \| `student` \| `other` |
| `quote` | **Verbatim.** Never put a gloss in this cell |
| `speaker` | Optional; anonymous → `anon`. Do not invent names |
| `frequency` | Integer, default 1. Same-meaning merge: `+1` on this row, append a sighting — do **not** create a second row |
| `status` | `captured` \| `promoted` \| `retired` (**never** `clustered`) |
| `topic_ids` | Cited `T-…`, comma-separated. Non-empty **iff** status=`promoted` |
| `file` | `needs/entries/N-….md` |

## Agent rules

- Every need: new row + new `entries/<id>.md`
- Merge is not a new status. After a user-approved synonym merge, keep `captured`, bump `frequency`, append sighting
- Do not mark `promoted` without a `T-` whose `need_ids` contain this `N-`
- Scan-for-topics input set: `status=captured` (`topic_ids` empty). Max 5 `produce`
- Quotes may include DMs / student info. Keep local. Redact PII if a quote is used in published copy
