const router = require("express").Router()
const { body, validationResult } = require("express-validator")
const mongoose = require("mongoose")
const Proposal = require("../models/Proposal")
const Portfolio = require("../models/Portfolio")
const auth = require("../src/middleware/auth")
const requireRole = require("../src/middleware/requireRole")
const asyncHandler = require("../src/middleware/asyncHandler")
const User = require("../models/User")

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

/**
 * @route   GET /api/v1/proposals/sent
 * @desc    현재 로그인된 브랜드 회원이 보낸 모든 제안 목록을 조회
 * @access  Private (Brand)
 */
router.get(
    "/sent",
    auth, // 사용자가 로그인했는지 확인합니다.
    requireRole("brand"), // 사용자의 역할이 'brand'인지 확인
    asyncHandler(async (req, res) => {
        // --- 1. 필터링 및 페이지네이션 준비 ---
        const { status, page = 1, limit = 10 } = req.query
        const skip = (parseInt(page) - 1) * parseInt(limit)

        // 기본적으로 현재 로그인한 사용자가 보낸(proposerId) 제안만 조회하도록 조건을 설정
        const query = { proposerId: req.user.id }
        // status 쿼리 파라미터가 있으면, 해당 상태의 제안만 필터링하도록 조건을 추가
        if (status) {
            query.status = status
        }

        // --- 2. 데이터베이스 조회 ---
        // 조건에 맞는 제안 목록과 전체 개수를 동시에 조회
        const [proposals, totalItems] = await Promise.all([
            Proposal.find(query)
                .populate("targetShowhostId", "name") // 제안 받은 쇼호스트의 이름(name)을 가져오기 위해 User 모델을 참조
                .sort({ createdAt: -1 }) // 최신순으로 정렬
                .skip(skip)
                .limit(parseInt(limit)),
            Proposal.countDocuments(query),
        ])

        // --- 3. 프론트엔드 응답 형식에 맞게 데이터 가공 ---
        const items = proposals.map((p) => {
            // 날짜를 'YYYY. MM. DD' 형식으로 변환하는 헬퍼 함수
            const formatDate = (date) =>
                new Date(date)
                    .toLocaleDateString("ko-KR", {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                    })
                    .replace(/\s/g, "")
                    .slice(0, -1)

            return {
                id: p._id,
                recipient: {
                    name: p.targetShowhostId?.name || "알 수 없음", // populate 된 쇼호스트의 이름을 사용
                    portfolioId: p.targetPortfolioId,
                },
                content: p.content,
                status: p.status,
                sentAt: p.createdAt, // 보낸 시각
                fee: p.fee,
                isFeeNegotiable: p.isFeeNegotiable,
                schedule: `${formatDate(p.shootingDate)}. ${
                    p.shootingTime || ""
                } / ${p.location || ""}`, // 일정/장소 문자열 조합
                replyDeadline: formatDate(p.replyDeadline), // 답장 기한
            }
        })

        // --- 4. 최종 응답 반환 ---
        return res.ok({
            items,
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalItems / parseInt(limit)),
            totalItems,
        })
    })
)

/**
 * @route   GET /api/v1/proposals/received
 * @desc    현재 로그인된 쇼호스트가 받은 모든 제안 목록을 조회
 * @access  Private (Showhost)
 */
router.get(
    "/received",
    auth, // 사용자가 로그인했는지 확인
    requireRole("showhost"), // 사용자의 역할이 'showhost'인지 확인
    asyncHandler(async (req, res) => {
        // --- 1. 필터링 및 페이지네이션 준비 ---
        const { status, page = 1, limit = 10 } = req.query
        const skip = (parseInt(page) - 1) * parseInt(limit)

        // 기본적으로 현재 로그인한 쇼호스트가 받은(targetShowhostId) 제안만 조회하도록 조건을 설정
        const query = { targetShowhostId: req.user.id }
        if (status) {
            query.status = status
        }

        // --- 2. 데이터베이스 조회 ---
        const [proposals, totalItems] = await Promise.all([
            Proposal.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit)),
            Proposal.countDocuments(query),
        ])

        // --- 3. 프론트엔드 응답 형식에 맞게 데이터 가공 ---
        const items = proposals.map((p) => {
            const formatDate = (date) =>
                new Date(date)
                    .toLocaleDateString("ko-KR", {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                    })
                    .replace(/\s/g, "")
                    .slice(0, -1)
            return {
                id: p._id,
                sender: {
                    // 제안 보낸 사람 정보
                    brandName: p.brandName,
                },
                content: p.content,
                status: p.status,
                sentAt: p.createdAt,
                fee: p.fee,
                isFeeNegotiable: p.isFeeNegotiable,
                schedule: `${formatDate(p.shootingDate)}. ${
                    p.shootingTime || ""
                } / ${p.location || ""}`,
                replyDeadline: formatDate(p.replyDeadline),
            }
        })

        // --- 4. 최종 응답 반환 ---
        return res.ok({
            items,
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalItems / parseInt(limit)),
            totalItems,
        })
    })
)

/**
 * @route   PATCH /api/v1/proposals/:id/withdraw
 * @desc    [신규] 브랜드가 보낸 제안을 철회
 * @access  Private (Brand - 제안자 본인)
 */
router.patch(
    "/:id/withdraw",
    auth, // 사용자가 로그인했는지 확인
    requireRole("brand"), // 사용자의 역할이 'brand'인지 확인
    asyncHandler(async (req, res) => {
        const { id } = req.params
        if (!mongoose.isValidObjectId(id)) {
            return res.fail("INVALID_ID", 400)
        }

        // 1. 제안을 찾기
        const proposal = await Proposal.findById(id)
        if (!proposal) {
            return res.fail("NOT_FOUND", 404)
        }

        // 2. 제안을 보낸 사람(proposerId)이 현재 로그인한 사용자와 일치하는지 확인
        if (String(proposal.proposerId) !== req.user.id) {
            return res.fail("FORBIDDEN", 403, {
                userMessage: "제안을 철회할 권한이 없습니다.",
            })
        }

        // 3. 제안의 상태가 'pending'(대기중)일 때만 철회가 가능
        if (proposal.status !== "pending") {
            return res.fail("BAD_REQUEST", 400, {
                userMessage: "대기중인 제안만 철회할 수 있습니다.",
            })
        }

        // 4. 제안 상태를 'withdrawn'(철회됨)으로 변경하고 저장
        proposal.status = "withdrawn"
        await proposal.save()

        return res.ok({ message: "제안이 성공적으로 철회되었습니다." })
    })
)

module.exports = router
