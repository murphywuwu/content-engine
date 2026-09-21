# Topic scoring — Opportunity evaluation

Stable rules for evaluating **Content Opportunities** for the active profile.  
Scores whether a topic **deserves to exist as content**, not whether it can be written well.

**Principle:** Don't generate content from topics. Generate content from validated opportunities.

**Goal of a `ready` opportunity:** worth opening a run that speaks to the readers and pains in  
`profiles/<id>/audience.md` and `pillars.md`, and can land the account’s product/wedge honestly  
(not empty consensus, not hard sell).

---

## Pipeline (do not skip)

```text
user task + explicit input
  → parse mode and retrieval query
  → Context Packet (profile + graph nodes + evidence + constraints)
  → 0) Hard filters
  → 1) Scout gate (purpose + label)     ← most signals die here
  → 2) Opportunity five-dim score        ← only for produce candidates
  → 3) Verdict (opp_score + audience floor)
  → 4) Among ready only: sort by src_*
```

Library-only signals may skip (2)–(3) — see Scout purposes below.

Topic scoring runs after an explicit input and a Context Packet. Inputs may be
Needs, Products, Recommendations, Captures, user briefs, profile theses,
existing Topics/Runs, or named comparisons/responses. Product or
recommendation fit is context, not automatic evidence of audience demand.

Need match (`need_ids` non-empty) → default `scout_label=demand`. Do not create
an `N-` from a product claim or headline. Product-led and thesis-led topics may
use `offer_education`, `profile_thesis`, `domain_explanation`, `comparison`,
or `response` when their required evidence is present.

Product fit is a separate optional annotation:

```text
Needs = reader observations
Products = offer facts
W- pages = profile judgments, hypotheses, evidence, and counter-evidence
Topics = editorial judgment over the assembled Context Packet
```

Use `product_ids` only when the Topic honestly connects to an active product
entry. Use `product_fit=direct` when the Topic addresses a problem the product
solves, `adjacent` when it builds context without being a pitch, and `none`
when no product connection is needed. Product fit does not increase a score,
replace `need_ids`, or make a Topic `ready`.

---

## 0) Hard filters (fail → do not create topic, or `parked`)

- Off **profile pillars** (unless user override)
- Hits audience **Not for** (F4F, pure crypto shill, comment-gate junk as the only substance, etc.)
- Requires invented personal metrics/experience to write honestly

---

## 1) Scout gate (before opportunity scores)

Every scanned signal gets a **purpose** and a **scout_label**.  
**Default bias: discard.** Max **5** `produce` topics per promotion session.

### Purpose

| purpose | Meaning | Create T-? | Score opportunity? |
|---------|---------|------------|------------------|
| `discard` | Noise / wrong ICP / no reusable mechanism | **No** | No |
| `library` | Worth swipe/atom/claim later; not this week's post | Optional T- with status `library` **or** offer capture only | Optional; **not** `ready` |
| `produce` | Candidate to open a run | **Yes** | **Yes** |

### Scout label (on produce / library)

| scout_label | Meaning |
|-------------|---------|
| `demand` | Target reader states a real pain/job in their own words |
| `ally` | Peer system / adjacent thinking we can teach beside |
| `foil` | Competitor or default path to contrast |
| `craft_only` | Stealable structure; weak ICP/wedge fit — prefer `library`, rarely `produce` |

### Scout discard examples (profile-aware)

- Pure growth/engagement playbook with **zero** angle toward this profile’s pillars
- Comment-gate kits with no inspectable mechanism
- End-user vanity metrics with no buyer/operator shape from `audience.md`
- Wrong vertical vs profile **Not for** (unless user override)

### Scout pass hints (toward `produce`)

- Pain named in `audience.md` (or clear operator inside that buyer shape)
- Mechanism / contrast that maps to at least one pillar
- Ally or foil that sharpens the account’s wedge without inventing claims
- Reusable structure that still clears the audience floor (else prefer `library`)

Record on the topic item: `purpose`, `scout_label`, one-line `scout_note`.

---

## 2) Opportunity dimensions (0–10 each)

Only required for `purpose: produce`. Optional brief notes for `library`.

