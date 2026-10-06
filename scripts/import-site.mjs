// Imports the current Despina website (the generator's dist/ output) into this Next.js app.
//
//   npm run import-site                       (default source: ../Despina-Pharma-IT-Package/project/dist)
//   SITE_DIST=/path/to/dist npm run import-site
//
// What it does – without changing a single byte of markup, CSS or JS:
//   - copies dist/assets → public/assets (styles, animation scripts, fonts, images, JSON)
//   - for every page (dist/**/index.html + 404.html) stores:
//       src/content/pages/<route>/body.html   the exact <body> inner HTML
//       src/content/manifest.json             title, description, theme colour, favicon,
//                                             <body> id/class and the ordered CSS/JS tags of <head>
import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const DIST = resolve(process.env.SITE_DIST ?? join(ROOT, '../Despina-Pharma-IT-Package/project/dist'));
const OUT_PAGES = join(ROOT, 'src/content/pages');
const OUT_MANIFEST = join(ROOT, 'src/content/manifest.json');
const OUT_ASSETS = join(ROOT, 'public/assets');

const decode = (s) =>
  s.replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const attr = (tag, name) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'assets') out.push(...(await walk(p))); }
    else if (e.name === 'index.html' || (dir === DIST && e.name === '404.html')) out.push(p);
  }
  return out;
}

function parse(html, file) {
  // 404.html has no <head> element: its head tags sit directly between <html> and <body>.
  const head = html.match(/<head>([\s\S]*?)<\/head>/)?.[1] ?? html.match(/<html[^>]*>([\s\S]*?)<body/)?.[1];
  const bodyTag = html.match(/<body([^>]*)>/);
  const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/)?.[1];
  if (!head || !bodyTag || body === undefined) throw new Error(`Unexpected HTML structure in ${file}`);

  // Ordered stylesheet + script tags exactly as they appear in <head>.
  const assets = [];
  for (const m of head.matchAll(/<link [^>]*rel="stylesheet"[^>]*>|<script [^>]*><\/script>/g)) {
    const tag = m[0];
    if (tag.startsWith('<link')) assets.push({ type: 'css', href: attr(tag, 'href') });
    else assets.push({ type: 'js', src: attr(tag, 'src'), defer: /\sdefer\b/.test(tag), async: /\sasync\b/.test(tag) });
  }
  const meta = (name) => head.match(new RegExp(`<meta name="${name}" content="([^"]*)"`))?.[1];
  const leftovers = head
    .replace(/<meta charset="[^"]*">|<meta name="(viewport|description|theme-color)" content="[^"]*">/g, '')
    .replace(/<title>[\s\S]*?<\/title>|<link rel="icon"[^>]*>/g, '')
    .replace(/<link [^>]*rel="stylesheet"[^>]*>|<script [^>]*><\/script>/g, '')
    .trim();
  if (leftovers) throw new Error(`Unhandled <head> content in ${file}: ${leftovers.slice(0, 200)}`);

  return {
    title: decode(head.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? ''),
    description: meta('description') ? decode(meta('description')) : null,
    themeColor: meta('theme-color') ?? null,
    icon: head.match(/<link rel="icon" type="([^"]*)" href="([^"]*)"/)?.slice(1, 3) ?? null,
    bodyId: attr(bodyTag[0], 'id') ?? null,
    bodyClass: attr(bodyTag[0], 'class') ?? null,
    assets,
    body,
  };
}

const files = await walk(DIST);
await rm(OUT_PAGES, { recursive: true, force: true });
const manifest = {};
for (const file of files.sort()) {
  const rel = relative(DIST, file).split(sep).join('/');
  const route = rel === '404.html' ? '/404' : `/${rel.replace(/(^|\/)index\.html$/, '$1')}`;
  const { body, ...page } = parse(await readFile(file, 'utf8'), rel);
  const key = route === '/' ? '_root' : route === '/404' ? '_404' : route.replace(/^\/|\/$/g, '');
  const dir = join(OUT_PAGES, key);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'body.html'), body);
  manifest[route] = { ...page, file: `${key}/body.html` };
}
await writeFile(OUT_MANIFEST, JSON.stringify(manifest));

await rm(OUT_ASSETS, { recursive: true, force: true });
await cp(join(DIST, 'assets'), OUT_ASSETS, { recursive: true });

const routes = Object.keys(manifest);
console.log(`Imported ${routes.length} pages (${routes.filter((r) => r.startsWith('/formulations/')).length} formulation pages) and assets from ${DIST}`);
