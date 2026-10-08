import React from 'react';
import { Link } from 'react-router-dom';

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-col">
          <h3>🍺 Brewery Compass</h3>
          <p className="muted">
            North Carolina craft breweries — what they pour, where they are, and how to
            spend a day among them.
          </p>
        </div>
        <div className="footer-col">
          <h4>Explore</h4>
          <nav className="footer-nav">
            <Link to="/">Home</Link>
            <Link to="/breweries">Breweries</Link>
            <Link to="/map">Map</Link>
            <Link to="/itinerary">Plan a Day</Link>
          </nav>
        </div>
        <div className="footer-col">
          <h4>Data</h4>
          <p className="muted">
            Brewery listings via Open Brewery DB. Nearby places via OpenStreetMap.
            Drive times via OSRM.
          </p>
        </div>
      </div>
      <p className="footer-copy">© {year} Philip Harmon. Drink responsibly.</p>
    </footer>
  );
}
