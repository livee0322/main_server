// models/Portfolio-test.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const LiveLinkSchema = new Schema(
  { title: { type: String, trim: true }, url: { type: String, trim: true }, date: { type: Date } },
  { _id: false }
);

const PortfolioSchema = new Schema(
  {
    type:   { type: String, default: 'portfolio' },
    status: { type: String, enum: ['draft', 'published'], default: 'draft' },

    visibility: { type: String, enum: ['public', 'unlisted', 'private'], default: 'public' },

    // media
    mainThumbnailUrl: { type: String, trim: true },
    coverImageUrl:    { type: String, trim: true },
    subThumbnails:    [{ type: String, trim: true }], // (라우터에서 최대 5개 제한)

    // identity
    realName:       { type: String, trim: true },
    realNamePublic: { type: Boolean, default: false },
    nickname:       { type: String, trim: true, required: true },
    headline:       { type: String, trim: true, required: true },

    // stats
    careerYears: { type: Number, min: 0, max: 50 },
    age:         { type: Number, min: 14, max: 99 },
    agePublic:   { type: Boolean, default: false },

    // links
    primaryLink: { type: String, trim: true },
    liveLinks:   { type: [LiveLinkSchema], default: [] },

    // content
    bio:  { type: String, trim: true },
    tags: [{ type: String, trim: true }], // (라우터에서 최대 8개 제한)

    openToOffers: { type: Boolean, default: true },

    // ✅ 여러 개 허용: createdBy만 사용(고유 아님)
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  },
  {
    timestamps: true,
    collection: 'portfolios',
  }
);

// 조회 최적화 인덱스(선택)
PortfolioSchema.index({ status: 1, visibility: 1, createdAt: -1 });
PortfolioSchema.index({ tags: 1 });

// OverwriteModelError 방지
module.exports = mongoose.models.Portfolio || mongoose.model('Portfolio', PortfolioSchema);