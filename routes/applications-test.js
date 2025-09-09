'use strict';

const router = require('express').Router();
const { body, param, query, validationResult } = require('express-validator');
const mongoose = require('mongoose');

const auth = require('../src/middleware/auth');
const requireRole = require('../src/middleware/requireRole');

const Application = require('../models/Application-test');
const Recruit    = require('../models/Recruit-test');     // 🔸 alias 모델
const Portfolio  = require('../models/Portfolio-test');

const badContact = /(email|e-?mail|@|카톡|카카오|kakao|톡|전화|폰|phone|tel|연락|이메일|메일|insta|instagram|dm|디엠)/i;

const isId  = (v) => typeof v === 'string' && mongoose.isValidObjectId(v);
const asInt = (v, d=0) => (Number.isFinite(+v) && +v >= 0 ? +v : d);
const ok    = (res, data) => res.json({ ok: true, data });
const fail  = (res, code='ERROR', status=400, message) =>
  res.status(status).json({ ok:false, code, message });

// 공통: 입력 검증 에러 핸들러
const sendValidation = (req,res,next) => {
  const v = validationResult(req);
  if (v.isEmpty()) return next();
  return res.status(422).json({ ok:false, code:'VALIDATION_FAILED', details: v.array({ onlyFirstError:true }) });
};

// 리크루트(캠페인) 소유자 체크: type='recruit' 강제
async function loadRecruitIfOwn(userId, recruitId){
  if (!isId(recruitId)) return null;
  const r = await Recruit.findOne(
    { _id: recruitId, type: 'recruit' },            // 🔸 type 강제
    { createdBy:1, ownerId:1, userId:1, title:1, brandName:1, closeAt:1, pay:1, fee:1, feeNegotiable:1, payNegotiable:1 }
  ).lean();
  if (!r) return null;

  const uid = String(userId);
  const owners = [r.createdBy, r.ownerId, r.userId].filter(Boolean).map(v => String(v));
  const isOwner = owners.includes(uid);
  return { r, isOwner };
}

/* =========================================
 * POST /  (쇼호스트 전용) — 지원 생성
 * =======================================*/
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

      // 포트폴리오 소유자 검증
      const pf = await Portfolio.findById(portfolioId).lean();
      if (!pf) return fail(res, 'PORTFOLIO_NOT_FOUND', 404);
      const pfOwner = pf.userId || pf.ownerId || pf.createdBy;
      if (String(pfOwner) !== String(req.user.id)) return fail(res, 'FORBIDDEN_PORTFOLIO', 403);

      // recruit 존재 & 유형 검증(type=recruit)
      const found = await Recruit.findOne({ _id: recruitId, type: 'recruit' }).lean();
      if (!found) return fail(res, 'RECRUIT_NOT_FOUND', 404);

      // 생성 (중복은 unique index가 막음)
      const created = await Application.create({
        recruitId,
        portfolioId,
        message,
        createdBy: req.user.id,
        status: 'pending',
      });

      return res.status(201).json({ ok: true, data: { id: created.id } });
    } catch (err) {
      if (err?.code === 11000) return fail(res, 'ALREADY_APPLIED', 409, '이미 지원한 공고입니다.');
      console.error('[applications-test:create]', err);
      return fail(res, 'CREATE_FAILED', 500, err.message);
    }
  }
);

/* =========================================
 * GET /  — 목록
 *  - 브랜드: ?recruitId=... → 해당 공고의 지원자
 *  - 쇼호스트: ?mine=1      → 내가 지원한 목록
 *  - 공통 옵션: ?limit=&skip=
 * =======================================*/
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
  async (req, res) => {
    try {
      const limit = asInt(req.query.limit, 50);
      const skip  = asInt(req.query.skip, 0);

      // 브랜드 — 특정 공고 지원자
      if (req.query.recruitId) {
        const info = await loadRecruitIfOwn(req.user.id, req.query.recruitId);
        const isAdmin = req.user?.role === 'admin' || (Array.isArray(req.user?.roles) && req.user.roles.includes('admin'));
        if (!info) return fail(res, 'RECRUIT_NOT_FOUND', 404);
        if (!info.isOwner && !isAdmin) return fail(res, 'FORBIDDEN', 403);

        const [items, total] = await Promise.all([
          Application.find({ recruitId: req.query.recruitId })
            .sort({ createdAt: -1 }).skip(skip).limit(limit)
            .populate({ path: 'portfolioId', select: 'nickname displayName headline mainThumbnailUrl thumbnailUrl subThumbnails userId' })
            .lean(),
          Application.countDocuments({ recruitId: req.query.recruitId }),
        ]);

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

        return ok(res, { items: mapped, total, recruit: info.r });
      }

      // 쇼호스트 — 내가 지원한 목록
      if (req.query.mine === '1' || req.query.mine === 'true') {
        const items = await Application.find({ createdBy: req.user.id })
          .sort({ createdAt: -1 }).skip(skip).limit(limit)
          .populate({ path: 'recruitId', match: { type: 'recruit' }, select: 'title brandName closeAt pay fee feeNegotiable payNegotiable' })
          .lean();

        const mapped = items.map(a => ({
          id: a._id.toString(),
          status: a.status,
          message: a.message,
          createdAt: a.createdAt,
          recruit: a.recruitId ? {
            id: a.recruitId?._id?.toString(),
            title: a.recruitId?.title,
            brandName: a.recruitId?.brandName,
            closeAt: a.recruitId?.closeAt,
            pay: a.recruitId?.pay ?? a.recruitId?.fee,
            payNegotiable: a.recruitId?.payNegotiable ?? a.recruitId?.feeNegotiable,
          } : null,
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

/* =========================================
 * GET /:id — 단건 조회 (브랜드 소유 or 본인 지원)
 * =======================================*/
router.get(
  '/:id',
  auth,
  [ param('id').custom(isId) ],
  sendValidation,
  async (req, res) => {
    try {
      const a = await Application.findById(req.params.id)
        .populate({ path: 'portfolioId', select: 'nickname displayName headline mainThumbnailUrl thumbnailUrl subThumbnails userId' })
        .populate({ path: 'recruitId',   match: { type: 'recruit' }, select: 'title brandName createdBy ownerId userId' })
        .lean();
      if (!a) return fail(res, 'NOT_FOUND', 404);

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

/* =========================================
 * PATCH /:id — 상태 변경 (브랜드 소유/관리자)
 * body: { status: 'accepted' | 'rejected' | 'on_hold' }
 * =======================================*/
router.patch(
  '/:id',
  auth,
  [ param('id').custom(isId), body('status').isIn(['accepted','rejected','on_hold']) ],
  sendValidation,
  async (req, res) => {
    try {
      const a = await Application.findById(req.params.id).lean();
      if (!a) return fail(res, 'NOT_FOUND', 404);

      // 이 지원이 속한 recruit의 소유권 확인 (type='recruit')
      const info = await loadRecruitIfOwn(req.user.id, a.recruitId);
      const isAdmin = req.user?.role === 'admin' || (Array.isArray(req.user?.roles) && req.user.roles.includes('admin'));
      if (!info) return fail(res, 'RECRUIT_NOT_FOUND', 404);
      if (!info.isOwner && !isAdmin) return fail(res, 'FORBIDDEN', 403);

      await Application.updateOne({ _id: a._id }, { $set: { status: req.body.status } });
      return ok(res, { id: a._id.toString(), status: req.body.status });
    } catch (err) {
      console.error('[applications-test:patch]', err);
      return fail(res, 'PATCH_FAILED', 500, err.message);
    }
  }
);

module.exports = router;