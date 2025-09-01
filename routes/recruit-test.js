// routes/recruit-test.js
// Livee v2.5 - Recruit 전용 라우터 (프론트 recruit-new.js / main.js 와 1:1 매칭)
const router = require('express').Router();
const { body, query, validationResult } = require('express-validator');
const sanitizeHtml = require('sanitize-html');
const mongoose = require('mongoose');

const Campaign = require('../models/Campaign');
const auth = require('../src/middleware/auth');
const requireRole = require('../src/middleware/requireRole');
const { toThumb, toDTO } = require('../src/utils/common');

// html sanitize
const sanitize = (html = '') =>
  sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'h1', 'h2', 'u', 'span', 'figure', 'figcaption']),
    allowedAttributes: { '*': ['style', 'class', 'id', 'src', 'href', 'alt', 'title'] },
    allowedSchemes: ['http', 'https', 'data', 'mailto', 'tel'],
  });

// ---------- helpers ----------
const pickBrandNameFromUser = (u = {}) =>
  u.brandName || u.companyName || u.name || '브랜드';

const pickBrandNameFromDoc = (doc = {}) =>
  doc.brandName ||
  doc.brand?.name ||
  doc.owner?.brandName ||
  doc.owner?.name ||
  doc.user?.brandName ||
  doc.user?.companyName ||
  '브랜드';

const attachBrandToDTO = (doc) => {
  const dto = toDTO(doc);
  // 최우선: 문서에 저장된 brandName
  dto.brandName = pickBrandNameFromDoc(doc);
  return dto;
};

// ---------- Create ----------
router.post(
  '/',
  auth,
  requireRole('brand', 'admin'),
  body('title').isLength({ min: 1 }),
  body('recruit.shootDate').exists(),
  body('recruit.shootTime').isString().isLength({ min: 1 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.fail('VALIDATION_FAILED', 'VALIDATION_FAILED', 422, { errors: errors.array() });
    }
    try {
      const payload = { ...req.body };

      payload.type = 'recruit';
      payload.status = payload.status || 'draft';
      payload.createdBy = req.user.id;

      // ✅ 브랜드명 기본값 주입 (프런트가 안보내도 항상 저장)
      if (!payload.brandName) {
        payload.brandName = pickBrandNameFromUser(req.user);
      }

      if (payload.coverImageUrl && !payload.thumbnailUrl) {
        payload.thumbnailUrl = toThumb(payload.coverImageUrl);
      }
      if (payload.descriptionHTML) {
        payload.descriptionHTML = sanitize(payload.descriptionHTML);
      }
      if (payload.recruit?.shootDate) {
        const d = new Date(payload.recruit.shootDate);
        if (!isNaN(d)) payload.recruit.shootDate = d;
      }
      if (payload.closeAt) {
        const c = new Date(payload.closeAt);
        if (!isNaN(c)) payload.closeAt = c;
      }

      const created = await Campaign.create(payload);
      return res.ok({ data: attachBrandToDTO(created) }, 201);
    } catch (err) {
      console.error('[recruit-test:create] error', err);
      return res.fail(err.message || 'CREATE_FAILED', 'CREATE_FAILED', 500);
    }
  }
);

// ---------- List ----------
router.get(
  '/',
  query('status').optional().isIn(['draft', 'scheduled', 'published', 'closed']),
  async (req, res) => {
    try {
      const page = Math.max(parseInt(req.query.page || '1', 10), 1);
      const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10), 1), 50);

      const q = { type: 'recruit' };
      if (req.query.status) q.status = req.query.status;
      if (req.query.q) q.title = { $regex: String(req.query.q), $options: 'i' };

      const sort = { createdAt: -1 };

      // 필요 시 소유자/브랜드 기본정보 populate (스키마에 따라 필드명 조정)
      const queryExec = Campaign.find(q)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .populate([
          { path: 'owner', select: 'brandName companyName name' },
          { path: 'brand', select: 'name' },
          { path: 'user', select: 'brandName companyName name' },
        ]);

      const [items, total] = await Promise.all([queryExec, Campaign.countDocuments(q)]);

      return res.ok({
        items: items.map(attachBrandToDTO),
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      });
    } catch (err) {
      console.error('[recruit-test:list] error', err);
      return res.fail(err.message || 'LIST_FAILED', 'LIST_FAILED', 500);
    }
  }
);

// ---------- Read ----------
router.get('/:id', auth, async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.fail('INVALID_ID', 'INVALID_ID', 400);

  try {
    const doc = await Campaign.findById(id).populate([
      { path: 'owner', select: 'brandName companyName name' },
      { path: 'brand', select: 'name' },
      { path: 'user', select: 'brandName companyName name' },
    ]);
    if (!doc) return res.fail('NOT_FOUND', 'NOT_FOUND', 404);

    const isOwner = req.user && String(doc.createdBy) === req.user.id;
    if (!isOwner && doc.status !== 'published') {
      return res.fail('FORBIDDEN', 'FORBIDDEN', 403);
    }
    return res.ok({ data: attachBrandToDTO(doc) });
  } catch (err) {
    console.error('[recruit-test:read] error', err);
    return res.fail(err.message || 'READ_FAILED', 'READ_FAILED', 500);
  }
});

// ---------- Update ----------
router.put('/:id', auth, requireRole('brand', 'admin', 'showhost'), async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.fail('INVALID_ID', 'INVALID_ID', 400);

  try {
    const $set = { ...req.body };

    // 브랜드명 비워서 오면 기존/유저 정보로 보정
    if (!$set.brandName) $set.brandName = pickBrandNameFromUser(req.user);

    if ($set.coverImageUrl && !$set.thumbnailUrl) $set.thumbnailUrl = toThumb($set.coverImageUrl);
    if ($set.descriptionHTML) $set.descriptionHTML = sanitize($set.descriptionHTML);
    if ($set.recruit?.shootDate) {
      const d = new Date($set.recruit.shootDate);
      if (!isNaN(d)) $set.recruit.shootDate = d;
    }
    if ($set.closeAt) {
      const c = new Date($set.closeAt);
      if (!isNaN(c)) $set.closeAt = c;
    }

    const updated = await Campaign.findOneAndUpdate(
      { _id: id, createdBy: req.user.id },
      { $set },
      { new: true }
    ).populate([
      { path: 'owner', select: 'brandName companyName name' },
      { path: 'brand', select: 'name' },
      { path: 'user', select: 'brandName companyName name' },
    ]);

    if (!updated) return res.fail('REJECTED', 'RECRUIT_FORBIDDEN_EDIT', 403);
    return res.ok({ data: attachBrandToDTO(updated) });
  } catch (err) {
    console.error('[recruit-test:update] error', err);
    return res.fail(err.message || 'UPDATE_FAILED', 'UPDATE_FAILED', 500);
  }
});

// ---------- Delete ----------
router.delete('/:id', auth, requireRole('brand', 'admin', 'showhost'), async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.fail('INVALID_ID', 'INVALID_ID', 400);

  try {
    const removed = await Campaign.findOneAndDelete({ _id: id, createdBy: req.user.id });
    if (!removed) return res.fail('NOT_FOUND_OR_FORBIDDEN', 'RECRUIT_FORBIDDEN_DELETE', 403);
    return res.ok({ message: '삭제 완료' });
  } catch (err) {
    console.error('[recruit-test:delete] error', err);
    return res.fail(err.message || 'DELETE_FAILED', 'DELETE_FAILED', 500);
  }
});

module.exports = router;