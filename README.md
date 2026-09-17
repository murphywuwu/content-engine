# Content Engine

Content Engine is a local-first content system for AI-native creators.

It helps an Agent turn real audience signals into a repeatable publishing
workflow:

**Profile → Needs → Topics → Runs → feedback**

The system is intentionally local. Your profile, audience language, decisions,
drafts, and feedback live in Markdown files that you control. The Agent reads
the engine rules and writes to this folder; you do not need to learn the
folder structure before getting started.

![Content Engine observatory](./assets/content-engine-observatory.png)

## Install and start

There are only three things to do.

### 1. Clone the Content Engine

```bash
git clone https://github.com/murphywuwu/content-engine.git
cd content-engine
```

This folder is your local Content Engine. Keep it private if it contains your
profile, audience research, drafts, or other private knowledge.

### 2. Install the EasySociable CLI and `easysociable-content` skill

Install the EasySociable CLI first, then install the Content skill:

```bash
curl -fsSL https://easysociable.com/install.sh | bash
easysociable install --skills content --yes
```

The first command installs the `easysociable` tool. The second installs the
`easysociable-content` skill for your Agent. The skill explains how to operate
the engine; `CLAUDE.md` in this folder remains the source of truth for this
specific engine.

You do not need to install Node.js packages, Python packages, a database, or a
separate workbench. The Agent handles the workbench when it is useful.

### 3. Tell your Agent what you want to do

Open the cloned folder in your Agent and describe your goal. The Agent should
follow `easysociable-content` and this engine's `CLAUDE.md`, ask for missing
information, and show you what it will save before making important writes.

Start with one of the scenarios below.

## Choose a starting scenario

### Scenario A: Set up my creator profile

Use this when the Agent does not yet know who you are, who you serve, or what
you can credibly talk about.

```text
Interview me and set up my Content Engine profile.
Ask about my audience, experience, point of view, content pillars,
publishing platforms, voice, and boundaries. Save the answers only after
showing me the proposed profile files.
```

The Agent should establish the profile before producing serious drafts. It
must not invent biography, experience, values, proof, or boundaries.

### Scenario B: Record audience needs

Use this when you have customer interviews, comments, support messages,
community discussions, or other direct audience language.

```text
I want to record audience needs.
I will paste the original quotes and context. Preserve the quotes verbatim,
separate my interpretation from the quote, and show me the Needs entries
before saving them.
```

Needs are evidence, not rewritten content ideas. The Agent must not turn a
product claim, headline, or imagined pain into an audience quote.

### Scenario C: Turn needs into topics

Use this after you have captured one or more Needs.

```text
Review the captured Needs and propose up to five content Topics.
For each Topic, explain which Need supports it, who it is for, the core
judgment, the intended belief change, and the evidence gap. Do not write a
Run yet.
```

Review and choose a Topic before opening a production Run. A Topic is a
decision about what is worth saying; it is not yet a platform draft.

### Scenario D: Open a content Run

Use this when you have chosen a Topic and want to create platform-specific
content.

```text
Open a Run from <topic id>.
First ask me which platform or platforms to use. Create one Run per platform,
confirm the selected profile and platform rules, then guide me through the
draft and review stages.
```

The Agent must ask for the platform instead of silently choosing one. A
multi-platform request creates separate Runs because each platform has
different craft rules.

### Scenario E: Capture a source or idea

Use this when you want to save a link, competitor example, research note, or
unfinished idea for later.

```text
Capture this source for later:
<paste the link, notes, or idea>

Keep it as a Capture. Do not turn it into a Need, Topic, or finished draft
unless I ask.
```

Capture preserves a source without pretending that it already contains
audience demand or a publishing decision.

### Scenario F: Record feedback after publishing

Use this after a post has shipped.

```text
Record this published post and its feedback:
<paste the URL, result, comments, or observations>

Link it to the relevant Run and show me what reusable learning should be
updated, without inventing metrics.
```

Published content and feedback close the loop. They should improve future
decisions, not be mistaken for proof that every related Topic will work.

## The operating model

The engine keeps five decisions separate:

1. **Profile** — who is speaking and what they can credibly say.
2. **Needs** — what the audience actually said or repeatedly showed.
3. **Topics** — which opportunity deserves a clear point of view.
4. **Runs** — how one Topic becomes content for one platform.
5. **Feedback** — what happened after publishing and what should be learned.

This separation is the reason the Agent asks questions before writing. It
prevents a plausible draft from being mistaken for evidence, strategy, or
published learning.

## Core and private vault

By default, this folder is both the engine core and your private vault:
`engine.json` uses `"vault_root": "."`.

| Part | Contains | Update policy |
| --- | --- | --- |
| Core | `CLAUDE.md`, rules, templates, indexes, and workbench code | Update from this repository |
| Vault | Your profile, Needs, Topics, Runs, and published records | Keep private and back up |

If you want reusable engine rules separate from private data, point
`vault_root` in `engine.json` to another directory. See
[LAYOUT.md](./LAYOUT.md).

## If you already have an engine folder

If an existing folder contains both rules and private data, split it with:

```bash
python3 scripts/migrate-split-vault.py \
  --engine "/path/to/Content Engine" \
  --yes
```

## License

MIT — see [LICENSE](./LICENSE).
