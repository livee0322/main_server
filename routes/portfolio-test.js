// routes/portfolio-test.js
const router = require('express').Router();
const { body, query, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const sanitizeHtml = require('sanitize-html');

const Portfolio = require('../models/Portfolio');
const auth = require('../src/middleware/auth');
const requireRole = require('../src/middleware/requireRole');

// sanitize
const sanitize = (html='') => sanitizeHtml(html, {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img','h1','h2','u','span','figure','figcaption']),
  allowedAttributes: { '*': ['style','class','id','src','href','alt','title'] },
  allowedSchemes: ['http','https','data','mailto','tel'],
});

function pubChecks(p){
  const errors = [];
  if(!p.nickname) errors.push({ field:'nickname', msg:'닉네임은 필수입니다.' });
  if(!p.headline) errors.push({ field:'headline', msg:'한 줄 소개는 필수입니다.' });
  if(!p.mainThumbnailUrl && !p.thumbnailUrl) errors.push({ field:'mainThumbnailUrl', msg:'메인 썸네일을 업로드해주세요.' });
  return errors;
}
function normalizePayload(p){
  const out = { ...p };
  if (out.bio) out.bio = sanitize(out.bio);
  if (Array.isArray(out.tags)) {
    const uniq = [...new Set(out.tags.map(t=>String(t).trim()).filter(Boolean))];
    out.tags = uniq.slice(0,8);
  }
  if (Array.isArray(out.subThumbnails)) {
    out.subThumbnails = out.subThumbnails.filter(Boolean).slice(0,5);
  }
  if (Array.isArray(out.liveLinks)) {
    out.liveLinks = out.liveLinks
      .map(l=>({ title:l.title?.trim(), url:l.url?.trim(), date:l.date ? new Date(l.date) : undefined }))
      .filter(l => l.title || l.url);
  }
  if (out.careerYears!==undefined) out.careerYears = Number(out.careerYears);
  if (out.age!==undefined) out.age = Number(out.age);
  return out;
}

// === 스키마 호환 어댑터 ===
function adaptToSchema(payload, userId) {
  const out = { ...payload };
  // 스키마 요구 필드 보강
  out.name = payload.name || payload.nickname || '포트폴리오';
  out.user = userId;                // 스키마 필수
  out.createdBy = userId;           // 기존 필드도 유지

  // 이미지 호환
  out.thumbnailUrl = payload.mainThumbnailUrl || payload.thumbnailUrl || '';
  out.images = Array.isArray(payload.subThumbnails) ? payload.subThumbnails : [];

  // 기본값
  out.visibility = out.visibility || 'public';
  out.type = 'portfolio';

  return out;
}

// Create
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
      const normalized = normalizePayload({
        ...req.body,
        status: req.body.status || 'draft'
      });
      const payload = adaptToSchema(normalized, req.user.id);

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

// List (공개/내 것)
router.get(
  '/',
  query('status').optional().isIn(['draft','published']),
  query('mine').optional().isIn(['1','true']),
  auth.optional ? auth.optional() : (req,res,next)=>next(), // optional auth 지원 시
  async (req, res) => {
    try{
      const page  = Math.max(parseInt(req.query.page || '1', 10), 1);
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

// Read
router.get('/:id', auth.optional ? auth.optional() : (req,res,next)=>next(), async (req, res) => {
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

// Update
router.put('/:id', auth, requireRole('showhost','admin'), async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ ok:false, message:'INVALID_ID' });
  try{
    const normalized = normalizePayload(req.body || {});
    const payload = adaptToSchema(normalized, req.user.id);

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

// Delete
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