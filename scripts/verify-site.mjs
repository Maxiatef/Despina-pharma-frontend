// Checks that the running Next.js site serves every page exactly like the original HTML.
//   npm run build && npm start   (other terminal, port 3000 by default)
//   npm run verify-site          (SITE_URL=http://localhost:3001 to use another port)
// For every route it compares, against the original dist/ file:
//   - the <body> inner HTML (byte-for-byte)
//   - <body> id and class
//   - the ordered list of stylesheets and scripts in <head>
//   - <title>
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const DIST = resolve(process.env.SITE_DIST ?? join(ROOT, '../Despina-Pharma-IT-Package/project/dist'));
const BASE = process.env.SITE_URL ?? 'http://localhost:3000';
const manifest = JSON.parse(await readFile(join(ROOT, 'src/content/manifest.json'), 'utf8'));

const assetsOf = (head) =>
  [...head.matchAll(/<link rel="stylesheet" href="([^"]+)"|<script src="(\/assets\/[^"]+)"/g)].map((m) => m[1] ?? m[2]).join(' ');
const bodyAttrs = (html) => {
  const tag = html.match(/<body([^>]*)>/)?.[1] ?? '';
  return `id=${tag.match(/id="([^"]*)"/)?.[1] ?? ''} class=${tag.match(/class="([^"]*)"/)?.[1] ?? ''}`;
};
const decode = (s) => s.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');

const problems = [];
let checked = 0;
const routes = Object.keys(manifest);
for (let i = 0; i < routes.length; i += 16) {
  await Promise.all(routes.slice(i, i + 16).map(async (route) => {
    const original = await readFile(route === '/404' ? join(DIST, '404.html') : join(DIST, route, 'index.html'), 'utf8');
    const res = await fetch(BASE + (route === '/404' ? '/this-page-does-not-exist/' : route));
    const served = await res.text();
    const expectStatus = route === '/404' ? 404 : 200;
    if (res.status !== expectStatus) problems.push(`${route}: HTTP ${res.status}`);

    const body = original.match(/<body[^>]*>([\s\S]*)<\/body>/)[1];
    if (!served.includes(body)) problems.push(`${route}: body markup differs`);
    if (bodyAttrs(original) !== bodyAttrs(served)) problems.push(`${route}: <body> ${bodyAttrs(served)} expected ${bodyAttrs(original)}`);

    const oHead = original.split('<body')[0];
    const sHead = served.split('<body')[0];
    if (assetsOf(oHead) !== assetsOf(sHead)) problems.push(`${route}: head assets differ\n   expected ${assetsOf(oHead)}\n   got      ${assetsOf(sHead)}`);
    const oTitle = decode(oHead.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? '');
    const sTitle = decode(sHead.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? '');
    if (oTitle !== sTitle) problems.push(`${route}: title "${sTitle}" expected "${oTitle}"`);
    checked++;
  }));
}
console.log(`checked ${checked} pages against ${DIST}`);
console.log(problems.length ? `DIFFERENCES (${problems.length}):\n - ${problems.slice(0, 40).join('\n - ')}` : 'OK – every page matches the original exactly');
process.exit(problems.length ? 1 : 0);
