import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHmac, timingSafeEqual } from "crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Razorpay Test Mode integration.
 *
 * Flow:
 *   1. Client calls createBookingOrder / createTopupOrder → we call Razorpay
 *      Orders API server-side (secret stays here), record a `payments` row,
 *      return { orderId, keyId, amount } to client.
 *   2. Client opens Razorpay Checkout with those values.
 *   3. On success handler, client calls verifyBookingPayment / verifyTopupPayment
 *      with { orderId, paymentId, signature }. We HMAC-verify the signature
 *      against RAZORPAY_KEY_SECRET, then execute the booking/topup RPC.
 *      Nothing is created/credited until the signature verifies.
 */

const RAZORPAY_API = "https://api.razorpay.com/v1";

async function razorpayFetch(path: string, init: RequestInit = {}) {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) throw new Error("Razorpay is not configured.");
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  const res = await fetch(`${RAZORPAY_API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${auth}`,
      ...(init.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (body as any)?.error?.description ?? `Razorpay error (${res.status})`;
    throw new Error(msg);
  }
  return body as any;
}

function verifySignature(orderId: string, paymentId: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) return false;
  const expected = createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(signature, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/* ============================================================================
 * BOOKING
 * ==========================================================================*/

const SnackLine = z.object({ snack_id: z.string().uuid(), quantity: z.number().int().min(1).max(20) });
const CreateBookingOrderInput = z.object({
  showId: z.string().uuid(),
  seatCodes: z.array(z.string().min(1).max(6)).min(1).max(10),
  snacks: z.array(SnackLine).max(20).default([]),
  walletAmount: z.number().min(0).default(0),
});

/**
 * Compute the authoritative outstanding amount server-side (never trust the
 * client) and create a Razorpay order for it. Records a `payments` row.
 */
export const createBookingOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => CreateBookingOrderInput.parse(data))
  .handler(async ({ data, context }) => {
    // Recompute totals server-side from show_seats + snacks.
    const { data: seats, error: seatErr } = await context.supabase
      .from("show_seats")
      .select("seat_code, price, status")
      .eq("show_id", data.showId)
      .in("seat_code", data.seatCodes);
    if (seatErr) throw new Error(seatErr.message);
    if (!seats || seats.length !== data.seatCodes.length) throw new Error("One or more seats not found.");
    const unavailable = seats.filter((s) => s.status !== "available");
    if (unavailable.length > 0) throw new Error("Some seats were just taken. Please pick again.");
    const seatTotal = seats.reduce((sum, s) => sum + Number(s.price), 0);

    let snackTotal = 0;
    if (data.snacks.length > 0) {
      const ids = data.snacks.map((s) => s.snack_id);
      const { data: snackRows, error } = await context.supabase
        .from("snacks").select("id, price").in("id", ids);
      if (error) throw new Error(error.message);
      const priceMap = new Map((snackRows ?? []).map((r) => [r.id, Number(r.price)]));
      for (const s of data.snacks) {
        const p = priceMap.get(s.snack_id);
        if (p == null) throw new Error("Snack not found.");
        snackTotal += p * s.quantity;
      }
    }

    const grand = seatTotal + snackTotal;
    const wallet = Math.min(Math.max(0, data.walletAmount), grand);
    if (wallet > 0) {
      const { data: profile } = await context.supabase
        .from("profiles").select("wallet_balance").eq("id", context.userId).maybeSingle();
      if (!profile || Number(profile.wallet_balance) < wallet) throw new Error("Insufficient wallet balance.");
    }
    const outstanding = Math.round((grand - wallet) * 100) / 100;
    if (outstanding < 1) {
      // Fully covered by wallet — Razorpay minimum is ₹1, so bypass gateway.
      // Client will call verifyBookingPayment with walletOnly=true.
      return { walletOnly: true as const, amount: grand, walletAmount: wallet };
    }

    const receipt = `bk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const order = await razorpayFetch("/orders", {
      method: "POST",
      body: JSON.stringify({
        amount: Math.round(outstanding * 100),
        currency: "INR",
        receipt,
        notes: { purpose: "booking", user_id: context.userId, show_id: data.showId },
      }),
    });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("payments").insert({
      user_id: context.userId,
      purpose: "booking",
      razorpay_order_id: order.id,
      amount: outstanding,
      currency: "INR",
      status: "created",
      notes: { seatCodes: data.seatCodes, showId: data.showId, walletAmount: wallet, snacks: data.snacks },
    });

    return {
      walletOnly: false as const,
      orderId: order.id as string,
      keyId: process.env.RAZORPAY_KEY_ID!,
      amount: outstanding,
      currency: "INR",
      walletAmount: wallet,
    };
  });

const VerifyBookingInput = z.object({
  orderId: z.string().min(4).nullable(),
  paymentId: z.string().min(4).nullable(),
  signature: z.string().min(4).nullable(),
  walletOnly: z.boolean().default(false),
  // Booking payload — re-supplied so we can execute book_seats after verification.
  showId: z.string().uuid(),
  seatCodes: z.array(z.string().min(1).max(6)).min(1).max(10),
  snacks: z.array(SnackLine).max(20).default([]),
  walletAmount: z.number().min(0).default(0),
});

/**
 * Verify the Razorpay signature (or accept wallet-only bookings), then run
 * book_seats which atomically locks seats + debits wallet + creates the
 * booking. If verification fails we mark the payment failed and abort.
 */
export const verifyBookingPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => VerifyBookingInput.parse(data))
  .handler(async ({ data, context }) => {
    let paymentMethod: "wallet" | "card" | "upi" = "wallet";
    let paymentRef = `WALLET-${Date.now().toString(36).toUpperCase()}`;

    if (!data.walletOnly) {
      if (!data.orderId || !data.paymentId || !data.signature) throw new Error("Missing payment credentials.");
      if (!verifySignature(data.orderId, data.paymentId, data.signature)) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin.from("payments").update({ status: "failed" }).eq("razorpay_order_id", data.orderId);
        throw new Error("Payment signature verification failed.");
      }
      // Fetch payment details from Razorpay to record the actual method used.
      try {
        const rp = await razorpayFetch(`/payments/${data.paymentId}`);
        const m: string = rp?.method ?? "card";
        paymentMethod = m === "upi" ? "upi" : m === "wallet" ? "card" : "card";
        paymentRef = `RZP-${data.paymentId}`;
      } catch {
        paymentMethod = "card";
        paymentRef = `RZP-${data.paymentId}`;
      }
    }

    const { data: ref, error } = await context.supabase.rpc("book_seats", {
      p_show_id: data.showId,
      p_seat_codes: data.seatCodes,
      p_snacks: data.snacks,
      p_payment_method: paymentMethod,
      p_payment_ref: paymentRef,
      p_wallet_amount: data.walletAmount,
    });
    if (error) {
      // Booking failed AFTER payment was captured — flag payment for manual review.
      if (!data.walletOnly) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin.from("payments").update({
          status: "captured", razorpay_payment_id: data.paymentId, method: paymentMethod,
          notes: { ...(error.message ? { book_seats_error: error.message } : {}) },
        }).eq("razorpay_order_id", data.orderId!);
      }
      const msg = error.message ?? "BOOKING_FAILED";
      throw new Error(msg.includes("SEATS_UNAVAILABLE")
        ? "One or more of those seats were just taken. Payment will be refunded within 5–7 days."
        : msg.includes("INSUFFICIENT_WALLET")
        ? "Not enough wallet balance."
        : `Booking failed: ${msg}`);
    }

    // Link the booking to the payments row.
    if (!data.walletOnly && data.orderId) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: booking } = await supabaseAdmin
        .from("bookings").select("id").eq("ref", ref as string).maybeSingle();
      await supabaseAdmin.from("payments").update({
        status: "captured",
        razorpay_payment_id: data.paymentId,
        method: paymentMethod,
        booking_id: booking?.id ?? null,
      }).eq("razorpay_order_id", data.orderId);
      if (booking?.id) {
        await supabaseAdmin.from("bookings").update({
          razorpay_order_id: data.orderId,
          razorpay_payment_id: data.paymentId,
          payment_verified: true,
        }).eq("id", booking.id);
      }
    } else {
      // Wallet-only path — still mark verified on the booking row.
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("bookings").update({ payment_verified: true }).eq("ref", ref as string);
    }

    return { ref: ref as string };
  });

/** Mark a booking order failed/cancelled when the checkout modal closes. */
export const markBookingPaymentFailed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ orderId: z.string().min(4), cancelled: z.boolean().default(false) }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("payments").update({
      status: data.cancelled ? "cancelled" : "failed",
    }).eq("razorpay_order_id", data.orderId);
    return { ok: true };
  });

/* ============================================================================
 * WALLET TOP-UP
 * ==========================================================================*/

export const createTopupOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ amount: z.number().int().min(50).max(20000) }).parse(data))
  .handler(async ({ data, context }) => {
    const receipt = `tp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const order = await razorpayFetch("/orders", {
      method: "POST",
      body: JSON.stringify({
        amount: data.amount * 100,
        currency: "INR",
        receipt,
        notes: { purpose: "wallet_topup", user_id: context.userId },
      }),
    });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("payments").insert({
      user_id: context.userId,
      purpose: "wallet_topup",
      razorpay_order_id: order.id,
      amount: data.amount,
      currency: "INR",
      status: "created",
    });
    return {
      orderId: order.id as string,
      keyId: process.env.RAZORPAY_KEY_ID!,
      amount: data.amount,
      currency: "INR",
    };
  });

