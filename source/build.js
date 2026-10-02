// Builds three outputs from src/ + data/:
//   dist/artifact.html      page body for the claude.ai Artifact (no <html>/<head> wrapper)
//   dist/Sip-and-Sail.html  one self-contained file that runs offline in any browser
//   dist/web/               the same app plus manifest + service worker, for hosting as an installable PWA
const fs = require('fs');
const path = require('path');
const R = p => fs.readFileSync(path.join(__dirname, p), 'utf8');
const B64 = p => fs.readFileSync(path.join(__dirname, p)).toString('base64');
const dataDir = path.join(__dirname, 'data');
const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.txt')).sort();
const strip = t => t.split('\n').filter(l => l.trim() && !l.trim().startsWith('#')).join('\n');
const ingText = strip(R('data/00-ingredients.txt'));
const recipeText = strip(files.filter(f => !/^(00|90)/.test(f)).map(f => R('data/' + f)).join('\n'));
const listText = strip(R('data/90-lists.txt'));

// validate before building
const core = require('./src/core.js');
const parsed = core.parseData(ingText, recipeText, listText);
if (parsed.errors.length) { console.error(parsed.errors.join('\n')); process.exit(1); }
const N = parsed.recipes.length;

const fonts = `@font-face{font-family:"Limelight";font-style:normal;font-weight:400;font-display:swap;src:url(data:font/woff2;base64,${B64('fonts/Limelight.woff2')}) format("woff2")}
@font-face{font-family:"Josefin Sans";font-style:normal;font-weight:600;font-display:swap;src:url(data:font/woff2;base64,${B64('fonts/Josefin-Sans-wght-600.woff2')}) format("woff2")}`;
const css = R('src/style.css');
const body = R('src/body.html');
const scripts = `<script type="text/plain" id="ing-data">\n${ingText}\n</script>
<script type="text/plain" id="recipe-data">\n${recipeText}\n</script>
<script type="text/plain" id="list-data">\n${listText}\n</script>
<script>window.SIPSAIL_URL = ${JSON.stringify(process.env.SITE_URL || '')};</script>
<script>\n${R('src/core.js')}\n</script>
<script>\n${R('src/app.js')}\n</script>`;
for (const bad of ['</script', '<!--']) {
  if ([ingText, recipeText, listText].some(t => t.includes(bad))) throw new Error('data contains ' + bad);
}
const title = 'Sip &amp; Sail';
const desc = `Offline cruise drink companion: ${N} whiskey-free recipes, ingredient filters, a mood quiz, Surprise Me and bartender cards.`;
const reset = ':root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}[hidden]{display:none!important}img{max-width:100%}';

const artifact = `<title>${title}</title>
<style>
${fonts}
${css}
</style>
${body}
${scripts}
`;

function fullDoc({ web, icons }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${title}</title>
<meta name="description" content="${desc}">
<meta name="theme-color" content="#0f2d44">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Sip &amp; Sail">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<link rel="icon" type="image/png" href="${icons.favicon}">
<link rel="apple-touch-icon" href="${icons.apple}">
${web ? '<link rel="manifest" href="manifest.webmanifest">\n' : ''}<style>
${reset}
${fonts}
${css}
</style>
</head>
<body>
${body}
${scripts}
</body>
</html>
`;
}

const dist = path.join(__dirname, 'dist');
fs.mkdirSync(path.join(dist, 'web'), { recursive: true });
const iconB64 = n => fs.existsSync(path.join(dist, 'web', n)) ? 'data:image/png;base64,' + fs.readFileSync(path.join(dist, 'web', n)).toString('base64') : '';
fs.writeFileSync(path.join(dist, 'artifact.html'), artifact);
fs.writeFileSync(path.join(dist, 'Sip-and-Sail.html'), fullDoc({ web: false, icons: { favicon: iconB64('favicon-32.png'), apple: iconB64('apple-touch-icon.png') } }));
fs.writeFileSync(path.join(dist, 'web', 'index.html'), fullDoc({ web: true, icons: { favicon: 'favicon-32.png', apple: 'apple-touch-icon.png' } }));
const version = require('crypto').createHash('sha1').update(artifact).digest('hex').slice(0, 10);
fs.writeFileSync(path.join(dist, 'web', 'sw.js'), `// Sip & Sail offline cache. Cache-first, refreshed in the background when online.
const CACHE = 'sipsail-${version}';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png', './favicon-32.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('sipsail-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const key = req.mode === 'navigate' ? './index.html' : req;
  e.respondWith(caches.open(CACHE).then(async cache => {
    const hit = await cache.match(key, { ignoreSearch: true });
    const net = fetch(req).then(res => { if (res && res.ok) cache.put(key, res.clone()); return res; }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    return (await net) || new Response('Offline and not cached yet.', { status: 503, headers: { 'Content-Type': 'text/plain' } });
  }));
});
`);
fs.writeFileSync(path.join(dist, 'web', 'manifest.webmanifest'), JSON.stringify({
  name: 'Sip & Sail', short_name: 'Sip & Sail', description: desc,
  start_url: './', scope: './', display: 'standalone', orientation: 'portrait',
  background_color: '#07131c', theme_color: '#0f2d44',
  icons: [
    { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
  ]
}, null, 2));
const kb = f => (fs.statSync(path.join(dist, f)).size / 1024).toFixed(0) + ' KB';
console.log(`built ${N} recipes · artifact ${kb('artifact.html')} · standalone ${kb('Sip-and-Sail.html')} · web/index ${kb('web/index.html')} · sw ${version}`);
