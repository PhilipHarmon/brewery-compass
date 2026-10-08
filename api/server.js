require('dotenv').config();

const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const { seedIfEmpty } = require('./lib/seed');
const breweryRoutes = require('./routes/breweries');

const app = express();
const PORT = process.env.PORT || 5000;

// CORS: restrict to CLIENT_URL origins (comma-separated) when set;
// allow all origins when unset (dev default).
const clientUrl = (process.env.CLIENT_URL || '').trim();
app.use(
  cors(
    clientUrl
      ? { origin: clientUrl.split(',').map((s) => s.trim()).filter(Boolean) }
      : undefined,
  ),
);
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api', breweryRoutes);

// 404 for unknown API routes.
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

// Centralized error handler.
app.use((err, _req, res, _next) => {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Internal server error' });
});

async function start() {
  await connectDB();
  await seedIfEmpty();
  app.listen(PORT, () => console.log(`brewery-api listening on port ${PORT}`));
}

start().catch((err) => {
  console.error('Failed to start server:', err.message);
  process.exit(1);
});

module.exports = app;
