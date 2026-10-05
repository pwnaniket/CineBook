import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const TMDB = "https://api.themoviedb.org/3";

interface TMDBMovie {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  release_date: string;
  original_language: string;
}

async function tmdb<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const key = process.env.TMDB_API_KEY!;
  const url = new URL(TMDB + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const headers: Record<string, string> = { accept: "application/json" };
  if (key.length > 40) headers.Authorization = `Bearer ${key}`;
  else url.searchParams.set("api_key", key);
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`TMDB ${path} ${res.status}`);
  return (await res.json()) as T;
}

export interface HomeFeedItem {
  tmdb_id: number;
  title: string;
  overview: string;
  poster_url: string | null;
  backdrop_url: string | null;
  imdb_rating: number | null; // real IMDb rating from OMDb (0-10) when available
  imdb_id: string | null;
  tmdb_rating: number | null; // TMDB vote_average, used as fallback
  release_date: string;
  language: string;
  db_id: string | null; // present if we already have this movie in DB → link to detail
}

function mapMovie(
  m: TMDBMovie,
  dbId: string | null,
  extra: { imdb_id: string | null; imdb_rating: number | null },
): HomeFeedItem {
  return {
    tmdb_id: m.id,
    title: m.title,
    overview: m.overview,
    poster_url: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : null,
    backdrop_url: m.backdrop_path ? `https://image.tmdb.org/t/p/w780${m.backdrop_path}` : null,
    tmdb_rating: m.vote_average ? Number(m.vote_average.toFixed(1)) : null,
    imdb_rating: extra.imdb_rating,
    imdb_id: extra.imdb_id,
    release_date: m.release_date,
    language: m.original_language,
    db_id: dbId,
  };
}

/** Fetch imdb_id from TMDB /movie/{id}/external_ids for a list of ids. */
async function fetchImdbIds(tmdbIds: number[]): Promise<Map<number, string | null>> {
  const result = new Map<number, string | null>();
  await Promise.all(
    tmdbIds.map(async (id) => {
      try {
        const ext = await tmdb<{ imdb_id: string | null }>(`/movie/${id}/external_ids`);
        result.set(id, ext.imdb_id ?? null);
      } catch {
        result.set(id, null);
      }
    }),
  );
  return result;
}

/** Fetch real IMDb ratings via OMDb (requires OMDB_API_KEY). */
async function fetchImdbRatings(imdbIds: string[]): Promise<Map<string, number | null>> {
  const key = process.env.OMDB_API_KEY;
  const out = new Map<string, number | null>();
  if (!key || imdbIds.length === 0) return out;
  await Promise.all(
    imdbIds.map(async (id) => {
      try {
        const url = new URL("https://www.omdbapi.com/");
        url.searchParams.set("i", id);
        url.searchParams.set("apikey", key);
        const res = await fetch(url);
        if (!res.ok) { out.set(id, null); return; }
        const j = (await res.json()) as { imdbRating?: string };
        const n = j.imdbRating && j.imdbRating !== "N/A" ? Number(j.imdbRating) : NaN;
        out.set(id, Number.isFinite(n) ? n : null);
      } catch {
        out.set(id, null);
      }
    }),
  );
  return out;
}

/**
 * Fast DB-only feed. Returns "Now showing" movies straight from our catalog
 * with no external API calls. Renders on the home page in ~50ms so the
 * user sees content instantly while TMDB-enriched feeds stream in beside it.
 */
