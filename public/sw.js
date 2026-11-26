/*
 * FutureRealm service worker.
 *
 * It does four things and nothing else:
 *   1. Keeps the app's own static files (scripts, styles, fonts, images) so a repeat visit on a slow connection is instant.
 *   2. Shows a plain "you are offline" page when a page cannot be fetched, instead of the browser's error.
 *   3. Keeps the two pages a teacher has to be able to open with no connection — a register and a score sheet — after they have been
 *      opened once online on this device, so they open, and what is written on them is held by the app's own outbox until there is a
 *      connection. Nothing else signed-in is ever stored, API calls never are, a stored page is wiped at every sign-in and sign-out
 *      (so a shared phone never shows the last person's children), and it is not served once it is older than PAGE_TTL.
 *   4. Stays out of the way of everything else private: what a person sees always comes from the server.
 */
const VERSION = "v2";
const STATIC_CACHE = `fr-static-${VERSION}`;
const PAGES_CACHE = `fr-pages-${VERSION}`;
const OFFLINE_URL = "/offline.html";

/** The only signed-in pages kept: marking a register, and entering scores on a sheet. */
const KEPT_PAGES = [/^\/attendance\/mark(\/|$)/, /^\/score-entry-results\/enter(\/|$)/];
/** A stored page older than this is not shown: the register it holds may long since have changed. */
const PAGE_TTL = 12 * 60 * 60 * 1000;
/** A sign-in or sign-out changes who is using this device, so what was stored for the last person goes. */
const WIPES_PAGES = new Set(["/api/v1/auth/login", "/api/v1/auth/logout"]);
const keptPage = (url) => url.origin === self.location.origin && KEPT_PAGES.some((pattern) => pattern.test(url.pathname));
const pageKey = (url) => new Request(`${url.origin}${url.pathname}${url.search}`);

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.add(OFFLINE_URL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("fr-") && key !== STATIC_CACHE && key !== PAGES_CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

const isStaticAsset = (url) =>
  url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/images/") || url.hostname === "fonts.gstatic.com" || url.hostname === "fonts.googleapis.com";

self.addEventListener("message", (event) => {
  if (event.data === "fr:wipe-pages") event.waitUntil(caches.delete(PAGES_CACHE));
});

/** A kept page: the network first, so a person online always sees the school's own copy; the stored copy only when there is no network. */
async function keptPageResponse(request, url) {
  const key = pageKey(url);
  try {
    const response = await fetch(request);
    // Only a real page for this person is stored: not a redirect to sign-in, not an error, not anything that is not a page.
    if (response.ok && response.type === "basic" && !response.redirected && (response.headers.get("content-type") || "").includes("text/html")) {
      const headers = new Headers(response.headers);
      headers.set("x-fr-kept-at", String(Date.now()));
      const kept = new Response(await response.clone().blob(), { status: response.status, statusText: response.statusText, headers });
      const cache = await caches.open(PAGES_CACHE);
      await cache.put(key, kept);
    }
    return response;
  } catch (error) {
    const stored = await (await caches.open(PAGES_CACHE)).match(key, { ignoreVary: true });
    const keptAt = stored ? Number(stored.headers.get("x-fr-kept-at")) : 0;
    if (stored && keptAt && Date.now() - keptAt < PAGE_TTL) return stored;
    if (request.mode === "navigate") return (await caches.match(OFFLINE_URL)) || Response.error();
    throw error;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET") {
    if (request.method === "POST" && url.origin === self.location.origin && WIPES_PAGES.has(url.pathname)) event.waitUntil(caches.delete(PAGES_CACHE));
    return;
  }

  // A register or a score sheet: opened by going to it, or asked for by the app itself (so a page reached by tapping through is kept too).
  if (keptPage(url) && (request.mode === "navigate" || request.headers.get("x-fr-keep") === "1")) {
    event.respondWith(keptPageResponse(request, url));
    return;
  }

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
