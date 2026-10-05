import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Return wallet balance + last N transactions for the signed-in user. */
export const getWallet = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: profile }, { data: txns }] = await Promise.all([
      context.supabase.from("profiles").select("wallet_balance, display_name, email").eq("id", context.userId).maybeSingle(),
      context.supabase
        .from("wallet_transactions")
        .select("id, amount, type, description, ref, created_at, razorpay_payment_id")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    return {
      balance: Number(profile?.wallet_balance ?? 0),
      displayName: profile?.display_name ?? "",
      email: profile?.email ?? "",
      transactions: txns ?? [],
    };
  });

/**
 * Top up the wallet. In a real app this would be gated by a Stripe checkout
 * webhook. Here we simulate a successful top-up server-side (test-mode).
 * The wallet credit + ledger row are written atomically by `wallet_topup`.
 */
export const topupWallet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ amount: z.number().int().min(50).max(20000) }).parse(data))
  .handler(async ({ data, context }) => {
    const ref = "TOPUP-" + Math.random().toString(36).slice(2, 10).toUpperCase();
    // wallet_topup is restricted to service_role — use admin client server-side.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: newBal, error } = await supabaseAdmin.rpc("wallet_topup", {
      p_user: context.userId,
      p_amount: data.amount,
      p_ref: ref,
    });
    if (error) throw new Error(error.message);
    return { balance: Number(newBal), ref };
  });