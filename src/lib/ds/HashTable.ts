/**
 * HashTable — separate-chaining hash table.
 *
 * Used by CineBook for O(1)-average lookup of movies by their UUID id.
 * We use FNV-1a over the id string as the hash function and store
 * collisions in a linked bucket (array) — classic "separate chaining".
 *
 * This is a hand-written data structure (not a JS Map) so that it can be
 * pointed to in the academic project report.
 */
export class HashTable<K extends string, V> {
  private buckets: Array<Array<[K, V]>>;
  private _size = 0;
  private capacity: number;

  constructor(initialCapacity = 32) {
    this.capacity = initialCapacity;
    this.buckets = Array.from({ length: initialCapacity }, () => []);
  }

  /** FNV-1a 32-bit hash of a string. Fast, well-distributed, non-crypto. */
  private hash(key: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < key.length; i++) {
      h ^= key.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0) % this.capacity;
  }

  /** Insert or update. Grows the table when load factor > 0.75. */
  set(key: K, value: V): void {
    if (this._size / this.capacity > 0.75) this.resize(this.capacity * 2);
    const idx = this.hash(key);
    const bucket = this.buckets[idx];
    for (const entry of bucket) {
      if (entry[0] === key) {
        entry[1] = value;
        return;
      }
    }
    bucket.push([key, value]);
    this._size++;
  }

  get(key: K): V | undefined {
    const bucket = this.buckets[this.hash(key)];
    for (const [k, v] of bucket) if (k === key) return v;
    return undefined;
  }

  has(key: K): boolean {
    return this.get(key) !== undefined;
  }

  delete(key: K): boolean {
    const bucket = this.buckets[this.hash(key)];
    const i = bucket.findIndex(([k]) => k === key);
    if (i === -1) return false;
    bucket.splice(i, 1);
    this._size--;
    return true;
  }

  get size(): number {
    return this._size;
  }

  values(): V[] {
    const out: V[] = [];
    for (const b of this.buckets) for (const [, v] of b) out.push(v);
    return out;
  }

  /** Rebuild all buckets at a new capacity — used to keep load factor low. */
  private resize(newCap: number): void {
    const old = this.buckets;
    this.capacity = newCap;
    this.buckets = Array.from({ length: newCap }, () => []);
    this._size = 0;
    for (const b of old) for (const [k, v] of b) this.set(k, v);
  }
}

/** Convenience: build a movie-lookup hash table from an array. */
export function buildMovieIndex<M extends { id: string }>(movies: M[]): HashTable<string, M> {
  const t = new HashTable<string, M>(Math.max(32, movies.length * 2));
  for (const m of movies) t.set(m.id, m);
  return t;
}