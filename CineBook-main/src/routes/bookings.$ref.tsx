import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import jsPDF from "jspdf";
import { toast } from "sonner";
import { Download, Share2, Image as ImageIcon, Wallet, ChevronLeft, Ticket, Clock, MapPin, Calendar, FileDown, Printer, Mail } from "lucide-react";
import { getBookingByRef } from "@/lib/booking.functions";
import { getPaymentForBooking } from "@/lib/payments.functions";
import { useAuth } from "@/hooks/use-auth";
import { fmtDay, fmtTime, inr } from "@/lib/format";
import { downloadReceiptPdf, printReceipt, shareReceipt, gstBreakdown } from "@/lib/receipt";

export const Route = createFileRoute("/bookings/$ref")({
  head: () => ({ meta: [{ title: "Your Ticket — CineBook" }, { name: "robots", content: "noindex" }] }),
  component: BookingConfirmation,
});

function BookingConfirmation() {
  const { ref } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const fetchBooking = useServerFn(getBookingByRef);
  const fetchPayment = useServerFn(getPaymentForBooking);
  const q = useQuery({
    queryKey: ["booking", ref], enabled: !!user,
    queryFn: () => fetchBooking({ data: { ref } }),
  });
  const pq = useQuery({
    queryKey: ["booking-payment", ref], enabled: !!user,
    queryFn: () => fetchPayment({ data: { ref } }),
  });
  const qrRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: { next: `/bookings/${ref}` } });
  }, [loading, user, navigate, ref]);

  const emailedRef = useRef(false);
  useEffect(() => {
    if (emailedRef.current) return;
    if (q.data && pq.data && (q.data as any).status !== "cancelled" && pq.data.status === "captured" && user?.email) {
      emailedRef.current = true;
      const t = setTimeout(() => {
        toast.success("Receipt sent to " + user.email, { description: "Check your inbox for the CineBook payment receipt." });
      }, 600);
      return () => clearTimeout(t);
    }
  }, [q.data, pq.data, user?.email]);

  if (q.isLoading)
    return <div className="mx-auto max-w-2xl px-4 py-16 text-center text-muted-foreground">Loading ticket…</div>;
  if (q.error)
    return <div className="mx-auto max-w-2xl px-4 py-16 text-center text-destructive">{(q.error as Error).message}</div>;
  if (!q.data) return null;
  const b: any = q.data;

  const status = b.status === "cancelled" ? "cancelled" : b.checked_in_at ? "redeemed" : "confirmed";
  const statusMeta =
    status === "confirmed"
      ? { label: "✓ Confirmed", cls: "bg-primary/15 text-primary border-primary/40" }
      : status === "redeemed"
      ? { label: "● Redeemed", cls: "bg-muted text-muted-foreground border-border" }
      : { label: "✕ Cancelled", cls: "bg-destructive/15 text-destructive border-destructive/40" };

  const qrPayload = JSON.stringify({
    v: 1,
    ref: b.ref,
    t: b.qr_token,
    exp: b.show ? new Date(new Date(b.show.starts_at).getTime() + 3 * 3600 * 1000).toISOString() : null,
  });
  const seatsStr = b.seats?.map((s: any) => s.seat_code).join("  ") ?? "—";
  const theaterName = b.show?.screen?.theater?.name ?? "CineBook Theater";
  const cityName = b.show?.screen?.theater?.city ?? "";

  const receiptData = pq.data ? {
    title: b.show?.movie?.title ?? "Movie booking",
    amount: Number(pq.data.amount ?? b.total),
    method: pq.data.method,
    paymentId: pq.data.razorpay_payment_id,
    orderId: pq.data.razorpay_order_id,
    status: pq.data.status,
    createdAt: pq.data.created_at,
    ref: b.ref,
  } : null;

  function getSvgString() {
    const svg = qrRef.current?.querySelector("svg");
    if (!svg) return "";
    const clone = svg.cloneNode(true) as SVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    return new XMLSerializer().serializeToString(clone);
  }

  async function saveQrAsImage() {
    const svgStr = getSvgString();
    if (!svgStr) return;
    const size = 720;
    const canvas = document.createElement("canvas");
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, size, size);
    const img = new Image();
    const url = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgStr)));
    await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; img.src = url; });
    ctx.drawImage(img, 40, 40, size - 80, size - 80);
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `CineBook-${b.ref}-QR.png`;
    link.click();
    toast.success("QR image saved");
  }

  async function downloadPdf() {
    try {
      const doc = new jsPDF({ unit: "pt", format: [400, 640] });
      const w = 400;
      // Header
      doc.setFillColor(12, 12, 16); doc.rect(0, 0, w, 640, "F");
      doc.setTextColor(212, 175, 55);
      doc.setFont("helvetica", "bold"); doc.setFontSize(20);
      doc.text("🎬 CINEBOOK", w / 2, 42, { align: "center" });
      doc.setDrawColor(212, 175, 55); doc.setLineWidth(0.6);
      doc.line(30, 56, w - 30, 56);

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.text(String(b.show?.movie?.title ?? "Movie").toUpperCase(), w / 2, 90, { align: "center", maxWidth: w - 60 });

      doc.setFont("helvetica", "normal"); doc.setFontSize(11);
      doc.setTextColor(200, 200, 200);
      doc.text(theaterName + (cityName ? " · " + cityName : ""), w / 2, 112, { align: "center" });
      doc.text("Screen: " + (b.show?.screen?.name ?? "—"), w / 2, 128, { align: "center" });

      // Info grid
      const gy = 160;
      doc.setFontSize(9); doc.setTextColor(212, 175, 55);
      doc.text("DATE", 40, gy);
      doc.text("TIME", 160, gy);
      doc.text("SEATS", 280, gy);
      doc.setFontSize(13); doc.setTextColor(255, 255, 255);
      const starts = b.show ? new Date(b.show.starts_at) : null;
      doc.text(starts ? fmtDay(b.show.starts_at) : "—", 40, gy + 18);
      doc.text(starts ? fmtTime(b.show.starts_at) : "—", 160, gy + 18);
      doc.text(seatsStr, 280, gy + 18, { maxWidth: 100 });

      doc.setFontSize(9); doc.setTextColor(212, 175, 55);
      doc.text("BOOKING ID", 40, gy + 52);
      doc.text("STATUS", 160, gy + 52);
      doc.text("TOTAL", 280, gy + 52);
      doc.setFontSize(13); doc.setTextColor(255, 255, 255);
      doc.text(b.ref, 40, gy + 70);
      doc.text(status.toUpperCase(), 160, gy + 70);
      doc.text("Rs " + Number(b.total).toLocaleString("en-IN"), 280, gy + 70);

      // Dashed divider
      doc.setLineDashPattern([3, 3], 0); doc.setDrawColor(212, 175, 55);
      doc.line(30, 260, w - 30, 260);
      doc.setLineDashPattern([], 0);

      // QR
      const svgStr = getSvgString();
      if (svgStr) {
        const size = 720;
        const canvas = document.createElement("canvas");
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, size, size);
        const img = new Image();
        const url = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgStr)));
        await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; img.src = url; });
        ctx.drawImage(img, 40, 40, size - 80, size - 80);
        const png = canvas.toDataURL("image/png");
        doc.addImage(png, "PNG", w / 2 - 90, 285, 180, 180);
      }

      doc.setFontSize(10); doc.setTextColor(200, 200, 200);
      doc.text("Scan at Entry", w / 2, 485, { align: "center" });

      doc.setLineDashPattern([3, 3], 0);
      doc.line(30, 510, w - 30, 510);
      doc.setLineDashPattern([], 0);

      doc.setFontSize(12); doc.setTextColor(212, 175, 55);
      doc.text("Enjoy your movie 🍿", w / 2, 540, { align: "center" });
      doc.setFontSize(8); doc.setTextColor(150, 150, 150);
      doc.text("Please arrive 15 minutes before showtime. Ticket is non-transferable.", w / 2, 560, { align: "center", maxWidth: w - 60 });
      doc.text("CineBook · Booking Ref " + b.ref, w / 2, 600, { align: "center" });

      doc.save(`CineBook-${b.ref}.pdf`);
      toast.success("Ticket PDF downloaded");
    } catch (e) {
      console.error(e);
      toast.error("Could not create PDF");
    }
  }

  async function shareTicket() {
    const url = window.location.href;
    const text = `🎬 ${b.show?.movie?.title} · ${theaterName}\n${fmtDay(b.show?.starts_at)} at ${fmtTime(b.show?.starts_at)}\nSeats ${seatsStr} · Ref ${b.ref}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "CineBook Ticket", text, url });
      } else {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        toast.success("Ticket link copied");
      }
    } catch {}
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-8 sm:px-6 lg:py-12">
      <Link to="/bookings" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
        <ChevronLeft className="h-4 w-4" /> All tickets
      </Link>

      {status === "confirmed" && (
        <div className="mb-6 text-center animate-ticket-in">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-primary animate-success-pop">
            <Ticket className="h-8 w-8" />
          </div>
          <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.3em] text-primary">Booking confirmed</p>
          <h1 className="mt-1 font-display text-3xl tracking-wide">Enjoy the show 🎬</h1>
        </div>
      )}

      {/* Boarding pass */}
      <div className="boarding-pass overflow-hidden animate-ticket-in">
        {/* Brand strip */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <div className="flex items-center gap-2 font-display text-lg tracking-[0.25em] text-primary">
            🎬 CINEBOOK
          </div>
          <span className={"rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-widest " + statusMeta.cls}>
            {statusMeta.label}
          </span>
        </div>
        <div className="boarding-pass-dashes mx-6" />

        {/* Top row: poster + movie meta */}
        <div className="grid grid-cols-[92px_1fr] gap-4 px-6 py-5 sm:grid-cols-[110px_1fr]">
          <div className="overflow-hidden rounded-lg ring-1 ring-primary/30 shadow-lg shadow-black/40">
            {b.show?.movie?.poster_url ? (
              <img src={b.show.movie.poster_url} alt={b.show.movie.title} className="h-full w-full object-cover" />
            ) : (
              <div className="aspect-[2/3] w-full bg-gradient-to-br from-primary/30 to-transparent" />
            )}
          </div>
          <div className="min-w-0">
            <p className="font-display text-2xl leading-tight tracking-wide sm:text-3xl">{b.show?.movie?.title}</p>
            <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 text-primary/70" />
              <span className="truncate">{theaterName}{cityName ? " · " + cityName : ""}</span>
            </p>
            <p className="mt-0.5 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              {b.show?.screen?.name}
            </p>
            {b.show?.movie?.certification && (
              <span className="mt-2 inline-block rounded border border-border/60 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                {b.show.movie.certification}{b.show?.movie?.duration_min ? " · " + b.show.movie.duration_min + " min" : ""}
              </span>
            )}
          </div>
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-3 gap-2 border-t border-border/40 px-6 py-4 text-sm">
          <InfoCell icon={<Calendar className="h-3.5 w-3.5" />} label="Date" value={b.show ? fmtDay(b.show.starts_at) : "—"} />
          <InfoCell icon={<Clock className="h-3.5 w-3.5" />} label="Time" value={b.show ? fmtTime(b.show.starts_at) : "—"} />
          <InfoCell icon={<Ticket className="h-3.5 w-3.5" />} label="Seats" value={seatsStr} />
        </div>
        <div className="grid grid-cols-3 gap-2 px-6 pb-4 text-sm">
          <InfoCell label="Booking ID" value={<span className="font-mono text-primary">{b.ref}</span>} />
          <InfoCell icon={<Wallet className="h-3.5 w-3.5" />} label="Payment" value={<span className="uppercase">{b.payment_method}</span>} />
          <InfoCell label="Total" value={<span className="text-primary">{inr(b.total)}</span>} />
        </div>

        {/* Perforation with side notches */}
        <div className="boarding-pass-notch">
          <div className="boarding-pass-dashes mx-8" />
        </div>

        {/* QR panel */}
        <div className="flex flex-col items-center gap-3 px-6 py-6">
          <div ref={qrRef} className={"rounded-xl bg-white p-3 " + (status !== "confirmed" ? "opacity-40 grayscale" : "shadow-lg shadow-primary/20 ring-2 ring-primary/40")}>
            <QRCodeSVG value={qrPayload} size={196} bgColor="#ffffff" fgColor="#000000" level="H" includeMargin={false} />
          </div>
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
            {status === "confirmed" ? "Scan at Entry" : status === "redeemed" ? "Already redeemed" : "Ticket cancelled"}
          </p>
          {b.checked_in_at && (
            <p className="text-xs text-muted-foreground">Entry granted {new Date(b.checked_in_at).toLocaleString("en-IN")}</p>
          )}
        </div>

        {/* Footer */}
        <div className="boarding-pass-dashes mx-6" />
        <div className="px-6 py-4 text-center font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          Enjoy your movie 🍿 · Arrive 15 min early
        </div>
      </div>

      {/* Payment details */}
      {pq.data && (
        <div className="mt-6 rounded-xl border border-border/60 bg-card p-5">
          <p className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
            <Wallet className="h-3.5 w-3.5" /> Payment Details
          </p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
            <PayCell label="Method" value={methodLabel(pq.data.method) as any} />
            <PayCell label="Payment ID" value={<span className="font-mono text-xs">{pq.data.razorpay_payment_id ?? "—"}</span>} />
            <PayCell label="Order ID" value={<span className="font-mono text-xs">{pq.data.razorpay_order_id ?? "—"}</span>} />
            <PayCell label="Date" value={new Date(pq.data.created_at).toLocaleString("en-IN")} />
            <PayCell label="Amount" value={<span className="text-primary">{inr(pq.data.amount)}</span>} />
            <PayCell label="Status" value={<span className="uppercase">{pq.data.status === "captured" ? "Success" : pq.data.status}</span>} />
          </div>
          {(() => {
            const { base, gst, total } = gstBreakdown(Number(pq.data.amount));
            return (
              <div className="mt-4 space-y-1 border-t border-border/40 pt-3 font-mono text-xs text-muted-foreground">
                <div className="flex justify-between"><span>Subtotal</span><span>{inr(base)}</span></div>
                <div className="flex justify-between"><span>GST (18% incl.)</span><span>{inr(gst)}</span></div>
                <div className="flex justify-between text-sm text-foreground"><span>Total Paid</span><span className="text-primary">{inr(total)}</span></div>
              </div>
            );
          })()}
          {receiptData && pq.data.status === "captured" && (
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => { downloadReceiptPdf(receiptData); toast.success("Receipt PDF downloaded"); }}
                className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background px-3 py-1.5 text-xs hover:border-primary hover:text-primary"
              >
                <FileDown className="h-3.5 w-3.5" /> Download Receipt
              </button>
              <button
                onClick={() => printReceipt(receiptData)}
                className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background px-3 py-1.5 text-xs hover:border-primary hover:text-primary"
              >
                <Printer className="h-3.5 w-3.5" /> Print
              </button>
              <button
                onClick={() => { shareReceipt(receiptData); toast.success("Receipt ready to share"); }}
                className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background px-3 py-1.5 text-xs hover:border-primary hover:text-primary"
              >
                <Share2 className="h-3.5 w-3.5" /> Share
              </button>
              {user?.email && (
                <button
                  onClick={() => toast.success("Receipt re-sent to " + user.email)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background px-3 py-1.5 text-xs hover:border-primary hover:text-primary"
                >
                  <Mail className="h-3.5 w-3.5" /> Email me
                </button>
              )}
            </div>
          )}
          <div className="mt-4 flex items-center justify-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_var(--primary)]" />
            Secured by <span className="font-semibold text-foreground">Razorpay</span> · Test Mode
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ActionBtn onClick={downloadPdf} icon={<Download className="h-4 w-4" />} label="PDF" />
        <ActionBtn onClick={saveQrAsImage} icon={<ImageIcon className="h-4 w-4" />} label="Save QR" />
        <ActionBtn onClick={shareTicket} icon={<Share2 className="h-4 w-4" />} label="Share" />
        <ActionBtn onClick={() => toast.info("Wallet passes coming soon")} icon={<Wallet className="h-4 w-4" />} label="Add to Wallet" />
      </div>

      <div className="mt-6 flex justify-center gap-3">
        <Link to="/movies" className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:brightness-110">Book another</Link>
      </div>
    </div>
  );
}

function InfoCell({ icon, label, value }: { icon?: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
        {icon}{label}
      </p>
      <p className="mt-0.5 truncate">{value}</p>
    </div>
  );
}

function ActionBtn({ onClick, icon, label }: { onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick} className="flex items-center justify-center gap-1.5 rounded-md border border-border/60 bg-card px-3 py-2 text-xs font-semibold transition hover:border-primary hover:text-primary">
      {icon}{label}
    </button>
  );
}

function PayCell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate">{value}</p>
    </div>
  );
}

function methodLabel(m: string | null | undefined) {
  if (!m) return "—";
  const map: Record<string, string> = {
    upi: "UPI", card: "Card", netbanking: "Net Banking",
    wallet: "Wallet", emi: "EMI", paylater: "Pay Later",
  };
  return map[m] ?? m.toUpperCase();
}