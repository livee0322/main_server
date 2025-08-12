// routes/recruits.js
const router = require('express').Router();
const { body, validationResult } = require('express-validator');
const Recruit = require('../models/Recruit');
const auth = require('../src/middleware/auth');
const requireRole = require('../src/middleware/requireRole');

// 리스트 (전체)
router.get('/', async (req, res) => {
  const page = Math.max(parseInt(req.query.page||'1',10),1);
  const limit = Math.min(parseInt(req.query.limit||'20',10), 50);
  const items = await Recruit.find({})
    .sort({ createdAt: -1 })
    .skip((page-1)*limit)
    .limit(limit);
  return res.ok({ items });
});

// 내 공고
router.get('/mine', auth, requireRole('brand','admin'), async (req, res) => {
  const items = await Recruit.find({ user: req.user.id }).sort({ createdAt: -1 });
  return res.ok({ items });
});

// 생성 (브랜드 전용)
router.post('/',
  auth,
  requireRole('brand'),
  body('title').isLength({ min: 1 }).withMessage('제목은 필수입니다.'),
  body('date').isLength({ min: 1 }).withMessage('촬영일은 필수입니다.'),
  body('imageUrl').isLength({ min: 1 }).withMessage('썸네일은 필수입니다.'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.fail('유효성 오류', 'VALIDATION_FAILED', 422, { errors: errors.array() });
    }

    const { date, ...rest } = req.body;
    // ✅ date 문자열을 Date로 변환 (자정 기준)
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      return res.fail('유효하지 않은 날짜 형식입니다.', 'INVALID_DATE', 422);
    }

    const payload = { ...rest, date: dateObj, user: req.user.id };
    const created = await Recruit.create(payload);
    return res.ok({ message: '공고 등록', data: created }, 201);
  }
);

// 수정
router.put('/:id', auth, requireRole('brand','admin'), async (req, res) => {
  const update = { ...req.body };
  if (update.date) {
    const d = new Date(update.date);
    if (isNaN(d.getTime())) {
      return res.fail('유효하지 않은 날짜 형식입니다.', 'INVALID_DATE', 422);
    }
    update.date = d;
  }
  const updated = await Recruit.findOneAndUpdate(
    { _id: req.params.id, user: req.user.id },
    { $set: update },
    { new: true }
  );
  if (!updated) return res.fail('수정 권한이 없거나 존재하지 않습니다.', 'RECRUIT_FORBIDDEN_EDIT', 403);
  return res.ok({ message: '수정 완료', data: updated });
});

// 삭제
router.delete('/:id', auth, requireRole('brand','admin'), async (req, res) => {
  const removed = await Recruit.findOneAndDelete({ _id: req.params.id, user: req.user.id });
  if (!removed) return res.fail('삭제 권한이 없거나 존재하지 않습니다.', 'RECRUIT_FORBIDDEN_DELETE', 403);
  return res.ok({ message: '삭제 완료' });
});

// 일정 (today ~ +3일)
router.get('/schedule', async (req, res) => {
  const now = new Date();
  now.setHours(0,0,0,0);
  const end = new Date(now);
  end.setDate(end.getDate() + 3);
  end.setHours(23,59,59,999);

  const items = await Recruit.find({ date: { $gte: now, $lte: end } })
    .sort({ date: 1 })
    .limit(50)
    // ✅ 프론트가 쓰는 필드명(imageUrl)로 통일
    .select('title brand date imageUrl description');
  return res.ok({ items });
});

module.exports = router;