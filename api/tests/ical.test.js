// Fixture tests for the v11 iCal parser + RRULE expander (lib/ical.js).
// Run: npm test  (node --test tests/)
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { _internal } = require('../lib/ical');
const { normalizeFeed, serialOf } = _internal;

const FEED = { id: 'test', name: 'Test Feed', city: 'Raleigh', eventsPageUrl: 'https://example.com/events' };
const WIN_START = serialOf(2026, 11, 1);
const WIN_END = serialOf(2027, 2, 28);

function cal(...events) {
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//test//EN', ...events, 'END:VCALENDAR'].join('\r\n');
}
function vevent(lines) {
  return ['BEGIN:VEVENT', ...lines, 'END:VEVENT'].join('\r\n');
}
function run(ics, feed = FEED) {
  return normalizeFeed(ics, feed, WIN_START, WIN_END);
}

test('UTC one-off converts to venue-local date/time (EST, UTC-5)', () => {
  const out = run(cal(vevent([
    'UID:u1',
    'DTSTART:20261108T003000Z',
    'SUMMARY:Late Night Jazz',
    'LOCATION:Some Club, Raleigh',
  ])));
  assert.equal(out.length, 1);
  assert.equal(out[0].localDate, '2026-11-07');
  assert.equal(out[0].startTimeLocal, '19:30');
  assert.equal(out[0].source, 'ical');
});

test('TZID event keeps its wall time', () => {
  const out = run(cal(vevent([
    'UID:u2',
    'DTSTART;TZID=America/New_York:20261107T100000',
    'SUMMARY:Fall Arts Fair',
  ])));
  assert.equal(out.length, 1);
  assert.equal(out[0].localDate, '2026-11-07');
  assert.equal(out[0].startTimeLocal, '10:00');
});

test('all-day event has a date and no time', () => {
  const out = run(cal(vevent([
    'UID:u3',
    'DTSTART;VALUE=DATE:20261107',
    'SUMMARY:Street Festival',
  ])));
  assert.equal(out.length, 1);
  assert.equal(out[0].localDate, '2026-11-07');
  assert.equal(out[0].startTimeLocal, null);
});

test('folded lines and escaped commas survive parsing', () => {
  const out = run(cal(vevent([
    'UID:u4',
    'DTSTART;TZID=America/New_York:20261107T170000',
    'SUMMARY:Beers\\, Burgers\\, and ',
    ' Bluegrass Night',
    'LOCATION:Trophy Brewing\\, Raleigh',
  ])));
  assert.equal(out.length, 1);
  assert.equal(out[0].name, 'Beers, Burgers, and Bluegrass Night');
  assert.equal(out[0].venueName, 'Trophy Brewing');
});

test('WEEKLY RRULE with COUNT expands to consecutive weeks', () => {
  const out = run(cal(vevent([
    'UID:w1',
    'DTSTART;TZID=America/New_York:20261107T100000',
    'RRULE:FREQ=WEEKLY;COUNT=3',
    'SUMMARY:Farmers Market',
  ])));
  assert.deepEqual(out.map((e) => e.localDate), ['2026-11-07', '2026-11-14', '2026-11-21']);
});

test('MONTHLY ordinal BYDAY (2nd Saturday — the market pattern)', () => {
  const out = run(cal(vevent([
    'UID:m1',
    'DTSTART;TZID=America/New_York:20261114T090000',
    'RRULE:FREQ=MONTHLY;BYDAY=2SA;COUNT=3',
    'SUMMARY:Second Saturday Market',
  ])));
  assert.deepEqual(out.map((e) => e.localDate), ['2026-11-14', '2026-12-12', '2027-01-09']);
});

test('MONTHLY last-weekday BYDAY (-1SU)', () => {
  const out = run(cal(vevent([
    'UID:m2',
    'DTSTART;TZID=America/New_York:20261129T140000',
    'RRULE:FREQ=MONTHLY;BYDAY=-1SU;COUNT=2',
    'SUMMARY:Last Sunday Social',
  ])));
  assert.deepEqual(out.map((e) => e.localDate), ['2026-11-29', '2026-12-27']);
});

