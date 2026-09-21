# topics/

Topic system: **what to produce next**, after an explicit need, offer, review subject, or profile thesis has been judged as an opportunity.

| Path | Role |
|------|------|
| `_index.md` | Queue registry (one row per topic + `item` link + source engagement) |
| `items/T-*.md` | One file per opportunity: human card first, Score/Trace/Constraints appendix |
| `scoring.md` | Opportunity dimensions and dual gate |
| `_template-item.md` | Template for new items |

Flow:

```text
explicit input → editorial judgment
  → `_index` + `items/T-…` (opportunity 5-dim)
  → ready only if opp≥7.5 and audience≥6
  → user opens run → `status=promoted`
```

The item file is a **judgment card**. A content owner who skips YAML and the appendix must still answer: what we would say, to whom, why now, why us, and whether to open a run. Five-dim scores stay in `## Score` as a gate, not as the reading surface.
