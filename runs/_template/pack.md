---
# PagePack — this run is already one platform (image decks only; not pure x text)
# Prefer filename: pack.md (or pack-<platform>.md)
# Create when: user wants carousel/slideshow AND rubric SHIP for this run.
# Order: Arc → Page Contracts → Media → Template Selection → Pages slots.
# Do not default Cover → Point → Steps → Recap → CTA.
# Do not start template retrieval until every page has a Page Contract (no templateId in contracts).
---
status: unused
id:
platform: linkedin
deck_hint:
page_count: 0
---

# Pack

## Meta

- **run_id:**
- **profile:**
- **pillar:**
- **topic_id:**
- **w_ids:**
- **product_ids:** none
- **recommendation_ids:** none
- **swipe_id:**
- **claim_id:**
- **language:** en
- **hook_type:**

## Arc

<!-- One line: the argument that needs page turns. Required before Page Contracts. -->
<!-- Recipes: cost-mechanism | listicle | mistakes | claim-proof | compare | product-review | (named) -->

- **one_liner:**
- **recipe:**

## Page Contracts

<!-- Required before template retrieval. No templateId here. -->
<!-- page_role is a retrieval tag, not sequence law. Page 1 should usually be cover|hook. -->

| page | page_purpose | page_role | density | slot_summary | media_requirements | reader_action |
|------|--------------|-----------|---------|--------------|--------------------|---------------|
| 1 | | cover \| hook | low \| medium \| high | e.g. title:1 body:1 | none \| home \| screenshot | continue |
| 2 | | | | | | |

## Media

<!-- Resolve after contracts: subject P-* / R-* → role → caption. Cite M-* only. -->

| page | subject | media_id | role | caption |
|------|---------|----------|------|---------|
| | P-… \| R-… | M-… \| gap | home \| pricing \| … | |

## Template Selection

<!-- After contracts + media. Hard filter → rank → auto-pick. Record Layout Family, not only templateId. -->
<!-- evidence: hypothesis | tested | supported — never invent supported from a single unknown. -->

| page | layout_family | template_id | evidence | reason | mode |
|------|---------------|-------------|----------|--------|------|
| 1 | | | hypothesis | | champion \| challenger \| explore |
| 2 | | | hypothesis | | champion \| challenger \| explore |

## Pages

<!-- Text slots only — no private AST. Fill after templates chosen. -->

### page 1

- **role:**
- **layout_family:**
- **template_id:**
- **media_ids:**
- **slots:**
  - text_0:

### page 2

- **role:**
- **layout_family:**
- **template_id:**
- **media_ids:**
- **slots:**
  - text_0:

<!-- …repeat through page_count… -->

## Experiment

<!-- Comparable-run ledger. Changing topic + copy + media + template together ≠ template proof. -->

- **variables_changed:** topic \| copy \| media \| layout \| template \| platform \| audience
- **comparable:** yes \| no
- **notes:**

## Render

- **job_id:**
- **export_path:** exports/<run-slug>/<platform>/
- **status:** not_requested | queued | done | failed
