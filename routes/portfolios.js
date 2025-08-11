const router = require('express').Router();
const { body, validationResult } = require('express-validator');
const Portfolio = require('../models/Portfolio');
const auth = require('../src/middleware/auth');
const requireRole = require('../src/middleware/requireRole');

// 공개 리스트 (홈/리스트)
router.get('/', async (req, res) => {
  const page = Math.max(parseInt(req.query.page||'1'),1);
  const limit = Math.min(parseInt(req.query.limit||'20'), 50);
  const items = await Portfolio.find({ isPublic: true })
    .sort({ createdAt: -1 })
    .skip((page-1)*limit)
    .limit(limit)
    .select('name profileImage introText jobTag region experienceYears isPublic');
  return res.ok({ items });
});

// 내 포트폴리오 조회
router.get('/mine', auth, requireRole('showhost','brand','admin'), async (req, res) => {
  const doc = await Portfolio.findOne({ user: req.user.id });
  if (!doc) return res.fail('포트폴리오가 없습니다.', 'PORTFOLIO_NOT_FOUND', 404);
  return res.ok({ data: doc });
});

// 생성 (쇼호스트 전용)
router.post('/',
  auth, requireRole('showhost'),
  body('name').isLength({ min: 1 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.fail('유효성 오류', 'VALIDATION_FAILED', 422, { errors: errors.array() });

    const exists = await Portfolio.findOne({ user: req.user.id });
    if (exists) return res.fail('이미 포트폴리오가 존재합니다.', 'PORTFOLIO_DUP', 400);

    const payload = { ...req.body, user: req.user.id };
    const created = await Portfolio.create(payload);
    return res.ok({ message: '포트폴리오 생성', data: created }, 201);
  }
);

// 수정
router.put('/:id', auth, requireRole('showhost','admin'), async (req, res) => {
  const updated = await Portfolio.findOneAndUpdate(
    { _id: req.params.id, user: req.user.id },
    { $set: req.body },
    { new: true }
  );
  if (!updated) return res.fail('수정 권한이 없거나 존재하지 않습니다.', 'PORTFOLIO_FORBIDDEN_EDIT', 403);
  return res.ok({ message: '수정 완료', data: updated });
});

// 삭제 (내 포트폴리오)
router.delete('/mine', auth, requireRole('showhost','admin'), async (req, res) => {
  const removed = await Portfolio.findOneAndDelete({ user: req.user.id });
  if (!removed) return res.fail('삭제할 포트폴리오가 없습니다.', 'PORTFOLIO_NOT_FOUND', 404);
  return res.ok({ message: '삭제 완료' });
});

module.exports = router;
