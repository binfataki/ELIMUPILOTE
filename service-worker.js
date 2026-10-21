const CACHE = "elimu-control-shell-v2";
const SHELL = ["./", "./index.html", "./styles.css?v=20261021-m1", "./config.js", "./app.js?v=20261021-m1", "./manifest.webmanifest", "./assets/elimu-logo.png", "./assets/icon-192.png", "./assets/icon-512.png"];

self.addEventListener("install", (event) => {
  // allSettled : un fichier manquant n'empêche plus l'installation du service worker.
  event.waitUntil(caches.open(CACHE).then((c) => Promise.allSettled(SHELL.map((u) => c.add(u)))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  const req = event.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return; // Apps Script : toujours en ligne

  // Pages : réseau d'abord, cache en secours hors connexion.
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put("./index.html", copy)); return res; }).catch(() => caches.match("./index.html")));
    return;
  }
  // Fichiers : on sert le cache tout de suite et on le met à jour en arrière-plan.
  event.respondWith(caches.open(CACHE).then(async (c) => {
    const cached = await c.match(req, { ignoreSearch: true });
    const net = fetch(req).then((res) => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => cached);
    return cached || net;
  }));
});
