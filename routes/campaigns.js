// /routes/campaigns.js (Refactored - Utilities Centralized)
const router = require('express').Router();
const { body, query, validationResult } = require('express-validator');
const sanitizeHtml = require('sanitize-html');
const mongoose = require('mongoose');
const Campaign = require('../models/Campaign');
const auth = require('../src/middleware/auth');
const requireRole = require('../src/middleware/requireRole');
const { toThumb, toDTO } = require('../src/utils/common'); // 1. 공통 유틸리티 함수 불러오기

// 2. 파일 내에 중복으로 정의되어 있던 toThumb, toDTO 함수는 삭제되었습니다.

const sanitize = (html) =>
  sanitizeHtml(html || '', {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img','h1','h2','u','span','figure','figcaption']),
    allowedAttributes: { '*': ['style','class','id','src','href','alt','title'] },
    allowedSchemes: ['http','https','data','mailto','tel'],
  });

/* Meta */
router.get('/meta', async (req, res) => {
  const productCats = ['뷰티','가전','음식','패션','리빙','생활','디지털'];
  const recruitCats = ['뷰티','가전','음식','패션','리빙','일반'];
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
    // '게시' 상태로 바로 생성 시 이미지 URL 필수 검증
    if (payload.status === 'published' && !payload.coverImageUrl) {
      return res.fail('게시 상태의 캠페인에는 커버 이미지가 반드시 필요합니다.', 'COVER_IMAGE_REQUIRED', 400);
    }
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
    if (req.query.type)   q.type = req.query.type;
    if (req.query.status) q.status = req.query.status;
    if (req.query.q)      q.title = { $regex: String(req.query.q), $options: 'i' };

    let sort = { createdAt: -1 };
    
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

/* Mine */
router.get('/mine', auth, requireRole('brand','admin'), async (req, res) => {
  const docs = await Campaign.find({ createdBy: req.user.id }).sort({ createdAt:-1 });
  return res.ok({ items: docs.map(toDTO) });
});

/* Read */
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

  // '게시' 상태로 변경 시 이미지 URL 필수 검증
  if (req.body.status === 'published') {
    const campaign = await Campaign.findById(id);
    // DB에 저장된 이미지 URL도 없고, 새로 업데이트되는 값도 없을 경우 에러 처리
    if (!campaign.coverImageUrl && !req.body.coverImageUrl) {
      return res.fail('게시 상태로 변경하려면 커버 이미지가 반드시 필요합니다.', 'COVER_IMAGE_REQUIRED', 400);
    }
  }

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