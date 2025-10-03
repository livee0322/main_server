const router = require("express").Router()
const { body, query, validationResult } = require("express-validator")
const sanitizeHtml = require("sanitize-html")
const { isValidObjectId } = require("mongoose")

// [수정] Campaign 모델 전체를 가져오도록 변경
const Campaign = require("../models/Campaign")
const Application = require("../models/Application")

const auth = require("../src/middleware/auth")
const optionalAuth = require("../src/middleware/optionalAuth")
const requireRole = require("../src/middleware/requireRole")
const { toThumb, toDTO } = require("../src/utils/common")
const { find: _find, findOne } = require("../models/Application")

const sanitize = (html) =>
    sanitizeHtml(html || "", {
        allowedTags: sanitizeHtml.defaults.allowedTags.concat([
            "img",
            "h1",
            "h2",
            "u",
            "span",
            "figure",
            "figcaption",
        ]),
        allowedAttributes: {
            "*": ["style", "class", "id", "src", "href", "alt", "title"],
        },
        allowedSchemes: ["http", "https", "data", "mailto", "tel"],
    })

/**
 * @route   GET /api/v1/campaigns/meta
 * @desc    공고 생성 및 검색에 필요한 메타데이터(카테고리, 브랜드 목록 등)를 제공합니다.
 * @access  Public
 */
router.get("/meta", async (req, res) => {
    // [주석] 현재는 카테고리 목록을 하드코딩하여 제공합니다.
    const productCats = [
        "뷰티",
        "가전",
        "음식",
        "패션",
        "리빙",
        "생활",
        "디지털",
    ]
    const recruitCats = ["뷰티", "가전", "음식", "패션", "리빙", "일반"]
    // [주석] DB에서 기존에 등록된 브랜드 목록을 집계하여 상위 50개를 가져옵니다.
    const brands = await Campaign.aggregate([
        { $match: { brandName: { $exists: true, $ne: "" } } },
        { $group: { _id: "$brandName", count: { $sum: 1 } } },
        { $project: { _id: 0, name: "$_id", count: 1 } },
        { $sort: { count: -1, name: 1 } },
        { $limit: 50 },
    ]).catch(() => [])

    return res.ok({
        data: {
            categories: { product: productCats, recruit: recruitCats },
            brands,
            updatedAt: new Date().toISOString(),
        },
    })
})

/**
 * @route   POST /api/v1/campaigns
 * @desc    새로운 모집 공고를 생성합니다.
 * @access  Private (brand, admin 역할만 가능)
 */
router.post(
    "/",
    auth, // 1. 로그인 여부 확인
    requireRole("brand", "admin"), // 2. 'brand' 또는 'admin' 역할인지 확인
    [
        // 3. 요청 데이터의 유효성을 검사하는 규칙 정의
        body("isPublic", "공개 여부는 boolean 값이어야 합니다.")
            .optional()
            .isBoolean(),
        body("brandName", "브랜드명을 입력해주세요.").notEmpty().isString(),
        body("prefix", "올바른 말머리를 선택해주세요.")
            .optional()
            .isIn(["쇼호스트모집", "촬영스태프", "모델모집", "기타모집"]),
        body("title", "제목을 입력해주세요.").notEmpty().isString(),
        body("content", "내용은 문자열이어야 합니다.").optional().isString(),
        body("category", "올바른 카테고리를 선택해주세요.")
            .optional()
            .isIn(["뷰티", "패션", "식품", "가전", "생활/리빙"]),
        body("shootDate", "촬영일을 올바른 날짜 형식으로 입력해주세요.")
            .notEmpty()
            .isISO8601(),
        body("closeAt", "공고 마감일을 올바른 날짜 형식으로 입력해주세요.")
            .notEmpty()
            .isISO8601(),
        body("durationHours", "총 촬영시간을 숫자로 입력해주세요.")
            .notEmpty()
            .isNumeric(),
        body("startTime", "시작 시간을 입력해주세요.").notEmpty().isString(),
        body("endTime", "종료 시간을 입력해주세요.").notEmpty().isString(),
        body("fee", "출연료는 숫자로 입력해주세요.").optional().isNumeric(),
        body("feeNegotiable", "출연료 협의 여부는 boolean 값이어야 합니다.")
            .optional()
            .isBoolean(),
        body("coverImageUrl", "대표 이미지 URL 형식이 올바르지 않습니다.")
            .optional()
            .isURL(),
    ],
    // 4. 실제 API 로직을 처리하는 비동기 함수
    async (req, res) => {
        // 유효성 검사 결과에 에러가 있는지 확인
        const errors = validationResult(req)
        if (!errors.isEmpty()) {
            return res.fail("VALIDATION_FAILED", 422, {
                errors: errors.array(),
            })
        }

        // 요청 본문(body)에서 필요한 데이터만 안전하게 추출
        const {
            brandName,
            prefix,
            title,
            content,
            category,
            location,
            shootDate,
            closeAt,
            durationHours,
            startTime,
            endTime,
            fee,
            feeNegotiable,
            coverImageUrl,
            isPublic,
            liveVerticalCoverUrl,
            liveStreamUrl,
            productThumbnailUrl,
            productName,
            productUrl,
        } = req.body

        // DB에 저장할 최종 데이터 객체(payload)를 구성
        const payload = {
            brandName,
            prefix,
            title,
            content,
            category,
            location,
            shootDate,
            closeAt,
            durationHours,
            startTime,
            endTime,
            fee,
            feeNegotiable,
            coverImageUrl,
            isPublic: isPublic === false ? false : true,
            liveVerticalCoverUrl,
            liveStreamUrl,
            productThumbnailUrl,
            productName,
            productUrl,
            createdBy: req.user.id,
        }

        // 내용(content)에 HTML이 있다면, 보안을 위해 안전하게 처리(sanitize)
        if (payload.content) {
            payload.content = sanitize(payload.content)
        }
        // 대표 이미지가 있고 썸네일이 없다면, 썸네일을 자동으로 생성
        if (payload.coverImageUrl && !payload.thumbnailUrl) {
            payload.thumbnailUrl = toThumb(payload.coverImageUrl)
        }

        const created = await Campaign.create(payload)
        return res.ok({ data: toDTO(created) }, 201)
    }
)

