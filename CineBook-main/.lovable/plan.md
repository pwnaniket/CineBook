# CineBook Build Plan

A premium cinema-themed movie ticket booking app. This is a large multi-phase build. I'll implement it in ordered milestones and verify each before moving on.

## Design System (first)

- Dark "cinema at midnight" theme in `src/styles.css` using oklch tokens:
  - `--background` near-black (#0d0d12), `--foreground` ticket-paper off-white
  - `--primary` marquee gold (#e3a83b), `--vip` velvet red (#b23a5c), `--screen` cyan (#4fb6c7)
  - Seat class tokens: standard / executive / premium / vip / booked / selected(gold glow)
  - Gradients, glow shadows, perforated ticket border utility
- Fonts via `<link>` in `__root.tsx`: **Bebas Neue** (display), **Work Sans** (body), **JetBrains Mono** (codes/prices)
- Button variants: `gold`, `vip`, `ghost-gold`; premium card shadow utility

## Backend (Lovable Cloud / Supabase)

Tables (with RLS + GRANTs):

- `profiles` (id, email, display_name, wallet_balance default 500) + trigger on signup
- `user_roles` + `has_role()` (for `/scanner` staff check via PIN fallback)
- `wallet_transactions` (ledger: credit/debit, amount, description, ref)
- `movies` (title, industry, language, genre, duration_min, rating, certification, poster_url, backdrop_url, description, base_price)
- `screens` (name, total_seats)
- `shows` (movie_id, screen_id, starts_at)
- `show_seats` (show_id, seat_code, class, price, status: available/booked, booked_by, booking_id) — **UNIQUE(show_id, seat_code)** + partial unique on booked seat lock
- `snacks` (name, category, price, description, image_url)
- `bookings` (id, ref uuid, user_id, show_id, subtotal_seats, subtotal_snacks, total, payment_method, payment_ref, status, checked_in_at)
- `booking_seats`, `booking_snacks` join tables
- Seed data via migration: ~6 movies (Bollywood + Hollywood), 2 screens, upcoming shows, snacks menu

Race-condition safety:

- `book_seats(show_id, seat_codes[], user_id) RETURNS booking_id` SECURITY DEFINER function performing `UPDATE show_seats SET status='booked' WHERE ... AND status='available'` in a transaction, raising if any row didn't update. Called from a server function.

Stripe (test mode):

- `enable_stripe_payments` + one-time checkout server function

## Routes (TanStack)

- `/` — hero + featured movie, filter tabs (All/Bollywood/Hollywood), search, movie grid
- `/movie/$id` — detail + showtimes grouped by date
- `/show/$id/seats` — seat map (150+ seats, curved screen, aisle, legend, sticky bar)
- `/snacks` — menu with steppers, cart integration
- `/checkout` — perforated ticket-stub review, payment method (Wallet/Card/UPI), Stripe checkout
- `/booking/$ref` — confirmation with QR code
- `/tickets` — my bookings (auth)
- `/wallet` — balance, history, top-up
- `/scanner` — PIN-gated staff scanner (camera + QR decode + check-in)
- `/auth` — email/password + Google

## Data Structures (academic requirement)

Explicit hand-written classes in `src/lib/ds/` with comments:

- `HashTable.ts` — separate-chaining hash table for movie lookup by id
- `SeatMatrix.ts` — 2D matrix of seats for a show
- `BookingQueue.ts` — FIFO queue serializing booking requests client-side
- `CartLinkedList.ts` — doubly linked list for cart items (tickets + snacks)
- `ShowtimeMinHeap.ts` — min-heap of showtimes by timestamp
- Each file exports the class and has a demo `__test` block; used in the actual app code (not just declared) so I can point to real call sites.

## Milestones & Verification

1. Enable Lovable Cloud → migrations + seed → confirm tables via psql
2. Design system + fonts + shell layout
3. Auth + profile trigger + wallet init
4. Movie browse + detail (data structures wired: HashTable + MinHeap)
5. Seat selection (SeatMatrix + BookingQueue) with race-safe `book_seats` RPC
6. Snacks + Cart (CartLinkedList)
7. Checkout + Stripe + Wallet payment
8. QR ticket + `/scanner` (camera + qr decoder library)
9. My Tickets + Wallet page
10. Final polish, responsive check via Playwright screenshots

## Notes on scope

- Stripe: I'll enable Lovable's built-in Stripe payments (test mode). No real charges.
- Scanner: PIN-gated (env-configured PIN) rather than a full staff role system, per spec.
- Google sign-in: added alongside email/password by default.
- Auth-required routes go under `_authenticated/` (managed layout).

Approve to proceed and I'll start with enabling Lovable Cloud + Stripe and laying down the design system + schema.  
  
Approved — please proceed with the build plan as outlined, with these 

three additions/clarifications:

1. SERVER-SIDE PIN CHECK FOR SCANNER

   The staff PIN for /scanner must be verified inside a server-side 

   function (Edge Function or SECURITY DEFINER RPC), never compared in 

   client-side JavaScript. The PIN value itself should never be sent to 

   or stored in the browser bundle. The client only sends the entered PIN 

   + scanned ticket ref to the server, and the server returns valid/invalid.

2. ATOMIC WALLET PAYMENTS

   When a user pays with Wallet at checkout, the wallet balance deduction 

   and the booking creation must happen inside the SAME database 

   transaction as the seat-locking update in book_seats(). If the wallet 

   balance is insufficient, or if seat locking fails, the entire operation 

   must roll back — there should be no scenario where a wallet is debited 

   without a successful booking, or vice versa.

3. REAL MOVIE POSTERS VIA TMDB

   Please fetch real movie data (title, poster image, backdrop image, 

   genre, runtime, rating, overview) from the TMDB API ([themoviedb.org](http://themoviedb.org)) 

   for the seed migration, instead of using placeholder/blank poster_url 

   values. Pull roughly 10-12 popular Hindi-language (Bollywood) movies 

   and 10-12 popular English-language (Hollywood) movies. I'll provide a 

   TMDB API key as a secret if needed. Add a small footer credit: "Movie 

   data and images provided by The Movie Database (TMDB)" with a link to 

   [themoviedb.org](http://themoviedb.org), since this is required by their API terms.

Also, for the BookingQueue.ts data structure: please add a code comment 

clarifying that this FIFO queue serializes booking requests within a 

single client session for orderly UI handling, and that actual 

cross-user double-booking prevention is enforced separately by the 

book_seats() database transaction — so the distinction is clear for my 

project report.

Please proceed with Milestone 1 (enable Lovable Cloud + Stripe, schema 

+ seed migration) and confirm the tables via psql before moving to the 

design system.