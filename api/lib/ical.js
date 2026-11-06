// v11 local events, source 1: public iCal feeds (city calendars, museums,
// a library system, a downtown association). Config-driven — the feed list
// lives in feedsConfig.js; every feed there was verified live before being
// seeded. No API keys: a feed is "configured" by existing.
//
// Reality notes baked into this module:
// - Municipal servers (CivicPlus especially) are flaky: requests time out,
//   connections reset, and a 200 can come back with an empty body. So every
//   fetch retries once, an empty/non-ICS body counts as failure, results
//   are cached in memory for hours, and a failed refresh falls back to the
//   last good copy ("stale") instead of dropping the source.
// - Feeds carry recurring events (weekly markets, storytimes), so a real
//   RRULE expander lives here: DAILY/WEEKLY/MONTHLY/YEARLY with INTERVAL,
//   COUNT, UNTIL, BYDAY (incl. ordinals like 2SA / -1SU), BYMONTH,
//   BYMONTHDAY, plus EXDATE exclusions and RECURRENCE-ID overrides.
// - All feeds are North Carolina, so venue-local means America/New_York.

const { ICAL_FEEDS } = require('./feedsConfig');
const { categorize, isOutOfScope } = require('./eventShared');

const TZ = 'America/New_York';
const CACHE_TTL_MS = 3 * 60 * 60 * 1000;
const EXPAND_AHEAD_DAYS = 120;

/* ---------------- date plumbing (serial days, venue-local) ---------------- */

