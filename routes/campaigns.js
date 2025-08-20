// /// /routes/campaigns.js
const router = require('express').Router();
const { body, query, validationResult } = require('express-validator');
const sanitizeHtml = require('sanitize-html');
const Campaign = require('../models/Campaign');
const auth = require('../src/middleware/auth');           // ✅ 인증
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

/* ---------------------------------------
 * Create
 * ------------------------------------- */
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

/* ---------------------------------------
 * List
 * ------------------------------------- */
router.get('/',
  query('type').optional().isIn(['product','recruit']),
  query('status').optional().isIn(['draft','scheduled','published','closed']),
  async (req, res) => {
    const page  = Math.max(parseInt(req.query.page||'1'),1);
    const limit = Math.min(parseInt(req.query.limit||'20'), 50);
    const q = {};
    if (req.query.type) q.type = req.query.type;
    if (req.query.status) q.status = req.query.status;
    if (req.query.q) q.title = { $regex: String(req.query.q), $options: 'i' };

    const [items,total] = await Promise.all([
      Campaign.find(q).sort({ createdAt:-1 }).skip((page-1)*limit).limit(limit),
      Campaign.countDocuments(q),
    ]);
    return res.ok({ items: items.map(toDTO), page, limit, total, totalPages: Math.ceil(total/limit) });
  }
);

/* ---------------------------------------
 * Mine (내가 만든 캠페인)
 * ------------------------------------- */
router.get('/mine', auth, requireRole('brand','admin'), async (req, res) => {
  const docs = await Campaign.find({ createdBy: req.user.id }).sort({ createdAt:-1 });
  return res.ok({ items: docs.map(toDTO) });
});

/* ---------------------------------------
 * Read (인증 필요)
 * ------------------------------------- */
router.get('/:id', auth, async (req, res) => {
  const c = await Campaign.findById(req.params.id);
  if (!c) return res.fail('NOT_FOUND','NOT_FOUND',404);

  const isOwner = req.user && String(c.createdBy) === req.user.id;
  if (!isOwner && c.status !== 'published') {
    return res.fail('FORBIDDEN','FORBIDDEN',403);
  }
  return res.ok({ data: toDTO(c) });
});

/* ---------------------------------------
 * Update
 * ------------------------------------- */
router.put('/:id', auth, requireRole('brand','admin'), async (req, res) => {
  const $set = { ...req.body };
  if ($set.coverImageUrl && !$set.thumbnailUrl) $set.thumbnailUrl = toThumb($set.coverImageUrl);
  if ($set.descriptionHTML) $set.descriptionHTML = sanitize($set.descriptionHTML);

  const updated = await Campaign.findOneAndUpdate(
    { _id: req.params.id, createdBy: req.user.id },
    { $set }, { new:true }
  );
  if (!updated) return res.fail('REJECTED','RECRUIT_FORBIDDEN_EDIT',403);
  return res.ok({ data: toDTO(updated) });
});

/* ---------------------------------------
 * Delete
 * ------------------------------------- */
router.delete('/:id', auth, requireRole('brand','admin'), async (req, res) => {
  const removed = await Campaign.findOneAndDelete({ _id: req.params.id, createdBy: req.user.id });
  if (!removed) return res.fail('NOT_FOUND_OR_FORBIDDEN','RECRUIT_FORBIDDEN_DELETE',403);
  return res.ok({ message:'삭제 완료' });
});

/* ========================================================================
 * 🔽 메타 엔드포인트 (카테고리/브랜드) — meta.js 없이 campaigns.js에 추가
 * ====================================================================== */

/**
 * 기본 카테고리(환경변수로 덮어쓰기 가능)
 * - PRODUCT_CATEGORIES="뷰티,패션,가전,식품,생활,디지털,스포츠,반려"
 * - RECRUIT_CATEGORIES="뷰티,패션,가전,식품,리빙,유아,헬스,취미"
 */
