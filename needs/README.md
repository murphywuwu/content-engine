# needs/

First-class **user-needs library**. Not an inbox type. Inbox stays structure / link / insight.

| Path | Role |
|------|------|
| `_index.md` | Quote registry (source of truth for list/status) |
| `entries/N-YYYYMMDD-XX.md` | One need: verbatim quote + sightings + optional gloss |
| `_template.md` | Entry shape |

## Status machine (only these words)

```text
captured  → just written, or still captured after a synonym merge (frequency ≥ 1)
promoted  → and only when a T- exists whose need_ids contain this N-; topic_ids lists that T-
retired   → user discarded
```

Do **not** use `clustered`. Merge is not a status.

## Do not

- Invent quotes or FAQ template sentences
- Treat a watchlist hook / viral title as a need
- Put `N-` into a topic `capture_id` (`capture_id` is inbox `C-…` only)
- Hosted clustering

## Quote shape (not product copy, not index rows)

These lines are the **shape** of a creator's audience talking. They are **not** EasySociable features and must **not** be seeded as rows:

- 我不知道自己适合做什么 AI 自媒体方向
- 我每天用 AI 写稿，还是断更
- 我账号有流量，但为什么没人咨询
- 我想接广告，要多少粉丝才可以
- 我不会出镜，能不能先做图文

When a quote is reused as published copy, redact names / DMs / student details.
