/**
 * ShowtimeMinHeap — a binary min-heap keyed by show start-time.
 *
 * Used to keep a movie's showtimes sorted chronologically with O(log n)
 * insertions and O(1) access to the earliest upcoming show. When the
 * movie-detail page loads, we push every showtime into the heap and
 * then repeatedly `pop()` to get them in strict chronological order.
 *
 * Node layout uses standard array indexing:
 *   parent(i) = (i - 1) >> 1
 *   left(i)   = 2*i + 1
 *   right(i)  = 2*i + 2
 */
export interface Showtime {
  id: string;
  movieId: string;
  screenId: string;
  startsAt: string; // ISO timestamp
}

export class ShowtimeMinHeap {
  private heap: Showtime[] = [];

  get size(): number {
    return this.heap.length;
  }

  peek(): Showtime | undefined {
    return this.heap[0];
  }

  /** Insert and bubble up. */
  push(s: Showtime): void {
    this.heap.push(s);
    this.siftUp(this.heap.length - 1);
  }

  /** Remove and return the earliest showtime. */
  pop(): Showtime | undefined {
    const n = this.heap.length;
    if (n === 0) return undefined;
    const top = this.heap[0];
    const last = this.heap.pop()!;
    if (n > 1) {
      this.heap[0] = last;
      this.siftDown(0);
    }
    return top;
  }

  /** Non-destructive: return all items in chronological order. */
  toSortedArray(): Showtime[] {
    // Clone then drain.
    const clone = new ShowtimeMinHeap();
    clone.heap = [...this.heap];
    const out: Showtime[] = [];
    while (clone.size > 0) out.push(clone.pop()!);
    return out;
  }

  private ts(s: Showtime): number {
    return new Date(s.startsAt).getTime();
  }

  private siftUp(i: number): void {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.ts(this.heap[i]) < this.ts(this.heap[parent])) {
        [this.heap[i], this.heap[parent]] = [this.heap[parent], this.heap[i]];
        i = parent;
      } else break;
    }
  }

  private siftDown(i: number): void {
    const n = this.heap.length;
    while (true) {
      const l = 2 * i + 1;
      const r = 2 * i + 2;
      let smallest = i;
      if (l < n && this.ts(this.heap[l]) < this.ts(this.heap[smallest])) smallest = l;
      if (r < n && this.ts(this.heap[r]) < this.ts(this.heap[smallest])) smallest = r;
      if (smallest === i) break;
      [this.heap[i], this.heap[smallest]] = [this.heap[smallest], this.heap[i]];
      i = smallest;
    }
  }
}

/** Group chronologically sorted shows by their local calendar date. */
export function groupByDay(shows: Showtime[]): { date: string; shows: Showtime[] }[] {
  const groups = new Map<string, Showtime[]>();
  for (const s of shows) {
    const d = new Date(s.startsAt);
    const key = d.toISOString().slice(0, 10);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(s);
  }
  return [...groups.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, shows]) => ({ date, shows }));
}