const mongoose = require('mongoose');

// One message from the site-wide footer contact form. Stored in the database
// so it works with zero mail configuration; Philip reads them in the admin
// area. (If SMTP env vars are set, a notification email is also sent — see
// lib/mail.js — but storage is always the source of truth.)
const contactMessageSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, maxlength: 100 },
    email: { type: String, required: true, maxlength: 200 },
    message: { type: String, required: true, maxlength: 5000 },
    read: { type: Boolean, default: false },
  },
  { timestamps: true },
);

module.exports = mongoose.model('ContactMessage', contactMessageSchema);
