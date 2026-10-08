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
const OVERPASS_URLS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];
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

// --- Nearby places: Photon (primary) with Overpass fallback ----------------
// Photon (Komoot's OpenStreetMap search) is a proper search API — far more
// reliable than raw Overpass queries. Overpass mirrors remain as fallback.

const PHOTON_URL = 'https://photon.komoot.io/api/';

const PLACE_QUERIES = {
  restaurants: { q: 'restaurant', osm_tag: 'amenity:restaurant' },
  museums: { q: 'museum', osm_tag: 'tourism:museum' },
  parks: { q: 'park', osm_tag: 'leisure:park' },
};

// Overpass fallback query fragments (kept from the original implementation).
const OVERPASS_TAGS = {
  restaurants: '[amenity=restaurant]',
  museums: '[tourism=museum]',
  parks: '[leisure=park]',
};

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function photonPlace(f, kind) {
  const p = f.properties || {};
  if (!p.name) return null;
  const coords = (f.geometry || {}).coordinates || [];
  const lng = coords[0];
  const lat = coords[1];
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const addr = [p.housenumber, p.street, p.city].filter(Boolean).join(' ');
  return {
    name: p.name,
    kind,
    address: addr || null,
    phone: null,
    website: null,
    lat,
    lng,
  };
}

async function nearbyPlacesPhoton(lat, lng, kind, radiusM, limit) {
  const spec = PLACE_QUERIES[kind];
  // bbox (~3km each way) forces Photon to return genuinely local results —
  // without it, its text search ranks global matches above nearby ones.
  const d = 0.03;
  const bbox = `${lng - d},${lat - d},${lng + d},${lat + d}`;
  const data = await getJson(
    PHOTON_URL,
    { q: spec.q, osm_tag: spec.osm_tag, lat, lon: lng, bbox, limit: 40 },
    12000,
  );
  const radiusKm = radiusM / 1000;
  const places = [];
  for (const f of data.features || []) {
    const place = photonPlace(f, kind);
    if (!place) continue;
    const dKm = haversineKm(lat, lng, place.lat, place.lng);
    if (dKm > radiusKm) continue;
    place.distance_km = Math.round(dKm * 10) / 10;
    places.push(place);
  }
  places.sort((a, b) => a.distance_km - b.distance_km);
  return places.slice(0, limit);
}

async function nearbyPlacesOverpass(lat, lng, kind, radiusM, limit) {
  const tag = OVERPASS_TAGS[kind];
  const query = `[out:json][timeout:15];node(around:${radiusM},${lat},${lng})${tag};out body ${limit};`;
  // Try each Overpass mirror in turn — these community instances go up and
  // down, so failover beats depending on any single one.
  let data = null;
  for (const base of OVERPASS_URLS) {
    try {
      data = await getJson(base, { data: query }, 12000);
      break;
    } catch {
      data = null;
    }
  }
  if (!data) return null;
  const places = [];
  for (const el of data.elements || []) {
    const tags = el.tags || {};
    if (!tags.name) continue;
    const addr = [tags['addr:housenumber'], tags['addr:street'], tags['addr:city']].filter(Boolean).join(' ');
    const plat = el.lat ?? null;
    const plng = el.lon ?? null;
    places.push({
      name: tags.name,
      kind,
      address: addr || null,
      phone: tags.phone || null,
      website: tags.website || null,
      lat: plat,
      lng: plng,
      distance_km:
        plat != null && plng != null
          ? Math.round(haversineKm(lat, lng, plat, plng) * 10) / 10
          : null,
    });
    if (places.length >= limit) break;
  }
  return places;
}

async function nearbyPlaces(lat, lng, kind, radiusM = 2500, limit = 20) {
  if (!PLACE_QUERIES[kind]) return { places: [], warning: `Unknown place kind: ${kind}` };
  // Primary: Photon. Fallback: Overpass mirrors.
  try {
    const places = await nearbyPlacesPhoton(lat, lng, kind, radiusM, limit);
    return { places, warning: null };
  } catch {
    // fall through to Overpass
  }
  try {
    const places = await nearbyPlacesOverpass(lat, lng, kind, radiusM, limit);
    if (places) return { places, warning: null };
  } catch {
    // fall through to the warning below
  }
  return { places: [], warning: 'Nearby places are temporarily unavailable — try again in a bit.' };
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
  haversineKm,
};
