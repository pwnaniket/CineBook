/**
 * One-time seed endpoint. Fetches popular Bollywood + Hollywood movies from
 * TMDB and materializes them (plus a schedule of shows and generated seats)
 * into the database. Idempotent: skips movies already present by tmdb_id.
 *
 * Auth: requires header `x-seed-token: <STAFF_PIN>` — the same server-side
 * shared secret used by the scanner. Rate-limited to one call per movie by
 * the `movies_tmdb_id_key` UNIQUE constraint.
 */
import { createFileRoute } from "@tanstack/react-router";

const TMDB = "https://api.themoviedb.org/3";

interface TMDBMovie {
  id: number;
  title: string;
  original_language: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  release_date: string;
  genre_ids: number[];
}

interface TMDBDetails {
  runtime: number | null;
  genres: { id: number; name: string }[];
}

async function tmdb<T>(path: string, params: Record<string, string>, key: string): Promise<T> {
  const url = new URL(TMDB + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const headers: Record<string, string> = { accept: "application/json" };
  // TMDB accepts either a v3 api_key query param or a v4 Bearer token.
  if (key.length > 40) headers.Authorization = `Bearer ${key}`;
  else url.searchParams.set("api_key", key);
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`TMDB ${path} failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

export const Route = createFileRoute("/api/public/hooks/seed-movies")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("x-seed-token");
        if (!token || token !== process.env.STAFF_PIN) {
          return new Response("Unauthorized", { status: 401 });
        }
        const tmdbKey = process.env.TMDB_API_KEY;
        if (!tmdbKey) return new Response("TMDB_API_KEY missing", { status: 500 });
        const url = new URL(request.url);
        const industryFilter = url.searchParams.get("industry"); // "Bollywood" | "Hollywood" | null
        const maxParam = Number(url.searchParams.get("max") ?? "150");
        const withShows = url.searchParams.get("shows") !== "false";
        const started = Date.now();

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Bollywood = hi, Hollywood = en. Mix discover sorts across many pages for variety.
        const key: string = tmdbKey;
        async function fetchIndustry(lang: string, minVotes: string) {
          const sorts = ["popularity.desc", "vote_average.desc", "primary_release_date.desc"];
          const seen = new Map<number, TMDBMovie>();
          // Pull 8 pages per sort in parallel to build a diverse pool.
          const jobs: Promise<{ results: TMDBMovie[] }>[] = [];
          for (const sort of sorts) {
            for (let p = 1; p <= 8; p++) {
              jobs.push(tmdb<{ results: TMDBMovie[] }>("/discover/movie", {
                sort_by: sort, with_original_language: lang,
                "vote_count.gte": minVotes, include_adult: "false", page: String(p),
              }, key));
            }
          }
          const pages = await Promise.all(jobs);
          for (const pg of pages) for (const m of pg.results) if (!seen.has(m.id)) seen.set(m.id, m);
          return Array.from(seen.values());
        }
        const wantBolly = !industryFilter || industryFilter === "Bollywood";
        const wantHolly = !industryFilter || industryFilter === "Hollywood";
        const [bolly, holly] = await Promise.all([
          wantBolly ? fetchIndustry("hi", "20") : Promise.resolve([]),
          wantHolly ? fetchIndustry("en", "300") : Promise.resolve([]),
        ]);
        // Require BOTH poster and backdrop so no broken references get saved.
        const clean = (arr: TMDBMovie[]) => arr.filter((m) => m.poster_path && m.backdrop_path);
        const shortlist: Array<TMDBMovie & { industry: "Bollywood" | "Hollywood" }> = [
          ...clean(bolly).slice(0, maxParam).map((m) => ({ ...m, industry: "Bollywood" as const })),
          ...clean(holly).slice(0, maxParam).map((m) => ({ ...m, industry: "Hollywood" as const })),
        ];

        // Filter out already-imported TMDB ids in one query rather than N sequential lookups.
        const { data: existingRows } = await supabaseAdmin
          .from("movies").select("tmdb_id").in("tmdb_id", shortlist.map((m) => m.id));
        const existingIds = new Set((existingRows ?? []).map((r) => r.tmdb_id));
        const toImport = shortlist.filter((m) => !existingIds.has(m.id));

        // Fetch details in parallel batches of 30 to speed up import massively.
        const GENRE_MAP: Record<number, string> = {
          28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy", 80: "Crime",
          99: "Documentary", 18: "Drama", 10751: "Family", 14: "Fantasy", 36: "History",
          27: "Horror", 10402: "Music", 9648: "Mystery", 10749: "Romance",
          878: "Sci-Fi", 10770: "TV Movie", 53: "Thriller", 10752: "War", 37: "Western",
        };
        const inserted: string[] = [];
        const skipped = shortlist.length - toImport.length;

        const { data: screens } = await supabaseAdmin.from("screens").select("id, theater_id").order("name");

        const BATCH = 30;
        for (let i = 0; i < toImport.length; i += BATCH) {
          const batch = toImport.slice(i, i + BATCH);
          const details = await Promise.all(
            batch.map((m) =>
              tmdb<TMDBDetails>(`/movie/${m.id}`, {}, key).catch(() => null),
            ),
          );
          const rows = batch.map((m, idx) => {
            const d = details[idx];
            const genreFromDetails = d?.genres.slice(0, 2).map((g) => g.name).join(" • ");
            const genreFromIds = m.genre_ids.slice(0, 2).map((id) => GENRE_MAP[id]).filter(Boolean).join(" • ");
            const genre = genreFromDetails || genreFromIds || "Drama";
            return {
              tmdb_id: m.id,
              title: m.title,
              industry: m.industry,
              language: m.original_language === "hi" ? "Hindi" : "English",
              genre,
              duration_min: d?.runtime ?? 130,
              rating: m.vote_average ? Number(m.vote_average.toFixed(1)) : null,
              certification: "UA",
              poster_url: `https://image.tmdb.org/t/p/w500${m.poster_path}`,
              backdrop_url: `https://image.tmdb.org/t/p/original${m.backdrop_path}`,
              description: m.overview,
              release_date: m.release_date || null,
              base_price: m.industry === "Bollywood" ? 200 : 250,
              is_featured: (inserted.length + idx) < 6,
            };
          });
          const { data: insertedRows, error: mErr } = await supabaseAdmin
            .from("movies").insert(rows).select("id, title, base_price");
          if (mErr) throw new Error(`Batch insert failed: ${mErr.message}`);
          for (const r of insertedRows ?? []) inserted.push(r.title);

          // Create shows for the newly inserted movies (unless disabled).
          if (withShows && screens && screens.length > 0 && insertedRows) {
            const slots = [[11, 0], [14, 30], [18, 0], [21, 15]];
            const now = new Date();
            const showRows: { movie_id: string; screen_id: string; theater_id: string; starts_at: string; base_price: number }[] = [];
            insertedRows.forEach((movie, mi) => {
              for (let dayOffset = 0; dayOffset < 3; dayOffset++) {
                for (let s = 0; s < 2; s++) {
                  const screen = screens[(dayOffset + s + mi) % screens.length];
                  const [h, mm] = slots[(s + dayOffset + mi) % slots.length];
                  const dt = new Date(now);
                  dt.setDate(dt.getDate() + dayOffset);
                  dt.setHours(h, mm, 0, 0);
                  if (dt.getTime() < now.getTime() + 30 * 60 * 1000) continue;
                  showRows.push({ movie_id: movie.id, screen_id: screen.id, theater_id: screen.theater_id, starts_at: dt.toISOString(), base_price: Number(movie.base_price) });
                }
              }
            });
            if (showRows.length) {
              const { data: showsIns } = await supabaseAdmin
                .from("shows")
                .insert(showRows.map(({ base_price: _bp, ...r }) => r))
                .select("id, movie_id");
              // Generate seats in parallel per show.
              if (showsIns) {
                const byMovie = new Map(showRows.map((r) => [r.movie_id, r.base_price]));
                await Promise.all(showsIns.map((sh) =>
                  supabaseAdmin.rpc("generate_show_seats", { p_show_id: sh.id, p_base_price: byMovie.get(sh.movie_id) ?? 200 }),
                ));
              }
            }
          }
        }

        // Backfill release_date for existing movies that were inserted before the column existed.
        const { data: missingDateRows } = await supabaseAdmin
          .from("movies")
          .select("id, tmdb_id")
          .is("release_date", null)
          .not("tmdb_id", "is", null);
        const dateByTmdb = new Map(shortlist.map((m) => [m.id, m.release_date]));
        const updates: { id: string; release_date: string | null }[] = [];
        for (const row of missingDateRows ?? []) {
          const rd = dateByTmdb.get(row.tmdb_id!);
          if (rd) updates.push({ id: row.id, release_date: rd });
        }
        let backfilled = 0;
        for (const u of updates) {
          const { error: updErr } = await supabaseAdmin
            .from("movies")
            .update({ release_date: u.release_date })
            .eq("id", u.id);
          if (!updErr) backfilled++;
        }

        return Response.json({
          totalInserted: inserted.length,
          totalSkipped: skipped,
          backfilledReleaseDate: backfilled,
          poolBolly: bolly.length,
          poolHolly: holly.length,
          ms: Date.now() - started,
        });
      },
    },
  },
});