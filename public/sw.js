// Service worker: netwerk eerst, cache als vangnet.
// Doel: het bord (een Pi aan een tv) blijft werken als de server wegvalt, ook na een
// herstart. Alles wat het bord nodig heeft wordt gecachet: pagina, stijlen, font,
// renderlogica, de laatste API-antwoorden en de laatste afbeelding.
const CACHE_NAME = "liturgie-cache-v4";

const PRECACHE = [
  "/",
  "/bord/",
  "/liturgie/",
  "/styles.css",
  "/liturgie-render.js",
  "/fonts/urbanist-latin.woff2",
  "/fonts/urbanist-latin-ext.woff2",
  "/icon.svg",
  "/manifest.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => Promise.allSettled(PRECACHE.map((url) => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

// Cache-sleutel zonder querystring, zodat "?t=123" varianten dezelfde cache raken.
function cacheKey(url) {
  return url.origin + url.pathname;
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const meedoen =
    event.request.method === "GET" &&
    url.origin === self.location.origin &&
    url.pathname !== "/api/events"; // SSE-stream nooit onderscheppen
  if (!meedoen) return;

  const key = cacheKey(url);

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(key, copy));
        }
        return response;
      })
      .catch(() =>
        caches.match(key).then((cached) => cached || Response.error())
      )
  );
});
