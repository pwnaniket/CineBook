import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { listPayments } from "@/lib/payments.functions";
import { useAuth } from "@/hooks/use-auth";
import { fmtDateTime, inr } from "@/lib/format";
import { Receipt, CheckCircle2, XCircle, Clock3, CreditCard, Wallet as WalletIcon, FileDown, Printer, Share2 } from "lucide-react";
import { downloadReceiptPdf, printReceipt, shareReceipt } from "@/lib/receipt";
import { toast } from "sonner";

export const Route = createFileRoute("/payments")({
  head: () => ({ meta: [{ title: "Payment History — CineBook" }, { name: "robots", content: "noindex" }] }),
  component: PaymentsPage,
});

function methodLabel(m: string | null | undefined) {
  if (!m) return "—";
  const map: Record<string, string> = {
    upi: "UPI", card: "Card", netbanking: "Net Banking",
    wallet: "Wallet", emi: "EMI", paylater: "Pay Later",
  };
  return map[m] ?? m.toUpperCase();
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; icon: React.ReactNode; label: string }> = {
    captured: { cls: "bg-primary/15 text-primary border-primary/40", icon: <CheckCircle2 className="h-3 w-3" />, label: "Success" },
    created: { cls: "bg-muted text-muted-foreground border-border", icon: <Clock3 className="h-3 w-3" />, label: "Pending" },
    failed: { cls: "bg-destructive/15 text-destructive border-destructive/40", icon: <XCircle className="h-3 w-3" />, label: "Failed" },
    cancelled: { cls: "bg-muted text-muted-foreground border-border", icon: <XCircle className="h-3 w-3" />, label: "Cancelled" },
  };
  const m = map[status] ?? map.created;
  return (
    <span className={"inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest " + m.cls}>
      {m.icon}{m.label}
    </span>
  );
}

function PaymentsPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const fetchAll = useServerFn(listPayments);
  const q = useQuery({ queryKey: ["payments"], enabled: !!user, queryFn: () => fetchAll() });

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: { next: "/payments" } });
  }, [loading, user, navigate]);

  const [filter, setFilter] = useState<"all" | "bookings" | "topups" | "captured" | "failed" | "created">("all");
  const filtered = useMemo(() => {
    const rows = q.data ?? [];
    return rows.filter((p: any) => {
      if (filter === "all") return true;
      if (filter === "bookings") return p.purpose === "booking";
      if (filter === "topups") return p.purpose === "wallet_topup";
      return p.status === filter;
    });
  }, [q.data, filter]);

  const filters: { id: typeof filter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "bookings", label: "Bookings" },
    { id: "topups", label: "Wallet Top-ups" },
    { id: "captured", label: "Successful" },
    { id: "failed", label: "Failed" },
    { id: "created", label: "Pending" },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20 text-primary"><Receipt className="h-5 w-5" /></span>
        <div>
          <h1 className="font-display text-3xl tracking-wide">Payment History</h1>
          <p className="text-sm text-muted-foreground">All transactions secured by Razorpay.</p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={
              "rounded-full border px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest transition " +
              (filter === f.id
                ? "border-primary bg-primary/15 text-primary"
                : "border-border/60 bg-card text-muted-foreground hover:border-primary/60 hover:text-foreground")
            }
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mt-4 divide-y divide-border/40 rounded-xl border border-border/60 bg-card">
        {q.isLoading && <p className="p-6 text-center text-sm text-muted-foreground">Loading…</p>}
        {!q.isLoading && filtered.length === 0 && (
          <p className="p-8 text-center text-sm text-muted-foreground">No payments yet.</p>
        )}
        {filtered.map((p: any) => {
          const isBooking = p.purpose === "booking";
          const title = isBooking
            ? (p.booking?.show?.movie?.title ?? "Movie booking")
            : "Wallet top-up";
          const receipt = {
            title,
            amount: Number(p.amount),
            method: p.method,
            paymentId: p.razorpay_payment_id,
            orderId: p.razorpay_order_id,
            status: p.status,
            createdAt: p.created_at,
            ref: p.booking?.ref ?? null,
          };
          const canReceipt = p.status === "captured";
          return (
            <div key={p.id} className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-primary">
                    {isBooking ? <CreditCard className="h-3.5 w-3.5" /> : <WalletIcon className="h-3.5 w-3.5" />}
                  </span>
                  <p className="truncate font-medium">{title}</p>
                  <StatusBadge status={p.status} />
                </div>
                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground sm:grid-cols-4">
                  <span>Method<br /><span className="text-foreground normal-case tracking-normal">{methodLabel(p.method)}</span></span>
                  <span>Date<br /><span className="text-foreground normal-case tracking-normal">{fmtDateTime(p.created_at)}</span></span>
                  <span className="truncate">Payment ID<br /><span className="text-foreground normal-case tracking-normal">{p.razorpay_payment_id ?? "—"}</span></span>
                  <span className="truncate">Order ID<br /><span className="text-foreground normal-case tracking-normal">{p.razorpay_order_id ?? "—"}</span></span>
                </div>
                {isBooking && p.booking?.ref && (
                  <Link to="/bookings/$ref" params={{ ref: p.booking.ref }} className="mt-2 inline-block text-xs text-primary hover:underline">
                    View ticket · {p.booking.ref}
                  </Link>
                )}
                {canReceipt && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      onClick={() => { downloadReceiptPdf(receipt); toast.success("Receipt PDF downloaded"); }}
                      className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-background px-2 py-1 text-[11px] hover:border-primary hover:text-primary"
                    >
                      <FileDown className="h-3 w-3" /> PDF
                    </button>
                    <button
                      onClick={() => printReceipt(receipt)}
                      className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-background px-2 py-1 text-[11px] hover:border-primary hover:text-primary"
                    >
                      <Printer className="h-3 w-3" /> Print
                    </button>
                    <button
                      onClick={() => { shareReceipt(receipt); toast.success("Receipt ready to share"); }}
                      className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-background px-2 py-1 text-[11px] hover:border-primary hover:text-primary"
                    >
                      <Share2 className="h-3 w-3" /> Share
                    </button>
                  </div>
                )}
              </div>
              <p className="font-mono text-lg text-primary sm:text-right">{inr(p.amount)}</p>
            </div>
          );
        })}
      </div>

      <p className="mt-6 text-center font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
        🔒 Secured by Razorpay · Test Mode
      </p>
    </div>
  );
}