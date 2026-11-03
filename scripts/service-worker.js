/* Only public build assets and the client-only training shell are cached.
   Auth, API responses, photos, and mutation requests never enter this cache. */
const BASE = __BASE_PATH__;
const PREFIX = "pf-shell-" + encodeURIComponent(BASE) + "-";
const CACHE = PREFIX + "__BUILD_ID__";
const SHELLS = ["train", "nutrition", "progress"].map((path) => BASE + path);
const ASSETS = __PRECACHE__;
const STATIC = new Set(ASSETS);
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith(PREFIX) && key !== CACHE)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith(BASE)) return;
  const path = url.pathname.replace(/\/$/, "") || "/";
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE);
        if (SHELLS.includes(path)) {
          const saved = (await cache.match(path)) || (await cache.match(BASE + "offline.html"));
          // Pages redirects directories to trailing slashes. Navigation requests
          // cannot replay a Response with redirected=true while offline.
          return saved
            ? new Response(saved.body, { status: saved.status, headers: saved.headers })
            : Response.error();
        }
        if (url.pathname === BASE || url.pathname === BASE.slice(0, -1))
          return Response.redirect(new URL(BASE + "train", self.location.origin), 302);
        return cache.match(BASE + "offline.html");
      }),
    );
    return;
  }
  if (STATIC.has(url.pathname) && !SHELLS.includes(path) && !url.search) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => (await cache.match(url.pathname)) || fetch(request)),
    );
  }
});
