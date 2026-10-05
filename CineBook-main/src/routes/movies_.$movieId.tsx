import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getMovie } from "@/lib/catalog.functions";
import { supabase } from "@/integrations/supabase/client";
import { ShowtimeMinHeap } from "@/lib/ds/ShowtimeMinHeap";
import { fmtTime, inr } from "@/lib/format";
import { Calendar, Clock, Star, MapPin, Navigation, Search, X, Loader2 } from "lucide-react";
import { TrailerHero } from "@/components/trailer-hero";

export const Route = createFileRoute("/movies_/$movieId")({
  component: MovieDetailPage,
});

function fmtRelease(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short" });
}

function fmtReleaseFull(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

type Theater = { id: string; name: string; city: string; address?: string | null; lat?: number | null; lon?: number | null };
const THEATER_KEY = "cinebook.selectedTheaterId";
const COORDS_KEY = "cinebook.userCoords";

type Coords = { lat: number; lon: number; label?: string };

function haversineKm(a: Coords, b: { lat: number; lon: number }): number {
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

function MovieDetailPage() {
  return (
    <Suspense fallback={<MovieDetailSkeleton />}>
      <Detail />
    </Suspense>
  );
}

function MovieDetailSkeleton() {
  return (
    <article aria-busy="true" aria-live="polite" className="animate-pulse">
      {/* Hero placeholder — matches TrailerHero responsive heights */}
      <div className="relative h-56 w-full overflow-hidden bg-gradient-to-b from-muted/40 via-muted/20 to-background sm:h-80 md:h-[28rem] lg:h-[34rem]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,var(--color-background)_85%)]" />
      </div>

      <div className="relative z-10 mx-auto mt-6 max-w-6xl px-4 sm:-mt-28 sm:px-6 md:-mt-36 lg:-mt-44 lg:px-8">
        <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-4 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-6 md:grid-cols-[220px_1fr] md:gap-8 lg:grid-cols-[260px_1fr]">
          {/* Poster skeleton — reserves the exact 2:3 aspect the real poster will occupy */}
          <div className="w-28 shrink-0 overflow-hidden rounded-2xl border border-border/60 bg-muted/40 shadow-2xl shadow-black/40 sm:w-40 md:w-full">
            <div className="aspect-[2/3] w-full" />
          </div>
          <div className="flex min-w-0 flex-col justify-end pt-0 md:pt-4">
            {/* Badge chips */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="h-6 w-20 rounded-full bg-primary/15" />
              <div className="h-6 w-10 rounded-full border border-border/60 bg-muted/30" />
            </div>
            {/* Title */}
            <div className="mt-3 space-y-2">
              <div className="h-8 w-3/4 rounded-md bg-muted/40 sm:h-12 lg:h-14" />
              <div className="h-8 w-1/2 rounded-md bg-muted/30 sm:h-12 lg:h-14" />
            </div>
            {/* Metadata row (rating • runtime • release date • genre • language) */}
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
              <div className="h-4 w-14 rounded bg-primary/20" />
              <span aria-hidden className="text-border">•</span>
              <div className="h-4 w-16 rounded bg-muted/40" />
              <span aria-hidden className="text-border">•</span>
              <div className="h-4 w-20 rounded bg-muted/40" />
              <span aria-hidden className="text-border">•</span>
              <div className="h-4 w-16 rounded bg-muted/40" />
              <span aria-hidden className="text-border">•</span>
              <div className="h-4 w-14 rounded bg-muted/40" />
            </div>
            <div className="mt-4 h-3 w-40 rounded bg-muted/30" />
          </div>
        </div>

        {/* Synopsis */}
        <section className="mt-10 border-t border-border/40 pt-8">
          <div className="h-3 w-24 rounded bg-primary/25" />
          <div className="mt-3 max-w-3xl space-y-2">
            <div className="h-4 w-full rounded bg-muted/30" />
            <div className="h-4 w-[95%] rounded bg-muted/30" />
            <div className="h-4 w-[88%] rounded bg-muted/30" />
            <div className="h-4 w-2/3 rounded bg-muted/30" />
          </div>
        </section>

        {/* Showtimes */}
        <section className="mt-12">
          <div className="h-8 w-40 rounded bg-muted/40" />
          <div className="mt-6 space-y-8">
            {[0, 1].map((g) => (
              <div key={g}>
                <div className="mb-4 flex items-center gap-3">
                  <div className="h-12 w-40 rounded-xl border border-primary/20 bg-primary/10" />
                  <div className="h-px flex-1 bg-border/40" />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-24 rounded-xl border border-border/50 bg-card/60" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </article>
  );
}

function Detail() {
  const { movieId } = Route.useParams();
  const fetchMovie = useServerFn(getMovie);
  const { data } = useSuspenseQuery({
    queryKey: ["movie", movieId],
    queryFn: () => fetchMovie({ data: { id: movieId } }),
  });
  const { movie, shows } = data;
  const occupancy = (data as { occupancy?: Record<string, { total: number; available: number }> }).occupancy ?? {};
  const theaters = ((data as { theaters?: Theater[] }).theaters ?? []) as Theater[];
  const status = (movie as { status?: "now_showing" | "coming_soon" | "archived" }).status ?? "now_showing";
  const releaseDate = (movie as { release_date?: string | null }).release_date ?? null;

  // User coords + selected theater (both persisted).
  const [selectedTheaterId, setSelectedTheaterId] = useState<string | null>(null);
  const [userCoords, setUserCoords] = useState<Coords | null>(null);
  const [locationStatus, setLocationStatus] = useState<"idle" | "requesting" | "granted" | "denied" | "unsupported">("idle");
  const autoPickedRef = useRef(false);

  // Restore persisted state on mount.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const rawCoords = localStorage.getItem(COORDS_KEY);
      if (rawCoords) {
        const c = JSON.parse(rawCoords) as Coords;
        if (typeof c.lat === "number" && typeof c.lon === "number") {
          setUserCoords(c);
          setLocationStatus("granted");
        }
      }
    } catch { /* ignore */ }
    const savedId = localStorage.getItem(THEATER_KEY);
    if (savedId) setSelectedTheaterId(savedId);
  }, []);

  // Request browser geolocation once, if we don't already have coords.
  const requestLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationStatus("unsupported");
      return;
    }
    setLocationStatus("requesting");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c: Coords = { lat: pos.coords.latitude, lon: pos.coords.longitude, label: "Your location" };
        setUserCoords(c);
        setLocationStatus("granted");
        try { localStorage.setItem(COORDS_KEY, JSON.stringify(c)); } catch { /* ignore */ }
      },
      () => setLocationStatus("denied"),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5 * 60 * 1000 },
    );
  }, []);

  // Auto-request on first mount if we've never asked before.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (userCoords) return;
    if (locationStatus !== "idle") return;
    // Only auto-prompt for now_showing movies (has theaters to pick).
    if (theaters.length === 0) return;
    requestLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theaters.length]);

  // Compute theaters with distance, sorted by proximity when we have coords.
  const rankedTheaters = useMemo(() => {
    const withDist = theaters.map((t) => {
      const lat = t.lat ?? null;
      const lon = t.lon ?? null;
      const distanceKm = userCoords && lat != null && lon != null
        ? haversineKm(userCoords, { lat, lon })
        : null;
      return { ...t, distanceKm } as Theater & { distanceKm: number | null };
    });
    if (userCoords) {
      withDist.sort((a, b) => {
        if (a.distanceKm == null && b.distanceKm == null) return a.name.localeCompare(b.name);
        if (a.distanceKm == null) return 1;
        if (b.distanceKm == null) return -1;
        return a.distanceKm - b.distanceKm;
      });
    }
    return withDist;
  }, [theaters, userCoords]);

  // Auto-select nearest theater once, when coords arrive and no saved theater.
  useEffect(() => {
    if (autoPickedRef.current) return;
    if (!userCoords) return;
    if (rankedTheaters.length === 0) return;
    const savedStillValid = selectedTheaterId && rankedTheaters.some((t) => t.id === selectedTheaterId);
    if (savedStillValid) { autoPickedRef.current = true; return; }
    const nearest = rankedTheaters[0];
    if (nearest) {
      setSelectedTheaterId(nearest.id);
      try { localStorage.setItem(THEATER_KEY, nearest.id); } catch { /* ignore */ }
      autoPickedRef.current = true;
    }
  }, [userCoords, rankedTheaters, selectedTheaterId]);

  const selectTheater = (id: string) => {
    setSelectedTheaterId(id);
    if (typeof window !== "undefined") localStorage.setItem(THEATER_KEY, id);
  };
  const selectedTheater = rankedTheaters.find((t) => t.id === selectedTheaterId) ?? null;

  // Filter shows to selected theater when now_showing
  const filteredShows = useMemo(
    () => (selectedTheaterId ? shows.filter((s) => (s as { theater_id?: string }).theater_id === selectedTheaterId) : shows),
    [shows, selectedTheaterId],
  );

  // Live-update occupancy: subscribe to show_seats changes for the shows on this
  // page and re-fetch the movie query (debounced) so counts reflect other
  // users' bookings and cancellations without a manual refresh.
  const showIds = useMemo(() => filteredShows.map((s) => s.id), [filteredShows]);
  useLiveShowSeats(showIds, ["movie", movieId]);

  // Sort shows chronologically via our hand-written min-heap (academic showcase).
  const sortedShows = useMemo(() => {
    const heap = new ShowtimeMinHeap();
    for (const s of filteredShows) heap.push({ id: s.id, movieId: s.movie_id, screenId: s.screen_id, startsAt: s.starts_at });
    const orderedIds: string[] = [];
    while (heap.size > 0) {
      const next = heap.pop();
      if (next) orderedIds.push(next.id);
    }
    const byId = new Map(filteredShows.map((s) => [s.id, s]));
    return orderedIds.map((id) => byId.get(id)!).filter(Boolean);
  }, [filteredShows]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof sortedShows>();
    for (const s of sortedShows) {
      const key = new Date(s.starts_at).toDateString();
      const arr = map.get(key) ?? [];
      arr.push(s);
      map.set(key, arr);
    }
    return [...map.entries()];
  }, [sortedShows]);

  return (
    <article>
      <TrailerHero
        trailerKey={(movie as { trailer_key?: string | null }).trailer_key ?? null}
        backdropUrl={movie.backdrop_url}
        title={movie.title}
      />
      <div className="relative z-10 mx-auto mt-6 max-w-6xl px-4 sm:-mt-28 sm:px-6 md:-mt-36 lg:-mt-44 lg:px-8">
        {/* TOP ROW: poster + key info side by side */}
        <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-4 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-6 md:grid-cols-[220px_1fr] md:gap-8 lg:grid-cols-[260px_1fr]">
          {/* Poster */}
          <div className="w-28 shrink-0 overflow-hidden rounded-2xl border border-border/60 shadow-2xl shadow-black/40 sm:w-40 md:w-full">
            {movie.poster_url ? (
              <img src={movie.poster_url} alt={movie.title} className="block h-auto w-full" />
            ) : (
              <div className="flex aspect-[2/3] items-center justify-center bg-muted font-display text-4xl">{movie.title.slice(0, 2)}</div>
            )}
          </div>

          {/* Movie name + meta */}
          <div className="movie-detail-copy flex min-w-0 flex-col justify-end pt-0 text-left md:pt-4">
            <div className="flex flex-wrap items-center gap-2">
              {movie.industry && (
                <span className="rounded-full bg-primary/15 px-3 py-1 font-mono text-xs uppercase tracking-widest text-primary">
                  {movie.industry}
                </span>
              )}
              {movie.certification && (
                <span className="rounded-full border border-border/60 px-3 py-1 font-mono text-xs">
                  {movie.certification}
                </span>
              )}
            </div>

            <h1 className="movie-detail-title mt-3 font-display text-3xl leading-[0.95] tracking-wide sm:text-5xl lg:text-6xl">
              {movie.title}
            </h1>

            {/* Clean metadata row */}
            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground sm:text-sm">
              {movie.rating != null && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 font-mono text-primary">
                  <Star className="h-3.5 w-3.5 fill-primary" /> {movie.rating}
                </span>
              )}
              {movie.duration_min && (
                <span className="inline-flex items-center gap-1.5 font-mono">
                  <Clock className="h-3.5 w-3.5" /> {movie.duration_min} min
                </span>
              )}
              {(movie as { release_date?: string | null }).release_date && (
                <span className="inline-flex items-center gap-1.5 font-mono">
                  <Calendar className="h-3.5 w-3.5" /> {fmtRelease((movie as { release_date?: string | null }).release_date!)}
                </span>
              )}
              {movie.genre && <span className="hidden sm:inline">{movie.genre}</span>}
              {movie.language && (
                <span className="rounded-full border border-border/50 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider">
                  {movie.language}
                </span>
              )}
            </div>

            <p className="mt-4 font-mono text-xs text-muted-foreground">
              Base ticket <span className="text-primary">{inr(movie.base_price)}</span>
            </p>
          </div>
        </div>

        {/* BELOW: full-width synopsis */}
        {movie.description && (
          <section className="mt-10 rounded-2xl border border-border/50 bg-card/30 p-5 shadow-[0_20px_60px_-40px_rgba(0,0,0,0.8)] backdrop-blur-sm sm:p-7">
            <div className="mb-3 flex items-center gap-3">
              <h2 className="font-mono text-xs uppercase tracking-[0.3em] text-primary">Synopsis</h2>
              <div className="h-px flex-1 bg-gradient-to-r from-primary/30 to-transparent" />
            </div>
            <p className="max-w-3xl text-sm leading-relaxed text-foreground/85 sm:text-base sm:leading-[1.75]">
              {movie.description}
            </p>
          </section>
        )}

        {status === "archived" ? (
          <ArchivedNotice />
        ) : status === "coming_soon" ? (
          <ComingSoonNotice releaseDate={releaseDate} />
        ) : (
          <>
            <TheaterPicker
              theaters={rankedTheaters}
              selectedId={selectedTheaterId}
              onSelect={selectTheater}
              selected={selectedTheater}
              userCoords={userCoords}
              locationStatus={locationStatus}
              onRequestLocation={requestLocation}
              onSetCoords={(c) => {
                setUserCoords(c);
                setLocationStatus("granted");
                try { localStorage.setItem(COORDS_KEY, JSON.stringify(c)); } catch { /* ignore */ }
                autoPickedRef.current = false; // allow re-pick nearest after coords change
              }}
            />
            <ShowtimesPanel grouped={grouped} occupancy={occupancy} basePrice={movie.base_price} />
          </>
        )}
      </div>
    </article>
  );
}

