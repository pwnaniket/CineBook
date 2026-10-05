import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense, useEffect, useMemo } from "react";
import { getShow } from "@/lib/catalog.functions";
import { useCart } from "@/lib/cart-store";
import { SeatMatrix, type Seat, type SeatState } from "@/lib/ds/SeatMatrix";
import { fmtDateTime, inr } from "@/lib/format";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/shows/$showId")({
  component: ShowPage,
});

function ShowPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-6xl px-4 py-16 text-center text-muted-foreground">Loading seat map…</div>}>
      <ShowInner />
    </Suspense>
  );
}

function ShowInner() {
  const { showId } = Route.useParams();
  const fetchShow = useServerFn(getShow);
  const { data } = useSuspenseQuery({
    queryKey: ["show", showId],
    queryFn: () => fetchShow({ data: { id: showId } }),
  });
  const { show, seats } = data;
  const cart = useCart();
  const navigate = useNavigate();

  // Populate our hand-written SeatMatrix (academic showcase).
  const matrix = useMemo(() => {
    const m = new SeatMatrix(12, 16);
    for (const s of seats) {
      const seat: Seat = {
        id: s.id,
        code: s.seat_code,
        row: s.row_num,
        col: s.col_num,
        rowLetter: s.row_letter,
        seatClass: s.seat_class as Seat["seatClass"],
        price: Number(s.price),
        state: (s.status === "available" ? "available" : "booked") as SeatState,
      };
      m.setCell(s.row_num - 1, s.col_num - 1, seat);
    }
    return m;
  }, [seats]);

  const rows = useMemo(() => matrix.eachRow(), [matrix]);

  // Bind this cart to the current show (in an effect to avoid setState-in-render).
  useEffect(() => {
    if (cart.showId !== showId) cart.setShow(showId);
  }, [cart, showId]);

  const selectedSet = new Set(cart.seats.map((s) => s.code));
  const total = cart.seats.reduce((a, s) => a + s.price, 0);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link to="/movies/$movieId" params={{ movieId: show.movie.id }} className="text-xs text-muted-foreground hover:text-primary">← Back to movie</Link>
          <h1 className="mt-1 font-display text-4xl tracking-wide sm:text-5xl">{show.movie.title}</h1>
          <p className="text-sm text-muted-foreground">{show.screen.name} • {fmtDateTime(show.starts_at)}</p>
        </div>
        <Legend />
      </header>

      <div className="rounded-2xl border border-border/60 bg-card p-6">
        <div className="mx-auto mb-8 max-w-2xl">
          <div className="h-1 rounded-full bg-gradient-to-r from-transparent via-primary to-transparent" />
          <p className="mt-2 text-center font-mono text-[10px] uppercase tracking-[0.4em] text-muted-foreground">Screen</p>
        </div>

        <div className="space-y-2 overflow-x-auto pb-2">
          {rows.map((row, rIdx) => (
            <div key={row[0]?.rowLetter ?? rIdx} className="flex items-center gap-1 sm:gap-1.5">
              <span className="w-6 shrink-0 text-center font-mono text-xs text-muted-foreground">{row[0]?.rowLetter}</span>
              {row.map((seat, idx) => {
                const selected = selectedSet.has(seat.code);
                const taken = seat.state === "booked";
                return (
                  <button
                    key={seat.code}
                    disabled={taken}
                    onClick={() => cart.toggleSeat({ code: seat.code, seatClass: seat.seatClass, price: seat.price })}
                    title={`${seat.code} • ${seat.seatClass} • ${inr(seat.price)}`}
                    className={
                      "h-7 w-7 rounded-md border font-mono text-[10px] transition sm:h-8 sm:w-8 " +
                      (taken
                        ? "cursor-not-allowed border-border/30 bg-destructive/40 text-muted-foreground line-through"
                        : selected
                        ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/40"
                        : seat.seatClass === "vip"
                        ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
                        : seat.seatClass === "premium"
                        ? "border-chart-4/40 bg-chart-4/10 text-chart-4 hover:bg-chart-4/20"
                        : seat.seatClass === "executive"
                        ? "border-chart-2/40 bg-chart-2/10 text-chart-2 hover:bg-chart-2/20"
                        : "border-border/60 bg-secondary/40 text-foreground hover:bg-secondary")
                    }
                  >
                    {seat.col}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <SelectionBar total={total} count={cart.seats.length} onNext={() => navigate({ to: "/checkout" })} />
    </div>
  );
}

function Legend() {
  const items: Array<[string, string]> = [
    ["Standard", "bg-secondary/60 border-border/60"],
    ["Executive", "bg-chart-2/20 border-chart-2/40"],
    ["Premium", "bg-chart-4/20 border-chart-4/40"],
    ["VIP", "bg-primary/20 border-primary/40"],
    ["Selected", "bg-primary border-primary"],
    ["Taken", "bg-destructive/40 border-border/30"],
  ];
  return (
    <div className="flex flex-wrap gap-3 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
      {items.map(([label, cls]) => (
        <span key={label} className="inline-flex items-center gap-1.5">
          <span className={"inline-block h-3 w-3 rounded-sm border " + cls} /> {label}
        </span>
      ))}
    </div>
  );
}

function SelectionBar({ total, count, onNext }: { total: number; count: number; onNext: () => void }) {
  return (
    <div className="sticky bottom-4 z-30 mt-6 flex items-center justify-between rounded-xl border border-border/60 bg-background/95 p-4 shadow-2xl backdrop-blur">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{count} seat{count === 1 ? "" : "s"}</p>
        <p className="font-display text-2xl">{inr(total)}</p>
      </div>
      <button
        disabled={count === 0}
        onClick={onNext}
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Add snacks <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}