// routes/portfolio-test.js
const router = require('express').Router();
const { body, query, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const sanitizeHtml = require('sanitize-html');

const Portfolio = require('../models/Portfolio');
const auth = require('../src/middleware/auth');
const requireRole = require('../src/middleware/requireRole');

// 공통 sanitize
const sanitize = (html='') => sanitizeHtml(html, {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img','h1','h2','u','span','figure','figcaption']),
  allowedAttributes: { '*': ['style','class','id','src','href','alt','title'] },
  allowedSchemes: ['http','https','data','mailto','tel'],
});

function pubChecks(payload){
  const errors = [];
  if(!payload.nickname) errors.push({ field:'nickname', msg:'닉네임은 필수입니다.' });
  if(!payload.headline) errors.push({ field:'headline', msg:'한 줄 소개는 필수입니다.' });
  if(!payload.mainThumbnailUrl) errors.push({ field:'mainThumbnailUrl', msg:'메인 썸네일을 업로드해주세요.' });
  return errors;
}

function normalizePayload(p){
  const clean = { ...p };
  if (clean.bio) clean.bio = sanitize(clean.bio);
  if (Array.isArray(clean.tags)) {
    // 최대 8개, 중복 제거, 공백 제거
    const uniq = [...new Set(clean.tags.map(t=>String(t).trim()).filter(Boolean))];
    clean.tags = uniq.slice(0,8);
  }
  if (Array.isArray(clean.subThumbnails)) {
    clean.subThumbnails = clean.subThumbnails.filter(Boolean).slice(0,5);
  }
  if (Array.isArray(clean.liveLinks)) {
    clean.liveLinks = clean.liveLinks
      .map(l=>({ title:l.title?.trim(), url:l.url?.trim(), date:l.date ? new Date(l.date) : undefined }))
      .filter(l => l.title || l.url);
  }
  // 숫자 캐스팅
  if (clean.careerYears!==undefined) clean.careerYears = Number(clean.careerYears);
  if (clean.age!==undefined) clean.age = Number(clean.age);
  return clean;
}

/* Create */
router.post(
  '/',
  auth,
  requireRole('showhost', 'admin'),
  // 최소 필드 형식 검증
  body('nickname').isString().trim().notEmpty(),
  body('headline').isString().trim().notEmpty(),
  body('status').optional().isIn(['draft','published']),
  async (req, res) => {
    const v = validationResult(req);
    if (!v.isEmpty()) {
      return res.status(422).json({ ok:false, message:'VALIDATION_FAILED', details: v.array() });
    }
    try{
      const payload = normalizePayload({
        ...req.body,
        type:'portfolio',
        createdBy: req.user.id,
        status: req.body.status || 'draft'
      });

      if (payload.status === 'published') {
        const errs = pubChecks(payload);
        if (errs.length) return res.status(422).json({ ok:false, message:'VALIDATION_FAILED', details: errs });
      }

      const created = await Portfolio.create(payload);
      return res.status(201).json({ data: created });
    }catch(err){
      console.error('[portfolio-test:create]', err);
      return res.status(500).json({ ok:false, message: err.message || 'CREATE_FAILED' });
    }
  }
);

/* List (public/personal 혼용) */
router.get(
  '/',
  query('status').optional().isIn(['draft','published']),
  query('mine').optional().isIn(['1','true']),
  async (req, res) => {
    try{
      const page  = Math.max(parseInt(req.query.page || '1', 10), 1);
      const limit = Math.min(Math.max(parseInt(req.query.limit || '20',10),1),50);

      const q = { type:'portfolio' };
      // 내 것만 보기
      if (req.query.mine === '1' || req.query.mine === 'true') {
        if (!req.user) return res.status(401).json({ ok:false, message:'UNAUTHORIZED' });
        q.createdBy = req.user.id;
      } else {
        // 공개 리스트: published + (visibility: public|unlisted)
        q.status = 'published';
        q.visibility = { $in:['public','unlisted'] };
      }
      if (req.query.status) q.status = req.query.status;

      const sort = { createdAt: -1 };
      const [items, total] = await Promise.all([
        Portfolio.find(q).sort(sort).skip((page-1)*limit).limit(limit),
        Portfolio.countDocuments(q),
      ]);

      return res.json({ items, page, limit, total, totalPages: Math.ceil(total/limit) });
    }catch(err){
      console.error('[portfolio-test:list]', err);
      return res.status(500).json({ ok:false, message: err.message || 'LIST_FAILED' });
    }
  }
);

/* Read (공개: published 이거나, 본인 소유) */
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ ok:false, message:'INVALID_ID' });

  try{
    const doc = await Portfolio.findById(id);
    if (!doc) return res.status(404).json({ ok:false, message:'NOT_FOUND' });

    const isOwner = req.user && String(doc.createdBy) === req.user.id;
    const isPublic = doc.status === 'published' && ['public','unlisted'].includes(doc.visibility);
    if (!isOwner && !isPublic) return res.status(403).json({ ok:false, message:'FORBIDDEN' });

    return res.json({ data: doc });
  }catch(err){
    console.error('[portfolio-test:read]', err);
    return res.status(500).json({ ok:false, message: err.message || 'READ_FAILED' });
  }
});

/* Update (본인만) */
router.put('/:id', auth, requireRole('showhost','admin'), async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ ok:false, message:'INVALID_ID' });
  try{
    const payload = normalizePayload(req.body || {});
    if (payload.status === 'published') {
      const errs = pubChecks({ ...payload,
        // DB의 필수값이 바뀌지 않는 업데이트도 고려
        nickname: payload.nickname ?? undefined,
        headline: payload.headline ?? undefined,
        mainThumbnailUrl: payload.mainThumbnailUrl ?? undefined
      }).filter(Boolean);
      if (errs.length) return res.status(422).json({ ok:false, message:'VALIDATION_FAILED', details: errs });
    }
    const updated = await Portfolio.findOneAndUpdate(
      { _id:id, createdBy: req.user.id },
      { $set: payload },
      { new:true }
    );
    if (!updated) return res.status(403).json({ ok:false, message:'FORBIDDEN_EDIT' });
    return res.json({ data: updated });
  }catch(err){
    console.error('[portfolio-test:update]', err);
    return res.status(500).json({ ok:false, message: err.message || 'UPDATE_FAILED' });
  }
});

/* Delete (본인만) */
router.delete('/:id', auth, requireRole('showhost','admin'), async (req,res)=>{
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ ok:false, message:'INVALID_ID' });
  try{
    const removed = await Portfolio.findOneAndDelete({ _id:id, createdBy:req.user.id });
    if (!removed) return res.status(404).json({ ok:false, message:'NOT_FOUND_OR_FORBIDDEN' });
    return res.json({ message:'삭제 완료' });
  }catch(err){
    console.error('[portfolio-test:delete]', err);
    return res.status(500).json({ ok:false, message: err.message || 'DELETE_FAILED' });
  }
});

module.exports = router;