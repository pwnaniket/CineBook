import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Confirm a booking. Server-side entry point that:
 *   1. Validates the request
 *   2. Calls the `book_seats` SECURITY DEFINER Postgres function, which
 *      atomically locks seats, debits wallet (if any), and creates the
 *      booking rows in a SINGLE transaction. If ANY step fails the whole
 *      thing rolls back.
 *
 * The client cannot mutate any of the underlying tables directly — RLS
 * blocks it — so this RPC is the ONLY way to book.
 */
const SnackLine = z.object({ snack_id: z.string().uuid(), quantity: z.number().int().min(1).max(20) });
const Input = z.object({
  showId: z.string().uuid(),
  seatCodes: z.array(z.string().min(1).max(6)).min(1).max(10),
  snacks: z.array(SnackLine).max(20).default([]),
  paymentMethod: z.enum(["wallet", "card", "upi"]),
  paymentRef: z.string().max(128).nullable().default(null),
  walletAmount: z.number().min(0).default(0),
});

export const confirmBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => Input.parse(data))
  .handler(async ({ data, context }) => {
    const { data: ref, error } = await context.supabase.rpc("book_seats", {
      p_show_id: data.showId,
      p_seat_codes: data.seatCodes,
      p_snacks: data.snacks,
      p_payment_method: data.paymentMethod,
      p_payment_ref: data.paymentRef ?? "",
      p_wallet_amount: data.walletAmount,
    });
    if (error) {
      const msg = error.message ?? "BOOKING_FAILED";
      console.error("[confirmBooking] RPC error:", error);
      throw new Error(msg.includes("SEATS_UNAVAILABLE")
        ? "One or more of those seats were just taken. Please pick again."
        : msg.includes("INSUFFICIENT_WALLET")
        ? "Not enough wallet balance for this booking."
        : msg.includes("AUTH_REQUIRED")
        ? "You need to be signed in to book."
        : msg.includes("TOO_MANY_SEATS")
        ? "You can book at most 10 seats per order."
        : `Booking failed: ${msg}`);
    }
    return { ref: ref as string };
  });

/** Read the signed-in user's bookings (with joined show + movie info). */
export const listMyBookings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("bookings")
      .select(
        `id, ref, total, status, checked_in_at, created_at, payment_method,
         show:shows(id, starts_at, movie:movies(id, title, poster_url), screen:screens(name)),
         seats:booking_seats(seat_code, seat_class, price),
         snacks:booking_snacks(name, quantity, unit_price)`,
      )
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/** Read one booking by ref for the confirmation page. */
export const getBookingByRef = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ ref: z.string().min(4).max(64) }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: booking, error } = await context.supabase
      .from("bookings")
      .select(
        `id, ref, qr_token, total, subtotal_seats, subtotal_snacks, status, checked_in_at, created_at, payment_method, payment_ref,
         show:shows(id, starts_at, movie:movies(id, title, poster_url, backdrop_url, duration_min, certification), screen:screens(name, theater:theaters(name, city))),
         seats:booking_seats(seat_code, seat_class, price),
         snacks:booking_snacks(name, quantity, unit_price)`,
      )
      .eq("ref", data.ref)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!booking) throw new Error("Booking not found");
    return booking;
  });

/** Cancel a booking. Applies tiered refund to wallet and releases seats. */
export const cancelBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ ref: z.string().min(4).max(64) }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.rpc("cancel_booking", { p_ref: data.ref });
    if (error) {
      const msg = error.message ?? "CANCEL_FAILED";
      console.error("[cancelBooking] RPC error:", error);
      throw new Error(
        msg.includes("ALREADY_CANCELLED") ? "This booking is already cancelled."
        : msg.includes("ALREADY_USED") ? "This ticket has already been used and can't be cancelled."
        : msg.includes("NOT_FOUND") ? "Booking not found."
        : msg.includes("AUTH_REQUIRED") ? "Please sign in to cancel."
        : `Cancellation failed: ${msg}`
      );
    }
    return result as { ok: boolean; ref: string; refund: number; factor: number; hours_until_show: number };
  });