**Principle:** these five dimensions answer **"is this worth saying?"** — not "can it be written well?"  
Presentation concerns (framework, structure, format) belong at Brief stage.

Write reasons in the topic's **readable judgment layer**. The `## Score` table is numbers only — do not duplicate the card in a note column. Verdict (`ready` / `backlog` / `parked`) belongs in the decision summary, then echoed as one line under Score.

| Key | Name | What to judge | Weight |
|-----|------|---------------|--------|
| `context` | Context | What changed? Why now? Timing, freshness, relevance to the audience's world | **15%** |
| `audience` | Audience | Who specifically cares? ICP match — pain / buyer shape / wedge from profile | **20%** |
| `conflict` | Conflict | Current belief vs reality — is there a real gap? How strong is the tension? No conflict = no content | **25%** |
| `insight` | Insight | Non-obvious perspective, mechanism, or reframe the audience hasn't seen | **25%** |
| `evidence` | Evidence | Can the core angle be supported with something specific? What evidence exists or could be found? | **15%** |

```text
opp_score = 0.15×context + 0.20×audience + 0.25×conflict + 0.25×insight + 0.15×evidence
```

Round to 1 decimal.

### Per-dimension scoring guide

**Context (15%)**

| Range | Guide |
|-------|-------|
| 8–10 | Clear, recent shift the audience has felt but may not have named |
| 5–7 | Real change but not urgent or widely felt yet |
| 0–4 | Nothing changed; evergreen truism or stale news |

**Audience (20%)** — read `profiles/<id>/audience.md` and `pillars.md` first

Score using these checks (note which hit):

1. **Pain** — matches a real pain / job from audience (or clear operator inside that shape)
2. **Buyer shape** — who buys/acts matches audience buyer as defined there
3. **Wedge land** — can honestly teach or contrast toward this account’s product/wedge without inventing claims

If product fit is `direct`, load the cited product entry and verify that the
Topic's problem and proposed CTA are inside its `Problem`, `Mechanism`, and
`Not solving` sections. If the product is not needed, score the Topic on its
audience and wedge without forcing a mention.

**Need-source exception:** when `source_type=need` **and** `need_ids` is non-empty, matching **at least one need gloss** counts as one strong audience check. Do **not** require a full ICP (`audience.md` / `pillars.md` may still be hypothesis). Non-need sources do not get this exception. `ready` is still `opp_score ≥ 7.5` **and** `audience ≥ 6`.

Needs default `scout_label=demand`. Still pass hard filters. `frequency ≥ 3` may strengthen context `why_now`; do **not** fold it into `src_*`.

| Range | Guide |
|-------|-------|
| 8–10 | ≥2 checks strong; clear buyer + pain |
| 6–7 | One strong check; usable with careful angle |
| 4–5 | Stretch; usually `backlog` even if other dims are high |
| 0–3 | Wrong room → should have been scout `discard` / `library` |

**Conflict (25%)** — the most important dimension

| Range | Guide |
|-------|-------|
| 8–10 | Clear belief gap: audience believes X, reality is Y, and the gap has consequences |
| 5–7 | Some tension but the gap is soft or already widely acknowledged |
| 0–4 | No real conflict; topic is an observation or list with nothing to challenge |

When scoring, write the false belief and the gap once under 「他们现在相信什么」 — not just a score, and not a second time in the Score table. If you can't articulate what the audience currently believes wrong, the conflict score cannot be above 5.

**Insight (25%)**

| Range | Guide |
|-------|-------|
| 8–10 | Genuinely non-obvious; reframes how the audience thinks about the problem |
| 5–7 | Useful perspective but predictable for a knowledgeable reader |
| 0–4 | Restates common knowledge |

**Evidence (15%)**

| Range | Guide |
|-------|-------|
| 8–10 | Specific, named evidence available (data, product behavior, case, mechanism) |
| 5–7 | Evidence exists but generic or secondhand |
| 0–4 | No evidence beyond assertion; "experts say" with no expert named |

A verbatim need quote is `observation` evidence. List the quote (or a paraphrase **and** the `N-` id) under `## Evidence.available`. For demand claims, an `N-` / `C-` / user-lived experience is required; without one, audience-demand evidence cannot be above 5. Product-led, review, comparison, and domain modes may use named product behavior, independent research, or other mode-appropriate evidence for the core angle, but cannot relabel it as audience demand.

