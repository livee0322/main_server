// routes/recruit-test.js
// Livee v2.5 - Recruit 전용 간단 라우터 (프런트 recruit-new.js와 호환)
// NOTE: 운영에선 campaigns 라우터를 쓰고, 이 파일은 테스트/마이그용 래퍼로 사용해도 됨.

const router = require('express').Router();
const { body, query, validationResult } = require('express-validator');
const sanitizeHtml = require('sanitize-html');
const mongoose = require('mongoose');

const Campaign = require('../models/Campaign');
const auth = require('../src/middleware/auth');
const requireRole = require('../src/middleware/requireRole');
const { toThumb, toDTO } = require('../src/utils/common');

const sanitize = (html) =>
  sanitizeHtml(html || '', {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img','h1','h2','u','span','figure','figcaption']),
    allowedAttributes: { '*': ['style','class','id','src','href','alt','title'] },
    allowedSchemes: ['http','https','data','mailto','tel'],
  });

/* -----------------------------
 * Create (POST /recruit-test)
 * 프런트 recruit-new.js의 payload와 동일:
 *  - type: 'recruit' (기본)
 *  - title, category, closeAt, coverImageUrl/thumbnailUrl
 *  - recruit: {shootDate(Date|ISO), shootTime("HH:MM~HH:MM"), pay, payNegotiable, location, requirements, ...}
 * ---------------------------*/
router.post('/',
  auth, requireRole('brand','admin'),
  body('title').isLength({ min: 1 }),
  body('recruit.shootDate').exists(),
  body('recruit.shootTime').isString().isLength({ min: 1 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.fail('VALIDATION_FAILED','VALIDATION_FAILED',422,{ errors: errors.array() });
    }

    try {
      const payload = { ...req.body };

      // 강제 기본값/보정
      payload.type   = 'recruit';
      payload.status = payload.status || 'draft';
      payload.createdBy = req.user.id;

      // 썸네일 자동 파생
      if (payload.coverImageUrl && !payload.thumbnailUrl) {
        payload.thumbnailUrl = toThumb(payload.coverImageUrl);
      }

      // 설명 HTML sanitize
      if (payload.descriptionHTML) {
        payload.descriptionHTML = sanitize(payload.descriptionHTML);
      }

      // recruit.shootDate 형식 정규화 (Date/ISO/숫자 모두 허용)
      if (payload.recruit?.shootDate) {
        const d = new Date(payload.recruit.shootDate);
        if (!isNaN(d)) payload.recruit.shootDate = d;
      }

      // closeAt 문자열이라면 Date로 치환
      if (payload.closeAt) {
        const c = new Date(payload.closeAt);
        if (!isNaN(c)) payload.closeAt = c;
      }

      const created = await Campaign.create(payload);
      return res.ok({ data: toDTO(created) }, 201);
    } catch (err) {
      console.error('[recruit-test:create] error', err);
      return res.fail(err.message || 'CREATE_FAILED', 'CREATE_FAILED', 500);
    }
  }
);

/* -----------------------------
 * List (GET /recruit-test)
 *  - 기본 type=recruit
 *  - ?status=published|draft...
 *  - ?q= (title 검색)
 *  - ?limit=20, ?page=1
 * ---------------------------*/
router.get('/',
  query('status').optional().isIn(['draft','scheduled','published','closed']),
  async (req, res) => {
    try {
      const page  = Math.max(parseInt(req.query.page || '1', 10), 1);
      const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10), 1), 50);

      const q = { type: 'recruit' };
      if (req.query.status) q.status = req.query.status;
      if (req.query.q)      q.title  = { $regex: String(req.query.q), $options: 'i' };

      const sort = { createdAt: -1 };

      const [items, total] = await Promise.all([
        Campaign.find(q).sort(sort).skip((page - 1) * limit).limit(limit),
        Campaign.countDocuments(q)
      ]);

      return res.ok({
        items: items.map(toDTO),
        page, limit, total, totalPages: Math.ceil(total / limit)
      });
    } catch (err) {
      console.error('[recruit-test:list] error', err);
      return res.fail(err.message || 'LIST_FAILED', 'LIST_FAILED', 500);
    }
  }
);

/* -----------------------------
 * Read (GET /recruit-test/:id)
 *  - 본인 소유가 아니면 published만 허용
 * ---------------------------*/
router.get('/:id', auth, async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.fail('INVALID_ID','INVALID_ID',400);

  try {
    const doc = await Campaign.findById(id);
    if (!doc) return res.fail('NOT_FOUND','NOT_FOUND',404);

    const isOwner = req.user && String(doc.createdBy) === req.user.id;
    if (!isOwner && doc.status !== 'published') {
      return res.fail('FORBIDDEN','FORBIDDEN',403);
    }
    return res.ok({ data: toDTO(doc) });
  } catch (err) {
    console.error('[recruit-test:read] error', err);
    return res.fail(err.message || 'READ_FAILED', 'READ_FAILED', 500);
  }
});

/* -----------------------------
 * Update (PUT /recruit-test/:id)
 *  - 소유자만 수정
 * ---------------------------*/
router.put('/:id', auth, requireRole('brand','admin'), async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.fail('INVALID_ID','INVALID_ID',400);

  try {
    const $set = { ...req.body };

    if ($set.coverImageUrl && !$set.thumbnailUrl) {
      $set.thumbnailUrl = toThumb($set.coverImageUrl);
    }
    if ($set.descriptionHTML) {
      $set.descriptionHTML = sanitize($set.descriptionHTML);
    }
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
    );
    if (!updated) return res.fail('REJECTED','RECRUIT_FORBIDDEN_EDIT',403);
    return res.ok({ data: toDTO(updated) });
  } catch (err) {
    console.error('[recruit-test:update] error', err);
    return res.fail(err.message || 'UPDATE_FAILED', 'UPDATE_FAILED', 500);
  }
});

/* -----------------------------
 * Delete (DELETE /recruit-test/:id)
 *  - 소유자만 삭제
 * ---------------------------*/
router.delete('/:id', auth, requireRole('brand','admin'), async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.fail('INVALID_ID','INVALID_ID',400);

  try {
    const removed = await Campaign.findOneAndDelete({ _id: id, createdBy: req.user.id });
    if (!removed) return res.fail('NOT_FOUND_OR_FORBIDDEN','RECRUIT_FORBIDDEN_DELETE',403);
    return res.ok({ message: '삭제 완료' });
  } catch (err) {
    console.error('[recruit-test:delete] error', err);
    return res.fail(err.message || 'DELETE_FAILED', 'DELETE_FAILED', 500);
  }
});

module.exports = router;