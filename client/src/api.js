const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

async function get(path) {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
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
};

export function websiteUrl(raw) {
  if (!raw) return null;
  const url = String(raw).trim();
  if (!url) return null;
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}
