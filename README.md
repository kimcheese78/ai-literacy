# AI, Explained

**Make sense of AI — all on one page.**
Live at: https://kimcheese78.github.io/ai-literacy/

One page that gives a complete beginner everything they need to understand AI:
what it is, the words people use, today's tools, and what to actually do first —
with every claim sourced, every section dated, and this public repo as the
edit history anyone can inspect.

## Why this repo is public

Trust is the whole product. Anyone can see exactly what changed, when, and why —
the opposite of an anonymous AI-generated content farm.

## Structure

```
content/en/          all content (edit these, never the HTML)
build.mjs            zero-dependency build: validates + renders site/index.html
check-links.mjs      verifies every source URL still works
templates/           page skeleton, CSS, and a tiny bit of JS
MAINTENANCE.md       update cadences + how updates are made
```

Build locally: `node build.mjs && open site/index.html` (needs only Node 20+).

## Spotted a mistake?

Please [open an issue](../../issues) — corrections make the page better, and
errors get fixed, not defended.