const dtf = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function serialOf(y, m, d) {
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}
function partsOfSerial(serial) {
  const dt = new Date(serial * 86400000);
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}
function weekdayOfSerial(serial) {
  return new Date(serial * 86400000).getUTCDay(); // 0 = Sunday
}
function fmtDate(y, m, d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${y}-${p(m)}-${p(d)}`;
}
function todaySerial() {
  const parts = {};
  for (const p of dtf.formatToParts(new Date())) parts[p.type] = p.value;
  return serialOf(Number(parts.year), Number(parts.month), Number(parts.day));
}
// UTC instant -> venue-local { serial, hh, mm }
function utcToLocal(ms) {
  const parts = {};
  for (const p of dtf.formatToParts(new Date(ms))) parts[p.type] = p.value;
  return {
    serial: serialOf(Number(parts.year), Number(parts.month), Number(parts.day)),
    hh: Number(parts.hour) % 24,
    mm: Number(parts.minute),
  };
}

/* ---------------- ICS text parsing ---------------- */

function unfoldLines(text) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\n[ \t]/g, '')
    .split('\n');
}

function unescapeText(s) {
  return String(s || '')
    .replace(/\\n/gi, ' ')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
    .trim();
}

// One "NAME;PARAM=VALUE;...:value" line -> { name, params, value }
function parsePropLine(line) {
  const colon = line.indexOf(':');
  if (colon === -1) return null;
  const head = line.slice(0, colon).split(';');
  const name = head[0].toUpperCase();
  const params = {};
  for (const kv of head.slice(1)) {
    const eq = kv.indexOf('=');
    if (eq > 0) params[kv.slice(0, eq).toUpperCase()] = kv.slice(eq + 1).replace(/^"|"$/g, '');
  }
  return { name, params, value: line.slice(colon + 1) };
}

// Split a calendar into VEVENT prop-bags: { PROPS: [{params, value}, ...] }
function parseCalendar(text) {
  const events = [];
  let current = null;
  for (const line of unfoldLines(text)) {
    if (line === 'BEGIN:VEVENT') current = {};
    else if (line === 'END:VEVENT') {
      if (current) events.push(current);
      current = null;
    } else if (current) {
      const prop = parsePropLine(line);
      if (prop) (current[prop.name] = current[prop.name] || []).push(prop);
    }
  }
  return events;
}

function firstProp(bag, name) {
  return bag[name] ? bag[name][0] : null;
}
function propValue(bag, name) {
  const p = firstProp(bag, name);
  return p ? p.value : null;
}

// An ICS date/time value -> { serial, hh, mm, allDay } in venue-local terms.
function parseDateValue(prop) {
  const v = String(prop.value || '').trim();
  const dateOnly = /^\d{8}$/.test(v) || String(prop.params.VALUE || '').toUpperCase() === 'DATE';
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?/);
  if (!m) return null;
  const [, ys, ms, ds, hh, mm] = m;
  const y = Number(ys);
  const mo = Number(ms);
  const d = Number(ds);
  if (dateOnly || hh === undefined) return { serial: serialOf(y, mo, d), hh: null, mm: null, allDay: true };
  if (m[7] === 'Z') {
    const local = utcToLocal(Date.UTC(y, mo - 1, d, Number(hh), Number(mm), Number(m[6] || 0)));
    return { serial: local.serial, hh: local.hh, mm: local.mm, allDay: false };
  }
  // TZID or floating: the value is already wall time in the event's zone.
  return { serial: serialOf(y, mo, d), hh: Number(hh), mm: Number(mm), allDay: false };
}

/* ---------------- RRULE expansion ---------------- */

const DAY_CODE = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

function parseRrule(value) {
  const out = {};
  for (const part of String(value || '').split(';')) {
    const eq = part.indexOf('=');
    if (eq > 0) out[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1);
  }
  return out;
}

// BYDAY entries: "MO" or "2SA" / "-1SU" -> { weekday, ordinal|null }
function parseByDay(value) {
  if (!value) return [];
  return value
    .split(',')
    .map((tok) => {
      const m = tok.trim().match(/^([+-]?\d+)?([A-Z]{2})$/);
      if (!m || DAY_CODE[m[2]] === undefined) return null;
      return { weekday: DAY_CODE[m[2]], ordinal: m[1] ? Number(m[1]) : null };
    })
    .filter(Boolean);
}

function daysInMonth(y, m) {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

// All serials in month (y, m) matching one BYDAY entry.
function byDaySerialsInMonth(y, m, entry) {
  const dim = daysInMonth(y, m);
  const matches = [];
  for (let d = 1; d <= dim; d += 1) {
    if (weekdayOfSerial(serialOf(y, m, d)) === entry.weekday) matches.push(serialOf(y, m, d));
  }
  if (entry.ordinal == null) return matches;
  if (entry.ordinal > 0) return matches[entry.ordinal - 1] ? [matches[entry.ordinal - 1]] : [];
  const idx = matches.length + entry.ordinal;
  return idx >= 0 ? [matches[idx]] : [];
}

// Expand one master event into occurrence { serial, hh, mm } list within
// [winStart, winEnd]. COUNT/UNTIL semantics are honored from DTSTART even
// when DTSTART is long before the window.
function expandOccurrences(start, rruleValue, winStart, winEnd) {
  if (!rruleValue) {
    return start.serial >= winStart && start.serial <= winEnd
      ? [{ serial: start.serial, hh: start.hh, mm: start.mm }]
      : [];
  }
  const rr = parseRrule(rruleValue);
  const freq = String(rr.FREQ || '').toUpperCase();
  const interval = Math.max(1, Number(rr.INTERVAL) || 1);
  const count = rr.COUNT ? Number(rr.COUNT) : null;
  let untilSerial = null;
  if (rr.UNTIL) {
    const u = parseDateValue({ value: rr.UNTIL, params: {} });
    if (u) untilSerial = u.serial;
  }
  const byDay = parseByDay(rr.BYDAY);
  const byMonthDay = rr.BYMONTHDAY
    ? rr.BYMONTHDAY.split(',').map((n) => Number(n)).filter(Number.isFinite)
    : null;
  const byMonth = rr.BYMONTH
    ? rr.BYMONTH.split(',').map((n) => Number(n)).filter(Number.isFinite)
    : null;

  const startParts = partsOfSerial(start.serial);
  const occurrences = [];
  let seen = 0; // occurrences from DTSTART onward (for COUNT)
  const MAX_STEPS = 6000;

  function consider(serial) {
    if (serial < start.serial) return 'continue';
    if (untilSerial != null && serial > untilSerial) return 'stop';
    seen += 1;
    if (count != null && seen > count) return 'stop';
    if (serial >= winStart && serial <= winEnd) {
      occurrences.push({ serial, hh: start.hh, mm: start.mm });
    }
    if (serial > winEnd && (count == null || seen >= count)) return 'stop';
    if (serial > winEnd && untilSerial == null && count == null) return 'stop';
    return 'continue';
  }

  if (freq === 'DAILY') {
    const wantedDays = byDay.length ? new Set(byDay.map((b) => b.weekday)) : null;
    for (let step = 0, serial = start.serial; step < MAX_STEPS; step += 1, serial += interval) {
      if (wantedDays && !wantedDays.has(weekdayOfSerial(serial))) {
        if (serial > winEnd) break;
        continue;
      }
      if (consider(serial) === 'stop') break;
    }
  } else if (freq === 'WEEKLY') {
    const days = byDay.length ? byDay.map((b) => b.weekday) : [weekdayOfSerial(start.serial)];
    const firstSunday = start.serial - weekdayOfSerial(start.serial);
    outer: for (let w = 0; w < MAX_STEPS; w += 1) {
      const weekStart = firstSunday + w * 7 * interval;
      if (weekStart - 6 > winEnd && count == null && untilSerial == null) break;
      for (const wd of [...days].sort((a, b) => a - b)) {
        if (consider(weekStart + wd) === 'stop') break outer;
      }
      if (weekStart > winEnd && (count == null || seen >= count)) break;
    }
  } else if (freq === 'MONTHLY' || freq === 'YEARLY') {
    const yearsAhead = freq === 'YEARLY' ? 60 : 0;
    let { y, m } = startParts;
    for (let step = 0; step < MAX_STEPS; step += 1) {
      const months = freq === 'MONTHLY' ? [m] : byMonth && byMonth.length ? byMonth : [startParts.m];
      for (const mon of months) {
        if (freq === 'YEARLY' && byMonth && !byMonth.includes(mon)) continue;
        const dim = daysInMonth(y, mon);
        let serials = [];
        if (byMonthDay) {
          for (const md of byMonthDay) {
            const day = md > 0 ? md : dim + md + 1;
            if (day >= 1 && day <= dim) serials.push(serialOf(y, mon, day));
          }
        } else if (byDay.length) {
          for (const entry of byDay) serials.push(...byDaySerialsInMonth(y, mon, entry));
        } else {
          const day = Math.min(startParts.d, dim);
          serials.push(serialOf(y, mon, day));
        }
        serials = [...new Set(serials)].sort((a, b) => a - b);
        let stop = false;
        for (const s of serials) {
          if (consider(s) === 'stop') { stop = true; break; }
        }
        if (stop) return occurrences;
      }
      if (freq === 'MONTHLY') {
        m += interval;
        while (m > 12) { m -= 12; y += 1; }
        if (serialOf(y, m, 1) > winEnd + 62 && count == null && untilSerial == null) break;
        if (y > startParts.y + 30) break;
      } else {
        y += interval;
        if (y > startParts.y + yearsAhead + 30) break;
        if (serialOf(y, 1, 1) > winEnd + 400 && count == null && untilSerial == null) break;
      }
    }
  }
  return occurrences;
}

/* ---------------- normalization ---------------- */

const TRIANGLE_CITIES = [
  'Raleigh', 'Durham', 'Chapel Hill', 'Carrboro', 'Cary', 'Apex', 'Wake Forest',
  'Morrisville', 'Garner', 'Holly Springs', 'Fuquay-Varina', 'Knightdale',
  'Research Triangle Park',
];

function parseLocation(location, feed) {
  const loc = String(location || '').trim();
  if (!loc) return { venueName: feed.defaultVenue || null, city: feed.city || null };
  let city = null;
  for (const c of TRIANGLE_CITIES) {
    if (loc.toLowerCase().includes(c.toLowerCase())) { city = c; break; }
  }
  const first = loc.split(',')[0].trim();
  let venueName = null;
  // A leading street number means the first segment is an address, not a
  // venue; "Online"/"Virtual" events have no venue at all.
  if (first && !/^\d/.test(first) && !/^(online|virtual|zoom|webinar)/i.test(first) && first.length <= 60) {
    venueName = first;
  }
  return { venueName: venueName || feed.defaultVenue || null, city: city || feed.city || null };
}

const CANCELLED_NAME = /^\s*cancell?ed\b/i;

function normalizeFeed(text, feed, winStart, winEnd) {
  const bags = parseCalendar(text);
  const exclude = (feed.excludeNamePatterns || []).map((p) => new RegExp(p, 'i'));
  const byUid = new Map();
  for (const bag of bags) {
    const uid = propValue(bag, 'UID') || `${feed.id}-${byUid.size}`;
    const isOverride = Boolean(firstProp(bag, 'RECURRENCE-ID'));
    const entry = byUid.get(uid) || { master: null, overrides: [] };
    if (isOverride) entry.overrides.push(bag);
    else entry.master = bag;
    byUid.set(uid, entry);
  }

  const out = [];
  function emit(bag, occ) {
    const name = unescapeText(propValue(bag, 'SUMMARY')).replace(/\s+/g, ' ');
    if (!name || CANCELLED_NAME.test(name)) return;
    if (String(propValue(bag, 'STATUS') || '').toUpperCase() === 'CANCELLED') return;
    if (exclude.some((re) => re.test(name))) return;
    const location = unescapeText(propValue(bag, 'LOCATION'));
    const { venueName, city } = parseLocation(location, feed);
    if (isOutOfScope(location, city)) return;
    let lat = null;
    let lng = null;
    const geo = propValue(bag, 'GEO');
    if (geo) {
      const [gLat, gLng] = geo.split(';').map(Number);
      if (Number.isFinite(gLat) && Number.isFinite(gLng)) { lat = gLat; lng = gLng; }
    }
    const cats = propValue(bag, 'CATEGORIES') || '';
    let native = null;
    if (/music|concert/i.test(cats)) native = 'music';
    else if (/art|exhibit|theat(re|er)|film/i.test(cats)) native = 'arts';
    else if (/sport|athletic/i.test(cats)) native = 'sports';
    const { y, m, d } = partsOfSerial(occ.serial);
    out.push({
      id: `ics:${feed.id}:${String(propValue(bag, 'UID') || name).slice(0, 40)}:${fmtDate(y, m, d)}`,
      name,
      category: categorize(name, native),
      venueName,
      city,
      localDate: fmtDate(y, m, d),
      startTimeLocal:
        occ.hh == null ? null : `${String(occ.hh).padStart(2, '0')}:${String(occ.mm || 0).padStart(2, '0')}`,
      lat,
      lng,
      imageUrl: null,
      url: propValue(bag, 'URL') || feed.eventsPageUrl || null,
      source: 'ical',
      feedName: feed.name,
    });
  }

  for (const { master, overrides } of byUid.values()) {
    if (!master) continue;
    const startProp = firstProp(master, 'DTSTART');
    if (!startProp) continue;
    const start = parseDateValue(startProp);
    if (!start) continue;
    const overrideKeys = new Set();
    for (const ov of overrides) {
      const rid = parseDateValue(firstProp(ov, 'RECURRENCE-ID'));
      if (rid) overrideKeys.add(`${rid.serial}|${rid.hh}`);
    }
    const exdates = new Set();
    for (const prop of master.EXDATE || []) {
      for (const piece of String(prop.value).split(',')) {
        const ex = parseDateValue({ value: piece, params: prop.params });
        if (ex) exdates.add(`${ex.serial}|${ex.hh}`);
      }
    }
    const rrule = propValue(master, 'RRULE');
    for (const occ of expandOccurrences(start, rrule, winStart, winEnd)) {
      const key = `${occ.serial}|${occ.hh}`;
      if (exdates.has(key) || overrideKeys.has(key)) continue;
      emit(master, occ);
    }
    // Overrides stand on their own (rescheduled instances).
    for (const ov of overrides) {
      const oStartProp = firstProp(ov, 'DTSTART');
      if (!oStartProp) continue;
      const oStart = parseDateValue(oStartProp);
      if (!oStart || oStart.serial < winStart || oStart.serial > winEnd) continue;
      emit(ov, oStart);
    }
  }
  return out;
}

/* ---------------- fetching, with cache + retry + last-good ---------------- */

const feedCache = new Map(); // feedId -> { events, fetchedAt, winEnd }

async function fetchIcsText(url) {
  let lastErr = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    try {
      const res = await fetch(url, {
        signal: ctrl.signal,
        redirect: 'follow',
        headers: { 'user-agent': 'BreweryCompass/1.1 (local events)', accept: 'text/calendar, */*' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.text();
      // CivicPlus intermittently answers 200 with an EMPTY body — that is a
      // failure, not an empty calendar.
      if (!body || !body.includes('BEGIN:VCALENDAR')) throw new Error('not an ICS body');
      return body;
    } catch (err) {
      lastErr = err;
      if (attempt === 0) await new Promise((r) => setTimeout(r, 900));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr || new Error('fetch failed');
}

async function getFeedEvents(feed, winStart, winEnd) {
  const hit = feedCache.get(feed.id);
  if (hit && Date.now() - hit.fetchedAt < CACHE_TTL_MS && winEnd <= hit.winEnd) {
    return { status: 'ok', events: hit.events };
  }
  try {
    const text = await fetchIcsText(feed.url);
    const events = normalizeFeed(text, feed, winStart, winEnd);
    feedCache.set(feed.id, { events, fetchedAt: Date.now(), winEnd });
    return { status: 'ok', events };
  } catch {
    if (hit) return { status: 'stale', events: hit.events };
    return { status: 'down', events: [] };
  }
}

// All local-calendar events whose localDate === date.
async function fetchIcalEvents({ date }) {
  const [y, m, d] = String(date).split('-').map(Number);
  const dateSerial = serialOf(y, m, d);
  const winStart = Math.min(todaySerial() - 2, dateSerial);
  const winEnd = Math.max(todaySerial() + EXPAND_AHEAD_DAYS, dateSerial);
  const results = await Promise.allSettled(ICAL_FEEDS.map((f) => getFeedEvents(f, winStart, winEnd)));
  const events = [];
  let anyOk = false;
  let anyStale = false;
  results.forEach((r) => {
    if (r.status !== 'fulfilled') return;
    if (r.value.status === 'ok') anyOk = true;
    if (r.value.status === 'stale') anyStale = true;
    for (const ev of r.value.events) if (ev.localDate === date) events.push(ev);
  });
  return { status: anyOk || anyStale ? 'ok' : 'down', events };
}

module.exports = {
  fetchIcalEvents,
  // Exported for tests.
  _internal: { parseCalendar, parseDateValue, expandOccurrences, normalizeFeed, serialOf, fmtDate },
};
