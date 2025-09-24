// routes/offers-test.js — v1.2.1 (populate 'PortfolioTest' 명시, 에러 메시지 정리)
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

/* Create */
router.post('/',
  auth, requireRole('brand','admin'),
  body('toPortfolioId').isString().isLength({min:1}),
  body('recruitId').optional().isString(),
  body('message').optional().isString().isLength({ max:800 }),
  async (req,res)=>{
    const v = validationResult(req); if(!v.isEmpty()) return fail(res,'VALIDATION_FAILED','VALIDATION_FAILED',422,{errors:v.array()});
    try{
      const pid = req.body.toPortfolioId;
      if (!mongoose.isValidObjectId(pid)) return fail(res,'INVALID_PORTFOLIO_ID','INVALID_PORTFOLIO_ID',400);

      const pf = await Portfolio.findById(pid).lean();
      if (!pf) return fail(res,'PORTFOLIO_NOT_FOUND','PORTFOLIO_NOT_FOUND',404);

      const toUser = pf.createdBy || pf.user || pf.owner;
      if (!toUser) return fail(res,'PORTFOLIO_OWNER_NOT_FOUND','PORTFOLIO_OWNER_NOT_FOUND',400);

      const payload = {
        type:'offer',
        createdBy: req.user.id,
        toPortfolioId: pid,
        toUser,
        message: String(req.body.message||'').trim(),
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

/* List: 받은/보낸 */
router.get('/',
  auth,
  query('box').optional().isIn(['received','sent']),
  query('page').optional().isInt({min:1}).toInt(),
  query('limit').optional().isInt({min:1,max:50}).toInt(),
  async (req,res)=>{
    try{
      const box   = req.query.box || 'received';
      const page  = req.query.page  || 1;
      const limit = req.query.limit || 20;

      const q = { type:'offer' };
      if (box === 'sent') q.createdBy = req.user.id;
      else                q.toUser    = req.user.id;

      const [items, total] = await Promise.all([
        Offer.find(q)
          .sort({ createdAt:-1 })
          .skip((page-1)*limit).limit(limit)
          // ▼ ref 이름과 일치하도록 model 명시
          .populate({ path:'toPortfolioId', model:'PortfolioTest', select:'nickname mainThumbnailUrl subThumbnails createdBy' })
          .populate({ path:'recruitId', model:'Recruit-test', select:'title thumbnailUrl' })
          .lean(),
        Offer.countDocuments(q)
      ]);

      return ok(res, { items, page, limit, total, totalPages: Math.ceil(total/limit) });
    }catch(err){
      console.error('[offers-test:list]', err);
      // 토큰 만료 시 401로 내려주면 프런트가 안내할 수 있어요.
      if (String(err.name).includes('TokenExpired')) return fail(res,'TOKEN_EXPIRED','TOKEN_EXPIRED',401);
      return fail(res,'LIST_FAILED', err.message || 'LIST_FAILED', 500);
    }
  }
);

/* Read */
router.get('/:id', auth, param('id').isString(), async (req,res)=>{
  const { id } = req.params;
  if(!mongoose.isValidObjectId(id)) return fail(res,'INVALID_ID','INVALID_ID',400);
  try{
    const doc = await Offer.findById(id)
      .populate({ path:'toPortfolioId', model:'PortfolioTest', select:'nickname mainThumbnailUrl' })
      .populate({ path:'recruitId', model:'Recruit-test', select:'title thumbnailUrl' });
    if(!doc) return fail(res,'NOT_FOUND','NOT_FOUND',404);

    const isOwner = String(doc.createdBy) === req.user.id;
    const isRcpt  = String(doc.toUser)    === req.user.id;
    if (!isOwner && !isRcpt) return fail(res,'FORBIDDEN','FORBIDDEN',403);

    return ok(res,{ data: doc });
  }catch(err){
    console.error('[offers-test:read]',err);
    return fail(res,'READ_FAILED', err.message || 'READ_FAILED', 500);
  }
});

/* Update status */
router.patch('/:id/status',
  auth,
  param('id').isString(),
  body('status').isIn(['pending','on_hold','accepted','rejected','withdrawn']),
  async (req,res)=>{
    const v = validationResult(req); if(!v.isEmpty()) return fail(res,'VALIDATION_FAILED','VALIDATION_FAILED',422,{errors:v.array()});
    const { id } = req.params;
    if(!mongoose.isValidObjectId(id)) return fail(res,'INVALID_ID','INVALID_ID',400);

    try{
      const doc = await Offer.findById(id);
      if(!doc) return fail(res,'NOT_FOUND','NOT_FOUND',404);

      const want = req.body.status;
      const me   = req.user.id;
      const isOwner = String(doc.createdBy) === me;
      const isRcpt  = String(doc.toUser)    === me;

      if (isRcpt) {
        if (!['on_hold','accepted','rejected','pending'].includes(want))
          return fail(res,'FORBIDDEN_TRANSITION','FORBIDDEN_TRANSITION',403);
      } else if (isOwner) {
        if (want !== 'withdrawn' || doc.status !== 'pending')
          return fail(res,'FORBIDDEN_TRANSITION','FORBIDDEN_TRANSITION',403);
      } else {
        return fail(res,'FORBIDDEN','FORBIDDEN',403);
      }

      doc.status = want;
      await doc.save();
      return ok(res,{ data: doc });
    }catch(err){
      console.error('[offers-test:patchStatus]',err);
      return fail(res,'UPDATE_FAILED', err.message || 'UPDATE_FAILED', 500);
    }
  }
);

module.exports = router;