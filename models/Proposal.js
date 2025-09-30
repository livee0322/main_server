const mongoose = require("mongoose")
const { Schema } = mongoose

// '쇼호스트 제안' 정보의 데이터베이스 구조(스키마)를 정의
const proposalSchema = new Schema(
    {
        // --- 제안의 주체 및 대상 ---
        // 제안을 받는 쇼호스트의 포트폴리오 ID (프론트엔드에서 전달)
        targetPortfolioId: {
            type: Schema.Types.ObjectId,
            ref: "Portfolio",
            required: true,
            index: true,
        },
        // 제안을 보내는 브랜드 회원의 User ID (서버에서 자동 할당)
        proposerId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        // 제안을 받는 쇼호스트의 User ID (서버에서 Portfolio를 통해 조회 후 할당)
        targetShowhostId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },

        // --- 제안 내용 (프론트엔드에서 전달) ---
        brandName: { type: String, required: true, trim: true }, // 제안하는 브랜드명
        fee: { type: Number }, // 제안 출연료
        isFeeNegotiable: { type: Boolean, default: false }, // 출연료 협의 가능 여부
        shootingDate: { type: Date, required: true }, // 촬영 희망일
        shootingTime: { type: String, trim: true }, // 촬영 희망 시간
        location: { type: String, trim: true }, // 촬영 희망 장소
        replyDeadline: { type: Date, required: true }, // 제안 답장 기한
        content: { type: String, trim: true, maxlength: 800 }, // 제안 상세 내용

        // --- 제안 상태 (서버에서 관리) ---
        status: {
            type: String,
            enum: [
                "pending",
                "accepted",
                "rejected",
                "canceled",
                "withdrawn",
                "hold",
            ], // 제안 상태: 대기, 수락, 거절, 취소, 철회, 보류
            default: "pending",
            index: true,
        },
    },
    {
        // createdAt, updatedAt 타임스탬프 자동 생성을 설정
        timestamps: true,
    }
)

// 'Proposal'이라는 이름의 모델을 생성하며, 실제 MongoDB에서는 'proposals-dev' 컬렉션을 사용하도록 지정
module.exports = mongoose.model("Proposal", proposalSchema, "proposals-dev")
