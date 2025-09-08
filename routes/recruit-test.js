// routes/recruit-test.js — v2.6.1 (brand/fee 호환 확장)
'use strict';
const router = require('express').Router();
const { body, query, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const Campaign = require('../models/Campaign');
const auth = require('../src/middleware/auth');
const requireRole = require('../src/middleware/requireRole');

const ok = (res, payload, status=200)=>
  typeof res.ok==='function'?res.ok(payload,status):res.status(status).json(payload);
const fail = (res, code, message, status=400, extra={}) =>
  typeof res.fail==='function'?res.fail(code,message,status,extra):res.status(status).json({ ok:false, code, message, ...extra });

let sanitize = (html='')=>String(html||'');
try{ const sh=require('sanitize-html');
  sanitize=(html='')=>sh(html||'',{allowedTags:sh.defaults.allowedTags.concat(['img','h1','h2','u','span','figure','figcaption']),
  allowedAttributes:{'*':['style','class','id','src','href','alt','title']},allowedSchemes:['http','https','data','mailto','tel']}); }catch{}

const truthy=v=> (v===true||v==='true'||v==='1'||v===1||v==='협의');

function pickBrand(o={}){
  const cands=[ o.brandName, o.brandname, o.recruit?.brandName, o.recruit?.brandname, o.brand?.brandName, o.brand?.name, o.brand,
                o.owner?.brandName, o.owner?.name, o.user?.companyName, o.user?.brandName ];
  const v=cands.find(v=>v!=null && String(v).trim()!=='');
  return v?String(v).trim():'';
}

function parsePay(o={}){
  // ★ fee/feeNegotiable(최상위) + 레거시 키 모두 지원
  const rawCand=[o.fee, o.recruit?.pay, o.pay, o.recruit?.payment, o.payment, o.recruit?.payAmount, o.payAmount, o.recruit?.price, o.price];
  const raw=rawCand.find(v=>v!=null && String(v).trim()!=='');
  const negoCand=[o.feeNegotiable, o.recruit?.payNegotiable, o.payNegotiable, o.recruit?.negotiable, o.negotiable];
  const payNegotiable = truthy(negoCand.find(v=>v!==undefined) ?? false);
  if (typeof raw==='string' && /협의|미정/i.test(raw)) return { pay:null, payNegotiable:true };
  const num = raw==null ? null : Number(String(raw).replace(/[^\d.-]/g,''));
  return { pay:(Number.isFinite(num)&&num>0)?num:null, payNegotiable };
}

const toThumb=url=>{ try{ if(!url||!/\/upload\//.test(url)) return url;
  const i=url.indexOf('/upload/'); return url.slice(0,i+8)+'c_fill,g_auto,w_640,h_360,f_auto,q_auto/'+url.slice(i+8); }catch{ return url; } };

function toDTO(doc){
  const o=typeof doc.toObject==='function'?doc.toObject():doc;
  const brandName=pickBrand(o);
  const { pay, payNegotiable }=parsePay(o);
  const coverImageUrl=o.coverImageUrl||o.imageUrl||'';
  const thumbnailUrl=o.thumbnailUrl||(coverImageUrl?toThumb(coverImageUrl):'');
  return {
    id:String(o._id||o.id||''),
    type:'recruit',
    status:o.status||'draft',
    title:o.title||'',
    brandName,
    coverImageUrl,
    thumbnailUrl,
    closeAt:o.closeAt||o.recruit?.closeAt||o.deadline||null,
    descriptionHTML:o.descriptionHTML||'',
    recruit:{
      brandName,
      location:o.recruit?.location||o.location||'',
      shootDate:o.recruit?.shootDate||o.shootDate||null,
      shootTime:o.recruit?.shootTime||o.shootTime||'',
      pay, payNegotiable,
      requirements:o.recruit?.requirements||o.requirements||''
    },
    createdAt:o.createdAt, updatedAt:o.updatedAt
  };
}

/* Create */
router.post('/', auth, requireRole('brand','admin'),
  body('title').isLength({min:1}),
  body('recruit.shootDate').exists(),
  body('recruit.shootTime').isString().isLength({min:1}),
  async (req,res)=>{
    const errors=validationResult(req);
    if(!errors.isEmpty()) return fail(res,'VALIDATION_FAILED','VALIDATION_FAILED',422,{errors:errors.array()});
    try{
      const payload={...req.body, type:'recruit', status:req.body.status||'draft', createdBy:req.user.id};
      if(payload.descriptionHTML) payload.descriptionHTML=sanitize(payload.descriptionHTML);
      const brandName = pickBrand(payload) || String(payload.brandName||'').trim();
      if(brandName){ payload.brandName=brandName; payload.recruit={...(payload.recruit||{}), brandName}; }
      if(payload.coverImageUrl && !payload.thumbnailUrl) payload.thumbnailUrl=toThumb(payload.coverImageUrl);
      if(payload.recruit?.shootDate){ const d=new Date(payload.recruit.shootDate); if(!isNaN(d)) payload.recruit.shootDate=d; }
      if(payload.closeAt){ const c=new Date(payload.closeAt); if(!isNaN(c)) payload.closeAt=c; }

      // ★ 상·하위 동시 저장(서로 다른 모델과도 호환)
      const { pay, payNegotiable } = parsePay(payload);
      if (pay != null) payload.fee = pay;
      if (payNegotiable != null) payload.feeNegotiable = payNegotiable;

      const created=await Campaign.create(payload);
      return ok(res,{ data: toDTO(created) },201);
    }catch(err){ console.error('[recruit-test:create]',err); return fail(res,'CREATE_FAILED',err.message||'CREATE_FAILED',500); }
  });

/* List */
router.get('/', query('status').optional().isIn(['draft','scheduled','published','closed']),
  async (req,res)=>{
    try{
      const page=Math.max(parseInt(req.query.page||'1',10),1);
      const limit=Math.min(Math.max(parseInt(req.query.limit||'20',10),1),50);
      const q={ type:'recruit' };
      if(req.query.status) q.status=req.query.status;
      if(req.query.q) q.title={ $regex:String(req.query.q), $options:'i' };
      const [docs,total]=await Promise.all([
        Campaign.find(q).sort({createdAt:-1}).skip((page-1)*limit).limit(limit),
        Campaign.countDocuments(q)
      ]);
      return ok(res,{ items: docs.map(toDTO), page, limit, total, totalPages: Math.ceil(total/limit) });
    }catch(err){ console.error('[recruit-test:list]',err); return fail(res,'LIST_FAILED',err.message||'LIST_FAILED',500); }
  });

/* Read / Update / Delete 동일 (생략 없이 유지) */
router.get('/:id', auth, async (req,res)=>{
  const { id }=req.params;
  if(!mongoose.isValidObjectId(id)) return fail(res,'INVALID_ID','INVALID_ID',400);
  try{
    const doc=await Campaign.findById(id);
    if(!doc) return fail(res,'NOT_FOUND','NOT_FOUND',404);
    const isOwner=req.user && String(doc.createdBy)===req.user.id;
    if(!isOwner && doc.status!=='published') return fail(res,'FORBIDDEN','FORBIDDEN',403);
    return ok(res,{ data: toDTO(doc) });
  }catch(err){ console.error('[recruit-test:read]',err); return fail(res,'READ_FAILED',err.message||'READ_FAILED',500); }
});

router.put('/:id', auth, requireRole('brand','admin','showhost'), async (req,res)=>{
  const { id }=req.params;
  if(!mongoose.isValidObjectId(id)) return fail(res,'INVALID_ID','INVALID_ID',400);
  try{
    const $set={...req.body};
    if($set.descriptionHTML) $set.descriptionHTML=sanitize($set.descriptionHTML);
    const brandName=pickBrand($set); if(brandName){ $set.brandName=brandName; $set.recruit={...($set.recruit||{}),brandName}; }
    if($set.coverImageUrl && !$set.thumbnailUrl) $set.thumbnailUrl=toThumb($set.coverImageUrl);
    if($set.recruit?.shootDate){ const d=new Date($set.recruit.shootDate); if(!isNaN(d)) $set.recruit.shootDate=d; }
    if($set.closeAt){ const c=new Date($set.closeAt); if(!isNaN(c)) $set.closeAt=c; }

    const { pay, payNegotiable } = parsePay($set);
    if (pay != null) $set.fee = pay;
    if (payNegotiable != null) $set.feeNegotiable = payNegotiable;

    const updated=await Campaign.findOneAndUpdate({ _id:id, createdBy:req.user.id },{ $set },{ new:true });
    if(!updated) return fail(res,'RECRUIT_FORBIDDEN_EDIT','RECRUIT_FORBIDDEN_EDIT',403);
    return ok(res,{ data: toDTO(updated) });
  }catch(err){ console.error('[recruit-test:update]',err); return fail(res,'UPDATE_FAILED',err.message||'UPDATE_FAILED',500); }
});

router.delete('/:id', auth, requireRole('brand','admin','showhost'), async (req,res)=>{
  const { id }=req.params;
  if(!mongoose.isValidObjectId(id)) return fail(res,'INVALID_ID','INVALID_ID',400);
  try{
    const removed=await Campaign.findOneAndDelete({ _id:id, createdBy:req.user.id });
    if(!removed) return fail(res,'RECRUIT_FORBIDDEN_DELETE','RECRUIT_FORBIDDEN_DELETE',403);
    return ok(res,{ message:'삭제 완료' });
  }catch(err){ console.error('[recruit-test:delete]',err); return fail(res,'DELETE_FAILED',err.message||'DELETE_FAILED',500); }
});

module.exports = router;