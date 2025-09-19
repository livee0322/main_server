const router = require("express").Router()
const Model = require("../models/Model")
const auth = require("../src/middleware/auth")
const requireRole = require("../src/middleware/requireRole")
const asyncHandler = require("../src/middleware/asyncHandler")
const mongoose = require("mongoose")

/**
 * @route   POST /api/v1/models
 * @desc    새로운 모델 프로필을 생성
 * @access  Private (Showhost)
 */
router.post(
    "/",
    auth, // 사용자가 로그인했는지 JWT 토큰을 통해 확인
    requireRole("showhost"), // 사용자의 역할이 'showhost'인지 확인
    asyncHandler(async (req, res) => {
        // 요청 본문(body)에 현재 로그인된 사용자 ID를 추가하여 모델 데이터를 구성
        const payload = { ...req.body, user: req.user.id }
        // 구성된 데이터를 사용하여 데이터베이스에 새로운 모델 문서를 생성
        const created = await Model.create(payload)

        // 성공 응답(201)과 함께 생성된 모델 정보를 반환
        return res.ok({ data: created }, 201)
    })
)

/**
 * @route   GET /api/v1/models
 * @desc    공개된 전체 모델 목록을 페이지네이션으로 조회
 * @access  Public
 */
router.get(
    "/",
    asyncHandler(async (req, res) => {
        // 쿼리 파라미터에서 페이지와 리밋 값을 가져와 정수로 변환
        const page = parseInt(req.query.page || "1", 10)
        const limit = parseInt(req.query.limit || "20", 10)
        const skip = (page - 1) * limit // 건너뛸 문서 수를 계산

        // 공개 상태인 모든 모델 문서를 조회하고, 총 개수를 별도로 카운트
        const [items, totalItems] = await Promise.all([
            Model.find({ status: "published" })
                .sort({ createdAt: -1 }) // 최신순으로 정렬
                .skip(skip)
                .limit(limit),
            Model.countDocuments({ status: "published" }),
        ])

        // 조회된 데이터와 함께 페이지네이션 정보를 응답으로 반환
        return res.ok({
            items,
            currentPage: page,
            totalPages: Math.ceil(totalItems / limit),
            totalItems,
        })
    })
)

/**
 * @route   GET /api/v1/models/:id
 * @desc    id와 일치하는 특정 모델 1명의 모든 상세 정보를 조회
 * @access  Public
 */
router.get(
    "/:id",
    asyncHandler(async (req, res) => {
        const { id } = req.params // URL 경로에서 조회할 모델의 ID를 가져오기

        // URL로 받은 id가 유효한 MongoDB ObjectId 형식인지 검사합니다.
        if (!mongoose.isValidObjectId(id)) {
            return res.fail("INVALID_ID", 400) // 유효하지 않으면 400 에러
        }

        // 데이터베이스에서 해당 ID를 가진 모델을 찾기
        const model = await Model.findById(id)

        // 모델을 찾지 못한 경우, 404 Not Found 에러
        if (!model) {
            return res.fail("NOT_FOUND", 404)
        }

        // 성공적으로 모델을 찾은 경우, 해당 모델의 정보를 반환
        return res.ok({ data: model })
    })
)

/**
 * @route   DELETE /api/v1/models/:id
 * @desc    특정 ID를 가진 모델 프로필을 삭제
 * @access  Private (Owner)
 */
router.delete(
    "/:id",
    auth, // 사용자가 로그인했는지 확인
    asyncHandler(async (req, res) => {
        const { id } = req.params // URL 경로에서 삭제할 모델의 ID를 가져오기
        const userId = req.user.id // JWT 토큰에서 현재 로그인한 사용자의 ID를 가져오기

        // ID 형식이 유효한지 확인합니다.
        if (!mongoose.isValidObjectId(id)) {
            return res.fail("INVALID_ID", 400)
        }

        // 모델 ID와 사용자 ID가 모두 일치하는 문서를 찾아서 삭제 (본인 확인)
        const removed = await Model.findOneAndDelete({ _id: id, user: userId })

        // 삭제된 문서가 없으면, 권한이 없거나 존재하지 않는 모델임을 의미
        if (!removed) {
            return res.fail("FORBIDDEN", 403, {
                userMessage: "해당 모델을 삭제할 권한이 없습니다.",
            })
        }

        // 성공적으로 삭제되었음을 알리는 메시지를 반환
        return res.ok({ message: "모델 프로필이 성공적으로 삭제되었습니다." })
    })
)

module.exports = router
