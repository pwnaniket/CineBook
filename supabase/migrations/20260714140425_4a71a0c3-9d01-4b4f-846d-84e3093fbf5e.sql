
CREATE OR REPLACE FUNCTION public.cancel_booking(p_ref text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_b RECORD;
  v_starts_at TIMESTAMPTZ;
  v_hours NUMERIC;
  v_factor NUMERIC := 0;
  v_refund NUMERIC := 0;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;

  SELECT b.*, s.starts_at INTO v_b
  FROM public.bookings b
  JOIN public.shows s ON s.id = b.show_id
  WHERE b.ref = p_ref AND b.user_id = v_user
  FOR UPDATE OF b;

  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF v_b.status = 'cancelled' THEN RAISE EXCEPTION 'ALREADY_CANCELLED'; END IF;
  IF v_b.checked_in_at IS NOT NULL THEN RAISE EXCEPTION 'ALREADY_USED'; END IF;

  v_hours := EXTRACT(EPOCH FROM (v_b.starts_at - now())) / 3600.0;
  IF v_hours >= 4 THEN v_factor := 1.0;
  ELSIF v_hours >= 2 THEN v_factor := 0.5;
  ELSE v_factor := 0;
  END IF;

  v_refund := round(COALESCE(v_b.subtotal_seats,0) * v_factor, 2);

  -- Release seats
  UPDATE public.show_seats
    SET status = 'available', booking_id = NULL, booked_by = NULL
    WHERE booking_id = v_b.id;

  -- Mark booking cancelled
  UPDATE public.bookings SET status = 'cancelled' WHERE id = v_b.id;

  -- Refund to wallet
  IF v_refund > 0 THEN
    UPDATE public.profiles SET wallet_balance = wallet_balance + v_refund WHERE id = v_user;
    INSERT INTO public.wallet_transactions(user_id, amount, type, description, ref)
    VALUES (v_user, v_refund, 'credit', 'Refund for ' || v_b.ref, v_b.ref);
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'ref', v_b.ref,
    'refund', v_refund,
    'factor', v_factor,
    'hours_until_show', round(v_hours, 2)
  );
END; $$;

GRANT EXECUTE ON FUNCTION public.cancel_booking(text) TO authenticated;
