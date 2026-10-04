/* Décodeur Q-code — service worker.
   IMPORTANT : à chaque modification de l'appli, changer VERSION ici
   ET APP_VERSION dans app.js. C'est ce changement qui déclenche
   la mise à jour automatique sur les téléphones. */

const VERSION = "2.5";
const CACHE = "qcode-v" + VERSION;
const CACHE_TUILES = "qcode-tuiles"; // conservé d'une version à l'autre
const TUILES = ["tile.openstreetmap.org", "nwy-tiles-api.prod.newaydata.com"];
let compteurTuiles = 0;
function limiterTuiles(c) {
  if (++compteurTuiles % 50) return;           // on ne vérifie que de temps en temps
  c.keys().then((k) => { if (k.length > 3000) k.slice(0, k.length - 3000).forEach((r) => c.delete(r)); });
}

const FICHIERS = [
  "./",
  "./index.html",
  "./styles.css",
  "./codes.js",
  "./app.js",
  "./carte.js",
  "./leaflet.js",
  "./aerodromes.js",
  "./leaflet.css",
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
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== CACHE_TUILES).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Réseau d'abord : en ligne, toujours la dernière version.
   Hors connexion, on sert la copie mise de côté. */
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method === "GET" && TUILES.includes(url.hostname)) {
    e.respondWith(
      caches.open(CACHE_TUILES).then((c) =>
        c.match(e.request).then((hit) => {
          const reseau = fetch(e.request).then((res) => {
            if (res && (res.ok || res.type === "opaque")) { c.put(e.request, res.clone()); limiterTuiles(c); }
            return res;
          }).catch(() => hit);
          return hit || reseau;
        })
      )
    );
    return;
  }
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
