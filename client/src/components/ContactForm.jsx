import React, { useState } from 'react';
import { api } from '../api.js';

// The site-wide contact form (rendered in the footer of every page).
// Submissions are stored in the database and read in the admin area — no
// mail setup required. The `company` field is a honeypot: it's invisible
// to people, irresistible to bots, and a filled honeypot is quietly dropped
// by the server while appearing to succeed.
export default function ContactForm() {
  const [form, setForm] = useState({ name: '', email: '', message: '', company: '' });
  const [status, setStatus] = useState('idle'); // idle | sending | sent | error
  const [error, setError] = useState('');

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    if (status === 'sending') return;
    setStatus('sending');
    setError('');
    try {
      await api.contact(form);
      setStatus('sent');
      setForm({ name: '', email: '', message: '', company: '' });
    } catch (err) {
      setStatus('error');
      setError(err.message || 'Something went wrong — please try again.');
    }
  }

  if (status === 'sent') {
    return (
      <div className="contact-form">
        <h4>Contact</h4>
        <p className="contact-success" role="status">
          ✓ Thanks — your message is in! I read these personally and will get back to you at
          the email you gave.
        </p>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStatus('idle')}>
          Send another
        </button>
      </div>
    );
  }

  return (
    <form className="contact-form" onSubmit={submit}>
      <h4>Contact</h4>
      <label className="contact-label">
        Your name
        <input type="text" required maxLength={100} value={form.name} onChange={set('name')} autoComplete="name" />
      </label>
      <label className="contact-label">
        Email
        <input type="email" required maxLength={200} value={form.email} onChange={set('email')} autoComplete="email" />
      </label>
      <label className="contact-label">
        Message
        <textarea required maxLength={5000} rows={4} value={form.message} onChange={set('message')} />
      </label>
      {/* Honeypot — hidden from humans, filled by bots. Do not remove. */}
      <div className="hp-field" aria-hidden="true">
        <label>
          Company
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={form.company}
            onChange={set('company')}
          />
        </label>
      </div>
      {status === 'error' && (
        <p className="contact-error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="btn btn-primary btn-sm" disabled={status === 'sending'}>
        {status === 'sending' ? 'Sending…' : 'Send message'}
      </button>
    </form>
  );
}
