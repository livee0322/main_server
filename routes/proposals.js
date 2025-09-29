const router = require("express").Router()
const { body, validationResult } = require("express-validator")
const mongoose = require("mongoose")
const Proposal = require("../models/Proposal")
const Portfolio = require("../models/Portfolio")
const auth = require("../src/middleware/auth")
const requireRole = require("../src/middleware/requireRole")
const asyncHandler = require("../src/middleware/asyncHandler")

/**
 * @route   POST /api/v1/proposals
 * @desc    쇼호스트에게 새로운 섭외 제안을 생성
 * @access  Private (Brand)
 */
router.post(
    "/",
    auth, // 사용자가 로그인했는지 JWT 토큰을 통해 확인
    requireRole("brand"), // 사용자의 역할이 'brand'인지 확인
    [
        // --- 요청 본문(Body)의 유효성을 검사하는 규칙을 정의 ---
        body("targetPortfolioId", "제안 대상을 지정해주세요.").isMongoId(),
        body("brandName", "브랜드명을 입력해주세요.").notEmpty().trim(),
        body("shootingDate", "촬영 희망일을 입력해주세요.")
            .isISO8601()
            .toDate(),
        body("replyDeadline", "제안 답장 기한을 입력해주세요.")
            .isISO8601()
            .toDate(),
        body(
            "isFeeNegotiable",
            "출연료 협의 가능 여부를 선택해주세요."
        ).isBoolean(),
        body("content", "제안 내용은 최대 800자까지 입력 가능합니다.")
            .optional()
            .isLength({ max: 800 }),
        body("fee", "출연료는 숫자로 입력해주세요.").optional().isNumeric(),
    ],
    asyncHandler(async (req, res) => {
        // 유효성 검사 결과에 에러가 있으면 400 Bad Request 응답
        const errors = validationResult(req)
        if (!errors.isEmpty()) {
            return res.fail("VALIDATION_FAILED", 400, {
                userMessage: errors.array()[0].msg, // 첫 번째 에러 메시지를 사용자에게 보여주기
            })
        }

        const { targetPortfolioId, ...proposalData } = req.body
        const proposerId = req.user.id // 제안을 보내는 사람(브랜드)의 ID

        // 1. 제안을 받을 쇼호스트의 포트폴리오가 실제로 존재하는지 확인
        const targetPortfolio = await Portfolio.findById(targetPortfolioId)
        if (!targetPortfolio) {
            return res.fail("NOT_FOUND", 404, {
                userMessage: "제안 대상을 찾을 수 없습니다.",
            })
        }

        // 2. 데이터베이스에 저장할 제안 객체를 생성
        const newProposal = {
            ...proposalData,
            targetPortfolioId,
            proposerId,
            targetShowhostId: targetPortfolio.user, // 포트폴리오 소유자의 User ID를 저장
        }

        // 3. 생성된 제안을 데이터베이스에 저장
        await Proposal.create(newProposal)

        // 4. 성공 응답(201)을 보내기
        return res.ok({ message: "제안이 성공적으로 전송되었습니다." }, 201)
    })
)

module.exports = router
