// [수정] 파일 상단에 mongoose와 Schema를 명시적으로 가져오도록 수정
const mongoose = require("mongoose")
const { Schema } = mongoose

// Product 스키마에 detailHtml 추가 (Recruit 모델 호환)
const ProductItemSchema = new Schema(
    {
        url: { type: String, required: true },
        marketplace: {
            type: String,
            enum: ["smartstore", "coupang", "gmarket", "etc"],
            default: "smartstore",
        },
        title: String,
        price: Number,
        salePrice: Number,
        saleDurationSec: Number, // 0|3600|7200|10800
        saleUntil: Date,
        imageUrl: String,
        deepLink: String,
        utm: { source: String, medium: String, campaign: String },
        detailHtml: String, // Recruit 모델의 Product 스키마와 호환을 위해 추가
    },
    { _id: true }
)

const QuestionSchema = new Schema(
    {
        label: { type: String, required: true },
        type: {
            type: String,
            enum: ["short", "long", "select", "file", "url", "number"],
            default: "short",
        },
        required: { type: Boolean, default: false },
        options: [String],
    },
    { _id: true }
)

const CampaignSchema = new Schema(
    {
        type: {
            type: String,
            enum: ["product", "recruit"],
            required: true,
            index: true,
        },
        status: {
            type: String,
            enum: ["draft", "scheduled", "published", "closed"],
            default: "draft",
            index: true,
        },
        // [추가] 내부 관리용 제목 필드 추가
        internalTitle: { type: String, trim: true },
        // [추가] '쇼호스트 모집' 등 제목 앞에 붙는 말머리 필드 추가
        prefix: { type: String, trim: true },
        title: { type: String, required: true },
        brand: String,
        category: String,

        coverImageUrl: String,
        thumbnailUrl: String, // derived from coverImageUrl (Cloudinary transform)
        // [추가] 상품 공고용 세로(9:16) 커버 이미지 URL 필드 추가
        liveVerticalCoverUrl: { type: String, trim: true },
        descriptionHTML: String,

        // [기존] liveDate, liveTime을 사용하고 있으나, 프론트 요청에 따라 startTime, endTime 추가
        liveDate: Date,
        liveTime: String,
        // [추가] 시작 시간과 종료 시간 필드 추가
        startTime: { type: String, trim: true },
        endTime: { type: String, trim: true },

        publishAt: Date,
        closeAt: Date, // 프론트의 'applyDeadline'에 해당

        // [추가] 상품 공고 타입 전용 필드들
        liveStreamUrl: { type: String, trim: true }, // 실제 방송 송출 링크
        productThumbnailUrl: { type: String, trim: true }, // 상품 썸네일
        productName: { type: String, trim: true }, // 상품명
        productUrl: { type: String, trim: true }, // 상품 구매 링크

        // 상품 정보 (이제 'recruit' 타입도 상품을 가질 수 있음)
        products: [ProductItemSchema], // 'product' 타입에서는 더 이상 사용되지 않음

        location: String,
        shootDate: Date,
        shootTime: String,
        fee: Number, // 'pay'에서 'fee'로 이름 변경 및 타입 지정
        feeNegotiable: { type: Boolean, default: false }, // 'payNegotiable'에서 이름 변경

        // 모집형 상세 정보
        recruit: {
            // Recruit 모델의 필드들을 통합
            recruitType: {
                type: String,
                enum: ["product", "host", "both"],
                default: "product",
            },
            // [추가] 총 촬영 진행 시간 필드 추가
            durationInHours: { type: Number },
            location: String,
            requirements: String, // Recruit 모델의 description과 호환
            preferred: String,
            questions: [QuestionSchema],
        },

        metrics: {
            views: { type: Number, default: 0 },
            clicks: { type: Number, default: 0 },
            applications: { type: Number, default: 0 },
        },

        createdBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
    },
    { timestamps: true }
)

CampaignSchema.index({ createdAt: -1 })
CampaignSchema.index({ type: 1, status: 1 })

module.exports = mongoose.model("Campaign", CampaignSchema, "campaigns-dev")
