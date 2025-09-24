// routes/offers-test.js — v1.4.0 (필드 확장 + DTO + 상태변경 응답메시지)
'use strict';
const router = require('express').Router();
const { body, query, param, validationResult } = require('express-validator');
const mongoose = require('mongoose');

const auth = require('../src/middleware/auth');
const requireRole = require('../src/middleware/requireRole');

const Offer     = require('../models/Offer-test');
const Portfolio = require('../models/Portfolio-test');

const ok   = (res, payload, status=200)=>res.status(status).json(payload);
const fail = (res, code, message, status=400, extra={}) => res.status(status).json({ ok:false, code, message, ...extra });

// ── helpers
const toNumber = (v) => {
  if (v == null || v === '') return undefined;
  const n = Number(String(v).replace(/[^\d.-]/g,''));
  return Number.isFinite(n) ? n : undefined;
};
const asDate = (v) => {
  if (!v) return undefined;
  const d = new Date(v);
  return isNaN(d) ? undefined : d;
};
const moneyDTO = (n, nego) => (nego ? { value:null, negotiable:true } :
  (n == null ? { value:null, negotiable:false } : { value:n, negotiable:false }));

const pfThumb = (pf) => pf?.mainThumbnailUrl || (pf?.subThumbnails||[])[0] || '';

// ── Create
router.post('/',
  auth, requireRole('brand','admin'),
  body('toPortfolioId').isString().isLength({min:1}),
  body('message').optional().isString().isLength({ max:800 }),
  body('brandName').optional().isString().isLength({ max:120 }),
  body('fee').optional(),
  body('feeNegotiable').optional().isBoolean().toBoolean(),
  body('shootDate').optional().isISO8601(),
  body('shootTime').optional().isString().isLength({ max:60 }),
  body('location').optional().isString().isLength({ max:200 }),
  body('replyDeadline').optional().isISO8601(),
  async (req,res)=>{
    const v = validationResult(req);
    if(!v.isEmpty()) return fail(res,'VALIDATION_FAILED','VALIDATION_FAILED',422,{errors:v.array()});

    try{
      const pid = req.body.toPortfolioId;
      if (!mongoose.isValidObjectId(pid)) return fail(res,'INVALID_PORTFOLIO_ID','INVALID_PORTFOLIO_ID',400);

      const pf = await Portfolio.findById(pid).lean();
      if (!pf) return fail(res,'PORTFOLIO_NOT_FOUND','PORTFOLIO_NOT_FOUND',404);

      const toUser = pf.createdBy || pf.user || pf.owner;
      if (!toUser) return fail(res,'PORTFOLIO_OWNER_NOT_FOUND','PORTFOLIO_OWNER_NOT_FOUND',400);

      const payload = {
        type: 'offer',
        createdBy: req.user.id,
        toPortfolioId: pid,
        toUser,

        brandName: String(req.body.brandName||'').trim() || undefined,
        fee: toNumber(req.body.fee),
        feeNegotiable: !!req.body.feeNegotiable,
        message: String(req.body.message||'').trim(),

        shootDate: asDate(req.body.shootDate),
        shootTime: String(req.body.shootTime||'').trim() || undefined,
        location:  String(req.body.location||'').trim()  || undefined,
        replyDeadline: asDate(req.body.replyDeadline)
      };

      if (req.body.recruitId && mongoose.isValidObjectId(req.body.recruitId)) {
        payload.recruitId = req.body.recruitId;
      }

      const created = await Offer.create(payload);
      return ok(res, { data: created }, 201);
    }catch(err){
      console.error('[offers-test:create]', err);
      return fail(res,'CREATE_FAILED', err.message || 'CREATE_FAILED', 500);
    }
  }
);

// DTO (프런트 노출용 최소치)
const toDTO = (o) => {
  const pf = o.toPortfolioId && typeof o.toPortfolioId === 'object' ? o.toPortfolioId : null;
  return {
    id: String(o._id || o.id),
    status: o.status,
    createdAt: o.createdAt,
    brandName: o.brandName || '',
    message: o.message || '',
    fee: moneyDTO(o.fee, o.feeNegotiable),
    shootDate: o.shootDate || null,
    shootTime: o.shootTime || '',
    location:  o.location  || '',
    replyDeadline: o.replyDeadline || null,
    responseMessage: o.responseMessage || '',
    respondedAt: o.respondedAt || null,
    portfolio: pf ? {
      id: String(pf._id || pf.id),
      nickname: pf.nickname || '',
      thumb: pfThumb(pf)
    } : null,
    recruitId: o.recruitId || null
  };
};

