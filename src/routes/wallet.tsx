import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getWallet } from "@/lib/wallet.functions";
import { createTopupOrder, verifyTopupPayment, markTopupPaymentFailed } from "@/lib/razorpay.functions";
import { openCheckout, isDismissed, type CheckoutError } from "@/lib/razorpay-checkout";
import { useAuth } from "@/hooks/use-auth";
import { fmtDateTime, inr } from "@/lib/format";
import { Wallet, ArrowUpRight, ArrowDownLeft, Loader2, Lock } from "lucide-react";

export const Route = createFileRoute("/wallet")({
  component: WalletPage,
});

const PRESETS = [200, 500, 1000, 2000];

function WalletPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchWallet = useServerFn(getWallet);
  const createOrder = useServerFn(createTopupOrder);
  const verifyPayment = useServerFn(verifyTopupPayment);
  const markFailed = useServerFn(markTopupPaymentFailed);
  const q = useQuery({ queryKey: ["wallet"], queryFn: () => fetchWallet(), enabled: !!user });
  const [amount, setAmount] = useState(500);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: { next: "/wallet" } });
  }, [loading, user, navigate]);

  const handleTopup = async () => {
    if (amount < 50) return;
    setBusy(true);
    try {
      const order = await createOrder({ data: { amount } });
      let resp;
      try {
        resp = await openCheckout({
          keyId: order.keyId,
          orderId: order.orderId,
          amount: order.amount,
          description: `Wallet top-up · ${inr(order.amount)}`,
          prefill: { email: q.data?.email, name: q.data?.displayName },
        });
      } catch (err) {
        const cerr = err as CheckoutError;
        await markFailed({ data: { orderId: order.orderId, cancelled: isDismissed(cerr) } }).catch(() => {});
        setBusy(false);
        if (isDismissed(cerr)) toast("Payment cancelled — no money deducted.", { icon: "🛑" });
        else toast.error(cerr?.message ?? "Payment failed. Please try again.");
        return;
      }
      const result = await verifyPayment({
        data: {
          orderId: resp.razorpay_order_id,
          paymentId: resp.razorpay_payment_id,
          signature: resp.razorpay_signature,
          amount,
        },
      });
      toast.success(`${inr(amount)} added — new balance ${inr(result.balance)}`);
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Top-up failed.";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-card to-secondary/40 p-6 shadow-2xl shadow-black/40">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20 text-primary"><Wallet className="h-5 w-5" /></span>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Wallet balance</p>
            <p className="font-display text-4xl text-primary">{inr(q.data?.balance ?? 0)}</p>
          </div>
        </div>
        <div className="mt-6">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Top up amount</p>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button key={p} onClick={() => setAmount(p)}
                className={"rounded-md border px-4 py-2 text-sm transition " + (amount === p ? "border-primary bg-primary text-primary-foreground" : "border-border/60 hover:border-primary/50")}>{inr(p)}</button>
            ))}
            <input type="number" min={50} max={20000} value={amount} onChange={(e) => setAmount(Number(e.target.value))}
              className="w-32 rounded-md border border-border/60 bg-background px-3 py-2 text-sm" />
          </div>
          <button onClick={handleTopup} disabled={busy || amount < 50}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition hover:brightness-110 disabled:opacity-40">
            {busy ? (<><Loader2 className="h-4 w-4 animate-spin" /> Processing…</>) : (<><Lock className="h-4 w-4" /> Add {inr(amount)} to wallet</>)}
          </button>
          <p className="mt-2 text-xs text-muted-foreground">Secured by Razorpay — UPI, cards, net banking &amp; wallets accepted.</p>
        </div>
      </div>

      <div className="mt-10 flex items-baseline justify-between">
        <h2 className="font-display text-2xl tracking-wide">Recent activity</h2>
        <a href="/payments" className="text-xs text-primary hover:underline">View payment history →</a>
      </div>
      <div className="mt-4 divide-y divide-border/40 rounded-xl border border-border/60 bg-card">
        {q.data?.transactions.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No transactions yet.</p>}
        {q.data?.transactions.map((t) => (
          <div key={t.id} className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <span className={"flex h-8 w-8 items-center justify-center rounded-full " + (t.type === "credit" ? "bg-primary/20 text-primary" : "bg-destructive/20 text-destructive")}>
                {t.type === "credit" ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
              </span>
              <div className="min-w-0">
                <p className="text-sm">{t.description}</p>
                <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  {fmtDateTime(t.created_at)} • {t.ref}
                </p>
                {(t as any).razorpay_payment_id && (
                  <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/80">
                    Razorpay · {(t as any).razorpay_payment_id}
                  </p>
                )}
              </div>
            </div>
            <p className={"font-mono " + (t.type === "credit" ? "text-primary" : "text-destructive")}>
              {t.type === "credit" ? "+" : "−"}{inr(t.amount)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}