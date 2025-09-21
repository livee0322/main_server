// brand-test.js — v1.0.0 (Express Router)
const express = require('express');
const router = express.Router();
const Brand = require('./Brand-test'); // 경로는 실제 위치에 맞게 조정

// 유틸: id인지 slug인지 판별
const isObjectId = (s='') => /^[0-9a-fA-F]{24}$/.test(s);

// 목록(간단)
router.get('/', async (req,res) => {
  try{
    const { q='', status, limit=20, page=1 } = req.query;
    const filter = {};
    if(status) filter.status = status;
    if(q){
      filter.$text = { $search: q };
    }
    const lim = Math.min(Number(limit)||20, 100);
    const skip = (Math.max(Number(page)||1,1)-1)*lim;

    const [items, total] = await Promise.all([
      Brand.find(filter).sort({ createdAt:-1 }).skip(skip).limit(lim).lean(),
      Brand.countDocuments(filter)
    ]);
    res.json({ ok:true, data:{ items, total }});
  }catch(e){
    res.status(500).json({ ok:false, message:e.message||'Server Error' });
  }
});

// 단건 조회: /brands-test/:idOrSlug
router.get('/:idOrSlug', async (req,res) => {
  try{
    const { idOrSlug } = req.params;
    const doc = isObjectId(idOrSlug)
      ? await Brand.findById(idOrSlug).lean()
      : await Brand.findOne({ slug: idOrSlug.toLowerCase() }).lean();
    if(!doc) return res.status(404).json({ ok:false, message:'Not found' });
    res.json({ ok:true, data:doc });
  }catch(e){
    res.status(500).json({ ok:false, message:e.message||'Server Error' });
  }
});

// 생성 (인증 미들웨어가 있다면 추가)
router.post('/', async (req,res) => {
  try{
    const payload = req.body || {};
    if(!payload.slug || !payload.name) return res.status(400).json({ ok:false, message:'slug and name are required' });
    payload.slug = String(payload.slug).toLowerCase().trim();

    const dup = await Brand.findOne({ slug: payload.slug });
    if(dup) return res.status(409).json({ ok:false, message:'Slug already exists' });

    const doc = await Brand.create(payload);
    res.status(201).json({ ok:true, data:doc });
  }catch(e){
    res.status(500).json({ ok:false, message:e.message||'Server Error' });
  }
});

// 수정
router.put('/:id', async (req,res) => {
  try{
    const { id } = req.params;
    const payload = req.body || {};
    if(payload.slug) payload.slug = String(payload.slug).toLowerCase().trim();

    const doc = await Brand.findByIdAndUpdate(id, payload, { new:true, runValidators:true });
    if(!doc) return res.status(404).json({ ok:false, message:'Not found' });
    res.json({ ok:true, data:doc });
  }catch(e){
    res.status(500).json({ ok:false, message:e.message||'Server Error' });
  }
});

// 삭제(옵션)
router.delete('/:id', async (req,res) => {
  try{
    const { id } = req.params;
    const r = await Brand.findByIdAndDelete(id);
    if(!r) return res.status(404).json({ ok:false, message:'Not found' });
    res.json({ ok:true });
  }catch(e){
    res.status(500).json({ ok:false, message:e.message||'Server Error' });
  }
});

module.exports = router;