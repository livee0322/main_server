// routes/shorts-test.js
const express = require('express');
const router = express.Router();
const Shorts = require('../models/Shorts-test');

/* 유틸 */
const toInt = (v, d) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : d;
};
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

/**
 * GET /api/v1/shorts-test
 * ?status=published&provider=youtube&tag=피트니스&q=검색어&sort=recent|popular|oldest
 * &limit=12&page=1   (또는 skip)
 */
router.get('/', async (req, res) => {
  try {
    const {
      status = 'published',
      provider,
      tag,
      q,
      sort = 'recent'
    } = req.query;

    const limit = clamp(toInt(req.query.limit, 12), 1, 50);
    const page  = Math.max(1, toInt(req.query.page, 1));
    const skip  = req.query.skip ? Math.max(0, toInt(req.query.skip, 0)) : (page - 1) * limit;

    const cond = {};
    if (status)   cond.status = status;
    if (provider) cond.provider = provider;
    if (tag)      cond.tags = { $in: String(tag).split(',') };
    if (q)        cond.$text = { $search: q };

    const sortMap = {
      recent:   { publishedAt: -1, createdAt: -1 },
      oldest:   { publishedAt:  1, createdAt:  1 },
      popular:  { 'metrics.views': -1, publishedAt: -1 }
    };

    const [items, total] = await Promise.all([
      Shorts.find(cond).sort(sortMap[sort] || sortMap.recent).skip(skip).limit(limit).lean({ virtuals: true }),
      Shorts.countDocuments(cond)
    ]);

    res.json({ ok: true, total, page, limit, items });
  } catch (err) {
    console.error('[shorts-test] list error:', err);
    res.status(500).json({ ok: false, message: err.message || 'LIST_ERROR' });
  }
});

/** GET /api/v1/shorts-test/:id */
router.get('/:id', async (req, res) => {
  try {
    const doc = await Shorts.findById(req.params.id).lean({ virtuals: true });
    if (!doc) return res.status(404).json({ ok: false, message: 'Not found' });
    res.json({ ok: true, item: doc });
  } catch (err) {
    res.status(400).json({ ok: false, message: 'INVALID_ID' });
  }
});

/** POST /api/v1/shorts-test  (테스트용: 인증 없이 허용) */
router.post('/', async (req, res) => {
  try {
    const payload = req.body || {};
    const doc = await Shorts.create(payload);
    res.status(201).json({ ok: true, item: doc.toJSON() });
  } catch (err) {
    res.status(400).json({ ok: false, message: err.message || 'CREATE_ERROR' });
  }
});

/** PATCH /api/v1/shorts-test/:id */
router.patch('/:id', async (req, res) => {
  try {
    const doc = await Shorts.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true, lean: true });
    if (!doc) return res.status(404).json({ ok: false, message: 'Not found' });
    res.json({ ok: true, item: doc });
  } catch (err) {
    res.status(400).json({ ok: false, message: err.message || 'UPDATE_ERROR' });
  }
});

/** DELETE /api/v1/shorts-test/:id */
router.delete('/:id', async (req, res) => {
  try {
    const doc = await Shorts.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ ok: false, message: 'Not found' });
    res.json({ ok: true, id: req.params.id });
  } catch (err) {
    res.status(400).json({ ok: false, message: 'INVALID_ID' });
  }
});

module.exports = router;