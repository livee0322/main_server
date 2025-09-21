// brand-test.js
const express = require('express');
const router = express.Router();
const Brand = require('./Brand-test'); // 경로 확인

// GET /brands/:slug  (공개페이지에서 사용)
router.get('/brands/:slug', async (req, res) => {
  try {
    const doc = await Brand.findOne({ slug: req.params.slug }).lean();
    if (!doc) return res.status(404).json({ ok: false, message: 'not_found' });
    res.json(doc);
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

// PUT /brands/:slug  (관리자 저장)
router.put('/brands/:slug', async (req, res) => {
  try {
    const payload = req.body || {};
    const doc = await Brand.findOneAndUpdate(
      { slug: req.params.slug },
      { $set: payload },
      { upsert: true, new: true }
    ).lean();
    res.json({ ok: true, data: doc });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

// (선택) POST 생성
router.post('/brands', async (req, res) => {
  try {
    const created = await Brand.create(req.body || {});
    res.json({ ok: true, data: created });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

module.exports = router;
