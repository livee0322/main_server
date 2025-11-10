const router = require("express").Router()
const Studio = require("../models/Studio")
const asyncHandler = require("../src/middleware/asyncHandler")
const mongoose = require("mongoose")

/**
 * @route   POST /api/v1/studios
 * @desc    새로운 스튜디오 정보를 생성
 * @access  Public (인증 없음)
 */
router.post(
    "/",
    asyncHandler(async (req, res) => {
        // 요청 본문(body)의 데이터를 사용하여 새로운 스튜디오 문서를 생성
        const created = await Studio.create(req.body)
        // 성공 응답(201)과 함께 생성된 스튜디오 정보를 반환
        return res.ok({ data: created }, 201)
    })
)

/**
 * @route   PUT /api/v1/studios/:id
 * @desc    특정 ID를 가진 스튜디오 정보를 수정
 * @access  Public (인증 없음)
 */
router.put(
    "/:id",
    asyncHandler(async (req, res) => {
        const { id } = req.params // URL 경로에서 수정할 스튜디오의 ID를 가져오기

        // ID 형식이 유효한지 확인
        if (!mongoose.isValidObjectId(id)) {
            return res.fail("INVALID_ID", 400)
        }

        // 해당 ID의 스튜디오를 찾아 요청 본문의 내용으로 업데이트
        const updated = await Studio.findByIdAndUpdate(
            id,
            { $set: req.body },
            { new: true } // 수정된 후의 문서를 반환하도록 설정
        )

        // 업데이트할 스튜디오가 없으면 404 에러를 반환
        if (!updated) {
            return res.fail("NOT_FOUND", 404)
        }

        // 성공 응답과 함께 수정된 스튜디오 정보를 반환
        return res.ok({ data: updated })
    })
)

/**
 * @route   GET /api/v1/studios/:id
 * @desc    특정 ID를 가진 스튜디오 정보를 조회
 * @access  Public (인증 없음)
 */
router.get(
    "/:id",
    asyncHandler(async (req, res) => {
        const { id } = req.params // URL 경로에서 조회할 스튜디오의 ID를 가져오기

        // ID 형식이 유효한지 확인
        if (!mongoose.isValidObjectId(id)) {
            return res.fail("INVALID_ID", 400)
        }

        // 해당 ID의 스튜디오를 찾기
        const studio = await Studio.findById(id)

        // 스튜디오를 찾지 못한 경우, 404 에러를 반환
        if (!studio) {
            return res.fail("NOT_FOUND", 404)
        }

        // 성공 응답과 함께 조회된 스튜디오 정보를 반환
        return res.ok({ data: studio })
    })
)

module.exports = router