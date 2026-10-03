/* Décodeur Q-code — service worker.
   IMPORTANT : à chaque modification de l'appli, changer VERSION ici
   ET APP_VERSION dans app.js. C'est ce changement qui déclenche
   la mise à jour automatique sur les téléphones. */

const VERSION = "1.9";
const CACHE = "qcode-v" + VERSION;

const FICHIERS = [
  "./",
  "./index.html",
  "./styles.css",
  "./codes.js",
  "./app.js",
  "./jspdf.min.js",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(FICHIERS.map((f) => new Request(f, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Réseau d'abord : en ligne, toujours la dernière version.
   Hors connexion, on sert la copie mise de côté. */
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== self.location.origin) return;

  e.respondWith(
    fetch(e.request, { cache: "no-store" })
      .then((res) => {
        if (res.ok) {
          const copie = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copie)).catch(() => {});
        }
        return res;
      })
      .catch(() =>
        caches.match(e.request, { ignoreSearch: true })
          .then((hit) => hit || caches.match("./index.html"))
      )
  );
});
