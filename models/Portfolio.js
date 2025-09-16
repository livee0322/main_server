const mongoose = require("mongoose")

const portfolioSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        nickname: { type: String, trim: true }, // 닉네임
        oneLineIntro: { type: String, trim: true }, // 한 줄 소개
        detailedIntro: { type: String }, // 상세 소개
        experienceYears: { type: Number }, // 경력(년차)
        age: { type: Number }, // 나이
        mainThumbnailUrl: { type: String, trim: true }, // 메인 프로필 이미지
        backgroundImageUrl: { type: String, trim: true }, // 프로필 배경 이미지
        subThumbnailUrls: [{ type: String, trim: true }], // 추가 프로필 이미지 (최대 5개)
        status: { type: String, enum: ["published"], default: "published" }, // 상태 (게시)
        isAgePublic: { type: Boolean, default: true }, // 나이 공개 여부
        detailedRegion: { type: String, trim: true }, // 상세 지역 (예: 서울시 강남구)
        gender: { type: String, enum: ["male", "female"] }, // 성별
        height: { type: Number }, // 키 (cm)
        weight: { type: Number }, // 몸무게 (kg)
        topSize: { type: String, trim: true }, // 상의 사이즈 (예: S, M, L, 95)
        bottomSize: { type: String, trim: true }, // 하의 사이즈 (예: 26, 28, 30)
        shoeSize: { type: Number }, // 신발 사이즈 (예: 240, 270)
        isSizingPublic: { type: Boolean, default: true }, // 신체 사이즈 공개 여부
        websiteUrl: { type: String, trim: true }, // 개인 웹사이트 URL
        instagramUrl: { type: String, trim: true }, // 인스타그램 URL
        youtubeUrl: { type: String, trim: true }, // 유튜브 URL
        tiktokUrl: { type: String, trim: true }, // 틱톡 URL
        publicScope: { type: String, default: "전체공개" }, // 공개 범위
        isReceivingOffers: { type: Boolean, default: true }, // 제안 받기 여부
        recentLives: [
            {
                // 최근 라이브 방송 목록
                title: { type: String, trim: true },
                url: { type: String, trim: true },
                date: { type: Date },
            },
        ],
    },
    { timestamps: true }
)

module.exports = mongoose.model("Portfolio", portfolioSchema, "portfolios-dev")
