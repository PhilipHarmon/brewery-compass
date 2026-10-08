// Server-side helpers for live brewery/places/routing data.
//
// All third-party calls go through here so the frontend never needs keys:
// - Open Brewery DB (https://www.openbrewerydb.org/) — free, no key.
// - Overpass API (OpenStreetMap) — free, no key. Flaky: failures mean "no results".
// - OSRM demo server — free, no key. Drive time/distance.
//
// Faithful port of the Flask version's behavior; no new data sources.

const ODB_BASE = 'https://api.openbrewerydb.org/v1/breweries';
const OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving';
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const NC_STATE = 'north_carolina';

async function getJson(url, params = {}, timeoutMs = 8000) {
  const qs = new URLSearchParams(params).toString();
  const full = qs ? `${url}?${qs}` : url;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(full, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function normalizeOdb(record) {
  const street = record.street || record.address_1 || null;
  return {
    odb_id: record.id || null,
    name: record.name || null,
    brewery_type: record.brewery_type || null,
    street,
    city: record.city || null,
    state: record.state_province || record.state || null,
    postal_code: record.postal_code || null,
    phone: record.phone || null,
    website_url: record.website_url || null,
    longitude: record.longitude != null ? Number(record.longitude) : null,
    latitude: record.latitude != null ? Number(record.latitude) : null,
  };
}

function hasCoords(b) {
  return b.latitude != null && b.longitude != null && Number.isFinite(b.latitude) && Number.isFinite(b.longitude);
}

async function searchBreweriesODB({ state = NC_STATE, page = 1, perPage = 200 } = {}) {
  const records = await getJson(ODB_BASE, { by_state: state, page, per_page: perPage });
  return (Array.isArray(records) ? records : []).map(normalizeOdb);
}

async function nearbyBreweries(lat, lng, radiusM = 10000, perPage = 20) {
  const records = await getJson(ODB_BASE, {
    by_dist: `${lat},${lng}`,
    dist: radiusM,
    per_page: perPage,
  });
  return (Array.isArray(records) ? records : []).map(normalizeOdb).filter(hasCoords);
}

async function findBrewery(name, state = NC_STATE, limit = 15) {
  const records = await getJson(ODB_BASE, { by_name: name, per_page: 50 });
  const matches = [];
  for (const record of Array.isArray(records) ? records : []) {
    const norm = normalizeOdb(record);
    const stateVal = String(norm.state || '').toLowerCase().replace(/ /g, '_');
    if (stateVal === state) matches.push(norm);
    if (matches.length >= limit) break;
  }
  return matches;
}

// --- Nearby places via Overpass (never throws) -----------------------------

const PLACE_QUERIES = {
  restaurants: '[amenity=restaurant]',
  museums: '[tourism=museum]',
  parks: '[leisure=park]',
};

async function nearbyPlaces(lat, lng, kind, radiusM = 2500, limit = 20) {
  if (!PLACE_QUERIES[kind]) return { places: [], warning: `Unknown place kind: ${kind}` };
  const query = `[out:json][timeout:20];node(around:${radiusM},${lat},${lng})${PLACE_QUERIES[kind]};out body ${limit};`;
  let data;
  try {
    data = await getJson(OVERPASS_URL, { data: query }, 20000);
  } catch {
    return { places: [], warning: 'Nearby places are temporarily unavailable — try again in a bit.' };
  }
  const places = [];
  for (const el of data.elements || []) {
    const tags = el.tags || {};
    if (!tags.name) continue;
    const addr = [tags['addr:housenumber'], tags['addr:street'], tags['addr:city']].filter(Boolean).join(' ');
    places.push({
      name: tags.name,
      kind,
      address: addr || null,
      phone: tags.phone || null,
      website: tags.website || null,
      lat: el.lat ?? null,
      lng: el.lon ?? null,
    });
    if (places.length >= limit) break;
  }
  return { places, warning: null };
}

// --- Routing via OSRM (never throws) ---------------------------------------

async function routeBetween(fromLng, fromLat, toLng, toLat) {
  const url = `${OSRM_BASE}/${fromLng},${fromLat};${toLng},${toLat}`;
  try {
    const data = await getJson(url, { overview: 'false' });
    const route = (data.routes || [])[0] || {};
    return { duration_s: route.duration ?? null, distance_m: route.distance ?? null };
  } catch {
    return { duration_s: null, distance_m: null, warning: 'Drive time unavailable right now.' };
  }
}

function formatDuration(seconds) {
  if (seconds == null) return null;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

function formatDistance(meters) {
  if (meters == null) return null;
  return `${(meters / 1609.344).toFixed(1)} mi`;
}

module.exports = {
  normalizeOdb,
  hasCoords,
  searchBreweriesODB,
  nearbyBreweries,
  findBrewery,
  nearbyPlaces,
  routeBetween,
  formatDuration,
  formatDistance,
};
