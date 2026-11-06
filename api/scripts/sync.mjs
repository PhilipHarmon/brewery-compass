// Monthly sync: pull fresh NC brewery data from Open Brewery DB into MongoDB.
//
// Usage:
//   MONGO_URI="mongodb+srv://..." npm run sync
//
// Behavior (same as the original sync.py):
// - Paginates Open Brewery DB for ALL North Carolina breweries
//   (per_page=200 until an empty page comes back).
// - Upserts into the `breweries` collection keyed by `odb_id`.
// - ONLY INSERTS new breweries. Never updates, never deletes — existing
//   data is never touched or overwritten.
//
// Run it monthly (Render Shell, or by hand) to keep the site current
// between code deploys.
import mongoose from 'mongoose';
import breweryApi from '../lib/breweryApi.js';
import BreweryModel from '../models/Brewery.js';

const { searchBreweriesODB } = breweryApi;
const Brewery = BreweryModel;

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('Error: MONGO_URI environment variable is not set.');
  process.exit(1);
}

function toMongoDoc(n) {
  return {
    brewery_id: n.odb_id,
    odb_id: n.odb_id,
    name: n.name,
    city: n.city,
    state: n.state,
    latitude: n.latitude,
    longitude: n.longitude,
    brewery_type: n.brewery_type,
    phone: n.phone,
    website: n.website_url,
    street: n.street,
    postal_code: n.postal_code,
  };
}

async function main() {
  await mongoose.connect(MONGO_URI);
  console.log('Syncing NC breweries from Open Brewery DB...');
  let inserted = 0;
  let skipped = 0;
  let page = 1;
  for (;;) {
    const breweries = await searchBreweriesODB({ page });
    if (!breweries.length) break;
    for (const b of breweries) {
      if (!b.odb_id) {
        skipped += 1;
        continue;
      }
      const res = await Brewery.updateOne(
        { odb_id: b.odb_id },
        { $setOnInsert: toMongoDoc(b) },
        { upsert: true },
      );
      if (res.upsertedCount > 0) inserted += 1;
      else skipped += 1;
    }
    page += 1;
  }
  console.log(`Done: ${inserted} new breweries added, ${skipped} already present.`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Sync failed:', err.message);
  process.exit(1);
});
