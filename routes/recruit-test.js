// routes/recruit-test.js — v3.2.0
// (recruit-test 전용, 세로커버/상품칩 DTO 고정 반영)
'use strict';

const router = require('express').Router();
const { body, query, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const Recruit = require('../models/Recruit-test');   // ★ 단일 모델만 사용
const auth = require('../src/middleware/auth');
const requireRole = require('../src/middleware/requireRole');

/* ---------- response helpers ---------- */
const ok   = (res, payload, status=200)=>
  (typeof res.ok==='function' ? res.ok(payload,status) : res.status(status).json(payload));
const fail = (res, code, message, status=400, extra={}) =>
  (typeof res.fail==='function' ? res.fail(code,message,status,extra)
                                : res.status(status).json({ ok:false, code, message, ...extra }));

/* ---------- sanitize ---------- */
let sanitize = (html='')=>String(html||'');
try{
  const sh=require('sanitize-html');
  sanitize=(html='')=>sh(html||'',{
    allowedTags: sh.defaults.allowedTags.concat(['img','h1','h2','u','span','figure','figcaption']),
    allowedAttributes: {'*':['style','class','id','src','href','alt','title']},
    allowedSchemes: ['http','https','data','mailto','tel']
  });
}catch{ /* optional */ }

/* ---------- helpers ---------- */
const truthy=v=> (v===true||v==='true'||v==='1'||v===1||v==='협의');

function pickBrand(o={}){
  const c=[o.brandName, o.recruit?.brandName, o.brand?.name, o.brand, o.owner?.brandName, o.user?.brandName, o.user?.companyName];
  const v=c.find(x=>x!=null && String(x).trim()!=='');
  return v?String(v).trim():'';
}

function parsePay(o={}){
  const rawCand=[o.fee, o.recruit?.pay, o.pay, o.recruit?.price];
  const raw=rawCand.find(v=>v!=null && String(v).trim()!=='');
  const negoCand=[o.feeNegotiable, o.recruit?.payNegotiable, o.negotiable];
  const payNegotiable = truthy(negoCand.find(v=>v!==undefined) ?? false);
  if (typeof raw==='string' && /협의|미정/i.test(raw)) return { pay:null, payNegotiable:true };
  const num = raw==null ? null : Number(String(raw).replace(/[^\d.-]/g,''));
  return { pay:(Number.isFinite(num)&&num>0)?num:null, payNegotiable };
}

/* Cloudinary 16:9 변환(카드용 썸네일) */
const toThumb169=url=>{ try{
  if(!url || !/\/upload\//.test(url)) return url;
  const i=url.indexOf('/upload/');
  return url.slice(0,i+8) + 'c_fill,g_auto,w_640,h_360,f_auto,q_auto/' + url.slice(i+8);
}catch{ return url; }};

/* ---------- DTO ---------- */
function toDTO(doc){
  const o = (typeof doc.toObject==='function' ? doc.toObject() : doc) || {};

  const brandName = pickBrand(o);

  const coverImageUrl    = o.coverImageUrl || '';
  const thumbnailUrl     = o.thumbnailUrl || (coverImageUrl ? toThumb169(coverImageUrl) : '');

  // 원본 products
  const rawProducts = Array.isArray(o.products) ? o.products : [];

  // 라이브/상품 판별 규칙
  const isLive = p =>
    String(p?.title||'').trim() === '쇼핑라이브' || /type=live/i.test(p?.detailHtml || '');
  const isProduct = p =>
    /type=product/i.test(p?.detailHtml || '') ||
    (p?.marketplace && p.marketplace !== 'etc') ||
    String(p?.title||'').trim() !== '쇼핑라이브';

  // 대표 라이브/상품 추출
  const liveItem  = rawProducts.find(isLive);
  const prodItem  = rawProducts.find(isProduct) || rawProducts.find(p => p && (p.imageUrl || p.title));

  // 프론트 보조 필드
  const verticalCoverUrl = o.verticalCoverUrl || o.coverVerticalUrl || (liveItem?.imageUrl || '');
  const liveLink         = o.liveLink || liveItem?.url || '';

  const firstProductTitle = prodItem?.title    || '';
  const firstProductImage = prodItem?.imageUrl || '';

  // 안전 필드로 매핑해 노출
  const products = rawProducts.map(p => ({
    id:         String(p?._id || ''),
    title:      p?.title || '',
    url:        p?.url || '',
    imageUrl:   p?.imageUrl || '',
    marketplace:p?.marketplace || 'etc'
  }));

  // pay 동기화
  const pay = (o.fee!=null)?o.fee : (o.recruit?.pay ?? null);
  const payNegotiable = (o.feeNegotiable!=null)?o.feeNegotiable : !!o.recruit?.payNegotiable;

  return {
    id:String(o._id || o.id || ''),
    type:'recruit',
    status:o.status || 'draft',
    title:o.title || '',
    brandName,

    // 이미지
    coverImageUrl,
    thumbnailUrl,
    verticalCoverUrl,         // ★ 세로커버(없으면 라이브 이미지)

    // 기본
    category:o.category || '',
    closeAt:o.closeAt || null,
    descriptionHTML:o.descriptionHTML || '',

    // 상품 (원본 + 카드용 보조)
    products,
    firstProductTitle,        // ★ 상품칩용
    firstProductImage,        // ★ 상품칩용

    // 쇼핑라이브 링크(선택)
    liveLink,

    // 상세/요약 공통
    recruit:{
      brandName,
      location: o.recruit?.location || o.location || '',
      shootDate: o.shootDate || o.recruit?.shootDate || null,
      shootTime: o.shootTime || o.recruit?.shootTime || '',
      requirements: o.recruit?.requirements || '',
      preferred: o.recruit?.preferred || '',
      durationHours: o.recruit?.durationHours || null,
      pay, payNegotiable
    },

    fee: pay,
    feeNegotiable: payNegotiable,
    location: o.location || '',
    shootDate: o.shootDate || null,
    shootTime: o.shootTime || '',
    createdAt: o.createdAt, updatedAt: o.updatedAt
  };
}

/* ---------- Create ---------- */
router.post('/',
  auth, requireRole('brand','admin'),
  body('title').isLength({min:1}),
  body('recruit.shootDate').exists(),
  body('recruit.shootTime').isString().isLength({min:1}),
  async (req,res)=>{
    const errors=validationResult(req);
    if(!errors.isEmpty())
      return fail(res,'VALIDATION_FAILED','VALIDATION_FAILED',422,{errors:errors.array()});

    try{
      const payload={...req.body, type:'recruit', status:req.body.status||'draft', createdBy:req.user.id};
      if(payload.descriptionHTML) payload.descriptionHTML=sanitize(payload.descriptionHTML);

      // 브랜드명 보정
      const brandName = pickBrand(payload) || String(payload.brandName||'').trim();
      if(brandName){
        payload.brandName = brandName;
        payload.recruit = { ...(payload.recruit||{}), brandName };
      }

      // 썸네일 자동
      if(payload.coverImageUrl && !payload.thumbnailUrl)
        payload.thumbnailUrl = toThumb169(payload.coverImageUrl);

      // 날짜 보정
      if(payload.recruit?.shootDate){
        const d=new Date(payload.recruit.shootDate); if(!isNaN(d)) payload.shootDate=d;
      }
      if(payload.closeAt){
        const c=new Date(payload.closeAt); if(!isNaN(c)) payload.closeAt=c;
      }

      // pay → fee 동기화
      const { pay, payNegotiable } = parsePay(payload);
      if (pay != null) payload.fee = pay;
      if (payNegotiable != null) payload.feeNegotiable = payNegotiable;

      const created=await Recruit.create(payload);
      return ok(res,{ data: toDTO(created) },201);
    }catch(err){
      console.error('[recruit-test:create]',err);
      return fail(res,'CREATE_FAILED',err.message||'CREATE_FAILED',500);
    }
  });

/* ---------- List ---------- */
router.get('/',
  query('status').optional().isIn(['draft','scheduled','published','closed']),
  async (req,res)=>{
    try{
      const page = Math.max(parseInt(req.query.page||'1',10),1);
      const limit= Math.min(Math.max(parseInt(req.query.limit||'20',10),1),50);

      const q = { type:'recruit' };
      if (req.query.status) q.status=req.query.status;
      if (req.query.q) q.title={ $regex:String(req.query.q), $options:'i' };

      const [docs,total]=await Promise.all([
        Recruit.find(q).sort({createdAt:-1}).skip((page-1)*limit).limit(limit),
        Recruit.countDocuments(q)
      ]);

      return ok(res,{
        items: docs.map(toDTO),
        page, limit, total, totalPages: Math.ceil(total/limit)
      });
    }catch(err){
      console.error('[recruit-test:list]',err);
      return fail(res,'LIST_FAILED',err.message||'LIST_FAILED',500);
    }
  });

/* ---------- Read ---------- */
router.get('/:id', auth, async (req,res)=>{
  const { id }=req.params;
  if(!mongoose.isValidObjectId(id)) return fail(res,'INVALID_ID','INVALID_ID',400);
  try{
    const doc=await Recruit.findById(id);
    if(!doc) return fail(res,'NOT_FOUND','NOT_FOUND',404);

    const isOwner = req.user && String(doc.createdBy)===req.user.id;
    if(!isOwner && doc.status!=='published') return fail(res,'FORBIDDEN','FORBIDDEN',403);

    return ok(res,{ data: toDTO(doc) });
  }catch(err){
    console.error('[recruit-test:read]',err);
    return fail(res,'READ_FAILED',err.message||'READ_FAILED',500);
  }
});

/* ---------- Update ---------- */
router.put('/:id', auth, requireRole('brand','admin','showhost'), async (req,res)=>{
  const { id }=req.params;
  if(!mongoose.isValidObjectId(id)) return fail(res,'INVALID_ID','INVALID_ID',400);

  try{
    const $set={...req.body, type:'recruit'};
    if($set.descriptionHTML) $set.descriptionHTML=sanitize($set.descriptionHTML);

    const brandName=pickBrand($set);
    if(brandName){
      $set.brandName=brandName;
      $set.recruit={...($set.recruit||{}), brandName};
    }

    if($set.coverImageUrl && !$set.thumbnailUrl)
      $set.thumbnailUrl=toThumb169($set.coverImageUrl);

    if($set.recruit?.shootDate){
      const d=new Date($set.recruit.shootDate); if(!isNaN(d)) $set.shootDate=d;
    }
    if($set.closeAt){
      const c=new Date($set.closeAt); if(!isNaN(c)) $set.closeAt=c;
    }

    const { pay, payNegotiable } = parsePay($set);
    if (pay != null) $set.fee = pay;
    if (payNegotiable != null) $set.feeNegotiable = payNegotiable;

    const updated=await Recruit.findOneAndUpdate(
      { _id:id, createdBy:req.user.id },
      { $set },
      { new:true }
    );
    if(!updated) return fail(res,'RECRUIT_FORBIDDEN_EDIT','RECRUIT_FORBIDDEN_EDIT',403);

    return ok(res,{ data: toDTO(updated) });
  }catch(err){
    console.error('[recruit-test:update]',err);
    return fail(res,'UPDATE_FAILED',err.message||'UPDATE_FAILED',500);
  }
});

/* ---------- Delete ---------- */
router.delete('/:id', auth, requireRole('brand','admin','showhost'), async (req,res)=>{
  const { id }=req.params;
  if(!mongoose.isValidObjectId(id)) return fail(res,'INVALID_ID','INVALID_ID',400);

  try{
    const removed=await Recruit.findOneAndDelete({ _id:id, createdBy:req.user.id });
    if(!removed) return fail(res,'RECRUIT_FORBIDDEN_DELETE','RECRUIT_FORBIDDEN_DELETE',403);
    return ok(res,{ message:'삭제 완료' });
  }catch(err){
    console.error('[recruit-test:delete]',err);
    return fail(res,'DELETE_FAILED',err.message||'DELETE_FAILED',500);
  }
});

module.exports = router;