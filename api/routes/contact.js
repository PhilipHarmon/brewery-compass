const express = require('express');
const mongoose = require('mongoose');
const ContactMessage = require('../models/ContactMessage');
const rateLimit = require('../lib/rateLimit');
const requireAdmin = require('../lib/adminAuth');
const { notifyContact } = require('../lib/mail');

const router = express.Router();

// POST /api/contact — the footer contact form (shown on every page).
// Always stores the message in the database; an optional notification email
// is attempted only when SMTP env vars are configured. The `company` field
// is a honeypot: real visitors never see it, bots fill it in — a filled
// honeypot gets a cheerful fake success and nothing stored.
router.post(
  '/contact',
  rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: 'You have sent several messages in the last hour — please wait a bit before sending another.',
  }),
  async (req, res, next) => {
    try {
      const { name, email, message, company } = req.body || {};
      if (typeof company === 'string' && company.trim() !== '') {
        return res.status(201).json({ ok: true }); // honeypot tripped
      }
      const cleanName = typeof name === 'string' ? name.trim() : '';
      const cleanEmail = typeof email === 'string' ? email.trim() : '';
      const cleanMessage = typeof message === 'string' ? message.trim() : '';
      if (!cleanName || cleanName.length > 100) {
        return res.status(400).json({ error: 'Please add your name (100 characters max).' });
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) || cleanEmail.length > 200) {
        return res.status(400).json({ error: 'Please add a valid email address.' });
      }
      if (!cleanMessage || cleanMessage.length > 5000) {
        return res.status(400).json({ error: 'Please write a message (5000 characters max).' });
      }

      const saved = await ContactMessage.create({
        name: cleanName,
        email: cleanEmail,
        message: cleanMessage,
      });

      // Optional email notification — never required, never fatal.
      notifyContact(saved).catch((err) => console.error('contact notify failed:', err.message));

      res.status(201).json({ ok: true });
    } catch (err) {
      next(err);
    }
  },
);

// --- Admin (x-admin-key header, ADMIN_KEY env) -------------------------------

// GET /api/admin/messages — newest first.
router.get('/admin/messages', requireAdmin, async (req, res, next) => {
  try {
    const docs = await ContactMessage.find({}).sort({ createdAt: -1 }).limit(200).lean();
    res.json(
      docs.map((m) => ({
        id: m._id,
        name: m.name,
        email: m.email,
        message: m.message,
        read: m.read,
        createdAt: m.createdAt,
      })),
    );
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/messages/:id/read — mark a message read.
router.patch('/admin/messages/:id/read', requireAdmin, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid message id.' });
    }
    const updated = await ContactMessage.findByIdAndUpdate(
      req.params.id,
      { $set: { read: true } },
      { new: true },
    );
    if (!updated) return res.status(404).json({ error: 'Message not found.' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/messages/:id
router.delete('/admin/messages/:id', requireAdmin, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid message id.' });
    }
    const deleted = await ContactMessage.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Message not found.' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
