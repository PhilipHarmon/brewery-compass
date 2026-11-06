// v11 local-events configuration: the iCal feeds and Eventbrite organizers
// behind the "Happening Nearby" local layer. Every entry here was verified
// live on 2026-11-06 (fetch returned real calendar data) — see the v11
// build sheet for the verification log and the rejected candidates.
//
// To add a feed or organizer later: one entry in the right list, nothing
// else. Organizer IDs are the numeric tail of the organizer's Eventbrite
// page URL (eventbrite.com/o/<slug>-<id>).

const ICAL_FEEDS = [
  {
    id: 'durham-city',
    name: 'City of Durham',
    url: 'https://www.durhamnc.gov/common/modules/iCalendar/iCalendar.aspx?feed=calendar',
    city: 'Durham',
    eventsPageUrl: 'https://www.durhamnc.gov/Calendar.aspx',
    // The city's master calendar is mostly government process — board and
    // committee meetings are not "happening nearby" material for a brewery
    // day, so this feed (only this feed) filters them out by name.
    excludeNamePatterns: [
      '\\b(board|committee|commission|council|task force|authority|public hearing)\\b',
      '\\bholidays?\\b.*\\bclosings?\\b',
    ],
  },
  {
    id: 'carrboro-events',
    name: 'Carrboro Community Events',
    url: 'https://www.carrboronc.gov/common/modules/iCalendar/iCalendar.aspx?catID=32&feed=calendar',
    city: 'Carrboro',
    eventsPageUrl: 'https://www.carrboronc.gov/Calendar.aspx',
  },
  {
    id: 'downtown-durham',
    name: 'Downtown Durham Inc',
    url: 'https://downtowndurham.com/events/?ical=1',
    city: 'Durham',
    eventsPageUrl: 'https://downtowndurham.com/downtown-events/',
  },
  {
    id: 'ncmns',
    name: 'NC Museum of Natural Sciences',
    url: 'https://www.naturalsciences.org/calendar/events/?ical=1',
    city: 'Raleigh',
    eventsPageUrl: 'https://naturalsciences.org/calendar',
  },
  {
    id: 'ncma',
    name: 'NC Museum of Art',
    url: 'https://ncartmuseum.org/events-cal/?ical=1',
    city: 'Raleigh',
    eventsPageUrl: 'https://ncartmuseum.org/events/',
  },
  {
    id: 'durham-library',
    name: 'Durham County Library',
    url: 'https://durhamcountylibrary.libcal.com/ical_subscribe.php?src=p&cid=14288',
    city: 'Durham',
    eventsPageUrl: 'https://durhamcountylibrary.org/events/',
  },
];

// Eventbrite has NO open event search — events are only retrievable per
// organizer. These are Triangle organizers whose Eventbrite pages were
// verified live (organizer name + ID read from their own event pages).
// More candidates (Bond Brothers, The Glass Jug, NC Craft Brewers Guild,
// Fullsteam) are researched in the v11 build sheet: no organizer page could
// be confirmed for them, so they are deliberately NOT seeded here — a wrong
// ID would import a stranger's events.
const EVENTBRITE_ORGANIZERS = [
  { id: '1967417187', name: 'Shop Local Raleigh', city: 'Raleigh' }, // Brewgaloo + NC Oktoberfest
  { id: '10952329372', name: 'Trophy Brewing Company', city: 'Raleigh' }, // Oktrophyfest etc.
];

module.exports = { ICAL_FEEDS, EVENTBRITE_ORGANIZERS };
