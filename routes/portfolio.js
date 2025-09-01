// routes/portfolio.js (Refactored - Error Handling & Response Standardized)
const router = require('express').Router();
const { body, validationResult } = require('express-validator');
const Portfolio = require('../models/Portfolio');
const auth = require('../src/middleware/auth');
const requireRole = require('../src/middleware/requireRole');
const asyncHandler = require('../src/middleware/asyncHandler'); // 비동기 핸들러 불러오기

// 모든 API 핸들러를 asyncHandler로 감싸고, 응답을 res.ok/res.fail로 통일

// 공개 리스트 (홈/리스트)
router.get('/', asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page||'1'),1);
  const limit = Math.min(parseInt(req.query.limit||'20'), 50);

  // 검색 조건을 담을 쿼리 객체
  const query = { isPublic: true };
  if (req.query.q) { // 이름, 소개 등으로 텍스트 검색
    query.$or = [
      { name: { $regex: req.query.q, $options: 'i' } },
      { introText: { $regex: req.query.q, $options: 'i' } },
    ];
  }
  if (req.query.region) query.region = req.query.region; // 지역 필터
  if (req.query.jobTag) query.jobTag = req.query.jobTag; // 직무 태그 필터

  // 수정된 쿼리 객체 적용
  const items = await Portfolio.find({ isPublic: true })
    .sort({ createdAt: -1 })
    .skip((page-1)*limit)
    .limit(limit)
    .select('name profileImage introText jobTag region experienceYears isPublic');
  return res.ok({ items });
}));

// 내 포트폴리오 조회
router.get('/mine', auth, requireRole('showhost','brand','admin'), asyncHandler(async (req, res) => {
  const doc = await Portfolio.findOne({ user: req.user.id });
  if (!doc) return res.fail('포트폴리오가 없습니다.', 'PORTFOLIO_NOT_FOUND', 404);
  return res.ok({ data: doc });
}));

// 생성 (쇼호스트 전용)
router.post('/',
  auth, requireRole('showhost'),
  body('name').isLength({ min: 1 }),
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.fail('유효성 오류', 'VALIDATION_FAILED', 422, { errors: errors.array() });

    const exists = await Portfolio.findOne({ user: req.user.id });
    if (exists) return res.fail('이미 포트폴리오가 존재합니다.', 'PORTFOLIO_DUP', 400);

    const payload = { ...req.body, user: req.user.id };
    const created = await Portfolio.create(payload);
    return res.ok({ message: '포트폴리오 생성', data: created }, 201);
  })
);

// 수정
router.put('/:id', auth, requireRole('showhost','admin'), asyncHandler(async (req, res) => {
  const updated = await Portfolio.findOneAndUpdate(
    { _id: req.params.id, user: req.user.id },
    { $set: req.body },
    { new: true }
  );
  if (!updated) return res.fail('수정 권한이 없거나 존재하지 않습니다.', 'PORTFOLIO_FORBIDDEN_EDIT', 403);
  return res.ok({ message: '수정 완료', data: updated });
}));

// 삭제 (내 포트폴리오)
router.delete('/mine', auth, requireRole('showhost','admin'), asyncHandler(async (req, res) => {
  const removed = await Portfolio.findOneAndDelete({ user: req.user.id });
  if (!removed) return res.fail('삭제할 포트폴리오가 없습니다.', 'PORTFOLIO_NOT_FOUND', 404);
  return res.ok({ message: '삭제 완료' });
}));

// 공개 포트폴리오 상세 조회
router.get('/:id', asyncHandler(async (req, res) => {
  const doc = await Portfolio.findOne({ _id: req.params.id, isPublic: true });
  if (!doc) return res.fail('포트폴리오가 없거나 비공개 상태입니다.', 'NOT_FOUND', 404);
  return res.ok({ data: doc });
}));

module.exports = router;