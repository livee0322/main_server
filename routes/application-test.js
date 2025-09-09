// routes/applications-test.js
'use strict';

const router = require('express').Router();
const { body, param, query, validationResult } = require('express-validator');
const mongoose = require('mongoose');

const auth = require('../src/middleware/auth');
const requireRole = require('../src/middleware/requireRole');

const Application = require('../models/Application-test');
const Recruit    = require('../models/Recruit-test');     // 이미 있는 모델 기준
const Portfolio  = require('../models/Portfolio-test');   // 이미 있는 모델 기준

// 연락처/외부유도 금지
const badContact = /(email|e-?mail|@|카톡|카카오|kakao|톡|전화|폰|phone|tel|연락|이메일|메일|insta|instagram|dm|디엠)/i;

const isId = (v) => typeof v === 'string' && mongoose.isValidObjectId(v);
const asInt = (v, d=0) => (Number.isFinite(+v) && +v >= 0 ? +v : d);
const ok = (res, data) => res.json({ ok: true, data });
const fail = (res, code='ERROR', status=400, message) => res.status(status).json({ ok:false, code, message });

// 공통: 입력 검증 에러 핸들러
const sendValidation = (req,res,next) => {
  const v = validationResult(req);
  if (v.isEmpty()) return next();
  return res.status(422).json({ ok:false, code:'VALIDATION_FAILED', details: v.array({ onlyFirstError:true }) });
};

// 리크루트 소유자 체크(브랜드/관리자만)
async function assertOwnRecruit(req, res, next) {
  try {
    const r = await Recruit.findById(req.recruitId || req.query.recruitId).lean();
    if (!r) return fail(res, 'RECRUIT_NOT_FOUND', 404);
    const owner = r.createdBy || r.ownerId || r.userId || (r.brand && r.brand.ownerId);
    const isAdmin = req.user?.role === 'admin' || (Array.isArray(req.user?.roles) && req.user.roles.includes('admin'));
    if (String(owner) !== String(req.user.id) && !isAdmin) return fail(res, 'FORBIDDEN', 403);
    req._recruit = r;
    return next();
  } catch (e) {
    return fail(res, 'RECRUIT_LOAD_FAILED', 500, e.message);
  }
}

/* -----------------------------------------
 * POST /  (쇼호스트 전용) — 지원 생성
 * ---------------------------------------*/
router.post(
  '/',
  auth,
  requireRole('showhost','admin'),
  [
    body('recruitId').custom(isId),
    body('portfolioId').custom(isId),
    body('message').optional().isString().isLength({ max: 800 }).custom(v => !badContact.test(v || '')),
  ],
  sendValidation,
  async (req, res) => {
    try {
      const { recruitId, portfolioId, message='' } = req.body;

      // 포트폴리오가 본인 소유인지 확인(보안)
      const pf = await Portfolio.findById(portfolioId).lean();
      if (!pf) return fail(res, 'PORTFOLIO_NOT_FOUND', 404);
      const owner = pf.userId || pf.ownerId || pf.createdBy;
      if (String(owner) !== String(req.user.id)) return fail(res, 'FORBIDDEN_PORTFOLIO', 403);

      // 공고 존재 여부(상태 체크는 필요시 추가)
      const r = await Recruit.findById(recruitId).lean();
      if (!r) return fail(res, 'RECRUIT_NOT_FOUND', 404);

      // 생성 (중복 지원은 unique index가 막아줌)
      const created = await Application.create({
        recruitId,
        portfolioId,
        message,
        createdBy: req.user.id,
        status: 'pending',
      });

      return res.status(201).json({ ok: true, data: { id: created.id } });
    } catch (err) {
      // 중복 에러 처리
      if (err?.code === 11000) return fail(res, 'ALREADY_APPLIED', 409, '이미 지원한 공고입니다.');
      console.error('[applications-test:create]', err);
      return fail(res, 'CREATE_FAILED', 500, err.message);
    }
  }
);

/* -----------------------------------------
 * GET /  — 목록
 *  - 브랜드: ?recruitId=... (필수) → 해당 공고의 지원자 목록
 *  - 쇼호스트: ?mine=1 → 내가 지원한 목록
 *  - 공통 옵션: ?limit=&skip=
 * ---------------------------------------*/
