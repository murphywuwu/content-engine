# products/

First-class **product facts library**. Products describe what the creator
offers; they are not audience needs, topics, or published claims.

| Path | Role |
|------|------|
| `_index.md` | Product registry and lifecycle |
| `entries/P-*.md` | Product facts, boundaries, pricing, proof and claims |
| `_template.md` | Product entry shape |

## Relationship to the content engine

```text
Needs (demand evidence) + Profile (identity)
  → Topic (editorial judgment)
  → optional Product fit (offer context)
  → Run
```

- A `Need` records what an audience member actually said.
- A `Product` records what is currently offered and what it does not promise.
- A `Topic` decides whether something is worth saying. It may cite zero, one, or
  several products.
- Product fit never makes a Topic `ready` by itself, and a product description
  never becomes a Need quote.

## Rules

- Keep product facts current. Prices and entitlements must include an
  `effective_from` date and a source of truth.
- Do not invent customers, outcomes, metrics, testimonials or proof.
- Mark a product `retired` instead of silently deleting a product used by a
  Topic or Run.
- Use `product_fit: none` for useful education that does not need a product
  connection. Do not force a CTA into every Topic.
- Product claims here describe the offer. The `wiki/claims/` catalog tracks
  propositions tested through published content; they are different objects.
