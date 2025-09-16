'use strict';
const router = require('express').Router();
const { body, query, validationResult } = require('express-validator');
const sanitizeHtml = require('sanitize-html');
const mongoose = require('mongoose');

const auth = require('../src/middleware/auth');
const requireRole = require('../src/middleware/requireRole');
const ModelDoc = require('../models/Model-test');

// 선택 인증(공개 리스트/상세는 비로그인 허용)
const optionalAuth = auth.optional ? auth.optional() : (_req,_res,next)=>next();

// ── utils ──────────────────────────────────────────────────────────
const sanitize = (html='') => sanitizeHtml(html, {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img','h1','h2','u','span','figure','figcaption']),
  allowedAttributes: { '*': ['style','class','id','src','href','alt','title'] },
  allowedSchemes: ['http','https','data','mailto','tel'],
});
const strip = (html='') => String(html||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();

const compatBody = (b={}) => {
  // 프런트-백 호환: 빈 문자열 → undefined
  const out = {};
  for (const k of Object.keys(b)) out[k] = (b[k] === '' ? undefined : b[k]);
  return out;
};

const unifyDoc = (d) => {
  const o = (typeof d.toObject === 'function') ? d.toObject() : { ...d };
  o.id = String(o._id || o.id || '');
  return o;
};

const normalizePayload = (p={}) => {
  const out = { ...p };

  if (out.bio) out.bio = sanitize(String(out.bio));
  if (Array.isArray(out.subThumbnails)) out.subThumbnails = out.subThumbnails.filter(Boolean).slice(0,5);
  if (Array.isArray(out.tags)) out.tags = [...new Set(out.tags.map(s => String(s).trim()).filter(Boolean))].slice(0,12);

  // 숫자 변환
  if (out.careerYears !== undefined) out.careerYears = Number(out.careerYears);
  if (out.age         !== undefined) out.age         = Number(out.age);

  // 하위 객체 기본 구조 보정
  out.links        = out.links        || {};
  out.region       = Object.assign({ country:'KR' }, out.region || {});
  out.demographics = out.demographics || {};

  return out;
};

function sendValidationIfAny(req, res, next){
  const v = validationResult(req);
  if (v.isEmpty()) return next();
  return res.status(422).json({ ok:false, code:'VALIDATION_FAILED', message:'유효성 오류', details: v.array({ onlyFirstError:true }) });
}

// 발행 필수값 체크
function publishedGuard(req, res, next){
  const p = req.body || {};
  if ((p.status || 'draft') !== 'published') return next();
  const errs = [];
  if (!p.nickname)         errs.push({ param:'nickname',         msg:'REQUIRED' });
  if (!p.headline)         errs.push({ param:'headline',         msg:'REQUIRED' });
  if (!p.mainThumbnailUrl) errs.push({ param:'mainThumbnailUrl', msg:'REQUIRED' });
  if (errs.length) return res.status(422).json({ ok:false, code:'VALIDATION_FAILED', message:'유효성 오류', details: errs });
  next();
}

// 공통 유효성
const baseSchema = [
  body('*').customSanitizer(v => (v === '' ? undefined : v)),

  body('status').optional().isIn(['draft','published']),
  body('visibility').optional().isIn(['public','private']),

  body('nickname').optional().isString().trim().isLength({ min:1, max:80 }),
  body('headline').optional().isString().trim().isLength({ min:1, max:120 }),
  body('bio').optional().isString().isLength({ max:5000 }),

  body('mainThumbnailUrl').optional().isURL({ protocols:['http','https'], require_protocol:true }),
  body('coverImageUrl').optional().isURL({ protocols:['http','https'], require_protocol:true }),
  body('subThumbnails').optional().isArray({ max:5 }),
  body('subThumbnails.*').optional().isURL({ protocols:['http','https'], require_protocol:true }),

  body('careerYears').optional().isInt({ min:0, max:50 }).toInt(),
  body('age').optional().isInt({ min:14, max:99 }).toInt(),

  // links
  body('links').optional().isObject(),
  body('links.website').optional().isURL({ protocols:['http','https'], require_protocol:true }),
  body('links.instagram').optional().isURL({ protocols:['http','https'], require_protocol:true }),
  body('links.youtube').optional().isURL({ protocols:['http','https'], require_protocol:true }),

  // region & demographics(간단 검증)
  body('region').optional().isObject(),
  body('region.city').optional().isString().trim().isLength({ max:80 }),
  body('region.area').optional().isString().trim().isLength({ max:80 }),

  body('demographics').optional().isObject(),
  body('demographics.gender').optional().isIn(['','female','male','other']),
  body('demographics.height').optional().isInt({ min:100, max:220 }).toInt(),
  body('demographics.weight').optional().isInt({ min:30,  max:150 }).toInt(),
  body('demographics.sizeTop').optional().isString().trim().isLength({ max:40 }),
  body('demographics.sizeBottom').optional().isString().trim().isLength({ max:40 }),
  body('demographics.shoe').optional().isString().trim().isLength({ max:40 }),

  body('tags').optional().isArray({ max:12 }),
  body('tags.*').optional().isString().trim().isLength({ min:1, max:30 }),

  body('openToOffers').optional().isBoolean().toBoolean(),
];

// ── CRUD ───────────────────────────────────────────────────────────

// Create (showhost / admin 허용)
router.post('/',
  auth, requireRole('showhost','admin'),
  (req,_res,next)=>{ req.body = compatBody(req.body); next(); },
  baseSchema, sendValidationIfAny, publishedGuard,
  async (req,res)=>{
    try{
      const payload = normalizePayload(req.body || {});
      payload.type = 'model';
      if (payload.status     === undefined) payload.status     = 'draft';
      if (payload.visibility === undefined) payload.visibility = 'public';
      payload.createdBy = req.user.id;

      const created = await ModelDoc.create(payload);
      return res.status(201).json({ data: unifyDoc(created) });
    }catch(err){
      console.error('[model-test:create]', err);
      return res.status(500).json({ ok:false, message: err.message || 'CREATE_FAILED' });
    }
  }
);

// List (공개 또는 내 것)
router.get('/',
  optionalAuth,
  query('status').optional().isIn(['draft','published']),
  query('mine').optional().isIn(['1','true']),
  async (req,res)=>{
    try{
      const page  = Math.max(parseInt(req.query.page  || '1', 10), 1);
      const limit = Math.min(Math.max(parseInt(req.query.limit || '20',10),1),50);

      const q = { type:'model' };
      if (req.query.mine === '1' || req.query.mine === 'true') {
        if (!req.user) return res.status(401).json({ ok:false, message:'UNAUTHORIZED' });
        q.createdBy = req.user.id;
      } else {
        q.status = 'published';
        q.visibility = 'public';
      }
      if (req.query.status) q.status = req.query.status;

      const sort = { createdAt: -1 };
      const [docs, total] = await Promise.all([
        ModelDoc.find(q).sort(sort).skip((page-1)*limit).limit(limit).lean(),
        ModelDoc.countDocuments(q),
      ]);

      const items = docs.map(unifyDoc);
      return res.json({ items, page, limit, total, totalPages: Math.ceil(total/limit) });
    }catch(err){
      console.error('[model-test:list]', err);
      return res.status(500).json({ ok:false, message: err.message || 'LIST_FAILED' });
    }
  }
);

// Read (공개 or 본인)
router.get('/:id', optionalAuth, async (req,res)=>{
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ ok:false, message:'INVALID_ID' });
  try{
    const doc = await ModelDoc.findById(id);
    if (!doc) return res.status(404).json({ ok:false, message:'NOT_FOUND' });
    const isOwner = req.user && String(doc.createdBy) === req.user.id;
    const isPublic = doc.status === 'published' && doc.visibility === 'public';
    if (!isOwner && !isPublic) return res.status(403).json({ ok:false, message:'FORBIDDEN' });
    return res.json({ data: unifyDoc(doc) });
  }catch(err){
    console.error('[model-test:read]', err);
    return res.status(500).json({ ok:false, message: err.message || 'READ_FAILED' });
  }
});

