// /routes/campaigns.js
const router = require('express').Router();
const { body, query, validationResult } = require('express-validator');
const sanitizeHtml = require('sanitize-html');
const mongoose = require('mongoose');                 // ✅ 추가
const Campaign = require('../models/Campaign');
const auth = require('../src/middleware/auth');
const requireRole = require('../src/middleware/requireRole');

const THUMB = process.env.CLOUDINARY_THUMB || 'c_fill,g_auto,w_640,h_360,f_auto,q_auto';
const toThumb = (url='') => {
  try { const [h,t]=String(url).split('/upload/'); return t ? `${h}/upload/${THUMB}/${t}` : url; }
  catch { return url; }
};

const toDTO = (doc) => {
  const o = (doc?.toObject ? doc.toObject() : doc) || {};
  const imageUrl = o.coverImageUrl || o.thumbnailUrl || '';
  const thumbnailUrl = o.thumbnailUrl || toThumb(imageUrl) || '';
  return { ...o, imageUrl, thumbnailUrl, id: o._id?.toString?.() || o.id };
};

const sanitize = (html) =>
  sanitizeHtml(html || '', {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img','h1','h2','u','span','figure','figcaption']),
    allowedAttributes: { '*': ['style','class','id','src','href','alt','title'] },
    allowedSchemes: ['http','https','data','mailto','tel'],
  });

/* -------------------------------
 * ✅ META (항상 :id 보다 위에!)
 * ----------------------------- */
router.get('/meta', async (req, res) => {
  // 고정 카테고리(필요시 .env/DB로 대체)
  const productCats = ['뷰티','가전','음식','패션','리빙','생활','디지털'];
  const recruitCats = ['뷰티','가전','음식','패션','리빙','일반'];

  // 간단 브랜드 집계(선택)
  const brands = await Campaign.aggregate([
    { $match: { brand: { $exists: true, $ne: '' } } },
    { $group: { _id: '$brand', count: { $sum: 1 } } },
    { $project: { _id: 0, name: '$_id', count: 1 } },
    { $sort: { count: -1, name: 1 } },
    { $limit: 50 },
  ]).catch(() => []);

  return res.ok({
    data: {
      categories: { product: productCats, recruit: recruitCats },
      brands,
      updatedAt: new Date().toISOString(),
    }
  });
});

/* Create */
router.post('/',
  auth, requireRole('brand','admin'),
  body('type').isIn(['product','recruit']),
  body('title').isLength({min:1}),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.fail('VALIDATION_FAILED','VALIDATION_FAILED',422,{errors:errors.array()});

    const payload = { ...req.body, createdBy: req.user.id };
    if (payload.coverImageUrl && !payload.thumbnailUrl)
      payload.thumbnailUrl = toThumb(payload.coverImageUrl);
    if (payload.descriptionHTML)
      payload.descriptionHTML = sanitize(payload.descriptionHTML);

    const created = await Campaign.create(payload);
    return res.ok({ data: toDTO(created) }, 201);
  }
);

