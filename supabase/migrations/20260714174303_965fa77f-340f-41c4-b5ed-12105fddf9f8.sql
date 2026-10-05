
-- 1) Simulated flag on seats (never touched for real user bookings)
ALTER TABLE public.show_seats
  ADD COLUMN IF NOT EXISTS is_simulated boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_show_seats_sim
  ON public.show_seats(show_id) WHERE is_simulated;

-- 2) Target occupancy for a given show (0..1)
CREATE OR REPLACE FUNCTION public.sim_target_occupancy(p_show_id uuid)
RETURNS numeric
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_start timestamptz; v_rating numeric; v_featured boolean; v_release date;
  v_hour int; v_dow int; v_days int;
  v_base numeric; v_time numeric; v_day numeric; v_rel numeric; v_target numeric;
BEGIN
  SELECT s.starts_at, m.rating, m.is_featured, m.release_date
    INTO v_start, v_rating, v_featured, v_release
  FROM public.shows s JOIN public.movies m ON m.id = s.movie_id
  WHERE s.id = p_show_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  -- Base demand from popularity signals
  v_base := 0.32;
  IF v_featured THEN v_base := 0.78; END IF;
  IF v_rating IS NOT NULL THEN
    IF v_rating >= 8.0 THEN v_base := GREATEST(v_base, 0.74);
    ELSIF v_rating >= 7.0 THEN v_base := GREATEST(v_base, 0.55);
    ELSIF v_rating >= 6.0 THEN v_base := GREATEST(v_base, 0.40);
    ELSIF v_rating < 5.0 THEN v_base := LEAST(v_base, 0.22);
    END IF;
  END IF;

  v_hour := EXTRACT(HOUR FROM v_start AT TIME ZONE 'Asia/Kolkata')::int;
  v_dow  := EXTRACT(ISODOW FROM v_start AT TIME ZONE 'Asia/Kolkata')::int; -- 1..7

  -- Time of day
  IF v_hour BETWEEN 9 AND 11 THEN v_time := 0.45;
  ELSIF v_hour BETWEEN 12 AND 16 THEN v_time := 0.78;
  ELSIF v_hour BETWEEN 17 AND 21 THEN v_time := 1.18;
  ELSE v_time := 0.70;
  END IF;

  -- Day of week
  IF v_dow = 6 THEN v_day := 1.22;      -- Saturday
  ELSIF v_dow = 7 THEN v_day := 1.12;   -- Sunday
  ELSIF v_dow = 5 THEN v_day := 1.10;   -- Friday
  ELSE v_day := 0.86;
  END IF;

  -- Release recency
  IF v_release IS NULL THEN v_rel := 0.85;
  ELSE
    v_days := GREATEST(0, (CURRENT_DATE - v_release));
    IF v_days <= 14 THEN v_rel := 1.15;
    ELSIF v_days <= 42 THEN v_rel := 0.90;
    ELSE v_rel := 0.55;
    END IF;
  END IF;

  v_target := v_base * v_time * v_day * v_rel;
  -- deterministic ±5% jitter per show so every show is slightly unique
  v_target := v_target + (((abs(hashtext(p_show_id::text)) % 100)::numeric / 1000.0) - 0.05);
  RETURN GREATEST(0.05, LEAST(0.98, v_target));
END; $$;

-- 3) One drift step for a show (small +/- change toward target)
CREATE OR REPLACE FUNCTION public.sim_step_show(p_show_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_total int; v_real int; v_sim int; v_target_pct numeric;
  v_target int; v_delta int; v_step int;
BEGIN
  SELECT count(*),
         count(*) FILTER (WHERE status='booked' AND NOT is_simulated),
         count(*) FILTER (WHERE status='booked' AND is_simulated)
    INTO v_total, v_real, v_sim
  FROM public.show_seats WHERE show_id = p_show_id;
  IF v_total = 0 THEN RETURN; END IF;

  v_target_pct := public.sim_target_occupancy(p_show_id);
  v_target := floor(v_total * v_target_pct)::int;
  v_delta := GREATEST(0, v_target - v_real) - v_sim;

  IF v_delta > 0 THEN
    v_step := LEAST(v_delta, 6 + (abs(hashtext(p_show_id::text || now()::text)) % 4));
    WITH pick AS (
      SELECT id FROM public.show_seats
      WHERE show_id = p_show_id AND status = 'available'
      ORDER BY
        CASE seat_class WHEN 'premium' THEN 1 WHEN 'executive' THEN 2 WHEN 'vip' THEN 3 ELSE 4 END,
        random()
      LIMIT v_step
    )
    UPDATE public.show_seats
       SET status = 'booked', is_simulated = true
     WHERE id IN (SELECT id FROM pick);
  ELSIF v_delta < 0 THEN
    v_step := LEAST(-v_delta, 3);
    WITH pick AS (
      SELECT id FROM public.show_seats
      WHERE show_id = p_show_id
        AND status = 'booked' AND is_simulated = true
        AND booking_id IS NULL
      ORDER BY random() LIMIT v_step
    )
    UPDATE public.show_seats
       SET status = 'available', is_simulated = false
     WHERE id IN (SELECT id FROM pick);
  END IF;
END; $$;

-- 4) Drift step across all upcoming shows in the next 10 days
CREATE OR REPLACE FUNCTION public.sim_step_all()
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE r RECORD; c int := 0;
BEGIN
  FOR r IN
    SELECT id FROM public.shows
    WHERE starts_at BETWEEN now() AND now() + interval '10 days'
    ORDER BY starts_at
    LIMIT 600
  LOOP
    PERFORM public.sim_step_show(r.id);
    c := c + 1;
  END LOOP;
  RETURN c;
END; $$;

-- 5) Initial big seed: jump each show straight to target (respecting real bookings)
CREATE OR REPLACE FUNCTION public.sim_seed_all()
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r RECORD; v_total int; v_real int; v_sim int; v_target_pct numeric;
  v_target int; v_need int; c int := 0;
BEGIN
  FOR r IN
    SELECT id FROM public.shows
    WHERE starts_at BETWEEN now() AND now() + interval '10 days'
  LOOP
    SELECT count(*),
           count(*) FILTER (WHERE status='booked' AND NOT is_simulated),
           count(*) FILTER (WHERE status='booked' AND is_simulated)
      INTO v_total, v_real, v_sim
    FROM public.show_seats WHERE show_id = r.id;
    IF v_total = 0 THEN CONTINUE; END IF;
    v_target_pct := public.sim_target_occupancy(r.id);
    v_target := floor(v_total * v_target_pct)::int;
    v_need := v_target - v_real - v_sim;
    IF v_need > 0 THEN
      WITH pick AS (
        SELECT id FROM public.show_seats
        WHERE show_id = r.id AND status = 'available'
        ORDER BY
          CASE seat_class WHEN 'premium' THEN 1 WHEN 'executive' THEN 2 WHEN 'vip' THEN 3 ELSE 4 END,
          random()
        LIMIT v_need
      )
      UPDATE public.show_seats
         SET status = 'booked', is_simulated = true
       WHERE id IN (SELECT id FROM pick);
    END IF;
    c := c + 1;
  END LOOP;
  RETURN c;
END; $$;

-- 6) Run initial seed
SELECT public.sim_seed_all();

-- 7) Schedule background drift every 3 minutes
CREATE EXTENSION IF NOT EXISTS pg_cron;
DO $$ BEGIN
  PERFORM cron.unschedule('cinebook-sim-step');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule('cinebook-sim-step', '*/3 * * * *', $$SELECT public.sim_step_all();$$);
