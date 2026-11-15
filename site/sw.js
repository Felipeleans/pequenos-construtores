const CACHE = "pequenos-construtores-v44";
const ARQUIVOS = ["./", "./index.html", "./styles.css", "./dark-theme.css", "./auth-theme.css", "./app.js", "./cloud-config.js", "./cloud-sync.js", "./manifest.webmanifest", "./icon.svg", "./assets/home-pequenos-construtores.png"];
self.addEventListener("install", evento => evento.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ARQUIVOS))));
self.addEventListener("activate", evento => evento.waitUntil(caches.keys().then(chaves => Promise.all(chaves.filter(chave => chave !== CACHE).map(chave => caches.delete(chave))))));
self.addEventListener("fetch", evento => {
  if (evento.request.method !== "GET") return;
  evento.respondWith(caches.match(evento.request).then(guardado => guardado || fetch(evento.request).then(resposta => {
    if (new URL(evento.request.url).origin === location.origin) { const copia = resposta.clone(); caches.open(CACHE).then(cache => cache.put(evento.request, copia)); }
    return resposta;
  }).catch(() => caches.match("./index.html"))));
});
