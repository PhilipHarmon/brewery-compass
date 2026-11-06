// "Happening Nearby" — events near a planned brewery day, from four
// server-side sources (keys never reach the browser):
// - Ticketmaster Discovery API: festivals + everything else, and its
//   sources include Universe/FrontGate where many festivals actually list.
// - SeatGeek Platform API: strong on concerts and sports.
// - iCal feeds (v11, lib/ical.js): Triangle city calendars, both NC
//   museums in Raleigh, Downtown Durham, Durham County Library — the
//   local layer. No keys needed.
// - Eventbrite (v11, lib/eventbrite.js): a curated list of Triangle
//   organizers (Brewgaloo's Shop Local Raleigh, Trophy Brewing, …),
//   because Eventbrite offers no open search — organizer pulls only.
//
// Every source is optional and failure-isolated. A missing key marks a
// keyed source "unconfigured" and it contributes nothing; a failed fetch
// marks it "down". The endpoint built on this NEVER 500s because of an
// upstream: worst case the client gets an empty list and quietly hides
// the panel.
//
// Follows the breweryApi.js pattern: all third-party calls live in libs.

const { fetchIcalEvents } = require('./ical');
const { fetchEventbriteEvents } = require('./eventbrite');
const {
  categorize,
  scoreEvent,
  haversineMi,
  dedupeEvents,
} = require('./eventShared');

const TM_BASE = 'https://app.ticketmaster.com/discovery/v2/events.json';
const SG_BASE = 'https://api.seatgeek.com/2/events';

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

function settle(result, fallback) {
  return result.status === 'fulfilled' ? result.value : fallback;
}

async function fetchEvents({ lat, lng, date, radiusMi }) {
  const [tm, sg, ic, eb] = await Promise.allSettled([
    fetchTicketmaster({ lat, lng, date, radiusMi }),
    fetchSeatgeek({ lat, lng, date, radiusMi }),
    fetchIcalEvents({ date }),
    fetchEventbriteEvents({ date }),
  ]);
  const tmRes = settle(tm, { status: 'down', events: [] });
  const sgRes = settle(sg, { status: 'down', events: [] });
  const icRes = settle(ic, { status: 'down', events: [] });
  const ebRes = settle(eb, { status: 'unconfigured', events: [] });

  const sources = {
    ticketmaster: tmRes.status,
    seatgeek: sgRes.status,
    ical: icRes.status,
    eventbrite: ebRes.status,
  };
  const configured = Object.values(sources).some((s) => s !== 'unconfigured');

  let events = dedupeEvents([...tmRes.events, ...sgRes.events, ...icRes.events, ...ebRes.events]);
  for (const ev of events) {
    ev.distanceMi =
      ev.lat != null && ev.lng != null
        ? Math.round(haversineMi(lat, lng, ev.lat, ev.lng) * 10) / 10
        : null;
  }
  // Ticketmaster/SeatGeek were radius-queried upstream, so their results
  // are in range by construction. The feed sources (iCal/Eventbrite) are
  // not geo-queried — when an event carries coordinates, hold it to the
  // same radius; coordinate-less local events (most calendar entries)
  // stay, since their Triangle feeds are local by definition.
  events = events.filter(
    (ev) =>
      !['ical', 'eventbrite'].includes(ev.source) ||
      ev.distanceMi == null ||
      ev.distanceMi <= radiusMi,
  );
  for (const ev of events) ev._score = scoreEvent(ev);
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
    sources,
    configured,
  };
}

module.exports = { fetchEvents };
