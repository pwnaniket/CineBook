import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useCart } from "@/lib/cart-store";
import { listSnacks } from "@/lib/catalog.functions";
import { getWallet } from "@/lib/wallet.functions";
import { createBookingOrder, verifyBookingPayment, markBookingPaymentFailed } from "@/lib/razorpay.functions";
import { inr } from "@/lib/format";
import { Wallet, Minus, Plus, Trash2, Loader2, ShieldCheck, Lock } from "lucide-react";
import { openCheckout, isDismissed, type CheckoutError } from "@/lib/razorpay-checkout";

export const Route = createFileRoute("/checkout")({
  component: CheckoutPage,
});

function CheckoutPage() {
  const { user, loading } = useAuth();
  const cart = useCart();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchSnacks = useServerFn(listSnacks);
  const fetchWallet = useServerFn(getWallet);
  const createOrder = useServerFn(createBookingOrder);
  const verifyPayment = useServerFn(verifyBookingPayment);
  const markFailed = useServerFn(markBookingPaymentFailed);

  const snacksQ = useQuery({ queryKey: ["snacks"], queryFn: () => fetchSnacks() });
  const walletQ = useQuery({
    queryKey: ["wallet"], queryFn: () => fetchWallet(), enabled: !!user,
  });

  const [useWallet, setUseWallet] = useState(true);
  const [stage, setStage] = useState<"idle" | "creating" | "checkout" | "verifying" | "booking" | "done">("idle");

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: { next: "/checkout" } });
  }, [loading, user, navigate]);

  const totalDue = cart.totals.total;
  const balance = walletQ.data?.balance ?? 0;
  const walletApplied = useWallet ? Math.min(balance, totalDue) : 0;
  const outstanding = Math.max(0, totalDue - walletApplied);

  const pending = stage !== "idle" && stage !== "done";

  const proceedToPayment = async () => {
    if (!cart.showId || cart.seats.length === 0) return;
    const showId = cart.showId;
    const seatCodes = cart.seats.map((s) => s.code);
    const snacksPayload = cart.snacks.map((s) => ({ snack_id: s.snackId, quantity: s.quantity }));
    try {
      setStage("creating");
      const order = await createOrder({ data: { showId, seatCodes, snacks: snacksPayload, walletAmount: walletApplied } });

      let paymentIds: { orderId: string | null; paymentId: string | null; signature: string | null } = {
        orderId: null, paymentId: null, signature: null,
      };

      if (!order.walletOnly) {
        setStage("checkout");
        try {
          const resp = await openCheckout({
            keyId: order.keyId,
            orderId: order.orderId,
            amount: order.amount,
            description: `${seatCodes.length} seat${seatCodes.length > 1 ? "s" : ""} · CineBook`,
            prefill: { email: walletQ.data?.email, name: walletQ.data?.displayName },
          });
          paymentIds = {
            orderId: resp.razorpay_order_id,
            paymentId: resp.razorpay_payment_id,
            signature: resp.razorpay_signature,
          };
        } catch (err) {
          const cerr = err as CheckoutError;
          await markFailed({ data: { orderId: order.orderId, cancelled: isDismissed(cerr) } }).catch(() => {});
          setStage("idle");
          if (isDismissed(cerr)) toast("Payment cancelled — no money deducted.", { icon: "🛑" });
          else toast.error(cerr.message ?? "Payment failed. Please try again.");
          return;
        }
      }

      setStage("verifying");
      const res = await verifyPayment({
        data: {
          orderId: paymentIds.orderId,
          paymentId: paymentIds.paymentId,
          signature: paymentIds.signature,
          walletOnly: order.walletOnly,
          showId,
          seatCodes,
          snacks: snacksPayload,
          walletAmount: order.walletAmount,
        },
      });
      setStage("booking");
      setStage("done");
      toast.success("Booking confirmed 🎬");
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      navigate({ to: "/bookings/$ref", params: { ref: res.ref } });
      setTimeout(() => cart.clearAll(), 0);
    } catch (e) {
      setStage("idle");
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      console.error("[checkout] failed:", e);
      toast.error(msg);
    }
  };

  useEffect(() => {
    if (cart.seats.length === 0 && stage === "idle") {
      navigate({ to: "/movies" });
    }
  }, [cart.seats.length, navigate, stage]);

  if (loading || !user) return <div className="mx-auto max-w-4xl px-4 py-16 text-center text-muted-foreground">Loading…</div>;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="font-display text-4xl tracking-wide">Checkout</h1>
      <p className="mt-1 text-sm text-muted-foreground">Add snacks, then pay with wallet or card.</p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
        <div>
          <h2 className="mb-3 font-display text-2xl">Snacks</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {snacksQ.data?.map((s) => {
              const inCart = cart.snacks.find((c) => c.snackId === s.id);
              return (
                <div key={s.id} className="flex flex-col rounded-xl border border-border/60 bg-card p-3">
                  <SnackImage src={s.image_url} category={s.category} name={s.name} />
                  <p className="font-display text-lg leading-tight">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.category}</p>
                  <div className="mt-auto flex items-center justify-between pt-3">
                    <span className="font-display text-lg text-primary">{inr(s.price)}</span>
                    {inCart ? (
                      <div className="flex items-center gap-1">
                        <button onClick={() => inCart.quantity === 1 ? cart.removeSnack(s.id) : cart.bumpSnack(s.id, -1)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border/60 hover:border-primary">
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-6 text-center font-mono text-sm">{inCart.quantity}</span>
                        <button onClick={() => cart.bumpSnack(s.id, +1)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border/60 hover:border-primary">
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => cart.addSnack({ snackId: s.id, name: s.name, unitPrice: Number(s.price) })}
                        className="rounded-md bg-primary/15 px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/25">Add</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <aside className="space-y-5">
          <div className="rounded-xl border border-border/60 bg-card p-5">
            <h3 className="font-display text-xl">Your order</h3>
            <div className="mt-4 space-y-2 text-sm">
              {cart.seats.length > 0 && (
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Seats</p>
                  <ul className="mt-1 space-y-1">
                    {cart.seats.map((s) => (
                      <li key={s.code} className="flex justify-between">
                        <span>{s.code} <span className="text-muted-foreground">({s.seatClass})</span></span>
                        <span>{inr(s.price)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {cart.snacks.length > 0 && (
                <div className="pt-2">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Snacks</p>
                  <ul className="mt-1 space-y-1">
                    {cart.snacks.map((s) => (
                      <li key={s.snackId} className="flex justify-between">
                        <span>{s.name} × {s.quantity}</span>
                        <span className="flex items-center gap-2">
                          {inr(s.unitPrice * s.quantity)}
                          <button onClick={() => cart.removeSnack(s.snackId)} className="text-muted-foreground hover:text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="mt-4 space-y-1 border-t border-border/40 pt-3 text-sm">
              <Row label="Seats" v={inr(cart.totals.seats)} />
              <Row label="Snacks" v={inr(cart.totals.snacks)} />
              <Row label="Total" v={inr(totalDue)} bold />
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-card p-5">
            <h3 className="font-display text-xl">Payment</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Powered by <span className="font-semibold text-foreground/80">Razorpay</span> — UPI, Cards, Net Banking &amp; Wallets.
            </p>
            <div className="mt-4 rounded-lg border border-border/60 bg-secondary/30 p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2"><Wallet className="h-4 w-4 text-primary" /> CineBook wallet</span>
                <span className="font-mono text-primary">{inr(balance)}</span>
              </div>
              {balance > 0 && (
                <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs">
                  <input type="checkbox" checked={useWallet} onChange={(e) => setUseWallet(e.target.checked)} />
                  Apply wallet balance ({inr(Math.min(balance, totalDue))})
                </label>
              )}
            </div>
            <div className="mt-4 space-y-1 border-t border-border/40 pt-3 text-sm">
              {walletApplied > 0 && <Row label="Paid by wallet" v={"− " + inr(walletApplied)} muted />}
              <Row label="Due at gateway" v={inr(outstanding)} bold />
            </div>
            <button
              onClick={proceedToPayment}
              disabled={pending || cart.seats.length === 0}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 font-semibold text-primary-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40">
              {pending ? (<><Loader2 className="h-4 w-4 animate-spin" /> {stageLabel(stage)}</>)
                : outstanding === 0 ? (<><Wallet className="h-4 w-4" /> Pay {inr(totalDue)} from wallet</>)
                : (<><Lock className="h-4 w-4" /> Proceed to secure payment</>)}
            </button>
            <p className="mt-3 flex items-start gap-2 text-[11px] text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
              <span>
                <strong className="text-foreground/80">Cancellation:</strong> Full refund to wallet more than 24 h before showtime, 50% between 2–24 h, none within 2 h.
              </span>
            </p>
            <Link to="/wallet" className="mt-2 block text-center text-xs text-primary hover:underline">Top up wallet →</Link>
          </div>
        </aside>
      </div>

      {pending && stage !== "checkout" && <ProcessingOverlay stage={stage} />}
    </div>
  );
}

function stageLabel(s: string) {
  switch (s) {
    case "creating": return "Creating order…";
    case "checkout": return "Awaiting payment…";
    case "verifying": return "Verifying payment…";
    case "booking": return "Reserving seats…";
    default: return "Working…";
  }
}

function ProcessingOverlay({ stage }: { stage: string }) {
  const steps: Array<{ id: string; label: string }> = [
    { id: "creating", label: "Creating secure order" },
    { id: "verifying", label: "Verifying payment" },
    { id: "booking", label: "Reserving seats & generating QR" },
  ];
  const order = ["creating", "checkout", "verifying", "booking", "done"];
  const idx = order.indexOf(stage);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur">
      <div className="w-[92%] max-w-sm rounded-2xl border border-primary/40 bg-card p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">CineBook</p>
            <p className="font-display text-lg">Payment successful</p>
          </div>
        </div>
        <ul className="space-y-2">
          {steps.map((s) => {
            const sIdx = order.indexOf(s.id);
            const done = sIdx < idx;
            const active = s.id === stage;
            return (
              <li key={s.id} className={"flex items-center gap-3 text-sm " + (done ? "text-foreground/70" : active ? "text-primary" : "text-muted-foreground")}>
                {done ? <span className="text-primary">✓</span> : active ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <span className="h-3.5 w-3.5 rounded-full border border-border/60" />}
                {s.label}
              </li>
            );
          })}
        </ul>
        <p className="mt-5 text-center text-xs text-muted-foreground">Enjoy your movie 🍿</p>
      </div>
    </div>
  );
}

function Row({ label, v, bold, muted }: { label: string; v: string; bold?: boolean; muted?: boolean }) {
  return (
    <div className={"flex justify-between " + (bold ? "font-display text-lg" : "") + (muted ? " text-muted-foreground" : "")}>
      <span>{label}</span>
      <span>{v}</span>
    </div>
  );
}

const CATEGORY_EMOJI: Record<string, string> = {
  Popcorn: "🍿",
  Beverages: "🥤",
  Combos: "🎬",
  Desserts: "🍰",
  Snacks: "🥨",
};

function SnackImage({ src, category, name }: { src: string | null; category: string | null; name: string }) {
  const [ok, setOk] = useState(!!src);
  const emoji = (category && CATEGORY_EMOJI[category]) || "🍿";
  if (!src || !ok) {
    return (
      <div className="mb-2 flex h-24 w-full items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 via-secondary/40 to-background text-4xl">
        <span aria-label={name}>{emoji}</span>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={name}
      loading="lazy"
      onError={() => setOk(false)}
      className="mb-2 h-24 w-full rounded-lg object-cover"
    />
  );
}