export const verifyTopupPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({
    orderId: z.string().min(4),
    paymentId: z.string().min(4),
    signature: z.string().min(4),
    amount: z.number().int().min(50).max(20000),
  }).parse(data))
  .handler(async ({ data, context }) => {
    if (!verifySignature(data.orderId, data.paymentId, data.signature)) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("payments").update({ status: "failed" }).eq("razorpay_order_id", data.orderId);
      throw new Error("Payment signature verification failed.");
    }

    // Idempotency: if this order has already been captured, don't double-credit.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("payments").select("status").eq("razorpay_order_id", data.orderId).maybeSingle();
    if (existing?.status === "captured") {
      const { data: profile } = await context.supabase
        .from("profiles").select("wallet_balance").eq("id", context.userId).maybeSingle();
      return { balance: Number(profile?.wallet_balance ?? 0), ref: data.paymentId, alreadyCredited: true };
    }

    const ref = `RZP-${data.paymentId}`;
    const { data: newBal, error } = await supabaseAdmin.rpc("wallet_topup", {
      p_user: context.userId,
      p_amount: data.amount,
      p_ref: ref,
    });
    if (error) throw new Error(error.message);

    let method = "card";
    try {
      const rp = await razorpayFetch(`/payments/${data.paymentId}`);
      method = rp?.method ?? "card";
    } catch {}

    await supabaseAdmin.from("payments").update({
      status: "captured",
      razorpay_payment_id: data.paymentId,
      method,
    }).eq("razorpay_order_id", data.orderId);

    await supabaseAdmin.from("wallet_transactions").update({
      razorpay_payment_id: data.paymentId,
    }).eq("ref", ref);

    return { balance: Number(newBal), ref, alreadyCredited: false };
  });

export const markTopupPaymentFailed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ orderId: z.string().min(4), cancelled: z.boolean().default(false) }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("payments").update({
      status: data.cancelled ? "cancelled" : "failed",
    }).eq("razorpay_order_id", data.orderId);
    return { ok: true };
  });