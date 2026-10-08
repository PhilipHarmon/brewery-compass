# Brewery Compass 🍺

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
