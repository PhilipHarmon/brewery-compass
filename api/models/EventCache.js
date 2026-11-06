const mongoose = require('mongoose');

// Short-lived cache for the events endpoint (Happening Nearby). One document
// per (rounded anchor, date, radius) key; Mongo's TTL index deletes each
// document 6 hours after it was fetched, which bounds our Ticketmaster /
// SeatGeek usage far below their free-tier quotas.
const eventCacheSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  payload: { type: mongoose.Schema.Types.Mixed, required: true },
  fetchedAt: { type: Date, default: Date.now, expires: 6 * 60 * 60 },
});

module.exports = mongoose.model('EventCache', eventCacheSchema);