// ── List: 받은/보낸
// GET /offers-test?box=received|sent&status=pending&limit=20&page=1
router.get('/',
  auth,
  query('box').optional().isIn(['received','sent']),
  query('status').optional().isIn(['pending','on_hold','accepted','rejected','withdrawn']),
  query('page').optional().isInt({min:1}).toInt(),
  query('limit').optional().isInt({min:1,max:50}).toInt(),
  async (req,res)=>{
    try{
      const box   = req.query.box || 'received';
      const page  = req.query.page  || 1;
      const limit = req.query.limit || 20;

      const q = { type:'offer' };
      if (box === 'sent') q.createdBy = req.user.id; else q.toUser = req.user.id;
      if (req.query.status) q.status = req.query.status;

      const [docs, total] = await Promise.all([
        Offer.find(q).sort({ createdAt:-1 }).skip((page-1)*limit).limit(limit)
          .populate({ path:'toPortfolioId', model:'PortfolioTest', select:'nickname mainThumbnailUrl subThumbnails createdBy' })
          .lean(),
        Offer.countDocuments(q)
      ]);

      return ok(res, {
        items: docs.map(toDTO),
        page, limit, total, totalPages: Math.ceil(total/limit)
      });
    }catch(err){
      console.error('[offers-test:list]', err);
      return fail(res,'LIST_FAILED', err.message || 'LIST_FAILED', 500);
    }
  }
);

// ── Read
router.get('/:id',
  auth, param('id').isString(),
  async (req,res)=>{
    const { id } = req.params;
    if(!mongoose.isValidObjectId(id)) return fail(res,'INVALID_ID','INVALID_ID',400);
    try{
      const doc = await Offer.findById(id)
        .populate({ path:'toPortfolioId', model:'PortfolioTest', select:'nickname mainThumbnailUrl subThumbnails createdBy' })
        .lean();
      if(!doc) return fail(res,'NOT_FOUND','NOT_FOUND',404);

      const mine = req.user.id;
      if (String(doc.createdBy) !== mine && String(doc.toUser) !== mine) {
        return fail(res,'FORBIDDEN','FORBIDDEN',403);
      }
      return ok(res, { data: toDTO(doc) });
    }catch(err){
      console.error('[offers-test:read]', err);
      return fail(res,'READ_FAILED', err.message || 'READ_FAILED', 500);
    }
  }
);

// ── Update status (수락/거절/보류/철회) + 응답 메시지
router.patch('/:id/status',
  auth,
  param('id').isString(),
  body('status').isIn(['pending','on_hold','accepted','rejected','withdrawn']),
  body('responseMessage').optional().isString().isLength({ max:800 }),
  async (req,res)=>{
    const v = validationResult(req);
    if(!v.isEmpty()) return fail(res,'VALIDATION_FAILED','VALIDATION_FAILED',422,{errors:v.array()});

    const { id } = req.params;
    if(!mongoose.isValidObjectId(id)) return fail(res,'INVALID_ID','INVALID_ID',400);

    try{
      const doc = await Offer.findById(id);
      if(!doc) return fail(res,'NOT_FOUND','NOT_FOUND',404);

      const me = req.user.id;
      const want = req.body.status;

      const isSender = String(doc.createdBy) === me;
      const isRcpt   = String(doc.toUser)    === me;

      if (isRcpt) {
        // 수신자: 보류/수락/거절/대기로 변경 가능
        if (!['on_hold','accepted','rejected','pending'].includes(want)) {
          return fail(res,'FORBIDDEN_TRANSITION','FORBIDDEN_TRANSITION',403);
        }
      } else if (isSender) {
        // 발신자: 대기 상태에서만 철회 가능
        if (!(doc.status === 'pending' && want === 'withdrawn')) {
          return fail(res,'FORBIDDEN_TRANSITION','FORBIDDEN_TRANSITION',403);
        }
      } else {
        return fail(res,'FORBIDDEN','FORBIDDEN',403);
      }

      doc.status = want;
      if (isRcpt) {
        doc.responseMessage = (req.body.responseMessage || '').trim() || undefined;
        doc.respondedAt = new Date();
      }
      await doc.save();

      // 최신 populate 포함 응답
      const saved = await Offer.findById(id)
        .populate({ path:'toPortfolioId', model:'PortfolioTest', select:'nickname mainThumbnailUrl subThumbnails createdBy' })
        .lean();

      return ok(res, { data: toDTO(saved) });
    }catch(err){
      console.error('[offers-test:patchStatus]', err);
      return fail(res,'UPDATE_FAILED', err.message || 'UPDATE_FAILED', 500);
    }
  }
);

module.exports = router;