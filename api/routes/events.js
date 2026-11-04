const express = require('express');
const { fetchEvents } = require('../lib/eventsApi');
const EventCache = require('../models/EventCache');

const router = express.Router();

// GET /api/live/events?lat=&lng=&date=YYYY-MM-DD&radius=<miles, default 25, max 50>
// Events near an anchor (the latest itinerary stop) on the plan date, from
// Ticketmaster + SeatGeek. Upstream problems never reach the user: a source
// that is unconfigured or down just contributes nothing, and with neither key
// set the response says configured:false so the client hides the panel.
router.get('/live/events', async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ error: 'lat and lng query params are required.' });
  }
  const date = String(req.query.date || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'date query param must be YYYY-MM-DD.' });
  }
  let radiusMi = Number(req.query.radius) || 25;
  radiusMi = Math.min(50, Math.max(1, Math.round(radiusMi)));

  const cacheKey = `${lat.toFixed(2)},${lng.toFixed(2)},${date},${radiusMi}`;
  try {
    const hit = await EventCache.findOne({ key: cacheKey }).lean();
    if (hit) return res.json({ ...hit.payload, cached: true });
  } catch {
    // Cache is an optimization; a cache read failure just means we fetch.
  }

  const payload = await fetchEvents({ lat, lng, date, radiusMi });

  // Only cache real answers: not the "no keys yet" state (so the feature
  // lights up immediately once keys are added) and not an all-sources-down
  // moment (so a transient outage doesn't stick for 6 hours).
  const anyOk = payload.sources.ticketmaster === 'ok' || payload.sources.seatgeek === 'ok';
  if (payload.configured && anyOk) {
    try {
      await EventCache.updateOne(
        { key: cacheKey },
        { $set: { payload, fetchedAt: new Date() } },
        { upsert: true },
      );
    } catch {
      // Non-fatal: the response below still goes out.
    }
  }
  return res.json(payload);
});

module.exports = router;
