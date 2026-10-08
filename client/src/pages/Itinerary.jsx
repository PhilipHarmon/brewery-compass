import React, { useCallback, useEffect, useState } from 'react';
import { api, websiteUrl } from '../api.js';

const STORAGE_KEY = 'brewDay';
const KIND_ICON = { brewery: '🍺', breweries: '🍺', restaurants: '🍽️', museums: '🏛️', parks: '🌳' };
const KIND_LABEL = { brewery: 'Brewery', breweries: 'Brewery', restaurants: 'Restaurant', museums: 'Museum', parks: 'Park' };
const KINDS = ['breweries', 'restaurants', 'museums', 'parks'];

function loadStops() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function toStop(raw, kind) {
  return {
    name: raw.name,
    kind: kind || 'brewery',
    address: raw.address || [raw.street, raw.city, raw.state].filter(Boolean).join(', ') || null,
    phone: raw.phone || null,
    website_url: raw.website_url || raw.website || null,
    lat: raw.latitude != null ? raw.latitude : raw.lat,
    lng: raw.longitude != null ? raw.longitude : raw.lng,
  };
}

export default function Itinerary() {
  const [stops, setStops] = useState(loadStops);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [nearbyKind, setNearbyKind] = useState('breweries');
  const [nearby, setNearby] = useState(null);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyWarning, setNearbyWarning] = useState('');
  const [legs, setLegs] = useState({});

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stops));
    } catch {
      /* storage unavailable */
    }
  }, [stops]);

  // Drive times between consecutive stops.
  useEffect(() => {
    let cancelled = false;
    setLegs({});
    stops.slice(0, -1).forEach((a, i) => {
      const b = stops[i + 1];
      if (a.lng == null || b.lng == null || a.lat == null || b.lat == null) {
        setLegs((prev) => ({ ...prev, [i]: '📍 address needed for drive time' }));
        return;
      }
      setLegs((prev) => ({ ...prev, [i]: '🚗 calculating…' }));
      api
        .route(a.lng, a.lat, b.lng, b.lat)
        .then((d) => {
          if (cancelled) return;
          setLegs((prev) => ({
            ...prev,
            [i]: d.duration_text
              ? `🚗 ${d.duration_text}${d.distance_text ? ` · ${d.distance_text}` : ''}`
              : '🚗 drive time unavailable',
          }));
        })
        .catch(() => {
          if (!cancelled) setLegs((prev) => ({ ...prev, [i]: '🚗 drive time unavailable' }));
        });
    });
    return () => {
      cancelled = true;
    };
  }, [stops]);

  const doSearch = useCallback(async () => {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setResults(null);
    try {
      // Local DB first — fast, reliable, and has map coordinates.
      const local = await api.searchBreweries(q);
      if (Array.isArray(local) && local.length > 0) {
        setResults(local);
        return;
      }
      // Fall back to the live Open Brewery DB lookup.
      const live = await api.liveSearch(q);
      setResults(Array.isArray(live) ? live : []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, [query]);

  async function loadNearby(kind) {
    setNearbyKind(kind);
    if (!stops.length) {
      setNearby(null);
      setNearbyWarning('Add a starting brewery first — nearby is measured from stop #1.');
      return;
    }
    const a = stops[0];
    if (a.lat == null || a.lng == null) {
      setNearby(null);
      setNearbyWarning('Your first stop has no map location.');
      return;
    }
    setNearbyLoading(true);
    setNearby(null);
    setNearbyWarning('');
    try {
      if (kind === 'breweries') {
        const data = await api.nearbyBreweries(a.lat, a.lng);
        setNearby(Array.isArray(data) ? data : []);
      } else {
        const data = await api.nearbyPlaces(a.lat, a.lng, kind);
        setNearbyWarning(data.warning || '');
        setNearby(data.places || []);
      }
    } catch {
      setNearby([]);
      setNearbyWarning('Lookup failed — try again in a bit.');
    } finally {
      setNearbyLoading(false);
    }
  }

  function addStop(raw, kind) {
    setStops((prev) => [...prev, toStop(raw, kind)]);
  }

  function move(i, dir) {
    setStops((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  function remove(i) {
    setStops((prev) => prev.filter((_, idx) => idx !== i));
  }

  function clearDay() {
    if (!stops.length || window.confirm('Clear your whole day?')) setStops([]);
  }

  return (
    <div className="narrow page">
      <h1>🍺 Plan a Brewery Day</h1>
      <p className="muted">Pick a starting brewery, find what's nearby, and build your day stop by stop.</p>

      <div className="itin-grid">
        <div>
          <section className="panel">
            <h2 className="panel-title">1 · Pick a starting brewery</h2>
            <div className="search-row">
              <input
                type="search"
                placeholder="e.g. Trophy Brewing"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && doSearch()}
                aria-label="Search breweries"
              />
              <button type="button" className="btn btn-primary" onClick={doSearch} disabled={searching}>
                {searching ? '…' : 'Search'}
              </button>
            </div>
            {results && results.length === 0 && <p className="muted">No NC breweries found for that name.</p>}
            {results && results.length > 0 && (
              <ul className="result-list">
                {results.map((b, i) => {
                  const canAdd = b.latitude != null && b.longitude != null;
                  return (
                    <li key={i} className="result-row">
                      <div>
                        <strong>{b.name}</strong>{' '}
                        <span className="kind-badge">🍺 {b.brewery_type || 'brewery'}</span>
                        <div className="muted small">
                          {[b.street, b.city].filter(Boolean).join(', ')}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={!canAdd}
                        onClick={() => addStop(b, 'brewery')}
                      >
                        {canAdd ? 'Add stop' : 'No map location'}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="panel">
            <h2 className="panel-title">2 · Find nearby</h2>
            <p className="muted small">Shows what's around your first stop.</p>
            <div className="kind-tabs" role="group" aria-label="Nearby categories">
              {KINDS.map((k) => (
                <button
                  key={k}
                  type="button"
                  className={`kind-tab${nearbyKind === k ? ' active' : ''}`}
                  onClick={() => loadNearby(k)}
                >
                  <span aria-hidden="true">{KIND_ICON[k]}</span>
                  <span>{KIND_LABEL[k]}s</span>
                </button>
              ))}
            </div>
            {nearbyWarning && <p className="muted">{nearbyWarning}</p>}
            {nearbyLoading && <p className="muted">Looking nearby…</p>}
            {nearby && nearby.length === 0 && !nearbyLoading && <p className="muted">Nothing found nearby.</p>}
            {nearby && nearby.length > 0 && (
              <ul className="result-list">
                {nearby.map((p, i) => {
                  const plat = p.lat != null ? p.lat : p.latitude;
                  const plng = p.lng != null ? p.lng : p.longitude;
                  const canAdd = plat != null && plng != null;
                  return (
                    <li key={i} className="result-row">
                      <div>
                        <strong>{p.name}</strong>{' '}
                        <span className="kind-badge">
                          {KIND_ICON[nearbyKind]} {KIND_LABEL[nearbyKind]}
                        </span>
                        <div className="muted small">
                          {p.address || [p.street, p.city].filter(Boolean).join(', ')}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={!canAdd}
                        onClick={() => addStop({ ...p, lat: plat, lng: plng }, nearbyKind)}
                      >
                        Add stop
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <div>
          <section className="panel">
            <div className="panel-head-row">
              <h2 className="panel-title">3 · Your day</h2>
              <button type="button" className="btn btn-ghost btn-sm" onClick={clearDay}>
                Clear day
              </button>
            </div>
            {stops.length === 0 && (
              <p className="muted">No stops yet — search for a brewery to get rolling.</p>
            )}
            <ol className="timeline">
              {stops.map((s, i) => (
                <li key={i}>
                  {i > 0 && <div className="route-leg">{legs[i - 1] || '🚗 calculating…'}</div>}
                  <StopCard stop={s} index={i} last={i === stops.length - 1} onMove={move} onRemove={remove} />
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}

function StopCard({ stop: s, index: i, last, onMove, onRemove }) {
  const site = websiteUrl(s.website_url);
  const digits = String(s.phone || '').replace(/\D/g, '');
  return (
    <div className="stop-card">
      <div className="stop-head">
        <span className="timeline-num">{i + 1}</span>
        <div>
          <strong>{s.name}</strong>{' '}
          <span className="kind-badge">
            {KIND_ICON[s.kind] || '📍'} {KIND_LABEL[s.kind] || s.kind}
          </span>
          {s.address && <div className="muted small">{s.address}</div>}
        </div>
      </div>
      <div className="stop-actions">
        {digits && (
          <a className="btn btn-ghost btn-sm" href={`tel:${digits}`}>
            📞 {s.phone}
          </a>
        )}
        {site && (
          <a className="btn btn-ghost btn-sm" href={site} target="_blank" rel="noreferrer noopener">
            🌐 Website
          </a>
        )}
        <span className="stop-reorder">
          {i > 0 && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => onMove(i, -1)} title="Move earlier">
              ↑
            </button>
          )}
          {!last && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => onMove(i, 1)} title="Move later">
              ↓
            </button>
          )}
          <button type="button" className="btn btn-danger-outline btn-sm" onClick={() => onRemove(i)}>
            Remove
          </button>
        </span>
      </div>
    </div>
  );
}
