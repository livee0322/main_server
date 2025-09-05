// routes/portfolio-
test.js
'use strict';

const router = require('express').Router();
const { body, query, validationResult } = require('express-validator');
const sanitizeHtml = require('sanitize-html');
const mongoose = require('mongoose');

const auth = require('../src/middleware/auth');
const requireRole = require('../src/middleware/requireRole');
const Portfolio = require('../models/Portfolio');

/* ───────────────── helpers ───────────────── */
const optionalAuth = auth.optional ? auth.optional() : (req,res,next)=>next();

const sanitize = (html='') => sanitizeHtml(html, {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img','h1','h2','u','span','figure','figcaption']),
  allowedAttributes: { '*': ['style','class','id','src','href','alt','title'] },
  allowedSchemes: ['http','https','data','mailto','tel'],
});

// 구버전 → 표준 필드 매핑
function compatBody(b){
  const out = { ...b };
  if (out.displayName && !out.nickname) out.nickname = out.displayName;
  if (out.mainThumbnail && !out.mainThumbnailUrl) out.mainThumbnailUrl = out.mainThumbnail;
  if (out.coverImage && !out.coverImageUrl) out.coverImageUrl = out.coverImage;
  if (out.subImages && !out.subThumbnails) out.subThumbnails = out.subImages;
  return out;
}

// 정규화
function normalizePayload(p){
  const out = { ...p };

  if (out.bio) out.bio = sanitize(String(out.bio));

  if (Array.isArray(out.tags)) {
    out.tags = [...new Set(out.tags.map(t => String(t).trim()).filter(Boolean))].slice(0, 8);
  }
  if (Array.isArray(out.subThumbnails)) {
    out.subThumbnails = out.subThumbnails.filter(Boolean).slice(0, 5);
  }
  if (Array.isArray(out.liveLinks)) {
    out.liveLinks = out.liveLinks
      .map(l => ({
        title: l?.title ? String(l.title).trim() : '',
        url:   l?.url   ? String(l.url).trim()   : '',
        date:  l?.date  ? new Date(l.date)       : undefined
      }))
      .filter(l => l.title || l.url);
  }

  if (out.careerYears !== undefined) out.careerYears = Number(out.careerYears);
  if (out.age         !== undefined) out.age         = Number(out.age);

  out.type = 'portfolio';
  out.visibility = out.visibility || 'public';
  out.status = out.status || 'draft';

  return out;
}

// 발행 시 필수 체크
function publishedGuard(req, res, next){
  const p = req.body || {};
  const status = p.status || 'draft';
  if (status !== 'published') return next();

  const errs = [];
  if (!p.nickname) errs.push({ param:'nickname', msg:'REQUIRED' });
  if (!p.headline) errs.push({ param:'headline', msg:'REQUIRED' });
  if (!p.mainThumbnailUrl) errs.push({ param:'mainThumbnailUrl', msg:'REQUIRED' });
  if (!p.bio || String(p.bio).trim().length < 50) errs.push({ param:'bio', msg:'MIN_50' });

  if (errs.length) return res.status(422).json({ ok:false, message:'VALIDATION_FAILED', details: errs });
  next();
}

// ── 공통 검증 스키마 (draft에선 빈값 허용) ──
const opt = { checkFalsy: true, nullable: true };

