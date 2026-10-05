/** Format INR without decimals. */
export const inr = (n: number | string | null | undefined): string => {
  const v = Number(n ?? 0);
  return "₹" + v.toLocaleString("en-IN", { maximumFractionDigits: 0 });
};

export const fmtDateTime = (iso: string): string =>
  new Date(iso).toLocaleString("en-IN", {
    weekday: "short", day: "2-digit", month: "short",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });

export const fmtTime = (iso: string): string =>
  new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });

export const fmtDay = (iso: string): string =>
  new Date(iso).toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" });