import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';

const KEY_STORAGE = 'brewAdminKey';

// Admin area: contact-form inbox + star-rating management. Access is a single
// key (ADMIN_KEY on the server) entered here and kept in sessionStorage —
// it never ships in the site code. Without the right key the API says no.
export default function Admin() {
  const [adminKey, setAdminKey] = useState(() => {
    try {
      return sessionStorage.getItem(KEY_STORAGE) || '';
    } catch {
      return '';
    }
  });
  const [keyInput, setKeyInput] = useState('');
  const [tab, setTab] = useState('messages');
  const [status, setStatus] = useState('idle'); // idle | loading | ready | error
  const [error, setError] = useState('');
  const [messages, setMessages] = useState([]);
  const [ratings, setRatings] = useState([]);
  const [ratingSummary, setRatingSummary] = useState([]);

  const load = useCallback(
    async (key) => {
      if (!key) return;
      setStatus('loading');
      setError('');
      try {
        const [msgs, rats, sums] = await Promise.all([
          api.admin.messages(key),
          api.admin.ratings(key),
          api.admin.ratingsSummary(key),
        ]);
        setMessages(msgs);
        setRatings(rats);
        setRatingSummary(sums);
        setStatus('ready');
      } catch (err) {
        setStatus('error');
        setError(
          err.status === 401
            ? 'That key didn’t work. Check it and try again.'
            : err.status === 404
              ? 'The admin API isn’t enabled on this server (ADMIN_KEY is not set).'
              : 'Could not load the admin data — try again in a bit.',
        );
      }
    },
    [],
  );

  useEffect(() => {
    if (adminKey) load(adminKey);
  }, [adminKey, load]);

  function signIn(e) {
    e.preventDefault();
    const key = keyInput.trim();
    if (!key) return;
    try {
      sessionStorage.setItem(KEY_STORAGE, key);
    } catch {
      /* ignore */
    }
    setAdminKey(key);
    setKeyInput('');
  }

  function signOut() {
    try {
      sessionStorage.removeItem(KEY_STORAGE);
    } catch {
      /* ignore */
    }
    setAdminKey('');
    setStatus('idle');
    setMessages([]);
    setRatings([]);
    setRatingSummary([]);
  }

  async function markRead(id) {
    try {
      await api.admin.markMessageRead(adminKey, id);
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, read: true } : m)));
    } catch {
      /* leave state as-is */
    }
  }

  async function deleteMessage(id) {
    if (!window.confirm('Delete this message for good?')) return;
    try {
      await api.admin.deleteMessage(adminKey, id);
      setMessages((prev) => prev.filter((m) => m.id !== id));
    } catch {
      /* leave state as-is */
    }
  }

  async function deleteRating(id) {
    if (!window.confirm('Delete this rating? The item’s average will be recalculated.')) return;
    try {
      await api.admin.deleteRating(adminKey, id);
      setRatings((prev) => prev.filter((r) => r.id !== id));
      // Refresh per-item totals so the summary table stays honest.
      const sums = await api.admin.ratingsSummary(adminKey);
      setRatingSummary(sums);
    } catch {
      /* leave state as-is */
    }
  }

  if (!adminKey) {
    return (
      <div className="narrow page">
        <h1>Admin</h1>
        <p className="muted">
          This is where contact-form messages and star ratings are managed. Enter the admin
          key to continue.
        </p>
        <form className="admin-key-form" onSubmit={signIn}>
          <input
            type="password"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="Admin key"
            aria-label="Admin key"
            autoComplete="current-password"
          />
          <button type="submit" className="btn btn-primary">
            Sign in
          </button>
        </form>
        {status === 'error' && <p className="alert alert-error">{error}</p>}
      </div>
    );
  }

  const unread = messages.filter((m) => !m.read).length;

  return (
    <div className="narrow page">
      <div className="panel-head-row">
        <h1>Admin</h1>
        <button type="button" className="btn btn-ghost btn-sm" onClick={signOut}>
          Sign out
        </button>
      </div>

      <div className="kind-tabs admin-tabs" role="group" aria-label="Admin sections">
        <button
          type="button"
          className={`kind-tab${tab === 'messages' ? ' active' : ''}`}
          onClick={() => setTab('messages')}
        >
          <span aria-hidden="true">✉️</span>
          <span>Messages{unread ? ` (${unread} new)` : ''}</span>
        </button>
        <button
          type="button"
          className={`kind-tab${tab === 'ratings' ? ' active' : ''}`}
          onClick={() => setTab('ratings')}
        >
          <span aria-hidden="true">⭐</span>
          <span>Ratings</span>
        </button>
      </div>

      {status === 'loading' && <p className="muted">Loading…</p>}
      {status === 'error' && <p className="alert alert-error">{error}</p>}

      {status === 'ready' && tab === 'messages' && (
        <section>
          {messages.length === 0 && <p className="muted">No messages yet. The inbox is quiet.</p>}
          <ul className="admin-list">
            {messages.map((m) => (
              <li key={m.id} className={`admin-card${m.read ? '' : ' unread'}`}>
                <div className="admin-card-head">
                  <strong>{m.name}</strong>
                  <a href={`mailto:${m.email}`}>{m.email}</a>
                  <span className="muted small">
                    {new Date(m.createdAt).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </span>
                  {!m.read && <span className="kind-badge">New</span>}
                </div>
                <p className="admin-message">{m.message}</p>
                <div className="brewery-actions">
                  {!m.read && (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => markRead(m.id)}>
                      Mark read
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-danger-outline btn-sm"
                    onClick={() => deleteMessage(m.id)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {status === 'ready' && tab === 'ratings' && (
        <section>
          <h2 className="panel-title">Most-rated items</h2>
          {ratingSummary.length === 0 && <p className="muted">No ratings yet.</p>}
          {ratingSummary.length > 0 && (
            <ul className="admin-list">
              {ratingSummary.map((s) => (
                <li key={`${s.kind}-${s.itemId}`} className="admin-card">
                  <div className="admin-card-head">
                    <strong>{s.itemName || s.itemId}</strong>
                    <span className="kind-badge">{s.kind === 'beer' ? '🍺 Beer' : '🏭 Brewery'}</span>
                    <span>
                      {'★'.repeat(Math.round(s.average))}
                      {'☆'.repeat(5 - Math.round(s.average))} {s.average.toFixed(1)} · {s.count}{' '}
                      {s.count === 1 ? 'rating' : 'ratings'}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <h2 className="panel-title" style={{ marginTop: '1.5rem' }}>
            Recent ratings
          </h2>
          {ratings.length === 0 && <p className="muted">Nothing here yet.</p>}
          <ul className="admin-list">
            {ratings.map((r) => (
              <li key={r.id} className="admin-card">
                <div className="admin-card-head">
                  <strong>{r.itemName || r.itemId}</strong>
                  <span className="kind-badge">{r.kind === 'beer' ? '🍺 Beer' : '🏭 Brewery'}</span>
                  <span aria-label={`${r.stars} stars`}>
                    {'★'.repeat(r.stars)}
                    {'☆'.repeat(5 - r.stars)}
                  </span>
                  <span className="muted small">
                    {new Date(r.createdAt).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </span>
                  <button
                    type="button"
                    className="btn btn-danger-outline btn-sm"
                    onClick={() => deleteRating(r.id)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
