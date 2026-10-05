import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { MapPin, Loader2, Search, Star } from "lucide-react";

const TheatersMap = lazy(() => import("@/components/theaters-map"));

type Theater = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  address?: string;
  distanceKm: number;
  source?: "osm" | "curated";
};

type Coords = { lat: number; lon: number; label?: string };

const PREF_KEY = "cinebook.preferredTheater";
const RADII_KM = [40, 75, 150];
const PAGE_SIZE = 25;

// Curated fallback for tier-2/tier-3 gaps in OSM data. Coords are approximate.
const CURATED: Array<{ name: string; city: string; lat: number; lon: number; address: string }> = [
  // Patna
  { name: "PVR P&M Mall", city: "Patna", lat: 25.6180, lon: 85.1487, address: "P&M Mall, Patliputra Colony, Patna" },
  { name: "Cinepolis Patna", city: "Patna", lat: 25.6100, lon: 85.1345, address: "Grand Mall, Dak Bungalow Road, Patna" },
  { name: "INOX Maurya Lok", city: "Patna", lat: 25.6103, lon: 85.1416, address: "Maurya Lok Complex, Dak Bungalow Rd, Patna" },
  { name: "Regent Fun Cinemas", city: "Patna", lat: 25.6110, lon: 85.1440, address: "Exhibition Road, Patna" },
  { name: "Mona Cinema", city: "Patna", lat: 25.6155, lon: 85.1290, address: "Dak Bungalow Road, Patna" },
  // Jalandhar
  { name: "PVR MBD Mall", city: "Jalandhar", lat: 31.3260, lon: 75.5762, address: "MBD Neopolis Mall, Ladowali Road, Jalandhar" },
  { name: "Cinepolis Viva Collage Mall", city: "Jalandhar", lat: 31.3186, lon: 75.5989, address: "Viva Collage Mall, GT Road, Jalandhar" },
  { name: "INOX Alpha One", city: "Jalandhar", lat: 31.3390, lon: 75.5760, address: "Alpha One Mall, Jalandhar" },
  // Ludhiana
  { name: "PVR Pavilion Mall", city: "Ludhiana", lat: 30.8760, lon: 75.8180, address: "Pavilion Mall, Ludhiana" },
  { name: "Cinepolis Pakhowal Road", city: "Ludhiana", lat: 30.8813, lon: 75.8036, address: "Silver Arc Mall, Pakhowal Rd, Ludhiana" },
  // Amritsar
  { name: "PVR Alpha One Amritsar", city: "Amritsar", lat: 31.6340, lon: 74.8723, address: "Alpha One Mall, Amritsar" },
  { name: "Cinepolis Trilium Mall", city: "Amritsar", lat: 31.6970, lon: 74.8639, address: "Trilium Mall, Amritsar" },
  // Chandigarh
  { name: "PVR Elante Mall", city: "Chandigarh", lat: 30.7050, lon: 76.8010, address: "Elante Mall, Industrial Area, Chandigarh" },
  { name: "INOX Piccadily Chandigarh", city: "Chandigarh", lat: 30.7333, lon: 76.7794, address: "Piccadily, Sector 34, Chandigarh" },
  // Indore
  { name: "PVR Treasure Island", city: "Indore", lat: 22.7240, lon: 75.8830, address: "Treasure Island Mall, Indore" },
  { name: "INOX Central Mall Indore", city: "Indore", lat: 22.7515, lon: 75.8935, address: "Central Mall, RNT Marg, Indore" },
  // Lucknow
  { name: "PVR Phoenix United", city: "Lucknow", lat: 26.8560, lon: 80.9930, address: "Phoenix United Mall, Alambagh, Lucknow" },
  { name: "INOX Riverside Mall", city: "Lucknow", lat: 26.8420, lon: 80.9450, address: "Riverside Mall, Gomti Nagar, Lucknow" },
];

