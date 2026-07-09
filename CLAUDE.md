# AI, Explained — plain-language AI reference site

A single-page static site that explains AI to non-technical people. Its whole
value proposition is **trust**: every claim sourced, every section dated,
public edit history, one accountable curator. Nothing here may compromise that.

## How it works

- `content/en/` is the only place content lives: prose in `sections/*.md`
  (frontmatter + small markdown subset), structured data in `glossary.json`,
  `landscape.json`, `platforms.json`, `cheatsheet.json`, `site.json`.
- `node build.mjs` validates content (fails on missing `lastUpdated`/`sources`)
  and writes `site/index.html`. Zero npm dependencies — keep it that way.
- `node check-links.mjs` verifies every URL in content; 403s are warnings
  (bot-blocked), 404s/timeouts fail.
- Deploys via GitHub Actions to GitHub Pages on push to `main`.
  `site/` is gitignored; CI builds it.

## Rules when editing content

1. **Never bump `lastUpdated` without actually re-verifying the content.**
   The date is a public promise, not a cache buster.
2. New factual claims about products need a source from official docs or
   reputable press — added to `sources`, not just mentioned. `cheatsheet.json`
   is the one exception: its tips are general, evergreen usage advice, not
   product claims, so they don't need per-tip sources. Keep it that way — if
   a tip only works in one specific product, it belongs in `platforms.json`
   or `landscape.json` instead, with a source.
3. Plain language: audience has zero AI background. No term may be used before
   it's defined on the page (the glossary probably already has it — link with
   a `#term-<slug>` anchor if needed). Prefer analogies over precision.
4. The markdown subset in `build.mjs` supports: paragraphs, `**bold**`,
   `*em*`, `` `code` ``, `[links](url)`, `-`/`1.` lists, `###` headings,
   `==highlighted==` text (renders as a marker highlight — use sparingly,
   one or two per section), and `::viz name::` on its own line to embed
   `templates/viz/<name>.html` (interactive widgets/diagrams). Nothing else.
   Sections and the glossary/landscape JSON take optional `kicker` and
   `takeaway` fields (the big poster headline per section).
5. After any content change: `node build.mjs` (must pass), and
   `node check-links.mjs` if links changed.
6. Write style: short sentences, scannable from bold text alone, warm but
   never hyped. Read `MAINTENANCE.md` for cadence promises and example tasks.
