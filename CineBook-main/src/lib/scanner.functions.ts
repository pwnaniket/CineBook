import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Redeem a booking QR at the scanner. PIN is checked SERVER-SIDE against the
 * STAFF_PIN secret — the browser never sees it and never decides.
 * `redeem_ticket` is SECURITY DEFINER + service-role-only, so it needs the
 * admin client.
 */
export const scanTicket = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z.object({ ref: z.string().min(4).max(64), pin: z.string().min(3).max(12) }).parse(data),
  )
  .handler(async ({ data }) => {
    const expected = process.env.STAFF_PIN;
    if (!expected) return { ok: false, reason: "PIN not configured" };
    if (data.pin !== expected) return { ok: false, reason: "Invalid staff PIN" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: result, error } = await supabaseAdmin.rpc("redeem_ticket", { p_ref: data.ref });
    if (error) return { ok: false, reason: error.message };
    return result as { ok: boolean; reason?: string; ref?: string; movie?: string; starts_at?: string; screen?: string; seats?: string[]; checked_in_at?: string };
  });