router.get(
  '/',
  auth,
  [
    query('recruitId').optional().custom(isId),
    query('mine').optional().isIn(['1','true']),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('skip').optional().isInt({ min: 0 }),
  ],
  sendValidation,
  async (req, res, next) => {
    try {
      const limit = asInt(req.query.limit, 50);
      const skip  = asInt(req.query.skip, 0);

      // 브랜드 — 특정 공고의 지원자
      if (req.query.recruitId) {
        req.recruitId = req.query.recruitId;
        return assertOwnRecruit(req, res, async () => {
          const [items, total] = await Promise.all([
            Application.find({ recruitId: req.query.recruitId })
              .sort({ createdAt: -1 }).skip(skip).limit(limit)
              .populate({ path: 'portfolioId', select: 'nickname displayName headline mainThumbnailUrl thumbnailUrl subThumbnails userId' })
              .lean(),
            Application.countDocuments({ recruitId: req.query.recruitId }),
          ]);

          // 응답 형태 정리(프론트가 기대하는 필드명 맞춤)
          const mapped = items.map(a => ({
            id: a._id.toString(),
            recruitId: a.recruitId,
            status: a.status,
            message: a.message,
            createdAt: a.createdAt,
            portfolio: {
              id: a.portfolioId?._id?.toString(),
              nickname: a.portfolioId?.nickname || a.portfolioId?.displayName,
              headline: a.portfolioId?.headline || '',
              mainThumbnailUrl:
                a.portfolioId?.mainThumbnailUrl ||
                a.portfolioId?.thumbnailUrl ||
                (Array.isArray(a.portfolioId?.subThumbnails) && a.portfolioId.subThumbnails[0]) ||
                null,
            },
          }));

          return ok(res, { items: mapped, total, recruit: req._recruit });
        });
      }

      // 쇼호스트 — 내가 지원한 목록
      if (req.query.mine === '1' || req.query.mine === 'true') {
        // 본인 계정만
        const items = await Application.find({ createdBy: req.user.id })
          .sort({ createdAt: -1 }).skip(skip).limit(limit)
          .populate({ path: 'recruitId', select: 'title brandName closeAt pay fee feeNegotiable payNegotiable' })
          .lean();

        const mapped = items.map(a => ({
          id: a._id.toString(),
          status: a.status,
          message: a.message,
          createdAt: a.createdAt,
          recruit: {
            id: a.recruitId?._id?.toString(),
            title: a.recruitId?.title,
            brandName: a.recruitId?.brandName,
            closeAt: a.recruitId?.closeAt,
            pay: a.recruitId?.pay ?? a.recruitId?.fee,
            payNegotiable: a.recruitId?.payNegotiable ?? a.recruitId?.feeNegotiable,
          },
        }));

        return ok(res, { items: mapped, total: mapped.length });
      }

      return fail(res, 'BAD_REQUEST', 400, 'recruitId 또는 mine=1 중 하나가 필요합니다.');
    } catch (err) {
      console.error('[applications-test:list]', err);
      return fail(res, 'LIST_FAILED', 500, err.message);
    }
  }
);

/* -----------------------------------------
 * GET /:id — 단건 조회 (브랜드 소유 혹은 본인 지원건)
 * ---------------------------------------*/
router.get(
  '/:id',
  auth,
  [ param('id').custom(isId) ],
  sendValidation,
  async (req, res) => {
    try {
      const a = await Application.findById(req.params.id)
        .populate({ path: 'portfolioId', select: 'nickname displayName headline mainThumbnailUrl thumbnailUrl subThumbnails userId' })
        .populate({ path: 'recruitId',   select: 'title brandName createdBy ownerId userId' })
        .lean();
      if (!a) return fail(res, 'NOT_FOUND', 404);

      // 접근권한: 내가 만든 공고 or 내가 낸 지원
      const recruitOwner = a.recruitId?.createdBy || a.recruitId?.ownerId || a.recruitId?.userId;
      const isOwner  = recruitOwner && String(recruitOwner) === String(req.user.id);
      const isAuthor = String(a.createdBy) === String(req.user.id);
      const isAdmin  = req.user?.role === 'admin' || (Array.isArray(req.user?.roles) && req.user.roles.includes('admin'));
      if (!isOwner && !isAuthor && !isAdmin) return fail(res, 'FORBIDDEN', 403);

      return ok(res, a);
    } catch (err) {
      console.error('[applications-test:get]', err);
      return fail(res, 'GET_FAILED', 500, err.message);
    }
  }
);

/* -----------------------------------------
 * PATCH /:id — 상태 변경 (브랜드 소유자/관리자)
 * body: { status: 'accepted' | 'rejected' | 'on_hold' }
 * ---------------------------------------*/
router.patch(
  '/:id',
  auth,
  [ param('id').custom(isId), body('status').isIn(['accepted','rejected','on_hold']) ],
  sendValidation,
  async (req, res) => {
    try {
      const a = await Application.findById(req.params.id).lean();
      if (!a) return fail(res, 'NOT_FOUND', 404);

      // 이 지원이 속한 recruit를 내가 만들었는지 확인
      const r = await Recruit.findById(a.recruitId).lean();
      const owner = r?.createdBy || r?.ownerId || r?.userId;
      const isAdmin = req.user?.role === 'admin' || (Array.isArray(req.user?.roles) && req.user.roles.includes('admin'));
      if (String(owner) !== String(req.user.id) && !isAdmin) return fail(res, 'FORBIDDEN', 403);

      await Application.findByIdAndUpdate(a._id, { $set: { status: req.body.status } }, { new: true });
      return ok(res, { id: a._id.toString(), status: req.body.status });
    } catch (err) {
      console.error('[applications-test:patch]', err);
      return fail(res, 'PATCH_FAILED', 500, err.message);
    }
  }
);

module.exports = router;