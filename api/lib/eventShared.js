// Shared helpers for the "Happening Nearby" event sources (eventsApi.js,
// ical.js, eventbrite.js). Every source normalizes into the same shape:
//   { id, name, category, venueName, city, localDate, startTimeLocal,
//     lat, lng, imageUrl, url, source }
// localDate/startTimeLocal are always the VENUE-local date + HH:MM — that
// pair is the source of truth for "is it on the plan day".

const BEERY_WORDS =
  /\b(beer|brew|brewery|brewing|ale|lager|ipa|stout|porter|oktoberfest|craft|cider|wine|whisk|bourbon|food truck|bbq|barbecue|taco|pizza|chef|tasting)\b/i;
const FEST_WORDS = /\b(fest|festival|fair|jubilee|celebration|carnival)\b/i;

// Triangle scope (v11): Philip wants Triangle events only for the local
// sources. Charlotte / Asheville / Wilmington are explicitly out of scope
// this round — if a feed or organizer strays there, drop the event.
const OUT_OF_SCOPE = /\b(charlotte|asheville|wilmington)\b/i;

function isOutOfScope(...texts) {
  return OUT_OF_SCOPE.test(texts.filter(Boolean).join(' '));
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
  // Beer/food/festival first (that's the point of the feature), then the
  // v11 local sources get a small nudge — a brewery's own Eventbrite night
  // or a museum program is usually more useful trip-planning context than
  // another arena listing — then closer, then earlier (applied by caller).
  let score = 0;
  if (BEERY_WORDS.test(ev.name)) score += 100;
  if (ev.category === 'festival') score += 60;
  if (ev.category === 'music') score += 20;
  if (ev.category === 'arts') score += 10;
  if (ev.source === 'ical' || ev.source === 'eventbrite') score += 8;
  if (ev.imageUrl) score += 2;
  return score;
}

function normalizeName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Two venue strings describe the same place when their normalized forms are
// equal, one contains the other ("PNC Arena" vs "PNC Arena Raleigh"), or
// either side is missing (a missing venue never blocks a merge).
function venuesMatch(a, b) {
  const va = normalizeName(a);
  const vb = normalizeName(b);
  if (!va || !vb) return true;
  if (va === vb) return true;
  return va.includes(vb) || vb.includes(va);
}

function richerOf(a, b) {
  if (a.imageUrl && !b.imageUrl) return a;
  if (b.imageUrl && !a.imageUrl) return b;
  if (a.lat != null && b.lat == null) return a;
  if (b.lat != null && a.lat == null) return b;
  if (a.url && !b.url) return a;
  if (b.url && !a.url) return b;
  return a;
}

// Merge duplicates across ALL sources: the same real-world event often
// lists in several places (Ticketmaster + a city calendar, say). Duplicates
// share a normalized name + date + venue; keep the richer copy and fill any
// gaps from the dropped one.
function dedupeEvents(events) {
  const groups = new Map(); // name|date -> [events]
  for (const ev of events) {
    const key = `${normalizeName(ev.name)}|${ev.localDate}`;
    const list = groups.get(key) || [];
    const idx = list.findIndex((e) => venuesMatch(e.venueName, ev.venueName));
    if (idx === -1) {
      list.push(ev);
    } else {
      const existing = list[idx];
      const keep = richerOf(existing, ev);
      const drop = keep === existing ? ev : existing;
      for (const f of ['url', 'venueName', 'city', 'imageUrl', 'startTimeLocal']) {
        if (!keep[f] && drop[f]) keep[f] = drop[f];
      }
      if (keep.lat == null && drop.lat != null) {
        keep.lat = drop.lat;
        keep.lng = drop.lng;
      }
      list[idx] = keep;
    }
    groups.set(key, list);
  }
  return [...groups.values()].flat();
}

module.exports = {
  BEERY_WORDS,
  FEST_WORDS,
  isOutOfScope,
  haversineMi,
  categorize,
  scoreEvent,
  normalizeName,
  venuesMatch,
  dedupeEvents,
};
