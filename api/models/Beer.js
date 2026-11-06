const mongoose = require('mongoose');

// One beer poured by a brewery. Joins to Brewery via brewery_id.
// Seeded from data/beers.json on first boot.
const beerSchema = new mongoose.Schema(
  {
    brewery_id: { type: String, index: true },
    beer_id: String,
    name: String,
    style: String,
    master_style: { type: String, index: true },
    availability: String,
    abv: Number,
    ibu: Number,
  },
  { timestamps: false },
);

module.exports = mongoose.model('Beer', beerSchema);
