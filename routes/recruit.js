// routes/recruit.js (refactored, safe & front-compatible)
const router = require('express').Router();
const { body, validationResult, param, query } = require('express-validator');
const Recruit = require('../models/Recruit');
const auth = require('../src/middleware/auth');
const requireRole = require('../src/middleware/requireRole');

// Thumbnail transform (env overrideable)
const THUMB =
  process.env.CLOUDINARY_THUMB ||
  'c_fill,g_auto,w_640,h_360,f_auto,q_auto';

/** Insert Cloudinary transform segment into URL */
function toThumb(url) {
  if (!url) return '';
  try {
    const [h, t] = String(url).split('/upload/');
    if (!t) return url; // not a cloudinary url
    return `${h}/upload/${THUMB}/${t}`;
  } catch {
    return url;
  }
}

/** Normalize document → DTO for the frontend */
function toDTO(doc) {
  const o = (doc?.toObject ? doc.toObject() : doc) || {};
  const id = o._id?.toString?.() || o.id;
  const imageUrl = o.imageUrl || o.thumbnailUrl || '';
  const thumbnailUrl = o.thumbnailUrl || toThumb(imageUrl) || '';
  return {
    ...o,
    id,                // 편의상 id 보장
    imageUrl,
    thumbnailUrl,
  };
}

/** Common error wrapper */
const safe = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch((e) => {
    console.error('[recruits] error:', e);
    return res.fail(e.message || '요청 처리 중 오류가 발생했습니다.', 'RECRUIT_ERROR', 500);
  });

/* =========================
 *  목록 (전체, 페이지네이션)
 * ========================= */
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 50 }).toInt(),
  ],
  safe(async (req, res) => {
    const page = req.query.page || 1;
    const limit = req.query.limit || 20;

    const [docs, total] = await Promise.all([
      Recruit.find({})
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Recruit.countDocuments({}),
    ]);

    const items = docs.map(toDTO);
    return res.ok({
      items,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  })
);

/* =========================
 *  내 공고
 * ========================= */
router.get(
  '/mine',
  auth,
  requireRole('brand', 'admin'),
  safe(async (req, res) => {
    const docs = await Recruit.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .lean();
    return res.ok({ items: docs.map(toDTO) });
  })
);

/* =========================
 *  단건 조회 (수정 프리필용)
 * ========================= */
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

/* =========================
 *  생성 (브랜드 전용)
 * ========================= */
router.post(
  '/',
  auth,
  requireRole('brand'),
  [
    body('title').isLength({ min: 1 }).withMessage('제목은 필수입니다.'),
    body('date').isString().withMessage('촬영일은 필수입니다.'),
    body('imageUrl').isString().withMessage('이미지 URL은 필수입니다.'),
  ],
  safe(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.fail('유효성 오류', 'VALIDATION_FAILED', 422, { errors: errors.array() });

    const payload = { ...req.body, user: req.user.id };

    // 서버에서 썸네일 캐시 필드 생성(선택)
    if (payload.imageUrl && !payload.thumbnailUrl) {
      payload.thumbnailUrl = toThumb(payload.imageUrl);
    }

    const created = await Recruit.create(payload);
    return res.ok({ message: '공고 등록', data: toDTO(created) }, 201);
  })
);

/* =========================
 *  수정
 * ========================= */
router.put(
  '/:id',
  auth,
  requireRole('brand', 'admin'),
  [param('id').isMongoId()],
  safe(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.fail('유효성 오류', 'VALIDATION_FAILED', 422, { errors: errors.array() });

    const $set = { ...req.body };
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

/* =========================
 *  삭제
 * ========================= */
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

/* =========================
 *  일정 (today ~ +3)
 * ========================= */
router.get(
  '/schedule',
  safe(async (_req, res) => {
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const end = new Date(now); end.setDate(end.getDate() + 3); end.setHours(23, 59, 59, 999);

    const docs = await Recruit.find({ date: { $gte: now, $lte: end } })
      .sort({ date: 1 })
      .limit(50)
      .lean();

    const items = docs.map(toDTO).map((r) => ({
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