function haversine(a: Coords, b: { lat: number; lon: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

async function fetchTheatersOSM(
  center: Coords,
  radiusMeters: number,
  signal?: AbortSignal,
): Promise<Theater[]> {
  const query = `
    [out:json][timeout:6];
    (
      node["amenity"="cinema"](around:${radiusMeters},${center.lat},${center.lon});
      way["amenity"="cinema"](around:${radiusMeters},${center.lat},${center.lon});
      relation["amenity"="cinema"](around:${radiusMeters},${center.lat},${center.lon});
    );
    out center tags;
  `;
  const endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
  ];
  const body = "data=" + encodeURIComponent(query);
  // Race all endpoints in parallel; first OK response wins.
  const race = await Promise.any(
    endpoints.map(async (url) => {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
        signal,
      });
      if (!res.ok) throw new Error(`Overpass ${url} → ${res.status}`);
      return res.json();
    }),
  );
  const json = race as {
    elements: Array<{
      id: number;
      type: string;
      lat?: number;
      lon?: number;
      center?: { lat: number; lon: number };
      tags?: Record<string, string>;
    }>;
  };

  const list: Theater[] = [];
  for (const el of json.elements ?? []) {
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (lat == null || lon == null) continue;
    const tags = el.tags ?? {};
    const name = tags.name || tags["name:en"] || "Unnamed cinema";
    const address =
      [tags["addr:housenumber"], tags["addr:street"], tags["addr:city"]]
        .filter(Boolean)
        .join(" ") || undefined;
    list.push({
      id: `${el.type}/${el.id}`,
      name,
      lat,
      lon,
      address,
      distanceKm: haversine(center, { lat, lon }),
      source: "osm",
    });
  }
  return list.sort((a, b) => a.distanceKm - b.distanceKm);
}

