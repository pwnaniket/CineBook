/**
 * SeatMatrix — 2D matrix data structure representing a cinema hall.
 *
 * Rows are indexed 0..R-1 (row letter A, B, C ...), columns 0..C-1.
 * Each cell holds a Seat with its class, price, and status. Provides
 * O(1) coordinate lookup and O(R*C) walks used by the seat-map UI.
 */
export type SeatState = "available" | "booked" | "selected";

export interface Seat {
  id: string;
  code: string; // e.g. "F7"
  row: number;
  col: number;
  rowLetter: string;
  seatClass: "standard" | "executive" | "premium" | "vip";
  price: number;
  state: SeatState;
}

export class SeatMatrix {
  private grid: (Seat | null)[][];
  readonly rows: number;
  readonly cols: number;

  constructor(rows: number, cols: number) {
    this.rows = rows;
    this.cols = cols;
    this.grid = Array.from({ length: rows }, () => Array<Seat | null>(cols).fill(null));
  }

  /** Build a SeatMatrix from a flat list of seats (from the database). */
  static fromSeats(seats: Seat[]): SeatMatrix {
    if (seats.length === 0) return new SeatMatrix(0, 0);
    const rows = Math.max(...seats.map((s) => s.row));
    const cols = Math.max(...seats.map((s) => s.col));
    const m = new SeatMatrix(rows, cols);
    for (const s of seats) m.setCell(s.row - 1, s.col - 1, s);
    return m;
  }

  setCell(r: number, c: number, seat: Seat | null): void {
    this.grid[r][c] = seat;
  }

  get(r: number, c: number): Seat | null {
    return this.grid[r]?.[c] ?? null;
  }

  /** Iterate row-by-row, top to bottom, left to right. */
  eachRow(): Seat[][] {
    return this.grid.map((row) => row.filter((s): s is Seat => s !== null));
  }

  /** Toggle a seat's UI state between available <-> selected. */
  toggleSelect(code: string): Seat | null {
    for (const row of this.grid) {
      for (const cell of row) {
        if (cell && cell.code === code) {
          if (cell.state === "available") cell.state = "selected";
          else if (cell.state === "selected") cell.state = "available";
          return cell;
        }
      }
    }
    return null;
  }

  selectedSeats(): Seat[] {
    return this.grid.flat().filter((s): s is Seat => !!s && s.state === "selected");
  }
}