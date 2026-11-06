// Fixture tests for cross-source dedupe (lib/eventShared.js).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { dedupeEvents, venuesMatch } = require('../lib/eventShared');

function ev(over) {
  return {
    id: 'x',
    name: 'Brewgaloo',
    category: 'festival',
    venueName: 'Fayetteville Street',
    city: 'Raleigh',
    localDate: '2027-04-23',
    startTimeLocal: '18:00',
    lat: null,
    lng: null,
    imageUrl: null,
    url: null,
    source: 'ticketmaster',
    ...over,
  };
}

test('same name + date + venue merges; richer copy wins and gaps fill', () => {
  const tm = ev({ id: 'tm:1', source: 'ticketmaster', imageUrl: 'https://img.example/x.jpg' });
  const eb = ev({ id: 'eb:2', source: 'eventbrite', url: 'https://eventbrite.example/e/2' });
  const out = dedupeEvents([tm, eb]);
  assert.equal(out.length, 1);
  assert.equal(out[0].imageUrl, 'https://img.example/x.jpg'); // image copy kept
  assert.equal(out[0].url, 'https://eventbrite.example/e/2'); // url filled from the drop
});

test('venue containment counts as the same venue', () => {
  assert.equal(venuesMatch('PNC Arena', 'PNC Arena, Raleigh'), true);
  const a = ev({ id: 'a', venueName: 'PNC Arena' });
  const b = ev({ id: 'b', venueName: 'PNC Arena, Raleigh', source: 'ical' });
  assert.equal(dedupeEvents([a, b]).length, 1);
});

test('same name + date but genuinely different venues stay separate', () => {
  const a = ev({ id: 'a', name: 'Trivia Night', venueName: 'Trophy Brewing' });
  const b = ev({ id: 'b', name: 'Trivia Night', venueName: 'The Glass Jug', source: 'ical' });
  assert.equal(dedupeEvents([a, b]).length, 2);
});

test('same name + venue on different dates stays separate', () => {
  const a = ev({ id: 'a', name: 'Trivia Night', localDate: '2026-11-07' });
  const b = ev({ id: 'b', name: 'Trivia Night', localDate: '2026-11-08' });
  assert.equal(dedupeEvents([a, b]).length, 2);
});

test('a missing venue never blocks a merge', () => {
  const a = ev({ id: 'a', venueName: null, imageUrl: 'https://img.example/y.jpg' });
  const b = ev({ id: 'b', venueName: 'Fayetteville Street' });
  const out = dedupeEvents([a, b]);
  assert.equal(out.length, 1);
  assert.equal(out[0].venueName, 'Fayetteville Street'); // filled from the drop
});
