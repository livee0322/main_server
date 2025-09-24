// routes/offers-test.js — v1.0.1 (POST 제안, 받은/보낸 목록)
'use strict';
const router = require('express').Router();
const { body, query, validationResult } = require('express-validator');
const mongoose = require('mongoose');

const auth = require('../src/middleware/auth');
const requireRole = require('../src/middleware/requireRole');

const Offer     = require('../models/Offer-test');
const Portfolio = require('../models/Portfolio-test');

const ok   = (res, payload, status=200)=>res.status(status).json(payload);
const fail = (res, code, message, status=400, extra={}) => res.status(status).json({ ok:false, code, message, ...extra });

/* Create: 브랜드/관리자 */
router.post('/',
  auth, requireRole('brand','admin'),
  body('toPortfolioId').isString().isLength({ min:1 }),
  body('recruitId').optional().isString(),
  body('message').optional().isString().isLength({ max:800 }),
  async (req,res)=>{
    const v = validationResult(req);
    if(!v.isEmpty()) return fail(res,'VALIDATION_FAILED','VALIDATION_FAILED',422,{ errors:v.array() });
    try{
      const pid = req.body.toPortfolioId;
      if(!mongoose.isValidObjectId(pid)) return fail(res,'INVALID_PORTFOLIO_ID','INVALID_PORTFOLIO_ID',400);

      const pf = await Portfolio.findById(pid).lean();
      if(!pf) return fail(res,'PORTFOLIO_NOT_FOUND','PORTFOLIO_NOT_FOUND',404);

      const toUser = pf.createdBy || pf.user || pf.owner;
      if(!toUser) return fail(res,'PORTFOLIO_OWNER_NOT_FOUND','PORTFOLIO_OWNER_NOT_FOUND',400);

      const payload = {
        type:'offer',
        createdBy: req.user.id,
        toPortfolioId: pid,
        toUser,
        message: String(req.body.message || '').trim()
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
// GET /offers-test?box=received|sent&status=pending&limit=20&page=1
router.get('/',
  auth,
  query('box').optional().isIn(['received','sent']),
  query('status').optional().isIn(['pending','on_hold','accepted','rejected','withdrawn']),
  async (req,res)=>{
    try{
      const box   = req.query.box || 'received';
      const page  = Math.max(parseInt(req.query.page || '1', 10), 1);
      const limit = Math.min(Math.max(parseInt(req.query.limit || '20',10),1), 50);

      const q = { type:'offer' };
      if (box === 'sent') q.createdBy = req.user.id;     // 보낸 제안(브랜드)
      else               q.toUser    = req.user.id;     // 받은 제안(쇼호스트)

      if (req.query.status) q.status = req.query.status;

      const [items, total] = await Promise.all([
        Offer.find(q).sort({ createdAt:-1 }).skip((page-1)*limit).limit(limit)
          .populate({ path:'toPortfolioId', model:'PortfolioTest', select:'nickname mainThumbnailUrl subThumbnails createdBy' }) // ★ 모델명
          .populate({ path:'recruitId', select:'title thumbnailUrl' })
          .lean(),
        Offer.countDocuments(q)
      ]);

      return ok(res, { items, page, limit, total, totalPages: Math.ceil(total/limit) });
    }catch(err){
      console.error('[offers-test:list]', err);
      return fail(res,'LIST_FAILED', err.message || 'LIST_FAILED', 500);
    }
  }
);

module.exports = router;