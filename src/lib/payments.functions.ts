import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** List all payments (bookings + top-ups) for the signed-in user. */
export const listPayments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("payments")
      .select(
        `id, purpose, razorpay_order_id, razorpay_payment_id, amount, currency,
         status, method, created_at, updated_at,
         booking:bookings(ref, show:shows(starts_at, movie:movies(title)))`,
      )
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/** Fetch the payment row linked to a specific booking (by ref). */
export const getPaymentForBooking = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ ref: z.string().min(4).max(64) }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: booking } = await context.supabase
      .from("bookings").select("id").eq("ref", data.ref).maybeSingle();
    if (!booking) return null;
    const { data: payment } = await context.supabase
      .from("payments")
      .select("razorpay_order_id, razorpay_payment_id, amount, currency, status, method, created_at, purpose")
      .eq("booking_id", booking.id)
      .order("created_at", { ascending: false })
      .maybeSingle();
    return payment ?? null;
  });