# Interview (creator profile)

Not a fourth skill. If the engine `CLAUDE.md` already has **§ Interview**, follow that section. Otherwise follow this file.

Do **not** ingest needs / quotes here. Do **not** scan the watchlist. Do **not** create a slideshow or call template/slideshow.

## Triggers

- 采访我
- 完善人设
- interview me
- who am I as a creator
- 建立 profile

## Rules

- Ask **one dimension at a time**. Persist that dimension **before** asking the next. Do not batch seven dimensions to the end.
- Resume by reading files. Skip Public handle `(fill)` (done unless the user wants a handle). Continue from the first gated empty Identity cell (Role / What I build / Point of view) or the next unfinished dimension. Do not re-ask filled Identity rows.
- Existing `voice.md` with Identity filled but no `## Experience` / `## Values`: **append those headings at the end**. Do not rewrite filled Identity rows.
- Missing `boundaries.md`: write the empty starter (headings only), then interview. **Never invent boundaries.**
- Missing `stories.md` / `expression.md`: create the starter file, mark `profile: partial`, continue.
- `audience.md` / `pillars.md` in this workflow are **drafts only** (hypothesis). Do not invent a full ICP.
- Never invent bio facts, stories, or values that the user did not say.

## Dimensions → files (8–12 questions)

| # | Dimension | Questions | Persist immediately to |
|---|-----------|-----------|------------------------|
| 1 | Identity (2) | 你对外是谁、做什么？你希望别人记住的那句 point of view 是什么？ | `voice.md` `## Identity` — Role / What I build / Point of view. Public handle MAY stay `(fill)`. |
| 2 | Experience (1–2) | 文案可以引用的 2–3 件事实（年份、角色、做过的事）。没有的就写「not claiming」。 | `voice.md` `## Experience` (append heading if missing) |
| 3 | Style (1–2) | 想听起来像谁；最讨厌的 AI 腔 / 营销腔。 | `voice.md` `## Persona` + `## Do not say` |
| 4 | Values (1) | 你一定会说 / 一定不说的主张。 Repeatable topics → `pillars.md` names later, not a copy of this table. | `voice.md` `## Values` (append heading if missing) |
| 5 | Boundaries (1) | 哪些话题、人群、承诺碰不得。 | `profiles/<id>/boundaries.md`. If the file is missing, write empty starter first, then fill. Never invent. |
| 6 | Expression (1) | 举三个你喜欢的表达、三个你看到就烦的。 | `profiles/<id>/expression.md` |
| 7 | Stories (1, skippable) | 一则你常讲、且愿意公开的故事（情境 → 选择 → 教训）。 | `profiles/<id>/stories.md` |
| 8 | Audience draft (1) | 你以为在写给谁？ Mark `status: hypothesis`. | `audience.md` Primary readers |

## Persist card (after each dimension)

```text
✅ Profile · Identity
【File】 profiles/default/voice.md
【Wrote】 Role … · POV …
【Missing】 Experience, Values, stories.md
【Next】 经历（2–3 条可引用事实）
```

### Example — boundaries file missing

```text
✅ Profile · Boundaries
【File】 profiles/default/boundaries.md
【Wrote】 empty starter (## Not covering / ## Never claim). Did not invent boundaries.
【Missing】 Not covering, Never claim
【Next】 边界（哪些话题、人群、承诺碰不得）
```

## Completion (single table — do not invent other numbers)

| Level | Condition | Behavior |
|-------|-----------|----------|
| **Hard gate** (refuse slideshow handoff / `create_run`) | Identity **only** Role / What I build / Point of view have no `(fill)` and are non-empty (Public handle and Not claiming MAY stay `(fill)` / starter copy) **and** `boundaries.md` exists with Not covering **and** Never claim both non-empty. If `needs/` exists, also `needs/_index.md` ≥ 3 `N-` rows; if `needs/` is absent, skip that count. | Refuse 出图 / PagePack handoff / `slideshows create`. List missing files. User must say **强制继续** / **force continue** to proceed. |
| **First-session goal** | Hard gate **and** Persona has at least one personalized line **and** needs **target 5** (under 5 still passes the hard gate) **and** `stories.md` may be 0–1 | Open card `profile: partial`. May 扫需求选题. Still no graphics unless forced. |
| **Complete seven dimensions** | Identity + Experience (≥2) + Values (≥3) + Persona/Do not say + `stories.md` ≥1 + `boundaries.md` + `expression.md` likes/dislikes ≥3 each + needs ≥5 | Open card `profile: complete`. Remaining gaps are draft reminders only — **not** a hard-stop on graphics. |

Experience / Values / expression are **not** the hard gate. Missing `stories.md` / `expression.md` = partial. Missing `boundaries.md` file = hard-gate fail.

## Open card

After the session (or on resume): `profile: partial | complete` from the table above.
