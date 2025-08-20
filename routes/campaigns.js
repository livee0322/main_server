// /routes/campaigns.js
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

/* Mine (내가 만든 캠페인) */
router.get('/mine', auth, requireRole('brand','admin'), async (req, res) => {
  const docs = await Campaign.find({ createdBy: req.user.id }).sort({ createdAt:-1 });
  return res.ok({ items: docs.map(toDTO) });
});

/* Read (인증 필수로 변경) */
router.get('/:id', auth, async (req, res) => {     // ✅ auth 추가
  const c = await Campaign.findById(req.params.id);
  if (!c) return res.fail('NOT_FOUND','NOT_FOUND',404);

  const isOwner = req.user && String(c.createdBy) === req.user.id;
  if (!isOwner && c.status !== 'published') {
    return res.fail('FORBIDDEN','FORBIDDEN',403);
  }
  return res.ok({ data: toDTO(c) });
});

/* Update */
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

/* Delete */
router.delete('/:id', auth, requireRole('brand','admin'), async (req, res) => {
  const removed = await Campaign.findOneAndDelete({ _id: req.params.id, createdBy: req.user.id });
  if (!removed) return res.fail('NOT_FOUND_OR_FORBIDDEN','RECRUIT_FORBIDDEN_DELETE',403);
  return res.ok({ message:'삭제 완료' });
});

module.exports = router;