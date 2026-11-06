const crypto = require('crypto');

// Single-admin gate for the /api/admin/* routes. The key comes from the
// ADMIN_KEY environment variable (set in the Render dashboard — it is never
// in code or in the repo). The admin page sends it as the `x-admin-key`
// header. If ADMIN_KEY is not configured at all, the admin API pretends it
// doesn't exist (404), so there's nothing to probe on a stock deploy.
function requireAdmin(req, res, next) {
  const expected = process.env.ADMIN_KEY || '';
  if (!expected) return res.status(404).json({ error: 'Not found' });

  const given = req.get('x-admin-key') || '';
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({ error: 'Invalid admin key' });
  }
  return next();
}

module.exports = requireAdmin;
