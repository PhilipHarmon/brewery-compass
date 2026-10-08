import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

export default function Home() {
  const [counts, setCounts] = useState({ breweries: null, cities: null });

  useEffect(() => {
    let cancelled = false;
    api
      .breweries()
      .then((list) => {
        if (cancelled) return;
        setCounts({
          breweries: list.length,
          cities: new Set(list.map((b) => b.city).filter(Boolean)).size,
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <section className="hero">
        <div className="hero-inner">
          <p className="hero-kicker">North Carolina craft beer</p>
          <h1>Find your next favorite pour.</h1>
          <p className="hero-sub">
            {counts.breweries != null ? (
              <>
                Browse <strong>{counts.breweries} breweries</strong> across{' '}
                <strong>{counts.cities} cities</strong> — see what each one pours, find
                them on the map, and plan a whole brewery day.
              </>
            ) : (
              'Browse every brewery, see what each one pours, find them on the map, and plan a whole brewery day.'
            )}
          </p>
          <div className="hero-actions">
            <Link to="/breweries" className="btn btn-primary btn-lg">
              Browse breweries
            </Link>
            <Link to="/map" className="btn btn-ghost btn-lg">
              Open the map
            </Link>
          </div>
        </div>
      </section>

      <section className="narrow section-grid">
        <Link to="/breweries" className="feature-card">
          <div className="feature-icon" aria-hidden="true">🍻</div>
          <h2>Breweries A–Z</h2>
          <p>
            Every NC brewery in one alphabetical guide. Search by name, filter by beer
            style, and see each brewery's lineup — styles, ABV, and IBUs.
          </p>
          <span className="feature-link">Start browsing →</span>
        </Link>
        <Link to="/map" className="feature-card">
          <div className="feature-icon" aria-hidden="true">🗺️</div>
          <h2>The map</h2>
          <p>
            Every brewery pinned across the state. Hover a pin for the quick facts —
            tap one to pop the full card and jump to its website.
          </p>
          <span className="feature-link">Explore the map →</span>
        </Link>
        <Link to="/itinerary" className="feature-card">
          <div className="feature-icon" aria-hidden="true">🚗</div>
          <h2>Plan a day</h2>
          <p>
            Pick a starting brewery, add nearby breweries, food, museums, and parks,
            and get drive times between every stop. Your day saves automatically.
          </p>
          <span className="feature-link">Plan your day →</span>
        </Link>
      </section>
    </div>
  );
}
