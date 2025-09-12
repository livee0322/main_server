// routes/brands-test.js
const express = require('express');
const router = express.Router();
const BrandPage = require('../models/BrandPage.test');

// 공통 응답 헬퍼(있으면 사용)
const ok = (res, data={}, status=200)=>res.status(status).json({ ok:true, data });
const fail = (res, msg='요청을 처리할 수 없습니다.', code='BAD_REQUEST', status=400)=>res.status(status).json({ ok:false, code, message:msg });

// 목록 (필요시)
router.get('/', async (req,res)=>{
  try{
    const docs = await BrandPage.find({}, { slug:1, name:1, updatedAt:1 }).sort({ updatedAt:-1 }).lean();
    ok(res, { items: docs });
  }catch(e){ fail(res, e.message || 'LIST_ERROR', 'LIST_ERROR', 500); }
});

// 단건 조회 (slug)
router.get('/:slug', async (req,res)=>{
  try{
    const slug = String(req.params.slug||'').toLowerCase();
    const doc = await BrandPage.findOne({ slug }).lean();
    if(!doc) return ok(res, null, 200); // 없으면 null (프론트에서 기본값 사용)
    ok(res, doc);
  }catch(e){ fail(res, e.message || 'GET_ERROR', 'GET_ERROR', 500); }
});

// 생성/업데이트 (upsert)
router.put('/:slug', async (req,res)=>{
  try{
    const slug = String(req.params.slug||'').toLowerCase();
    const body = req.body || {};
    if(!slug) return fail(res,'slug 필요','VALIDATION',422);

    body.slug = slug; // 강제 일치
    const doc = await BrandPage.findOneAndUpdate(
      { slug },
      { $set: body },
      { new:true, upsert:true, setDefaultsOnInsert:true }
    ).lean();
    ok(res, doc);
  }catch(e){ fail(res, e.message || 'UPSERT_ERROR', 'UPSERT_ERROR', 500); }
});

module.exports = router;