import React, { useEffect, useState } from 'react';
import { api, myRatings, rememberMyRating } from '../api.js';

// Static average display: ★★★★☆ 4.3 (12 ratings) / "No ratings yet".
export function StarsDisplay({ average, count, className = '' }) {
  if (!count) {
    return <span className={`stars-display empty ${className}`}>☆☆☆☆☆ No ratings yet</span>;
  }
  const filled = Math.round(average);
  return (
    <span className={`stars-display ${className}`} title={`${average} out of 5 from ${count} ratings`}>
      <span aria-hidden="true" className="stars-glyphs">
        {'★'.repeat(filled)}
        {'☆'.repeat(5 - filled)}
      </span>{' '}
      {average.toFixed(1)} ({count} {count === 1 ? 'rating' : 'ratings'})
    </span>
  );
}

// Interactive widget: shows the average and lets a guest tap to rate.
// `summary` may be passed in by a parent that batch-loaded summaries;
// otherwise the widget fetches its own. Ratings are stars-only (no text),
// one per item per browser, and re-tapping updates the same rating.
export default function RatingWidget({
  kind,
  itemId,
  breweryId,
  itemName,
  summary: summaryProp,
  onRated,
}) {
  const [summary, setSummary] = useState(summaryProp || null);
  const [mine, setMine] = useState(() => myRatings()[`${kind}:${itemId}`] || 0);
  const [hover, setHover] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (summaryProp) setSummary(summaryProp);
  }, [summaryProp]);

  useEffect(() => {
    if (summaryProp || !itemId) return;
    let cancelled = false;
    api
      .ratingItem(kind, itemId)
      .then((s) => !cancelled && setSummary(s))
      .catch(() => !cancelled && setSummary({ average: null, count: 0 }));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, itemId]);

  async function rate(stars) {
    if (busy || !itemId) return;
    setBusy(true);
    setError('');
    try {
      const result = await api.rate({ kind, itemId, breweryId, itemName, stars });
      setSummary({ average: result.average, count: result.count });
      setMine(stars);
      rememberMyRating(kind, itemId, stars);
      if (onRated) onRated({ average: result.average, count: result.count });
    } catch {
      setError('Rating didn’t go through — try again.');
    } finally {
      setBusy(false);
    }
  }

  const shown = hover || mine || (summary ? Math.round(summary.average || 0) : 0);

  return (
    <div className="rating-widget">
      <div
        className="rating-stars"
        role="radiogroup"
        aria-label={`Rate this ${kind === 'beer' ? 'beer' : 'brewery'}`}
        onMouseLeave={() => setHover(0)}
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={mine === n}
            aria-label={`${n} star${n > 1 ? 's' : ''}`}
            className={`star-btn${n <= shown ? ' lit' : ''}${mine === n ? ' mine' : ''}`}
            disabled={busy}
            onMouseEnter={() => setHover(n)}
            onFocus={() => setHover(n)}
            onClick={() => rate(n)}
          >
            ★
          </button>
        ))}
      </div>
      <span className="rating-caption">
        {summary == null
          ? 'Loading ratings…'
          : summary.count === 0
            ? mine
              ? 'Thanks for rating!'
              : 'No ratings yet — be the first'
            : `${summary.average.toFixed(1)} avg · ${summary.count} ${
                summary.count === 1 ? 'rating' : 'ratings'
              }${mine ? ' · yours included' : ''}`}
      </span>
      {error && <span className="rating-error">{error}</span>}
    </div>
  );
}
