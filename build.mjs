#!/usr/bin/env node
// Zero-dependency static site builder for AI, Actually.
// Reads content/<lang>/, validates it (trust fields are mandatory), and writes site/index.html.
// Usage: node build.mjs [--lang en]

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const LANG = process.argv.includes('--lang') ? process.argv[process.argv.indexOf('--lang') + 1] : 'en';
const CONTENT = join(ROOT, 'content', LANG);
const OUT_DIR = join(ROOT, 'site');
const OUT_FILE = LANG === 'en' ? 'index.html' : join(LANG, 'index.html');

const errors = [];
const warnings = [];

// ---------- loading ----------

function loadJSON(name) {
  const path = join(CONTENT, name);
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    errors.push(`${name}: cannot read or parse (${e.message})`);
    return null;
  }
}

function loadSection(name) {
  const path = join(CONTENT, 'sections', `${name}.md`);
  let raw;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    errors.push(`sections/${name}.md: file missing`);
    return null;
  }
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) {
    errors.push(`sections/${name}.md: missing frontmatter block (--- key: value ---)`);
    return null;
  }
  const meta = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w[\w-]*):\s*(.*)$/);
    if (kv) meta[kv[1]] = kv[2].trim();
  }
  return { id: name, meta, body: m[2].trim() };
}

// ---------- validation ----------

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function requireFields(obj, fields, label) {
  for (const f of fields) {
    const v = obj?.[f];
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)) {
      errors.push(`${label}: missing required field "${f}"`);
    }
  }
}

function validateDate(value, label) {
  if (value && !ISO_DATE.test(value)) errors.push(`${label}: lastUpdated must be an ISO date (YYYY-MM-DD), got "${value}"`);
}

