const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

async function get(path) {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}

async function send(path, { method = 'POST', body, adminKey } = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(adminKey ? { 'x-admin-key': adminKey } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    const err = new Error((data && data.error) || `Request failed: ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

// Guests rate without accounts: a random token per browser identifies the
// rater (one rating per item per browser; re-rating updates it).
export function voterToken() {
  const KEY = 'brewVoterToken';
  try {
    let token = localStorage.getItem(KEY);
    if (!token) {
      token =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `v${Date.now().toString(36)}${Math.random().toString(36).slice(2, 14)}`;
      localStorage.setItem(KEY, token);
    }
    return token;
  } catch {
    return 'stateless-voter-token';
  }
}

// This browser's own star ratings, remembered for instant display:
// { "beer:<id>": 4, "brewery:<id>": 5 }
export function myRatings() {
  try {
    return JSON.parse(localStorage.getItem('brewMyRatings') || '{}');
  } catch {
    return {};
  }
}

export function rememberMyRating(kind, itemId, stars) {
  try {
    const all = myRatings();
    all[`${kind}:${itemId}`] = stars;
    localStorage.setItem('brewMyRatings', JSON.stringify(all));
  } catch {
    /* storage unavailable */
  }
}

export const api = {
  breweries: () => get('/breweries'),
  searchBreweries: (name) => get(`/breweries?name=${encodeURIComponent(name)}`),
  beersFor: (breweryId) => get(`/breweries/${encodeURIComponent(breweryId)}/beers`),
  beerStyles: () => get('/beer-styles'),
  breweriesByStyle: (style) => get(`/breweries/by-style/${encodeURIComponent(style)}`),
  breweriesByAbv: (min, max) =>
    get(`/breweries/by-abv?min=${min ?? ''}&max=${max ?? ''}`),
  breweriesByIbu: (min, max) =>
    get(`/breweries/by-ibu?min=${min ?? ''}&max=${max ?? ''}`),
  breweriesByAvailability: (value) =>
    get(`/breweries/by-availability/${encodeURIComponent(value)}`),
  geo: () => get('/geo'),
  liveSearch: (q) => get(`/live/search?q=${encodeURIComponent(q)}`),
  nearbyBreweries: (lat, lng, exclude) =>
    get(
      `/breweries/nearby?lat=${lat}&lng=${lng}` +
        (exclude ? `&exclude=${encodeURIComponent(exclude)}` : ''),
    ),
  nearbyPlaces: (lat, lng, kind) => get(`/live/nearby/places?lat=${lat}&lng=${lng}&kind=${kind}`),
  route: (fromLng, fromLat, toLng, toLat) =>
    get(`/live/route?from=${fromLng},${fromLat}&to=${toLng},${toLat}`),
  // v9 — detail, events, ratings, contact, admin
  breweryDetail: (id) => get(`/breweries/detail/${encodeURIComponent(id)}`),
  events: (lat, lng, date, radius) =>
    get(
      `/live/events?lat=${lat}&lng=${lng}&date=${encodeURIComponent(date)}` +
        (radius ? `&radius=${radius}` : ''),
    ),
  rate: ({ kind, itemId, breweryId, itemName, stars }) =>
    send('/ratings', {
      body: { kind, itemId, breweryId, itemName, stars, token: voterToken() },
    }),
  ratingItem: (kind, id) =>
    get(`/ratings/item?kind=${kind}&id=${encodeURIComponent(id)}`),
  ratingSummaries: (kind, ids) =>
    get(`/ratings/summaries?kind=${kind}&ids=${ids.map(encodeURIComponent).join(',')}`),
  contact: (payload) => send('/contact', { body: payload }),
  admin: {
    ratings: (key, limit = 100) =>
      send(`/admin/ratings?limit=${limit}`, { method: 'GET', adminKey: key }),
    ratingsSummary: (key) => send('/admin/ratings/summary', { method: 'GET', adminKey: key }),
    deleteRating: (key, id) =>
      send(`/admin/ratings/${encodeURIComponent(id)}`, { method: 'DELETE', adminKey: key }),
    messages: (key) => send('/admin/messages', { method: 'GET', adminKey: key }),
    markMessageRead: (key, id) =>
      send(`/admin/messages/${encodeURIComponent(id)}/read`, { method: 'PATCH', adminKey: key }),
    deleteMessage: (key, id) =>
      send(`/admin/messages/${encodeURIComponent(id)}`, { method: 'DELETE', adminKey: key }),
  },
};

export function websiteUrl(raw) {
  if (!raw) return null;
  const url = String(raw).trim();
  if (!url) return null;
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}
