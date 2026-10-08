const express = require('express');
const Brewery = require('../models/Brewery');
const Beer = require('../models/Beer');
const api = require('../lib/breweryApi');

const router = express.Router();

function publicBrewery(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  delete o._id;
  delete o.__v;
  delete o.phone; // keep phone numbers out of bulk payloads
  return o;
}

// GET /api/breweries — all NC breweries (small enough to filter client-side).
// Optional: ?letter=A (name starts with), ?city=, ?type=, ?in_business=Y.
router.get('/breweries', async (req, res, next) => {
  try {
    const q = {};
    if (req.query.letter) q.name = new RegExp(`^${escapeRegExp(req.query.letter)}`, 'i');
    if (req.query.city) q.city = new RegExp(escapeRegExp(req.query.city), 'i');
    if (req.query.type) q.brewery_type = req.query.type;
    if (req.query.in_business) q.in_business = req.query.in_business;
    const docs = await Brewery.find(q).sort({ name: 1 }).lean();
    res.json(docs.map(publicBrewery));
  } catch (err) {
    next(err);
  }
});

// GET /api/breweries/:id/beers — beers for one brewery (by brewery_id).
router.get('/breweries/:id/beers', async (req, res, next) => {
  try {
    const beers = await Beer.find({ brewery_id: req.params.id })
      .sort({ name: 1 })
      .lean();
    res.json(
      beers.map((b) => ({
        name: b.name,
        style: b.style,
        master_style: b.master_style,
        availability: b.availability,
        abv: b.abv,
        ibu: b.ibu,
      })),
    );
  } catch (err) {
    next(err);
  }
});

// GET /api/beer-styles — distinct master styles for filter chips.
router.get('/beer-styles', async (req, res, next) => {
  try {
    const styles = await Beer.distinct('master_style');
    res.json(styles.filter(Boolean).sort());
  } catch (err) {
    next(err);
  }
});

// GET /api/breweries/by-style/:style — brewery_ids pouring a master style.
router.get('/breweries/by-style/:style', async (req, res, next) => {
  try {
    const ids = await Beer.distinct('brewery_id', { master_style: req.params.style });
    res.json(ids);
  } catch (err) {
    next(err);
  }
});

// GET /api/geo — breweries as GeoJSON for the map.
router.get('/geo', async (req, res, next) => {
  try {
    const docs = await Brewery.find({
      latitude: { $ne: null },
      longitude: { $ne: null },
    }).lean();
    res.json({
      type: 'FeatureCollection',
      features: docs.map((b) => ({
        type: 'Feature',
        properties: publicBrewery(b),
        geometry: { type: 'Point', coordinates: [b.longitude, b.latitude] },
      })),
    });
  } catch (err) {
    next(err);
  }
});

// --- Live data (proxied so the frontend needs no keys) ----------------------

// GET /api/live/search?q= — search NC breweries by name (Open Brewery DB).
router.get('/live/search', async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json([]);
    res.json(await api.findBrewery(q));
  } catch (err) {
    res.status(502).json({ error: `Brewery search failed: ${err.message}` });
  }
});

// GET /api/live/nearby/breweries?lat=&lng=&radius_m=
router.get('/live/nearby/breweries', async (req, res, next) => {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ error: 'lat and lng query params are required.' });
    }
    const radiusM = Number(req.query.radius_m) || 10000;
    res.json(await api.nearbyBreweries(lat, lng, radiusM));
  } catch (err) {
    res.status(502).json({ error: `Nearby brewery lookup failed: ${err.message}` });
  }
});

// GET /api/live/nearby/places?lat=&lng=&kind= — never 500s.
router.get('/live/nearby/places', async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.json({ places: [], warning: 'lat and lng query params are required.' });
  }
  const kind = req.query.kind || 'restaurants';
  const radiusM = Number(req.query.radius_m) || 2500;
  const { places, warning } = await api.nearbyPlaces(lat, lng, kind, radiusM);
  res.json({ places, warning });
});

// GET /api/live/route?from=LNG,LAT&to=LNG,LAT — drive time/distance.
router.get('/live/route', async (req, res) => {
  const parse = (s) => String(s || '').split(',').map(Number);
  const [fromLng, fromLat] = parse(req.query.from);
  const [toLng, toLat] = parse(req.query.to);
  if (![fromLng, fromLat, toLng, toLat].every(Number.isFinite)) {
    return res.status(400).json({ error: 'from and to query params as LNG,LAT are required.' });
  }
  const result = await api.routeBetween(fromLng, fromLat, toLng, toLat);
  result.duration_text = api.formatDuration(result.duration_s);
  result.distance_text = api.formatDistance(result.distance_m);
  res.json(result);
});

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = router;
