# Brewery Compass 🍺

Built by [Stolen Hours Software](https://stolenhourssoftware.github.io).

North Carolina craft breweries — rebuilt on the MERN stack. Browse every
brewery A–Z with tap lists (styles, ABV, IBU), explore them on a keyless
Leaflet map with rich hover tooltips, and plan a full brewery day with drive
times between stops.

## Structure

- `api/` — Express + Mongoose API. Seeds MongoDB from `api/data/*.json` on
  first boot (insert-only; never overwrites).
- `client/` — Vite + React front-end.

## Deploy (Render)

1. Create a **new** GitHub repo (e.g. `brewery-compass`) and push this folder's
   contents.
2. Render → **New → Blueprint**, select the repo, apply `render.yaml`.
3. On `brewery-api`, set `MONGO_URI` to your Atlas connection string (and
   `CLIENT_URL` to the client's origin once it's live). The app uses a fresh
   `brewery_compass` database and seeds itself on first boot — your old
   Flask database is left untouched.
4. If the API service URL differs from `https://brewery-api-tyq3.onrender.com`,
   update `VITE_API_URL` on the static site and redeploy it.

## Monthly brewery sync

New breweries appear on Open Brewery DB over time. Refresh the database
(insert-only — existing records are never touched):

```bash
cd api
MONGO_URI="mongodb+srv://..." npm run sync
```

Run it from Render Shell or your own machine, roughly monthly.

## Local dev

```bash
cd api && npm install
MONGO_URI="mongodb+srv://..." node server.js   # :5000

cd client && npm install && npm run dev          # :5173
```

## v9 additions

- **About** (`/about`) — a short history of North Carolina beer, from the
  Moravian brewers to Beer City USA and today.
- **Get Involved** (`/get-involved`) — associations, homebrew clubs, and
  publications for going deeper.
- **Festivals** — a "North Carolina beer festivals" section at the bottom of
  the homepage, driven by `client/src/data/festivals.js`.
- **Brewery detail window** — "Details & ratings" on the Breweries page and
  the map opens a rich view: contact info, the full tap list, and ratings.
- **Guest star ratings** — visitors rate breweries and individual beers 1–5
  stars (no accounts, no text). One rating per item per browser; re-rating
  updates it. Managed from `/admin` using the `ADMIN_KEY` env var.
- **Contact form** — in the footer of every page; messages are stored in the
  database and read from `/admin`. If `SMTP_*` env vars are set, a
  notification email is also sent (optional, off by default).
- **Events Nearby** — the Plan a Day page shows Ticketmaster/SeatGeek events
  near the day's last stop on the chosen date. Set `TICKETMASTER_API_KEY`
  and/or `SEATGEEK_CLIENT_ID` on the API service to switch it on; with no
  keys set, the section quietly stays hidden.

New API env vars (API service): `TICKETMASTER_API_KEY`, `SEATGEEK_CLIENT_ID`,
`ADMIN_KEY`, and optional `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`,
`CONTACT_NOTIFY_TO`. See the v9 build sheet for where to get each one.