Product documentation is evidence of what the product does, not evidence that
the audience wants it. Do not use a product entry to manufacture a Need or to
raise the audience score.

### Epistemic handling

Every source in the Context Packet receives one label:
`fact`, `observation`, `judgment`, `hypothesis`, `counter_evidence`,
`constraint`, `proposal`, or `unknown`.

- `fact` may be stated only within the source's scope.
- `observation` keeps its original speaker and sample scope; do not generalize
  a Need into market demand.
- `judgment` supplies an editorial angle, not neutral fact.
- `hypothesis` stays explicitly unverified.
- `counter_evidence` remains visible during scoring and drafting.
- `constraint` is a hard generation rule.
- `proposal` is an Agent-generated candidate, not existing knowledge.
- `unknown` means evidence is missing; never fill it with model common sense.

`W-` state (`hypothesis`, `tested`, `supported`, `weakened`, `retired`) and
`confidence` describe the lesson, not the truth of every sentence on the page.
Record the source, label, and retrieval reason in the Topic Trace.

### Generation-mode gates

Before scoring a `produce` Topic, resolve `generation_mode` from the user's
task. Ask when ambiguous; do not silently default every Topic to `demand`.
Then enforce required inputs:

| mode | Required |
|------|----------|
| `demand` | `need_ids` + Profile |
| `demand_to_offer` | `need_ids` + `product_ids` + Profile |
| `demand_to_review` | `need_ids` + `recommendation_ids` + Profile |
| `review` | `recommendation_ids` + named evidence + Profile |
| `offer_education` | `product_ids` + product mechanism + Profile |
| `profile_thesis` | Profile + Pillar |
| `domain_explanation` | Profile + named domain/question |
| `comparison` | Named subjects + comparison evidence + Profile |
| `response` | Named claim/source + response evidence + Profile |
| `craft_only` | Named source/structure + Profile |

Do not use `review` when the only evidence is vendor marketing. Review entries
must state limitations, research date, and commercial disclosure where
relevant. Product-only and recommendation-only inputs do not imply demand and
never raise audience / `ready` alone. They can still produce a valid Topic in
an education, review, comparison, or response mode when its evidence exists.

When `evidence < 5`, agent should flag an **evidence gap** on the topic item and may suggest **research** before finalizing the score. Topics can be re-scored after research fills the gap.

---

## 3) Verdict

For `purpose: produce`:

| Verdict | Rule |
|---------|------|
| **ready** | `opp_score ≥ 7.5` **and** `audience ≥ 6` |
| **backlog** | opp_score ≥ 6.0 and audience ≥ 5, but not both ready thresholds; **or** one dim very high / another mid — may research, re-angle, and rescore |
| **parked** | opp_score < 6.0 **or** audience < 5 **or** hard filter |

For `purpose: library`: status `library` (not ready). User may later promote via re-angle + rescore as `produce`.

**Never** promote to `ready` on high `src_*` alone.

### Weak-dim guidance

When any single dim scores < 6, agent flags it with a suggestion:

| Weak dim | Suggestion |
|----------|-----------|
| context | "Is there a real trigger or change? If not, consider timing or reframing." |
| audience | "Who specifically has this problem? If no ICP match, consider library instead." |
| conflict | "What does the audience believe that's wrong? If no gap, this may not be content." |
| insight | "What's the non-obvious angle? If predictable, consider a different perspective." |
| evidence | "Can we prove this? Research X to strengthen." |

---

## 4) Source engagement (sort only)

When source is an external post, record on **`topics/_index.md`**:

- `src_likes`, `src_replies`, `src_bookmarks`, optional `src_views`
- `engagement_at`

**Do not** fold into `opp_score`.  
Among **ready** items only: prefer higher `src_replies` / `src_bookmarks` over raw likes/views.  
High views + low audience → still not ready.

---

## Rescore

Allowed: same `T-id`, update scores / purpose / status in item + `_index`.  
Re-angling a `library` or `backlog` into profile fit is the usual upgrade path.  
Research → new evidence → re-score `evidence` dim is the other upgrade path.
