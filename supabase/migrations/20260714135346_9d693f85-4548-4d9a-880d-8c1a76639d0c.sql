ALTER TABLE public.movies ADD COLUMN IF NOT EXISTS release_date DATE;
CREATE INDEX IF NOT EXISTS idx_movies_release_date ON public.movies(release_date);