const baseSchema = [
  body('status').optional().isIn(['draft','published']),
  body('visibility').optional().isIn(['public','unlisted','private']),

  body('nickname').optional(opt).isString().trim().isLength({ max:80 }),
  body('headline').optional(opt).isString().trim().isLength({ max:120 }),
  body('bio').optional(opt).isString().isLength({ max:5000 }),

  body('mainThumbnailUrl').optional(opt)
    .isURL({ protocols:['http','https'], require_protocol:true }),
  body('coverImageUrl').optional(opt)
    .isURL({ protocols:['http','https'], require_protocol:true }),

  body('subThumbnails').optional().isArray({ max:5 }),
  body('subThumbnails.*').optional(opt)
    .isURL({ protocols:['http','https'], require_protocol:true }),

  body('tags').optional().isArray({ max:8 }),
  body('tags.*').optional(opt).isString().trim().isLength({ max:30 }),

  body('liveLinks').optional().isArray({ max:50 }),
  body('liveLinks.*.title').optional(opt).isString().trim().isLength({ max:120 }),
  body('liveLinks.*.url').optional(opt)
    .isURL({ protocols:['http','https'], require_protocol:true }),
  body('liveLinks.*.date').optional(opt).isISO8601().toDate(),

  body('careerYears').optional({ checkFalsy:true }).isInt({ min:0, max:50 }).toInt(),
  body('age').optional({ checkFalsy:true }).isInt({ min:14, max:99 }).toInt(),
  body('realName').optional(opt).isString().trim().isLength({ max:80 }),
  body('realNamePublic').optional().isBoolean().toBoolean(),
  body('agePublic').optional().isBoolean().toBoolean(),
  body('openToOffers').optional().isBoolean().toBoolean(),

  body('primaryLink').optional(opt)
    .isURL({ protocols:['http','https'], require_protocol:true }),
];

// 표준 에러 응답
function sendValidationIfAny(req, res, next){
  const v = validationResult(req);
  if (v.isEmpty()) return next();
  return res.status(422).json({ ok:false, message:'VALIDATION_FAILED', details: v.array() });
}

/* ───────────────── Routes ───────────────── */

// Create
router.post('/',
  auth,
  requireRole('showhost','admin'),
  (req, _res, next)=>{ req.body = compatBody(req.body); next(); },
  baseSchema,
  sendValidationIfAny,
  publishedGuard,
  async (req, res) => {
    try{
      const payload = normalizePayload(req.body || {});
      payload.createdBy = req.user.id;

      const created = await Portfolio.create(payload);
      return res.status(201).json({ data: created });
    }catch(err){
      console.error('[portfolio:create]', err);
      if (err?.code === 11000 && String(err?.message||'').includes('user_1')) {
        return res.status(409).json({
          ok:false,
          message:'DUP_INDEX_USER_1',
          hint:'기존 user_1 유니크 인덱스가 남아 있습니다. db.portfolios.dropIndex("user_1") 후 재시도하세요.'
        });
      }
      return res.status(500).json({ ok:false, message: err.message || 'CREATE_FAILED' });
    }
  }
);

// List
router.get('/',
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
      console.error('[portfolio:list]', err);
      return res.status(500).json({ ok:false, message: err.message || 'LIST_FAILED' });
    }
  }
);

// Read
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
    console.error('[portfolio:read]', err);
    return res.status(500).json({ ok:false, message: err.message || 'READ_FAILED' });
  }
});

// Update
router.put('/:id',
  auth,
  requireRole('showhost','admin'),
  (req, _res, next)=>{ req.body = compatBody(req.body); next(); },
  baseSchema,
  sendValidationIfAny,
  publishedGuard,
  async (req, res) => {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ ok:false, message:'INVALID_ID' });

    try{
      const payload = normalizePayload(req.body || {});
      const updated = await Portfolio.findOneAndUpdate(
        { _id:id, createdBy: req.user.id },
        { $set: payload },
        { new:true }
      );
      if (!updated) return res.status(403).json({ ok:false, message:'FORBIDDEN_EDIT' });

      return res.json({ data: updated });
    }catch(err){
      console.error('[portfolio:update]', err);
      return res.status(500).json({ ok:false, message: err.message || 'UPDATE_FAILED' });
    }
  }
);

// Delete
router.delete('/:id',
  auth,
  requireRole('showhost','admin'),
  async (req,res)=>{
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ ok:false, message:'INVALID_ID' });

    try{
      const removed = await Portfolio.findOneAndDelete({ _id:id, createdBy:req.user.id });
      if (!removed) return res.status(404).json({ ok:false, message:'NOT_FOUND_OR_FORBIDDEN' });
      return res.json({ message:'삭제 완료' });
    }catch(err){
      console.error('[portfolio:delete]', err);
      return res.status(500).json({ ok:false, message: err.message || 'DELETE_FAILED' });
    }
  }
);

module.exports = router;