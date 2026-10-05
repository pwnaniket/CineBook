import { useEffect, useState } from "react";
import { CreditCard, Wallet as WalletIcon, X, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { inr } from "@/lib/format";

/**
 * Reusable simulated-payment modal.
 *
 * Card:
 *   - Luhn validation on card number
 *   - Expiry not in the past
 *   - CVV 3–4 digits
 *   - Card number ending in 0002 → simulated decline
 *
 * UPI:
 *   - Either UPI ID (name@bank format) OR pick a UPI app
 *   - Shows a placeholder QR code area
 *
 * Wallet: instant (no form) — only shown when `allowWallet` is set. Payments
 * take a ~1.2s "Processing…" state before onSuccess fires with a payment ref.
 */

export type PayMethod = "wallet" | "card" | "upi";

interface Props {
  amount: number;
  open: boolean;
  onClose: () => void;
  onSuccess: (result: { method: PayMethod; paymentRef: string }) => void;
  allowWallet?: boolean;
  walletBalance?: number;
  title?: string;
  subtitle?: string;
}

function luhnValid(num: string) {
  const digits = num.replace(/\D/g, "");
  if (digits.length < 12 || digits.length > 19) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i], 10);
    if (alt) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

function expiryValid(mmYY: string) {
  const m = mmYY.match(/^(\d{2})\/(\d{2})$/);
  if (!m) return false;
  const mm = parseInt(m[1], 10);
  const yy = 2000 + parseInt(m[2], 10);
  if (mm < 1 || mm > 12) return false;
  const now = new Date();
  const exp = new Date(yy, mm, 0, 23, 59, 59); // last day of month
  return exp.getTime() > now.getTime();
}

function formatCard(v: string) {
  return v.replace(/\D/g, "").slice(0, 19).replace(/(\d{4})(?=\d)/g, "$1 ");
}

