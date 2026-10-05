
-- 1) movie status
DO $$ BEGIN
  CREATE TYPE public.movie_status AS ENUM ('now_showing', 'coming_soon', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.movies ADD COLUMN IF NOT EXISTS status public.movie_status;
UPDATE public.movies SET status = CASE
  WHEN release_date IS NULL THEN 'archived'::public.movie_status
  WHEN release_date > CURRENT_DATE THEN 'coming_soon'::public.movie_status
  WHEN release_date >= CURRENT_DATE - INTERVAL '180 days' THEN 'now_showing'::public.movie_status
  ELSE 'archived'::public.movie_status
END WHERE status IS NULL;
ALTER TABLE public.movies ALTER COLUMN status SET DEFAULT 'now_showing';
ALTER TABLE public.movies ALTER COLUMN status SET NOT NULL;
CREATE INDEX IF NOT EXISTS movies_status_idx ON public.movies(status);

-- 2) theaters table
CREATE TABLE IF NOT EXISTS public.theaters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  address TEXT,
  lat DOUBLE PRECISION NOT NULL,
  lon DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.theaters TO anon, authenticated;
GRANT ALL ON public.theaters TO service_role;
ALTER TABLE public.theaters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read theaters" ON public.theaters;
CREATE POLICY "Anyone can read theaters" ON public.theaters FOR SELECT USING (true);

-- 3) seed theaters (idempotent by name+city)
INSERT INTO public.theaters (name, city, address, lat, lon)
SELECT * FROM (VALUES
  ('PVR P&M Mall',            'Patna',      'P&M Mall, Patliputra Colony, Patna', 25.6180, 85.1487),
  ('Cinepolis Grand Mall',    'Patna',      'Grand Mall, Dak Bungalow Road, Patna', 25.6100, 85.1345),
  ('PVR MBD Neopolis',        'Jalandhar',  'MBD Neopolis Mall, Ladowali Road, Jalandhar', 31.3260, 75.5762),
  ('PVR Pavilion Mall',       'Ludhiana',   'Pavilion Mall, Ludhiana', 30.8760, 75.8180),
  ('PVR Elante Mall',         'Chandigarh', 'Elante Mall, Industrial Area, Chandigarh', 30.7050, 76.8010),
  ('PVR Phoenix United',      'Lucknow',    'Phoenix United Mall, Alambagh, Lucknow', 26.8560, 80.9930),
  ('PVR Treasure Island',     'Indore',     'Treasure Island Mall, Indore', 22.7240, 75.8830),
  ('Cinepolis Trilium Mall',  'Amritsar',   'Trilium Mall, Amritsar', 31.6970, 74.8639)
) v(name, city, address, lat, lon)
WHERE NOT EXISTS (SELECT 1 FROM public.theaters t WHERE t.name = v.name AND t.city = v.city);

-- 4) screens.theater_id
ALTER TABLE public.screens ADD COLUMN IF NOT EXISTS theater_id UUID REFERENCES public.theaters(id) ON DELETE CASCADE;

-- Ensure one screen per theater. Reuse existing screens for the first N theaters
-- and create new ones for the rest.
WITH t_ordered AS (
  SELECT id, row_number() OVER (ORDER BY created_at) AS rn FROM public.theaters
),
s_ordered AS (
  SELECT id, row_number() OVER (ORDER BY created_at) AS rn FROM public.screens WHERE theater_id IS NULL
)
UPDATE public.screens sc
   SET theater_id = t.id
  FROM t_ordered t JOIN s_ordered s ON s.rn = t.rn
 WHERE sc.id = s.id;

INSERT INTO public.screens (name, total_seats, theater_id)
SELECT 'Screen 1 — ' || t.name, 192, t.id
FROM public.theaters t
WHERE NOT EXISTS (SELECT 1 FROM public.screens s WHERE s.theater_id = t.id);

ALTER TABLE public.screens ALTER COLUMN theater_id SET NOT NULL;

-- 5) shows.theater_id
ALTER TABLE public.shows ADD COLUMN IF NOT EXISTS theater_id UUID REFERENCES public.theaters(id) ON DELETE CASCADE;

-- Redistribute existing shows across theaters round-robin (per movie).
WITH t_ordered AS (
  SELECT id, (row_number() OVER (ORDER BY created_at) - 1) AS rn FROM public.theaters
),
t_count AS (SELECT count(*)::int AS c FROM public.theaters),
show_pos AS (
  SELECT id, ((row_number() OVER (PARTITION BY movie_id ORDER BY starts_at) - 1) % (SELECT c FROM t_count))::bigint AS pick
  FROM public.shows
),
mapping AS (
  SELECT sp.id AS show_id, sc.id AS screen_id, sc.theater_id
    FROM show_pos sp
    JOIN t_ordered t ON t.rn = sp.pick
    JOIN public.screens sc ON sc.theater_id = t.id
)
UPDATE public.shows sh
   SET theater_id = m.theater_id,
       screen_id  = m.screen_id
  FROM mapping m
 WHERE sh.id = m.show_id;

ALTER TABLE public.shows ALTER COLUMN theater_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS shows_theater_id_idx ON public.shows(theater_id);
CREATE INDEX IF NOT EXISTS shows_movie_theater_idx ON public.shows(movie_id, theater_id);