function curatedWithin(center: Coords, radiusKm: number): Theater[] {
  return CURATED.map((c) => ({
    id: `curated/${c.name}-${c.city}`,
    name: c.name,
    lat: c.lat,
    lon: c.lon,
    address: c.address,
    distanceKm: haversine(center, { lat: c.lat, lon: c.lon }),
    source: "curated" as const,
  }))
    .filter((t) => t.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

function dedupe(list: Theater[]): Theater[] {
  const seen = new Set<string>();
  const out: Theater[] = [];
  for (const t of list) {
    // Rough dedupe: same name within 400m
    const key = t.name.toLowerCase().trim();
    const dup = out.find((o) => o.name.toLowerCase().trim() === key && haversine(o, t) < 0.4);
    if (dup) continue;
    if (seen.has(t.id)) continue;
    seen.add(t.id);
    out.push(t);
  }
  return out;
}

type Suggestion = { lat: number; lon: number; label: string };

async function geocodeIndia(query: string, limit = 5): Promise<Suggestion[]> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 4000);
  try {
    const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&countrycodes=in&addressdetails=1&limit=${limit}&q=${encodeURIComponent(query)}`,
      { headers: { Accept: "application/json" }, signal: ctrl.signal },
    );
    if (!res.ok) return [];
    const rows: Array<{ lat: string; lon: string; display_name: string }> = await res.json();
    return rows.map((r) => ({ lat: parseFloat(r.lat), lon: parseFloat(r.lon), label: r.display_name }));
  } catch {
    return [];
  } finally {
    clearTimeout(t);
  }
}

// Simple in-memory cache for theater results, keyed by rounded coords.
const CACHE_TTL_MS = 12 * 60 * 1000;
const theaterCache = new Map<string, { at: number; radius: number; list: Theater[] }>();
const cacheKey = (c: Coords) => `${c.lat.toFixed(2)},${c.lon.toFixed(2)}`;

const OVERPASS_TIMEOUT_MS = 3500;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

function TheatersPage() {
  const [center, setCenter] = useState<Coords | null>(null);
  const [theaters, setTheaters] = useState<Theater[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSug, setShowSug] = useState(false);
  const [radiusKm, setRadiusKm] = useState<number | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [preferred, setPreferred] = useState<Theater | null>(null);
  const sugTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PREF_KEY);
      if (raw) setPreferred(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, []);

  // Parallel search: curated shows instantly; Overpass raced with a short
  // timeout and merged in when it arrives. Silently widens if too few results.
  const loadTheaters = useCallback(async (c: Coords) => {
    setError(null);
    setVisibleCount(PAGE_SIZE);

    // Serve from cache instantly if fresh.
    const key = cacheKey(c);
    const cached = theaterCache.get(key);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      setTheaters(cached.list);
      setRadiusKm(cached.radius);
      setLoading(false);
      return;
    }

    setLoading(true);
    // Show curated immediately at the widest radius so the list isn't blank.
    const initialCurated = curatedWithin(c, RADII_KM[0]);
    if (initialCurated.length) setTheaters(initialCurated);

    let usedRadius = RADII_KM[0];
    let combined: Theater[] = initialCurated;

    for (let i = 0; i < RADII_KM.length; i++) {
      const r = RADII_KM[i];
      usedRadius = r;
      const curated = curatedWithin(c, r);
      let osm: Theater[] = [];
      try {
        osm = await withTimeout(fetchTheatersOSM(c, r * 1000), OVERPASS_TIMEOUT_MS);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("[theaters] overpass unavailable or slow, using curated", err);
      }
      combined = dedupe([...osm, ...curated]).sort((a, b) => a.distanceKm - b.distanceKm);
      // eslint-disable-next-line no-console
      console.log(`[theaters] r=${r}km osm=${osm.length} curated=${curated.length} → ${combined.length}`);
      setTheaters(combined);
      if (combined.length >= 3) break;
    }

    setRadiusKm(usedRadius);
    theaterCache.set(key, { at: Date.now(), radius: usedRadius, list: combined });
    if (combined.length === 0) setError(`No theaters found near this location.`);
    setLoading(false);
  }, []);

  const useMyLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("Geolocation not supported. Try searching a city instead.");
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c = { lat: pos.coords.latitude, lon: pos.coords.longitude, label: "Your location" };
        setCenter(c);
        void loadTheaters(c);
      },
      (err) => {
        setLoading(false);
        setError(err.message || "Location permission denied");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, [loadTheaters]);

  const runSearch = useCallback(
    async (q?: string) => {
      const term = (q ?? search).trim();
      if (!term) return;
      setShowSug(false);
      setLoading(true);
      setError(null);
      const results = await geocodeIndia(term, 1);
      const c = results[0];
      if (!c) {
        setLoading(false);
        setError(`No location matched "${term}" in India. Try a city, area, or pincode.`);
        return;
      }
      const coords: Coords = { lat: c.lat, lon: c.lon, label: c.label };
      setCenter(coords);
      await loadTheaters(coords);
    },
    [search, loadTheaters],
  );

  const pickSuggestion = useCallback(
    async (s: Suggestion) => {
      setSearch(s.label);
      setShowSug(false);
      const coords: Coords = { lat: s.lat, lon: s.lon, label: s.label };
      setCenter(coords);
      await loadTheaters(coords);
    },
    [loadTheaters],
  );

  // Debounced autocomplete
  useEffect(() => {
    if (sugTimer.current) clearTimeout(sugTimer.current);
    const term = search.trim();
    if (term.length < 2) {
      setSuggestions([]);
      return;
    }
    sugTimer.current = setTimeout(async () => {
      const rows = await geocodeIndia(term, 6);
      setSuggestions(rows);
    }, 300);
    return () => {
      if (sugTimer.current) clearTimeout(sugTimer.current);
    };
  }, [search]);

  const setAsPreferred = useCallback((t: Theater) => {
    setPreferred(t);
    try {
      localStorage.setItem(PREF_KEY, JSON.stringify(t));
    } catch {
      // ignore
    }
  }, []);

  const clearPreferred = useCallback(() => {
    setPreferred(null);
    try {
      localStorage.removeItem(PREF_KEY);
    } catch {
      // ignore
    }
  }, []);

  const visible = theaters.slice(0, visibleCount);

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="font-display text-4xl tracking-[0.15em] text-foreground sm:text-5xl">
            NEARBY <span className="text-primary">THEATERS</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Search any Indian city, area, or pincode. Real cinemas from OpenStreetMap plus a curated list of major chains.
          </p>
        </div>

        {preferred && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/40 bg-primary/10 px-4 py-3">
            <div className="flex items-center gap-2 text-sm">
              <Star className="h-4 w-4 fill-primary text-primary" />
              <span className="text-muted-foreground">Preferred:</span>
              <span className="font-semibold text-foreground">{preferred.name}</span>
              {preferred.address && <span className="text-muted-foreground">— {preferred.address}</span>}
            </div>
            <button onClick={clearPreferred} className="text-xs text-muted-foreground underline hover:text-destructive">
              Clear
            </button>
          </div>
        )}

        <div className="mb-4 flex flex-wrap gap-2">
          <button
            onClick={useMyLocation}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition hover:brightness-110"
          >
            <MapPin className="h-4 w-4" /> Use my location
          </button>
          <div className="relative flex flex-1 min-w-[240px]">
            <div className="flex flex-1 items-center gap-2 rounded-md border border-border/60 bg-secondary/40 px-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setShowSug(true);
                }}
                onFocus={() => setShowSug(true)}
                onBlur={() => setTimeout(() => setShowSug(false), 150)}
                onKeyDown={(e) => e.key === "Enter" && runSearch()}
                placeholder="Search any Indian city, area, or pincode"
                className="w-full bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground"
              />
              <button
                onClick={() => runSearch()}
                className="rounded-md px-3 py-1.5 text-sm text-foreground transition hover:text-primary"
              >
                Go
              </button>
            </div>
            {showSug && suggestions.length > 0 && (
              <ul className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-md border border-border/60 bg-popover/95 shadow-xl backdrop-blur">
                {suggestions.map((s, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pickSuggestion(s)}
                      className="block w-full truncate px-3 py-2 text-left text-sm text-foreground hover:bg-primary/10"
                    >
                      {s.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {center && !loading && theaters.length === 0 && error && (
          <p className="mb-3 text-sm text-muted-foreground">{error}</p>
        )}

        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_320px]">
          <div className="relative isolate z-0 h-[520px] min-w-0 overflow-hidden rounded-xl border border-border/60 bg-secondary/20">
            {loading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-sm">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            )}
            {center ? (
              <ClientOnly fallback={<div className="h-full w-full animate-pulse bg-secondary/30" />}>
                <Suspense fallback={<div className="h-full w-full animate-pulse bg-secondary/30" />}>
                  <TheatersMap
                    center={center}
                    theaters={visible}
                    selectedId={preferred?.id}
                    onSelect={setAsPreferred}
                  />
                </Suspense>
              </ClientOnly>
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-center text-muted-foreground">
                <MapPin className="h-10 w-10 text-primary/60" />
                <p className="max-w-xs text-sm">
                  Share your location or search a city to find nearby cinemas.
                </p>
              </div>
            )}
          </div>

          <aside className="no-scrollbar relative z-10 h-[520px] min-w-0 overflow-y-auto rounded-xl border border-border/60 bg-secondary/20 p-3">
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="font-display text-sm tracking-[0.2em] text-muted-foreground">
                {theaters.length} FOUND
              </span>
            </div>
            {theaters.length === 0 && !loading && (
              <p className="px-2 text-sm text-muted-foreground">No results yet.</p>
            )}
            {theaters.length === 0 && loading && (
              <ul className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <li key={i} className="animate-pulse rounded-lg border border-border/60 bg-background/60 p-3">
                    <div className="h-4 w-2/3 rounded bg-secondary/60" />
                    <div className="mt-2 h-3 w-1/2 rounded bg-secondary/40" />
                    <div className="mt-2 h-3 w-16 rounded bg-secondary/40" />
                  </li>
                ))}
              </ul>
            )}
            <ul className="space-y-2">
              {visible.map((t) => {
                const isPref = preferred?.id === t.id;
                return (
                  <li
                    key={t.id}
                    className={`rounded-lg border p-3 transition ${
                      isPref
                        ? "border-primary/60 bg-primary/10"
                        : "border-border/60 bg-background/60 hover:border-primary/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-foreground">
                          {t.name}
                          {t.source === "curated" && (
                            <span className="ml-2 rounded bg-primary/20 px-1.5 py-0.5 align-middle text-[10px] font-mono text-primary">CURATED</span>
                          )}
                        </p>
                        {t.address && (
                          <p className="truncate text-xs text-muted-foreground">{t.address}</p>
                        )}
                        <p className="mt-1 font-mono text-xs text-primary">
                          {t.distanceKm.toFixed(1)} km
                        </p>
                      </div>
                      <button
                        onClick={() => setAsPreferred(t)}
                        className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                          isPref
                            ? "bg-primary text-primary-foreground"
                            : "border border-border/60 text-foreground hover:border-primary/60 hover:text-primary"
                        }`}
                      >
                        {isPref ? "✓ Preferred" : "Set"}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
            {theaters.length > visible.length && (
              <button
                onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
                className="mt-3 w-full rounded-md border border-border/60 py-2 text-xs font-semibold text-foreground hover:border-primary/60 hover:text-primary"
              >
                Show more ({theaters.length - visible.length} left)
              </button>
            )}
          </aside>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          Map data © OpenStreetMap contributors • Geocoding via Nominatim • Cinemas via Overpass API
        </p>
      </main>
    </div>
  );
}

export const Route = createFileRoute("/theaters")({
  head: () => ({
    meta: [
      { title: "Nearby Theaters — CineBook" },
      { name: "description", content: "Find real cinemas near you and pick your preferred theater." },
    ],
  }),
  component: TheatersPage,
});