// "Happening Nearby" — events near a planned brewery day, from two free
// developer APIs, fetched server-side only (keys never reach the browser):
// - Ticketmaster Discovery API (primary): festivals + everything else, and
//   its sources include Universe/FrontGate where many festivals actually list.
// - SeatGeek Platform API (secondary): strong on concerts and sports.
//
// Both sources are optional. A missing key marks that source "unconfigured"
// and it simply contributes nothing; a failed fetch marks it "down". The
// endpoint built on this NEVER 500s because of an upstream: worst case the
// client gets an empty list and quietly hides the panel.
//
// Follows the breweryApi.js pattern: all third-party calls live in this lib.

const TM_BASE = 'https://app.ticketmaster.com/discovery/v2/events.json';
const SG_BASE = 'https://api.seatgeek.com/2/events';

const BEERY_WORDS =
  /\b(beer|brew|brewery|brewing|ale|lager|ipa|stout|porter|oktoberfest|craft|cider|wine|whisk|bourbon|food truck|bbq|barbecue|taco|pizza|chef|tasting)\b/i;
const FEST_WORDS = /\b(fest|festival|fair|jubilee|celebration|carnival)\b/i;

async function getJson(url, params = {}, timeoutMs = 9000) {
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

function haversineMi(lat1, lng1, lat2, lng2) {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Category from source-native fields first, then from the event name.
function categorize(name, native) {
  if (BEERY_WORDS.test(name) || FEST_WORDS.test(name)) return 'festival';
  return native || 'other';
}

function scoreEvent(ev) {
  // Beer/food/festival first (that's the point of the feature), then closer,
  // then earlier. The client receives events already sorted.
  let score = 0;
  if (BEERY_WORDS.test(ev.name)) score += 100;
  if (ev.category === 'festival') score += 60;
  if (ev.category === 'music') score += 20;
  if (ev.category === 'arts') score += 10;
  if (ev.imageUrl) score += 2;
  return score;
}

function tmCategory(ev) {
  const seg = ev.classifications?.[0]?.segment?.name || '';
  const genre = ev.classifications?.[0]?.genre?.name || '';
  if (/food|drink/i.test(`${seg} ${genre}`)) return 'festival';
  if (/music/i.test(seg)) return 'music';
  if (/sport/i.test(seg)) return 'sports';
  if (/arts|theatre|film/i.test(seg)) return 'arts';
  return 'other';
}

function tmImage(ev) {
  const images = Array.isArray(ev.images) ? ev.images : [];
  const wide = images
    .filter((i) => i.ratio === '16_9' && i.width)
    .sort((a, b) => b.width - a.width)[0];
  return (wide || images[0])?.url || null;
}

async function fetchTicketmaster({ lat, lng, date, radiusMi }) {
  const key = process.env.TICKETMASTER_API_KEY;
  if (!key) return { status: 'unconfigured', events: [] };
  // Widen the UTC window ±1 day and filter on each event's venue-local date
  // — that localDate is the source of truth for "is it on the plan day" and
  // it sidesteps every timezone edge.
  const start = new Date(`${date}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - 1);
  const end = new Date(`${date}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 1);
  const fmt = (d) => `${d.toISOString().slice(0, 19)}Z`;
  try {
    const data = await getJson(TM_BASE, {
      apikey: key,
      latlong: `${lat},${lng}`,
      radius: radiusMi,
      unit: 'miles',
      startDateTime: fmt(start),
      endDateTime: fmt(end),
      size: 50,
      sort: 'distance,date,asc',
    });
    const raw = data?._embedded?.events || [];
    const events = [];
    for (const ev of raw) {
      const localDate = ev.dates?.start?.localDate;
      if (localDate !== date) continue;
      const venue = ev._embedded?.venues?.[0] || {};
      const vLat = venue.location ? Number(venue.location.latitude) : null;
      const vLng = venue.location ? Number(venue.location.longitude) : null;
      const name = ev.name || 'Untitled event';
      events.push({
        id: `tm:${ev.id}`,
        name,
        category: categorize(name, tmCategory(ev)),
        venueName: venue.name || null,
        city: venue.city?.name || null,
        localDate,
        startTimeLocal: ev.dates?.start?.localTime?.slice(0, 5) || null,
        lat: Number.isFinite(vLat) ? vLat : null,
        lng: Number.isFinite(vLng) ? vLng : null,
        imageUrl: tmImage(ev),
        url: ev.url || null,
        source: 'ticketmaster',
      });
    }
    return { status: 'ok', events };
  } catch {
    return { status: 'down', events: [] };
  }
}

function sgCategory(ev) {
  const t = String(ev.type || '').toLowerCase();
  if (t === 'concert' || t === 'music_festival') return t === 'music_festival' ? 'festival' : 'music';
  if (t === 'theater' || t === 'comedy' || t === 'dance_performance_tour' || t === 'broadway_tickets_national')
    return 'arts';
  if (
    ['mlb', 'nfl', 'nba', 'wnba', 'nhl', 'ncaa_bb', 'ncaa_fb', 'soccer', 'nascar', 'golf', 'mma', 'boxing', 'minor_league_baseball'].includes(t)
  )
    return 'sports';
  return 'other';
}

async function fetchSeatgeek({ lat, lng, date, radiusMi }) {
  const clientId = process.env.SEATGEEK_CLIENT_ID;
  if (!clientId) return { status: 'unconfigured', events: [] };
  try {
    // SeatGeek filters on venue-local datetimes, so no timezone math at all.
    const data = await getJson(SG_BASE, {
      client_id: clientId,
      lat,
      lon: lng,
      range: `${radiusMi}mi`,
      'datetime_local.gte': `${date}T00:00:00`,
      'datetime_local.lte': `${date}T23:59:59`,
      per_page: 50,
      sort: 'distance.asc',
    });
    const raw = Array.isArray(data?.events) ? data.events : [];
    const events = [];
    for (const ev of raw) {
      const venue = ev.venue || {};
      const loc = venue.location || {};
      const local = String(ev.datetime_local || '');
      const name = ev.title || 'Untitled event';
      events.push({
        id: `sg:${ev.id}`,
        name,
        category: categorize(name, sgCategory(ev)),
        venueName: venue.name || null,
        city: venue.city || null,
        localDate: local.slice(0, 10) || date,
        startTimeLocal: local.slice(11, 16) || null,
        lat: Number.isFinite(loc.lat) ? loc.lat : null,
        lng: Number.isFinite(loc.lon) ? loc.lon : null,
        imageUrl: ev.performers?.[0]?.image || null,
        url: ev.url || null,
        source: 'seatgeek',
      });
    }
    return { status: 'ok', events };
  } catch {
    return { status: 'down', events: [] };
  }
}

function normalizeName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Merge the two sources: the same real-world event often lists on both.
// Duplicates share a normalized name + date; keep the richer copy.
function dedupe(events) {
  const byKey = new Map();
  for (const ev of events) {
    const key = `${normalizeName(ev.name)}|${ev.localDate}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, ev);
      continue;
    }
    const keep = existing.imageUrl ? existing : ev.imageUrl ? ev : existing;
    const drop = keep === existing ? ev : existing;
    if (!keep.url && drop.url) keep.url = drop.url;
    if (!keep.venueName && drop.venueName) keep.venueName = drop.venueName;
    byKey.set(key, keep);
  }
  return [...byKey.values()];
}

async function fetchEvents({ lat, lng, date, radiusMi }) {
  const [tm, sg] = await Promise.allSettled([
    fetchTicketmaster({ lat, lng, date, radiusMi }),
    fetchSeatgeek({ lat, lng, date, radiusMi }),
  ]);
  const tmRes = tm.status === 'fulfilled' ? tm.value : { status: 'down', events: [] };
  const sgRes = sg.status === 'fulfilled' ? sg.value : { status: 'down', events: [] };

  const configured = tmRes.status !== 'unconfigured' || sgRes.status !== 'unconfigured';

  let events = dedupe([...tmRes.events, ...sgRes.events]);
  for (const ev of events) {
    ev.distanceMi =
      ev.lat != null && ev.lng != null
        ? Math.round(haversineMi(lat, lng, ev.lat, ev.lng) * 10) / 10
        : null;
    ev._score = scoreEvent(ev);
  }
  events.sort(
    (a, b) =>
      b._score - a._score ||
      (a.distanceMi ?? 1e9) - (b.distanceMi ?? 1e9) ||
      String(a.startTimeLocal || '99').localeCompare(String(b.startTimeLocal || '99')),
  );
  events = events.slice(0, 12).map(({ _score, ...rest }) => rest);

  return {
    date,
    anchor: { lat, lng },
    radiusMi,
    events,
    sources: { ticketmaster: tmRes.status, seatgeek: sgRes.status },
    configured,
  };
}

module.exports = { fetchEvents };
