const mongoose = require('mongoose');

// One NC brewery. Seeded from data/breweries.json on first boot; the monthly
// sync only inserts new Open Brewery DB records (keyed by odb_id) and never
// touches existing documents.
const brewerySchema = new mongoose.Schema(
  {
    brewery_id: { type: String, index: true },
    odb_id: { type: String, index: true, sparse: true },
    name: { type: String, required: true },
    in_business: String,
    city: String,
    state: String,
    latitude: Number,
    longitude: Number,
    brewery_type: String,
    phone: String,
    website: String,
    street: String,
    postal_code: String,
  },
  { timestamps: true },
);

module.exports = mongoose.model('Brewery', brewerySchema);
