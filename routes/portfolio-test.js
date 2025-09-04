// routes/portfolio-test.js
'use strict';

const router = require('express').Router();
const { body, query, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const sanitizeHtml = require('sanitize-html');

// ✅ 테스트용 모델 파일 사용 (models/Portfolio-test.js)
const Portfolio = require('../models/Portfolio-test');

const auth = require('../src/middleware/auth');
const requireRole = require('../src/middleware/requireRole');

// sanitize helper
const sanitize = (html='') => sanitizeHtml(html, {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img','h1','h2','u','span','figure','figcaption']),
  allowedAttributes: { '*': ['style','class','id','src','href','alt','title'] },
  allowedSchemes: ['http','https','data','mailto','tel'],
});

// 공개 발행 시 필수 체크
function pubChecks(p){
  const errors = [];
  if (!p.nickname)        errors.push({ field:'nickname',        msg:'닉네임은 필수입니다.' });
  if (!p.headline)        errors.push({ field:'headline',        msg:'한 줄 소개는 필수입니다.' });
  if (!p.mainThumbnailUrl)errors.push({ field:'mainThumbnailUrl',msg:'메인 썸네일을 업로드해주세요.' });
  return errors;
}

// payload 정리
function normalizePayload(p){
  const out = { ...p };

  if (out.bio) out.bio = sanitize(out.bio);

  if (Array.isArray(out.tags)) {
    out.tags = [...new Set(out.tags.map(t => String(t).trim()).filter(Boolean))].slice(0, 8);
  }
  if (Array.isArray(out.subThumbnails)) {
    out.subThumbnails = out.subThumbnails.filter(Boolean).slice(0, 5);
  }
  if (Array.isArray(out.liveLinks)) {
    out.liveLinks = out.liveLinks
      .map(l => ({
        title: l.title?.trim(),
        url:   l.url?.trim(),
        date:  l.date ? new Date(l.date) : undefined
      }))
      .filter(l => l.title || l.url);
  }
  if (out.careerYears !== undefined) out.careerYears = Number(out.careerYears);
  if (out.age         !== undefined) out.age         = Number(out.age);

  // 기본값 보강
  out.type = 'portfolio';
  out.visibility = out.visibility || 'public';
  out.status = out.status || 'draft';

  return out;
}

// -------- Create --------
router.post(
  '/',
  auth,
  requireRole('showhost', 'admin'),
  body('nickname').isString().trim().notEmpty(),
  body('headline').isString().trim().notEmpty(),
  body('status').optional().isIn(['draft','published']),
  async (req, res) => {
    const v = validationResult(req);
    if (!v.isEmpty()) {
      return res.status(422).json({ ok:false, message:'VALIDATION_FAILED', details: v.array() });
    }

    try{
      const payload = normalizePayload({ ...req.body });
      payload.createdBy = req.user.id; // ✅ 옵션 B: createdBy만 사용

      if (payload.status === 'published') {
        const errs = pubChecks(payload);
        if (errs.length) return res.status(422).json({ ok:false, message:'VALIDATION_FAILED', details: errs });
      }

      const created = await Portfolio.create(payload);
      return res.status(201).json({ data: created });
    }catch(err){
      console.error('[portfolio-test:create]', err);
      // 과거 user_1 유니크 인덱스가 남아있을 때를 위한 안내
      if (err?.code === 11000 && String(err?.message||'').includes('user_1')) {
        return res.status(409).json({
          ok:false,
          message:'DUP_INDEX_USER_1',
          hint:'기존 user_1 유니크 인덱스가 남아 있습니다. mongo 콘솔에서 db.portfolios.dropIndex("user_1") 실행 후 재시도하세요.'
        });
      }
      return res.status(500).json({ ok:false, message: err.message || 'CREATE_FAILED' });
    }
  }
);

// 선택 인증 미들웨어 (없으면 no-op)
const optionalAuth = auth.optional ? auth.optional() : (req,res,next)=>next();

// -------- List (공개/내 것) --------
router.get(
  '/',
  optionalAuth,
  query('status').optional().isIn(['draft','published']),
  query('mine').optional().isIn(['1','true']),
  async (req, res) => {
    try{
      const page  = Math.max(parseInt(req.query.page  || '1', 10), 1);
      const limit = Math.min(Math.max(parseInt(req.query.limit || '20',10),1),50);

      const q = { type:'portfolio' };
      if (req.query.mine === '1' || req.query.mine === 'true') {
        if (!req.user) return res.status(401).json({ ok:false, message:'UNAUTHORIZED' });
        q.createdBy = req.user.id;
      } else {
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

// -------- Read --------
router.get('/:id', optionalAuth, async (req, res) => {
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

// -------- Update --------
router.put('/:id', auth, requireRole('showhost','admin'), async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ ok:false, message:'INVALID_ID' });

  try{
    const payload = normalizePayload(req.body || {});

    if (payload.status === 'published') {
      const errs = pubChecks(payload);
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

// -------- Delete --------
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