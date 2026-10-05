/**
 * Client-side Razorpay Checkout helper.
 * Loads the Razorpay Checkout script once (from checkout.razorpay.com) and
 * exposes a Promise-based openCheckout() that resolves with the payment
 * result or rejects on failure/dismissal.
 */

declare global {
  interface Window {
    Razorpay?: any;
  }
}

const SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";
let loadPromise: Promise<void> | null = null;

export function loadRazorpay(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("Razorpay must load in the browser"));
  if (window.Razorpay) return Promise.resolve();
  if (loadPromise) return loadPromise;
  loadPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load Razorpay")), { once: true });
      return;
    }
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Razorpay"));
    document.body.appendChild(s);
  });
  return loadPromise;
}

export interface RazorpayResult {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface OpenCheckoutParams {
  keyId: string;
  orderId: string;
  amount: number;        // rupees
  currency?: string;
  name?: string;
  description?: string;
  prefill?: { name?: string; email?: string; contact?: string };
  themeColor?: string;
}

export type CheckoutError = { code: "dismissed" | "failed"; message: string };

export async function openCheckout(params: OpenCheckoutParams): Promise<RazorpayResult> {
  await loadRazorpay();
  return new Promise<RazorpayResult>((resolve, reject) => {
    const rzp = new window.Razorpay!({
      key: params.keyId,
      amount: Math.round(params.amount * 100),
      currency: params.currency ?? "INR",
      order_id: params.orderId,
      name: params.name ?? "CineBook",
      description: params.description ?? "Movie ticket booking",
      prefill: params.prefill ?? {},
      theme: { color: params.themeColor ?? "#d4af37" },
      // Explicitly allow every payment method Razorpay supports so
      // UPI (Intent + Collect + QR), Cards, Net Banking, Wallets, EMI
      // and Pay Later all appear in Checkout when the merchant account
      // has them enabled.
      method: {
        upi: true,
        card: true,
        netbanking: true,
        wallet: true,
        emi: true,
        paylater: true,
      },
      // Force the "All payment methods" layout instead of the
      // one-click / recommended-only compact view, which sometimes
      // hides UPI on desktop for first-time users.
      config: {
        display: {
          preferences: { show_default_blocks: true },
        },
      },
      modal: {
        ondismiss: () => reject({ code: "dismissed", message: "Payment cancelled." } as CheckoutError),
        escape: true,
        backdropclose: false,
      },
      handler: (resp: RazorpayResult) => resolve(resp),
    });
    rzp.on("payment.failed", (resp: any) => {
      reject({
        code: "failed",
        message: resp?.error?.description ?? "Payment failed. Please try again.",
      } as CheckoutError);
    });
    rzp.open();
  });
}

export function isDismissed(err: unknown): boolean {
  return !!err && typeof err === "object" && (err as any).code === "dismissed";
}