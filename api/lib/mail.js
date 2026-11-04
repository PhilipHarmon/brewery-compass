// Optional contact-form notification email. The contact form ALWAYS stores
// messages in the database (that's the reliable path, and the admin area is
// where they're read). Only when full SMTP settings are present in the
// environment do we also try to send a notification email — and a mail
// failure never fails the submission.
async function notifyContact(msg) {
  const { SMTP_HOST, SMTP_USER, SMTP_PASS, CONTACT_NOTIFY_TO } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !CONTACT_NOTIFY_TO) return false;

  // Required lazily so a deploy without mail config never loads it.
  const nodemailer = require('nodemailer');
  const port = Number(process.env.SMTP_PORT) || 587;
  const transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  await transport.sendMail({
    from: process.env.SMTP_FROM || SMTP_USER,
    to: CONTACT_NOTIFY_TO,
    replyTo: msg.email,
    subject: `Brewery Compass contact form: ${msg.name}`,
    text: `New message from the Brewery Compass contact form.\n\nFrom: ${msg.name} <${msg.email}>\n\n${msg.message}\n`,
  });
  return true;
}

module.exports = { notifyContact };
