# Platform: LinkedIn

**Scope:** How to *write* for LinkedIn — length, rhythm, quality bars, document/carousel norms.  
**Not in this file:** Who you are, product story, pillars, voice, audience.  
Those live under `profiles/<id>/` (via account → profile resolve).  
**Pixels / canvas:** EasySociable `PLATFORM_SPECS` (LinkedIn page templates; PDF document pages often `4:5` or `1:1`).

Agent: before drafting any LinkedIn post, read this file for craft.

---

## Defaults

- Language: English (unless user asks otherwise)
- Default unit: **document carousel (PDF pages) + short post text** — not a pure text hot take
- Assume professional feed skim: **cover slide + first line of caption** do most of the work
- Pack: **almost always yes** for easysociable-builder runs (visual production proof)

## Length & shape

| Form | Guidance |
|------|----------|
| Caption | Hook in line 1 (above the fold). 3–8 short lines total. One clear promise. Put outbound links in the **first comment**, not the post body when possible. |
| Document carousel | **7–10 pages** sweet spot (acceptable band ~5–15). One idea per page. Headlines scannable alone. Body under ~30 words/page when present. |
| Aspect (pack) | Prefer **4:5 (1080×1350)** mobile-first, or **1:1 (1080×1080)** for safe desktop+mobile. Same size every page. |
| Text-only | Allowed as a light mid-week post; do not make it the default for system/framework topics. |

## Hooks (mechanics only)

Cover slide **and** caption line 1 should each do one of:

- Name a **specific agency / operator pain** (revisions, brand feedback, blank prompt)
- Promise a **numbered framework** or checklist the reader can steal
- Lead with a **concrete claim or contrast** (not “My thoughts on AI”)

Avoid vague covers: “Leadership lessons”, “What I learned this week”.

## Craft rules

1. Write like a **saveable mini-deck**, not like an X dunk.
2. One idea per slide; if it needs a paragraph, split across two slides.
3. Prefer frameworks, steps, before/after production loops, cost-of-revision angles.
4. Soft CTA on the last slide (invite / question / “save for your next client kickoff”) — not “Buy now”.
5. EasySociable only as **visual production layer** proof after the framework lands.
6. Tone: calm, specific, peer-to-peer operator — not hype, not meme war.
7. Hashtags: 0–3 max, optional; never a wall.

## Anti-slop (LinkedIn)

Do **not** default to:

- Inspiration-poster fluff with no procedure
- Hard sell on slide 1 or slide N
- Crypto flex / “I made $X in 30 days” unless user supplies a real number for that draft
- Pasting an X-style contrarian one-liner as the whole post
- External link in the post body as the main content
- Dense slides that require pinch-zoom

## Quality self-check

- [ ] Cover works as a standalone headline in under 3 seconds?
- [ ] Would an agency lead save this for a teammate?
- [ ] Each page one idea; captions not essays?
- [ ] Soft CTA, not a pitch deck close?
- [ ] Matches pillars; no invented metrics/customers?
- [ ] Pack page count and aspect sensible for LI document post?

## Out of scope here

- Exact render pipeline → run `pack.md` + EasySociable slideshow/template skills  
- Profile ICP emphasis → `profiles/.../audience.md`  
- Other networks → sibling `platforms/*.md`  
