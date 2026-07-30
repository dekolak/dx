// Service worker minimal pour la PWA.
// Stratégie prudente : on NE met JAMAIS en cache les routes /api/ ni les pages
// dynamiques (données machine/journal), pour éviter d'afficher des infos
// périmées après une modification. On ne cache que les assets statiques.

const CACHE = "dx-static-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // médias OVH etc. : passthrough
  if (url.pathname.startsWith("/api/")) return; // jamais de cache API

  // Assets statiques Next + icônes : cache-first.
  const isStatic = url.pathname.startsWith("/_next/static") || url.pathname.startsWith("/icons/");
  if (isStatic) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const res = await fetch(request);
        if (res.ok) cache.put(request, res.clone());
        return res;
      }),
    );
  }
  // Navigations & données : réseau direct (pas d'interception -> toujours frais).
});
