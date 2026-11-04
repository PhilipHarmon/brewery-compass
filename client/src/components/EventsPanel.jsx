import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';

const DATE_KEY = 'brewDayDate';
const CAT_ICON = { festival: '🎪', music: '🎵', sports: '🏟️', arts: '🎭', other: '🎟️' };
const CAT_LABEL = { festival: 'Festival', music: 'Music', sports: 'Sports', arts: 'Arts', other: 'Event' };

function isoLocal(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function todayIso() {
  return isoLocal(new Date());
}

function thisSaturdayIso() {
  const d = new Date();
  const add = (6 - d.getDay() + 7) % 7; // Saturday = day 6; today counts if it IS Saturday
  d.setDate(d.getDate() + add);
  return isoLocal(d);
}

function loadDate() {
  try {
    const saved = localStorage.getItem(DATE_KEY);
    if (saved && /^\d{4}-\d{2}-\d{2}$/.test(saved)) return saved;
  } catch {
    /* ignore */
  }
  return todayIso();
}

// "Sat, Nov 7 · 7:30 PM" from the event's venue-local date + time.
function formatWhen(ev) {
  const [y, m, d] = String(ev.localDate || '').split('-').map(Number);
  let out = '';
  if (y && m && d) {
    out = new Date(y, m - 1, d).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  }
  if (ev.startTimeLocal) {
    const [hh, mm] = ev.startTimeLocal.split(':').map(Number);
    if (Number.isFinite(hh)) {
      const dt = new Date(2000, 0, 1, hh, mm || 0);
      out += ` · ${dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
    }
  }
  return out;
}

// The "Happening near your day" panel for Plan a Day. Anchored to the latest
// itinerary stop, exactly like nearby breweries. Graceful by design:
// - no stops yet → a gentle invite, not a dead panel
// - event sources not configured (no API keys yet) or down → renders nothing
// - configured but nothing on → a friendly one-liner, never an empty box
export default function EventsPanel({ stops }) {
  const [date, setDate] = useState(loadDate);
  const [state, setState] = useState({ status: 'idle', events: [] });

  const anchor = useMemo(() => {
    for (let i = stops.length - 1; i >= 0; i -= 1) {
      const s = stops[i];
      if (s.lat != null && s.lng != null) return s;
    }
    return null;
  }, [stops]);

  useEffect(() => {
    try {
      localStorage.setItem(DATE_KEY, date);
    } catch {
      /* storage unavailable */
    }
  }, [date]);

  useEffect(() => {
    if (!anchor) {
      setState({ status: 'no-anchor', events: [] });
      return;
    }
    let cancelled = false;
    setState((prev) => ({ ...prev, status: 'loading' }));
    api
      .events(anchor.lat, anchor.lng, date)
      .then((data) => {
        if (cancelled) return;
        if (!data.configured) {
          setState({ status: 'hidden', events: [] });
          return;
        }
        const anyOk = data.sources?.ticketmaster === 'ok' || data.sources?.seatgeek === 'ok';
        if (!anyOk && (!data.events || data.events.length === 0)) {
          setState({ status: 'hidden', events: [] });
          return;
        }
        setState({ status: data.events?.length ? 'ready' : 'empty', events: data.events || [] });
      })
      .catch(() => !cancelled && setState({ status: 'hidden', events: [] }));
    return () => {
      cancelled = true;
    };
  }, [anchor, date]);

  if (!anchor) {
    return (
      <section className="panel events-panel">
        <h2 className="panel-title">🎪 Happening near your day</h2>
        <p className="muted">
          Add a starting brewery and we'll check what's on nearby — festivals, concerts,
          ballgames — for the day you're planning.
        </p>
        <DateRow date={date} setDate={setDate} />
      </section>
    );
  }

  if (state.status === 'hidden') return null;

  return (
    <section className="panel events-panel">
      <h2 className="panel-title">🎪 Happening near your day</h2>
      <DateRow date={date} setDate={setDate} />
      {state.status === 'loading' && <p className="muted">Checking what's on…</p>}
      {state.status === 'empty' && (
        <p className="muted">
          Nothing big on the calendar near {anchor.name} that day — it's a brewery day. 🍺
        </p>
      )}
      {state.status === 'ready' && (
        <ul className="event-list">
          {state.events.map((ev) => (
            <li key={ev.id} className="event-card">
              {ev.imageUrl && (
                <img className="event-img" src={ev.imageUrl} alt="" loading="lazy" />
              )}
              <div className="event-main">
                <div className="event-top">
                  <strong>{ev.name}</strong>
                  <span className="kind-badge">
                    {CAT_ICON[ev.category] || CAT_ICON.other} {CAT_LABEL[ev.category] || 'Event'}
                  </span>
                </div>
                <div className="muted small">
                  {[ev.venueName, ev.city].filter(Boolean).join(' · ')}
                </div>
                <div className="event-when">
                  {formatWhen(ev)}
                  {ev.distanceMi != null && (
                    <span className="dist-badge">
                      📍 {ev.distanceMi.toFixed(1)} mi from {anchor.name}
                    </span>
                  )}
                </div>
                {ev.url && (
                  <a
                    className="btn btn-primary btn-sm event-btn"
                    href={ev.url}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    🎟️ Tickets / details
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {state.status === 'ready' && (
        <p className="muted small event-note">
          Events via Ticketmaster & SeatGeek — they catch festivals, concerts, ballgames, and
          theater, not a small brewery's own trivia night.
        </p>
      )}
    </section>
  );
}

function DateRow({ date, setDate }) {
  const today = todayIso();
  const tomorrow = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return isoLocal(d);
  })();
  const saturday = thisSaturdayIso();
  const chip = (label, value) => (
    <button
      type="button"
      className={`chip${date === value ? ' active' : ''}`}
      onClick={() => setDate(value)}
      aria-pressed={date === value}
    >
      {label}
    </button>
  );
  return (
    <div className="events-date-row">
      <div className="style-chips" role="group" aria-label="Plan date shortcuts">
        {chip('Today', today)}
        {chip('Tomorrow', tomorrow)}
        {chip('This Saturday', saturday)}
      </div>
      <input
        type="date"
        className="events-date-input"
        value={date}
        onChange={(e) => e.target.value && setDate(e.target.value)}
        aria-label="Plan date"
      />
    </div>
  );
}
