const CACHE = "pequenos-construtores-v57";
const ARQUIVOS = ["./", "./index.html", "./styles.css", "./dark-theme.css", "./auth-theme.css?v=20261116-3", "./app.js?v=20261116-6", "./cloud-config.js?v=20261116-1", "./cloud-sync.js?v=20261116-3", "./manifest.webmanifest", "./icon.svg", "./assets/home-pequenos-construtores.png", "./assets/logo-pequenos-construtores.png", "./assets/categoria-guardiao.png", "./assets/categoria-explorador.png", "./assets/categoria-construtor.png", "./assets/categoria-servo-fiel.png"];
self.addEventListener("install", evento => evento.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ARQUIVOS)).then(() => self.skipWaiting())));
self.addEventListener("activate", evento => evento.waitUntil(caches.keys().then(chaves => Promise.all(chaves.filter(chave => chave !== CACHE).map(chave => caches.delete(chave)))).then(() => self.clients.claim())));
self.addEventListener("fetch", evento => {
  if (evento.request.method !== "GET") return;
  evento.respondWith(caches.match(evento.request).then(guardado => guardado || fetch(evento.request).then(resposta => {
    if (new URL(evento.request.url).origin === location.origin) { const copia = resposta.clone(); caches.open(CACHE).then(cache => cache.put(evento.request, copia)); }
    return resposta;
  }).catch(() => caches.match("./index.html"))));
});
