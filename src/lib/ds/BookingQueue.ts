/**
 * BookingQueue — First-In-First-Out (FIFO) queue.
 *
 * ⚠️ SCOPE / DISTINCTION FOR PROJECT REPORT:
 * This queue serializes booking REQUESTS within a single client browser
 * session (e.g. rapid taps on "Confirm") so the UI processes them in
 * order and never fires two overlapping POSTs from the same tab.
 *
 * It does NOT prevent cross-user double-booking. Two different users on
 * two different devices could still race for the same seat — that is
 * prevented separately, and authoritatively, by the `book_seats()`
 * PostgreSQL function which performs an atomic `UPDATE ... WHERE
 * status='available'` inside a single transaction. If two transactions
 * try to claim the same row, only one succeeds and the other raises
 * SEATS_UNAVAILABLE. The database is the source of truth.
 *
 * Implementation uses a head-pointer + array to keep enqueue/dequeue
 * amortized O(1) (a naïve `arr.shift()` would be O(n)).
 */
export class BookingQueue<T> {
  private items: T[] = [];
  private head = 0;

  enqueue(item: T): void {
    this.items.push(item);
  }

  dequeue(): T | undefined {
    if (this.head >= this.items.length) return undefined;
    const v = this.items[this.head++];
    // Reset periodically to avoid unbounded array growth.
    if (this.head > 32 && this.head * 2 > this.items.length) {
      this.items = this.items.slice(this.head);
      this.head = 0;
    }
    return v;
  }

  peek(): T | undefined {
    return this.items[this.head];
  }

  get size(): number {
    return this.items.length - this.head;
  }

  get isEmpty(): boolean {
    return this.size === 0;
  }

  /** Drain the queue by applying an async handler in strict FIFO order. */
  async drain(handler: (item: T) => Promise<void>): Promise<void> {
    while (!this.isEmpty) {
      const next = this.dequeue()!;
      await handler(next);
    }
  }
}