'use strict';

const router = require('express').Router();
const { body, param, query, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

const auth = require('../src/middleware/auth');
const requireRole = require('../src/middleware/requireRole');

// 모델 로더(루트/models, src/models 둘 다 지원)
function useModel(name) {
  const cand = [
    path.resolve(__dirname, '../models', name + '.js'),
    path.resolve(__dirname, '../../models', name + '.js'),
  ];
  for (const p of cand) { if (fs.existsSync(p)) return require(p); }
  try { return require('../models/' + name); } catch {}
  return require('../../models/' + name);
}

const Application = useModel('Application-test');
const Recruit    = useModel('Recruit-test');
const Portfolio  = useModel('Portfolio-test');

const badContact = /(email|e-?mail|@|카톡|카카오|kakao|톡|전화|폰|phone|tel|연락|이메일|메일|insta|instagram|dm|디엠)/i;

const isId  = v => typeof v === 'string' && mongoose.isValidObjectId(v);
const asInt = (v, d=0) => (Number.isFinite(+v) && +v >= 0 ? +v : d);
const ok    = (res, data) => res.json({ ok: true, data });
const fail  = (res, code='ERROR', status=400, message) =>
  res.status(status).json({ ok:false, code, message });

const sendValidation = (req,res,next) => {
  const v = validationResult(req);
  if (v.isEmpty()) return next();
  return res.status(422).json({ ok:false, code:'VALIDATION_FAILED', details: v.array({ onlyFirstError:true }) });
};

// 내가 만든 공고인지(브랜드/관리자)
async function assertOwnRecruit(req, res, next) {
  try {
    const r = await Recruit.findById(req.recruitId || req.query.recruitId).lean();
    if (!r) return fail(res, 'RECRUIT_NOT_FOUND', 404);
    const owner = r.createdBy || r.ownerId || r.userId || (r.brand && r.brand.ownerId);
    const isAdmin = req.user?.role === 'admin' || (Array.isArray(req.user?.roles) && req.user.roles.includes('admin'));
    if (String(owner) !== String(req.user.id) && !isAdmin) return fail(res, 'FORBIDDEN', 403);
    req._recruit = r;
    next();
  } catch (e) {
    return fail(res, 'RECRUIT_LOAD_FAILED', 500, e.message);
  }
}

/* ---------------------------------------
 * POST /  (호스트 전용) — 지원 생성
 * -------------------------------------*/
router.post(
  '/',
  auth,
  // ★ host 도 허용 (기존: 'showhost','admin')
  requireRole('host','showhost','admin'),
  [
    body('recruitId').custom(isId),
    body('portfolioId').custom(isId),
    body('message').optional().isString().isLength({ max:800 }).custom(v => !badContact.test(v || '')),
  ],
  sendValidation,
  async (req, res) => {
    try {
      const { recruitId, portfolioId, message = '' } = req.body;

      // 포트폴리오 소유자 확인
      const pf = await Portfolio.findById(portfolioId).lean();
      if (!pf) return fail(res, 'PORTFOLIO_NOT_FOUND', 404);
      const owner = pf.userId || pf.ownerId || pf.createdBy;
      if (String(owner) !== String(req.user.id)) return fail(res, 'FORBIDDEN_PORTFOLIO', 403);

      // 공고 존재 확인
      const r = await Recruit.findById(recruitId).lean();
      if (!r) return fail(res, 'RECRUIT_NOT_FOUND', 404);

      const created = await Application.create({
        recruitId,
        portfolioId,
        message,
        createdBy: req.user.id,
        status: 'pending',
      });
      return res.status(201).json({ ok:true, data:{ id: created.id } });
    } catch (err) {
      if (err?.code === 11000) return fail(res, 'ALREADY_APPLIED', 409, '이미 지원한 공고입니다.');
      console.error('[applications-test:create]', err);
      return fail(res, 'CREATE_FAILED', 500, err.message);
    }
  }
);

/* ---------------------------------------
 * GET /count?recruitId=... — 지원자 수(브랜드)
 *  ※ 목록보다 가볍게 숫자만 필요할 때 사용
 * -------------------------------------*/
router.get(
  '/count',
  auth,
  [ query('recruitId').custom(isId) ],
  sendValidation,
  async (req, res) => {
    try {
      req.recruitId = req.query.recruitId;
      return assertOwnRecruit(req, res, async () => {
        const total = await Application.countDocuments({ recruitId: req.query.recruitId });
        return ok(res, { total });
      });
    } catch (err) {
      console.error('[applications-test:count]', err);
      return fail(res, 'COUNT_FAILED', 500, err.message);
    }
  }
);

/* ---------------------------------------
 * GET /  — 목록
 *  - 브랜드: ?recruitId=... (필수)
 *  - 호스트 : ?mine=1
 * -------------------------------------*/
router.get(
  '/',
  auth,
  [
    query('recruitId').optional().custom(isId),
    query('mine').optional().isIn(['1','true']),
    query('limit').optional().isInt({ min:1, max:100 }),
    query('skip').optional().isInt({ min:0 }),
  ],
  sendValidation,
  async (req, res) => {
    try {
      const limit = asInt(req.query.limit, 50);
      const skip  = asInt(req.query.skip, 0);

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

      if (req.query.mine === '1' || req.query.mine === 'true') {
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

/* ---------------------------------------
 * GET /:id — 단건 조회
 * -------------------------------------*/
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

/* ---------------------------------------
 * PATCH /:id — 상태 변경
 * -------------------------------------*/
router.patch(
  '/:id',
  auth,
  [ param('id').custom(isId), body('status').isIn(['accepted','rejected','on_hold']) ],
  sendValidation,
  async (req, res) => {
    try {
      const a = await Application.findById(req.params.id).lean();
      if (!a) return fail(res, 'NOT_FOUND', 404);

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