/**
 * @route   GET /api/v1/campaigns
 * @desc    모집 공고 목록을 검색, 정렬, 페이지네이션하여 조회합니다.
 * @access  Public (비로그인도 가능)
 */
router.get("/", optionalAuth, async (req, res) => {
    // 페이지네이션 설정
    const page = Math.max(parseInt(req.query.page || "1", 10), 1)
    const limit = Math.min(
        Math.max(parseInt(req.query.limit || "10", 10), 1),
        50
    )

    // 기본 쿼리 조건: '게시(published)' 상태인 공고만 조회
    const q = {
        isPublic: true, // 1. 공개 상태인 공고만 조회
        closeAt: { $gte: new Date() }, // 2. 마감일이 아직 지나지 않은 공고만 조회
    }

    // 검색어(search) 쿼리가 있으면, 제목/내용/브랜드명에서 검색
    if (req.query.search) {
        const searchTerm = String(req.query.search)
        q.$or = [
            { title: { $regex: searchTerm, $options: "i" } },
            { content: { $regex: searchTerm, $options: "i" } }, // [수정] descriptionHTML -> content
            { brandName: { $regex: searchTerm, $options: "i" } }, // [수정] brand -> brandName
        ]
    }

    // 정렬(sort) 옵션 설정
    const sortOption = {}
    if (req.query.sort === "deadline") {
        sortOption.closeAt = 1 // 마감일순
    } else {
        sortOption.createdAt = -1 // 최신순 (기본)
    }

    // 데이터베이스에서 공고 목록과 전체 개수를 동시에 조회
    const [docs, totalItems] = await Promise.all([
        Campaign.find(q)
            .sort(sortOption)
            .skip((page - 1) * limit)
            .limit(limit),
        Campaign.countDocuments(q),
    ])

    // 로그인한 사용자의 경우, 각 공고에 대한 지원 여부를 확인
    let appliedCampaignIds = new Set()
    if (req.user) {
        const userApplications = await Application.find({
            userId: req.user.id,
        }).select("campaignId")
        appliedCampaignIds = new Set(
            userApplications.map((app) => app.campaignId.toString())
        )
    }

    // 응답 데이터를 프론트엔드 형식(DTO)에 맞게 가공
    const items = docs.map((doc) => {
        const dto = toDTO(doc)
        dto.isAd = false
        dto.isApplied = appliedCampaignIds.has(doc._id.toString())
        return dto
    })

    // 최종 응답 반환
    return res.ok({
        items,
        currentPage: page,
        totalPages: Math.ceil(totalItems / limit),
        totalItems,
    })
})

