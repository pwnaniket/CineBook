/**
 * CartLinkedList — Doubly linked list for the shopping cart.
 *
 * Each node holds a cart item (either a ticket line or a snack line).
 * A DLL is a natural fit because the user can add items at either end,
 * remove from the middle in O(1) once the node is known, and iterate
 * in both directions (useful for undo / reversing the review order).
 *
 * This is a hand-written data structure, not a JS array, so it can be
 * pointed to in the project report.
 */
export type CartItem =
  | { kind: "ticket"; showId: string; seatCode: string; seatClass: string; price: number }
  | { kind: "snack"; snackId: string; name: string; unitPrice: number; quantity: number };

interface Node<T> {
  value: T;
  prev: Node<T> | null;
  next: Node<T> | null;
}

export class CartLinkedList<T = CartItem> {
  private head: Node<T> | null = null;
  private tail: Node<T> | null = null;
  private _length = 0;

  get length(): number {
    return this._length;
  }

  /** Append a new item to the tail — O(1). */
  push(value: T): Node<T> {
    const node: Node<T> = { value, prev: this.tail, next: null };
    if (this.tail) this.tail.next = node;
    else this.head = node;
    this.tail = node;
    this._length++;
    return node;
  }

  /** Prepend to the head — O(1). */
  unshift(value: T): Node<T> {
    const node: Node<T> = { value, prev: null, next: this.head };
    if (this.head) this.head.prev = node;
    else this.tail = node;
    this.head = node;
    this._length++;
    return node;
  }

  /** Remove a node in O(1) when the node reference is known. */
  remove(node: Node<T>): void {
    if (node.prev) node.prev.next = node.next;
    else this.head = node.next;
    if (node.next) node.next.prev = node.prev;
    else this.tail = node.prev;
    this._length--;
  }

  /** Find and remove by predicate. Returns the removed value or null. */
  removeWhere(pred: (v: T) => boolean): T | null {
    for (let cur = this.head; cur; cur = cur.next) {
      if (pred(cur.value)) {
        this.remove(cur);
        return cur.value;
      }
    }
    return null;
  }

  /** Forward iteration head -> tail. */
  toArray(): T[] {
    const out: T[] = [];
    for (let cur = this.head; cur; cur = cur.next) out.push(cur.value);
    return out;
  }

  /** Reverse iteration tail -> head (used for the review "torn stub" order). */
  toArrayReverse(): T[] {
    const out: T[] = [];
    for (let cur = this.tail; cur; cur = cur.prev) out.push(cur.value);
    return out;
  }

  clear(): void {
    this.head = this.tail = null;
    this._length = 0;
  }
}