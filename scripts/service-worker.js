/* Only public build assets and explicitly listed client-only shells are cached.
   Auth, API responses, photos, and mutation requests never enter this cache. */
const BASE = __BASE_PATH__;
const PREFIX = "pf-shell-" + encodeURIComponent(BASE) + "-";
const CACHE = PREFIX + "__BUILD_ID__";
const SHELLS = ["train", "today", "nutrition", "progress", "profile"].map((path) => BASE + path);
const ASSETS = __PRECACHE__;
const STATIC = new Set(ASSETS);
const cachedResponse = (path) => caches.match(path, { cacheName: CACHE }).catch(() => undefined);
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
      (async () => {
        if (SHELLS.includes(path)) {
          // Keep the shell and its assets on the controlling worker's build
          // while a newer worker waits for the existing clients to close.
          const saved = await cachedResponse(path);
          // Pages redirects directories to trailing slashes. Navigation requests
          // cannot replay a Response with redirected=true while offline.
          if (saved)
            return new Response(saved.body, { status: saved.status, headers: saved.headers });
        }
        try {
          return await fetch(request);
        } catch {
          if (url.pathname === BASE || url.pathname === BASE.slice(0, -1))
            return Response.redirect(new URL(BASE + "train", self.location.origin), 302);
          return (await cachedResponse(BASE + "offline.html")) || Response.error();
        }
      })(),
    );
    return;
  }
  if (STATIC.has(url.pathname) && !SHELLS.includes(path) && !url.search) {
    event.respondWith(cachedResponse(url.pathname).then((response) => response || fetch(request)));
  }
});
