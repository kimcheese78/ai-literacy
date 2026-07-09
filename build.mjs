#!/usr/bin/env node
// Zero-dependency static site builder for AI, Explained.
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

function validatePlatforms(platforms) {
  if (!platforms) return;
  for (const co of platforms.companies ?? []) {
    const label = `platforms company "${co.company ?? '(unnamed)'}"`;
    requireFields(co, ['company', 'products', 'sources', 'lastUpdated'], label);
    validateDate(co.lastUpdated, label);
    for (const p of co.products ?? []) requireFields(p, ['name', 'what'], `${label} product "${p.name ?? '(unnamed)'}"`);
    for (const s of co.sources ?? []) requireFields(s, ['label', 'url'], `${label} source`);
  }
}

function validateCheatsheet(cs) {
  if (!cs) return;
  requireFields(cs, ['lastUpdated', 'groups'], 'cheatsheet.json');
  validateDate(cs.lastUpdated, 'cheatsheet.json');
  for (const g of cs.groups ?? []) {
    const label = `cheatsheet group "${g.name ?? '(unnamed)'}"`;
    requireFields(g, ['name', 'tips'], label);
    for (const t of g.tips ?? []) requireFields(t, ['lead', 'body'], `${label} tip`);
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
    .replace(/==([^=]+)==/g, '<mark>$1</mark>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

// ::viz name:: on its own line embeds templates/viz/<name>.html verbatim
function loadViz(name) {
  try {
    return readFileSync(join(ROOT, 'templates', 'viz', `${name}.html`), 'utf8');
  } catch {
    errors.push(`viz "${name}": templates/viz/${name}.html not found`);
    return '';
  }
}

function markdown(src) {
  const blocks = src.split(/\n\s*\n/);
  const html = [];
  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (!lines[0]) continue;
    const viz = lines[0].match(/^::viz ([\w-]+)::$/);
    if (viz) {
      html.push(loadViz(viz[1]));
    } else if (lines.every((l) => /^[-*] /.test(l))) {
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

let chapterCounter = 0;

function sectionShell(id, title, chips, innerHtml, { kicker, takeaway } = {}) {
  const num = String(++chapterCounter).padStart(2, '0');
  const kickerHtml = kicker ? `<p class="kicker"><span class="chapter">${num}</span> ${escapeHtml(kicker)}</p>` : '';
  const takeawayHtml = takeaway ? `<p class="takeaway">${inline(takeaway)}</p>` : '';
  return `<section class="block" id="${id}">
${kickerHtml}
<div class="section-head"><h2>${escapeHtml(title)}</h2>${chips.join('')}</div>
${takeawayHtml}
${innerHtml}
</section>`;
}

function updatedChip(iso) {
  return `<span class="chip fresh">Updated ${formatDate(iso)}</span>`;
}

function renderProse(sec, extraChips = []) {
  const chips = [...extraChips, updatedChip(sec.meta.lastUpdated)];
  return sectionShell(sec.id, sec.meta.title, chips, `<div class="prose">${markdown(sec.body)}</div>`, sec.meta);
}

function renderGlossary(site, glossary) {
  const tiers = site.glossaryTiers.map((tierDef) => {
    const terms = glossary.terms.filter((t) => t.tier === tierDef.tier);
    let currentGroup = null;
    const items = terms
      .map((t) => {
        const more = t.learnMore
          ? ` <span class="more">· <a href="${t.learnMore.url}" target="_blank" rel="noopener">${escapeHtml(t.learnMore.label)}</a></span>`
          : '';
        const heading = t.group && t.group !== currentGroup ? `<h3 class="term-group">${escapeHtml(t.group)}</h3>\n` : '';
        currentGroup = t.group ?? currentGroup;
        const viz = t.viz ? `\n${loadViz(t.viz)}` : '';
        return `${heading}<div class="term" id="term-${slugify(t.term)}">
<h4>${escapeHtml(t.term)}</h4>
<p>${inline(t.definition)}${more}</p>${viz}
</div>`;
      })
      .join('\n');
    return `<details class="tier"${tierDef.openByDefault ? ' open' : ''}>
<summary>Tier ${tierDef.tier} — ${escapeHtml(tierDef.title)} <span class="count">(${terms.length} terms)</span><span class="sub">${escapeHtml(tierDef.subtitle)}</span></summary>
<div class="terms">${items}</div>
</details>`;
  });
  const intro = `<p class="prose">Every AI word you're likely to run into, in plain language. Start with Tier 1 — the other tiers can wait until you need them.</p>`;
  const extras = (glossary.viz ?? []).map(loadViz).join('\n');
  const tools = `<div class="glossary-tools"><button type="button" id="toggle-all-terms">Expand all 3 tiers</button></div>`;
  return sectionShell('glossary', 'Key terms, without the jargon', [updatedChip(glossary.lastUpdated)], intro + tiers.join('\n') + extras + tools, glossary);
}

// Fixed categorical order (validated with the dataviz palette checker); color
// follows the card's position, never gets reassigned.
const BADGE_COLORS = ['#0f8a76', '#b45309', '#a13d63', '#5b5bd6', '#2f6db3'];

function renderLandscape(landscape) {
  const cards = landscape.cards
    .map((c, i) => {
      const sources = c.sources.map((s) => `<a href="${s.url}" target="_blank" rel="noopener">${escapeHtml(s.label)}</a>`).join(' · ');
      const goodFor = (c.goodFor ?? []).map((g) => `<li>${inline(g)}</li>`).join('');
      const badge = `<span class="badge" aria-hidden="true" style="--badge:${BADGE_COLORS[i % BADGE_COLORS.length]}">${escapeHtml(c.name[0])}</span>`;
      return `<article class="card" id="tool-${slugify(c.name)}">
<div class="card-head">${badge}<h3>${escapeHtml(c.name)}</h3><span class="company">by ${escapeHtml(c.company)}</span></div>
<p class="desc">${inline(c.plainDescription)}</p>
${goodFor ? `<ul>${goodFor}</ul>` : ''}
${c.freeAccess ? `<p class="free">${inline(c.freeAccess)}</p>` : ''}
<div class="meta"><span>Checked ${formatDate(c.lastUpdated)}</span><span>Source: ${sources}</span></div>
</article>`;
    })
    .join('\n');
  const newest = landscape.cards.map((c) => c.lastUpdated).sort().at(-1);
  const intro = landscape.intro ? `<p class="prose">${inline(landscape.intro)}</p>` : '';
  const extras = (landscape.viz ?? []).map(loadViz).join('\n');
  return sectionShell('landscape', "Today's tools, in plain terms", [updatedChip(newest)], `${intro}${extras}<div class="cards">${cards}</div>`, landscape);
}

function renderPlatforms(platforms) {
  const companies = platforms.companies
    .map((co, i) => {
      const rows = co.products
        .map(
          (p) => `<div class="prow">
<span class="pname">${escapeHtml(p.name)}${p.tag ? ` <span class="ptag">${escapeHtml(p.tag)}</span>` : ''}</span>
<span class="pwhat">${inline(p.what)}</span>
</div>`
        )
        .join('\n');
      const sources = co.sources.map((s) => `<a href="${s.url}" target="_blank" rel="noopener">${escapeHtml(s.label)}</a>`).join(' · ');
      const models = co.modelsNote ? `<p class="pmodels">${inline(co.modelsNote)}</p>` : '';
      return `<details class="tier"${i === 0 ? ' open' : ''}>
<summary>${escapeHtml(co.company)} <span class="count">(${co.products.length} products)</span></summary>
<div class="terms">
${models}
${rows}
<div class="meta pmeta"><span>Checked ${formatDate(co.lastUpdated)}</span><span>Source: ${sources}</span></div>
</div>
</details>`;
    })
    .join('\n');
  const intro = platforms.intro ? `<p class="prose">${inline(platforms.intro)}</p>` : '';
  const extras = (platforms.viz ?? []).map(loadViz).join('\n');
  const newest = platforms.companies.map((c) => c.lastUpdated).sort().at(-1);
  return sectionShell('platforms', 'Same brand, different products', [updatedChip(newest)], intro + extras + companies, platforms);
}

function renderCheatsheet(cs) {
  const groups = cs.groups
    .map((g) => {
      const tips = g.tips
        .map(
          (t) => `<div class="tip">
<p class="tip-lead">${inline(t.lead)}</p>
<p class="tip-body">${inline(t.body)}</p>
</div>`
        )
        .join('\n');
      return `<div class="tip-group">
<h3 class="term-group">${escapeHtml(g.name)}</h3>
<div class="tips">${tips}</div>
</div>`;
    })
    .join('\n');
  const intro = cs.intro ? `<p class="prose">${inline(cs.intro)}</p>` : '';
  return sectionShell('cheat-sheet', 'Get more out of any AI', [updatedChip(cs.lastUpdated)], intro + groups, cs);
}

// ---------- main ----------

const site = loadJSON('site.json');
const glossary = loadJSON('glossary.json');
const landscape = loadJSON('landscape.json');
const platforms = loadJSON('platforms.json');
const cheatsheet = loadJSON('cheatsheet.json');
const sectionOrder = ['what-is-ai', 'glossary', 'landscape', 'platforms', 'how-people-use', 'cheat-sheet'];
const proseSections = Object.fromEntries(['what-is-ai', 'how-people-use'].map((n) => [n, loadSection(n)]));

if (site) requireFields(site, ['name', 'tagline', 'description', 'lang', 'nav', 'glossaryTiers', 'footer'], 'site.json');
validateGlossary(glossary);
validateLandscape(landscape);
validatePlatforms(platforms);
validateCheatsheet(cheatsheet);
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
    if (id === 'platforms') return renderPlatforms(platforms);
    if (id === 'cheat-sheet') return renderCheatsheet(cheatsheet);
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
const js = readFileSync(join(ROOT, 'templates', 'app.js'), 'utf8');

// Self-hosted fonts (OFL-licensed), inlined so the page stays one self-contained file.
function fontFace(family, file, weight) {
  const b64 = readFileSync(join(ROOT, 'templates', 'fonts', file)).toString('base64');
  return `@font-face{font-family:"${family}";font-style:normal;font-weight:${weight};font-display:swap;src:url(data:font/woff2;base64,${b64}) format("woff2")}`;
}
const css =
  fontFace('Archivo Black', 'archivo-black-latin.woff2', 400) +
  '\n' +
  readFileSync(join(ROOT, 'templates', 'styles.css'), 'utf8');

const html = template
  .replaceAll('{{LANG}}', site.lang)
  .replaceAll('{{TITLE}}', `${site.name} — ${site.tagline}`)
  .replaceAll('{{DESCRIPTION}}', escapeHtml(site.description))
  .replaceAll('{{SITE_NAME}}', escapeHtml(site.name))
  .replaceAll(
    '{{TAGLINE}}',
    site.taglineMark && site.tagline.includes(site.taglineMark)
      ? escapeHtml(site.tagline).replace(escapeHtml(site.taglineMark), `<span class="u-marker">${escapeHtml(site.taglineMark)}</span>`)
      : escapeHtml(site.tagline)
  )
  .replaceAll('{{HAND_NOTE}}', escapeHtml(site.handNote ?? ''))
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
const tipCount = cheatsheet.groups.reduce((n, g) => n + g.tips.length, 0);
console.log(
  `✓ Built site/${OUT_FILE} (${(html.length / 1024).toFixed(1)} KB, ${glossary.terms.length} glossary terms, ${landscape.cards.length} product cards, ${tipCount} cheat-sheet tips)`
);
