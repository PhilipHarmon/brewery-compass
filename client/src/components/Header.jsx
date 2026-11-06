import React, { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';

// The wordmark mug, drawn in code like the About page's hop mark — amber
// beer, cream foam with a drip, glass handle and highlight. Decorative:
// the wrapping link carries the accessible name.
function BeerMugMark({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 72 80" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="bc-beer" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f0ad45" />
          <stop offset="0.55" stopColor="#dd8438" />
          <stop offset="1" stopColor="#b85c20" />
        </linearGradient>
        <linearGradient id="bc-foam" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fffaf0" />
          <stop offset="1" stopColor="#f5e3c2" />
        </linearGradient>
      </defs>
      {/* handle, behind the glass */}
      <path
        d="M46 30 C 62 28, 64 52, 45 52"
        fill="none"
        stroke="#f3d9ae"
        strokeWidth="6"
        strokeLinecap="round"
      />
      {/* glass body, slightly tapered */}
      <path
        d="M13 24 L15.5 66 a6 6 0 0 0 6 5.4 h19 a6 6 0 0 0 6 -5.4 L49 24 Z"
        fill="url(#bc-beer)"
        stroke="rgba(255, 248, 238, 0.9)"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* bubbles */}
      <g fill="#ffe9c4" opacity="0.55">
        <circle cx="24" cy="58" r="2.2" />
        <circle cx="33" cy="47" r="1.7" />
        <circle cx="27" cy="37" r="1.4" />
        <circle cx="39" cy="61" r="1.5" />
        <circle cx="41" cy="42" r="1.2" />
      </g>
      {/* glass highlight */}
      <rect x="19" y="31" width="5" height="32" rx="2.5" fill="#ffffff" opacity="0.28" />
      {/* foam: a bank of bumps over the rim, one drip down the front */}
      <g fill="url(#bc-foam)">
        <ellipse cx="31" cy="22" rx="20" ry="7.5" />
        <circle cx="18" cy="18" r="6.5" />
        <circle cx="28" cy="13" r="8" />
        <circle cx="39" cy="14.5" r="6.5" />
        <circle cx="47" cy="19" r="5" />
        <path d="M21 24 q -1.5 9, 0.5 13.5 q 1.6 3.4, 3.2 0 q 2 -4.5, 1 -13.5 Z" />
      </g>
    </svg>
  );
}

export default function Header() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <header className="site-header">
      <div className="header-inner">
        <Link to="/" className="site-title" onClick={close} aria-label="Brewery Compass — home">
          <BeerMugMark className="site-mug" />
          <span className="site-words">
            <span>Brewery</span>
            <span>Compass</span>
          </span>
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
          <NavLink to="/about">NC Beer History</NavLink>
          <NavLink to="/get-involved">Get Involved</NavLink>
        </nav>
      </div>
    </header>
  );
}
