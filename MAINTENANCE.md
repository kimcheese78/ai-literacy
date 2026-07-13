# Maintaining AI, Explained

The whole site is content files + one build script. You never edit HTML.
Updates flow through Claude Code: describe what changed, let it edit the
content files, review the diff, push.

## Update cadence (the promise made on the site)

| Section | File(s) | Cadence |
|---|---|---|
| What is AI / what it's used for | `content/en/sections/*.md` | Review quarterly |
| Key terms (glossary) | `content/en/glossary.json` | Review quarterly |
| Today's tools (landscape) | `content/en/landscape.json` | Review monthly, or when something big happens |
| The name maze (platform breakdown) | `content/en/platforms.json` | Review monthly — product lineups change fast |
| Standout features (per-platform cheat sheet) | `content/en/features.json` | Review monthly — features get renamed, sunset, or added fast |
| Cheat sheet (practical tips) | `content/en/cheatsheet.json` | Review quarterly — tips are evergreen, not product-specific |
| Trending (v1.1, not built yet) | — | Weekly once added |

Parked content (removed from the page 2026-07-06, kept for future separate
pages): `content/en/parked/` holds starter-actions, trust, and go-deeper.

**Whenever you touch a file, update its `lastUpdated` field to today's date.**
The build fails if it's missing; the date is displayed publicly, so it must be honest —
only bump it when you actually re-verified the content.

## Example Claude Code prompts

Copy, adapt, paste:

- "OpenAI just released X. Update the ChatGPT card in the landscape — verify against the official site, update `lastUpdated`, rebuild, and push."
- "Do the monthly landscape review: check each card in `content/en/landscape.json` against its source link, fix anything stale, bump the dates only where you actually re-verified, rebuild, push."
- "Add a glossary term for 'world model' in tier 2, same plain-language style as the others, with a credible learn-more link."
- "Run `node check-links.mjs` and replace any dead source links with working equivalents."
- "Quarterly review: read every prose section as a skeptical beginner and flag anything stale, jargony, or unclear before editing."
- "The next-word widget examples feel stale — refresh the canned data in `templates/viz/next-word.html` (keep the same JSON shape)."
- "Add a cheat-sheet tip about [X] under the '[category]' group in `content/en/cheatsheet.json` — same terse, bold-lead style as the others."

The interactive widgets (`templates/viz/*.html` + logic in `templates/app.js`)
run entirely on canned example data — no API calls, nothing to pay for, nothing
to break. If a widget's numbers or examples age badly, edit the JSON block at
the bottom of its viz file.

## Commands

```bash
node build.mjs          # rebuild site/index.html (validates content first)
node check-links.mjs    # verify every source URL still works
open site/index.html    # preview locally
git add -A && git commit -m "..." && git push   # deploy (GitHub Action rebuilds + publishes)
```

## Content rules (enforced by build or by discipline)

Enforced by `build.mjs` (build fails otherwise):
- Every landscape card has `sources` (≥1) and `lastUpdated`.
- Every prose section has `title` and `lastUpdated` in frontmatter.
- Every glossary term has `term`, `tier`, `definition`.

Enforced by you and Claude (the build can't check these):
- Plain language: no term used before it's defined on the page. When precision and a good analogy conflict, prefer the analogy.
- Sources are official docs or reputable outlets — never social posts, SEO farms, or rumor.
- Don't publish an explanation you couldn't defend out loud. If Claude drafts something you don't understand, ask it to explain until you do — that's the point of this project.
- Short sentences. Short paragraphs. Scannable from bold text alone.

## Adding the Korean version later

Create `content/ko/` mirroring `content/en/` (same file names, same JSON shapes),
then run `node build.mjs --lang ko` — it outputs `site/ko/index.html`.
Add the second build line to `.github/workflows/deploy.yml` when ready.
