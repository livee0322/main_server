'use strict';
const router = require('express').Router();
const { query, param, validationResult } = require('express-validator');
const mongoose = require('mongoose');

const auth = require('../src/middleware/auth');
const requireRole = require('../src/middleware/requireRole');
const Sponsorship = require('../models/Sponsorship-test');

// 공통 응답 헬퍼
const ok   = (res, payload, status=200)=>res.status(status).json(payload);
const fail = (res, code, message, status=400, extra={}) =>
  res.status(status).json({ ok:false, code, message, ...extra });

// 안전한 sanitize(옵션)
let sanitize = (html='')=>String(html||'');
try{
  const sh = require('sanitize-html');
  sanitize = (html='') => sh(html||'', {
    allowedTags: sh.defaults.allowedTags.concat(['img','figure','figcaption','span','u']),
    allowedAttributes: { '*':['class','style','src','href','alt','title'] },
    allowedSchemes: ['http','https','data','mailto','tel']
  });
}catch(_){}

// 유틸
const toNumber = (v)=> {
  if (v==null || v==='') return undefined;
  const n = Number(String(v).replace(/[^\d.-]/g,''));
  return Number.isFinite(n) ? n : undefined;
};
const truthy = v => (v===true || v==='true' || v==='1' || v===1);

// 유형 매핑 (한글 → 코드)
function mapType(v){
  const s = String(v||'').trim();
  if (/반납/.test(s) || /대여/.test(s)) return 'return';
  if (/후기/.test(s)) return 'review';
  if (/배송|증정/.test(s)) return 'shipping';
  if (['shipping','return','review','other'].includes(s)) return s;
  return 'shipping';
}

// DTO
function toDTO(doc){
  const o = typeof doc.toObject==='function' ? doc.toObject() : doc;
  return {
    id: String(o._id || o.id || ''),
    type: 'sponsorship',
    status: o.status || 'published',
    title: o.title || '',
    brandName: o.brandName || '',
    sponsorType: o.sponsorType || 'shipping',
    fee: o.fee ?? null,
    feeNegotiable: !!o.feeNegotiable,
    descriptionHTML: o.descriptionHTML || '',
    coverImageUrl: o.coverImageUrl || '',
    thumbnailUrl: o.thumbnailUrl || o.coverImageUrl || '',
    product: {
      name: (o.product && o.product.name) || '',
      url: (o.product && o.product.url) || '',
      imageUrl: (o.product && o.product.imageUrl) || (o.coverImageUrl || '')
    },
    createdAt: o.createdAt, updatedAt: o.updatedAt
  };
}

/* ───────────────── Create (brand/admin 전용, 검증 최소화) ───────────────── */
// “테스트 버전: 필수/형식 최소화” — 422 방지
router.post('/',
  auth, requireRole('brand','admin'),
  async (req, res) => {
    try{
      // payload 흡수형: 프런트/타 시스템 키 모두 수용
      const body = req.body || {};

      const fee = toNumber(body.fee ?? body.pay);
      const feeNegotiable = truthy(body.feeNegotiable ?? body.payNegotiable);

      const sponsorType = mapType(body.sponsorType ?? body.typeOfSponsorship ?? body.type);

      const product = {
        name: (body.product?.name ?? body.productName) || '',
        url:  (body.product?.url  ?? body.productUrl)  || '',
        imageUrl: (body.product?.imageUrl ?? body.thumbnailUrl ?? body.coverImageUrl ?? body.thumb) || ''
      };

      const payload = {
        type: 'sponsorship',
        status: body.status || 'published',
        createdBy: req.user.id,

        title: (body.title || '').trim(),
        brandName: (body.brandName || body.brand || '').trim(),

        sponsorType,
        fee, feeNegotiable,

        descriptionHTML: body.descriptionHTML ? sanitize(body.descriptionHTML) : '',

        coverImageUrl: body.coverImageUrl || product.imageUrl || '',
        thumbnailUrl:  body.thumbnailUrl  || body.coverImageUrl || product.imageUrl || '',

        product
      };

      const created = await Sponsorship.create(payload);
      return ok(res, { data: toDTO(created) }, 201);
    }catch(err){
      console.error('[sponsorship:create]', err);
      return fail(res, 'CREATE_FAILED', err.message || 'CREATE_FAILED', 500);
    }
  }
);

/* ───────────────── List ───────────────── */
// GET /sponsorship-test?status=published&page=1&limit=20
router.get('/',
  query('status').optional().isIn(['draft','published','closed']),
  query('page').optional().isInt({min:1}).toInt(),
  query('limit').optional().isInt({min:1,max:50}).toInt(),
  async (req,res)=>{
    try{
      const page  = req.query.page  || 1;
      const limit = req.query.limit || 20;
      const q = { type:'sponsorship' };
      if (req.query.status) q.status = req.query.status;

      const [docs, total] = await Promise.all([
        Sponsorship.find(q).sort({ createdAt:-1 }).skip((page-1)*limit).limit(limit).lean(),
        Sponsorship.countDocuments(q)
      ]);

      return ok(res, {
        items: docs.map(toDTO),
        page, limit, total, totalPages: Math.ceil(total/limit)
      });
    }catch(err){
      console.error('[sponsorship:list]', err);
      return fail(res, 'LIST_FAILED', err.message || 'LIST_FAILED', 500);
    }
  }
);

/* ───────────────── Read ───────────────── */
router.get('/:id',
  param('id').isString(),
  async (req,res)=>{
    const { id } = req.params;
    if(!mongoose.isValidObjectId(id)) return fail(res,'INVALID_ID','INVALID_ID',400);
    try{
      const doc = await Sponsorship.findById(id);
      if (!doc) return fail(res,'NOT_FOUND','NOT_FOUND',404);
      return ok(res, { data: toDTO(doc) });
    }catch(err){
      console.error('[sponsorship:read]', err);
      return fail(res,'READ_FAILED', err.message || 'READ_FAILED', 500);
    }
  }
);

module.exports = router;