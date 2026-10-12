/**
 * Curruscos Clan · mapa Leaflet + OpenStreetMap.
 * Geocoding on-demand only; cached in sessionStorage. No fabricated fallback pin.
 * Nominatim and OSM tiles are community services with usage policies, not unlimited APIs.
 */
(function () {
  "use strict";

  let leafletPromise = null;
  let lastGeocodeAt = 0;
  const mapInstances = new Map();
  const TILE_URL = (window.CURRUSCOS_MAP_CONFIG && window.CURRUSCOS_MAP_CONFIG.tileUrl) ||
    "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
  const CACHE_PREFIX = "curruscos:geocode:v1:";

  function loadLeafletAssets() {
    if (window.L) return Promise.resolve();
    if (leafletPromise) return leafletPromise;
    leafletPromise = new Promise((resolve, reject) => {
      if (!document.querySelector('link[data-curruscos-leaflet]')) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css";
        link.dataset.curruscosLeaflet = "true";
        document.head.appendChild(link);
      }
      const existing = document.querySelector('script[data-curruscos-leaflet]');
      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error("No se ha podido cargar Leaflet.")), { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js";
      script.async = true;
      script.dataset.curruscosLeaflet = "true";
      script.onload = () => resolve();
      script.onerror = () => {
        leafletPromise = null;
        reject(new Error("No se ha podido cargar Leaflet."));
      };
      document.head.appendChild(script);
    });
    return leafletPromise;
  }

  function cacheKey(query) {
    return CACHE_PREFIX + query.trim().toLowerCase();
  }

  function readCache(query) {
    try {
      const value = JSON.parse(sessionStorage.getItem(cacheKey(query)) || "null");
      if (value && value.cachedAt && Date.now() - value.cachedAt < 30 * 24 * 60 * 60 * 1000) {
        return value.result || null;
      }
    } catch (_) {}
    return null;
  }

  function writeCache(query, result) {
    try {
      sessionStorage.setItem(cacheKey(query), JSON.stringify({ cachedAt: Date.now(), result: result }));
    } catch (_) {}
  }

  async function geocode(query) {
    const cached = readCache(query);
    if (cached) return cached;

    // Keep requests from this module at least 1.1s apart in this tab.
    const wait = Math.max(0, 1100 - (Date.now() - lastGeocodeAt));
    if (wait) await new Promise(resolve => window.setTimeout(resolve, wait));
    lastGeocodeAt = Date.now();

    const url = "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=" + encodeURIComponent(query);
    const response = await fetch(url, {
      method: "GET",
      headers: { "Accept": "application/json", "Accept-Language": "es" },
      credentials: "omit",
      referrerPolicy: "strict-origin-when-cross-origin",
    });
    if (!response.ok) throw new Error("El servicio de mapas no está disponible (" + response.status + ").");
    const rows = await response.json();
    if (!Array.isArray(rows) || !rows.length) {
      writeCache(query, { notFound: true });
      return { notFound: true };
    }
    const result = {
      lat: Number(rows[0].lat),
      lon: Number(rows[0].lon),
      displayName: String(rows[0].display_name || query),
    };
    if (!Number.isFinite(result.lat) || !Number.isFinite(result.lon)) {
      throw new Error("La ubicación recibida no es válida.");
    }
    writeCache(query, result);
    return result;
  }

  function safePopup(locationQuery, displayName) {
    const root = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = locationQuery;
    const details = document.createElement("p");
    details.textContent = displayName;
    details.style.margin = "5px 0 0";
    details.style.fontSize = "12px";
    root.append(title, details);
    return root;
  }

  const MapView = {
    async renderEventMap(containerId, locationQuery) {
      const container = document.getElementById(containerId);
      const query = String(locationQuery || "").trim();
      if (!container || !query) return { ok: false, reason: "missing-location" };

      container.style.width = "100%";
      container.style.height = "260px";
      container.style.borderRadius = "16px";
      container.style.overflow = "hidden";
      container.style.border = "1px solid var(--border)";

      try {
        await loadLeafletAssets();
        const location = await geocode(query);
        if (location.notFound) return { ok: false, reason: "not-found" };

        this.destroyEventMap(containerId);
        const map = window.L.map(container, {
          zoomControl: true,
          attributionControl: true,
          scrollWheelZoom: false,
        }).setView([location.lat, location.lon], 15);

        window.L.tileLayer(TILE_URL, {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>',
          updateWhenIdle: true,
          keepBuffer: 2,
        }).addTo(map);

        const pin = window.L.divIcon({
          className: "curruscos-map-pin",
          html: '<span style="display:block;width:22px;height:22px;background:#ff4d2e;border:3px solid #fff;border-radius:50%;box-shadow:0 3px 12px rgba(0,0,0,.25)"></span>',
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });
        window.L.marker([location.lat, location.lon], { icon: pin })
          .addTo(map)
          .bindPopup(safePopup(query, location.displayName));
        mapInstances.set(containerId, map);
        window.setTimeout(() => map.invalidateSize(), 50);
        return { ok: true, displayName: location.displayName, lat: location.lat, lon: location.lon };
      } catch (error) {
        console.warn("No se ha podido renderizar el mapa:", error);
        return { ok: false, reason: "service-error", error: error };
      }
    },

    destroyEventMap(containerId) {
      const map = mapInstances.get(containerId);
      if (map) {
        map.remove();
        mapInstances.delete(containerId);
      }
    },
  };

  window.MapView = MapView;
})();