function ArchivedNotice() {
  return (
    <section className="mt-12 rounded-2xl border border-border/60 bg-card/40 p-8 text-center shadow-[0_20px_60px_-30px_rgba(0,0,0,0.8)]">
      <h2 className="font-mono text-xs uppercase tracking-[0.35em] text-muted-foreground">Not Playing</h2>
      <p className="mt-3 font-display text-2xl">This movie is no longer playing in theaters.</p>
      <p className="mt-2 text-sm text-muted-foreground">Check back for re-releases or explore our current lineup.</p>
      <Link to="/movies" className="mt-6 inline-flex items-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:brightness-110">Browse Now Showing</Link>
    </section>
  );
}

function ComingSoonNotice({ releaseDate }: { releaseDate: string | null }) {
  return (
    <section className="mt-12 rounded-2xl border border-primary/40 bg-primary/5 p-8 text-center shadow-[0_20px_60px_-30px_rgba(0,0,0,0.8)]">
      <h2 className="font-mono text-xs uppercase tracking-[0.35em] text-primary">Coming Soon</h2>
      <p className="mt-3 font-display text-3xl">
        {releaseDate ? `In theaters ${fmtReleaseFull(releaseDate)}` : "Release date to be announced"}
      </p>
      <p className="mt-2 text-sm text-muted-foreground">Bookings open closer to the release date.</p>
    </section>
  );
}

