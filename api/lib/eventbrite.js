// v11 local events, source 2: Eventbrite, by organizer.
//
// API REALITY: Eventbrite has no open event search. Events are retrievable
// only per organizer ID, so this source is a CURATED list of Triangle
// organizers (feedsConfig.js — each ID verified against the organizer's own
// Eventbrite pages). A brewery's own trivia night, a festival's ticket
// page — the layer Ticketmaster and SeatGeek never see.
//
// Optional like the other keyed sources: without EVENTBRITE_TOKEN in the
// API's environment the source reports "unconfigured" and contributes
// nothing. Organizer results are cached in memory (1h) with a last-good
// fallback, same resilience pattern as the iCal feeds.

const { EVENTBRITE_ORGANIZERS } = require('./feedsConfig');
const { categorize, isOutOfScope } = require('./eventShared');

const EB_BASE = 'https://www.eventbriteapi.com/v3';
const CACHE_TTL_MS = 60 * 60 * 1000;
const orgCache = new Map(); // organizerId -> { events, fetchedAt }

// Eventbrite's top-level category IDs -> our categories (mirrors the
// Ticketmaster native mapping: Food & Drink reads as "festival" here).
const EB_CATEGORY = { '110': 'festival', '103': 'music', '105': 'arts', '108': 'sports' };

function normalizeEventbriteEvent(ev, org) {
  const startLocal = ev?.start?.local; // venue-local "YYYY-MM-DDTHH:mm:ss"
  if (!startLocal || typeof startLocal !== 'string') return null;
  if (ev.status && !['live', 'started'].includes(ev.status)) return null;
  const name = String(ev.name?.text || '').trim();
  if (!name) return null;
  const venue = ev.venue || {};
  const addr = venue.address || {};
  const city = addr.city || org.city || null;
  if (isOutOfScope(venue.name, city)) return null;
  const lat = venue.latitude != null ? Number(venue.latitude) : null;
  const lng = venue.longitude != null ? Number(venue.longitude) : null;
  return {
    id: `eb:${ev.id}`,
    name,
    category: categorize(name, EB_CATEGORY[String(ev.category_id || '')] || null),
    venueName: venue.name || null,
    city,
    localDate: startLocal.slice(0, 10),
    startTimeLocal: startLocal.slice(11, 16) || null,
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    imageUrl: ev.logo?.original?.url || ev.logo?.url || null,
    url: ev.url || null,
    source: 'eventbrite',
    feedName: org.name,
  };
}

async function ebGet(path, token, timeoutMs = 12000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${EB_BASE}${path}`, {
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${token}`, accept: 'application/json' },
    });
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchOrganizerEvents(org, token) {
  const hit = orgCache.get(org.id);
  if (hit && Date.now() - hit.fetchedAt < CACHE_TTL_MS) {
    return { status: 'ok', events: hit.events };
  }
  try {
    let data;
    try {
      data = await ebGet(
        `/organizers/${org.id}/events/?status=live&order_by=start.asc&time_filter=current_future&page_size=50`,
        token,
      );
    } catch (err) {
      // Some API accounts reject the time_filter param (400) — retry once
      // without it; client-side date filtering gets the same answer. Auth
      // failures (401/403) will fail identically, so don't waste the call.
      if (err.status !== 400) throw err;
      data = await ebGet(`/organizers/${org.id}/events/?status=live&order_by=start.asc&page_size=50`, token);
    }
    const events = (Array.isArray(data?.events) ? data.events : [])
      .map((ev) => normalizeEventbriteEvent(ev, org))
      .filter(Boolean);
    orgCache.set(org.id, { events, fetchedAt: Date.now() });
    return { status: 'ok', events };
  } catch {
    if (hit) return { status: 'stale', events: hit.events };
    return { status: 'down', events: [] };
  }
}

// All Eventbrite events whose localDate === date.
async function fetchEventbriteEvents({ date }) {
  const token = process.env.EVENTBRITE_TOKEN;
  if (!token) return { status: 'unconfigured', events: [] };
  const results = await Promise.allSettled(
    EVENTBRITE_ORGANIZERS.map((org) => fetchOrganizerEvents(org, token)),
  );
  const events = [];
  let anyOk = false;
  results.forEach((r) => {
    if (r.status !== 'fulfilled') return;
    if (r.value.status === 'ok' || r.value.status === 'stale') anyOk = true;
    for (const ev of r.value.events) if (ev.localDate === date) events.push(ev);
  });
  return { status: anyOk ? 'ok' : 'down', events };
}

module.exports = {
  fetchEventbriteEvents,
  // Exported for tests.
  _internal: { normalizeEventbriteEvent },
};
