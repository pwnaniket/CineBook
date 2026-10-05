import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CartLinkedList, type CartItem } from "@/lib/ds/CartLinkedList";

/**
 * Cart provider. Uses our hand-written `CartLinkedList` as the underlying
 * store for snack lines, with a React-friendly snapshot for rendering.
 * Persists to localStorage so a checkout refresh doesn't lose selections.
 */
export interface SeatSelection { code: string; seatClass: string; price: number; }

interface CartValue {
  showId: string | null;
  seats: SeatSelection[];
  snacks: Array<Extract<CartItem, { kind: "snack" }>>;
  setShow: (id: string) => void;
  toggleSeat: (seat: SeatSelection) => void;
  clearSeats: () => void;
  addSnack: (snack: { snackId: string; name: string; unitPrice: number }) => void;
  bumpSnack: (snackId: string, delta: number) => void;
  removeSnack: (snackId: string) => void;
  clearAll: () => void;
  totals: { seats: number; snacks: number; total: number };
}

const CartCtx = createContext<CartValue | null>(null);
const STORAGE_KEY = "cinebook-cart-v1";

interface Persisted {
  showId: string | null;
  seats: SeatSelection[];
  snacks: Array<Extract<CartItem, { kind: "snack" }>>;
}

function loadInitial(): Persisted {
  if (typeof window === "undefined") return { showId: null, seats: [], snacks: [] };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { showId: null, seats: [], snacks: [] };
    const parsed = JSON.parse(raw) as Persisted;
    return {
      showId: parsed.showId ?? null,
      seats: Array.isArray(parsed.seats) ? parsed.seats : [],
      snacks: Array.isArray(parsed.snacks) ? parsed.snacks : [],
    };
  } catch {
    return { showId: null, seats: [], snacks: [] };
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [showId, setShowId] = useState<string | null>(null);
  const [seats, setSeats] = useState<SeatSelection[]>([]);
  const [snacks, setSnacks] = useState<Array<Extract<CartItem, { kind: "snack" }>>>([]);
  const listRef = useRef(new CartLinkedList<Extract<CartItem, { kind: "snack" }>>());

  // Hydrate from localStorage post-mount to avoid SSR mismatch.
  useEffect(() => {
    const initial = loadInitial();
    setShowId(initial.showId);
    setSeats(initial.seats);
    listRef.current.clear();
    for (const s of initial.snacks) listRef.current.push(s);
    setSnacks(listRef.current.toArray());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ showId, seats, snacks }));
    } catch { /* quota / private mode */ }
  }, [hydrated, showId, seats, snacks]);

  const setShow = useCallback((id: string) => {
    setShowId((prev) => {
      if (prev !== id) {
        listRef.current.clear();
        setSeats([]);
        setSnacks([]);
      }
      return id;
    });
  }, []);

  const toggleSeat = useCallback((seat: SeatSelection) => {
    setSeats((prev) => {
      const exists = prev.find((s) => s.code === seat.code);
      if (exists) return prev.filter((s) => s.code !== seat.code);
      if (prev.length >= 10) return prev;
      return [...prev, seat];
    });
  }, []);

  const clearSeats = useCallback(() => setSeats([]), []);

  const addSnack = useCallback((snack: { snackId: string; name: string; unitPrice: number }) => {
    const list = listRef.current;
    const existing = list.removeWhere((v) => v.snackId === snack.snackId);
    const nextQty = existing ? existing.quantity + 1 : 1;
    list.push({ kind: "snack", snackId: snack.snackId, name: snack.name, unitPrice: snack.unitPrice, quantity: nextQty });
    setSnacks(list.toArray());
  }, []);

  const bumpSnack = useCallback((snackId: string, delta: number) => {
    const list = listRef.current;
    const existing = list.removeWhere((v) => v.snackId === snackId);
    if (!existing) return;
    const nextQty = existing.quantity + delta;
    if (nextQty > 0) list.push({ ...existing, quantity: nextQty });
    setSnacks(list.toArray());
  }, []);

  const removeSnack = useCallback((snackId: string) => {
    listRef.current.removeWhere((v) => v.snackId === snackId);
    setSnacks(listRef.current.toArray());
  }, []);

  const clearAll = useCallback(() => {
    listRef.current.clear();
    setShowId(null);
    setSeats([]);
    setSnacks([]);
  }, []);

  const value = useMemo<CartValue>(() => {
    const seatTotal = seats.reduce((a, s) => a + s.price, 0);
    const snackTotal = snacks.reduce((a, s) => a + s.unitPrice * s.quantity, 0);
    return {
      showId, seats, snacks,
      setShow, toggleSeat, clearSeats, addSnack, bumpSnack, removeSnack, clearAll,
      totals: { seats: seatTotal, snacks: snackTotal, total: seatTotal + snackTotal },
    };
  }, [showId, seats, snacks, setShow, toggleSeat, clearSeats, addSnack, bumpSnack, removeSnack, clearAll]);

  return <CartCtx.Provider value={value}>{children}</CartCtx.Provider>;
}

export function useCart(): CartValue {
  const ctx = useContext(CartCtx);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}