import { Link } from "@tanstack/react-router";
import { Star } from "lucide-react";
import { useState } from "react";

export interface MovieSummary {
  id: string;
  title: string;
  industry: string | null;
  language: string | null;
  genre: string | null;
  duration_min: number | null;
  rating: number | null;
  certification: string | null;
  poster_url: string | null;
  description: string | null;
  base_price: number | string | null;
}

export function MovieCard({ movie }: { movie: MovieSummary }) {
  const [imgOk, setImgOk] = useState(true);
  return (
    <Link
      to="/movies/$movieId"
      params={{ movieId: movie.id }}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-border/50 bg-card transition hover:-translate-y-1 hover:border-primary/60 hover:shadow-2xl hover:shadow-primary/10"
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-gradient-to-br from-primary/20 via-secondary/40 to-background">
        {movie.poster_url && imgOk ? (
          <img src={movie.poster_url} alt={movie.title} loading="lazy"
            onError={() => setImgOk(false)}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/30 via-secondary/50 to-background p-4 text-center font-display text-4xl uppercase tracking-widest text-primary/90 drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">
            {movie.title.slice(0, 2)}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent" />
        {movie.rating != null && (
          <span className="absolute right-1.5 top-1.5 flex items-center gap-1 rounded-md bg-black/70 px-1.5 py-0.5 font-mono text-[10px] text-primary backdrop-blur sm:right-2 sm:top-2 sm:px-2 sm:py-1 sm:text-xs">
            <Star className="h-3 w-3 fill-primary" /> {movie.rating}
          </span>
        )}
        {movie.industry && (
          <span className="absolute left-1.5 top-1.5 max-w-[55%] truncate rounded-md bg-primary/90 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-primary-foreground sm:left-2 sm:top-2 sm:px-2 sm:py-1 sm:text-[10px] sm:tracking-widest">
            {movie.industry}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1 p-3">
        <h3 className="line-clamp-1 font-display text-lg tracking-wide">{movie.title}</h3>
        <p className="line-clamp-1 text-xs text-muted-foreground">
          {[movie.genre, movie.duration_min ? `${movie.duration_min}m` : null, movie.certification]
            .filter(Boolean).join(" • ")}
        </p>
      </div>
    </Link>
  );
}

export function MovieCardSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-border/40 bg-card">
      <div className="aspect-[2/3] w-full rounded-t-xl bg-muted" />
      <div className="space-y-2 p-3">
        <div className="h-4 w-3/4 rounded bg-muted" />
        <div className="h-3 w-1/2 rounded bg-muted" />
      </div>
    </div>
  );
}