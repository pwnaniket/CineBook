
-- 1. Add qr_token column
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS qr_token TEXT;

-- Backfill existing rows
UPDATE public.bookings
  SET qr_token = encode(gen_random_bytes(24), 'hex')
  WHERE qr_token IS NULL;

ALTER TABLE public.bookings
  ALTER COLUMN qr_token SET NOT NULL,
  ALTER COLUMN qr_token SET DEFAULT encode(gen_random_bytes(24), 'hex');

CREATE UNIQUE INDEX IF NOT EXISTS bookings_qr_token_key ON public.bookings(qr_token);

-- 2. Update book_seats to generate qr_token
CREATE OR REPLACE FUNCTION public.book_seats(p_show_id uuid, p_seat_codes text[], p_snacks jsonb, p_payment_method payment_method, p_payment_ref text, p_wallet_amount numeric)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user UUID := auth.uid();
  v_booking_id UUID := gen_random_uuid();
  v_ref TEXT;
  v_token TEXT := encode(gen_random_bytes(24), 'hex');
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

  INSERT INTO public.bookings(id, ref, qr_token, user_id, show_id, subtotal_seats, subtotal_snacks, total, payment_method, payment_ref)
  VALUES (v_booking_id, v_ref, v_token, v_user, p_show_id, v_seat_total, 0, v_seat_total, p_payment_method, p_payment_ref);

  INSERT INTO public.booking_seats(booking_id, show_seat_id, seat_code, seat_class, price)
  SELECT v_booking_id, s.id, s.seat_code, s.seat_class, s.price
  FROM public.show_seats s WHERE s.show_id = p_show_id AND s.seat_code = ANY(p_seat_codes);

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
END; $function$;

-- 3. Update redeem_ticket to accept token OR ref, check status, return customer name
CREATE OR REPLACE FUNCTION public.redeem_ticket(p_ref text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_b RECORD; v_result JSONB;
BEGIN
  SELECT b.*, m.title AS movie_title, s.starts_at, sc.name AS screen_name,
         t.name AS theater_name,
         COALESCE(p.full_name, p.display_name, p.email) AS customer_name
    INTO v_b
  FROM public.bookings b
  JOIN public.shows s ON s.id = b.show_id
  JOIN public.movies m ON m.id = s.movie_id
  JOIN public.screens sc ON sc.id = s.screen_id
  LEFT JOIN public.theaters t ON t.id = sc.theater_id
  LEFT JOIN public.profiles p ON p.id = b.user_id
  WHERE b.qr_token = p_ref OR b.ref = p_ref
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
  END IF;

  IF v_b.status = 'cancelled' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'cancelled',
      'movie', v_b.movie_title, 'starts_at', v_b.starts_at, 'ref', v_b.ref);
  END IF;

  IF v_b.checked_in_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_used',
      'checked_in_at', v_b.checked_in_at, 'movie', v_b.movie_title,
      'starts_at', v_b.starts_at, 'ref', v_b.ref,
      'theater', v_b.theater_name, 'screen', v_b.screen_name,
      'customer', v_b.customer_name);
  END IF;

  UPDATE public.bookings SET checked_in_at = now() WHERE id = v_b.id;

  SELECT jsonb_build_object(
    'ok', true, 'ref', v_b.ref, 'movie', v_b.movie_title,
    'starts_at', v_b.starts_at, 'screen', v_b.screen_name,
    'theater', v_b.theater_name, 'customer', v_b.customer_name,
    'seats', (SELECT jsonb_agg(seat_code ORDER BY seat_code) FROM public.booking_seats WHERE booking_id = v_b.id)
  ) INTO v_result;
  RETURN v_result;
END; $function$;
