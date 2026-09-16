---
id: P-002
name: Content Engine
status: active
effective_from: 2026-09-16
source_of_truth:
  - apps/cli/README.md
  - apps/cli/package.json
  - apps/cli/content-engine/starter/CLAUDE.md
  - apps/cli/content-engine/starter/engine.json
---

# Content Engine

## Product promise

Give AI-native creators and small content teams a local, repeatable workflow
from audience signals to topics, briefs, drafts, review, feedback, and
publishable content.

## What it is

Content Engine is a local-first content system: a git-friendly **core**
(operating manual, templates, workbench) plus your private **vault** (needs,
hits, topics, runs). Get the core by copying/cloning the engine tree (see
`LAYOUT.md`). `easysociable engine init` is an optional offline scaffold, not
the primary distribution channel.

It provides structured local files for profile and audience context, needs,
topics, product facts, drafts, runs, feedback, and a workbench for inspecting
the engine. It does not require Obsidian.

## Best for

- AI-native creators building a repeatable publishing workflow.
- Agency-of-one operators and small content teams managing recurring content
  decisions and review.
- Users who want local files and Agent-assisted workflows instead of a
  browser-only content writing assistant.

## Not for

- Users looking for guaranteed reach, engagement, conversions, or virality.
- Users who want an AI model to invent their audience, point of view, proof,
  or customer results.
- Users who want a hosted LLM or automatic social-account publishing.
- Users who only want one prompt or one generated post without a repeatable
  workflow.

## Problem

AI makes drafting easier, but a blank prompt does not preserve the audience,
point of view, editorial judgment, review standards, or feedback from the last
piece. Content Engine turns those decisions into explicit local objects that
an Agent can use again.

## Mechanism

- Local profile, audience, voice, boundaries, and pillar files provide durable
  context.
- Needs and source material become evaluated Topics rather than immediate
  drafts.
- Brief, draft, editor, rubric, run, and feedback stages make review and
  publishing decisions explicit.
- Product and recommendation libraries keep owned-offer facts separate from
  audience demand and third-party research.
- The CLI can initialize, validate, build, serve, and detect local engines.

## Installation

The CLI and local Content Engine are free to install:

```bash
curl -fsSL https://easysociable.com/install.sh | bash
easysociable install --skills content,template,slideshow --yes
easysociable engine init --root /workspace --yes
```

The installer requires Node.js 20 or newer. The Content Engine workbench also
requires `python3`. The default CLI skill set currently includes Template and
Slideshow; the `content` skill is enabled explicitly above.

## Pricing and entitlements

Content Engine and its CLI installation path are free to install. This entry
does not claim paid hosted features, managed storage, or a hosted LLM.

## Proof

No customer proof, adoption metrics, or performance improvements are recorded.

## Boundaries

- Content Engine owns local content knowledge, editorial workflow, and
  production tracking.
- EasySociable is a separate visual production layer for branded templates,
  slideshow runs, Studio review, and PNG download.
- The Agent remains responsible for reasoning, content judgment, and supplied
  evidence.
- The system does not guarantee that generated content is correct, useful, or
  successful.

## Claims

### Safe to say

- Install the CLI from the public installer or npm package.
- Initialize a local Content Engine with `easysociable engine init`.
- Use local files to preserve profile, audience, needs, topics, briefs, and
  feedback.
- Validate and serve the engine through CLI commands.

### Say carefully

- “One-command install” refers to installing the CLI; enabling the Content
  skill and initializing the engine are additional CLI commands.
- “Free” refers to the local Content Engine and CLI installation path, not to
  hosted EasySociable plans or hosted usage.
- “Gets better” means decisions and feedback persist for the next run; it does
  not mean the Agent learns autonomously from every review.

### Do not say

- “AI writes and publishes everything automatically.”
- “The Content Engine guarantees better performance.”
- “Obsidian is required.”
- “The hosted EasySociable app is the Content Engine.”

## CTA

- `educate`: explain why content needs durable decisions before generation.
- `invite`: install the CLI and initialize a local engine.
- `mention`: show how a Topic, Brief, or review gate survives into the next
  run.

## Version notes

- 2026-09-16: Added as the local-first Content Engine product.
