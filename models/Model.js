const mongoose = require("mongoose");

// '모델' 정보의 데이터베이스 구조(스키마)를 정의
const modelSchema = new mongoose.Schema(
  {
    // --- 기본 정보 ---
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true }, // 모델을 등록한 사용자 ID
    nickname: { type: String, trim: true },            // 닉네임
    oneLineIntro: { type: String, trim: true },        // 한 줄 소개
    detailedIntro: { type: String },                   // 상세 소개
    experienceYears: { type: Number },                 // 경력(년차)
    age: { type: Number },                             // 나이
    
    // --- 신체 정보 ---
    gender: { type: String, enum: ['male', 'female'] }, // 성별
    height: { type: Number },                           // 키 (cm)
    weight: { type: Number },                           // 몸무게 (kg)
    topSize: { type: String, trim: true },              // 상의 사이즈
    bottomSize: { type: String, trim: true },           // 하의 사이즈
    shoeSize: { type: Number },                         // 신발 사이즈

    // --- 이미지 및 파일 ---
    mainThumbnailUrl: { type: String, trim: true },    // 메인 프로필 이미지
    backgroundImageUrl: { type: String, trim: true },  // 프로필 배경 이미지
    subThumbnailUrls: [{ type: String, trim: true }],  // 추가 프로필 이미지 (최대 5개)
    attachedFileUrl: { type: String, trim: true },     // 첨부 파일 URL

    // --- 외부 링크 ---
    websiteUrl: { type: String, trim: true },           // 개인 웹사이트 URL
    instagramUrl: { type: String, trim: true },         // 인스타그램 URL
    youtubeUrl: { type: String, trim: true },           // 유튜브 URL
    tiktokUrl: { type: String, trim: true },            // 틱톡 URL
    
    // --- 설정 및 상태 ---
    status: { type: String, enum: ['published'], default: 'published' }, // 상태 (현재 '게시'만 사용)
    detailedRegion: { type: String, trim: true },       // 상세 지역
    isAgePublic: { type: Boolean, default: true },      // 나이 공개 여부
    isSizingPublic: { type: Boolean, default: true },   // 신체 사이즈 공개 여부
    publicScope: { type: String, default: '전체공개' },     // 공개 범위
    isReceivingOffers: { type: Boolean, default: true },  // 제안 받기 여부
  },
  { timestamps: true } // createdAt, updatedAt 타임스탬프 자동 생성
);

// 'Model'이라는 이름의 모델을 생성하며, 실제 MongoDB에서는 'models-dev' 컬렉션을 사용하도록 지정
module.exports = mongoose.model("Model", modelSchema, 'models-dev');