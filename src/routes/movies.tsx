import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { searchMovies } from "@/lib/catalog.functions";
import { MovieCard, MovieCardSkeleton } from "@/components/movie-card";
import { Search, Loader2 } from "lucide-react";

export const Route = createFileRoute("/movies")({
  head: () => ({
    meta: [
      { title: "All Movies — CineBook" },
      { name: "description", content: "Browse Bollywood and Hollywood movies now showing at CineBook." },
    ],
  }),
  component: MoviesPage,
});

type Industry = "all" | "Bollywood" | "Hollywood";
const PAGE_SIZE = 20;

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function MoviesPage() {
  const [industry, setIndustry] = useState<Industry>("all");
  const [rawQ, setRawQ] = useState("");
  const q = useDebounced(rawQ, 300);
  const [page, setPage] = useState(0);

  // Reset paging when filters change.
  useEffect(() => { setPage(0); }, [q, industry]);

  const fetchSearch = useServerFn(searchMovies);
  const query = useQuery({
    queryKey: ["movies-search", q, industry, page],
    queryFn: () => fetchSearch({ data: { q, industry, page, pageSize: PAGE_SIZE } }),
    placeholderData: (prev) => prev,
  });

  // Accumulate rows across pages so "Load more" appends.
  const [accum, setAccum] = useState<NonNullable<typeof query.data>["rows"]>([]);
  useEffect(() => {
    if (!query.data) return;
    if (page === 0) setAccum(query.data.rows);
    else setAccum((prev) => {
      const seen = new Set(prev.map((m) => m.id));
      return [...prev, ...query.data!.rows.filter((r) => !seen.has(r.id))];
    });
  }, [query.data, page]);

  const total = query.data?.total ?? 0;
  const hasMore = accum.length < total;
  const showing = accum;
  const initialLoading = query.isLoading && page === 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-primary">Catalog</p>
        <h1 className="mt-1 font-display text-5xl tracking-wide">All movies</h1>
      </header>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">
          {(["all", "Bollywood", "Hollywood"] as Industry[]).map((i) => (
            <button key={i} onClick={() => setIndustry(i)}
              className={"rounded-full border px-4 py-1.5 text-sm font-medium transition-all duration-200 " +
                (industry === i ? "border-primary bg-primary text-primary-foreground" : "border-border/60 text-muted-foreground hover:border-primary/40 hover:text-foreground")}>
              {i === "all" ? "All" : i}
            </button>
          ))}
        </div>
        <label className="relative inline-flex items-center">
          <Search className="absolute left-3 h-4 w-4 text-muted-foreground" />
          <input value={rawQ} onChange={(e) => setRawQ(e.target.value)} placeholder="Search title, genre, language…"
            className="w-full rounded-md border border-border/60 bg-card py-2 pl-9 pr-9 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none transition sm:w-72" />
          {query.isFetching && rawQ !== q && (
            <Loader2 className="absolute right-3 h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </label>
      </div>

      <Grid>
        {initialLoading
          ? Array.from({ length: 10 }).map((_, i) => <MovieCardSkeleton key={i} />)
          : showing.map((m) => <MovieCard key={m.id} movie={m} />)}
      </Grid>

      {!initialLoading && showing.length === 0 && (
        <p className="mt-10 text-center text-muted-foreground">No movies match your search.</p>
      )}

      {hasMore && !initialLoading && (
        <div className="mt-8 flex justify-center">
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={query.isFetching}
            className="inline-flex items-center gap-2 rounded-lg border border-border/60 bg-card px-6 py-2.5 text-sm font-medium transition hover:border-primary hover:text-primary disabled:opacity-40">
            {query.isFetching ? <><Loader2 className="h-4 w-4 animate-spin" /> Loading…</> : `Load more (${total - showing.length} left)`}
          </button>
        </div>
      )}

      {showing.length > 0 && (
        <p className="mt-4 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Showing {showing.length} of {total}
        </p>
      )}
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">{children}</div>
  );
}