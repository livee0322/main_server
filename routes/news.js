const router = require("express").Router()
const News = require("../models/News")
const auth = require("../src/middleware/auth")
const requireRole = require("../src/middleware/requireRole")
const asyncHandler = require("../src/middleware/asyncHandler")
const mongoose = require("mongoose")
const { body, param, validationResult } = require("express-validator")

/**
 * @route   GET /api/v1/news
 * @desc    전체 뉴스 목록을 페이지네이션으로 조회
 * @access  Public
 */
router.get(
    "/",
    asyncHandler(async (req, res) => {
        // 쿼리 파라미터에서 페이지와 리밋 값을 가져오기
        const page = parseInt(req.query.page || "1", 10)
        const limit = parseInt(req.query.limit || "10", 10)
        const skip = (page - 1) * limit

        // 모든 뉴스 문서를 조회하고, 총 개수를 별도로 카운트
        const [items, totalItems] = await Promise.all([
            News.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit),
            News.countDocuments({}),
        ])

        // 조회된 데이터와 페이지네이션 정보를 응답으로 반환
        return res.ok({
            items,
            currentPage: page,
            totalPages: Math.ceil(totalItems / limit),
            totalItems,
        })
    })
)

/**
 * @route   GET /api/v1/news/:id
 * @desc    특정 ID의 뉴스 상세 정보를 조회
 * @access  Public
 */
router.get(
    "/:id",
    asyncHandler(async (req, res) => {
        const { id } = req.params
        if (!mongoose.isValidObjectId(id)) {
            return res.fail("INVALID_ID", 400)
        }
        const newsItem = await News.findById(id)
        if (!newsItem) {
            return res.fail("NOT_FOUND", 404)
        }
        return res.ok({ data: newsItem })
    })
)

/**
 * @route   POST /api/v1/news
 * @desc    새로운 뉴스를 생성
 * @access  Private (Showhost)
 */
router.post(
    "/",
    auth, // 로그인 여부를 확인
    requireRole("showhost"), // 역할이 'showhost'인지 확인
    [
        // 요청 본문의 유효성을 검사
        body("title").notEmpty().withMessage("제목은 필수입니다."),
        body("content").notEmpty().withMessage("내용은 필수입니다."),
        body("imageUrl").optional().isURL(),
    ],
    asyncHandler(async (req, res) => {
        const errors = validationResult(req)
        if (!errors.isEmpty()) {
            return res.fail("VALIDATION_FAILED", 422, {
                errors: errors.array(),
            })
        }
        const { title, content, imageUrl } = req.body
        // 새로운 뉴스 객체를 생성하고 DB에 저장
        const newsItem = await News.create({
            title,
            content,
            imageUrl,
            createdBy: req.user.id,
        })
        return res.ok({ data: newsItem }, 201)
    })
)

/**
 * @route   PUT /api/v1/news/:id
 * @desc    특정 ID의 뉴스를 수정
 * @access  Private (Showhost)
 */
router.put(
    "/:id",
    auth,
    requireRole("showhost"),
    [
        param("id").custom((value) => mongoose.isValidObjectId(value)),
        body("title").optional().notEmpty(),
        body("content").optional().notEmpty(),
        body("imageUrl").optional().isURL(),
    ],
    asyncHandler(async (req, res) => {
        const errors = validationResult(req)
        if (!errors.isEmpty()) {
            return res.fail("VALIDATION_FAILED", 422, {
                errors: errors.array(),
            })
        }
        const { id } = req.params
        // 본인이 작성한 뉴스인지 확인하는 로직이 필요하면 { _id: id, createdBy: req.user.id } 와 같이 추가
        const updatedItem = await News.findByIdAndUpdate(
            id,
            { $set: req.body },
            { new: true }
        )
        if (!updatedItem) {
            return res.fail("NOT_FOUND", 404)
        }
        return res.ok({ data: updatedItem })
    })
)

/**
 * @route   DELETE /api/v1/news/:id
 * @desc    특정 ID의 뉴스를 삭제
 * @access  Private (Showhost)
 */
router.delete(
    "/:id",
    auth,
    requireRole("showhost"),
    [param("id").custom((value) => mongoose.isValidObjectId(value))],
    asyncHandler(async (req, res) => {
        const { id } = req.params
        const removedItem = await News.findByIdAndDelete(id)
        if (!removedItem) {
            return res.fail("NOT_FOUND", 404)
        }
        return res.ok({ message: "뉴스가 성공적으로 삭제되었습니다." })
    })
)

module.exports = router
