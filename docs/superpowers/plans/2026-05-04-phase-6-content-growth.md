# Phase 6: SEO Content Growth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Drive organic traffic by publishing high-quality, well-structured content that targets long-tail genealogy queries: a launch article series, a programmatic cousin calculator, glossary expansion from 12 → ~200 terms, and automated internal linking that turns the site into a navigable web of related content.

**Architecture:** Phase 3 already shipped the content collection framework — `src/content/glossary/` with the markdown sources and `src/pages/glossary/[slug].astro` rendering them. Phase 6 adds two more collections (`articles` and, in passing, glossary expansion) and one programmatic page (`tools/cousin-calculator`). All static, all prerendered, no runtime cost. Internal linking is generated at build time by reading the article body for glossary-term mentions and injecting links — this avoids hand-maintaining a link map.

**Tech Stack:** Astro content collections (markdown + Zod schemas), `@astrojs/sitemap` (already integrated, picks up new pages automatically), `marked` or `remark` (already a transitive dep via Astro for the existing glossary). No new build dependencies — this is content authoring with light tooling.

**Parent Roadmap:** [`docs/ROADMAP.md`](../../ROADMAP.md) (Phase 6).

**Prerequisite:** Phase 3 (SEO infrastructure) merged — content collections, sitemap with i18n, OG image generation, llms.txt all live. Phase 4 (PWA) is recommended but not required; Phase 5 features can ship independently.

---

## Out of scope for this phase

These come later — do not attempt them in Phase 6:

- **Translating articles or glossary expansion to de/es/ru.** Initial article + glossary expansion ships English-only; the existing Astro i18n fallback serves the EN version on locale routes. Translation is a separate workstream (handle when traffic justifies it).
- **GEDCOM export.** Out of Phase 5 + 6 — log demand, ship in a future phase if asked.
- **Backlink outreach.** Off-platform marketing work; flag for separate effort.
- **Forum / community features.** Genealogy-adjacent but a different product surface; not on the roadmap.
- **A/B testing the content.** Cloudflare Web Analytics is observational only. No experiment framework.
- **Newsletter signup.** Defer until there's a recurring publishing cadence.

---

## Information you need before starting

Most of this is automatable. The manual decisions:

- **Article author voice.** Articles are user-facing long-form content, so a consistent tone matters (warm, expert-but-approachable, second person, no hype). Pick reference articles from sites you admire — Atlas Obscura, FamilySearch's own blog, Cyndi's List articles — and document the voice rules at the top of the first article PR.
- **Article cover images.** Each article needs a hero image (1200×630, will also serve as OG). Options: (a) use the per-page OG image generator from Phase 3 (free, no work, but visually generic); (b) commission or stock-source one image per article. Default: (a) for the launch series; revisit per article as content matures.
- **Glossary expansion source.** Two paths: (1) hand-author each new term against an authoritative reference (FamilySearch glossary, Genealogy.com glossary, NGS standards) — slow but correct; (2) draft from an LLM and human-review every term before commit — faster but requires editorial discipline. Pick before Task 4 starts; default: (1) for the first ~50 terms, (2) for the long tail.
- **Cousin calculator UI scope.** Task 3 builds a deterministic calculator (e.g., "5th cousin twice removed") plus an explanation page that ranks for the long-tail queries ("what is a third cousin twice removed", "first cousin once removed meaning"). Decide whether to also embed an interactive widget that takes ancestor inputs (more useful but heavier UI) or stay text-only with examples. Default: ship text + a simple two-input form ("you have N generations to common ancestor; they have M generations") that outputs the term.

If any of the above isn't decided, default to the recommendation and revisit per article/term.

---

## Branching strategy

Phase 6 is content-heavy and ships incrementally. Two patterns:

| Type | Branching | Cadence |
|------|-----------|---------|
| Framework changes (collections, schemas, link automation) | One branch per change: `feat/articles-collection`, `feat/cousin-calculator`, `feat/internal-linking` | Single PR, full review |
| Content authoring (articles, glossary terms) | Long-running branch `content/<batch-name>` OR direct PRs per article | Smaller PRs, light review focused on content quality |

