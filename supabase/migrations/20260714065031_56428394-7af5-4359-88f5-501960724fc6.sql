
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('admin', 'staff', 'user');
CREATE TYPE public.industry AS ENUM ('Bollywood', 'Hollywood');
CREATE TYPE public.seat_class AS ENUM ('standard', 'executive', 'premium', 'vip');
CREATE TYPE public.seat_status AS ENUM ('available', 'booked');
CREATE TYPE public.booking_status AS ENUM ('confirmed', 'cancelled');
CREATE TYPE public.payment_method AS ENUM ('wallet', 'card', 'upi');
CREATE TYPE public.txn_type AS ENUM ('credit', 'debit');

-- ============ UPDATED_AT HELPER ============
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  wallet_balance NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id AND wallet_balance = (SELECT wallet_balance FROM public.profiles WHERE id = auth.uid()));
CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own roles read" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

-- ============ WALLET TRANSACTIONS ============
CREATE TABLE public.wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  type txn_type NOT NULL,
  description TEXT NOT NULL,
  ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.wallet_transactions TO authenticated;
GRANT ALL ON public.wallet_transactions TO service_role;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own txns read" ON public.wallet_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE INDEX idx_wtxn_user ON public.wallet_transactions(user_id, created_at DESC);

-- ============ NEW USER TRIGGER ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles(id, email, display_name, wallet_balance)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)), 500.00);
  INSERT INTO public.wallet_transactions(user_id, amount, type, description, ref)
  VALUES (NEW.id, 500.00, 'credit', 'Welcome bonus 🎬', 'signup');
  INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ MOVIES ============
CREATE TABLE public.movies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tmdb_id INTEGER UNIQUE,
  title TEXT NOT NULL,
  industry industry NOT NULL,
  language TEXT NOT NULL,
  genre TEXT NOT NULL,
  duration_min INTEGER NOT NULL,
  rating NUMERIC(3,1),
  certification TEXT DEFAULT 'UA',
  poster_url TEXT,
  backdrop_url TEXT,
  description TEXT,
  base_price NUMERIC(10,2) NOT NULL DEFAULT 200,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.movies TO anon, authenticated;
GRANT ALL ON public.movies TO service_role;
ALTER TABLE public.movies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "movies public read" ON public.movies FOR SELECT USING (true);
CREATE INDEX idx_movies_industry ON public.movies(industry);

-- ============ SCREENS ============
CREATE TABLE public.screens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  total_seats INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.screens TO anon, authenticated;
GRANT ALL ON public.screens TO service_role;
ALTER TABLE public.screens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "screens public read" ON public.screens FOR SELECT USING (true);

-- ============ SHOWS ============
CREATE TABLE public.shows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  movie_id UUID NOT NULL REFERENCES public.movies ON DELETE CASCADE,
  screen_id UUID NOT NULL REFERENCES public.screens ON DELETE CASCADE,
  starts_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.shows TO anon, authenticated;
GRANT ALL ON public.shows TO service_role;
ALTER TABLE public.shows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shows public read" ON public.shows FOR SELECT USING (true);
CREATE INDEX idx_shows_movie ON public.shows(movie_id, starts_at);

-- ============ SHOW SEATS ============
CREATE TABLE public.show_seats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id UUID NOT NULL REFERENCES public.shows ON DELETE CASCADE,
  seat_code TEXT NOT NULL,
  seat_class seat_class NOT NULL,
  row_letter TEXT NOT NULL,
  row_num INTEGER NOT NULL,
  col_num INTEGER NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  status seat_status NOT NULL DEFAULT 'available',
  booking_id UUID,
  booked_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(show_id, seat_code)
);
GRANT SELECT ON public.show_seats TO anon, authenticated;
GRANT ALL ON public.show_seats TO service_role;
ALTER TABLE public.show_seats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "seats public read" ON public.show_seats FOR SELECT USING (true);
CREATE INDEX idx_show_seats_show ON public.show_seats(show_id);

-- ============ SNACKS ============
CREATE TABLE public.snacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  description TEXT,
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.snacks TO anon, authenticated;
GRANT ALL ON public.snacks TO service_role;
ALTER TABLE public.snacks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "snacks public read" ON public.snacks FOR SELECT USING (is_active = true);

-- ============ BOOKINGS ============
CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ref TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  show_id UUID NOT NULL REFERENCES public.shows ON DELETE RESTRICT,
  subtotal_seats NUMERIC(10,2) NOT NULL DEFAULT 0,
  subtotal_snacks NUMERIC(10,2) NOT NULL DEFAULT 0,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_method payment_method NOT NULL,
  payment_ref TEXT,
  status booking_status NOT NULL DEFAULT 'confirmed',
  checked_in_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.bookings TO authenticated;
GRANT ALL ON public.bookings TO service_role;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own bookings read" ON public.bookings FOR SELECT USING (auth.uid() = user_id);
CREATE INDEX idx_bookings_user ON public.bookings(user_id, created_at DESC);

