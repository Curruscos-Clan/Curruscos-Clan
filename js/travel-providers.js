/* Travel provider layer.
 * Keeps provider-specific URLs and normalized result metadata outside the trip UI.
 * Future API adapters can feed the same normalized shape without changing trips/options.
 */
window.CURRUSCOS_TRAVEL_PROVIDERS = Object.freeze({
  googleFlights: {
    id: "google_flights",
    label: "Google Flights",
    category: "flight",
    buildSearchUrl({ origin = "", destination = "", startDate = "", endDate = "" } = {}) {
      const params = new URLSearchParams();
      if (origin) params.set("f", origin);
      if (destination) params.set("t", destination);
      if (startDate) params.set("d", startDate);
      if (endDate) params.set("r", endDate);
      const query = [origin, destination].filter(Boolean).join(" ");
      return "https://www.google.com/travel/flights" + (query ? "?q=" + encodeURIComponent(query) : "");
    }
  },
  googleHotels: {
    id: "google_hotels",
    label: "Google Hotels",
    category: "hotel",
    buildSearchUrl({ destination = "" } = {}) {
      return destination
        ? "https://www.google.com/travel/hotels?q=" + encodeURIComponent(destination)
        : "https://www.google.com/travel/hotels";
    }
  },
  googleMaps: {
    id: "google_maps",
    label: "Google Maps",
    category: "place",
    buildSearchUrl({ destination = "" } = {}) {
      return destination
        ? "https://www.google.com/maps/search/" + encodeURIComponent(destination)
        : "https://www.google.com/maps";
    }
  }
});

window.normalizeTravelOption = function normalizeTravelOption(raw = {}) {
  const price = Number(raw.price);
  const pricePerPerson = Number(raw.price_per_person);
  return {
    source: String(raw.source || raw.provider || "manual").trim().toLowerCase(),
    provider: String(raw.provider || "").trim() || null,
    external_id: String(raw.external_id || "").trim() || null,
    category: String(raw.category || "other").trim().toLowerCase(),
    title: String(raw.title || "").trim(),
    price: Number.isFinite(price) && price >= 0 ? price : null,
    price_per_person: Number.isFinite(pricePerPerson) && pricePerPerson >= 0 ? pricePerPerson : null,
    currency: String(raw.currency || "EUR").trim().toUpperCase(),
    url: String(raw.url || "").trim() || null,
    start_at: raw.start_at || null,
    end_at: raw.end_at || null,
    location: String(raw.location || "").trim() || null,
    rating: Number.isFinite(Number(raw.rating)) ? Number(raw.rating) : null,
    metadata: raw.metadata && typeof raw.metadata === "object" ? raw.metadata : {}
  };
};

window.travelProviderSearchUrl = function travelProviderSearchUrl(providerId, params = {}) {
  const provider = window.CURRUSCOS_TRAVEL_PROVIDERS?.[providerId];
  if (!provider || typeof provider.buildSearchUrl !== "function") return "";
  return provider.buildSearchUrl(params);
};