export function PaymentModal({ amount, open, onClose, onSuccess, allowWallet, walletBalance, title, subtitle }: Props) {
  const [tab, setTab] = useState<PayMethod>(allowWallet ? "wallet" : "card");
  const [processing, setProcessing] = useState(false);

  // Card fields
  const [cardNum, setCardNum] = useState("");
  const [cardName, setCardName] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");

  // UPI fields
  const [upiMode, setUpiMode] = useState<"id" | "app">("id");
  const [upiId, setUpiId] = useState("");
  const [upiApp, setUpiApp] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setProcessing(false);
      setCardNum(""); setCardName(""); setExpiry(""); setCvv("");
      setUpiId(""); setUpiApp(null);
    }
  }, [open]);

  if (!open) return null;

  const runPayment = async (method: PayMethod, ref: string) => {
    setProcessing(true);
    await new Promise((r) => setTimeout(r, 1400));
    setProcessing(false);
    onSuccess({ method, paymentRef: ref });
  };

  const submitCard = () => {
    const digits = cardNum.replace(/\s/g, "");
    if (!luhnValid(digits)) return toast.error("Invalid card number");
    if (!cardName.trim()) return toast.error("Please enter the name on card");
    if (!expiryValid(expiry)) return toast.error("Invalid or expired card");
    if (!/^\d{3,4}$/.test(cvv)) return toast.error("CVV must be 3–4 digits");
    if (digits.endsWith("0002")) {
      toast.error("Card declined by issuer (test)");
      return;
    }
    runPayment("card", `CARD-${digits.slice(-4)}-${Date.now().toString(36).toUpperCase()}`);
  };

  const submitUpi = () => {
    if (upiMode === "id") {
      if (!/^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(upiId)) return toast.error("Enter a valid UPI ID (e.g. name@bank)");
      runPayment("upi", `UPI-${upiId}-${Date.now().toString(36).toUpperCase()}`);
    } else {
      if (!upiApp) return toast.error("Pick a UPI app");
      runPayment("upi", `UPI-${upiApp.toUpperCase()}-${Date.now().toString(36).toUpperCase()}`);
    }
  };

  const submitWallet = () => {
    runPayment("wallet", `WALLET-${Date.now().toString(36).toUpperCase()}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur animate-in fade-in duration-200">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border/60 bg-card shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-border/40 px-5 py-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{subtitle ?? "Secure payment"}</p>
            <h3 className="font-display text-xl">{title ?? "Complete payment"}</h3>
          </div>
          <button onClick={onClose} disabled={processing} className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-40" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-border/40 bg-secondary/30 px-5 py-3">
          <div className="flex justify-between">
            <span className="text-xs text-muted-foreground">Amount</span>
            <span className="font-display text-2xl text-primary">{inr(amount)}</span>
          </div>
        </div>

        <div className="flex gap-1 border-b border-border/40 p-2">
          {allowWallet && (
            <TabBtn active={tab === "wallet"} onClick={() => setTab("wallet")} icon={<WalletIcon className="h-4 w-4" />} label={`Wallet${walletBalance != null ? " · " + inr(walletBalance) : ""}`} />
          )}
          <TabBtn active={tab === "card"} onClick={() => setTab("card")} icon={<CreditCard className="h-4 w-4" />} label="Card" />
          <TabBtn active={tab === "upi"} onClick={() => setTab("upi")} icon={<span className="font-display text-sm leading-none">UPI</span>} label="UPI" />
        </div>

        <div className="p-5">
          {tab === "wallet" && (
            <div className="space-y-3">
              <p className="text-sm">Charge <span className="font-mono text-primary">{inr(amount)}</span> to your wallet balance{walletBalance != null && <> of <span className="font-mono text-primary">{inr(walletBalance)}</span></>}.</p>
              {walletBalance != null && walletBalance < amount && <p className="text-xs text-destructive">Insufficient wallet balance.</p>}
            </div>
          )}

          {tab === "card" && (
            <div className="space-y-3">
              <Field label="Card number">
                <input value={cardNum} onChange={(e) => setCardNum(formatCard(e.target.value))} inputMode="numeric" placeholder="4242 4242 4242 4242"
                  className="w-full rounded-md border border-border/60 bg-background px-3 py-2 font-mono text-sm outline-none focus:border-primary" />
              </Field>
              <Field label="Name on card">
                <input value={cardName} onChange={(e) => setCardName(e.target.value)} placeholder="Full name"
                  className="w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Expiry (MM/YY)">
                  <input value={expiry} onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, "").slice(0, 4);
                    setExpiry(raw.length > 2 ? raw.slice(0, 2) + "/" + raw.slice(2) : raw);
                  }} placeholder="12/28"
                    className="w-full rounded-md border border-border/60 bg-background px-3 py-2 font-mono text-sm outline-none focus:border-primary" />
                </Field>
                <Field label="CVV">
                  <input value={cvv} onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" type="password" placeholder="123"
                    className="w-full rounded-md border border-border/60 bg-background px-3 py-2 font-mono text-sm outline-none focus:border-primary" />
                </Field>
              </div>
              <p className="text-[10px] text-muted-foreground">Test: use 4242 4242 4242 4242. A number ending in 0002 will be declined.</p>
            </div>
          )}

          {tab === "upi" && (
            <div className="space-y-4">
              <div className="flex gap-2 text-xs">
                <button onClick={() => setUpiMode("id")} className={"flex-1 rounded-md border px-3 py-1.5 transition " + (upiMode === "id" ? "border-primary bg-primary/10 text-primary" : "border-border/60")}>UPI ID</button>
                <button onClick={() => setUpiMode("app")} className={"flex-1 rounded-md border px-3 py-1.5 transition " + (upiMode === "app" ? "border-primary bg-primary/10 text-primary" : "border-border/60")}>Choose app</button>
              </div>
              {upiMode === "id" ? (
                <Field label="UPI ID">
                  <input value={upiId} onChange={(e) => setUpiId(e.target.value)} placeholder="yourname@upi"
                    className="w-full rounded-md border border-border/60 bg-background px-3 py-2 font-mono text-sm outline-none focus:border-primary" />
                </Field>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {["Google Pay", "PhonePe", "Paytm"].map((app) => (
                    <button key={app} onClick={() => setUpiApp(app)}
                      className={"flex flex-col items-center gap-1 rounded-md border p-3 text-xs transition " + (upiApp === app ? "border-primary bg-primary/10 text-primary" : "border-border/60 hover:border-primary/40")}>
                      <span className="font-display text-base leading-none">{app === "Google Pay" ? "GP" : app === "PhonePe" ? "PP" : "PT"}</span>
                      <span>{app}</span>
                    </button>
                  ))}
                </div>
              )}
              <div className="rounded-lg border border-dashed border-border/60 p-4 text-center">
                <div className="mx-auto grid h-32 w-32 grid-cols-8 gap-0.5 rounded-md bg-background p-2" aria-label="Simulated UPI QR code">
                  {Array.from({ length: 64 }).map((_, i) => (
                    <div key={i} className={((i * 7 + i * i) % 3 === 0 ? "bg-foreground" : "bg-transparent") + " rounded-[1px]"} />
                  ))}
                </div>
                <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Scan to pay {inr(amount)}</p>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-border/40 p-4">
          <button
            disabled={processing || (tab === "wallet" && walletBalance != null && walletBalance < amount)}
            onClick={tab === "wallet" ? submitWallet : tab === "card" ? submitCard : submitUpi}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 font-semibold text-primary-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {processing ? (<><Loader2 className="h-4 w-4 animate-spin" /> Processing payment…</>) : (<><CheckCircle2 className="h-4 w-4" /> Pay {inr(amount)}</>)}
          </button>
        </div>
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick}
      className={"flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium transition " + (active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-secondary/50")}>
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}