// Update (본인만, showhost/admin)
router.put('/:id',
  auth, requireRole('showhost','admin'),
  (req,_res,next)=>{ req.body = compatBody(req.body); next(); },
  baseSchema, sendValidationIfAny, publishedGuard,
  async (req,res)=>{
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ ok:false, message:'INVALID_ID' });
    try{
      const payload = normalizePayload(req.body || {});
      payload.type = 'model'; // 안전 보정
      const updated = await ModelDoc.findOneAndUpdate(
        { _id:id, createdBy: req.user.id },
        { $set: payload },
        { new:true }
      );
      if (!updated) return res.status(403).json({ ok:false, message:'FORBIDDEN_EDIT' });
      return res.json({ data: unifyDoc(updated) });
    }catch(err){
      console.error('[model-test:update]', err);
      return res.status(500).json({ ok:false, message: err.message || 'UPDATE_FAILED' });
    }
  }
);

// Delete (본인만, showhost/admin)
router.delete('/:id',
  auth, requireRole('showhost','admin'),
  async (req,res)=>{
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ ok:false, message:'INVALID_ID' });
    try{
      const removed = await ModelDoc.findOneAndDelete({ _id:id, createdBy:req.user.id });
      if (!removed) return res.status(404).json({ ok:false, message:'NOT_FOUND_OR_FORBIDDEN' });
      return res.json({ ok:true, message:'삭제 완료' });
    }catch(err){
      console.error('[model-test:delete]', err);
      return res.status(500).json({ ok:false, message: err.message || 'DELETE_FAILED' });
    }
  }
);

module.exports = router;