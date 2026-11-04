const express = require('express');
const mongoose = require('mongoose');
const Rating = require('../models/Rating');
const Beer = require('../models/Beer');
const Brewery = require('../models/Brewery');
const rateLimit = require('../lib/rateLimit');
const requireAdmin = require('../lib/adminAuth');

const router = express.Router();

const KINDS = ['beer', 'brewery'];

function validKind(kind) {
  return KINDS.includes(kind);
}

async function summarize(kind, itemId) {
  const [row] = await Rating.aggregate([
    { $match: { item_kind: kind, item_id: itemId } },
    { $group: { _id: null, average: { $avg: '$stars' }, count: { $sum: 1 } } },
  ]);
  if (!row) return { average: null, count: 0 };
  return { average: Math.round(row.average * 10) / 10, count: row.count };
}

// POST /api/ratings — a guest leaves (or changes) a 1–5 star rating.
// Body: { kind: 'beer'|'brewery', itemId, breweryId?, itemName?, stars, token }
// One rating per item per browser token: re-rating upserts.
router.post(
  '/ratings',
  rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 60,
    message: 'That is a lot of rating in one hour — take a breather and try again later.',
  }),
  async (req, res, next) => {
    try {
      const { kind, itemId, breweryId, itemName, stars, token } = req.body || {};
      if (!validKind(kind)) return res.status(400).json({ error: 'kind must be "beer" or "brewery".' });
      if (!itemId || typeof itemId !== 'string') return res.status(400).json({ error: 'itemId is required.' });
      const starNum = Number(stars);
      if (!Number.isInteger(starNum) || starNum < 1 || starNum > 5) {
        return res.status(400).json({ error: 'stars must be a whole number from 1 to 5.' });
      }
      if (!token || typeof token !== 'string' || token.length < 8 || token.length > 64) {
        return res.status(400).json({ error: 'A valid voter token is required.' });
      }

      // The item must really exist — no rating ghosts into the database.
      const exists =
        kind === 'beer'
          ? await Beer.exists({ beer_id: itemId })
          : await Brewery.exists({ brewery_id: itemId });
      if (!exists) return res.status(404).json({ error: 'That item does not exist.' });

      await Rating.findOneAndUpdate(
        { item_kind: kind, item_id: itemId, voter_token: token },
        {
          $set: {
            stars: starNum,
            brewery_id: typeof breweryId === 'string' ? breweryId.slice(0, 64) : undefined,
            item_name: typeof itemName === 'string' ? itemName.slice(0, 200) : undefined,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );

      const summary = await summarize(kind, itemId);
      res.status(201).json({ ...summary, yourRating: starNum });
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/ratings/item?kind=beer&id=<beer_id> — one item's average + count.
router.get('/ratings/item', async (req, res, next) => {
  try {
    const { kind, id } = req.query;
    if (!validKind(kind) || !id) {
      return res.status(400).json({ error: 'kind and id query params are required.' });
    }
    res.json(await summarize(kind, String(id)));
  } catch (err) {
    next(err);
  }
});

// GET /api/ratings/summaries?kind=brewery&ids=a,b,c — bulk averages for lists.
// Returns { <id>: { average, count } } including zero-count entries.
router.get('/ratings/summaries', async (req, res, next) => {
  try {
    const { kind } = req.query;
    if (!validKind(kind)) return res.status(400).json({ error: 'kind must be "beer" or "brewery".' });
    const ids = String(req.query.ids || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 300);
    const out = {};
    for (const id of ids) out[id] = { average: null, count: 0 };
    if (ids.length) {
      const rows = await Rating.aggregate([
        { $match: { item_kind: kind, item_id: { $in: ids } } },
        { $group: { _id: '$item_id', average: { $avg: '$stars' }, count: { $sum: 1 } } },
      ]);
      for (const row of rows) {
        out[row._id] = { average: Math.round(row.average * 10) / 10, count: row.count };
      }
    }
    res.json(out);
  } catch (err) {
    next(err);
  }
});

// --- Admin (x-admin-key header, ADMIN_KEY env) -------------------------------

// GET /api/admin/ratings?limit=100 — most recent ratings first.
router.get('/admin/ratings', requireAdmin, async (req, res, next) => {
  try {
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 100));
    const docs = await Rating.find({}).sort({ createdAt: -1 }).limit(limit).lean();
    res.json(
      docs.map((r) => ({
        id: r._id,
        kind: r.item_kind,
        itemId: r.item_id,
        itemName: r.item_name || null,
        breweryId: r.brewery_id || null,
        stars: r.stars,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
    );
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/ratings/summary — per-item totals, most-rated first.
router.get('/admin/ratings/summary', requireAdmin, async (req, res, next) => {
  try {
    const rows = await Rating.aggregate([
      {
        $group: {
          _id: { kind: '$item_kind', itemId: '$item_id' },
          itemName: { $first: '$item_name' },
          breweryId: { $first: '$brewery_id' },
          average: { $avg: '$stars' },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 50 },
    ]);
    res.json(
      rows.map((r) => ({
        kind: r._id.kind,
        itemId: r._id.itemId,
        itemName: r.itemName || null,
        breweryId: r.breweryId || null,
        average: Math.round(r.average * 10) / 10,
        count: r.count,
      })),
    );
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/ratings/:id — remove one rating (abuse cleanup).
router.delete('/admin/ratings/:id', requireAdmin, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid rating id.' });
    }
    const deleted = await Rating.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Rating not found.' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