For framework Tasks 1, 3, 5: single PR per task. For content authoring Tasks 2 and 4: ship in batches (e.g., "first 4 articles" PR, "next 4 glossary terms" PR) so review stays manageable.

---

## Pre-flight

- [ ] **P1: Verify Phase 3 (and ideally Phase 4) merged to main.**

```bash
test -d src/content/glossary && ls src/content/glossary/*.md | wc -l && echo "glossary OK"
test -f public/llms.txt && echo "llms.txt OK"
test -f src/pages/glossary/index.astro && echo "glossary index OK"
test -f src/pages/glossary/\[slug\].astro && echo "glossary slug OK"
npm run build && echo "build OK"
```

Expected: 12 glossary files (or more if expansion has started), all OK lines.

- [ ] **P2: Capture pre-Phase-6 content + traffic baseline.**

```bash
find src/content -name "*.md" | wc -l   # currently 12 (glossary only)
grep -c "<loc>" dist/sitemap-0.xml      # current sitemap entry count
```

Note Google Search Console pageviews on `/glossary/*` for the previous 28 days. Phase 6 success metric: organic traffic to long-tail content URLs grows month-over-month.

---

## Task 1: Article content collection scaffolding

**Why:** Articles need their own collection (separate from glossary) so they can have a different schema (cover image, author, date, tags), different URL structure (`/articles/<slug>`), and a different list page. Once scaffolded, adding articles is just dropping markdown files in.

**Files:**
- Modify: `src/content/config.ts` (add `articles` collection)
- Create: `src/content/articles/.gitkeep` (empty directory)
- Create: `src/pages/articles/index.astro` (list page)
- Create: `src/pages/articles/[slug].astro` (article page)
- Create: `src/styles/article.css` (typography for long-form reading)
- Modify: `src/components/Header.astro` and `src/components/Footer.astro` (link to `/articles`)
- Modify: `public/llms.txt` (add Articles section pointer; will populate in Task 2)

### Step 1: Schema

- [ ] **Step 1.1: Add the `articles` collection to `src/content/config.ts`.**

```typescript
const articles = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    /** Author name; defaults to "MapMyRoots Team" */
    author: z.string().default('MapMyRoots Team'),
    /** Publish date — required for sorting and Article schema */
    publishedAt: z.coerce.date(),
    /** Last-updated date — defaults to publishedAt */
    updatedAt: z.coerce.date().optional(),
    /** Tags for filtering and "related articles" */
    tags: z.array(z.string()).default([]),
    /** Optional hero image (relative to public/) */
    heroImage: z.string().optional(),
    /** Reading time in minutes; computed automatically if absent */
    readingTime: z.number().optional(),
    /** Glossary terms to link automatically in body */
    relatedGlossary: z.array(z.string()).default([])
  })
});

export const collections = { glossary, articles };
```

- [ ] **Step 1.2: Stub `src/content/articles/.gitkeep`.** Empty file; first real article comes in Task 2.

### Step 2: Article pages

- [ ] **Step 2.1: Create `src/pages/articles/index.astro` (list page).**

Lists all articles by `publishedAt` descending, with title, description, reading time, and date. Schema: `Blog` JSON-LD (or `CollectionPage`) + `BreadcrumbList`. Same visual conventions as `glossary/index.astro` for consistency.

- [ ] **Step 2.2: Create `src/pages/articles/[slug].astro` (article page).**

Renders `<Content />`. Schema: `Article` JSON-LD with `headline`, `datePublished`, `dateModified`, `author` as Organization, `image` (computed OG URL), `articleBody` (plain-text excerpt). Plus `BreadcrumbList`. Plus a "Related glossary" footer that lists each entry from `relatedGlossary` with link to `/glossary/<slug>`.

OG image: reuse the per-page OG generator from Phase 3 by adding article slugs to the OG `pages` dict (Task 5 of Phase 3, file `src/pages/og/[slug].ts`). Each new article auto-generates a per-article OG image at build time.

### Step 3: Typography

