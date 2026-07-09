#!/usr/bin/env node
// Zero-dependency link checker: collects every URL in content/ and verifies it responds.
// Exits non-zero if any link is dead, so CI catches rotted sources.
// Usage: node check-links.mjs [--lang en]

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const LANG = process.argv.includes('--lang') ? process.argv[process.argv.indexOf('--lang') + 1] : 'en';
const CONTENT = join(ROOT, 'content', LANG);

const urls = new Map(); // url -> where it came from

function collect(text, from) {
  for (const m of text.matchAll(/https?:\/\/[^\s"'\\)<>\]]+/g)) {
    const url = m[0].replace(/[.,;]+$/, '');
    if (!urls.has(url)) urls.set(url, from);
  }
}

for (const f of ['glossary.json', 'landscape.json', 'platforms.json', 'cheatsheet.json']) {
  collect(readFileSync(join(CONTENT, f), 'utf8'), f);
}
// site.json holds the site's own url/repoUrl (config, not sources) — and on the
// very first CI run those don't exist yet, so they are deliberately not checked.
for (const f of readdirSync(join(CONTENT, 'sections'))) {
  collect(readFileSync(join(CONTENT, 'sections', f), 'utf8'), `sections/${f}`);
}
// Interactive widgets can cite sources too (e.g. the hallucination game cites NASA).
const VIZ_DIR = join(ROOT, 'templates', 'viz');
for (const f of readdirSync(VIZ_DIR)) {
  collect(readFileSync(join(VIZ_DIR, f), 'utf8'), `templates/viz/${f}`);
}

const UA = 'Mozilla/5.0 (compatible; ai-actually-link-check; +https://github.com)';

async function check(url) {
  for (const method of ['HEAD', 'GET']) {
    try {
      const res = await fetch(url, {
        method,
        redirect: 'follow',
        headers: { 'user-agent': UA, accept: 'text/html,*/*' },
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) return { url, ok: true, status: res.status };
      // Some hosts reject HEAD or block bots with 403/405 — retry with GET before failing.
      if (method === 'GET') return { url, ok: false, status: res.status };
    } catch (e) {
      if (method === 'GET') return { url, ok: false, status: e.name === 'TimeoutError' ? 'timeout' : e.message };
    }
  }
}

// Sites that block non-browser clients return 401/403/429 while being perfectly
// alive in a real browser — report those as warnings, not failures.
const BOT_BLOCKED = new Set([401, 403, 405, 429]);

const results = await Promise.all([...urls.keys()].map(check));
const dead = results.filter((r) => !r.ok && !BOT_BLOCKED.has(r.status));
const blocked = results.filter((r) => !r.ok && BOT_BLOCKED.has(r.status));

console.log(`Checked ${results.length} unique URLs across content/${LANG}/`);
for (const b of blocked) console.warn(`  ⚠ ${b.status}  ${b.url}   (in ${urls.get(b.url)}) — bot-blocked, verify in a browser`);
for (const d of dead) console.error(`  ✗ ${d.status}  ${d.url}   (in ${urls.get(d.url)})`);
if (dead.length) {
  console.error(`\n${dead.length} broken link(s). Fix or replace the sources above.`);
  process.exit(1);
}
console.log('✓ All source links are alive.');
