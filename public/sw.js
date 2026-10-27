/*
 * FutureRealm service worker.
 *
 * It does three things and nothing else:
 *   1. Keeps the app's own static files (scripts, styles, fonts, images) so a repeat visit on a slow connection is instant.
 *   2. Shows a plain "you are offline" page when a page cannot be fetched, instead of the browser's error.
 *   3. Stays out of the way of everything private: API calls and signed-in pages are never stored — what a person sees always comes
 *      from the server, and what they write while offline is held by the app's own outbox, not here.
 */
const VERSION = "v1";
const STATIC_CACHE = `fr-static-${VERSION}`;
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.add(OFFLINE_URL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("fr-") && key !== STATIC_CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

const isStaticAsset = (url) =>
  url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/images/") || url.hostname === "fonts.gstatic.com" || url.hostname === "fonts.googleapis.com";

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  // Private data: straight to the network, never stored.
  if (url.origin === self.location.origin && (url.pathname.startsWith("/api/") || url.pathname === "/sw.js")) return;

  if (isStaticAsset(url)) {
    // Static files are fingerprinted, so a stored copy is always right; serve it and refresh it quietly in the background.
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const stored = await cache.match(request);
        const fresh = fetch(request)
          .then((response) => {
            if (response.ok || response.type === "opaque") cache.put(request, response.clone());
            return response;
          })
          .catch(() => stored);
        return stored || fresh;
      }),
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
  }
});
