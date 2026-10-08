// Crawls every page of the running site and checks that each internal link, image, stylesheet,
// script and font it references answers 200 (pages may redirect once to add the trailing slash).
// Also checks the API rewrite, the 404 status and a few security/SEO basics.
//   SITE_URL=https://despina-pharma-frontend.vercel.app node scripts/check-links.mjs
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const BASE = (process.env.SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const manifest = {
  ...JSON.parse(await readFile(join(ROOT, 'src/content/manifest.json'), 'utf8')),
  ...JSON.parse(await readFile(join(ROOT, 'src/content/extra-pages.json'), 'utf8')),
};
const routes = Object.keys(manifest).filter((r) => r !== '/404');

const problems = [];
const targets = new Map(); // url -> first page that references it
const add = (url, from) => { if (!targets.has(url)) targets.set(url, from); };

async function pool(items, size, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: size }, async () => { while (i < items.length) await fn(items[i++]); }));
}

// 1) every page: collect references
await pool(routes, 12, async (route) => {
  const res = await fetch(BASE + route);
  if (res.status !== 200) { problems.push(`${route}: HTTP ${res.status}`); return; }
  const html = await res.text();
  for (const m of html.matchAll(/\s(?:href|src|data-src|poster)="([^"#]+)(?:#[^"]*)?"/g)) {
    const raw = m[1].replace(/&amp;/g, '&');
    if (/^(mailto:|tel:|javascript:|data:|https?:\/\/(?!despina-pharma-frontend))/i.test(raw)) continue;
    const url = new URL(raw, BASE + route);
    if (url.origin !== new URL(BASE).origin) continue;
    add(url.pathname + url.search, route);
  }
  for (const m of html.matchAll(/srcset="([^"]+)"/g)) {
    for (const part of m[1].split(',')) {
      const u = part.trim().split(/\s+/)[0];
      if (u && !u.startsWith('data:')) add(new URL(u, BASE + route).pathname, route);
    }
  }
  for (const m of html.matchAll(/url\(\s*['"]?(\/[^'")]+)['"]?\s*\)/g)) add(m[1], route);
});

// 2) CSS files: their url(...) references (fonts, images)
for (const url of [...targets.keys()].filter((u) => u.endsWith('.css'))) {
  const css = await (await fetch(BASE + url)).text();
  for (const m of css.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) {
    if (m[1].startsWith('data:')) continue;
    add(new URL(m[1], BASE + url).pathname, url);
  }
}

// 3) check every referenced URL
let checked = 0;
await pool([...targets.keys()], 12, async (url) => {
  let res = await fetch(BASE + url, { redirect: 'manual' });
  if ([301, 302, 307, 308].includes(res.status)) {
    const loc = new URL(res.headers.get('location'), BASE + url);
    const viaSlash = loc.pathname === new URL(BASE + url).pathname + '/';
    if (!viaSlash) problems.push(`${url} (from ${targets.get(url)}): redirects to ${loc.pathname}`);
    res = await fetch(loc);
  }
  if (res.status !== 200) problems.push(`${url} (from ${targets.get(url)}): HTTP ${res.status}`);
  checked++;
});

// 4) basics
const nf = await fetch(BASE + '/no-such-page-xyz/');
if (nf.status !== 404) problems.push(`missing page returns ${nf.status}, expected 404`);
const health = await fetch(BASE + '/api/health');
if (health.status !== 200) problems.push(`/api/health through the site: HTTP ${health.status}`);
const home = await fetch(BASE + '/');
const h = Object.fromEntries(home.headers);
const info = [];
for (const k of ['strict-transport-security', 'x-content-type-options', 'content-security-policy', 'x-frame-options', 'referrer-policy']) {
  if (!h[k]) info.push(`homepage has no ${k} header`);
}
for (const p of ['/robots.txt', '/sitemap.xml']) {
  const r = await fetch(BASE + p);
  if (r.status !== 200) info.push(`${p}: HTTP ${r.status}`);
}
const homeHtml = await home.text();
if (!/rel="canonical"/.test(homeHtml)) info.push('no canonical link on the homepage');
for (const p of ['/login/', '/portal/', '/admin/']) {
  const html = await (await fetch(BASE + p)).text();
  if (!/noindex/.test(html)) info.push(`${p} is not marked noindex`);
}

console.log(`pages: ${routes.length}, unique referenced URLs checked: ${checked}`);
console.log(problems.length ? `PROBLEMS (${problems.length}):\n - ${problems.slice(0, 60).join('\n - ')}` : 'OK – every page and every referenced file loads');
if (info.length) console.log(`NOTES:\n - ${info.join('\n - ')}`);
process.exit(problems.length ? 1 : 0);