function validateSection(sec) {
  if (!sec) return;
  requireFields(sec.meta, ['title', 'lastUpdated'], `sections/${sec.id}.md`);
  validateDate(sec.meta.lastUpdated, `sections/${sec.id}.md`);
  if (/\[FOUNDER_NAME\]|\[FOUNDER_BIO/.test(sec.body)) {
    warnings.push(`sections/${sec.id}.md: contains [FOUNDER_NAME]/[FOUNDER_BIO] placeholder — fill in before launch`);
  }
}

function validateGlossary(glossary) {
  if (!glossary) return;
  requireFields(glossary, ['lastUpdated', 'terms'], 'glossary.json');
  validateDate(glossary.lastUpdated, 'glossary.json');
  for (const t of glossary.terms ?? []) {
    const label = `glossary term "${t.term ?? '(unnamed)'}"`;
    requireFields(t, ['term', 'tier', 'definition'], label);
    if (t.tier && ![1, 2, 3].includes(t.tier)) errors.push(`${label}: tier must be 1, 2, or 3`);
    if (t.learnMore) requireFields(t.learnMore, ['label', 'url'], `${label} learnMore`);
  }
}

function validateLandscape(landscape) {
  if (!landscape) return;
  for (const c of landscape.cards ?? []) {
    const label = `landscape card "${c.name ?? '(unnamed)'}"`;
    requireFields(c, ['name', 'company', 'plainDescription', 'sources', 'lastUpdated'], label);
    validateDate(c.lastUpdated, label);
    for (const s of c.sources ?? []) requireFields(s, ['label', 'url'], `${label} source`);
  }
}

// ---------- markdown (deliberately small subset) ----------

function escapeHtml(s) {
  return s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function inline(s) {
  return escapeHtml(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

function markdown(src) {
  const blocks = src.split(/\n\s*\n/);
  const html = [];
  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (!lines[0]) continue;
    if (lines.every((l) => /^[-*] /.test(l))) {
      html.push('<ul>' + lines.map((l) => `<li>${inline(l.slice(2))}</li>`).join('') + '</ul>');
    } else if (lines.every((l) => /^\d+\. /.test(l))) {
      html.push('<ol>' + lines.map((l) => `<li>${inline(l.replace(/^\d+\. /, ''))}</li>`).join('') + '</ol>');
    } else if (/^### /.test(lines[0])) {
      html.push(`<h3>${inline(lines[0].slice(4))}</h3>`);
    } else {
      html.push(`<p>${inline(lines.join(' '))}</p>`);
    }
  }
  return html.join('\n');
}

// ---------- rendering helpers ----------

function formatDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${months[m - 1]} ${d}, ${y}`;
}

function slugify(s) {
  return s.toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function sectionShell(id, title, chips, innerHtml) {
  return `<section class="block" id="${id}">
<div class="section-head"><h2>${escapeHtml(title)}</h2>${chips.join('')}</div>
${innerHtml}
</section>`;
}

function updatedChip(iso) {
  return `<span class="chip fresh">Updated ${formatDate(iso)}</span>`;
}

function renderProse(sec, extraChips = []) {
  const chips = [...extraChips, updatedChip(sec.meta.lastUpdated)];
  return sectionShell(sec.id, sec.meta.title, chips, `<div class="prose">${markdown(sec.body)}</div>`);
}

function renderGlossary(site, glossary) {
  const tiers = site.glossaryTiers.map((tierDef) => {
    const terms = glossary.terms.filter((t) => t.tier === tierDef.tier);
    const items = terms
      .map((t) => {
        const more = t.learnMore
          ? ` <span class="more">· <a href="${t.learnMore.url}" target="_blank" rel="noopener">${escapeHtml(t.learnMore.label)}</a></span>`
          : '';
        return `<div class="term" id="term-${slugify(t.term)}">
<h3>${escapeHtml(t.term)}</h3>
<p>${inline(t.definition)}${more}</p>
</div>`;
      })
      .join('\n');
    return `<details class="tier"${tierDef.openByDefault ? ' open' : ''}>
<summary>Tier ${tierDef.tier} — ${escapeHtml(tierDef.title)} <span class="count">(${terms.length} terms)</span><span class="sub">${escapeHtml(tierDef.subtitle)}</span></summary>
<div class="terms">${items}</div>
</details>`;
  });
  const intro = `<p class="prose">Every AI word you're likely to run into, in plain language. Start with Tier 1 — the other tiers can wait until you need them.</p>`;
  const tools = `<div class="glossary-tools"><button type="button" id="toggle-all-terms">Expand all 3 tiers</button></div>`;
  return sectionShell('glossary', 'Key terms, without the jargon', [updatedChip(glossary.lastUpdated)], intro + tiers.join('\n') + tools);
}

function renderLandscape(landscape) {
  const cards = landscape.cards
    .map((c) => {
      const sources = c.sources.map((s) => `<a href="${s.url}" target="_blank" rel="noopener">${escapeHtml(s.label)}</a>`).join(' · ');
      const goodFor = (c.goodFor ?? []).map((g) => `<li>${inline(g)}</li>`).join('');
      return `<article class="card">
<div class="card-head"><h3>${escapeHtml(c.name)}</h3><span class="company">by ${escapeHtml(c.company)}</span></div>
<p class="desc">${inline(c.plainDescription)}</p>
${goodFor ? `<ul>${goodFor}</ul>` : ''}
${c.freeAccess ? `<p class="free">${inline(c.freeAccess)}</p>` : ''}
<div class="meta"><span>Checked ${formatDate(c.lastUpdated)}</span><span>Source: ${sources}</span></div>
</article>`;
    })
    .join('\n');
  const newest = landscape.cards.map((c) => c.lastUpdated).sort().at(-1);
  const intro = landscape.intro ? `<p class="prose">${inline(landscape.intro)}</p>` : '';
  return sectionShell('landscape', "Today's tools, in plain terms", [updatedChip(newest)], `${intro}<div class="cards">${cards}</div>`);
}

// ---------- main ----------

const site = loadJSON('site.json');
const glossary = loadJSON('glossary.json');
const landscape = loadJSON('landscape.json');
const sectionOrder = ['what-is-ai', 'glossary', 'landscape', 'starter-actions', 'trust', 'go-deeper'];
const proseSections = Object.fromEntries(
  ['what-is-ai', 'starter-actions', 'trust', 'go-deeper'].map((n) => [n, loadSection(n)])
);

if (site) requireFields(site, ['name', 'tagline', 'description', 'lang', 'nav', 'glossaryTiers', 'footer'], 'site.json');
validateGlossary(glossary);
validateLandscape(landscape);
Object.values(proseSections).forEach(validateSection);

if (errors.length) {
  console.error(`\nBUILD FAILED — ${errors.length} problem(s):\n`);
  for (const e of errors) console.error(`  ✗ ${e}`);
  console.error('\nFix the content files above and rebuild.\n');
  process.exit(1);
}

const rendered = sectionOrder
  .map((id) => {
    if (id === 'glossary') return renderGlossary(site, glossary);
    if (id === 'landscape') return renderLandscape(landscape);
    const sec = proseSections[id];
    const extra = sec.meta.readingTime ? [`<span class="chip">${escapeHtml(sec.meta.readingTime)}</span>`] : [];
    return renderProse(sec, extra);
  })
  .join('\n\n');

const nav = site.nav.map((n) => `<a href="#${n.id}">${escapeHtml(n.label)}</a>`).join('\n    ');

const footerLinks = [
  site.repoUrl ? `<a href="${site.repoUrl}" target="_blank" rel="noopener">Public edit history</a>` : '',
  site.repoUrl ? `<a href="${site.repoUrl}/issues" target="_blank" rel="noopener">Report a mistake</a>` : '',
]
  .filter(Boolean)
  .join(' · ');

const template = readFileSync(join(ROOT, 'templates', 'page.html'), 'utf8');
const css = readFileSync(join(ROOT, 'templates', 'styles.css'), 'utf8');
const js = readFileSync(join(ROOT, 'templates', 'app.js'), 'utf8');

const html = template
  .replaceAll('{{LANG}}', site.lang)
  .replaceAll('{{TITLE}}', `${site.name} — ${site.tagline}`)
  .replaceAll('{{DESCRIPTION}}', escapeHtml(site.description))
  .replaceAll('{{SITE_NAME}}', escapeHtml(site.name))
  .replaceAll('{{TAGLINE}}', escapeHtml(site.tagline))
  .replaceAll('{{NAV}}', nav)
  .replaceAll('{{SECTIONS}}', rendered)
  .replaceAll('{{FOOTER_TEXT}}', escapeHtml(site.footer))
  .replaceAll('{{FOOTER_LINKS}}', footerLinks)
  .replaceAll('{{BUILD_DATE}}', new Date().toISOString().slice(0, 10))
  .replaceAll('{{CSS}}', css)
  .replaceAll('{{JS}}', js);

mkdirSync(join(OUT_DIR, dirname(OUT_FILE)), { recursive: true });
writeFileSync(join(OUT_DIR, OUT_FILE), html);

for (const w of warnings) console.warn(`  ⚠ ${w}`);
console.log(`✓ Built site/${OUT_FILE} (${(html.length / 1024).toFixed(1)} KB, ${glossary.terms.length} glossary terms, ${landscape.cards.length} product cards)`);
