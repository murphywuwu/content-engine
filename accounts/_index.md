# Accounts index

Each handle points at a **profile** + platforms.  
Full pillars/audience/voice live under `profiles/<id>/` (unless voice overridden).

Replace the starter handle before the first run.

| handle | profile_id | voice | platforms | default_platform | overrides | status |
|--------|------------|-------|-----------|------------------|-----------|--------|
| your-handle | default | profile | x | x | | active |

## Columns

| Column | Meaning |
|--------|---------|
| `handle` | Social account id |
| `profile_id` | Row in `profiles/_index.md` |
| `voice` | `profile` → `profiles/<profile_id>/voice.md`; or explicit path to another voice file |
| `platforms` | Platforms this account posts on |
| `default_platform` | Watchlist / catalog filter when unset — **not** used to silent-default 开一单 |
| `overrides` | Empty = none; else path e.g. `accounts/overrides/<handle>.md` |
| `status` | active / planned / retired |

## Resolve path (Agent)

1. Read this table for the handle (default: first **active** row)
2. Load `profiles/<profile_id>/pillars.md` + `audience.md`
3. Voice: if `profile` or empty → `profiles/<profile_id>/voice.md`; else load the path in the cell
4. If `overrides` non-empty, read that file last
5. Load `platforms/<platform>.md` for craft (**required** when drafting that platform; map in `platforms/README.md`)
6. Filter swipe/atoms/claims by platform + profile (`*` = all)
