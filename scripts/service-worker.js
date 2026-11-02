/* Only public build assets and the client-only training shell are cached.
   Auth, API responses, photos, and mutation requests never enter this cache. */
const CACHE = "pf-shell-__BUILD_ID__";
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
          .filter((key) => key.startsWith("pf-shell-") && key !== CACHE)
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
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE);
        if (["/train", "/nutrition", "/progress"].includes(url.pathname))
          return (await cache.match(url.pathname)) || (await cache.match("/offline.html"));
        if (url.pathname === "/")
          return Response.redirect(new URL("/train", self.location.origin), 302);
        return cache.match("/offline.html");
      }),
    );
    return;
  }
  if (
    STATIC.has(url.pathname) &&
    !["/train", "/nutrition", "/progress"].includes(url.pathname) &&
    !url.search
  ) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => (await cache.match(url.pathname)) || fetch(request)),
    );
  }
});
