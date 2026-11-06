// Tiny in-memory fixed-window rate limiter (per IP). Good enough for the
// abuse levels a guest ratings / contact form endpoint will ever see, and it
// needs no extra infrastructure. State is per-process, which is fine: the
// API runs as a single Render instance.
function rateLimit({ windowMs, max, message }) {
  const hits = new Map(); // ip -> { count, resetAt }

  // Sweep expired buckets occasionally so the map can't grow forever.
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [ip, bucket] of hits) {
      if (bucket.resetAt <= now) hits.delete(ip);
    }
  }, Math.max(windowMs, 60 * 1000));
  if (sweep.unref) sweep.unref();

  return function limiter(req, res, next) {
    const now = Date.now();
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    let bucket = hits.get(ip);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      hits.set(ip, bucket);
    }
    bucket.count += 1;
    if (bucket.count > max) {
      return res
        .status(429)
        .json({ error: message || 'Too many requests — please slow down and try again shortly.' });
    }
    return next();
  };
}

module.exports = rateLimit;
