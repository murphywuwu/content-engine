# Inbox index

Registry of captures. **Source of truth for capture lifecycle**.

Newest rows on top.

| id | date | type | one_liner | platforms | profile | entry | raw | library | status |
|----|------|------|-----------|-----------|---------|-------|-----|---------|--------|

## Columns

| Column | Meaning |
|--------|---------|
| `entry` | Working notes file under `inbox/entries/` |
| `raw` | Authoritative source file if any; else empty |
| `library` | `none` or e.g. `swipe:S1` / `atom:A-…` / `claim:C-…` after user-approved ingest |
| `profile` | Which content profile this capture is for |
| `status` | `captured` \| `ingested` \| `archived` |

## Agent rules

- Every capture: new row + new `entries/<id>.md`
- raw file only when URL / structure / media / user says important → also row in `raw/_index.md`
- Never silent-write swipe/atoms/claims; only update `library` after approval