test('EXDATE removes one instance of a recurring series', () => {
  const out = run(cal(vevent([
    'UID:w2',
    'DTSTART;TZID=America/New_York:20261107T100000',
    'RRULE:FREQ=WEEKLY;COUNT=3',
    'EXDATE;TZID=America/New_York:20261114T100000',
    'SUMMARY:Weekly Yoga',
  ])));
  assert.deepEqual(out.map((e) => e.localDate), ['2026-11-07', '2026-11-21']);
});

test('RECURRENCE-ID override replaces the master instance', () => {
  const master = vevent([
    'UID:w3',
    'DTSTART;TZID=America/New_York:20261107T100000',
    'RRULE:FREQ=WEEKLY;COUNT=2',
    'SUMMARY:Trivia Night',
  ]);
  const override = vevent([
    'UID:w3',
    'RECURRENCE-ID;TZID=America/New_York:20261114T100000',
    'DTSTART;TZID=America/New_York:20261115T150000',
    'SUMMARY:Trivia Night (moved)',
  ]);
  const out = run(cal(master, override));
  assert.deepEqual(
    out.map((e) => `${e.localDate} ${e.name}`),
    ['2026-11-07 Trivia Night', '2026-11-15 Trivia Night (moved)'],
  );
});

test('cancelled events are skipped (STATUS and title forms)', () => {
  const a = vevent([
    'UID:c1',
    'DTSTART;TZID=America/New_York:20261107T100000',
    'STATUS:CANCELLED',
    'SUMMARY:Ghost Event',
  ]);
  const b = vevent([
    'UID:c2',
    'DTSTART;TZID=America/New_York:20261107T120000',
    'SUMMARY:Canceled - Ribbon Cutting',
  ]);
  const keep = vevent([
    'UID:c3',
    'DTSTART;TZID=America/New_York:20261107T130000',
    'SUMMARY:Real Event',
  ]);
  const out = run(cal(a, b, keep));
  assert.deepEqual(out.map((e) => e.name), ['Real Event']);
});

test('per-feed name exclusions drop government meetings (Durham pattern)', () => {
  const feed = {
    ...FEED,
    id: 'durham-city',
    excludeNamePatterns: [
      '\\b(board|committee|commission|council|task force|authority|public hearing)\\b',
      '\\bholidays?\\b.*\\bclosings?\\b',
    ],
  };
  const meeting = vevent([
    'UID:g1',
    'DTSTART;TZID=America/New_York:20261109T110000',
    'SUMMARY:Board of Adjustment Meeting',
  ]);
  const holiday = vevent([
    'UID:g2',
    'DTSTART;VALUE=DATE:20261111',
    'SUMMARY:City of Durham Holidays & Closings',
  ]);
  const real = vevent([
    'UID:g3',
    'DTSTART;TZID=America/New_York:20261107T100000',
    'SUMMARY:Fall Arts Fair',
  ]);
  const boardGame = vevent([
    'UID:g4',
    'DTSTART;TZID=America/New_York:20261107T180000',
    'SUMMARY:Community Celebration Night',
  ]);
  const out = run(cal(meeting, holiday, real, boardGame), feed);
  assert.deepEqual(out.map((e) => e.name).sort(), ['Community Celebration Night', 'Fall Arts Fair']);
});

test('out-of-scope metros are dropped (Charlotte strays)', () => {
  const out = run(cal(vevent([
    'UID:o1',
    'DTSTART;TZID=America/New_York:20261107T100000',
    'SUMMARY:Road Trip Fest',
    'LOCATION:Big Arena, Charlotte, NC',
  ])));
  assert.equal(out.length, 0);
});

test('street-address locations yield no venue, city still resolves', () => {
  const out = run(cal(vevent([
    'UID:l1',
    'DTSTART;TZID=America/New_York:20261107T100000',
    'SUMMARY:Park Concert',
    'LOCATION:2100 Shannon Rd, Durham, NC 27707',
  ])));
  assert.equal(out.length, 1);
  assert.equal(out[0].venueName, null);
  assert.equal(out[0].city, 'Durham');
});
