// routes/sponsorship-test.js — v1.0.0 (create/list/read/update/status)
'use strict';
const router = require('express').Router();
const { body, query, param, validationResult } = require('express-validator');
const mongoose = require('mongoose');

const auth = require('../src/middleware/auth');
const requireRole = require('../src/middleware/requireRole');

const Sponsorship = require('../models/Sponsorship-test');

const ok = (res, payload, status=200)=>res.status(status).json(payload);
const fail = (res, code, message, status=400, extra={}) => res.status(status).json({ ok:false, code, message, ...extra });

// sanitize (best-effort)
let sanitize = (s='')=>String(s||'');
try{ const sh=require('sanitize-html');
  sanitize=(html='')=>sh(html||'',{allowedTags:sh.defaults.allowedTags.concat(['img','h1','h2','u','span','figure','figcaption']),
  allowedAttributes:{'*':['style','class','id','src','href','alt','title']},allowedSchemes:['http','https','data','mailto','tel']});
}catch(_){}

/* helpers */
const parseFee = (fee, nego, prodOnly) => {
  if (prodOnly) return { fee:null, feeNegotiable:false, productOnly:true };
  if (nego) return { fee:null, feeNegotiable:true, productOnly:false };
  const n = fee==null ? null : Number(String(fee).replace(/[^\d.-]/g,''));
  return { fee: Number.isFinite(n)?n:null, feeNegotiable:false, productOnly:false };
};

/* DTO */
const toDTO = (o) => {
  const p = o.product || {};
  return {
    id: String(o._id || o.id),
    type: o.type, status: o.status,
    title: o.title, brandName: o.brandName,
    descriptionHTML: o.descriptionHTML || '',
    fee: o.fee ?? null, feeNegotiable: !!o.feeNegotiable, productOnly: !!o.productOnly,
    closeAt: o.closeAt || null,
    product: { name:p.name||'', url:p.url||'', thumb:p.thumb||'', price:p.price??null },
    createdAt: o.createdAt, updatedAt: o.updatedAt
  };
};

/* Create (brand/admin only) */
router.post('/',
  auth, requireRole('brand','admin'),
  body('title').isString().isLength({min:1}),
  body('brandName').isString().isLength({min:1}),
  body('type').isIn(['delivery_keep','delivery_return','experience_review']),
  body('closeAt').optional().isISO8601(),
  async (req,res)=>{
    const v = validationResult(req);
    if(!v.isEmpty()) return fail(res,'VALIDATION_FAILED','VALIDATION_FAILED',422,{errors:v.array()});
    try{
      const feeParse = parseFee(req.body.fee, req.body.feeNegotiable, req.body.productOnly);
      const payload = {
        type: req.body.type,
        status: 'open',
        title: String(req.body.title).trim(),
        brandName: String(req.body.brandName).trim(),
        descriptionHTML: sanitize(req.body.descriptionHTML||''),
        ...feeParse,
        closeAt: req.body.closeAt ? new Date(req.body.closeAt) : undefined,
        product: req.body.product || undefined,
        createdBy: req.user.id
      };
      const created = await Sponsorship.create(payload);
      return ok(res, { data: toDTO(created) }, 201);
    }catch(err){
      console.error('[sponsorship:create]', err);
      return fail(res,'CREATE_FAILED', err.message||'CREATE_FAILED', 500);
    }
  }
);

/* List */
router.get('/',
  query('type').optional().isIn(['delivery_keep','delivery_return','experience_review']),
  query('status').optional().isIn(['open','in_progress','closed','completed']),
  query('page').optional().isInt({min:1}).toInt(),
  query('limit').optional().isInt({min:1,max:50}).toInt(),
  async (req,res)=>{
    try{
      const page = req.query.page || 1;
      const limit = req.query.limit || 20;
      const q = {};
      if (req.query.type) q.type = req.query.type;
      if (req.query.status) q.status = req.query.status;

      const [docs,total] = await Promise.all([
        Sponsorship.find(q).sort({ createdAt:-1 }).skip((page-1)*limit).limit(limit),
        Sponsorship.countDocuments(q)
      ]);

      return ok(res, { items: docs.map(toDTO), page, limit, total, totalPages: Math.ceil(total/limit) });
    }catch(err){
      console.error('[sponsorship:list]', err);
      return fail(res,'LIST_FAILED', err.message||'LIST_FAILED', 500);
    }
  }
);

/* Read */
router.get('/:id',
  param('id').isString(),
  async (req,res)=>{
    const { id } = req.params;
    if(!mongoose.isValidObjectId(id)) return fail(res,'INVALID_ID','INVALID_ID',400);
    try{
      const doc = await Sponsorship.findById(id);
      if(!doc) return fail(res,'NOT_FOUND','NOT_FOUND',404);
      return ok(res, { data: toDTO(doc) });
    }catch(err){
      console.error('[sponsorship:read]', err);
      return fail(res,'READ_FAILED', err.message||'READ_FAILED', 500);
    }
  }
);

/* Update (owner) */
router.put('/:id',
  auth, requireRole('brand','admin'),
  param('id').isString(),
  async (req,res)=>{
    const { id } = req.params;
    if(!mongoose.isValidObjectId(id)) return fail(res,'INVALID_ID','INVALID_ID',400);
    try{
      const $set = { ...req.body };
      if ($set.descriptionHTML) $set.descriptionHTML = sanitize($set.descriptionHTML);
      if ('fee' in $set || 'feeNegotiable' in $set || 'productOnly' in $set) {
        Object.assign($set, parseFee($set.fee, $set.feeNegotiable, $set.productOnly));
      }
      const updated = await Sponsorship.findOneAndUpdate({ _id:id, createdBy:req.user.id }, { $set }, { new:true });
      if(!updated) return fail(res,'FORBIDDEN','FORBIDDEN',403);
      return ok(res, { data: toDTO(updated) });
    }catch(err){
      console.error('[sponsorship:update]', err);
      return fail(res,'UPDATE_FAILED', err.message||'UPDATE_FAILED', 500);
    }
  }
);

/* Status change (owner) */
router.patch('/:id/status',
  auth, requireRole('brand','admin'),
  param('id').isString(),
  body('status').isIn(['open','in_progress','closed','completed']),
  async (req,res)=>{
    const v = validationResult(req);
    if(!v.isEmpty()) return fail(res,'VALIDATION_FAILED','VALIDATION_FAILED',422,{errors:v.array()});
    const { id } = req.params;
    if(!mongoose.isValidObjectId(id)) return fail(res,'INVALID_ID','INVALID_ID',400);
    try{
      const doc = await Sponsorship.findOneAndUpdate(
        { _id:id, createdBy:req.user.id },
        { $set:{ status:req.body.status } },
        { new:true }
      );
      if(!doc) return fail(res,'FORBIDDEN','FORBIDDEN',403);
      return ok(res, { data: toDTO(doc) });
    }catch(err){
      console.error('[sponsorship:status]', err);
      return fail(res,'UPDATE_FAILED', err.message||'UPDATE_FAILED', 500);
    }
  }
);

module.exports = router;