const DEFAULT_PRODUCT_CATEGORIES = (process.env.PRODUCT_CATEGORIES || '뷰티,가전,식품,패션,생활,디지털,스포츠,반려')
  .split(',').map(s=>s.trim()).filter(Boolean);
const DEFAULT_RECRUIT_CATEGORIES  = (process.env.RECRUIT_CATEGORIES || '뷰티,가전,식품,리빙,유아,헬스,취미,패션')
  .split(',').map(s=>s.trim()).filter(Boolean);

/** 헬퍼: DB에서 distinct + count 집계 */
async function distinctCounts(paths = []) {
  // paths: 예) ['brand', 'recruit.brand']
  const or = paths.map(p => ({ [p]: { $exists:true, $ne:null } }));
  const pipeline = [
    { $match: { $or: or } },
    { $project: {
        v: {
          $trim: {
            input: { $toString:
              { $ifNull: paths.slice(1).reduce((acc,p)=>({ $ifNull:[acc, `$${p}`] }), `$${paths[0]}`), '' }
            }
          }
        }
      }
    },
    { $match: { v: { $ne: '' } } },
    { $group: { _id: { $toLower:'$v' }, name: { $first:'$v' }, count: { $sum:1 } } },
    { $sort: { count:-1, name:1 } },
    { $limit: 100 }
  ];
  return Campaign.aggregate(pipeline);
}

/** GET /campaigns/meta  → 양쪽 카테고리 + 인기 브랜드(최대 50) 한 번에 */
router.get('/meta', async (req, res) => {
  const [brandAgg, prodCatAgg, recCatAgg] = await Promise.all([
    distinctCounts(['brand','recruit.brand']),
    distinctCounts(['category']),
    distinctCounts(['recruit.category'])
  ]);

  // DB에 저장된 카테고리 + 기본 카테고리 병합(중복 제거)
  const uniq = (arr) => Array.from(new Map(arr.map(n => [String(n).toLowerCase(), String(n)])).values());
  const prodCats = uniq([...DEFAULT_PRODUCT_CATEGORIES, ...prodCatAgg.map(x=>x.name)]);
  const recCats  = uniq([...DEFAULT_RECRUIT_CATEGORIES,  ...recCatAgg.map(x=>x.name)]);

  return res.ok({
    data: {
      categories: { product: prodCats, recruit: recCats },
      brands: brandAgg.slice(0,50).map(b => ({ name:b.name, count:b.count })),
    }
  });
});

/** GET /campaigns/meta/categories?type=product|recruit  */
router.get('/meta/categories', async (req, res) => {
  const type = (req.query.type || '').toLowerCase();
  const [prodCatAgg, recCatAgg] = await Promise.all([
    distinctCounts(['category']),
    distinctCounts(['recruit.category'])
  ]);
  const uniq = (arr) => Array.from(new Map(arr.map(n => [String(n).toLowerCase(), String(n)])).values());
  const prodCats = uniq([...DEFAULT_PRODUCT_CATEGORIES, ...prodCatAgg.map(x=>x.name)]);
  const recCats  = uniq([...DEFAULT_RECRUIT_CATEGORIES,  ...recCatAgg.map(x=>x.name)]);

  const data = type === 'product' ? prodCats
             : type === 'recruit' ? recCats
             : { product: prodCats, recruit: recCats };

  return res.ok({ data });
});

/** GET /campaigns/meta/brands?q=검색어  → 최근 캠페인에서 추출한 브랜드 */
router.get('/meta/brands', async (req, res) => {
  const q = (req.query.q || '').trim().toLowerCase();
  const agg = await distinctCounts(['brand','recruit.brand']); // name,count
  let list = agg.map(x => ({ name:x.name, count:x.count }));
  if (q) list = list.filter(b => b.name.toLowerCase().includes(q));
  return res.ok({ data: list.slice(0,50) });
});

module.exports = router;