import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api, websiteUrl } from '../api.js';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

function letterOf(name) {
  const c = String(name || '').trim().charAt(0).toUpperCase();
  return /[A-Z]/.test(c) ? c : '#';
}

export default function Breweries() {
  const [breweries, setBreweries] = useState(null);
  const [styles, setStyles] = useState([]);
  const [styleIds, setStyleIds] = useState(null); // null = no style filter
  const [activeStyle, setActiveStyle] = useState('');
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(null);
  const [beersCache, setBeersCache] = useState({});
  const [beersLoading, setBeersLoading] = useState(false);
  const [error, setError] = useState('');
  const sectionRefs = useRef({});

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.breweries(), api.beerStyles()])
      .then(([list, styleList]) => {
        if (cancelled) return;
        setBreweries(list);
        setStyles(styleList);
      })
      .catch(() => !cancelled && setError('Could not load the brewery list. Try again in a bit.'));
    return () => {
      cancelled = true;
    };
  }, []);

  async function pickStyle(style) {
    if (style === activeStyle) {
      setActiveStyle('');
      setStyleIds(null);
      return;
    }
    setActiveStyle(style);
    try {
      const ids = await api.breweriesByStyle(style);
      setStyleIds(new Set(ids));
    } catch {
      setStyleIds(new Set());
    }
  }

  const filtered = useMemo(() => {
    if (!breweries) return [];
    const q = query.trim().toLowerCase();
    return breweries.filter((b) => {
      if (styleIds && !styleIds.has(b.brewery_id)) return false;
      if (q && !`${b.name} ${b.city}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [breweries, query, styleIds]);

  const grouped = useMemo(() => {
    const groups = {};
    for (const b of filtered) {
      const l = letterOf(b.name);
      (groups[l] = groups[l] || []).push(b);
    }
    return LETTERS.map((l) => [l, groups[l] || []]).filter(([, list]) => list.length > 0);
  }, [filtered]);

  const searching = query.trim() !== '' || activeStyle !== '';

  function scrollToLetter(l) {
    const el = sectionRefs.current[l];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function toggleExpand(brewery) {
    const id = brewery.brewery_id;
    if (expanded === id) {
      setExpanded(null);
      return;
    }
    setExpanded(id);
    if (beersCache[id] || !id) return;
    setBeersLoading(true);
    try {
      const beers = await api.beersFor(id);
      setBeersCache((prev) => ({ ...prev, [id]: beers }));
    } catch {
      setBeersCache((prev) => ({ ...prev, [id]: [] }));
    } finally {
      setBeersLoading(false);
    }
  }

  return (
    <div className="narrow page">
      <h1>Breweries A–Z</h1>
      <p className="muted">
        Every North Carolina brewery in one guide. Tap a brewery to see what it pours —
        styles, ABV, and IBUs.
      </p>

      <div className="brewery-controls">
        <input
          type="search"
          className="brewery-search"
          placeholder="Search breweries or cities…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search breweries"
        />
        <div className="style-chips" role="group" aria-label="Filter by beer style">
          {styles.map((s) => (
            <button
              key={s}
              type="button"
              className={`chip${activeStyle === s ? ' active' : ''}`}
              onClick={() => pickStyle(s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="alert alert-error">{error}</p>}
      {!breweries && !error && <p className="muted">Loading breweries…</p>}

      {breweries && !searching && (
        <div className="letter-bar" role="navigation" aria-label="Jump to letter">
          <select
            className="letter-select"
            aria-label="Jump to letter"
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) scrollToLetter(e.target.value);
              e.target.value = '';
            }}
          >
            <option value="">A–Z ▾</option>
            {grouped.map(([l]) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
          {LETTERS.map((l) => {
            const has = grouped.some(([gl]) => gl === l);
            return (
              <button
                key={l}
                type="button"
                className="letter-btn"
                disabled={!has}
                onClick={() => scrollToLetter(l)}
              >
                {l}
              </button>
            );
          })}
        </div>
      )}

      {breweries && filtered.length === 0 && (
        <p className="muted">No breweries match — try a different search or style.</p>
      )}

      {searching ? (
        <ul className="brewery-list">
          {filtered.map((b) => (
            <BreweryRow
              key={b.brewery_id || b.name}
              brewery={b}
              expanded={expanded === b.brewery_id}
              beers={beersCache[b.brewery_id]}
              beersLoading={beersLoading && expanded === b.brewery_id}
              onToggle={() => toggleExpand(b)}
            />
          ))}
        </ul>
      ) : (
        grouped.map(([l, list]) => (
          <section
            key={l}
            ref={(el) => {
              sectionRefs.current[l] = el;
            }}
            className="letter-section"
          >
            <h2 className="letter-heading">{l}</h2>
            <ul className="brewery-list">
              {list.map((b) => (
                <BreweryRow
                  key={b.brewery_id || b.name}
                  brewery={b}
                  expanded={expanded === b.brewery_id}
                  beers={beersCache[b.brewery_id]}
                  beersLoading={beersLoading && expanded === b.brewery_id}
                  onToggle={() => toggleExpand(b)}
                />
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

function BreweryRow({ brewery: b, expanded, beers, beersLoading, onToggle }) {
  const site = websiteUrl(b.website);
  return (
    <li className={`brewery-card${expanded ? ' expanded' : ''}`}>
      <button type="button" className="brewery-head" onClick={onToggle} aria-expanded={expanded}>
        <span className="brewery-name">{b.name}</span>
        <span className="brewery-meta">
          {[b.city, b.brewery_type].filter(Boolean).join(' · ')}
        </span>
        <span className="brewery-caret" aria-hidden="true">
          {expanded ? '▾' : '▸'}
        </span>
      </button>
      {expanded && (
        <div className="brewery-detail">
          <div className="brewery-actions">
            {site && (
              <a className="btn btn-ghost btn-sm" href={site} target="_blank" rel="noreferrer noopener">
                🌐 Website
              </a>
            )}
            {b.brewery_id && (
              <a className="btn btn-ghost btn-sm" href={`/map?brewery=${encodeURIComponent(b.brewery_id)}`}>
                🗺️ Show on map
              </a>
            )}
          </div>
          {beersLoading && <p className="muted">Loading the tap list…</p>}
          {beers && beers.length === 0 && !beersLoading && (
            <p className="muted">No tap list on file for this brewery yet.</p>
          )}
          {beers && beers.length > 0 && (
            <ul className="beer-list">
              {beers.map((beer, i) => (
                <li key={beer.beer_id || i} className="beer-row">
                  <div className="beer-main">
                    <strong>{beer.name}</strong>
                    <span className="beer-style">{beer.style}</span>
                  </div>
                  <div className="beer-stats">
                    {beer.abv != null && <span title="Alcohol by volume">{beer.abv.toFixed(1)}% ABV</span>}
                    {beer.ibu != null && <span title="International Bitterness Units">{Math.round(beer.ibu)} IBU</span>}
                    {beer.availability && beer.availability !== 'Year Round' && (
                      <span className="beer-avail">{beer.availability}</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}