type RankedTheater = Theater & { distanceKm: number | null };

function TheaterPicker({
  theaters,
  selectedId,
  onSelect,
  selected,
  userCoords,
  locationStatus,
  onRequestLocation,
  onSetCoords,
}: {
  theaters: RankedTheater[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  selected: RankedTheater | null;
  userCoords: Coords | null;
  locationStatus: "idle" | "requesting" | "granted" | "denied" | "unsupported";
  onRequestLocation: () => void;
  onSetCoords: (c: Coords) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [geocoding, setGeocoding] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  if (theaters.length === 0) return null;

  const filtered = query.trim()
    ? theaters.filter((t) => {
        const q = query.trim().toLowerCase();
        return (
          t.name.toLowerCase().includes(q) ||
          t.city.toLowerCase().includes(q) ||
          (t.address ?? "").toLowerCase().includes(q)
        );
      })
    : theaters;

  const runCitySearch = async () => {
    const term = query.trim();
    if (!term) return;
    setGeocoding(true);
    setGeoError(null);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&countrycodes=in&limit=1&q=${encodeURIComponent(term)}`,
        { headers: { Accept: "application/json" } },
      );
      const rows: Array<{ lat: string; lon: string; display_name: string }> = await res.json();
      const hit = rows[0];
      if (!hit) {
        setGeoError(`Couldn't find "${term}" in India.`);
        return;
      }
      onSetCoords({ lat: parseFloat(hit.lat), lon: parseFloat(hit.lon), label: hit.display_name });
    } catch {
      setGeoError("Location search failed. Try again.");
    } finally {
      setGeocoding(false);
    }
  };

  const locHint = userCoords?.label
    ? userCoords.label.length > 40 ? userCoords.label.slice(0, 40) + "…" : userCoords.label
    : null;

  return (
    <section className="mt-12">
      {/* Compact selected-theater card */}
      <div className="rounded-2xl border border-border/60 bg-card/40 p-5 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.8)] sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
              <MapPin className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="font-mono text-[0.65rem] uppercase tracking-[0.3em] text-muted-foreground">
                {userCoords ? "Nearest theater" : "Selected theater"}
              </div>
              <div className="mt-0.5 truncate font-display text-xl tracking-wide sm:text-2xl">
                {selected ? selected.name : "No theater selected"}
              </div>
              {selected && (
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                  <span>{selected.city}</span>
                  {selected.distanceKm != null && (
                    <>
                      <span aria-hidden>•</span>
                      <span className="font-mono text-primary">{selected.distanceKm.toFixed(1)} km away</span>
                    </>
                  )}
                </div>
              )}
              {!userCoords && locationStatus === "denied" && (
                <div className="mt-1 text-xs text-muted-foreground">
                  Location access is disabled. Search for a city to find your nearest theater.
                </div>
              )}
              {locHint && (
                <div className="mt-1 truncate text-[10px] font-mono uppercase tracking-widest text-muted-foreground/70">
                  Near {locHint}
                </div>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {!userCoords && locationStatus !== "requesting" && (
              <button
                onClick={onRequestLocation}
                className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 font-mono text-xs uppercase tracking-widest text-primary hover:bg-primary/20"
              >
                <Navigation className="h-3.5 w-3.5" /> Use my location
              </button>
            )}
            {locationStatus === "requesting" && (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-3 py-2 font-mono text-xs uppercase tracking-widest text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Locating…
              </span>
            )}
            <button
              onClick={() => { setOpen(true); setQuery(""); setGeoError(null); }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-background/60 px-3 py-2 font-mono text-xs uppercase tracking-widest text-foreground hover:border-primary hover:text-primary"
            >
              Change Theater
            </button>
          </div>
        </div>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-border/60 bg-card p-5 shadow-2xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl tracking-wide">Choose a theater</h3>
              <button
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 flex items-center gap-2 rounded-lg border border-border/60 bg-background/60 px-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void runCitySearch(); }}
                placeholder="Search theater or city (e.g. Patna, PVR)"
                className="w-full bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground"
              />
              {query && (
                <button
                  onClick={() => void runCitySearch()}
                  disabled={geocoding}
                  className="rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-primary hover:bg-primary/10 disabled:opacity-50"
                >
                  {geocoding ? "…" : "Geocode"}
                </button>
              )}
            </div>
            {geoError && <p className="mt-2 text-xs text-destructive">{geoError}</p>}

            {!userCoords && (
              <button
                onClick={onRequestLocation}
                className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 font-mono text-xs uppercase tracking-widest text-primary hover:bg-primary/20"
              >
                <Navigation className="h-3.5 w-3.5" /> Use my current location
              </button>
            )}

            <ul className="mt-4 max-h-80 space-y-1.5 overflow-y-auto pr-1">
              {filtered.length === 0 && (
                <li className="px-2 py-6 text-center text-sm text-muted-foreground">No theaters match.</li>
              )}
              {filtered.map((t) => {
                const isSel = t.id === selectedId;
                return (
                  <li key={t.id}>
                    <button
                      onClick={() => { onSelect(t.id); setOpen(false); }}
                      className={`flex w-full items-start justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition ${
                        isSel
                          ? "border-primary/60 bg-primary/10"
                          : "border-border/50 bg-background/40 hover:border-primary/40 hover:bg-primary/5"
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-foreground">{t.name}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {t.city}{t.address ? ` · ${t.address}` : ""}
                        </div>
                      </div>
                      {t.distanceKm != null && (
                        <span className="shrink-0 rounded-md bg-primary/10 px-2 py-0.5 font-mono text-[11px] text-primary">
                          {t.distanceKm.toFixed(1)} km
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}

function useLiveShowSeats(showIds: string[], invalidateKey: readonly unknown[]) {
  const qc = useQueryClient();
  const idsKey = showIds.join(",");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!showIds.length) return;
    const idSet = new Set(showIds);
    const channel = supabase
      .channel(`show_seats:${idsKey.slice(0, 40)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "show_seats" },
        (payload) => {
          const row = (payload.new ?? payload.old) as { show_id?: string } | null;
          if (!row?.show_id || !idSet.has(row.show_id)) return;
          if (timerRef.current) clearTimeout(timerRef.current);
          timerRef.current = setTimeout(() => {
            qc.invalidateQueries({ queryKey: invalidateKey });
          }, 250);
        },
      )
      .subscribe();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);
}

type ShowRow = {
  id: string;
  starts_at: string;
  screen?: { name: string } | null;
};

function ShowtimesPanel({
  grouped,
  occupancy,
  basePrice,
}: {
  grouped: [string, ShowRow[]][];
  occupancy: Record<string, { total: number; available: number }>;
  basePrice: number;
}) {
  const [activeDay, setActiveDay] = useState<string | null>(grouped[0]?.[0] ?? null);
  if (grouped.length === 0) {
    return (
      <section className="mt-12 rounded-2xl border border-border/60 bg-card/40 p-6 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.8)]">
        <h2 className="font-mono text-sm uppercase tracking-[0.35em] text-foreground">Showtimes</h2>
        <p className="mt-4 text-muted-foreground">No upcoming shows scheduled.</p>
      </section>
    );
  }
  const active = grouped.find(([d]) => d === activeDay) ?? grouped[0];
  const activeList = active[1];
  const todayStr = new Date().toDateString();

  return (
    <section className="mt-12 rounded-2xl border border-border/60 bg-card/40 p-6 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.8)] sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="font-mono text-sm uppercase tracking-[0.35em] text-foreground">Showtimes</h2>
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <LegendDot className="bg-emerald-400" label="Available" />
          <LegendDot className="bg-primary" label="Filling Fast" />
          <LegendDot className="bg-destructive" label="Sold Out" />
        </div>
      </div>

      {/* Desktop / tablet: horizontal date tabs */}
      <div className="mt-6 hidden gap-2 overflow-x-auto pb-2 sm:flex">
        {grouped.map(([day, list]) => {
          const d = new Date(list[0].starts_at);
          const isToday = day === todayStr;
          const weekday = isToday ? "Today" : d.toLocaleDateString(undefined, { weekday: "short" });
          const label = `${d.toLocaleDateString(undefined, { day: "2-digit" })} ${d.toLocaleDateString(undefined, { month: "short" })}`;
          const isActive = day === active[0];
          return (
            <button
              key={day}
              type="button"
              onClick={() => setActiveDay(day)}
              className={`shrink-0 rounded-xl border px-4 py-2.5 text-left transition ${
                isActive
                  ? "border-primary bg-primary/10 shadow-[0_0_24px_-10px_var(--color-primary)]"
                  : "border-border/60 bg-background/40 hover:border-primary/50 hover:bg-primary/5"
              }`}
            >
              <div className={`font-mono text-[0.7rem] uppercase tracking-widest ${isActive ? "text-primary" : "text-muted-foreground"}`}>
                {weekday}
              </div>
              <div className={`mt-0.5 font-mono text-sm ${isActive ? "text-primary" : "text-foreground"}`}>
                {label}
              </div>
            </button>
          );
        })}
      </div>

      {/* Desktop / tablet: showtime cards for the active day */}
      <div className="mt-6 hidden grid-cols-1 gap-3 sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {activeList.map((s) => (
          <ShowtimeCard key={s.id} show={s} occupancy={occupancy[s.id]} basePrice={basePrice} />
        ))}
      </div>

      {/* Phone: dates stacked vertically, each with its own showtime list */}
      <div className="mt-6 space-y-8 sm:hidden">
        {grouped.map(([day, list]) => {
          const d = new Date(list[0].starts_at);
          const isToday = day === todayStr;
          const weekday = isToday ? "Today" : d.toLocaleDateString(undefined, { weekday: "short" });
          const label = `${d.toLocaleDateString(undefined, { day: "2-digit" })} ${d.toLocaleDateString(undefined, { month: "short" })}`;
          return (
            <div key={day}>
              <div className="mb-3 flex items-center gap-3">
                <div className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-2 shadow-[0_0_16px_-8px_var(--color-primary)]">
                  <div className="font-mono text-[0.65rem] uppercase tracking-widest text-primary">{weekday}</div>
                  <div className="font-mono text-sm text-foreground">{label}</div>
                </div>
                <div className="h-px flex-1 bg-border/40" />
              </div>
              <div className="space-y-3">
                {list.map((s) => (
                  <ShowtimeCard key={s.id} show={s} occupancy={occupancy[s.id]} basePrice={basePrice} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ShowtimeCard({
  show,
  occupancy,
  basePrice,
}: {
  show: ShowRow;
  occupancy?: { total: number; available: number };
  basePrice: number;
}) {
  const available = occupancy?.available ?? 0;
  const total = occupancy?.total ?? 0;
  const soldOut = total > 0 && available === 0;
  const fillingFast = !soldOut && total > 0 && available / total < 0.3;
  let statusLabel = "Available";
  let statusChip = "border-emerald-400/40 bg-emerald-400/10 text-emerald-400";
  let seatsTone = "text-emerald-400";
  if (soldOut) {
    statusLabel = "Sold Out";
    statusChip = "border-destructive/40 bg-destructive/10 text-destructive";
    seatsTone = "text-destructive";
  } else if (fillingFast) {
    statusLabel = "Filling Fast";
    statusChip = "border-primary/40 bg-primary/10 text-primary";
    seatsTone = "text-primary";
  }

  const inner = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="font-mono text-xl font-semibold tracking-wide text-foreground">{fmtTime(show.starts_at)}</div>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-widest ${statusChip}`}>{statusLabel}</span>
      </div>
      <div className="mt-2 grid grid-cols-1 gap-0.5 text-xs sm:flex sm:items-center sm:justify-between sm:gap-0">
        <span className="text-muted-foreground">2D · {show.screen?.name ?? "Standard"}</span>
        <span className={`font-mono ${seatsTone}`}>{available} seats left</span>
      </div>
      <div className="mt-3 font-mono text-sm text-primary">{inr(basePrice)}</div>
    </>
  );

  if (soldOut) {
    return (
      <div aria-disabled="true" className="cursor-not-allowed rounded-xl border border-border/40 bg-background/40 p-4 opacity-60">
        {inner}
      </div>
    );
  }
  return (
    <Link
      to="/shows/$showId"
      params={{ showId: show.id }}
      className="group block rounded-xl border border-border/60 bg-background/40 p-4 transition hover:-translate-y-0.5 hover:border-primary hover:shadow-[0_10px_30px_-12px_var(--color-primary)]"
    >
      {inner}
    </Link>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${className}`} />
      {label}
    </span>
  );
}