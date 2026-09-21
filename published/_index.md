# Published index

**Role:** One row per **shipped post** (one platform URL).  
**Also:** use history for swipe / atom (join on `swipe` / `atoms`). Claim **proposition** evidence still lives in the claim file’s Evidence table.

Same **topic** may appear across **multiple runs / multiple published rows**. One **run** → usually **one** published row.

## How to use

- On ship: add a row; update that run’s `runs/_index` → `published`.
- Then bump `n`/`win`/`loss` on cited index rows (`CLAUDE.md` § Catalog evidence).
- Swipe/atom: this table **is** the ledger. Claim: also append the claim file Evidence row (`vs claim`).
- `result`: `win` | `flat` | `loss` | `unknown`.
- `evidence_tier`: `unknown` | `observed` | `tested` | `supported` | `weakened`  
  (layout / judgment learning strength — not the same as `result`. Single `unknown` never promotes a W- or Layout Family to `supported`.)
- `layout_family`: primary Layout Family used on the pack (optional; leave blank for text-only ships).

## Catalog

| date | platform | url | run | pillar | swipe | atoms | claim | result | evidence_tier | layout_family | notes |
|------|----------|-----|-----|--------|-------|-------|-------|--------|---------------|---------------|-------|

<!-- Agent: prefer newest on top -->
