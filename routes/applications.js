// /routes/applications.js
const router = require('express').Router();
const { body, query, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const auth = require('../src/middleware/auth');
const requireRole = require('../src/middleware/requireRole');
const Campaign = require('../models/Campaign');
const Application = require('../models/Application');
const asyncHandler = require('../src/middleware/asyncHandler');

// DTO 헬퍼 함수
const toDTO = (doc) => {
    const o = (doc?.toObject ? doc.toObject() : doc) || {};
    return { ...o, id: o._id?.toString?.() || o.id };
};

/* 내 지원 단건 조회 */
router.get('/mine',
    auth,
    query('campaignId').isString().notEmpty(),
    asyncHandler(async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.fail('VALIDATION_FAILED', 422, { errors: errors.array() });

        const { campaignId } = req.query;
        if (!mongoose.isValidObjectId(campaignId)) return res.fail('INVALID_ID', 400);

        const app = await Application.findOne({ campaignId, userId: req.user.id });
        if (!app) return res.ok({ data: null });

        return res.ok({ data: toDTO(app) });
    })
);

/* 지원 생성 */
router.post('/',
    auth,
    body('campaignId').isString().notEmpty(),
    body('profileRef').optional().isString().isLength({ max: 2000 }),
    body('message').optional().isString().isLength({ max: 5000 }),
    asyncHandler(async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.fail('VALIDATION_FAILED', 422, { errors: errors.array() });

        const { campaignId, profileRef, message } = req.body;
        const userId = req.user?.id;

        // null 값이 DB로 전달되지 않도록 방어 로직 추가
        if (!campaignId || !userId) {
            return res.fail('VALIDATION_FAILED', 422, { errors: [{ msg: 'Campaign ID and User ID are required.' }] });
        }
        if (!mongoose.isValidObjectId(campaignId)) return res.fail('INVALID_ID', 400);

        const c = await Campaign.findById(campaignId);
        if (!c) return res.fail('NOT_FOUND', 404);
        if (c.type !== 'recruit') return res.fail('NOT_RECRUIT', 400);

        const deadline = c.recruit?.deadline;
        if (deadline && new Date(deadline) < new Date(new Date().toDateString())) {
            return res.fail('DEADLINE_PASSED', 409);
        }

        // asyncHandler가 에러를 처리하므로 try...catch는 불필요
        const created = await Application.create({
            campaignId, userId, profileRef, message
        });

        return res.ok({ data: toDTO(created) }, 201);
    })
);

/* 특정 캠페인 지원자 목록 (오너/관리자 전용) */
router.get('/',
    auth,
    query('campaignId').isString().notEmpty(),
    asyncHandler(async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.fail('VALIDATION_FAILED', 422, { errors: errors.array() });

        const { campaignId } = req.query;
        if (!mongoose.isValidObjectId(campaignId)) return res.fail('INVALID_ID', 400);

        const camp = await Campaign.findById(campaignId);
        if (!camp) return res.fail('NOT_FOUND', 404);

        const isOwner = String(camp.createdBy) === req.user.id;
        if (!isOwner) return res.fail('FORBIDDEN', 403);

        const items = await Application.find({ campaignId }).populate('portfolio').sort({ createdAt: -1 });
        return res.ok({ items: items.map(toDTO) });
    })
);

/* 상태 변경 (오너/관리자 전용) */
router.patch('/:id',
    auth,
    body('status').isIn(['submitted', 'reviewing', 'shortlisted', 'accepted', 'rejected']),
    asyncHandler(async (req, res) => {
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id)) return res.fail('INVALID_ID', 400);

        const app = await Application.findById(id);
        if (!app) return res.fail('NOT_FOUND', 404);

        const camp = await Campaign.findById(app.campaignId);
        if (!camp) return res.fail('NOT_FOUND', 404);

        const isOwner = String(camp.createdBy) === req.user.id;
        if (!isOwner) return res.fail('FORBIDDEN', 403);

        app.status = req.body.status;
        await app.save();
        return res.ok({ data: toDTO(app) });
    })
);

module.exports = router;