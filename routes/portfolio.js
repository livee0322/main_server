// routes/portfolio.js (다중 포트폴리오 기능을 위해 재구성됨)
const router = require("express").Router()
const Portfolio = require("../models/Portfolio")
const auth = require("../src/middleware/auth")
const requireRole = require("../src/middleware/requireRole")
const asyncHandler = require("../src/middleware/asyncHandler") // 비동기 에러 핸들링

// ----------------------------------------------------------------
// [신규/변경 API] 쇼호스트 본인 포트폴리오 관리 (다중)
// ----------------------------------------------------------------

/**
 * @route   GET /api/v1/portfolios/my/list
 * @desc    내 모든 포트폴리오 목록 조회 (신설)
 * @access  Private (Showhost)
 */
router.get(
    "/my/list",
    auth,
    requireRole("showhost"),
    asyncHandler(async (req, res) => {
        // 중요: 현재 로그인한 사용자(req.user.id)가 생성한 모든 포트폴리오를 검색합니다.
        const items = await Portfolio.find({ user: req.user.id }).sort({
            createdAt: -1,
        })
        return res.ok({ items })
    })
)

/**
 * @route   POST /api/v1/portfolios
 * @desc    새 포트폴리오 생성 (신설)
 * @access  Private (Showhost)
 */
router.post(
    "/",
    auth,
    requireRole("showhost"),
    asyncHandler(async (req, res) => {
        // 중요: 요청 본문(req.body)에 현재 로그인된 사용자 ID를 추가하여 문서를 생성합니다.
        const payload = { ...req.body, user: req.user.id }
        const created = await Portfolio.create(payload)
        return res.ok(
            {
                message: "포트폴리오가 성공적으로 생성되었습니다.",
                data: created,
            },
            201
        )
    })
)

/**
 * @route   PUT /api/v1/portfolios/:id
 * @desc    특정 포트폴리오 수정 (역할 변경)
 * @access  Private (Showhost)
 */
router.put(
    "/:id",
    auth,
    requireRole("showhost"),
    asyncHandler(async (req, res) => {
        // 중요: portfolioId와 user.id가 모두 일치하는 문서를 찾아 수정합니다.
        // 이를 통해 다른 사람의 포트폴리오를 수정하는 것을 방지합니다.
        const updated = await Portfolio.findOneAndUpdate(
            { _id: req.params.id, user: req.user.id },
            { $set: req.body },
            { new: true } // 수정된 후의 문서를 반환하도록 설정
        )

        if (!updated) {
            return res.fail("PORTFOLIO_FORBIDDEN_EDIT", 403)
        }
        return res.ok({ message: "성공적으로 수정되었습니다.", data: updated })
    })
)

/**
 * @route   DELETE /api/v1/portfolios/:id
 * @desc    특정 포트폴리오 삭제 (신설)
 * @access  Private (Showhost)
 */
router.delete(
    "/:id",
    auth,
    requireRole("showhost"),
    asyncHandler(async (req, res) => {
        // 중요: 수정과 마찬가지로, portfolioId와 user.id가 모두 일치해야만 삭제가 가능합니다.
        const removed = await Portfolio.findOneAndDelete({
            _id: req.params.id,
            user: req.user.id,
        })

        if (!removed) {
            return res.fail("PORTFOLIO_FORBIDDEN_DELETE", 403)
        }
        return res.ok({ message: "성공적으로 삭제되었습니다." })
    })
)

// ----------------------------------------------------------------
// [기존 API] 외부 공개용 포트폴리오 조회
// ----------------------------------------------------------------

/**
 * @route   GET /api/v1/portfolios
 * @desc    공개된 모든 포트폴리오 리스트 조회 (기존 기능 유지)
 * @access  Public
 */
router.get(
    "/",
    asyncHandler(async (req, res) => {
        const page = Math.max(parseInt(req.query.page || "1"), 1)
        const limit = Math.min(parseInt(req.query.limit || "20"), 50)

        const query = { publicScope: "전체공개", status: "published" } // 공개 조건
        // (필요 시 기존 검색 로직 추가)

        const items = await Portfolio.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .select(
                "nickname oneLineIntro mainThumbnailUrl tags experienceYears"
            ) // 목록에 필요한 필드만 선택

        return res.ok({ items })
    })
)

/**
 * @route   GET /api/v1/portfolios/:id
 * @desc    특정 공개 포트폴리오 상세 조회 (기존 기능 유지)
 * @access  Public
 */
router.get(
    "/:id",
    asyncHandler(async (req, res) => {
        // 중요: _id로 문서를 찾고, 공개 조건(publicScope, status)을 만족하는지 확인합니다.
        const doc = await Portfolio.findOne({
            _id: req.params.id,
            publicScope: "전체공개",
            status: "published",
        })

        if (!doc) {
            return res.fail("NOT_FOUND", 404)
        }
        return res.ok({ data: doc })
    })
)

module.exports = router