/**
 * @route   GET /api/v1/campaigns/mine
 * @desc    현재 로그인된 사용자가 생성한 모든 공고 목록을 조회합니다.
 * @access  Private (brand, admin 역할만 가능)
 */
router.get("/mine", auth, requireRole("brand", "admin"), async (req, res) => {
    const docs = await Campaign.find({ createdBy: req.user.id }).sort({
        createdAt: -1,
    })
    return res.ok({ items: docs.map(toDTO) })
})

/**
 * @route   GET /api/v1/campaigns/:id
 * @desc    특정 ID의 공고 상세 정보를 조회합니다.
 * @access  Public (비공개 글은 본인만)
 */
router.get("/:id", optionalAuth, async (req, res) => {
    const { id } = req.params
    // ID 형식 유효성 검사
    if (!isValidObjectId(id)) {
        return res.fail("INVALID_ID", 400)
    }
    const c = await Campaign.findById(id)
    if (!c) return res.fail("NOT_FOUND", 404)

    // 소유자 여부 판별
    const isOwner = req.user && String(c.createdBy) === req.user.id
    // 비공개(published가 아님) 공고는 소유자만 접근 가능
    if (!isOwner && c.status !== "published") {
        return res.fail("FORBIDDEN", 403)
    }

    // 로그인 시, 현재 사용자의 지원 여부 조회
    let isApplied = false
    if (req.user) {
        const application = await Application.findOne({
            userId: req.user.id,
            campaignId: c._id,
        })
        isApplied = !!application
    }

    // 최종 응답 데이터에 isApplied 필드를 추가하여 반환
    const dto = toDTO(c)
    dto.isApplied = isApplied
    return res.ok({ data: dto }) // [수정] toDTO(c) -> dto
})

/**
 * @route   PUT /api/v1/campaigns/:id
 * @desc    특정 ID의 공고 정보를 수정합니다.
 * @access  Private (작성자 본인만 가능)
 */
router.put("/:id", auth, requireRole("brand", "admin"), async (req, res) => {
    const { id } = req.params
    if (!isValidObjectId(id)) return res.fail("INVALID_ID", 400)

    // '게시' 상태로 변경 시 커버 이미지 필수 여부 검증
    if (req.body.status === "published") {
        const campaign = await Campaign.findById(id)
        if (!campaign.coverImageUrl && !req.body.coverImageUrl) {
            return res.fail("COVER_IMAGE_REQUIRED", 400)
        }
    }

    // 요청 본문을 기반으로 업데이트할 데이터($set)를 구성
    const $set = { ...req.body }
    // 대표 이미지가 변경되면 썸네일도 자동 업데이트
    if ($set.coverImageUrl && !$set.thumbnailUrl)
        $set.thumbnailUrl = toThumb($set.coverImageUrl)
    // 내용(content)이 변경되면 HTML Sanitize 처리
    if ($set.content) {
        $set.content = sanitize($set.content)
    }

    // DB에서 해당 ID와 작성자가 일치하는 문서를 찾아 업데이트
    const updated = await Campaign.findOneAndUpdate(
        { _id: id, createdBy: req.user.id },
        { $set },
        { new: true } // 업데이트된 결과를 반환하도록 설정
    )
    if (!updated) return res.fail("RECRUIT_FORBIDDEN_EDIT", 403)
    return res.ok({ data: toDTO(updated) })
})

/**
 * @route   DELETE /api/v1/campaigns/:id
 * @desc    특정 ID의 공고를 삭제합니다.
 * @access  Private (작성자 본인만 가능)
 */
router.delete("/:id", auth, requireRole("brand", "admin"), async (req, res) => {
    const { id } = req.params
    if (!isValidObjectId(id)) return res.fail("INVALID_ID", 400)

    // DB에서 해당 ID와 작성자가 일치하는 문서를 찾아 삭제
    const removed = await Campaign.findOneAndUpdate(
        { _id: id, createdBy: req.user.id }, // 본인이 작성한 공고인지 확인
        { $set: { isPublic: false } }, // isPublic을 false로 변경
        { new: true }
    )

    // 업데이트할 문서를 찾지 못하면 권한이 없거나 존재하지 않는 공고임
    if (!removed) return res.fail("RECRUIT_FORBIDDEN_DELETE", 403)
    return res.ok({ message: "삭제 완료" })
})

module.exports = router