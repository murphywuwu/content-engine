# Keywords — profile `default`

**Role:** Three-track recipes — **listen** (social), **search** (SEO), **ask** (GEO). Not topics.

| track | Means | Default use |
|-------|--------|-------------|
| `listen` | Social search strings | 「扫关键词」→ Hits |
| `search` | Google/SEO phrases | Content map; volume optional; not default social scan |
| `ask` | 15–25 word AI-engine questions | GEO coverage; not social scan |

**Scan rule:** 「扫关键词」→ `track=listen` + `active` only → Hits. Never scan → Topic.

| id | track | query | platform | intent | layer | pillar | why | weight | status | seed_from | pair_id | volume | kd | serp_intent | volume_source | volume_at | ask_engines | last_scanned |
|----|-------|-------|----------|--------|-------|--------|-----|--------|--------|-----------|---------|--------|----|-------------|---------------|-----------|-------------|--------------|
| K-01 | listen | (fill audience pain phrase) | x | pain | L1 | P1 | (why) | 1.0 | paused | manual |  |  |  |  |  |  |  |  |

Replace fill rows after interview / first needs. Prefer 8–12 active **listen** seeds before routine scans.

## Column notes

| Column | Meaning |
|--------|---------|
| `track` | `listen` \| `search` \| `ask` |
| `seed_from` | `need:N-…` / `hit:H-…` / `audience` / `pillar:P…` / `manual` |
| `volume` / `kd` | search annotations; empty OK |

## Agent rules

- Default scan: listen + active only; max 5
- Propose new rows in chat; write after confirm
- Do not invent Need quotes from keywords
