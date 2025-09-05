'use strict';

const mongoose = require('mongoose');

const LiveLinkSchema = new mongoose.Schema({
  title: { type: String, trim: true, maxlength: 120 },
  url:   { type: String, trim: true },
  date:  { type: Date }
}, { _id: false });

const PortfolioSchema = new mongoose.Schema({
  type:       { type: String, default: 'portfolio', index: true },
  status:     { type: String, enum: ['draft','published'], default: 'draft', index: true },
  visibility: { type: String, enum: ['public','unlisted','private'], default: 'public' },

  // 통일된 필드
  nickname:   { type: String, trim: true, maxlength: 80 },
  headline:   { type: String, trim: true, maxlength: 120 },
  bio:        { type: String, default: '' }, // 길이 제한 없음(라우터에서만 sanitize)

  mainThumbnailUrl: { type: String, trim: true },
  coverImageUrl:    { type: String, trim: true },
  subThumbnails:    { type: [String], default: [] },

  realName:       { type: String, trim: true, maxlength: 80 },
  realNamePublic: { type: Boolean, default: false },
  careerYears:    { type: Number, min: 0, max: 50 },
  age:            { type: Number, min: 14, max: 99 },
  agePublic:      { type: Boolean, default: false },

  primaryLink: { type: String, trim: true },

  liveLinks:  { type: [LiveLinkSchema], default: [] },
  tags:       { type: [String], default: [] },

  openToOffers: { type: Boolean, default: true },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }
}, { timestamps: true });

/** 여러 개 허용: createdBy 에 unique 인덱스 절대 금지 */

PortfolioSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform(_doc, ret){
    ret.id = String(ret._id);
    delete ret._id;
  }
});

module.exports = mongoose.model('PortfolioTest', PortfolioSchema);