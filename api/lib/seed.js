// First-boot seed: load the bundled brewery + beer data into MongoDB only
// when the collections are empty. Never drops or overwrites — safe on every boot.
const fs = require('fs');
const path = require('path');
const Brewery = require('../models/Brewery');
const Beer = require('../models/Beer');

async function seedCollection(Model, jsonFile, label) {
  const count = await Model.countDocuments();
  if (count > 0) {
    console.log(`seed: ${label} already has ${count} docs — skipping`);
    return 0;
  }
  const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', jsonFile), 'utf8'));
  if (raw.length) await Model.insertMany(raw, { ordered: false });
  console.log(`seed: inserted ${raw.length} docs into ${label}`);
  return raw.length;
}

async function seedIfEmpty() {
  await seedCollection(Brewery, 'breweries.json', 'breweries');
  await seedCollection(Beer, 'beers.json', 'beers');
}

module.exports = { seedIfEmpty };
