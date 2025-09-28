// routes/recruit-test.js — v3.0.0 (Recruit-test 전용, DTO 일치)
'use strict';
const router = require('express').Router();
const { body, query, param, validationResult } = require('express-validator');
const mongoose = require('mongoose');

const Recruit = require('../models/Recruit-test');
const auth = require('../src/middleware/auth');
const requireRole = require('../src/middleware/requireRole');

const ok   = (res, payload, status=200)=>res.status(status).json(payload);
const fail = (res, code, message, status=400, extra={}) => res.status(status).json({ ok:false, code, message, ...extra });

/* sanitize HTML (optional dep) */
let sanitize = (html='')=>String(html||'');
try{
  const sh = require('sanitize-html');
  sanitize = (html='')=>sh(html||'',{
    allowedTags: sh.defaults.allowedTags.concat(['img','h1','h2','u','span','figure','figcaption']),
    allowedAttributes:{'*':['style','class','id','src','href','alt','title']},
    allowedSchemes:['http','https','data','mailto','tel']
  });
}catch{}

/* helpers */
const toThumb = (url)=>{
  try{
    if(!url || !/\/upload\//.test(url)) return url;
    const i=url.indexOf('/upload/');
    return url.slice(0,i+8)+'c_fill,g_auto,w_640,h_360,f_auto,q_auto/'+url.slice(i+8);
  }catch{ return url; }
};

const toDTO = (doc)=>{
  const o = typeof doc.toObject==='function' ? doc.toObject() : doc;
  return {
    id: String(o._id||o.id||''),
    type: 'recruit',
    status: o.status || 'draft',
    title: o.title || '',
    brandName: o.brandName || '',
    category: o.category || '',
    coverImageUrl: o.coverImageUrl || '',
    thumbnailUrl:  o.thumbnailUrl  || '',
    descriptionHTML: o.descriptionHTML || '',
    roles: Array.isArray(o.roles) ? o.roles : [],
    closeAt: o.closeAt || null,

    // 목록 카드가 기대하는 상위 fee/feeNegotiable
    fee: o.fee!=null ? o.fee : (o.recruit?.pay ?? null),
    feeNegotiable: (o.feeNegotiable!=null ? o.feeNegotiable : !!o.recruit?.payNegotiable),

    recruit: {
      recruitType:   o.recruit?.recruitType || 'product',
      brandName:     o.recruit?.brandName || o.brandName || '',
      location:      o.recruit?.location || '',
      shootDate:     o.recruit?.shootDate || o.shootDate || null,
      shootTime:     o.recruit?.shootTime || o.shootTime || '',
      durationHours: o.recruit?.durationHours || null,
      pay:           (o.recruit?.pay!=null ? o.recruit?.pay : o.fee ?? null),
      payNegotiable: (o.recruit?.payNegotiable!=null ? o.recruit?.payNegotiable : o.feeNegotiable ?? false),
      requirements:  o.recruit?.requirements || ''
    },
    createdAt: o.createdAt, updatedAt: o.updatedAt
  };
};

/* ---------- Create ---------- */
router.post('/',
  auth, requireRole('brand','admin'),
  body('title').isString().isLength({min:1}),
  body('recruit.shootDate').exists(),
  body('recruit.shootTime').isString().isLength({min:1}),
  async (req,res)=>{
    const v = validationResult(req);
    if(!v.isEmpty()) return fail(res,'VALIDATION_FAILED','VALIDATION_FAILED',422,{ errors:v.array() });

    try{
      const payload = { ...req.body, type:'recruit', createdBy:req.user.id };
      if (payload.descriptionHTML) payload.descriptionHTML = sanitize(payload.descriptionHTML);

      // brandName 동기화
      const brandName = (payload.brandName || payload.recruit?.brandName || '').trim();
      if (brandName) {
        payload.brandName = brandName;
        payload.recruit = { ...(payload.recruit||{}), brandName };
      }

      // 썸네일 파생
      if (payload.coverImageUrl && !payload.thumbnailUrl) {
        payload.thumbnailUrl = toThumb(payload.coverImageUrl);
      }

      // 날짜 보정
      if (payload.recruit?.shootDate) {
        const d = new Date(payload.recruit.shootDate);
        if (!isNaN(d)) payload.recruit.shootDate = d;
      }
      if (payload.closeAt) {
        const c = new Date(payload.closeAt);
        if (!isNaN(c)) payload.closeAt = c;
      }

      // 상/하위 출연료 동기화
      if (payload.recruit) {
        if (payload.recruit.pay != null) payload.fee = payload.recruit.pay;
        if (payload.recruit.payNegotiable != null) payload.feeNegotiable = !!payload.recruit.payNegotiable;
      }

      const created = await (await Recruit.create(payload)).populate();
      return ok(res, { data: toDTO(created) }, 201);
    }catch(err){
      console.error('[recruit-test:create]', err);
      return fail(res,'CREATE_FAILED',err.message||'CREATE_FAILED',500);
    }
  }
);

/* ---------- List ---------- */
router.get('/',
  query('status').optional().isIn(['draft','scheduled','published','closed']),
  query('q').optional().isString(),
  query('page').optional().isInt({min:1}).toInt(),
  query('limit').optional().isInt({min:1,max:50}).toInt(),
  async (req,res)=>{
    try{
      const page  = req.query.page  || 1;
      const limit = req.query.limit || 20;

      const q = { type:'recruit' };
      if (req.query.status) q.status = req.query.status;
      if (req.query.q) q.title = { $regex:String(req.query.q), $options:'i' };

      const [docs, total] = await Promise.all([
        Recruit.find(q).sort({ createdAt:-1 }).skip((page-1)*limit).limit(limit).lean(),
        Recruit.countDocuments(q)
      ]);
      return ok(res, { items: docs.map(toDTO), page, limit, total, totalPages: Math.ceil(total/limit) });
    }catch(err){
      console.error('[recruit-test:list]', err);
      return fail(res,'LIST_FAILED',err.message||'LIST_FAILED',500);
    }
  }
);

/* ---------- Read ---------- */
router.get('/:id',
  auth, param('id').isString(),
  async (req,res)=>{
    const { id } = req.params;
    if(!mongoose.isValidObjectId(id)) return fail(res,'INVALID_ID','INVALID_ID',400);
    try{
      const doc = await Recruit.findById(id);
      if(!doc) return fail(res,'NOT_FOUND','NOT_FOUND',404);
      // 비공개(미발행) 접근 제한
      const mine = req.user?.id;
      if (doc.status!=='published' && String(doc.createdBy)!==String(mine)) {
        return fail(res,'FORBIDDEN','FORBIDDEN',403);
      }
      return ok(res,{ data: toDTO(doc) });
    }catch(err){
      console.error('[recruit-test:read]', err);
      return fail(res,'READ_FAILED',err.message||'READ_FAILED',500);
    }
  }
);

/* ---------- Update ---------- */
router.put('/:id',
  auth, requireRole('brand','admin'),
  async (req,res)=>{
    const { id } = req.params;
    if(!mongoose.isValidObjectId(id)) return fail(res,'INVALID_ID','INVALID_ID',400);
    try{
      const $set = { ...req.body };
      if ($set.descriptionHTML) $set.descriptionHTML = sanitize($set.descriptionHTML);

      const brandName = ($set.brandName || $set.recruit?.brandName || '').trim();
      if (brandName) {
        $set.brandName = brandName;
        $set.recruit = { ...($set.recruit||{}), brandName };
      }
      if ($set.coverImageUrl && !$set.thumbnailUrl) $set.thumbnailUrl = toThumb($set.coverImageUrl);
      if ($set.recruit?.shootDate) {
        const d=new Date($set.recruit.shootDate); if(!isNaN(d)) $set.recruit.shootDate=d;
      }
      if ($set.closeAt) {
        const c=new Date($set.closeAt); if(!isNaN(c)) $set.closeAt=c;
      }
      if ($set.recruit) {
        if ($set.recruit.pay != null) $set.fee = $set.recruit.pay;
        if ($set.recruit.payNegotiable != null) $set.feeNegotiable = !!$set.recruit.payNegotiable;
      }

      const updated = await Recruit.findOneAndUpdate(
        { _id:id, createdBy:req.user.id },
        { $set },
        { new:true }
      );
      if(!updated) return fail(res,'RECRUIT_FORBIDDEN_EDIT','RECRUIT_FORBIDDEN_EDIT',403);
      return ok(res,{ data: toDTO(updated) });
    }catch(err){
      console.error('[recruit-test:update]', err);
      return fail(res,'UPDATE_FAILED',err.message||'UPDATE_FAILED',500);
    }
  }
);

/* ---------- Delete ---------- */
router.delete('/:id',
  auth, requireRole('brand','admin'),
  async (req,res)=>{
    const { id } = req.params;
    if(!mongoose.isValidObjectId(id)) return fail(res,'INVALID_ID','INVALID_ID',400);
    try{
      const removed = await Recruit.findOneAndDelete({ _id:id, createdBy:req.user.id });
      if(!removed) return fail(res,'RECRUIT_FORBIDDEN_DELETE','RECRUIT_FORBIDDEN_DELETE',403);
      return ok(res,{ message:'삭제 완료' });
    }catch(err){
      console.error('[recruit-test:delete]', err);
      return fail(res,'DELETE_FAILED',err.message||'DELETE_FAILED',500);
    }
  }
);

module.exports = router;