- [ ] **Step 3.1: Create `src/styles/article.css`.**

Long-form reading optimizations:
- Body line-height 1.75
- Max content width ~70ch
- `<h2>` margin-top 2.5em
- `<blockquote>` style (left border, italic)
- `<code>` and `<pre>` styles
- `<figure>` + `<figcaption>` styles for inline images

Apply via `<article class="article-body">` in `[slug].astro`.

### Step 4: Navigation

- [ ] **Step 4.1: Link to `/articles` from `Header.astro` and `Footer.astro`.**

Header: add to the desktop nav and mobile menu after Glossary. Footer: under "Resources".

### Step 5: Verify

- [ ] Build succeeds with empty `src/content/articles/`.
- [ ] `/articles` route shows an empty-state ("No articles yet — coming soon") gracefully.
- [ ] Schema validation works: dropping a malformed `.md` (missing `title`) gives a clear error at build time.

### Step 6: Commit

```bash
git add src/content/config.ts src/content/articles src/pages/articles src/styles/article.css src/components/Header.astro src/components/Footer.astro
git commit -m "feat(content): add articles content collection scaffolding"
```

---

## Task 2: Author the launch article series

**Why:** Each article targets a specific long-tail query mapped to existing genealogy search demand. Four articles is a credible "we publish" signal to Google + a real value-add to users discovering the site via search.

**Files (per article):**
- Create: `src/content/articles/<slug>.md`
- Modify: `src/pages/og/[slug].ts` (add the article slug to the OG pages dict)
- Modify: `public/llms.txt` (add a bullet under "## Articles")

### The launch series

Four articles, in priority order. Each ~1,500–2,500 words. Each has the structure:
- Hero/intro paragraph (ranking-friendly: contains the target query phrasing)
- 3–5 H2 sections
- Practical examples + a "what to do next" CTA pointing at the builder
- Footer linking 2–3 glossary terms (set via `relatedGlossary` frontmatter)

| # | Slug | Target query | Word count | Effort |
|---|------|--------------|------------|--------|
| 1 | `how-to-start-a-family-tree` | "how to start a family tree", "how to begin genealogy research" | 2,000 | 0.5 day |
| 2 | `understanding-gedcom` | "what is GEDCOM", "GEDCOM file format explained" | 1,500 | 0.5 day |
| 3 | `how-far-back-can-you-trace-ancestry` | "how far back can you trace your ancestry" | 2,000 | 0.5 day |
| 4 | `genealogy-research-checklist` | "genealogy research checklist" | 1,500 | 0.5 day |

### Per-article steps

- [ ] **Step 2.1: Author `src/content/articles/<slug>.md` with frontmatter.**

Template:
```markdown
---
title: How to Start a Family Tree
description: A practical step-by-step guide to building your first family tree — what to gather, where to start, and how to avoid common dead ends.
publishedAt: 2026-05-15
tags: [getting-started, family-history, genealogy-basics]
relatedGlossary: [family-tree, genealogy, ancestor]
---

Starting a family tree feels overwhelming, but it doesn't have to be. The work breaks into three quiet steps: write down what you already know, talk to relatives, and record what you find in a tool that won't lose it. Here's the path that works.

## Step 1: Start with yourself

The most important name on a family tree is yours. ...

## Step 2: Talk to family before it's too late

...
```

- [ ] **Step 2.2: Add the slug to `src/pages/og/[slug].ts`'s `pages` dict.**

```typescript
'how-to-start-a-family-tree.png': {
  title: 'How to Start a Family Tree',
  description: 'A practical step-by-step guide.'
}
```

- [ ] **Step 2.3: Add a bullet to `public/llms.txt` under "## Articles".**

(First article also adds the section header.)

- [ ] **Step 2.4: Verify the build emits the article + OG image.**

```bash
npm run build
test -f dist/articles/how-to-start-a-family-tree/index.html && echo OK
test -f dist/og/how-to-start-a-family-tree.png && echo OK
```

- [ ] **Step 2.5: Validate Article schema.**

