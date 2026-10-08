import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, websiteUrl } from '../api.js';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

const ABV_FILTERS = [
  { label: 'Session · under 5%', min: 0, max: 5 },
  { label: 'Classic · 5–7%', min: 5, max: 7 },
  { label: 'Strong · 7%+', min: 7, max: null },
];
const IBU_FILTERS = [
  { label: 'Mellow · under 30', min: 0, max: 30 },
  { label: 'Balanced · 30–60', min: 30, max: 60 },
  { label: 'Bitter · 60+', min: 60, max: null },
];
const AVAIL_FILTERS = [
  { label: 'Year-round pours', value: 'Year Round' },
  { label: 'Limited releases', value: 'Limited' },
];

function letterOf(name) {
  const c = String(name || '').trim().charAt(0).toUpperCase();
  return /[A-Z]/.test(c) ? c : '#';
}

export default function Breweries() {
  const [breweries, setBreweries] = useState(null);
  const [styles, setStyles] = useState([]);
  const [filterIds, setFilterIds] = useState(null); // null = no chip filter
  const [activeFilter, setActiveFilter] = useState(''); // "kind:label"
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(null);
  const [beersCache, setBeersCache] = useState({});
  const [beersLoading, setBeersLoading] = useState(false);
  const [error, setError] = useState('');
  const sectionRefs = useRef({});
  const resultsRef = useRef(null);
  const [params] = useSearchParams();
  const focusId = params.get('brewery');
  const focusedOnce = useRef(false);

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

  async function pickFilter(kind, chip) {
    const key = `${kind}:${chip.label}`;
    if (key === activeFilter) {
      setActiveFilter('');
      setFilterIds(null);
      return;
    }
    setActiveFilter(key);
    try {
      let ids;
      if (kind === 'style') ids = await api.breweriesByStyle(chip.label);
      else if (kind === 'abv') ids = await api.breweriesByAbv(chip.min, chip.max);
      else if (kind === 'ibu') ids = await api.breweriesByIbu(chip.min, chip.max);
      else ids = await api.breweriesByAvailability(chip.value);
      setFilterIds(new Set(ids));
    } catch {
      setFilterIds(new Set());
    }
  }

  function chipClass(kind, chip) {
    return `chip${activeFilter === `${kind}:${chip.label}` ? ' active' : ''}`;
  }

  const filtered = useMemo(() => {
    if (!breweries) return [];
    const q = query.trim().toLowerCase();
    return breweries.filter((b) => {
      if (filterIds && !filterIds.has(b.brewery_id)) return false;
      if (q && !`${b.name} ${b.city}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [breweries, query, filterIds]);

  const grouped = useMemo(() => {
    const groups = {};
    for (const b of filtered) {
      const l = letterOf(b.name);
      (groups[l] = groups[l] || []).push(b);
    }
    return LETTERS.map((l) => [l, groups[l] || []]).filter(([, list]) => list.length > 0);
  }, [filtered]);

  const searching = query.trim() !== '' || activeFilter !== '';

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

  // Deep link from the map: ?brewery=<brewery_id> opens that brewery's tap list.
  useEffect(() => {
    if (!breweries || !focusId || focusedOnce.current) return;
    const match = breweries.find((b) => b.brewery_id === focusId);
    if (!match) return;
    focusedOnce.current = true;
    toggleExpand(match);
    setTimeout(() => {
      const el = document.querySelector(`[data-brewery-id="${CSS.escape(focusId)}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 350);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [breweries, focusId]);

  return (
    <div className="narrow page">
      <h1>Breweries A–Z</h1>
      <p className="muted">
        Every North Carolina brewery in one guide. Tap a brewery to see what it pours —
        styles, ABV, and IBUs.
      </p>

      <div className="brewery-controls">
        <form
          className="brewery-search-form"
          onSubmit={(e) => {
            e.preventDefault();
            const el = resultsRef.current;
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}
        >
          <input
            type="search"
            className="brewery-search"
            placeholder="Search breweries or cities…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search breweries"
          />
        </form>
        <div className="filter-groups">
          <div className="filter-group">
            <h3 className="filter-group-title">🍺 Styles</h3>
            <div className="style-chips" role="group" aria-label="Filter by beer style">
              {styles.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={chipClass('style', { label: s })}
                  onClick={() => pickFilter('style', { label: s })}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="filter-group">
            <h3 className="filter-group-title">💪 Strength · ABV</h3>
            <div className="style-chips" role="group" aria-label="Filter by ABV">
              {ABV_FILTERS.map((f) => (
                <button
                  key={f.label}
                  type="button"
                  className={chipClass('abv', f)}
                  onClick={() => pickFilter('abv', f)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <div className="filter-group">
            <h3 className="filter-group-title">🌿 Bitterness · IBU</h3>
            <div className="style-chips" role="group" aria-label="Filter by IBU">
              {IBU_FILTERS.map((f) => (
                <button
                  key={f.label}
                  type="button"
                  className={chipClass('ibu', f)}
                  onClick={() => pickFilter('ibu', f)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <div className="filter-group">
            <h3 className="filter-group-title">📅 Availability</h3>
            <div className="style-chips" role="group" aria-label="Filter by availability">
              {AVAIL_FILTERS.map((f) => (
                <button
                  key={f.label}
                  type="button"
                  className={chipClass('avail', f)}
                  onClick={() => pickFilter('avail', f)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
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

      <div ref={resultsRef} className="results-anchor">
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
    </div>
  );
}

function BreweryRow({ brewery: b, expanded, beers, beersLoading, onToggle }) {
  const site = websiteUrl(b.website);
  return (
    <li
      className={`brewery-card${expanded ? ' expanded' : ''}`}
      data-brewery-id={b.brewery_id || undefined}
    >
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
