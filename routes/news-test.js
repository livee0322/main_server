// routes/news-test.js
'use strict';

const router = require('express').Router();
const { body, query, validationResult } = require('express-validator');
const sanitizeHtml = require('sanitize-html');
const mongoose = require('mongoose');

const auth = require('../src/middleware/auth');
const News = require('../models/News-test');

const optionalAuth = auth.optional ? auth.optional() : (_req,_res,next)=>next();

const sanitize = (html='') => sanitizeHtml(html, {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img','h1','h2','u','span','figure','figcaption']),
  allowedAttributes: { '*': ['style','class','id','src','href','alt','title'] },
  allowedSchemes: ['http','https','data','mailto','tel'],
});

function compatBody(b){
  const out = { ...b };
  if (out.label && !out.category) out.category = out.label;
  if (out.imageUrl && !out.thumbnailUrl) out.thumbnailUrl = out.imageUrl;
  if (out.desc && !out.summary) out.summary = out.desc;
  if (out.body && !out.content) out.content = out.body;
  delete out.label; delete out.imageUrl; delete out.body; delete out.desc;
  return out;
}

function normalizePayload(p){
  const out = { ...p };
  if (out.content) out.content = sanitize(String(out.content));
  if (out.summary) out.summary = String(out.summary).trim();
  out.type = 'news';
  // ✅ 지금은 즉시 발행: 클라이언트가 주면 그대로, 없으면 published
  out.status = out.status || 'published';
  out.visibility = out.visibility || 'public';
  return out;
}

const baseSchema = [
  body('*').customSanitizer(v => (v === '' ? undefined : v)),
  body('status').optional().isIn(['draft','pending','published','rejected']),
  body('visibility').optional().isIn(['public','unlisted','private']),
  body('category').optional().isString().trim().isLength({ min:1, max:40 }),
  body('title').optional().isString().trim().isLength({ min:1, max:60 }),
  body('summary').optional().isString().trim().isLength({ max:300 }),
  body('content').optional().isString(),
  body('thumbnailUrl').optional().isURL({ protocols:['http','https'], require_protocol:true }),
  body('consent').optional().isBoolean().toBoolean(),
];

function sendValidationIfAny(req,res,next){
  const v = validationResult(req);
  if (v.isEmpty()) return next();
  return res.status(422).json({ ok:false, code:'VALIDATION_FAILED', message:'유효성 오류', details: v.array({ onlyFirstError:true }) });
}

// Create (로그인만, 즉시 발행)
router.post('/',
  auth,
  (req,_res,next)=>{ req.body = compatBody(req.body); next(); },
  baseSchema,
  sendValidationIfAny,
  async (req,res)=>{
    try{
      const payload = normalizePayload(req.body || {});
      if (!payload.title) return res.status(422).json({ ok:false, message:'TITLE_REQUIRED' });
      if (payload.consent === false) return res.status(422).json({ ok:false, message:'CONSENT_REQUIRED' });
      payload.createdBy = req.user.id;

      const created = await News.create(payload);
      return res.status(201).json({ data: created });
    }catch(err){
      console.error('[news-test:create]', err);
      return res.status(500).json({ ok:false, message: err.message || 'CREATE_FAILED' });
    }
  }
);

// List (공개 보기)
router.get('/',
  optionalAuth,
  query('status').optional().isIn(['draft','pending','published','rejected']),
  query('mine').optional().isIn(['1','true']),
  async (req,res)=>{
    try{
      const page  = Math.max(parseInt(req.query.page||'1',10),1);
      const limit = Math.min(Math.max(parseInt(req.query.limit||'20',10),1),50);

      const q = { type:'news' };
      if (req.query.mine === '1' || req.query.mine === 'true') {
        if (!req.user) return res.status(401).json({ ok:false, message:'UNAUTHORIZED' });
        q.createdBy = req.user.id;
        if (req.query.status) q.status = req.query.status;
      } else {
        q.status = 'published';
        q.visibility = { $in:['public','unlisted'] };
      }

      const sort = { createdAt:-1 };
      const [items, total] = await Promise.all([
        News.find(q).sort(sort).skip((page-1)*limit).limit(limit),
        News.countDocuments(q),
      ]);

      return res.json({ items, page, limit, total, totalPages: Math.ceil(total/limit) });
    }catch(err){
      console.error('[news-test:list]', err);
      return res.status(500).json({ ok:false, message: err.message || 'LIST_FAILED' });
    }
  }
);

// Read / Update / Delete (작성자 제한)은 이전과 동일
router.get('/:id', optionalAuth, async (req,res)=>{
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ ok:false, message:'INVALID_ID' });
  try{
    const doc = await News.findById(id);
    if (!doc) return res.status(404).json({ ok:false, message:'NOT_FOUND' });
    const isOwner = req.user && String(doc.createdBy) === req.user.id;
    const isPublic = doc.status === 'published' && ['public','unlisted'].includes(doc.visibility);
    if (!isOwner && !isPublic) return res.status(403).json({ ok:false, message:'FORBIDDEN' });
    return res.json({ data: doc });
  }catch(err){
    console.error('[news-test:read]', err);
    return res.status(500).json({ ok:false, message: err.message || 'READ_FAILED' });
  }
});

router.put('/:id', auth, (req,_res,next)=>{ req.body = compatBody(req.body); next(); }, baseSchema, sendValidationIfAny, async (req,res)=>{
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ ok:false, message:'INVALID_ID' });
  try{
    const updated = await News.findOneAndUpdate(
      { _id:id, createdBy:req.user.id },
      { $set: normalizePayload(req.body || {}) },
      { new:true }
    );
    if (!updated) return res.status(403).json({ ok:false, message:'FORBIDDEN_EDIT' });
    return res.json({ data: updated });
  }catch(err){
    console.error('[news-test:update]', err);
    return res.status(500).json({ ok:false, message: err.message || 'UPDATE_FAILED' });
  }
});

router.delete('/:id', auth, async (req,res)=>{
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ ok:false, message:'INVALID_ID' });
  try{
    const removed = await News.findOneAndDelete({ _id:id, createdBy:req.user.id });
    if (!removed) return res.status(404).json({ ok:false, message:'NOT_FOUND_OR_FORBIDDEN' });
    return res.json({ message:'삭제 완료' });
  }catch(err){
    console.error('[news-test:delete]', err);
    return res.status(500).json({ ok:false, message: err.message || 'DELETE_FAILED' });
  }
});

module.exports = router;