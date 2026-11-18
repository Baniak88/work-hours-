import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const worker = await readFile("dist/sw.js", "utf8");
const ORIGIN = "https://workhours.test";
const BASE = (process.env.WORKHOURS_BASE_PATH ?? "").replace(/\/$/, "");
const local = (path) => "dist" + decodeURIComponent(path.slice(BASE.length));
function runtime(failure = "") {
  const listeners = new Map(),
    stores = new Map();
  let online = true,
    claimed = false;
  class AppRequest extends Request {
    constructor(url, options) {
      super(new URL(url, ORIGIN), options);
    }
  }
  const caches = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const data = stores.get(name);
      return {
        async put(url, response) {
          data.set(url, response.clone());
        },
        async match(url) {
          return data.get(url)?.clone();
        },
      };
    },
    async keys() {
      return [...stores.keys()];
    },
    async delete(name) {
      return stores.delete(name);
    },
  };
  vm.runInNewContext(worker, {
    URL,
    Request: AppRequest,
    caches,
    self: {
      location: { origin: ORIGIN },
      clients: {
        async claim() {
          claimed = true;
        },
      },
      addEventListener(name, callback) {
        listeners.set(name, callback);
      },
    },
    async fetch(request) {
      if (!online) throw new Error("Offline");
      const url = new URL(
        typeof request === "string" ? request : request.url,
        ORIGIN,
      );
      if (
        (["http", "redirect"].includes(failure) &&
          url.pathname === `${BASE}/index.html`) ||
        (failure === "asset-html" && url.pathname.endsWith(".ttf"))
      ) {
        const r = new Response("Sign in", {
          status: failure === "http" ? 401 : 200,
          headers: { "Content-Type": "text/html" },
        });
        if (failure === "redirect")
          Object.defineProperty(r, "redirected", { value: true });
        return r;
      }
      return new Response(await readFile(local(url.pathname)));
    },
  });
  return {
    stores,
    caches,
    get claimed() {
      return claimed;
    },
    disconnect() {
      online = false;
    },
    async lifecycle(name) {
      let promise;
      listeners.get(name)({
        waitUntil(p) {
          promise = p;
        },
      });
      await promise;
    },
    async request(path, mode = "navigate", method = "GET") {
      let promise;
      listeners.get("fetch")({
        request: { url: new URL(path, ORIGIN).href, mode, method },
        respondWith(p) {
          promise = p;
        },
      });
      return promise;
    },
  };
}
test("manifest enables iPhone home-screen installation and declares an existing icon", async () => {
  const manifest = JSON.parse(
    await readFile("dist/manifest.webmanifest", "utf8"),
  );
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.start_url, `${BASE}/`);
  assert.ok((await readFile(local(manifest.icons[0].src))).length > 0);
  const html = await readFile("dist/index.html", "utf8");
  assert.match(html, /apple-mobile-web-app-capable/);
  assert.match(html, /manifest.webmanifest/);
  assert.match(html, /register-offline.js/);
});
test("all application routes and lazy scripts remain available after disconnecting", async () => {
  const r = runtime();
  await r.lifecycle("install");
  await r.lifecycle("activate");
  assert.equal(r.claimed, true);
  r.disconnect();
  const expected = await readFile("dist/index.html", "utf8");
  for (const path of [
    "/",
    "/entries",
    "/entries/",
    "/reports",
    "/settings?from=icon",
  ]) {
    assert.equal(await (await r.request(BASE + path)).text(), expected);
  }
  const stored = [...r.stores.values()][0];
  const scripts = [...stored.keys()].filter((url) => url.endsWith(".js"));
  assert.ok(scripts.length >= 5);
  for (const script of scripts)
    assert.ok((await (await r.request(script, "cors")).text()).length > 0);
  assert.equal(await r.request("/api/private-data"), undefined);
  assert.equal(await r.request(BASE + "/", "navigate", "POST"), undefined);
  assert.equal(await r.request("https://other.example/"), undefined);
});
test("expired sign-in, HTML in place of assets or failed downloads prevent offline installation", async () => {
  for (const failure of ["http", "redirect", "asset-html"]) {
    const r = runtime(failure);
    await assert.rejects(r.lifecycle("install"), /Offline asset unavailable/);
    assert.equal(r.claimed, false);
  }
});
test("exported fonts use a public path and are available offline as binary assets", async () => {
  assert.doesNotMatch(worker, /assets\/node_modules\//);
  const r = runtime();
  await r.lifecycle("install");
  await r.lifecycle("activate");
  r.disconnect();
  const stored = [...r.stores.values()][0];
  const fonts = [...stored.keys()].filter((url) => url.endsWith(".ttf"));
  assert.ok(fonts.length > 0);
  for (const font of fonts) {
    assert.ok(font.startsWith(`${BASE}/assets/vendor/`));
    const actual = Buffer.from(
      await (await r.request(font, "cors")).arrayBuffer(),
    );
    assert.deepEqual(actual, await readFile(local(font)));
    assert.equal(actual[0], 0);
    const unescaped = await r.request(decodeURIComponent(font), "cors");
    assert.deepEqual(Buffer.from(await unescaped.arrayBuffer()), actual);
  }
});
test("activation clears obsolete app caches and preserves unrelated storage", async () => {
  const r = runtime();
  await r.caches.open("workhours-old");
  await r.caches.open("unrelated-data");
  await r.lifecycle("install");
  await r.lifecycle("activate");
  assert.equal(r.stores.has("workhours-old"), false);
  assert.equal(r.stores.has("unrelated-data"), true);
  assert.equal(r.stores.size, 2);
});
