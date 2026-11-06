import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, websiteUrl } from '../api.js';
import RatingWidget, { StarsDisplay } from './RatingWidget.jsx';

// The brewery detail window: everything the dataset actually knows about a
// brewery (name, city, type, website, phone) — no hours, descriptions, or
// photos exist in the data, so the header is a designed banner rather than a
// fake photo. Below: the tap list with a star-rating widget per beer.
export default function BreweryModal({ brewery, onClose }) {
  const id = brewery?.brewery_id;
  const [detail, setDetail] = useState(brewery || null);
  const [beers, setBeers] = useState(null);
  const [beerSummaries, setBeerSummaries] = useState({});
  const [brewerySummary, setBrewerySummary] = useState(null);
  const [added, setAdded] = useState(false);

  // Close on Escape and lock body scroll while open.
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    api
      .breweryDetail(id)
      .then((d) => !cancelled && setDetail((prev) => ({ ...prev, ...d })))
      .catch(() => {});
    api
      .ratingItem('brewery', id)
      .then((s) => !cancelled && setBrewerySummary(s))
      .catch(() => !cancelled && setBrewerySummary({ average: null, count: 0 }));
    api
      .beersFor(id)
      .then(async (list) => {
        if (cancelled) return;
        setBeers(list);
        const ids = list.map((b) => b.beer_id).filter(Boolean);
        if (ids.length) {
          try {
            const sums = await api.ratingSummaries('beer', ids.slice(0, 300));
            if (!cancelled) setBeerSummaries(sums);
          } catch {
            /* summaries are a bonus; widgets fetch their own if missing */
          }
        }
      })
      .catch(() => !cancelled && setBeers([]));
    return () => {
      cancelled = true;
    };
  }, [id]);

  const b = detail || brewery || {};
  const site = websiteUrl(b.website);
  const digits = String(b.phone || '').replace(/\D/g, '');
  const address = useMemo(
    () => [b.street, b.city, b.state, b.postal_code].filter(Boolean).join(', '),
    [b.street, b.city, b.state, b.postal_code],
  );
  const initial = (b.name || '🍺').trim().charAt(0).toUpperCase();

  function addToDay() {
    try {
      const raw = JSON.parse(localStorage.getItem('brewDay') || '[]');
      if (raw.some((s) => s.brewery_id && s.brewery_id === id)) {
        setAdded(true);
        return;
      }
      raw.push({
        name: b.name,
        kind: 'brewery',
        brewery_id: id || null,
        address: address || null,
        phone: b.phone || null,
        website_url: b.website || null,
        lat: b.latitude ?? null,
        lng: b.longitude ?? null,
      });
      localStorage.setItem('brewDay', JSON.stringify(raw));
      setAdded(true);
    } catch {
      /* storage unavailable */
    }
  }

  if (!brewery) return null;

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-label={`${b.name} details`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-banner" aria-hidden="true">
          <span className="modal-mono">{initial}</span>
          <span className="modal-banner-icon">🍺</span>
        </div>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close details">
          ✕
        </button>

        <div className="modal-body">
          <h2 className="modal-name">{b.name}</h2>
          <p className="muted modal-meta">
            {[b.city, b.state, b.brewery_type].filter(Boolean).join(' · ')}
          </p>

          <div className="modal-rate-row">
            <StarsDisplay average={brewerySummary?.average} count={brewerySummary?.count || 0} />
          </div>
          <RatingWidget
            kind="brewery"
            itemId={id}
            breweryId={id}
            itemName={b.name}
            summary={brewerySummary || undefined}
            onRated={(s) => setBrewerySummary(s)}
          />

          <div className="brewery-actions modal-actions">
            {site && (
              <a className="btn btn-ghost btn-sm" href={site} target="_blank" rel="noreferrer noopener">
                🌐 Website
              </a>
            )}
            {digits && (
              <a className="btn btn-ghost btn-sm" href={`tel:${digits}`}>
                📞 {b.phone}
              </a>
            )}
            {id && (
              <Link className="btn btn-ghost btn-sm" to={`/map?brewery=${encodeURIComponent(id)}`} onClick={onClose}>
                🗺️ Show on map
              </Link>
            )}
            {id && b.latitude != null && (
              <button type="button" className="btn btn-primary btn-sm" onClick={addToDay} disabled={added}>
                {added ? '✓ In your day' : '🚗 Add to my day'}
              </button>
            )}
          </div>
          {address && <p className="muted small">📍 {address}</p>}

          <h3 className="modal-subtitle">On tap</h3>
          {beers === null && <p className="muted">Loading the tap list…</p>}
          {beers && beers.length === 0 && (
            <p className="muted">No tap list on file for this brewery yet.</p>
          )}
          {beers && beers.length > 0 && (
            <ul className="beer-list">
              {beers.map((beer, i) => (
                <li key={beer.beer_id || i} className="beer-row beer-row-rate">
                  <div className="beer-main">
                    <strong>{beer.name}</strong>
                    <span className="beer-style">{beer.style}</span>
                    <span className="beer-stats-inline">
                      {beer.abv != null && <span>{beer.abv.toFixed(1)}% ABV</span>}
                      {beer.ibu != null && <span>{Math.round(beer.ibu)} IBU</span>}
                      {beer.availability && beer.availability !== 'Year Round' && (
                        <span>{beer.availability}</span>
                      )}
                    </span>
                  </div>
                  <RatingWidget
                    kind="beer"
                    itemId={beer.beer_id}
                    breweryId={id}
                    itemName={beer.name}
                    summary={beer.beer_id ? beerSummaries[beer.beer_id] : undefined}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
