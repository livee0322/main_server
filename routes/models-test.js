const express = require('express');
const router = express.Router();
const Model = require('../src/models/ModelProfile');

// 리스트
router.get('/', async (req, res) => {
  try {
    const { page=1, limit=24, search='', tags='', gender, sort='recent', status='published' } = req.query;
    const q = {};
    if (status) q.status = status;
    if (gender) q.gender = gender;
    if (tags) q.tags = { $in: tags.split(',').map(s=>s.trim()).filter(Boolean) };
    if (search) q.$text = { $search: search };

    const sortMap = { recent: { createdAt: -1 }, rating: { 'rating.avg': -1 }, name: { name: 1 } };
    const docs = await Model.find(q)
      .sort(sortMap[sort] || sortMap.recent)
      .skip((page-1)*limit).limit(Number(limit));

    const total = await Model.countDocuments(q);
    res.ok({ items: docs, page: Number(page), limit: Number(limit), total });
  } catch (e) { res.fail('INTERNAL_ERROR', 500, { error: e.message }); }
});

// 상세 (id)
router.get('/:id', async (req,res)=>{
  try {
    const doc = await Model.findById(req.params.id);
    if (!doc) return res.fail('NOT_FOUND',404);
    res.ok({ data: doc });
  } catch(e){ res.fail('INTERNAL_ERROR',500,{ error:e.message }); }
});

// 상세 (slug)
router.get('/by-slug/:slug', async (req,res)=>{
  const doc = await Model.findOne({ slug: req.params.slug, status: 'published' });
  if (!doc) return res.fail('NOT_FOUND',404);
  res.ok({ data: doc });
});

// 생성/수정/삭제 (관리자용) — 인증 미들웨어 붙이기
router.post('/', async (req,res)=>{ const d = await Model.create(req.body); res.ok({ data:d }, 201); });
router.put('/:id', async (req,res)=>{ const d = await Model.findByIdAndUpdate(req.params.id, req.body, { new:true }); res.ok({ data:d }); });
router.delete('/:id', async (req,res)=>{ const d = await Model.findByIdAndUpdate(req.params.id, { status:'archived' }, { new:true }); res.ok({ data:d }); });

module.exports = router;