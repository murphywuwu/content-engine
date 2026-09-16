---
id: P-001
name: EasySociable
status: active
effective_from: 2026-09-04
source_of_truth:
  - docs/prd.md
  - docs/pricing-v1.md
  - apps/easysociable/app/routes/home.tsx
---

# EasySociable

## Product promise

Turn an agent-produced content argument into a reusable, branded,
reviewable, multi-page social visual pack.

## What it is

EasySociable is the hosted visual production layer for an external Agent. It
provides reusable Page Templates, Brands, durable Slideshow Runs, Studio
review/editing, and browser Download of the reviewed PNG pack.

The Agent supplies the content reasoning and page structure. EasySociable does
not write the content or provide a hosted LLM.

## Best for

- Creators who already use Codex, Claude Code, or a comparable Agent for
  content reasoning.
- Creators and teams producing branded carousels across TikTok, Instagram,
  LinkedIn, or Threads.
- Operators who need reusable visual systems, role-specific layouts, and a
  review step before download.

## Not for

- Users looking for a browser-only content writing assistant.
- Users who want a general-purpose freeform design editor instead of a
  constrained reusable visual system.
- Users who want EasySociable to manage their social accounts or publish
  automatically.

## Problem

An Agent can produce the argument, but the visual production context is often
lost: each carousel starts from a blank design, brand instructions are
repeated, and a small revision can require regeneration.

When one idea must become several platform deliverables, the operator also has
to repeat layout and export work while checking platform-specific canvases.

## Mechanism

- Page Templates are discoverable by layout role such as `cover`, `hook`,
  `value`, `steps`, `proof`, and `cta`, so a content structure can be matched
  to an appropriate visual layout.
- A Brand and reusable templates persist visual decisions across future Runs.
- Studio keeps the complete Run reviewable and allows supported text and image
  slot edits before Download.
- Platform-specific Layout Family variants and exports adapt the same
  structured content to supported canvas presets.

## Not solving

- Content strategy, audience research, or the quality of the Agent's thesis.
- Guaranteed reach, engagement, conversions, or viral performance.
- Automatic social posting or social-account connection.
- A hosted LLM or a replacement for the user's Agent.
- Unlimited arbitrary canvas editing or unrestricted template composition.

## Pricing and entitlements

Early-access prices; list prices and free limits may change.

| Plan | Monthly | Annual | Slideshow Download | Brands | Image library |
|------|---------|--------|--------------------|--------|---------------|
| Free | $0 | — | 3/month, 1 platform per pack | 1 | 2 GB |
| Creator | $19 | $190/year | Unlimited, all selected V1 platforms | 5 | 50 GB |
| Pro | $39 | $390/year | Unlimited, all selected V1 platforms | 25 | 200 GB |
| Agency | Sales-led | Contract | Contract | >25 | >200 GB |

Paid plans include the full system-template catalog, up to 20 pages per
Slideshow Run, private drafts, three API keys, no overage and no watermark.
Pixels leave the product through Studio Download; CLI/MCP is not a final PNG
factory.

## Proof

No customer proof is recorded here. Do not invent testimonials, adoption
metrics or performance improvements.

## Objections

### “Canva already does this.”

Canva is the broader freeform design workspace. EasySociable is for an
Agent-first, repeatable visual production workflow with role-aware templates,
durable Runs and Studio review.

### “Can the Agent write my post?”

The Agent can do that outside EasySociable. EasySociable owns the visual
production layer.

### “Can I publish directly?”

V1 produces a reviewed Download from Studio. It does not connect social
accounts or publish posts.

## Claims

### Safe to say

- Reuse saved Brands and Page Templates.
- Select layouts by supported page role.
- Review and edit supported slots in Studio before Download.
- Create platform-specific variants for supported V1 platforms and canvases.

### Say carefully

- “One idea, multiple platforms” means the structured Run is adapted and
  exported for supported platform formats; it does not mean one identical file
  is valid everywhere.
- “Faster” requires a user-specific baseline. Do not claim a universal time
  saving.
- “Branded” means the configured Brand and selected templates are applied; it
  does not mean every creative decision is automatically correct.

### Do not say

- “Guaranteed higher engagement.”
- “One-click automatic publishing.”
- “AI writes all your content.”
- “No review is needed.”
- “Every platform receives the same file.”

## CTA

- `educate`: explain the Agent-to-visual production gap.
- `mention`: show how a role-specific template or Brand persists.
- `invite`: ask users to try a real content Run and review it in Studio.
- `sell`: use only when the audience has a validated need for repeated
  branded visual production.

## Version notes

- 2026-09-04: early-access pricing and V1 entitlements from
  `docs/pricing-v1.md`.
