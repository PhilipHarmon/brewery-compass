const mongoose = require('mongoose');

// One guest star rating (1–5 stars, no text) on a beer or a brewery.
// Guests have no accounts: a random per-browser token (generated in the
// browser, kept in localStorage) identifies a rater, so one browser leaves
// at most one rating per item. Re-rating upserts the same document.
const ratingSchema = new mongoose.Schema(
  {
    item_kind: { type: String, enum: ['beer', 'brewery'], required: true, index: true },
    item_id: { type: String, required: true, index: true },
    // Context for the admin view: for a beer, its brewery; for a brewery, itself.
    brewery_id: { type: String, index: true },
    // Name snapshot so the admin list stays readable even if data changes.
    item_name: String,
    voter_token: { type: String, required: true },
    stars: { type: Number, min: 1, max: 5, required: true },
  },
  { timestamps: true },
);

ratingSchema.index({ item_kind: 1, item_id: 1, voter_token: 1 }, { unique: true });

module.exports = mongoose.model('Rating', ratingSchema);
