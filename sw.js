/* PWA shell únicamente. Nunca almacena lluvia, niveles, pronóstico ni respuestas del Agente. */
const CACHE="mapa-hidromet-shell-v2";
const SHELL=["./offline.html","./styles.css","./config.js","./app.js","./manifest.webmanifest","./icons/icon-192.png","./icons/icon-512.png","./icons/icon-maskable-512.png"];
self.addEventListener("install",event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    await Promise.allSettled(SHELL.map(async url=>{const response=await fetch(url,{cache:"reload"});if(response.ok)await cache.put(url,response)}));
    await self.skipWaiting();
  })());
});
self.addEventListener("activate",event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k.startsWith("mapa-hidromet-shell-")&&k!==CACHE).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener("fetch",event=>{
  const req=event.request;
  if(req.method!=="GET"||new URL(req.url).origin!==self.location.origin)return;
  const url=new URL(req.url);
  // No interceptar nunca las fuentes ni archivos hidrometeorológicos actuales.
  if(!url.pathname.startsWith(self.registration.scope.replace(self.location.origin,""))||url.pathname.includes("/data/"))return;
  if(req.mode==="navigate"){
    event.respondWith(fetch(req,{cache:"no-store"}).catch(async()=>await caches.match("./offline.html")));
    return;
  }
  // Para scripts y CSS, preferir red y usar versión local sólo si falla conexión.
  if(/\.(?:js|css)$/.test(url.pathname)){
    event.respondWith((async()=>{
      try {
        const fresh=await fetch(req,{cache:"no-store"});
        if(fresh.ok){const cache=await caches.open(CACHE);await cache.put(url.pathname.split("/").pop(),fresh.clone())}
        return fresh;
      }catch{return await caches.match(url.pathname.split("/").pop())||Response.error()}
    })());
  }
});
