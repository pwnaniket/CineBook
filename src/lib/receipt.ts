import jsPDF from "jspdf";

export type ReceiptData = {
  title: string; // "Superman" or "Wallet Top-up"
  amount: number; // charged amount (GST inclusive)
  method?: string | null;
  paymentId?: string | null;
  orderId?: string | null;
  status?: string | null;
  createdAt: string;
  ref?: string | null; // booking ref if present
};

export function methodPretty(m?: string | null) {
  if (!m) return "—";
  const map: Record<string, string> = {
    upi: "UPI", card: "Card", netbanking: "Net Banking",
    wallet: "Wallet", emi: "EMI", paylater: "Pay Later",
  };
  return map[m] ?? m.toUpperCase();
}

/** GST-inclusive breakdown at 18%. */
export function gstBreakdown(amount: number) {
  const base = Math.round((amount / 1.18) * 100) / 100;
  const gst = Math.round((amount - base) * 100) / 100;
  return { base, gst, total: amount };
}

const inr = (n: number) => "Rs " + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });

export function buildReceiptPdf(r: ReceiptData): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: [420, 640] });
  const w = 420;
  const { base, gst, total } = gstBreakdown(Number(r.amount));

  // Background
  doc.setFillColor(12, 12, 16); doc.rect(0, 0, w, 640, "F");

  // Header
  doc.setTextColor(212, 175, 55);
  doc.setFont("helvetica", "bold"); doc.setFontSize(22);
  doc.text("CINEBOOK", w / 2, 46, { align: "center" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(11);
  doc.setTextColor(200, 200, 200);
  doc.text("Payment Receipt", w / 2, 66, { align: "center" });

  doc.setDrawColor(212, 175, 55); doc.setLineWidth(0.6);
  doc.line(30, 82, w - 30, 82);

  // Body rows
  const rows: [string, string][] = [
    [r.ref ? "Movie" : "Description", r.title],
    ["Amount", inr(base)],
    ["GST (18%)", inr(gst)],
    ["Total Paid", inr(total)],
    ["Method", methodPretty(r.method)],
    ["Payment ID", r.paymentId ?? "—"],
    ["Order ID", r.orderId ?? "—"],
    ["Status", (r.status === "captured" ? "SUCCESS" : (r.status ?? "—")).toString().toUpperCase()],
    ["Date", new Date(r.createdAt).toLocaleString("en-IN")],
  ];
  if (r.ref) rows.push(["Booking Ref", r.ref]);

  let y = 108;
  doc.setFontSize(11);
  for (const [k, v] of rows) {
    doc.setTextColor(180, 180, 180);
    doc.text(k, 40, y);
    doc.setTextColor(255, 255, 255);
    doc.text(String(v), w - 40, y, { align: "right", maxWidth: 260 });
    y += 22;
  }

  // Divider
  y += 6;
  doc.setLineDashPattern([3, 3], 0);
  doc.setDrawColor(212, 175, 55);
  doc.line(30, y, w - 30, y);
  doc.setLineDashPattern([], 0);
  y += 22;

  doc.setFontSize(10);
  doc.setTextColor(212, 175, 55);
  doc.text("Thank you for booking with CineBook", w / 2, y, { align: "center" });
  y += 18;
  doc.setFontSize(8); doc.setTextColor(150, 150, 150);
  doc.text("This is a computer-generated receipt and does not require a signature.", w / 2, y, { align: "center", maxWidth: w - 60 });
  y += 14;
  doc.text("Secured by Razorpay · Test Mode", w / 2, y, { align: "center" });

  return doc;
}

export function downloadReceiptPdf(r: ReceiptData) {
  const doc = buildReceiptPdf(r);
  const safe = (r.ref ?? r.paymentId ?? "receipt").replace(/[^A-Za-z0-9_-]/g, "");
  doc.save(`CineBook-Receipt-${safe}.pdf`);
}

export function printReceipt(r: ReceiptData) {
  const doc = buildReceiptPdf(r);
  const url = doc.output("bloburl");
  const win = window.open(url as unknown as string, "_blank");
  if (win) setTimeout(() => { try { win.focus(); win.print(); } catch {} }, 500);
}

export async function shareReceipt(r: ReceiptData) {
  const { total } = gstBreakdown(Number(r.amount));
  const text = `CineBook Receipt\n${r.title}\nTotal: Rs ${total}\nMethod: ${methodPretty(r.method)}\nPayment ID: ${r.paymentId ?? "—"}\nDate: ${new Date(r.createdAt).toLocaleString("en-IN")}`;
  try {
    if (navigator.share) await navigator.share({ title: "CineBook Receipt", text });
    else { await navigator.clipboard.writeText(text); }
  } catch {}
}