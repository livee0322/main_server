const mongoose = require("mongoose")
const { Schema } = mongoose

// 캠페인에 포함될 수 있는 개별 상품의 스키마
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
        saleDurationSec: Number,
        saleUntil: Date,
        imageUrl: String,
        deepLink: String,
        utm: { source: String, medium: String, campaign: String },
        detailHtml: String,
    },
    { _id: true }
)
// 지원자에게 질문할 항목의 스키마
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

// [주석] 모집 공고의 전체 데이터 구조를 정의하는 메인 스키마입니다.
const CampaignSchema = new Schema(
    {
        // --- 기본 정보 ---
        status: {
            // 공고 상태
            type: String,
            enum: ["draft", "scheduled", "published", "closed"],
            default: "draft",
            index: true,
        },
        brandName: { type: String, required: true, trim: true }, // 브랜드명 (필수)
        prefix: {
            // 말머리 (선택)
            type: String,
            enum: ["쇼호스트모집", "촬영스태프", "모델모집", "기타모집"],
            trim: true,
        },
        title: { type: String, required: true }, // 공고 제목 (필수)
        content: { type: String }, // 공고 내용 (HTML 가능)
        category: {
            // 카테고리 (선택)
            type: String,
            enum: ["뷰티", "패션", "식품", "가전", "생활/리빙"],
        },

        // --- 일정 및 장소 ---
        location: { type: String, trim: true }, // 촬영 장소
        shootDate: { type: Date, required: true }, // 촬영일 (필수)
        closeAt: { type: Date, required: true }, // 공고 마감일 (필수)
        durationHours: { type: Number, required: true }, // 총 촬영 시간 (단위: 시간, 필수)
        startTime: { type: String, required: true, trim: true }, // 촬영 시작 시간 (필수)
        endTime: { type: String, required: true, trim: true }, // 촬영 종료 시간 (필수)

        // --- 출연료 정보 ---
        fee: { type: Number }, // 출연료
        feeNegotiable: { type: Boolean, default: false }, // 출연료 협의 가능 여부

        // --- 이미지 및 외부 링크 ---
        coverImageUrl: { type: String, trim: true }, // 공고 대표 이미지 (가로)
        thumbnailUrl: { type: String, trim: true }, // 자동 생성된 썸네일 이미지
        liveVerticalCoverUrl: { type: String, trim: true }, // 쇼핑라이브용 세로 커버 이미지
        liveStreamUrl: { type: String, trim: true }, // 쇼핑라이브 방송 링크

        // --- 관련 상품 정보 ---
        productThumbnailUrl: { type: String, trim: true }, // 상품 썸네일 이미지
        productName: { type: String, trim: true }, // 상품명
        productUrl: { type: String, trim: true }, // 상품 구매 링크
        products: [ProductItemSchema], // 상세 상품 목록

        // --- 기타 모집 정보 ---
        recruit: {
            requirements: String, // 지원 자격
            preferred: String, // 우대 사항
            questions: [QuestionSchema], // 추가 질문
        },

        // --- 통계 ---
        metrics: {
            views: { type: Number, default: 0 },
            clicks: { type: Number, default: 0 },
            applications: { type: Number, default: 0 },
        },

        // --- 소유자 정보 ---
        createdBy: {
            // 공고를 생성한 사용자 ID
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
    },
    { timestamps: true } // 생성/수정 시간 자동 기록
)

CampaignSchema.index({ createdAt: -1 })

module.exports = mongoose.model("Campaign", CampaignSchema, "campaigns-dev")