import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { cancelBooking, listMyBookings } from "@/lib/booking.functions";
import { useAuth } from "@/hooks/use-auth";
import { fmtDateTime, inr } from "@/lib/format";
import { Ticket } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/bookings/")({
  head: () => ({ meta: [{ title: "My Tickets — CineBook" }] }),
  component: MyBookings,
});

function MyBookings() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const fetch = useServerFn(listMyBookings);
  const q = useQuery({ queryKey: ["bookings"], queryFn: () => fetch(), enabled: !!user });

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: { next: "/bookings" } });
  }, [loading, user, navigate]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="font-display text-4xl tracking-wide">My tickets</h1>
        <Link to="/payments" className="text-sm text-primary hover:underline">Payment history →</Link>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Cancellation policy: refund goes to your wallet. <span className="text-foreground">100%</span> if cancelled 4+ hours before showtime,
        <span className="text-foreground"> 50%</span> if 2–4 hours before, no refund under 2 hours. Snacks are non-refundable.
      </p>
      {q.isLoading && <p className="mt-6 text-muted-foreground">Loading…</p>}
      {q.data && q.data.length === 0 && (
        <div className="mt-8 rounded-xl border border-dashed border-border/60 p-10 text-center">
          <Ticket className="mx-auto h-8 w-8 text-primary" />
          <p className="mt-3 font-display text-2xl">No tickets yet.</p>
          <Link to="/movies" className="mt-4 inline-block text-primary hover:underline">Browse movies →</Link>
        </div>
      )}
      <div className="mt-8 space-y-3">
        {q.data?.map((b) => <BookingRow key={b.id} b={b} />)}
      </div>
    </div>
  );
}

function BookingRow({ b }: { b: any }) {
  const qc = useQueryClient();
  const cancel = useServerFn(cancelBooking);
  const [confirming, setConfirming] = useState(false);
  const startsAt = b.show ? new Date(b.show.starts_at).getTime() : 0;
  const now = Date.now();
  const hoursUntil = (startsAt - now) / 3_600_000;
  const isCancelled = b.status === "cancelled";
  const isUsed = !!b.checked_in_at;
  const isPast = startsAt > 0 && startsAt < now;
  const canCancel = !isCancelled && !isUsed && !isPast;
  const refundFactor = hoursUntil >= 4 ? 1 : hoursUntil >= 2 ? 0.5 : 0;
  const estRefund = Math.round(Number(b.subtotal_seats ?? 0) * refundFactor);

  const m = useMutation({
    mutationFn: () => cancel({ data: { ref: b.ref } }),
    onSuccess: (res) => {
      toast.success(
        res.refund > 0
          ? `Booking cancelled. ₹${res.refund} refunded to your wallet.`
          : "Booking cancelled. No refund available under 2 hours before showtime."
      );
      qc.invalidateQueries({ queryKey: ["bookings"] });
      qc.invalidateQueries({ queryKey: ["booking", b.ref] });
      qc.invalidateQueries({ queryKey: ["wallet"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
      setConfirming(false);
    },
    onError: (e: Error) => { toast.error(e.message); setConfirming(false); },
  });

  const statusLabel = isCancelled ? "Cancelled" : isUsed ? "Used" : isPast ? "Expired" : "Valid";
  const statusClass = isCancelled ? "text-destructive" : isUsed || isPast ? "text-muted-foreground" : "text-primary";

  return (
    <div className={"flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-4 transition sm:flex-row sm:items-center sm:justify-between " + (isCancelled ? "opacity-60" : "hover:border-primary hover:shadow-lg hover:shadow-primary/10")}>
      <Link to="/bookings/$ref" params={{ ref: b.ref }} className="flex-1 min-w-0">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{b.ref}</p>
        <p className="font-display text-2xl truncate">{b.show?.movie?.title}</p>
        <p className="text-sm text-muted-foreground">
          {b.show?.screen?.name} • {b.show && fmtDateTime(b.show.starts_at)}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{b.seats?.map((s: any) => s.seat_code).join(", ")}</p>
      </Link>
      <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
        <div className="text-right">
          <p className="font-display text-xl text-primary">{inr(b.total)}</p>
          <p className={"mt-1 font-mono text-[10px] uppercase tracking-widest " + statusClass}>{statusLabel}</p>
        </div>
        {canCancel && (
          confirming ? (
            <div className="flex flex-col items-end gap-1">
              <p className="text-xs text-muted-foreground">
                {estRefund > 0 ? `Refund ~${inr(estRefund)} to wallet?` : "No refund (under 2h). Cancel anyway?"}
              </p>
              <div className="flex gap-2">
                <button onClick={() => setConfirming(false)} className="rounded-md border border-border/60 px-3 py-1 text-xs hover:border-primary">Keep</button>
                <button onClick={() => m.mutate()} disabled={m.isPending}
                  className="rounded-md bg-destructive px-3 py-1 text-xs font-semibold text-destructive-foreground hover:brightness-110 disabled:opacity-50">
                  {m.isPending ? "Cancelling…" : "Confirm cancel"}
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setConfirming(true)}
              className="rounded-md border border-destructive/50 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10">
              Cancel booking
            </button>
          )
        )}
      </div>
    </div>
  );
}