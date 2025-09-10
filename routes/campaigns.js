const router = require("express").Router()
const { body, query, validationResult } = require("express-validator")
const sanitizeHtml = require("sanitize-html")
const mongoose = require("mongoose")
const Campaign = require("../models/Campaign")
const auth = require("../src/middleware/auth")
const optionalAuth = require("../src/middleware/optionalAuth")
const requireRole = require("../src/middleware/requireRole")
const { toThumb, toDTO } = require("../src/utils/common")

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

/* Meta */
router.get("/meta", async (req, res) => {
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
    const brands = await Campaign.aggregate([
        { $match: { brand: { $exists: true, $ne: "" } } },
        { $group: { _id: "$brand", count: { $sum: 1 } } },
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

/* Create */
router.post(
    "/",
    auth,
    requireRole("brand", "admin"),
    body("type").isIn(["product", "recruit"]),
    body("title").isLength({ min: 1 }),
    async (req, res) => {
        const errors = validationResult(req)
        if (!errors.isEmpty())
            return res.fail("VALIDATION_FAILED", "VALIDATION_FAILED", 422, {
                errors: errors.array(),
            })

        const payload = { ...req.body, createdBy: req.user.id }
        // '게시' 상태로 바로 생성 시 이미지 URL 필수 검증
        if (payload.status === "published" && !payload.coverImageUrl) {
            return res.fail(
                "게시 상태의 캠페인에는 커버 이미지가 반드시 필요합니다.",
                "COVER_IMAGE_REQUIRED",
                400
            )
        }
        if (payload.coverImageUrl && !payload.thumbnailUrl)
            payload.thumbnailUrl = toThumb(payload.coverImageUrl)
        if (payload.descriptionHTML)
            payload.descriptionHTML = sanitize(payload.descriptionHTML)

        const created = await Campaign.create(payload)
        return res.ok({ data: toDTO(created) }, 201)
    }
)

/* List (검색, 정렬, 페이지네이션 기능 추가) */
router.get(
    "/",
    // 쿼리 파라미터 유효성 검사 추가 (선택사항이지만 안정성을 위해 추천)
    query("sort").optional().isIn(["latest", "deadline"]),
    async (req, res) => {
        // 1. 페이지네이션 파라미터 처리 (기본값 설정)
        const page = Math.max(parseInt(req.query.page || "1", 10), 1)
        const limit = Math.min(
            Math.max(parseInt(req.query.limit || "10", 10), 1),
            50
        ) // 기본값 10

        // 2. 기본 쿼리 조건 설정 (게시된 모집 공고)
        const q = { type: "recruit", status: "published" }

        // 3. 검색어(search) 처리
        if (req.query.search) {
            const searchTerm = String(req.query.search)
            q.$or = [
                { title: { $regex: searchTerm, $options: "i" } },
                { descriptionHTML: { $regex: searchTerm, $options: "i" } },
                { brand: { $regex: searchTerm, $options: "i" } },
            ]
        }

        // 4. 정렬(sort) 처리
        const sortOption = {}
        if (req.query.sort === "deadline") {
            // 마감일이 null이 아닌 문서를 우선하고, 마감일이 빠른 순으로 정렬
            sortOption.closeAt = 1
        } else {
            // 기본값은 최신순
            sortOption.createdAt = -1
        }

        // 5. 데이터베이스에서 데이터 조회 및 총 개수 카운트
        const [docs, totalItems] = await Promise.all([
            Campaign.find(q)
                .sort(sortOption)
                .skip((page - 1) * limit)
                .limit(limit),
            Campaign.countDocuments(q),
        ])

        // 6. 응답 데이터 가공 (isAd 필드 추가)
        const items = docs.map((doc) => {
            const dto = toDTO(doc)
            dto.isAd = false // 현재 광고 로직이 없으므로 false로 고정
            return dto
        })

        // 7. 새로운 응답 형식으로 반환
        return res.ok({
            items,
            currentPage: page,
            totalPages: Math.ceil(totalItems / limit),
            totalItems,
        })
    }
)

/* Mine */
router.get("/mine", auth, requireRole("brand", "admin"), async (req, res) => {
    const docs = await Campaign.find({ createdBy: req.user.id }).sort({
        createdAt: -1,
    })
    return res.ok({ items: docs.map(toDTO) })
})

/* Read */
router.get("/:id", optionalAuth, async (req, res) => {
    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) {
        return res.fail("INVALID_ID", "INVALID_ID", 400)
    }
    const c = await Campaign.findById(id)
    if (!c) return res.fail("NOT_FOUND", "NOT_FOUND", 404)

    // req.user가 있을 때만 isOwner를 판별
    // 비공개 상태(published가 아님)의 캠페인은 소유자만 볼 수 있도록 하는 로직은 그대로 유지
    const isOwner = req.user && String(c.createdBy) === req.user.id
    if (!isOwner && c.status !== "published") {
        return res.fail("FORBIDDEN", "FORBIDDEN", 403)
    }
    return res.ok({ data: toDTO(c) })
})

/* Update */
router.put("/:id", auth, requireRole("brand", "admin"), async (req, res) => {
    const { id } = req.params
    if (!mongoose.isValidObjectId(id))
        return res.fail("INVALID_ID", "INVALID_ID", 400)

    // '게시' 상태로 변경 시 이미지 URL 필수 검증
    if (req.body.status === "published") {
        const campaign = await Campaign.findById(id)
        // DB에 저장된 이미지 URL도 없고, 새로 업데이트되는 값도 없을 경우 에러 처리
        if (!campaign.coverImageUrl && !req.body.coverImageUrl) {
            return res.fail(
                "게시 상태로 변경하려면 커버 이미지가 반드시 필요합니다.",
                "COVER_IMAGE_REQUIRED",
                400
            )
        }
    }

    const $set = { ...req.body }
    if ($set.coverImageUrl && !$set.thumbnailUrl)
        $set.thumbnailUrl = toThumb($set.coverImageUrl)
    if ($set.descriptionHTML)
        $set.descriptionHTML = sanitize($set.descriptionHTML)

    const updated = await Campaign.findOneAndUpdate(
        { _id: id, createdBy: req.user.id },
        { $set },
        { new: true }
    )
    if (!updated) return res.fail("REJECTED", "RECRUIT_FORBIDDEN_EDIT", 403)
    return res.ok({ data: toDTO(updated) })
})

/* Delete */
router.delete("/:id", auth, requireRole("brand", "admin"), async (req, res) => {
    const { id } = req.params
    if (!mongoose.isValidObjectId(id))
        return res.fail("INVALID_ID", "INVALID_ID", 400)

    const removed = await Campaign.findOneAndDelete({
        _id: id,
        createdBy: req.user.id,
    })
    if (!removed)
        return res.fail(
            "NOT_FOUND_OR_FORBIDDEN",
            "RECRUIT_FORBIDDEN_DELETE",
            403
        )
    return res.ok({ message: "삭제 완료" })
})

module.exports = router
