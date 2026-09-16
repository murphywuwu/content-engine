# Swipe index (structure catalog)

**Role:** Full-post beat order. Global library; scope with **`profiles`** + **`platforms`** columns.

**Selection:** read this table first → filter platform + profile → drop `dead` → prefer `working` then higher `win/n` → open 0–1 body. **`none` allowed** (declare why).

## Status (hit-rate, our posts — not “is this true”)

| status | Meaning |
|--------|---------|
| `trial` | In catalog; not enough of **our** published uses |
| `working` | Our reuse is helping; prefer in selection |
| `dead` | Never auto-select |

`n` / `win` / `loss` = our `published.result` cache. `flat` and `unknown` bump `n` only.  
**No Evidence table in swipe files.** Use history = `published/_index` (column `swipe`).

## Ingest

See `CLAUDE.md` § Library ingest. No silent seed from runs. Unpublished runs never enter.

## Catalog

| id | file | platforms | profiles | form | beats_or_pages | status | n | win | loss | one_liner | source |
|----|------|-----------|----------|------|----------------|--------|---|-----|------|-----------|--------|

`profiles: *` = available to all profiles.
