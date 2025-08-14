// routes/recruit.js (refactored, flexible & front-compatible)
const router = require('express').Router();
const { body, validationResult, param, query } = require('express-validator');
const Recruit = require('../models/Recruit');
const auth = require('../src/middleware/auth');
const requireRole = require('../src/middleware/requireRole');

const THUMB = process.env.CLOUDINARY_THUMB || 'c_fill,g_auto,w_640,h_360,f_auto,q_auto';
const MAX_SALE_MS = 3 * 60 * 60 * 1000; // 3시간

/** Cloudinary thumbnail helper */
function toThumb(url) {
  if (!url) return '';
  try {
    const [h, t] = String(url).split('/upload/');
    if (!t) return url; // non-cloudinary
    return `${h}/upload/${THUMB}/${t}`;
  } catch { return url; }
}

/** Doc → DTO */
function toDTO(doc) {
  const o = (doc?.toObject ? doc.toObject() : doc) || {};
  const id = o._id?.toString?.() || o.id;
  const imageUrl = o.imageUrl || o.thumbnailUrl || '';
  const thumbnailUrl = o.thumbnailUrl || toThumb(imageUrl) || '';
  return { ...o, id, imageUrl, thumbnailUrl };
}

/** async error guard */
const safe = fn => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(e => {
    console.error('[recruits] error:', e);
    return res.fail(e.message || '요청 처리 중 오류가 발생했습니다.', 'RECRUIT_ERROR', 500);
  });

/** build find query from request */
function buildFindQuery(req) {
  const { type, q, hasImage } = req.query || {};
  const $and = [];

  // type filter
  if (type && ['product', 'host', 'both'].includes(type)) {
    $and.push({ type });
  }

  // basic text search (title, description)
  if (q && String(q).trim()) {
    const rx = new RegExp(String(q).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    $and.push({ $or: [{ title: rx }, { description: rx }] });
  }

  // only items with image
  if (hasImage === 'true') {
    $and.push({ $or: [{ imageUrl: { $exists: true, $ne: '' } }, { thumbnailUrl: { $exists: true, $ne: '' } }] });
  }

  return $and.length ? { $and } : {};
}

/* =========================================================
 * GET /recruits  — 목록 (필터 + 페이지네이션)
 * =======================================================*/
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 50 }).toInt(),
    query('type').optional().isIn(['product', 'host', 'both']),
    query('hasImage').optional().isIn(['true', 'false']),
    query('sort').optional().isString(),
    query('q').optional().isString()
  ],
  safe(async (req, res) => {
    const page = req.query.page || 1;
    const limit = req.query.limit || 20;

    const findQuery = buildFindQuery(req);

    // sort: default -createdAt, support: createdAt, -date, date
    const sortKey = (req.query.sort || '-createdAt').trim();
    const sort = {};
    if (sortKey.startsWith('-')) sort[sortKey.slice(1)] = -1;
    else sort[sortKey] = 1;

    const [docs, total] = await Promise.all([
      Recruit.find(findQuery).sort(sort).skip((page - 1) * limit).limit(limit).lean(),
      Recruit.countDocuments(findQuery),
    ]);

    return res.ok({
      items: docs.map(toDTO),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  })
);

/* =========================================================
 * GET /recruits/mine — 내 공고
 * =======================================================*/
router.get(
  '/mine',
  auth,
  requireRole('brand', 'admin'),
  safe(async (req, res) => {
    const docs = await Recruit.find({ user: req.user.id }).sort({ createdAt: -1 }).lean();
    return res.ok({ items: docs.map(toDTO) });
  })
);

/* =========================================================
 * GET /recruits/:id — 단건 조회(수정 프리필)
 * =======================================================*/
router.get(
  '/:id',
  auth,
  requireRole('brand', 'admin'),
  [param('id').isMongoId()],
  safe(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.fail('잘못된 요청입니다.', 'VALIDATION_FAILED', 422, { errors: errors.array() });

    const doc = await Recruit.findOne({ _id: req.params.id, user: req.user.id }).lean();
    if (!doc) return res.fail('권한이 없거나 존재하지 않습니다.', 'RECRUIT_NOT_FOUND', 404);
    return res.ok({ data: toDTO(doc) });
  })
);

/* =========================================================
 * POST /recruits — 생성(브랜드)
 *  - title 필수, 나머지 선택(형식 체크)
 *  - products[].saleUntil 최대 3시간으로 캡핑
 * =======================================================*/
