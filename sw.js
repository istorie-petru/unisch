// Offline support: the app has no server side, so caching its few static
// files is enough for it to work fully offline once visited.
// Strategy: stale-while-revalidate — answer from the cache instantly, refresh
// the cache from the network in the background. A new deploy therefore shows
// up on the visit after the one that downloaded it.
const CACHE = "unisch-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./site.webmanifest",
  "./favicon.ico",
  "./icons/favicon-16x16.png",
  "./icons/favicon-32x32.png",
  "./icons/apple-touch-icon.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png"
];

self.addEventListener("install", (event)=>{
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(()=> self.skipWaiting()));
});

self.addEventListener("activate", (event)=>{
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith("unisch-") && k !== CACHE).map(k => caches.delete(k))))
      .then(()=> self.clients.claim())
  );
});

self.addEventListener("fetch", (event)=>{
  const req = event.request;
  // Only same-origin GETs inside this app's folder (GitHub Pages serves every
  // project of an account from the same origin).
  const scope = new URL(self.registration.scope);
  const url = new URL(req.url);
  if(req.method !== "GET" || url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;

  event.respondWith((async ()=>{
    const cache = await caches.open(CACHE);
    const key = req.mode === "navigate" ? "./index.html" : req;
    const cached = await cache.match(key, { ignoreSearch: true });
    const network = fetch(req).then(res => {
      if(res.ok && res.type === "basic") cache.put(key, res.clone());
      return res;
    }).catch(()=> null);
    if(cached){
      event.waitUntil(network);
      return cached;
    }
    return (await network) || Response.error();
  })());
});
