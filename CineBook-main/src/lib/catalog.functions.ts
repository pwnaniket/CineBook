import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

/** Server-side publishable client for public read-only Data API access. */
function publicClient() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

export const listMovies = createServerFn({ method: "GET" }).handler(async () => {
  const sb = publicClient();
  const { data, error } = await sb
    .from("movies")
    .select("id, title, industry, language, genre, duration_min, rating, certification, poster_url, backdrop_url, description, release_date, base_price, is_featured")
    .order("is_featured", { ascending: false })
    .order("rating", { ascending: false, nullsFirst: false });
  if (error) throw new Error(error.message);
  return data ?? [];
});

/**
 * Server-side search + pagination.
 * Queries the FULL movies table by title/genre — not just the current page —
 * so the search box can find any movie in the catalog.
 */
export const searchMovies = createServerFn({ method: "GET" })
  .inputValidator((data) =>
    z
      .object({
        q: z.string().max(120).default(""),
        industry: z.enum(["all", "Bollywood", "Hollywood"]).default("all"),
        page: z.number().int().min(0).max(50).default(0),
        pageSize: z.number().int().min(1).max(60).default(20),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const sb = publicClient();
    const from = data.page * data.pageSize;
    const to = from + data.pageSize - 1;
    let query = sb
      .from("movies")
      .select("id, title, industry, language, genre, duration_min, rating, certification, poster_url, description, release_date, base_price, is_featured", { count: "exact" })
      .order("release_date", { ascending: false, nullsFirst: false })
      .order("rating", { ascending: false, nullsFirst: false });
    if (data.industry !== "all") query = query.eq("industry", data.industry);
    const q = data.q.trim();
    if (q) query = query.or(`title.ilike.%${q}%,genre.ilike.%${q}%,language.ilike.%${q}%`);
    const { data: rows, error, count } = await query.range(from, to);
    if (error) throw new Error(error.message);
    return { rows: rows ?? [], total: count ?? 0, page: data.page, pageSize: data.pageSize };
  });

export const getMovie = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const sb = publicClient();
    const [{ data: movie }, { data: shows }, { data: theaters }] = await Promise.all([
      sb.from("movies").select("*").eq("id", data.id).maybeSingle(),
      sb.from("shows")
        .select("id, movie_id, screen_id, theater_id, starts_at, screen:screens(name), theater:theaters(id, name, city)")
        .eq("movie_id", data.id)
        .gte("starts_at", new Date().toISOString())
        .order("starts_at"),
      sb.from("theaters").select("id, name, city, address, lat, lon").order("city").order("name"),
    ]);
    if (!movie) throw new Error("Movie not found");

    // Aggregate live seat occupancy per show in one query so the showtimes
    // list can render "12 seats left" / "Filling fast" / "SOLD OUT" without
    // N round-trips.
    const showIds = (shows ?? []).map((s) => s.id);
    const occupancy: Record<string, { total: number; available: number }> = {};
    if (showIds.length) {
      const { data: seatRows } = await sb
        .from("show_seats")
        .select("show_id, status")
        .in("show_id", showIds);
      for (const id of showIds) occupancy[id] = { total: 0, available: 0 };
      for (const r of seatRows ?? []) {
        const o = occupancy[r.show_id];
        if (!o) continue;
        o.total += 1;
        if (r.status === "available") o.available += 1;
      }
    }

    // Lazy-fetch YouTube trailer key from TMDB the first time this movie is
    // viewed, then cache it on the movies row. Failures fall back gracefully
    // to the static backdrop.
    let trailerKey: string | null = (movie as { trailer_key?: string | null }).trailer_key ?? null;
    const tmdbId = (movie as { tmdb_id?: number | null }).tmdb_id ?? null;
    if (!trailerKey && tmdbId && process.env.TMDB_API_KEY) {
      try {
        const key = process.env.TMDB_API_KEY;
        const url = new URL(`https://api.themoviedb.org/3/movie/${tmdbId}/videos`);
        const headers: Record<string, string> = { accept: "application/json" };
        if (key.length > 40) headers.Authorization = `Bearer ${key}`;
        else url.searchParams.set("api_key", key);
        const res = await fetch(url, { headers });
        if (res.ok) {
          const json = (await res.json()) as { results: Array<{ key: string; site: string; type: string; official: boolean; published_at?: string }> };
          const ytAll = (json.results ?? []).filter((v) => v.site === "YouTube");
          const trailers = ytAll.filter((v) => v.type === "Trailer");
          const teasers = ytAll.filter((v) => v.type === "Teaser");
          const clips = ytAll.filter((v) => v.type === "Clip");
          const pool = trailers.length ? trailers : teasers.length ? teasers : clips;
          const pick = pool.find((v) => v.official) ?? pool[0];
          if (pick?.key) {
            trailerKey = pick.key;
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            await supabaseAdmin.from("movies").update({ trailer_key: trailerKey }).eq("id", data.id);
          }
        }
      } catch {
        // silent: fall back to backdrop
      }
    }

    return { movie: { ...movie, trailer_key: trailerKey }, shows: shows ?? [], occupancy, theaters: theaters ?? [] };
  });

export const getShow = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: show, error } = await sb
      .from("shows")
      .select("id, starts_at, movie:movies(id, title, duration_min, certification, poster_url, backdrop_url), screen:screens(id, name)")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !show) throw new Error("Show not found");
    const { data: seats } = await sb
      .from("show_seats")
      .select("id, seat_code, seat_class, row_letter, row_num, col_num, price, status")
      .eq("show_id", data.id)
      .order("row_num")
      .order("col_num");
    return { show, seats: seats ?? [] };
  });

export const listSnacks = createServerFn({ method: "GET" }).handler(async () => {
  const sb = publicClient();
  const { data, error } = await sb.from("snacks").select("*").eq("is_active", true).order("category").order("price");
  if (error) throw new Error(error.message);
  return data ?? [];
});