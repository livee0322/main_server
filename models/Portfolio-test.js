// models/Portfolio-test.js
// Test 라우터에서 사용할 포트폴리오 모델 (옵션 B)
// - modelName: 'Portfolio' (공용 이름 재사용)
// - collection: 'portfolios' (고정)
// - 이미 컴파일된 경우 재사용하여 OverwriteModelError 방지

const mongoose = require('mongoose');

const MODEL_NAME = 'Portfolio';
const COLLECTION_NAME = 'portfolios';

// 이미 컴파일된 모델이 있으면 그대로 재사용
if (mongoose.models[MODEL_NAME]) {
  module.exports = mongoose.models[MODEL_NAME];
} else {
  // === Sub Schemas ===
  const LiveLinkSchema = new mongoose.Schema({
    title: { type: String, trim: true },
    url:   { type: String, trim: true },
    date:  { type: Date }
  }, { _id: false });

  // === Main Schema (옵션 B) ===
  const PortfolioSchema = new mongoose.Schema({
    type:        { type: String, default: 'portfolio' },
    status:      { type: String, enum: ['draft','published'], default: 'draft' },

    visibility:  { type: String, enum: ['public','unlisted','private'], default: 'public' },

    // media
    mainThumbnailUrl: { type: String, trim: true },
    coverImageUrl:    { type: String, trim: true },
    subThumbnails:    [{ type: String, trim: true }], // (라우터에서 최대 5개 제한)

    // identity
    realName:        { type: String, trim: true },
    realNamePublic:  { type: Boolean, default: false },
    nickname:        { type: String, trim: true, required: true },
    headline:        { type: String, trim: true, required: true },

    // stats
    careerYears: { type: Number, min: 0, max: 50 },
    age:         { type: Number, min: 14, max: 99 },
    agePublic:   { type: Boolean, default: false },

    // links
    primaryLink: { type: String, trim: true },
    liveLinks:   { type: [LiveLinkSchema], default: [] },

    // content
    bio:  { type: String, trim: true },     // 글자수 제한 없음
    tags: [{ type: String, trim: true }],   // (라우터에서 최대 8개 제한)

    openToOffers: { type: Boolean, default: true },

    // ✅ 옵션 B: createdBy만 사용 (user 필드/유니크 인덱스 없음)
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  }, { timestamps: true });

  // 필요 시 인덱스 (유니크 아님)
  // PortfolioSchema.index({ createdBy: 1, createdAt: -1 });

  module.exports = mongoose.model(MODEL_NAME, PortfolioSchema, COLLECTION_NAME);
}