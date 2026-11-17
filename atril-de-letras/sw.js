const CACHE = "atril-v31";
const ARCHIVOS = ["./", "index.html", "manifest.webmanifest", "icono-192.png", "icono-512.png", "icono-maskable-512.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS))); self.skipWaiting(); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== "atril-compartido" && k !== "atril-vosk" && k !== "atril-firebase").map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  // Archivo o texto que llega desde "Compartir" del teléfono: se guarda y se abre la app para cargarlo.
  if (e.request.method === "POST" && url.pathname.endsWith("/compartir")){
    e.respondWith((async () => {
      try{
        const datos = await e.request.formData();
        const c = await caches.open("atril-compartido");
        await c.delete("archivo"); await c.delete("texto");
        const f = datos.get("archivo");
        if (f && f.size){
          await c.put("archivo", new Response(f, {headers: {"Content-Type": f.type || "application/octet-stream", "X-Nombre": encodeURIComponent(f.name || "cancion")}}));
        } else {
          const t = [datos.get("title"), datos.get("text"), datos.get("url")].filter(Boolean).join("\n");
          if (t) await c.put("texto", new Response(t));
        }
      }catch(err){}
      return Response.redirect(new URL("./?compartido=1", self.registration.scope).href, 303);
    })());
    return;
  }
  // Código de Google para la cuenta: se guarda la primera vez y después abre aunque no haya señal.
  if (e.request.method === "GET" && url.host === "cdn.jsdelivr.net" && /^\/npm\/(tesseract\.js|@tesseract\.js-data)/.test(url.pathname)){
    e.respondWith(caches.open("atril-firebase").then(c => c.match(e.request).then(r => r || fetch(e.request).then(res => { if (res.ok) c.put(e.request, res.clone()); return res; }))));
    return;
  }
  if (e.request.method === "GET" && url.host === "www.gstatic.com" && url.pathname.startsWith("/firebasejs/")){
    e.respondWith(caches.open("atril-firebase").then(c => c.match(e.request).then(r => r || fetch(e.request).then(res => { if (res.ok) c.put(e.request, res.clone()); return res; }))));
    return;
  }
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  // Primero intenta la red (para recibir actualizaciones); si no hay conexión, usa la copia guardada.
  e.respondWith(
    fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(k => k.put(e.request, c)); return r; })
      .catch(() => caches.match(e.request).then(r => r || caches.match("index.html")))
  );
});
