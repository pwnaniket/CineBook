# Movie Booking System (CineBook)

A premium, cinema-themed movie ticket booking web application built with
TanStack Start, React 19, Supabase, and Razorpay (test mode). Users can
browse currently-running films, pick real theaters near them, choose
seats on a live seat map, order snacks, pay via UPI / Cards / Netbanking
/ Wallet, and receive a scannable QR boarding-pass ticket.

## Features

- Nationwide theater finder (Leaflet + OpenStreetMap + Overpass API)
- Real-time seat map with live occupancy powered by Supabase Realtime
- Atomic seat booking via PostgreSQL `SECURITY DEFINER` functions
- Wallet with signed top-ups and tiered cancellation refunds
- Razorpay Test Mode integration with server-side HMAC-SHA256
  signature verification
- Boarding-pass style tickets with QR redemption + staff scanner
- TMDB / OMDb enrichment (posters, trailers, IMDb ratings)

## Tech stack

- **Frontend:** TanStack Start v1, React 19, Vite 7, Tailwind CSS v4
- **Backend:** Supabase (Postgres, Auth, Realtime, Edge secrets)
- **Payments:** Razorpay Checkout (test mode)
- **Maps:** Leaflet + OpenStreetMap tiles + Overpass API

## Getting started

```bash
bun install
cp .env.example .env   # fill in your Supabase publishable values
bun run dev
```

## Environment & secrets

Only **publishable** values live in `.env` (Supabase URL + publishable
key). All real secrets are stored server-side in the Supabase secrets
vault and are read inside server functions via `process.env.*`:

| Secret | Where it's used |
|--------|-----------------|
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Order creation + HMAC verification |
| `SUPABASE_SERVICE_ROLE_KEY` | Privileged server writes |
| `TMDB_API_KEY` | Movie / trailer metadata |
| `OMDB_API_KEY` | IMDb ratings |
| `STAFF_PIN` | Staff scanner authorization |

None of these are ever bundled into the client build.

## Attribution

This product uses the TMDB API but is not endorsed or certified by TMDB.
