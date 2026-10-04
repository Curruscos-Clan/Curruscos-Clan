const CACHE="curruscos-v5";
const ASSETS=["./","./index.html","./css/style.css","./js/app.js","./js/supabase.js","./manifest.webmanifest","./assets/icon.svg","./js/i18n.js","./js/cookies.js","./cookies.html","./locales/es.json","./locales/en.json","./locales/fr.json","./locales/de.json","./locales/it.json","./locales/pt.json","./locales/zh.json","./locales/ar.json"];
self.addEventListener("install",event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()));});
self.addEventListener("activate",event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;
  const url=new URL(event.request.url);
  if(url.origin!==location.origin)return;
  const cacheable=/\.(css|js|svg|png|jpg|jpeg|webp|woff2?)$/i.test(url.pathname)||url.pathname.endsWith("manifest.webmanifest");
  const isDocument=event.request.destination==="document";
  if(!cacheable&&!isDocument)return;
  event.respondWith(
    fetch(event.request).then(response=>{
      if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy)).catch(()=>{});}
      return response;
    }).catch(()=>caches.match(event.request).then(cached=>cached||caches.match("./index.html")))
  );
});