CREATE TABLE public.booking_seats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings ON DELETE CASCADE,
  show_seat_id UUID NOT NULL REFERENCES public.show_seats,
  seat_code TEXT NOT NULL,
  seat_class seat_class NOT NULL,
  price NUMERIC(10,2) NOT NULL
);
GRANT SELECT ON public.booking_seats TO authenticated;
GRANT ALL ON public.booking_seats TO service_role;
ALTER TABLE public.booking_seats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own booking_seats read" ON public.booking_seats FOR SELECT USING (
  EXISTS(SELECT 1 FROM public.bookings b WHERE b.id = booking_id AND b.user_id = auth.uid())
);

CREATE TABLE public.booking_snacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings ON DELETE CASCADE,
  snack_id UUID NOT NULL REFERENCES public.snacks,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL
);
GRANT SELECT ON public.booking_snacks TO authenticated;
GRANT ALL ON public.booking_snacks TO service_role;
ALTER TABLE public.booking_snacks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own booking_snacks read" ON public.booking_snacks FOR SELECT USING (
  EXISTS(SELECT 1 FROM public.bookings b WHERE b.id = booking_id AND b.user_id = auth.uid())
);

-- ============ GENERATE SEATS FOR A SHOW ============
-- Layout: rows A..L (12 rows) x 16 columns with center aisle after col 8.
-- Classes: A-B standard, C-F executive, G-I premium, J-L VIP.
CREATE OR REPLACE FUNCTION public.generate_show_seats(p_show_id UUID, p_base_price NUMERIC)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r INT; c INT;
  letter TEXT;
  cls seat_class;
  price NUMERIC;
  inserted INT := 0;
BEGIN
  FOR r IN 1..12 LOOP
    letter := chr(64 + r); -- A..L
    IF r <= 2 THEN cls := 'standard'; price := p_base_price * 0.75;
    ELSIF r <= 6 THEN cls := 'executive'; price := p_base_price * 1.10;
    ELSIF r <= 9 THEN cls := 'premium'; price := p_base_price * 1.50;
    ELSE cls := 'vip'; price := p_base_price * 2.25;
    END IF;
    FOR c IN 1..16 LOOP
      INSERT INTO public.show_seats(show_id, seat_code, seat_class, row_letter, row_num, col_num, price)
      VALUES (p_show_id, letter || c::text, cls, letter, r, c, round(price));
      inserted := inserted + 1;
    END LOOP;
  END LOOP;
  RETURN inserted;
END; $$;

-- ============ ATOMIC BOOKING ============
-- Locks seats, debits wallet, creates booking rows. All-or-nothing.
CREATE OR REPLACE FUNCTION public.book_seats(
  p_show_id UUID,
  p_seat_codes TEXT[],
  p_snacks JSONB,          -- [{snack_id, quantity}]
  p_payment_method payment_method,
  p_payment_ref TEXT,
  p_wallet_amount NUMERIC  -- how much of the total to charge to wallet (>=0)
) RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user UUID := auth.uid();
  v_booking_id UUID := gen_random_uuid();
  v_ref TEXT;
  v_seat_total NUMERIC := 0;
  v_snack_total NUMERIC := 0;
  v_updated INT;
  v_expected INT := array_length(p_seat_codes, 1);
  v_snack RECORD;
  v_wallet NUMERIC;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF v_expected IS NULL OR v_expected = 0 THEN RAISE EXCEPTION 'NO_SEATS'; END IF;
  IF v_expected > 10 THEN RAISE EXCEPTION 'TOO_MANY_SEATS'; END IF;

  v_ref := 'CB-' || upper(substr(replace(v_booking_id::text,'-',''),1,8));

  -- Lock and flip seats atomically
  WITH updated AS (
    UPDATE public.show_seats
    SET status='booked', booking_id=v_booking_id, booked_by=v_user
    WHERE show_id = p_show_id AND seat_code = ANY(p_seat_codes) AND status='available'
    RETURNING price
  )
  SELECT COUNT(*), COALESCE(SUM(price),0) INTO v_updated, v_seat_total FROM updated;

  IF v_updated <> v_expected THEN
    RAISE EXCEPTION 'SEATS_UNAVAILABLE';
  END IF;

  -- Insert booking placeholder
  INSERT INTO public.bookings(id, ref, user_id, show_id, subtotal_seats, subtotal_snacks, total, payment_method, payment_ref)
  VALUES (v_booking_id, v_ref, v_user, p_show_id, v_seat_total, 0, v_seat_total, p_payment_method, p_payment_ref);

  -- booking_seats
  INSERT INTO public.booking_seats(booking_id, show_seat_id, seat_code, seat_class, price)
  SELECT v_booking_id, s.id, s.seat_code, s.seat_class, s.price
  FROM public.show_seats s WHERE s.show_id = p_show_id AND s.seat_code = ANY(p_seat_codes);

  -- snacks
  IF p_snacks IS NOT NULL THEN
    FOR v_snack IN SELECT * FROM jsonb_to_recordset(p_snacks) AS x(snack_id UUID, quantity INT) LOOP
      IF v_snack.quantity > 0 THEN
        INSERT INTO public.booking_snacks(booking_id, snack_id, name, quantity, unit_price)
        SELECT v_booking_id, s.id, s.name, v_snack.quantity, s.price FROM public.snacks s WHERE s.id = v_snack.snack_id;
        v_snack_total := v_snack_total + (SELECT price * v_snack.quantity FROM public.snacks WHERE id = v_snack.snack_id);
      END IF;
    END LOOP;
  END IF;

  UPDATE public.bookings SET subtotal_snacks = v_snack_total, total = v_seat_total + v_snack_total WHERE id = v_booking_id;

  -- Wallet debit (atomic in same txn)
  IF p_wallet_amount > 0 THEN
    SELECT wallet_balance INTO v_wallet FROM public.profiles WHERE id = v_user FOR UPDATE;
    IF v_wallet < p_wallet_amount THEN
      RAISE EXCEPTION 'INSUFFICIENT_WALLET';
    END IF;
    UPDATE public.profiles SET wallet_balance = wallet_balance - p_wallet_amount WHERE id = v_user;
    INSERT INTO public.wallet_transactions(user_id, amount, type, description, ref)
    VALUES (v_user, p_wallet_amount, 'debit', 'Booking ' || v_ref, v_ref);
  END IF;

  RETURN v_ref;
