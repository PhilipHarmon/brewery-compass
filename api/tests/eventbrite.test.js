// Fixture tests for the Eventbrite organizer-event normalizer.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { _internal } = require('../lib/eventbrite');
const { normalizeEventbriteEvent } = _internal;

const ORG = { id: '10952329372', name: 'Trophy Brewing Company', city: 'Raleigh' };

function ebEvent(over = {}) {
  return {
    id: '1234567890',
    name: { text: 'Oktrophyfest' },
    category_id: '110',
    status: 'live',
    start: { local: '2026-11-07T12:00:00', timezone: 'America/New_York' },
    url: 'https://www.eventbrite.example/e/oktrophyfest',
    logo: { url: 'https://img.example/logo.png', original: { url: 'https://img.example/logo-big.png' } },
    venue: {
      name: 'Trophy Brewing & Taproom',
      latitude: '35.767',
      longitude: '-78.657',
      address: { city: 'Raleigh', region: 'NC' },
    },
    ...over,
  };
}

test('a live organizer event normalizes into the shared shape', () => {
  const out = normalizeEventbriteEvent(ebEvent(), ORG);
  assert.equal(out.id, 'eb:1234567890');
  assert.equal(out.name, 'Oktrophyfest');
  assert.equal(out.category, 'festival'); // Eventbrite category 110 = Food & Drink
  assert.equal(out.venueName, 'Trophy Brewing & Taproom');
  assert.equal(out.city, 'Raleigh');
  assert.equal(out.localDate, '2026-11-07');
  assert.equal(out.startTimeLocal, '12:00');
  assert.equal(out.lat, 35.767);
  assert.equal(out.lng, -78.657);
  assert.equal(out.imageUrl, 'https://img.example/logo-big.png'); // original wins
  assert.equal(out.source, 'eventbrite');
});

test('draft and canceled events are dropped', () => {
  assert.equal(normalizeEventbriteEvent(ebEvent({ status: 'draft' }), ORG), null);
  assert.equal(normalizeEventbriteEvent(ebEvent({ status: 'canceled' }), ORG), null);
});

test('events outside the Triangle scope are dropped', () => {
  const out = normalizeEventbriteEvent(
    ebEvent({ venue: { name: 'Big Arena', address: { city: 'Charlotte', region: 'NC' } } }),
    ORG,
  );
  assert.equal(out, null);
});

test('missing start time is dropped, never guessed', () => {
  const bad = ebEvent();
  delete bad.start;
  assert.equal(normalizeEventbriteEvent(bad, ORG), null);
});
