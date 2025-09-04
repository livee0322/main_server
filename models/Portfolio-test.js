// models/Portfolio-test.js
// 옵션 B: user 필드 없음 / createdBy 필수
const mongoose = require('mongoose');

const LiveLinkSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true },
    url:   { type: String, trim: true },
    date:  { type: Date }
  },
  { _id: false }
);

const PortfolioSchema = new mongoose.Schema(
  {
    // meta
    type:       { type: String, default: 'portfolio' },
    status:     { type: String, enum: ['draft', 'published'], default: 'draft' },
    visibility: { type: String, enum: ['public', 'unlisted', 'private'], default: 'public' },

    // media
    mainThumbnailUrl: { type: String, trim: true },
    coverImageUrl:    { type: String, trim: true },
    subThumbnails:    [{ type: String, trim: true }], // 라우터에서 최대 5개로 제한

    // identity
    realName:       { type: String, trim: true },
    realNamePublic: { type: Boolean, default: false },
    nickname:       { type: String, trim: true, required: true },
    headline:       { type: String, trim: true, required: true },

    // stats
    careerYears: { type: Number, min: 0,  max: 50 },
    age:         { type: Number, min: 14, max: 99 },
    agePublic:   { type: Boolean, default: false },

    // links
    primaryLink: { type: String, trim: true },
    liveLinks:   { type: [LiveLinkSchema], default: [] },

    // content
    bio:  { type: String, trim: true },       // 글자수 제한 없음(요청)
    tags: [{ type: String, trim: true }],     // 라우터에서 최대 8개로 제한

    // offer
    openToOffers: { type: Boolean, default: true },

    // ownership (옵션 B 핵심)
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
  },
  {
    timestamps: true,
    collection: 'portfolios' // 기존 컬렉션 명시(로그에 동일 컬렉션 사용 중)
  }
);

/* ---------------- Indexes ---------------- */
// 리스트/마이페이지 조회 최적화(고유 X)
PortfolioSchema.index({ createdBy: 1, createdAt: -1 });
PortfolioSchema.index({ status: 1, visibility: 1, createdAt: -1 });

// id 가독성
PortfolioSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    return ret;
  }
});

module.exports = mongoose.model('Portfolio', PortfolioSchema);