END; $$;

-- ============ WALLET TOPUP (server-only) ============
CREATE OR REPLACE FUNCTION public.wallet_topup(p_user UUID, p_amount NUMERIC, p_ref TEXT)
RETURNS NUMERIC LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_new NUMERIC;
BEGIN
  IF p_amount <= 0 THEN RAISE EXCEPTION 'INVALID_AMOUNT'; END IF;
  UPDATE public.profiles SET wallet_balance = wallet_balance + p_amount WHERE id = p_user RETURNING wallet_balance INTO v_new;
  INSERT INTO public.wallet_transactions(user_id, amount, type, description, ref)
  VALUES (p_user, p_amount, 'credit', 'Wallet top-up', p_ref);
  RETURN v_new;
END; $$;

-- ============ REDEEM TICKET (server calls this after PIN check) ============
CREATE OR REPLACE FUNCTION public.redeem_ticket(p_ref TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_b RECORD; v_result JSONB;
BEGIN
  SELECT b.*, m.title AS movie_title, s.starts_at, sc.name AS screen_name
    INTO v_b
  FROM public.bookings b
  JOIN public.shows s ON s.id = b.show_id
  JOIN public.movies m ON m.id = s.movie_id
  JOIN public.screens sc ON sc.id = s.screen_id
  WHERE b.ref = p_ref;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF v_b.checked_in_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_used',
      'checked_in_at', v_b.checked_in_at, 'movie', v_b.movie_title, 'starts_at', v_b.starts_at, 'ref', v_b.ref);
  END IF;

  UPDATE public.bookings SET checked_in_at = now() WHERE id = v_b.id;

  SELECT jsonb_build_object(
    'ok', true, 'ref', v_b.ref, 'movie', v_b.movie_title, 'starts_at', v_b.starts_at, 'screen', v_b.screen_name,
    'seats', (SELECT jsonb_agg(seat_code ORDER BY seat_code) FROM public.booking_seats WHERE booking_id = v_b.id)
  ) INTO v_result;
  RETURN v_result;
END; $$;

-- ============ SCREENS + SNACKS SEED ============
INSERT INTO public.screens(name, total_seats) VALUES
  ('Screen 1 — Marquee Hall', 192),
  ('Screen 2 — Velvet Lounge', 192);

INSERT INTO public.snacks(name, category, price, description, image_url) VALUES
  ('Regular Salted Popcorn', 'Popcorn', 180, 'Freshly popped, lightly salted', null),
  ('Large Salted Popcorn', 'Popcorn', 260, 'Sharing size, lightly salted', null),
  ('Caramel Popcorn', 'Popcorn', 220, 'Sweet & buttery caramel glaze', null),
  ('Cheese Popcorn', 'Popcorn', 240, 'Warm cheddar cheese coating', null),
  ('Coca-Cola (Regular)', 'Beverages', 120, 'Chilled 350ml', null),
  ('Coca-Cola (Large)', 'Beverages', 180, 'Chilled 500ml', null),
  ('Sprite', 'Beverages', 120, 'Lemon-lime, chilled', null),
  ('Bottled Water', 'Beverages', 60, '500ml still water', null),
  ('Popcorn + Coke Combo', 'Combos', 340, 'Large popcorn + large Coke', null),
  ('Nachos with Salsa', 'Snacks', 220, 'Crispy corn nachos with tomato salsa', null),
  ('Veg Samosa (2 pc)', 'Snacks', 140, 'Crispy pastry with spiced potato', null),
  ('Choco Lava Cake', 'Desserts', 180, 'Warm chocolate cake with molten center', null),
  ('Vanilla Ice Cream Cup', 'Desserts', 120, 'Classic French vanilla', null);
