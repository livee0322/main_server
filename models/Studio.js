const mongoose = require("mongoose");

// 요일별 영업시간의 상세 구조를 정의
const dailyScheduleSchema = new mongoose.Schema({
    isOpen: { type: Boolean, default: false }, // 영업 여부
    startTime: { type: String, trim: true }, // 시작 시간 (예: "09:00")
    endTime: { type: String, trim: true }, // 마감 시간 (예: "18:00")
    excludedTimes: [{ type: String, trim: true }] // 제외 시간 목록
}, { _id: false });

// '스튜디오' 정보의 데이터베이스 구조(스키마)를 정의
const studioSchema = new mongoose.Schema(
    {
        // --- 기본 정보 ---
        brandName: { type: String, trim: true },      // 브랜드명
        oneLineIntro: { type: String, trim: true },   // 한 줄 소개
        detailedIntro: { type: String },              // 상세 소개
        usageInfo: { type: String },                  // 이용 안내
        priceInfo: { type: String },                  // 금액 안내

        // --- 이미지 URL ---
        mainThumbnailUrl: { type: String, trim: true },   // 메인 프로필 이미지
        backgroundImageUrl: { type: String, trim: true }, // 배경 이미지
        subThumbnailUrls: [{ type: String, trim: true }], // 서브 썸네일 (최대 5개)
        galleryUrls: [{ type: String, trim: true }],      // 갤러리 이미지 (최대 9개)

        // --- 연락처 및 위치 ---
        contact: {
            phone: { type: String, trim: true }, // 전화번호
            email: { type: String, trim: true }, // 이메일
            kakao: { type: String, trim: true }  // 카카오톡 채널 등
        },
        location: {
            address: { type: String, trim: true }, // 주소
            mapUrl: { type: String, trim: true }   // 지도 링크
        },

        // --- 주간 영업시간 ---
        weeklySchedule: {
            '월': dailyScheduleSchema,
            '화': dailyScheduleSchema,
            '수': dailyScheduleSchema,
            '목': dailyScheduleSchema,
            '금': dailyScheduleSchema,
            '토': dailyScheduleSchema,
            '일': dailyScheduleSchema
        }
    },
    { timestamps: true } // createdAt, updatedAt 타임스탬프 자동 생성
);

// 'Studio'라는 이름의 모델을 생성하며, 실제 MongoDB에서는 'studios-dev' 컬렉션을 사용하도록 지정
module.exports = mongoose.model("Studio", studioSchema, 'studios-dev');