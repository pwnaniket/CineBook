CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_movies_title_trgm ON public.movies USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_movies_genre_trgm ON public.movies USING gin (genre gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_movies_industry ON public.movies (industry);
CREATE INDEX IF NOT EXISTS idx_movies_is_featured ON public.movies (is_featured DESC, rating DESC);