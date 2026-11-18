import { createHash } from "node:crypto";
import {
  readdir,
  readFile,
  writeFile,
  copyFile,
  rename,
  rm,
} from "node:fs/promises";
import path from "node:path";

const root = path.resolve("dist");
const base = (process.env.WORKHOURS_BASE_PATH ?? "").replace(/\/$/, "");
if (base && !/^\/[A-Za-z0-9_-]+$/.test(base))
  throw new Error("Invalid application base path");
const appPath = (value) => `${base}${value}`;
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
// Static hosts may exclude node_modules paths, including exported fonts/images.
// Keep these runtime assets under a public path and invalidate every script URL
// because the rewritten bundles no longer match Expo's original content hashes.
const exportedAssets = path.join(root, "assets/node_modules");
let hasExportedAssets = false;
try {
  await readdir(exportedAssets);
  hasExportedAssets = true;
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
if (hasExportedAssets) {
  await rm(path.join(root, "assets/vendor"), { recursive: true, force: true });
  await rename(exportedAssets, path.join(root, "assets/vendor"));
  const scripts = (await files(path.join(root, "_expo/static/js/web")))
    .filter((f) => f.endsWith(".js"))
    .sort();
  const fingerprint = createHash("sha256").update("public-assets-v1");
  for (const f of scripts) fingerprint.update(await readFile(f));
  const prefix = `pwa-${fingerprint.digest("hex").slice(0, 12)}-`;
  const names = scripts.map((f) => [
    path.basename(f),
    prefix + path.basename(f),
  ]);
  const textFiles = (await files(root)).filter((f) =>
    /\.(js|html|json)$/.test(f),
  );
  for (const f of textFiles) {
    let text = (await readFile(f, "utf8")).replaceAll(
      "assets/node_modules/",
      "assets/vendor/",
    );
    for (const [before, after] of names) text = text.replaceAll(before, after);
    await writeFile(f, text);
  }
  for (const f of scripts)
    await rename(f, path.join(path.dirname(f), prefix + path.basename(f)));
}
await copyFile("assets/icon.png", path.join(root, "app-icon.png"));
const manifest = {
  id: appPath("/"),
  name: "Work Hours",
  short_name: "Work Hours",
  lang: "pl",
  description: "Twój osobisty zegar pracy, zmiany i zarobki. Dostępny offline.",
  start_url: appPath("/"),
  scope: appPath("/"),
  display: "standalone",
  orientation: "portrait",
  background_color: "#111214",
  theme_color: "#111214",
  icons: [
    {
      src: appPath("/app-icon.png"),
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
<meta name="theme-color" content="#111214">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Work Hours">
<link rel="manifest" href="${appPath("/manifest.webmanifest")}">
<link rel="apple-touch-icon" href="${appPath("/app-icon.png")}">
<script src="${appPath("/register-offline.js")}" defer></script>
</head>`,
);
html = html.replace(
  /(<meta name="viewport" content=")([^"]*)(")/,
  (_, start, value, end) => `${start}${value}, viewport-fit=cover${end}`,
);
html = html.replace(
  "</head>",
  `<style>html,body,#root{background:#111214}body{overscroll-behavior-y:none}button,a{-webkit-tap-highlight-color:transparent}</style></head>`,
);
await writeFile(path.join(root, "index.html"), html);
await writeFile(
  path.join(root, "register-offline.js"),
  `
if ('serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('${appPath("/sw.js")}', { updateViaCache: 'none' }).catch(() => {
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
    appPath("/") +
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
      if (!response.ok || response.redirected ||
          (!url.endsWith('.html') && response.headers.get('content-type')?.includes('text/html')))
        throw new Error('Offline asset unavailable');
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
  let decodedPath;
  try { decodedPath = decodeURIComponent(url.pathname); } catch { return; }
  const asset = ASSETS.find((path) => decodeURIComponent(path) === decodedPath);
  const appRoutes = ${JSON.stringify(["/", "/entries", "/reports", "/settings"].map((route) => appPath(route).replace(/\/$/, "") || "/"))};
  if (request.mode === 'navigate' && appRoutes.includes(url.pathname.replace(/\\/$/, '') || '/')) {
    event.respondWith(caches.open(CACHE).then(async (cache) => (await cache.match('${appPath("/index.html")}')) || fetch(request)));
  } else if (asset) {
    event.respondWith(caches.open(CACHE).then(async (cache) => (await cache.match(asset)) || fetch(request)));
  }
});
`,
);
console.log(`PWA ready: ${assets.length} offline files, ${cacheName}`);