export const getNowShowingFeed = createServerFn({ method: "GET" }).handler(async () => {
  const url = process.env.SUPABASE_URL!;
  const skey = process.env.SUPABASE_PUBLISHABLE_KEY!;
  const sb = createClient<Database>(url, skey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (skey.startsWith("sb_") && h.get("Authorization") === `Bearer ${skey}`) h.delete("Authorization");
        h.set("apikey", skey);
        return fetch(input, { ...init, headers: h });
      },
    },
  });

  const [{ data: bookableRows }, { data: futureShows }] = await Promise.all([
    sb
      .from("movies")
      .select("id, tmdb_id, title, description, poster_url, backdrop_url, rating, release_date, language, is_featured")
      .eq("status", "now_showing"),
    sb.from("shows").select("movie_id").gte("starts_at", new Date().toISOString()),
  ]);
  const bookableIds = new Set((futureShows ?? []).map((s) => s.movie_id));
  const bookable = (bookableRows ?? []).filter((m) => bookableIds.has(m.id));

  const nowShowing: HomeFeedItem[] = bookable
    .slice()
    .sort((a, b) => {
      const af = a.is_featured ? 1 : 0;
      const bf = b.is_featured ? 1 : 0;
      if (bf !== af) return bf - af;
      return (b.rating ?? 0) - (a.rating ?? 0);
    })
    .slice(0, 12)
    .map((m) => ({
      tmdb_id: m.tmdb_id ?? 0,
      title: m.title,
      overview: m.description ?? "",
      poster_url: m.poster_url ?? null,
      backdrop_url: m.backdrop_url ?? null,
      tmdb_rating: m.rating != null ? Number(m.rating) : null,
      imdb_rating: null,
      imdb_id: null,
      release_date: m.release_date ?? "",
      language: m.language ?? "",
      db_id: m.id,
    }));

  return { nowShowing };
});

/**
 * Slow TMDB + OMDb enriched feeds (trending / coming soon). Runs in parallel
 * with `getNowShowingFeed` on the home page inside its own <Suspense> so the
 * page never blocks on external APIs.
 */
export const getTmdbFeeds = createServerFn({ method: "GET" }).handler(async () => {
  const [trendingRes, upcomingRes] = await Promise.all([
    tmdb<{ results: TMDBMovie[] }>("/trending/movie/week"),
    tmdb<{ results: TMDBMovie[] }>("/movie/upcoming", { region: "IN" }),
  ]);

  const today = new Date().toISOString().slice(0, 10);

  const url = process.env.SUPABASE_URL!;
  const skey = process.env.SUPABASE_PUBLISHABLE_KEY!;
  const sb = createClient<Database>(url, skey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (skey.startsWith("sb_") && h.get("Authorization") === `Bearer ${skey}`) h.delete("Authorization");
        h.set("apikey", skey);
        return fetch(input, { ...init, headers: h });
      },
    },
  });

  // Only map TMDB trending to detail pages when we already have the movie
  // in our DB. This lookup is cheap (id + tmdb_id only).
  const { data: dbRows } = await sb
    .from("movies")
    .select("id, tmdb_id")
    .not("tmdb_id", "is", null);
  const idMap = new Map<number, string>();
  for (const r of dbRows ?? []) if (r.tmdb_id != null) idMap.set(r.tmdb_id, r.id);

  // Cap to what the UI actually renders (10 each) so we don't pay for
  // enrichment on movies the user will never see.
  const trending = (trendingRes.results ?? [])
    .filter((m) => m.poster_path)
    .slice(0, 10);

  const upcoming = (upcomingRes.results ?? [])
    .filter((m) => m.poster_path && m.release_date && m.release_date > today)
    .sort((a, b) => a.release_date.localeCompare(b.release_date))
    .slice(0, 10);

  const allIds = Array.from(new Set([...trending, ...upcoming].map((m) => m.id)));
  const imdbIdMap = await fetchImdbIds(allIds);
  const imdbRatingMap = await fetchImdbRatings(
    Array.from(imdbIdMap.values()).filter((v): v is string => !!v),
  );

  const enrich = (m: TMDBMovie) => {
    const imdb_id = imdbIdMap.get(m.id) ?? null;
    const imdb_rating = imdb_id ? imdbRatingMap.get(imdb_id) ?? null : null;
    return mapMovie(m, idMap.get(m.id) ?? null, { imdb_id, imdb_rating });
  };

  return {
    trending: trending.map(enrich),
    upcoming: upcoming.map(enrich),
    hasOmdb: !!process.env.OMDB_API_KEY,
  };
});