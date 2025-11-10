const router = require("express").Router()
const { body, param, validationResult } = require("express-validator")
const auth = require("../src/middleware/auth")
const Shorts = require("../models/Shorts")
const asyncHandler = require("../src/middleware/asyncHandler")
const mongoose = require("mongoose")
const optionalAuth = require("../src/middleware/optionalAuth")

/**
 * @function detectProvider
 * @description URL을 분석하여 어느 플랫폼(youtube, instagram, tiktok)의 영상인지 식별
 * @param {string} url - 검사할 영상의 URL
 * @returns {string} - 'youtube', 'instagram', 'tiktok', 또는 'etc'
 */
const detectProvider = (url = "") => {
    if (/youtube\.com|youtu\.be/i.test(url)) return "youtube"
    if (/instagram\.com/i.test(url)) return "instagram"
    if (/tiktok\.com/i.test(url)) return "tiktok"
    return "etc"
}

/**
 * @route   POST /api/v1/clips
 * @desc    새로운 숏클립을 생성
 * @access  Private
 */
router.post(
    "/",
    auth, // 요청 헤더의 JWT 토큰을 확인하여 로그인된 사용자인지 검증
    [
        // 요청 본문의 'url' 필드가 유효한 URL 형식인지 확인
        body("url").isURL({
            protocols: ["http", "https"],
            require_protocol: true,
        }),
        // 요청 본문의 'title'과 'description'은 선택사항이며, 문자열인지 확인
        body("title").optional().isString(),
        body("description").optional().isString(),
    ],
    asyncHandler(async (req, res) => {
        // 유효성 검사 결과에 에러가 있으면 422 상태 코드로 응답
        const errors = validationResult(req)
        if (!errors.isEmpty()) {
            return res.fail("VALIDATION_FAILED", 422, {
                errors: errors.array(),
            })
        }

        const { url, title, description, thumbnailUrl } = req.body
        const userId = req.user.id // auth 미들웨어로부터 얻은 사용자 ID

        // URL을 분석하여 영상 제공 플랫폼을 결정
        const provider = detectProvider(url)

        // 데이터베이스에 저장할 숏클립 객체를 생성
        const newClip = {
            sourceUrl: url,
            provider,
            title,
            description,
            thumbnailUrl,
            createdBy: userId,
        }

        // Shorts 모델을 사용하여 데이터베이스에 문서를 생성
        const created = await Shorts.create(newClip)

        // 성공적으로 생성되었음을 201 상태 코드와 함께 생성된 데이터를 응답
        return res.ok({ data: created }, 201)
    })
)

/**
 * @route   GET /api/v1/clips
 * @desc    모든 숏클립 목록을 조회하며, 내가 쓴 글인지 여부를 포함
 * @access  Public / Private (로그인 선택)
 */
// 인증 미들웨어를 'auth'에서 'optionalAuth'로 변경하여 비회원도 조회
router.get(
    "/",
    optionalAuth,
    asyncHandler(async (req, res) => {
        // 특정 사용자가 아닌, 모든 사용자의 숏클립을 조회하도록 조건을 제거
        const clips = await Shorts.find({}).sort({ createdAt: -1 }).lean() // lean()을 사용하여 Mongoose 문서를 일반 객체로 변환해 속도 향상 및 수정이 용이

        // 조회된 각 숏클립에 'isMine' 필드를 추가하는 로직
        const items = clips.map((clip) => {
            // optionalAuth 미들웨어를 통해 req.user 객체가 존재하면 로그인된 상태로 간주
            const isLoggedIn = !!req.user

            // 로그인 상태이고, 현재 사용자의 ID와 숏클립의 작성자 ID가 일치하는지 확인
            const isMine = isLoggedIn && String(clip.createdBy) === req.user.id

            // 기존 clip 객체에 isMine 필드를 추가하여 새로운 객체를 반환
            return { ...clip, isMine }
        })

        return res.ok({ items })
    })
)

/**
 * @route   DELETE /api/v1/clips/:id
 * @desc    특정 ID를 가진 숏클립을 삭제
 * @access  Private (본인 확인)
 */
router.delete(
    "/:id",
    auth,
    [param("id").custom((value) => mongoose.isValidObjectId(value))],
    asyncHandler(async (req, res) => {
        const errors = validationResult(req)
        if (!errors.isEmpty()) {
            return res.fail("VALIDATION_FAILED", 422, {
                errors: errors.array(),
            })
        }

        const { id } = req.params
        const userId = req.user.id

        const deletedClip = await Shorts.findOneAndDelete({
            _id: id,
            createdBy: userId,
        })

        if (!deletedClip) {
            return res.fail("FORBIDDEN", 403, {
                userMessage: "해당 숏클립을 삭제할 권한이 없습니다.",
            })
        }

        return res.ok({ message: "숏클립이 성공적으로 삭제되었습니다." })
    })
)

module.exports = router
