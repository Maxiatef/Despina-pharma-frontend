// Checks the alternative URLs in src/lib/route-aliases.ts.
//   npm run check-routes                          (static checks only)
//   SITE_URL=http://localhost:3000 npm run check-routes   (+ live redirects)
// Static: an alias never hides a real page, and every target is a real page.
// Live: every alias answers 308 → its target, the target answers 200, and real pages are not redirected.
import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { aliasList, normalizePath, resolveAlias } from '../src/lib/route-aliases.ts';

const ROOT = resolve(import.meta.dirname, '..');
const BASE = process.env.SITE_URL;
const manifest = JSON.parse(await readFile(join(ROOT, 'src/content/manifest.json'), 'utf8'));
const extra = JSON.parse(await readFile(join(ROOT, 'src/content/extra-pages.json'), 'utf8'));

// App pages (src/app/(app)/**/page.tsx without dynamic segments).
async function appRoutes(dir, prefix = '/') {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.isDirectory() && !e.name.startsWith('[')) out.push(...(await appRoutes(join(dir, e.name), `${prefix}${e.name}/`)));
    if (e.isFile() && e.name === 'page.tsx') out.push(prefix);
  }
  return out;
}
const pages = new Set([...Object.keys(manifest).filter((r) => r !== '/404'), ...Object.keys(extra), ...(await appRoutes(join(ROOT, 'src/app/(app)')))]);

const problems = [];
const aliases = aliasList();
for (const [alias, target] of aliases) {
  if (!pages.has(target)) problems.push(`target is not a page: ${alias} → ${target}`);
  if (pages.has(alias)) problems.push(`alias hides a real page: ${alias}`);
}
for (const page of pages) {
  if (resolveAlias(page)) problems.push(`real page would be redirected: ${page} → ${resolveAlias(page)}`);
  if (resolveAlias(page.slice(0, -1) || '/')) problems.push(`real page (no slash) would be redirected: ${page}`);
}
// Two aliases that normalise to the same key must agree.
const seen = new Map();
for (const [alias, target] of aliases) {
  const key = normalizePath(alias);
  if (seen.has(key) && seen.get(key) !== target) problems.push(`conflict: ${alias} → ${target} and ${seen.get(key)}`);
  seen.set(key, target);
}
console.log(`Static: ${aliases.length} aliases, ${pages.size} pages, ${problems.length} problem(s)`);

let live = 0;
if (BASE) {
  const variants = (a) => [a, a.slice(0, -1), a.slice(0, -1).toUpperCase(), a.replace(/-/g, '_')];
  const cases = [
    ...aliases.flatMap(([a, t]) => variants(a).map((v) => [v, t])),
    ['/Contact-Us', '/contact/'], ['/SIGN-IN', '/login/'], ['/sign_in/', '/login/'], ['/Log-In?next=/admin/', '/login/?next=/admin/'],
    ['/About-Us', '/about-us/'], ['/FAQ/', '/faq/'], ['/Formulations/Skincare/', '/formulations/skincare/'],
  ];
  for (const [path, want] of cases) {
    const res = await fetch(BASE + path, { redirect: 'manual' });
    const loc = res.headers.get('location');
    const got = loc && new URL(loc, BASE);
    const gotPath = got ? decodeURIComponent(got.pathname + got.search) : null;
    if (res.status !== 308 || gotPath !== want) {
      problems.push(`${path}: HTTP ${res.status} → ${gotPath ?? '-'} (want 308 → ${want})`);
      continue;
    }
    live++;
  }
  for (const target of new Set(aliases.map(([, t]) => t))) {
    const res = await fetch(BASE + target, { redirect: 'manual' });
    if (res.status !== 200) problems.push(`${target}: HTTP ${res.status} (want 200)`);
  }
  for (const page of ['/', '/about-us/', '/login/', '/admin/', '/portal/', '/contact/', '/sample-request/', '/formulations/skincare/']) {
    const res = await fetch(BASE + page, { redirect: 'manual' });
    if (res.status !== 200) problems.push(`real page ${page}: HTTP ${res.status} (want 200, no redirect)`);
  }
  console.log(`Live: ${live} redirects checked against ${BASE}`);
}

for (const p of problems) console.log(`  ✗ ${p}`);
console.log(problems.length ? `${problems.length} problem(s)` : 'All route checks passed');
process.exit(problems.length ? 1 : 0);
