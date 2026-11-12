import { createHash } from "node:crypto";
import { readdir, readFile, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve("dist");
async function files(directory) {
  const items = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    items.map((item) => {
      const filename = path.join(directory, item.name);
      return item.isDirectory() ? files(filename) : filename;
    }),
  );
  return nested.flat();
}
await copyFile("assets/icon.png", path.join(root, "app-icon.png"));
const manifest = {
  id: "/",
  name: "Work Hours",
  short_name: "Work Hours",
  lang: "pl",
  description: "Twój osobisty zegar pracy, zmiany i zarobki. Dostępny offline.",
  start_url: "/",
  scope: "/",
  display: "standalone",
  orientation: "portrait",
  background_color: "#101314",
  theme_color: "#101314",
  icons: [
    {
      src: "/app-icon.png",
      sizes: "1024x1024",
      type: "image/png",
      purpose: "any",
    },
  ],
};
await writeFile(
  path.join(root, "manifest.webmanifest"),
  JSON.stringify(manifest),
);
let html = await readFile(path.join(root, "index.html"), "utf8");
html = html.replace('<html lang="en">', '<html lang="pl">');
html = html.replace(
  "</head>",
  `
<meta name="theme-color" content="#101314">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Work Hours">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="apple-touch-icon" href="/app-icon.png">
<script src="/register-offline.js" defer></script>
</head>`,
);
html = html.replace(
  /(<meta name="viewport" content=")([^"]*)(")/,
  (_, start, value, end) => `${start}${value}, viewport-fit=cover${end}`,
);
html = html.replace(
  "</head>",
  `<style>html,body,#root{background:#101314}body{overscroll-behavior-y:none}button,a{-webkit-tap-highlight-color:transparent}</style></head>`,
);
await writeFile(path.join(root, "index.html"), html);
await writeFile(
  path.join(root, "register-offline.js"),
  `
if ('serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(() => {
      window.dispatchEvent(new Event('workhours:offline-error'));
    });
  });
}
`,
);
const assets = (await files(root)).filter(
  (f) => !f.endsWith(".map") && !f.endsWith("/sw.js"),
);
const hash = createHash("sha256");
for (const f of assets.sort()) hash.update(await readFile(f));
const cacheName = `workhours-${hash.digest("hex").slice(0, 16)}`;
const urls = assets.map(
  (f) =>
    "/" +
    path.relative(root, f).split(path.sep).map(encodeURIComponent).join("/"),
);
await writeFile(
  path.join(root, "sw.js"),
  `
const CACHE = ${JSON.stringify(cacheName)};
const ASSETS = ${JSON.stringify(urls)};
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // A failed or expired sign-in must never become the offline application.
    await Promise.all(ASSETS.map(async (url) => {
      const response = await fetch(new Request(url, { credentials: 'same-origin', cache: 'reload' }));
      if (!response.ok || response.redirected) throw new Error('Offline asset unavailable');
      await cache.put(url, response);
    }));
    // Updates activate after all previous app windows close, preserving active forms.
  })());
});
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys())
      if (name.startsWith('workhours-') && name !== CACHE) await caches.delete(name);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', (event) => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  const appRoutes = ['/', '/entries', '/reports', '/settings'];
  if (request.mode === 'navigate' && appRoutes.includes(url.pathname.replace(/\\/$/, '') || '/')) {
    event.respondWith(caches.open(CACHE).then(async (cache) => (await cache.match('/index.html')) || fetch(request)));
  } else if (ASSETS.includes(url.pathname)) {
    event.respondWith(caches.open(CACHE).then(async (cache) => (await cache.match(url.pathname)) || fetch(request)));
  }
});
`,
);
console.log(`PWA ready: ${assets.length} offline files, ${cacheName}`);