router.post(
  '/',
  auth,
  requireRole('brand'),
  [
    body('title').isString().trim().isLength({ min: 1 }).withMessage('제목은 필수입니다.'),
    body('type').optional().isIn(['product', 'host', 'both']),
    body('date').optional().isString(), // YYYY-MM-DD (프론트가 문자열로 보냄)
    body('time').optional().isString(),
    body('location').optional().isString(),
    body('imageUrl').optional().isString(),
    body('description').optional().isString(),

    // products 검증(간단)
    body('products').optional().isArray(),
    body('products.*.url').optional().isString(),
    body('products.*.title').optional().isString(),
    body('products.*.price').optional().isNumeric(),
    body('products.*.salePrice').optional().isNumeric(),
    body('products.*.thumbUrl').optional().isString(),
    body('products.*.detailHtml').optional().isString(),
    body('products.*.saleUntil').optional().isString(), // 프론트는 ISO or 계산된 값
  ],
  safe(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.fail('유효성 오류', 'VALIDATION_FAILED', 422, { errors: errors.array() });

    const payload = { ...req.body, user: req.user.id };

    // type 기본값
    if (!['product', 'host', 'both'].includes(payload.type)) payload.type = 'product';

    // saleUntil 서버 캡핑
    if (Array.isArray(payload.products)) {
      const now = Date.now();
      payload.products = payload.products.map(p => {
        const next = { ...p };
        if (p.saleUntil) {
          const untilMs = new Date(p.saleUntil).getTime();
          const capped = Math.min(untilMs, now + MAX_SALE_MS);
          next.saleUntil = isFinite(capped) ? new Date(capped) : undefined;
        }
        return next;
      });
    }

    // 썸네일 캐시
    if (payload.imageUrl && !payload.thumbnailUrl) {
      payload.thumbnailUrl = toThumb(payload.imageUrl);
    }

    const created = await Recruit.create(payload);
    return res.ok({ message: '공고 등록', data: toDTO(created) }, 201);
  })
);

/* =========================================================
 * PUT /recruits/:id — 수정(브랜드/관리자)
 * =======================================================*/
router.put(
  '/:id',
  auth,
  requireRole('brand', 'admin'),
  [
    param('id').isMongoId(),
    body('type').optional().isIn(['product', 'host', 'both']),
    body('title').optional().isString().trim(),
    body('date').optional().isString(),
    body('time').optional().isString(),
    body('location').optional().isString(),
    body('imageUrl').optional().isString(),
    body('description').optional().isString(),
    body('products').optional().isArray(),
  ],
  safe(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.fail('유효성 오류', 'VALIDATION_FAILED', 422, { errors: errors.array() });

    const $set = { ...req.body };

    // 캡핑 동일 적용
    if (Array.isArray($set.products)) {
      const now = Date.now();
      $set.products = $set.products.map(p => {
        const next = { ...p };
        if (p.saleUntil) {
          const untilMs = new Date(p.saleUntil).getTime();
          const capped = Math.min(untilMs, now + MAX_SALE_MS);
          next.saleUntil = isFinite(capped) ? new Date(capped) : undefined;
        }
        return next;
      });
    }

    if ($set.imageUrl && !$set.thumbnailUrl) $set.thumbnailUrl = toThumb($set.imageUrl);

    const updated = await Recruit.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { $set },
      { new: true }
    );

    if (!updated)
      return res.fail('수정 권한이 없거나 존재하지 않습니다.', 'RECRUIT_FORBIDDEN_EDIT', 403);

    return res.ok({ message: '수정 완료', data: toDTO(updated) });
  })
);

/* =========================================================
 * DELETE /recruits/:id — 삭제
 * =======================================================*/
router.delete(
  '/:id',
  auth,
  requireRole('brand', 'admin'),
  [param('id').isMongoId()],
  safe(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.fail('유효성 오류', 'VALIDATION_FAILED', 422, { errors: errors.array() });

    const removed = await Recruit.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!removed)
      return res.fail('삭제 권한이 없거나 존재하지 않습니다.', 'RECRUIT_FORBIDDEN_DELETE', 403);

    return res.ok({ message: '삭제 완료' });
  })
);

/* =========================================================
 * GET /recruits/schedule — 오늘~+3일
 * 프론트 위젯 호환용 필드만 최소 반환
 * =======================================================*/
router.get(
  '/schedule',
  safe(async (_req, res) => {
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const end = new Date(now); end.setDate(end.getDate() + 3); end.setHours(23, 59, 59, 999);

    const docs = await Recruit.find({ date: { $gte: now, $lte: end } })
      .sort({ date: 1 })
      .limit(50)
      .lean();

    const items = docs.map(toDTO).map(r => ({
      _id: r._id || r.id,
      title: r.title,
      date: r.date,
      description: r.description,
      imageUrl: r.imageUrl,
      thumbnailUrl: r.thumbnailUrl,
    }));

    return res.ok({ items });
  })
);

module.exports = router;