import React from 'react';
import { Link } from 'react-router-dom';

// Decorative hop-cone mark, drawn in code (no photos needed).
function HopMark({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 64 80" role="img" aria-label="A hop cone">
      <g fill="currentColor">
        <ellipse cx="32" cy="14" rx="7" ry="11" />
        <ellipse cx="19" cy="26" rx="8" ry="12" transform="rotate(-24 19 26)" />
        <ellipse cx="45" cy="26" rx="8" ry="12" transform="rotate(24 45 26)" />
        <ellipse cx="32" cy="32" rx="8" ry="13" />
        <ellipse cx="16" cy="44" rx="8" ry="12" transform="rotate(-24 16 44)" />
        <ellipse cx="48" cy="44" rx="8" ry="12" transform="rotate(24 48 44)" />
        <ellipse cx="32" cy="50" rx="8" ry="13" />
        <ellipse cx="24" cy="63" rx="7" ry="11" transform="rotate(-14 24 63)" />
        <ellipse cx="40" cy="63" rx="7" ry="11" transform="rotate(14 40 63)" />
        <ellipse cx="32" cy="70" rx="6" ry="9" />
      </g>
      <path d="M32 4 C 36 -2, 44 0, 46 2" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  );
}

const TIMELINE = [
  {
    era: '1750s',
    title: 'Moravian roots',
    text: 'North Carolina brewing starts early: Moravian settlers at Bethabara, near today’s Winston-Salem, were running one of the colony’s first commercial breweries and distilleries by the 1750s. Beer here is older than the state itself.',
  },
  {
    era: '1985–86',
    title: 'The law changes, the Radish opens',
    text: 'For decades after Prohibition, NC breweries couldn’t sell their own beer on site — which made brewpubs impossible. German immigrant Uli Bennewitz lobbied Raleigh to fix that, and a 1985 law change legalized brewpubs. On July 4, 1986, his Weeping Radish opened in Manteo: the state’s first brewpub since Prohibition, brewing strictly by the Reinheitsgebot, the 1516 German purity law — malt, hops, yeast, water, nothing else.',
  },
  {
    era: '1994',
    title: 'Asheville gets its first',
    text: 'Highland Brewing opened in a downtown Asheville basement in April 1994 — the first brewery founded in the city since Prohibition. Founder Oscar Wong built it into the cornerstone of western North Carolina beer culture.',
  },
  {
    era: '2005',
    title: 'Pop the Cap',
    text: 'Until 2005, North Carolina capped beer at 6% alcohol — a Prohibition leftover that made imperial stouts, barleywines, and most Belgian styles illegal to sell. A grassroots campaign of brewers and beer lovers called Pop the Cap pushed House Bill 392 through; signed on August 13, 2005, it raised the cap to 15% and quietly unlocked modern craft beer in NC.',
  },
  {
    era: '2009–12',
    title: 'Beer City, USA',
    text: 'Asheville — population under 100,000 — took on Portland, Oregon in Charlie Papazian’s national Beer City USA poll and tied it in 2009, won outright in 2010 and 2011, and tied Grand Rapids in 2012. The little mountain city became, officially-ish, the beer capital of America.',
  },
  {
    era: '2012–16',
    title: 'The big three come east',
    text: 'The industry noticed. Oskar Blues opened its East Coast brewery in Brevard in December 2012 — first batch on 12/12/12. Sierra Nevada, after scouting more than 200 sites, built its eastern home in Mills River (brewing by 2015). New Belgium followed in Asheville in 2016. Western North Carolina was suddenly a national brewing address.',
  },
  {
    era: 'Today',
    title: 'More than 400 breweries',
    text: 'The NC Craft Brewers Guild counts more than 410 breweries and brewpubs in North Carolina — the most of any state in the American South — from farm breweries in Currituck to taprooms in the far mountains. This site’s job is simply to help you find your next favorite one.',
  },
];

const FUN_FACTS = [
  {
    icon: '🧢',
    title: 'Illegal beer, until 2005',
    text: 'Before Pop the Cap, a bottle of Chimay or a Russian imperial stout was literally against the law to sell in North Carolina — the 6% ABV cap banned most of the world’s great beer styles.',
  },
  {
    icon: '🥨',
    title: 'Purity, by law of 1516',
    text: 'Weeping Radish — the state’s first modern brewpub — has brewed every batch under the Reinheitsgebot, the Bavarian purity law of 1516: only malt, hops, yeast, and water.',
  },
  {
    icon: '🏆',
    title: 'Four straight Beer City finishes',
    text: 'Asheville tied or won the Beer City USA poll four years running (2009–2012), beating cities many times its size — including Portland, Oregon, the craft beer capital of the West.',
  },
  {
    icon: '📅',
    title: 'A first batch with a sense of occasion',
    text: 'Oskar Blues brewed its first North Carolina batch in Brevard on December 12, 2012 — 12/12/12 — and opened the doors to the public with a New Year’s Eve party.',
  },
  {
    icon: '🗺️',
    title: '200 sites, one winner',
    text: 'Sierra Nevada considered more than 200 locations across the East before choosing Mills River, just outside Asheville, for its second brewery.',
  },
  {
    icon: '🍺',
    title: 'Most breweries in the South',
    text: 'North Carolina has more craft breweries than any other Southern state — 400-plus and counting, per the NC Craft Brewers Guild.',
  },
];

export default function About() {
  return (
    <div className="narrow page">
      <p className="hero-kicker about-kicker">About Brewery Compass</p>
      <h1>A short history of North Carolina beer</h1>
      <p className="about-lede">
        Brewery Compass exists for one reason: North Carolina quietly became one of the
        best beer states in America, and somebody ought to keep a good map of it. Here’s
        how it happened.
      </p>

      <div className="about-band" aria-hidden="true">
        <HopMark className="about-hop" />
        <div className="about-stats">
          <div className="about-stat">
            <strong>400+</strong>
            <span>breweries & brewpubs statewide</span>
          </div>
          <div className="about-stat">
            <strong>1986</strong>
            <span>first brewpub since Prohibition</span>
          </div>
          <div className="about-stat">
            <strong>15%</strong>
            <span>ABV cap since Pop the Cap (2005)</span>
          </div>
          <div className="about-stat">
            <strong>2010–11</strong>
            <span>Asheville, Beer City USA</span>
          </div>
        </div>
      </div>

      <ol className="timeline-list">
        {TIMELINE.map((t) => (
          <li key={t.era} className="timeline-item">
            <span className="timeline-era">{t.era}</span>
            <div>
              <h2>{t.title}</h2>
              <p>{t.text}</p>
            </div>
          </li>
        ))}
      </ol>

      <h2 className="about-section-title">Fun facts for your next taproom argument</h2>
      <div className="fact-grid">
        {FUN_FACTS.map((f) => (
          <article key={f.title} className="fact-card">
            <div className="feature-icon" aria-hidden="true">{f.icon}</div>
            <h3>{f.title}</h3>
            <p>{f.text}</p>
          </article>
        ))}
      </div>

      <div className="about-cta">
        <h2>Ready to explore?</h2>
        <p>
          Browse the breweries, plan a day among them — or if this history made you want
          to join the story, see how to get involved.
        </p>
        <div className="hero-actions">
          <Link to="/breweries" className="btn btn-primary btn-lg">Browse breweries</Link>
          <Link to="/get-involved" className="btn btn-ghost btn-lg">Get involved</Link>
        </div>
      </div>
    </div>
  );
}
