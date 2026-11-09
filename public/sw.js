/* Showliana service worker.
   - The app page is network-first, so updates arrive when online, and falls
     back to the cached copy offline.
   - Next.js build assets (/_next/static) are content-hashed: cache-first.
   - Everything else the app uses (icons, manifest, fonts): stale-while-revalidate.
   Bump VERSION to drop old caches. */
const VERSION = "showliana-v1";
const APP_URL = "/";
const PRECACHE = [
  APP_URL,
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
  "/icon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((c) => Promise.all(PRECACHE.map((u) => c.add(u).catch(() => undefined))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("showliana-") && k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// The page tells us which files it loaded before the worker was in control.
self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type !== "cache-urls" || !Array.isArray(data.urls)) return;
  event.waitUntil(
    caches.open(VERSION).then((c) =>
      Promise.all(
        data.urls
          .filter((u) => typeof u === "string")
          .map((u) => new URL(u, self.location.origin))
          .filter((u) => u.origin === self.location.origin)
          .map((u) =>
            c.match(u.href).then((hit) => hit || c.add(u.href).catch(() => undefined)),
          ),
      ),
    ),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.searchParams.has("_rsc") || req.headers.get("RSC")) return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(APP_URL, copy));
          }
          return res;
        })
        .catch(() =>
          caches.open(VERSION).then((c) => c.match(APP_URL)).then((r) => r || Response.error()),
        ),
    );
    return;
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(VERSION).then((c) =>
        c.match(req).then(
          (hit) =>
            hit ||
            fetch(req).then((res) => {
              if (res.ok) c.put(req, res.clone());
              return res;
            }),
        ),
      ),
    );
    return;
  }

  if (/\.(png|svg|ico|webmanifest)$/.test(url.pathname)) {
    event.respondWith(
      caches.open(VERSION).then((c) =>
        c.match(req).then((hit) => {
          const fresh = fetch(req)
            .then((res) => {
              if (res.ok) c.put(req, res.clone());
              return res;
            })
            .catch(() => hit);
          return hit || fresh;
        }),
      ),
    );
  }
});
