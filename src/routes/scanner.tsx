import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Scanner } from "@yudiel/react-qr-scanner";
import { scanTicket } from "@/lib/scanner.functions";
import { fmtDateTime } from "@/lib/format";
import { ScanLine, CheckCircle2, XCircle, Lock, Loader2, User, MapPin, Clock, Ticket, RotateCcw } from "lucide-react";

export const Route = createFileRoute("/scanner")({
  head: () => ({ meta: [{ title: "Staff Scanner — CineBook" }, { name: "robots", content: "noindex" }] }),
  component: ScannerPage,
});

type Result =
  | { ok: true; ref: string; movie: string; starts_at: string; screen: string; seats: string[]; theater?: string; customer?: string }
  | { ok: false; reason: string; movie?: string; starts_at?: string; ref?: string; checked_in_at?: string; theater?: string; screen?: string; customer?: string };

function ScannerPage() {
  const [pin, setPin] = useState("");
  const [manual, setManual] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [scanning, setScanning] = useState(true);
  const scan = useServerFn(scanTicket);

  function extractToken(raw: string): string {
    const s = raw.trim();
    if (s.startsWith("{")) {
      try {
        const j = JSON.parse(s);
        return j.t || j.token || j.ref || s;
      } catch { /* fall through */ }
    }
    return s;
  }

  async function redeem(raw: string) {
    if (busy) return;
    const ref = extractToken(raw);
    setBusy(true);
    setScanning(false);
    try {
      const r = await scan({ data: { ref, pin } });
      setResult(r as Result);
    } catch (e) {
      setResult({ ok: false, reason: e instanceof Error ? e.message : "Scan failed" });
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setResult(null);
    setScanning(true);
    setManual("");
  }

  const denyReason = (reason: string) => {
    if (reason === "already_used") return "Ticket Already Used";
    if (reason === "cancelled") return "Cancelled Ticket";
    if (reason === "invalid" || reason === "not_found") return "Invalid QR Code";
    return reason;
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-6 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20 text-primary"><ScanLine className="h-5 w-5" /></span>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-primary">Staff only</p>
          <h1 className="font-display text-4xl tracking-wide">Ticket scanner</h1>
        </div>
      </header>

      <label className="mb-4 block">
        <span className="mb-1 flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground"><Lock className="h-3 w-3" /> Staff PIN</span>
        <input value={pin} onChange={(e) => setPin(e.target.value)} type="password" placeholder="Enter staff PIN"
          className="w-full rounded-md border border-border/60 bg-card px-3 py-2 text-sm focus:border-primary focus:outline-none" />
      </label>

      {scanning && !result && (
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
          <div className="relative aspect-square">
            <Scanner
              onScan={(codes) => { const c = codes[0]?.rawValue; if (c) redeem(c); }}
              onError={(err) => console.warn(err)}
              constraints={{ facingMode: "environment" }}
              components={{ finder: true }}
            />
            {/* Scan line overlay */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="absolute inset-x-8 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent shadow-[0_0_16px_2px_var(--primary)] animate-scan-line" />
              {/* corner brackets */}
              <div className="absolute left-6 top-6 h-8 w-8 border-l-2 border-t-2 border-primary" />
              <div className="absolute right-6 top-6 h-8 w-8 border-r-2 border-t-2 border-primary" />
              <div className="absolute bottom-6 left-6 h-8 w-8 border-b-2 border-l-2 border-primary" />
              <div className="absolute bottom-6 right-6 h-8 w-8 border-b-2 border-r-2 border-primary" />
            </div>
            {busy && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                <div className="flex flex-col items-center gap-2 text-primary">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <p className="font-mono text-xs uppercase tracking-[0.3em]">Validating…</p>
                </div>
              </div>
            )}
          </div>
          <div className="border-t border-border/40 p-4">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Or enter booking ref</p>
            <div className="flex gap-2">
              <input value={manual} onChange={(e) => setManual(e.target.value.toUpperCase())} placeholder="CB-XXXXXXXX"
                className="flex-1 rounded-md border border-border/60 bg-background px-3 py-2 font-mono text-sm focus:border-primary focus:outline-none" />
              <button onClick={() => manual && redeem(manual)} disabled={!manual || !pin || busy}
                className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40">Check</button>
            </div>
          </div>
        </div>
      )}

      {result && (
        <div className={"overflow-hidden rounded-2xl border-2 " + (result.ok
            ? "border-primary/70 bg-gradient-to-b from-primary/15 to-primary/5 animate-ticket-in"
            : "border-destructive/70 bg-gradient-to-b from-destructive/15 to-destructive/5 animate-deny-shake")}>
          <div className="flex flex-col items-center px-6 pt-8 pb-4 text-center">
            {result.ok ? (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/20 text-primary animate-success-pop">
                <CheckCircle2 className="h-12 w-12" />
              </div>
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-destructive/20 text-destructive">
                <XCircle className="h-12 w-12" />
              </div>
            )}
            <p className={"mt-4 font-display text-4xl tracking-wide " + (result.ok ? "text-primary" : "text-destructive")}>
              {result.ok ? "Entry Granted" : denyReason(result.reason)}
            </p>
          </div>

          <div className="mx-6 boarding-pass-dashes" />

          <div className="space-y-3 px-6 py-5 text-sm">
            {(result.movie || (result as any).ref) && (
              <>
                <Row icon={<Ticket className="h-4 w-4" />} label="Movie" value={result.movie ?? "—"} />
                {(result as any).theater && <Row icon={<MapPin className="h-4 w-4" />} label="Theater" value={(result as any).theater} />}
                {(result as any).screen && <Row icon={<ScanLine className="h-4 w-4" />} label="Screen" value={(result as any).screen} />}
                {(result as any).starts_at && <Row icon={<Clock className="h-4 w-4" />} label="Show time" value={fmtDateTime((result as any).starts_at)} />}
                {result.ok && result.seats && <Row icon={<Ticket className="h-4 w-4" />} label="Seats" value={result.seats.join(", ")} />}
                {(result as any).customer && <Row icon={<User className="h-4 w-4" />} label="Guest" value={(result as any).customer} />}
                {(result as any).ref && <Row label="Ref" value={<span className="font-mono text-primary">{(result as any).ref}</span>} />}
                {!result.ok && (result as any).checked_in_at && (
                  <Row label="Used at" value={<span className="text-destructive">{fmtDateTime((result as any).checked_in_at)}</span>} />
                )}
              </>
            )}
          </div>

          <div className="px-6 pb-6">
            <button onClick={reset} className="flex w-full items-center justify-center gap-2 rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:brightness-110">
              <RotateCcw className="h-4 w-4" /> Scan next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ icon, label, value }: { icon?: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {icon}{label}
      </span>
      <span className="truncate text-right">{value}</span>
    </div>
  );
}