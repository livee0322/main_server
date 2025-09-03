// models/Portfolio-test.js
const mongoose = require('mongoose');

const LiveLinkSchema = new mongoose.Schema({
  title: { type: String, trim: true },
  url:   { type: String, trim: true },
  date:  { type: Date }
},{ _id:false });

const PortfolioSchema = new mongoose.Schema({
  type:        { type: String, default: 'portfolio' },
  status:      { type: String, enum: ['draft','published'], default: 'draft' },

  visibility:  { type: String, enum: ['public','unlisted','private'], default: 'public' },

  // media
  mainThumbnailUrl: { type: String, trim: true },
  coverImageUrl:    { type: String, trim: true },
  subThumbnails:    [{ type: String, trim: true }], // 최대 5개 (라우터에서 검증)

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
  bio:  { type: String, trim: true },  // 글자수 제한 없음(요청사항)
  tags: [{ type: String, trim: true }], // 최대 8개 (라우터에서 검증)

  openToOffers: { type: Boolean, default: true },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

module.exports = mongoose.model('Portfolio', PortfolioSchema);