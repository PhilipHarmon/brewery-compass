import React, { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';

export default function Header() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <header className="site-header">
      <div className="header-inner">
        <Link to="/" className="site-title" onClick={close}>
          🍺 Brewery Compass
        </Link>
        <button
          type="button"
          className="nav-toggle"
          aria-expanded={open}
          aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}
          onClick={() => setOpen((o) => !o)}
        >
          <span aria-hidden="true">{open ? '✕' : '☰'}</span>
        </button>
        <nav className={`site-nav${open ? ' open' : ''}`} aria-label="Site" onClick={close}>
          <NavLink to="/" end>Home</NavLink>
          <NavLink to="/breweries">Breweries</NavLink>
          <NavLink to="/map">Map</NavLink>
          <NavLink to="/itinerary">Plan a Day</NavLink>
        </nav>
      </div>
    </header>
  );
}