Open the deployed URL in Google Rich Results Test. Confirm `Article` schema parses without warnings.

- [ ] **Step 2.6: Commit per article.**

```bash
git commit -m "content(articles): add 'How to Start a Family Tree'"
```

### Verification (after all 4)

- [ ] All 4 articles in sitemap.
- [ ] All 4 OG images generated.
- [ ] `/articles` index lists all 4 in date order.
- [ ] Each article links to its glossary terms via the related-glossary footer.

---

## Task 3: Cousin calculator tool

**Why:** "First cousin once removed" / "second cousin twice removed" is a perennial confusion. There's massive long-tail search volume around these phrases. A page with a deterministic calculator + clear explanations + worked examples ranks well and is genuinely useful.

**Files:**
- Create: `src/pages/tools/cousin-calculator.astro`
- Create: `src/features/tools/cousin-calculator.js` (deterministic calculator logic + tests)
- Create: `src/features/tools/cousin-calculator.test.js`
- Modify: `src/components/Header.astro` (optional: link to `/tools/cousin-calculator` under a Tools dropdown)
- Modify: `public/llms.txt` (add the tool URL)

### Step 1: Calculator logic

- [ ] **Step 1.1: Implement `cousin-calculator.js`.**

Inputs:
- `genA`: generations from Person A to common ancestor (e.g., A's grandparent = 2)
- `genB`: generations from Person B to common ancestor

Output: human-readable label.

```javascript
export function cousinTerm(genA, genB) {
  if (genA < 1 || genB < 1) throw new Error('Both must be ≥ 1');

  const closer = Math.min(genA, genB);
  const removed = Math.abs(genA - genB);
  const cousinDegree = closer - 1;

  if (cousinDegree === 0) {
    // genA = 1 means parent → child of common ancestor → A is a child of common ancestor
    if (removed === 0) return 'siblings';
    return removed === 1 ? 'parent and child' : `direct ancestor and descendant (${removed} generations apart)`;
  }

  const ordinals = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];
  const cousin = ordinals[cousinDegree - 1] ?? `${cousinDegree}th`;
  let term = `${cousin} cousin`;

  if (removed === 0) return term;
  if (removed === 1) return `${term} once removed`;
  if (removed === 2) return `${term} twice removed`;
  if (removed === 3) return `${term} three times removed`;
  return `${term} ${removed} times removed`;
}
```

- [ ] **Step 1.2: Test cases.**

```javascript
// In cousin-calculator.test.js
expect(cousinTerm(2, 2)).toBe('first cousin');
expect(cousinTerm(2, 3)).toBe('first cousin once removed');
expect(cousinTerm(3, 3)).toBe('second cousin');
expect(cousinTerm(3, 5)).toBe('second cousin twice removed');
expect(cousinTerm(1, 1)).toBe('siblings');
expect(cousinTerm(1, 2)).toBe('parent and child');
expect(() => cousinTerm(0, 1)).toThrow();
```

### Step 2: Page content

- [ ] **Step 2.1: Create `src/pages/tools/cousin-calculator.astro`.**

Page sections:
1. **H1 + lead paragraph** — "First cousin? Second cousin? Once removed? Here's how cousin terminology works, plus a calculator." Target the query inline.
2. **The calculator widget** — two number inputs (generations to common ancestor) + an output box. JS imports `cousinTerm` and updates the box on change. Server-side render shows a default ("first cousin") and JS hydrates.
3. **The plain-language explanation** — "Cousins share a common ancestor. The number ('first', 'second') tells you how far back. 'Removed' tells you how many generations apart you and your cousin are."
4. **Worked examples** — "Your dad's brother's daughter is your first cousin (you both share a grandparent)." 4–6 examples.
5. **The cheat-sheet table** — 5×5 grid of cousin terms.
6. **FAQ** — "Can you marry your cousin?", "What's the difference between 'second cousin once removed' and 'first cousin twice removed'?" — JSON-LD `FAQPage`.
7. **Related glossary** footer linking `ancestor`, `family-tree`, `affinity`.

JSON-LD: `BreadcrumbList`, `WebApplication` (the calculator), `FAQPage`, optionally `HowTo`.

- [ ] **Step 2.2: Inline JS for the widget.**

Vite-processed `<script>` in the .astro file:
```javascript
import { cousinTerm } from '@/features/tools/cousin-calculator.js';

const genAInput = document.getElementById('genA');
const genBInput = document.getElementById('genB');
const output = document.getElementById('cousinOutput');

function update() {
  try {
    const term = cousinTerm(parseInt(genAInput.value, 10), parseInt(genBInput.value, 10));
    output.textContent = term;
  } catch (err) {
    output.textContent = '—';
  }
}

genAInput?.addEventListener('input', update);
genBInput?.addEventListener('input', update);
update();
```

### Step 3: Verify

- [ ] **Step 3.1: Unit tests pass.**

```bash
npm test -- cousin-calculator
```

- [ ] **Step 3.2: Lighthouse on `/tools/cousin-calculator` ≥ 95 across the board.**
- [ ] **Step 3.3: Rich Results Test passes for FAQPage + WebApplication schemas.**
- [ ] **Step 3.4: Manual: try edge cases in browser** (0, negatives, very large numbers).

### Step 4: Commit

```bash
git add src/pages/tools src/features/tools tests/unit/features/tools src/components/Header.astro public/llms.txt
git commit -m "feat(tools): cousin calculator with explanation page"
```

---

## Task 4: Programmatic glossary expansion (12 → ~200)

**Why:** Each glossary entry is a long-tail SEO target. 12 → 200 terms multiplies the indexable surface area by ~16×, with most new pages targeting low-competition niche queries. The framework already exists (Phase 3) — this is content authoring.

**Files:**
- Create: ~188 new files at `src/content/glossary/<slug>.md`
- (Optionally) modify: `public/llms.txt` to mention the expansion (or auto-generate the glossary section from the collection)

### Step 1: Term list

- [ ] **Step 1.1: Build a master list of ~200 terms.**

Source: combine FamilySearch glossary, Genealogy.com glossary, NGS terminology guide, Wikipedia "Glossary of genealogy". Deduplicate. Categorize by letter.

Track in a Google Sheet or `tmp/glossary-master.csv` with columns: `slug, title, letter, status (todo/drafted/published), source URL`.

- [ ] **Step 1.2: Prioritize.**

Rank by:
- **High priority** — frequently searched + currently missing (e.g., "pedigree", "DNA test types", "haplogroup", "endogamy", "patronymic", "matrilineal", "consanguinity", "vital records", "soundex"). Target ~30 terms.
- **Medium priority** — common but less searched (e.g., "fanchart", "cluster genealogy", "FAN principle", "endogamy", "genogram"). Target ~70 terms.
- **Long tail** — niche but real (e.g., "manumission record", "passenger manifest", "mortality schedule"). Target ~100.

Ship in batches: 30 + 70 + 100.

### Step 2: Authoring template

- [ ] **Step 2.1: Document the term template.**

Each term = ~150–500 words. Frontmatter required:

```markdown
---
title: Pedigree
description: A direct line of descent — a chart or list showing a person's ancestors.
letter: P
aka: [pedigree chart, ancestor chart]
relatedTerms: [ancestor, ahnentafel, family-tree]
publishedAt: 2026-06-01
---

A pedigree is a record of a person's direct line of descent — from the individual back through their parents, grandparents, and earlier ancestors. Unlike a "family tree" which often includes siblings, cousins, and collateral relatives, a pedigree focuses strictly on the direct ancestral line.

## Etymology and history

The word comes from the Anglo-French *pé de grue* — "foot of the crane" — referring to the three-pronged shape of the lines used in early manuscript pedigrees, which resembled a bird's footprint. ...

## Pedigree charts in modern genealogy

Most genealogy software ... [keep practical, link to glossary terms via relatedTerms]
```

Body should NOT just be the description repeated — that's a thin-content red flag. Each term should add genuine context: etymology if relevant, history, examples, distinctions from related terms.

- [ ] **Step 2.2: Decide authoring path (manual vs. LLM-drafted).**

For the first 30 (high-priority) terms: hand-author using FamilySearch as primary source. Each takes ~15–25 minutes including review.

For the next 170: LLM-draft, human-review every term. Use a system prompt that includes the template and forbids hallucinated etymologies. Reviewer must verify any claimed historical fact against an authoritative source before commit.

### Step 3: Batch authoring + ship

For each batch (30 / 70 / 100):
- [ ] Branch: `content/glossary-batch-N`
- [ ] Author the markdown files
- [ ] Run `npm run check` to confirm schema validation passes for all
- [ ] `npm run build` and confirm all routes generate
- [ ] Spot-check 3 random entries for content quality and link correctness
- [ ] Commit and PR

```bash
git commit -m "content(glossary): add 30 high-priority terms (batch 1)"
```

### Step 4: Cross-link

After each batch, run a sanity pass on `relatedTerms`:
- [ ] **Step 4.1: For each new term, ensure 2–4 `relatedTerms` entries are real slugs.**
- [ ] **Step 4.2: Bidirectional check.** If term A lists B as related, B should mention A. (Optional: write a build-time validator that warns about missing back-links.)

### Step 5: Verify

After all batches merge:
- [ ] `find src/content/glossary -name "*.md" | wc -l` ≈ 200
- [ ] `/glossary` index renders all of them grouped by letter
- [ ] Sitemap has ~200 new URLs
- [ ] Random spot-check of 10 URLs in Google Rich Results Test — DefinedTerm schema passes
- [ ] Lighthouse on a sample term page ≥ 95

---

## Task 5: Automated internal linking

**Why:** Hand-maintaining glossary cross-links and article→glossary links across 200+ entries is error-prone and decays. A build-time pass that detects glossary term mentions in article + glossary bodies and auto-links them solves this and improves user navigation depth (a Google ranking signal).

**Files:**
- Create: `src/utils/internal-linker.ts` (the linker logic)
- Modify: `src/pages/articles/[slug].astro` (post-process article HTML)
- Modify: `src/pages/glossary/[slug].astro` (post-process glossary HTML)
- (Optional) Create: `src/utils/internal-linker.test.ts`

### Step 1: Linker logic

- [ ] **Step 1.1: Implement `internal-linker.ts`.**

Approach: Astro's content collections render markdown to HTML at build time. Walk the rendered HTML and replace the first occurrence of each glossary term in each `<p>` with `<a href="/glossary/<slug>">term</a>`. Skip already-linked text. Skip headings.

```typescript
import type { CollectionEntry } from 'astro:content';

export function autolinkGlossary(html: string, terms: CollectionEntry<'glossary'>[]): string {
  const sortedByLength = [...terms].sort((a, b) => b.data.title.length - a.data.title.length);
  // Sort longest-first so "first cousin once removed" wins over "first cousin"

  let result = html;
  const seen = new Set<string>();

  for (const term of sortedByLength) {
    if (seen.has(term.slug)) continue;
    const escaped = escapeRegex(term.data.title);
    // Match the term as a whole word, not inside attributes or existing links
    const regex = new RegExp(`(?<![<>=/\\w-])\\b(${escaped})\\b(?![\\w-])`, 'i');
    if (regex.test(result)) {
      result = result.replace(regex, `<a href="/glossary/${term.slug}">$1</a>`);
      seen.add(term.slug);
    }
    // Also check `aka` aliases
    for (const alias of term.data.aka ?? []) {
      const aliasEscaped = escapeRegex(alias);
      const aliasRegex = new RegExp(`(?<![<>=/\\w-])\\b(${aliasEscaped})\\b(?![\\w-])`, 'i');
      if (aliasRegex.test(result) && !seen.has(term.slug)) {
        result = result.replace(aliasRegex, `<a href="/glossary/${term.slug}">$1</a>`);
        seen.add(term.slug);
      }
    }
  }
  return result;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
```

Limit one auto-link per term per page: avoids over-linking and keeps the page readable.

- [ ] **Step 1.2: Don't auto-link inside the term's own page.**

In the slug page's frontmatter: pass an `excludeSlug` parameter to `autolinkGlossary` so the page about "ancestor" doesn't link the word "ancestor" back to itself.

### Step 2: Wire into article + glossary pages

- [ ] **Step 2.1: Edit `src/pages/articles/[slug].astro`.**

After `await article.render()`, get the rendered HTML and pass through `autolinkGlossary`. Then render via `<div set:html={linkedHtml} />` instead of `<Content />`.

- [ ] **Step 2.2: Edit `src/pages/glossary/[slug].astro`.**

Same pattern. Pass `excludeSlug={term.slug}`.

### Step 3: Tests

- [ ] **Step 3.1: Unit-test `autolinkGlossary` against fixture inputs.**

Cases:
- Plain paragraph with one matching term → linked.
- Term inside an existing `<a>` → not double-linked.
- Term inside an `<h2>` → not linked.
- Two paragraphs each containing the term → only the first is linked.
- Term as substring of a longer word → not linked (`generation` should not match `gen`).
- Alias from `aka` → linked to the canonical slug.

### Step 4: Verify

- [ ] **Step 4.1: Build, then spot-check.**

Pick 3 articles + 3 glossary entries. Open the rendered HTML. Confirm:
- Glossary terms in body are linked (first occurrence only).
- No double-linking.
- Headings have no auto-links.
- No broken links (every auto-generated href resolves).

- [ ] **Step 4.2: Lighthouse should not regress.**

Internal linking is a build-time string replace; runtime cost is zero. Confirm Lighthouse scores hold.

### Step 5: Commit

```bash
git add src/utils/internal-linker.ts tests/unit/utils/internal-linker.test.ts src/pages/articles src/pages/glossary
git commit -m "feat(seo): auto-link glossary terms in articles and glossary entries"
```

---

## Task 6: SEO performance verification

**Why:** Phase 6 ships a lot of new pages. Verify Google can crawl them, structured data validates, and Lighthouse holds at the Phase 4 thresholds.

**Files:** None modified — this is a verification-only task.

### Step 1: Build + sitemap audit

- [ ] **Step 1.1: Confirm sitemap includes everything.**

```bash
npm run build
grep -c "<loc>" dist/sitemap-0.xml
```

Expected: count = articles (~4) + glossary entries (~200) + tools (~1) + base pages = roughly 230+.

- [ ] **Step 1.2: Spot-check 5 random URLs in the sitemap.**

```bash
curl -s https://mapmyroots.com/sitemap-0.xml | grep -oE 'https://[^<]+' | shuf | head -5
```

Visit each in a browser; confirm they resolve and render correctly.

### Step 2: Structured data audit

- [ ] **Step 2.1: Spot-check 5 article URLs in Google Rich Results Test.**
- [ ] **Step 2.2: Spot-check 5 glossary URLs.**
- [ ] **Step 2.3: Validate cousin-calculator page.**

Zero errors expected on all. Warnings acceptable if non-blocking (e.g., missing optional `aggregateRating`).

### Step 3: Lighthouse-CI

- [ ] **Step 3.1: Update `lighthouserc.cjs` to include sample URLs from each new content type.**

Add to the URL list:
- `/articles`
- `/articles/how-to-start-a-family-tree`
- `/glossary/pedigree` (or another high-priority new term)
- `/tools/cousin-calculator`

- [ ] **Step 3.2: Run locally.**

```bash
npm run build
npx astro preview --port 4321 &
PREVIEW_PID=$!
sleep 3
npx lhci autorun --upload.target=temporary-public-storage 2>&1 | tee /tmp/phase6-lh.txt
kill $PREVIEW_PID
```

Expected: all 4 categories ≥ 0.95 across the new URLs.

### Step 4: Search Console verification

- [ ] **Step 4.1: Submit the updated sitemap.**

Google Search Console → Sitemaps → submit `https://mapmyroots.com/sitemap-index.xml`. (Already configured in Phase 3 — re-submit so Google re-fetches.)

- [ ] **Step 4.2: Wait 7–14 days, check coverage.**

After two weeks: Search Console → Indexing → Coverage. Expected: ~80–90% of new URLs indexed (some long-tail glossary entries may take longer; this is normal for new pages).

- [ ] **Step 4.3: Check Performance tab.**

Filter by URL containing `/articles/` or `/glossary/`. Confirm impressions are accruing (clicks lag impressions by weeks).

---

## Final verification

- [ ] **Step 1: Working tree clean across all merged content branches.**
- [ ] **Step 2: Reproducible build.**

```bash
rm -rf dist/ .astro/
npm run build
```

- [ ] **Step 3: Page count.**

```bash
find dist -name "index.html" | wc -l
```

Expected: roughly 250+ (base pages × locale fallbacks + new articles + ~200 glossary entries).

- [ ] **Step 4: Sitemap entry count.**

```bash
grep -c "<loc>" dist/sitemap-0.xml
```

Expected: roughly the same as the page count.

- [ ] **Step 5: All tests still green.**

```bash
npm test -- --run
```

- [ ] **Step 6: No regressions in existing pages.** Spot-check `/`, `/builder`, `/glossary` (existing 12 entries still link correctly).

- [ ] **Step 7: GSC submitted.** Sitemap re-submitted; first new URLs appear in coverage report.

---

## Phase 6 complete (no end state, only milestones)

Phase 6 is **ongoing** by design. The "complete" milestones:

- **Milestone 1 (1 week from start):** Article scaffolding + 4 launch articles + cousin calculator shipped. Internal linking active.
- **Milestone 2 (1 month):** First batch of 30 high-priority glossary terms shipped. Search Console shows ~50% of new URLs indexed.
- **Milestone 3 (3 months):** Full ~200-term glossary live. Internal linking covers all articles + glossary. First long-tail organic traffic showing in CWA.
- **Milestone 4 (6 months):** Articles 5–8 published (cadence ~1/month). Glossary expansion stable. SEO traffic > 1,000 organic visits/month (sanity baseline; adjust per actual GSC data).

After Milestone 4: re-evaluate the content strategy with real traffic data — which articles converted, which glossary terms drove queries, which formats failed. That informs the next phase of content (more articles? interactive tools? translation?).

---

## Self-review

**1. Spec coverage** vs. roadmap Phase 6:
- [x] Article series — Task 2 (4 launch articles + framework in Task 1)
- [x] Cousin calculator — Task 3
- [x] Programmatic glossary expansion — Task 4
- [x] Internal linking — Task 5
- [x] Backlink outreach — explicitly out of scope (off-platform)

**2. Placeholders.** No external secrets or API keys. Manual decisions documented in "Information you need before starting" — author voice, hero image strategy, glossary expansion source path.

**3. Type/path consistency.** Articles live at `src/content/articles/` matching the existing `src/content/glossary/` convention. Tools live at `src/pages/tools/<name>.astro` (new convention; documented). Internal linker is a `src/utils/` module — same as `event-bus.js`, `security-utils.js`, etc.

**4. Sequencing.**
- Task 1 (collection scaffolding) MUST land before Task 2 (articles) — articles can't exist without the collection.
- Task 5 (internal linking) can ship before, during, or after Task 4 (glossary expansion) — linking auto-discovers new terms via the collection.
- Task 3 (cousin calculator) is independent — can ship in any order.
- Task 6 (verification) is the gate after each batch.

**5. Effort distribution.** Roughly: framework Tasks 1+3+5 = 1.5 days. Authoring Tasks 2+4 = ongoing (1 day per launch article × 4 + glossary expansion as time permits, weeks to months). Verification Task 6 is a recurring 0.5-day pass after each major batch.

**6. Decay management.** The internal linker (Task 5) and the auto-generated sitemap (Phase 3) together keep maintenance cost flat as content scales. The biggest decay risk is `relatedGlossary` and `relatedTerms` cross-references becoming stale as new terms ship — Task 4 Step 4 calls out a back-link sanity pass after each batch to catch this. A future phase can automate this with a build-time validator.