/* List */
router.get('/',
  query('type').optional().isIn(['product','recruit']),
  query('status').optional().isIn(['draft','scheduled','published','closed']),
  // recruit 전용 쿼리: today / dateFrom / dateTo / timeFrom / timeTo / sort
  query('today').optional().isIn(['0','1','true','false']),
  query('dateFrom').optional().isString(),
  query('dateTo').optional().isString(),
  query('timeFrom').optional().isString(),
  query('timeTo').optional().isString(),
  query('sort').optional().isIn(['latest','schedule','soon']),
  async (req, res) => {
    const page  = Math.max(parseInt(req.query.page||'1'),1);
    const limit = Math.min(parseInt(req.query.limit||'20'), 50);

    const q = {};
    if (req.query.type)   q.type = req.query.type;
    if (req.query.status) q.status = req.query.status;
    if (req.query.q)      q.title = { $regex: String(req.query.q), $options: 'i' };

    // ---------- recruit 전용 필터 ----------
    const isRecruit = req.query.type === 'recruit';
    if (isRecruit) {
      const todayOnly = ['1','true'].includes(String(req.query.today||'0').toLowerCase());
      const dateFrom  = (req.query.dateFrom || '').trim();
      const dateTo    = (req.query.dateTo   || '').trim();
      const timeFrom  = (req.query.timeFrom || '').trim();
      const timeTo    = (req.query.timeTo   || '').trim();

      // 날짜 범위 (문자열 비교 안전: YYYY-MM-DD)
      const dateCond = {};
      if (todayOnly) {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth()+1).padStart(2,'0');
        const d = String(now.getDate()).padStart(2,'0');
        const ymd = `${y}-${m}-${d}`;
        dateCond.$gte = ymd; dateCond.$lte = ymd;
      } else {
        if (dateFrom) dateCond.$gte = dateFrom;
        if (dateTo)   dateCond.$lte = dateTo;
      }
      if (Object.keys(dateCond).length) q['recruit.date'] = dateCond;

      // 시간 범위 (문자열 비교 안전: HH:mm)
      const timeCond = {};
      if (timeFrom) timeCond.$gte = timeFrom;
      if (timeTo)   timeCond.$lte = timeTo;
      if (Object.keys(timeCond).length) q['recruit.timeStart'] = timeCond;
    }

    // ---------- 정렬 ----------
    // 기본: 최신순
    let sort = { createdAt: -1 };
    // schedule/soon: 스케줄 가까운 순(날짜 오름차, 시간 오름차)
    if (isRecruit && (req.query.sort === 'schedule' || req.query.sort === 'soon')) {
      sort = { 'recruit.date': 1, 'recruit.timeStart': 1, createdAt: -1 };
    } else if (req.query.sort === 'latest') {
      sort = { createdAt: -1 };
    }

    const [items,total] = await Promise.all([
      Campaign.find(q).sort(sort).skip((page-1)*limit).limit(limit),
      Campaign.countDocuments(q),
    ]);

    return res.ok({
      items: items.map(toDTO),
      page, limit, total, totalPages: Math.ceil(total/limit)
    });
  }
);

/* Mine (내가 만든 캠페인) */
router.get('/mine', auth, requireRole('brand','admin'), async (req, res) => {
  const docs = await Campaign.find({ createdBy: req.user.id }).sort({ createdAt:-1 });
  return res.ok({ items: docs.map(toDTO) });
});

/* Read (인증 필수)
 * ✅ ObjectId 검증 추가하여 'meta' 같은 문자열이 여기로 들어오지 않게 함
 */
router.get('/:id', auth, async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.fail('INVALID_ID','INVALID_ID',400);
  }
  const c = await Campaign.findById(id);
  if (!c) return res.fail('NOT_FOUND','NOT_FOUND',404);

  const isOwner = req.user && String(c.createdBy) === req.user.id;
  if (!isOwner && c.status !== 'published') {
    return res.fail('FORBIDDEN','FORBIDDEN',403);
  }
  return res.ok({ data: toDTO(c) });
});

/* Update */
router.put('/:id', auth, requireRole('brand','admin'), async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.fail('INVALID_ID','INVALID_ID',400);

  const $set = { ...req.body };
  if ($set.coverImageUrl && !$set.thumbnailUrl) $set.thumbnailUrl = toThumb($set.coverImageUrl);
  if ($set.descriptionHTML) $set.descriptionHTML = sanitize($set.descriptionHTML);

  const updated = await Campaign.findOneAndUpdate(
    { _id: id, createdBy: req.user.id },
    { $set }, { new:true }
  );
  if (!updated) return res.fail('REJECTED','RECRUIT_FORBIDDEN_EDIT',403);
  return res.ok({ data: toDTO(updated) });
});

/* Delete */
router.delete('/:id', auth, requireRole('brand','admin'), async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.fail('INVALID_ID','INVALID_ID',400);

  const removed = await Campaign.findOneAndDelete({ _id: id, createdBy: req.user.id });
  if (!removed) return res.fail('NOT_FOUND_OR_FORBIDDEN','RECRUIT_FORBIDDEN_DELETE',403);
  return res.ok({ message:'삭제 완료' });
});

module.exports = router;