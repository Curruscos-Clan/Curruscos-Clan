/**
 * Curruscos Clan · Service Worker
 * Network-first para mantener la app actualizada y fallback offline seguro.
 * No intercepta servicios externos, Supabase ni operaciones que modifiquen datos.
 */
const CACHE_NAME = "curruscos-v17";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./css/editorial-design.css",
  "./css/styles.css",
  "./css/webgl-immersive.css",
  "./css/immersive-experiences.css",
  "./js/immersive-experiences.js",
  "./js/webgl-scene.js",
  "./css/event-detail-editorial.css",
  "./css/explore-editorial.css",
  "./evento-publico.html",
  "./comunidades.html",
  "./explorar.html",
  "./eventos.html",
  "./mis-eventos.html",
  "./mis-planes.html",
  "./crear-evento.html",
  "./perfil.html",
  "./login.html",
  "./ajustes.html",
  "./notificaciones.html",
  "./chat.html",
  "./css/design-system.css",
  "./js/app.js",
  "./js/supabase.js",
  "./js/pwa.js",
  "./js/comments.js",
  "./js/calendar-export.js",
  "./js/map-view.js",
  "./js/evento-publico.js",
  "./js/community-chat.js",
  "./js/reports.js",
  "./manifest.webmanifest",
  "./assets/icon.svg",
  "./js/i18n.js",
  "./js/cookies.js",
  "./cookies.html",
  "./locales/es.json",
  "./locales/en.json",
  "./locales/fr.json",
  "./locales/de.json",
  "./locales/it.json",
  "./locales/pt.json",
  "./locales/zh.json",
  "./locales/ar.json"
];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Un recurso opcional ausente no debe impedir instalar/actualizar la PWA.
    await Promise.all(CORE_ASSETS.map(async asset => {
      try {
        const response = await fetch(asset, { cache: "reload" });
        if (response.ok && response.type !== "opaque") {
          await cache.put(asset, response);
        }
      } catch (_) {
        // Se descargará cuando vuelva la conexión.
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith("curruscos-") && key !== CACHE_NAME)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // No cachear Supabase, APIs externas, mapas ni otros dominios.
  if (url.origin !== self.location.origin) return;

  const isDocument = request.mode === "navigate" || request.destination === "document";
  const isStatic = /\.(?:css|js|mjs|svg|png|jpe?g|webp|ico|woff2?)$/i.test(url.pathname) ||
    url.pathname.endsWith(".webmanifest") || /\.json$/i.test(url.pathname);
  if (!isDocument && !isStatic) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      const response = await fetch(request);
      if (response && response.ok && response.type !== "opaque") {
        await cache.put(request, response.clone()).catch(() => {});
      }
      return response;
    } catch (_) {
      const cached = await caches.match(request);
      if (cached) return cached;
      // Solo documentos reciben fallback HTML; nunca devolver HTML como JS/CSS/JSON.
      if (isDocument) {
        const home = await caches.match("./index.html") || await caches.match("./");
        if (home) return home;
      }
      return new Response(
        isStatic ? "/* Recurso no disponible sin conexión */" : "Sin conexión.",
        { status: 503, statusText: "Offline", headers: { "Content-Type": isStatic ? "text/plain; charset=utf-8" : "text/plain; charset=utf-8" } }
      );
    }
  })());
});
