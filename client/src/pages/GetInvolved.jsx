import React from 'react';
import { INVOLVED_SECTIONS } from '../data/getInvolved.js';

export default function GetInvolved() {
  return (
    <div className="narrow page">
      <p className="hero-kicker about-kicker">Get involved</p>
      <h1>Join the beer world</h1>
      <p className="about-lede">
        Drinking great beer is the beginning, not the end. Whether you want to brew your
        own, learn to judge like a pro, or just find the people who plan their vacations
        around taprooms — here’s where to start.
      </p>

      {INVOLVED_SECTIONS.map((section) => (
        <section key={section.title} className="involved-section">
          <h2>
            <span aria-hidden="true">{section.icon}</span> {section.title}
          </h2>
          <p className="muted">{section.intro}</p>
          <div className="involved-grid">
            {section.links.map((link) => (
              <article key={link.name} className="involved-card">
                <h3>{link.name}</h3>
                <p>{link.blurb}</p>
                <a
                  className="feature-link"
                  href={link.url}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  Visit →
                </a>
              </article>
            ))}
          </div>
        </section>
      ))}

      <p className="muted small">
        Know a North Carolina club or organization that belongs here? Send it through the
        contact form in the footer — every link on this page is checked before it goes up.
      </p>
    </div>
  );
}
