// routes/recruit.js
const router = require('express').Router();
const { body, validationResult } = require('express-validator');
const Recruit = require('../models/Recruit');
const auth = require('../src/middleware/auth');
const requireRole = require('../src/middleware/requireRole');

// 썸네일 변환 파라미터 (환경변수로 바꿀 수 있음)
const THUMB = process.env.CLOUDINARY_THUMB || 'c_fill,g_auto,w_640,h_360,f_auto,q_auto';

/** Cloudinary URL에 변환 파라미터 삽입 */
function toThumb(url) {
  if (!url) return '';
  try {
    const [h, t] = url.split('/upload/');
    return `${h}/upload/${THUMB}/${t}`;
  } catch { return url; }
}

/** 프론트에 일관되게 내려줄 DTO */
function buildRecruitDTO(doc){
  const o = (doc?.toObject ? doc.toObject() : doc) || {};
  const imageUrl = o.imageUrl || o.thumbnailUrl || '';            // 예전 필드 대응
  const thumbnailUrl = o.thumbnailUrl || toThumb(imageUrl) || ''; // 항상 보장
  return { ...o, imageUrl, thumbnailUrl };
}

// 리스트 (전체)
router.get('/', async (req, res) => {
  const page = Math.max(parseInt(req.query.page||'1'),1);
  const limit = Math.min(parseInt(req.query.limit||'20'), 50);
  const docs = await Recruit.find({})
    .sort({ createdAt: -1 })
    .skip((page-1)*limit)
    .limit(limit);
  const items = docs.map(buildRecruitDTO);
  return res.ok({ items });
});

// 내 공고
router.get('/mine', auth, requireRole('brand','admin'), async (req, res) => {
  const docs = await Recruit.find({ user: req.user.id }).sort({ createdAt: -1 });
  const items = docs.map(buildRecruitDTO);
  return res.ok({ items });
});

// 생성 (브랜드 전용)
router.post('/',
  auth, requireRole('brand'),
  body('title').isLength({ min: 1 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.fail('유효성 오류', 'VALIDATION_FAILED', 422, { errors: errors.array() });

    const payload = { ...req.body, user: req.user.id };
    // 서버에서도 thumbnailUrl 같이 저장해두면 조회 비용 ↓ (선택)
    if (payload.imageUrl && !payload.thumbnailUrl) {
      payload.thumbnailUrl = toThumb(payload.imageUrl);
    }
    const created = await Recruit.create(payload);
    return res.ok({ message: '공고 등록', data: buildRecruitDTO(created) }, 201);
  }
);

// 수정
router.put('/:id', auth, requireRole('brand','admin'), async (req, res) => {
  const $set = { ...req.body };
  if ($set.imageUrl && !$set.thumbnailUrl) $set.thumbnailUrl = toThumb($set.imageUrl);

  const updated = await Recruit.findOneAndUpdate(
    { _id: req.params.id, user: req.user.id },
    { $set },
    { new: true }
  );
  if (!updated) return res.fail('수정 권한이 없거나 존재하지 않습니다.', 'RECRUIT_FORBIDDEN_EDIT', 403);
  return res.ok({ message: '수정 완료', data: buildRecruitDTO(updated) });
});

// 삭제
router.delete('/:id', auth, requireRole('brand','admin'), async (req, res) => {
  const removed = await Recruit.findOneAndDelete({ _id: req.params.id, user: req.user.id });
  if (!removed) return res.fail('삭제 권한이 없거나 존재하지 않습니다.', 'RECRUIT_FORBIDDEN_DELETE', 403);
  return res.ok({ message: '삭제 완료' });
});

// 일정 (today ~ +3일)
router.get('/schedule', async (_req, res) => {
  const now = new Date(); now.setHours(0,0,0,0);
  const end = new Date(now); end.setDate(end.getDate() + 3); end.setHours(23,59,59,999);

  const docs = await Recruit.find({ date: { $gte: now, $lte: end } })
    .sort({ date: 1 })
    .limit(50);
  const items = docs.map(buildRecruitDTO).map(r => ({
    // 홈 위젯에서 필요한 최소 필드만
    _id: r._id,
    title: r.title,
    date: r.date,
    description: r.description,
    imageUrl: r.imageUrl,
    thumbnailUrl: r.thumbnailUrl,
  }));
  return res.ok({ items });
});

module.exports = router;