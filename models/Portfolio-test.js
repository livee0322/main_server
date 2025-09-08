'use strict';
const { Schema, model } = require('mongoose');

const PortfolioSchema = new Schema({
  type: { type: String, default: 'portfolio' },
  status: { type: String, enum: ['draft','published'], default: 'draft' },
  visibility: { type: String, enum: ['public','unlisted','private'], default: 'public' },

  nickname: { type: String, trim: true },
  headline: { type: String, trim: true },          // 한줄소개(없어도 됨; 라우터가 폴백 생성)
  bio:      { type: String, default: '' },          // 자유 길이

  mainThumbnailUrl: { type: String, trim: true },
  coverImageUrl:    { type: String, trim: true },
  subThumbnails:    [{ type: String, trim: true }],

  // 레거시 호환 필드(읽기전용 느낌)
  mainThumbnail: { type: String, trim: true },
  coverImage:    { type: String, trim: true },
  subImages:     [{ type: String, trim: true }],
  displayName:   { type: String, trim: true },
  name:          { type: String, trim: true },

  careerYears:   { type: Number, min:0, max:50 },
  age:           { type: Number, min:14, max:99 },
  realName:      { type: String, trim:true },
  realNamePublic:{ type: Boolean, default: false },
  agePublic:     { type: Boolean, default: false },
  openToOffers:  { type: Boolean, default: true },

  primaryLink:   { type: String, trim: true },

  liveLinks: [{
    title: { type: String, trim: true },
    url:   { type: String, trim: true },
    date:  { type: Date }
  }],

  tags:        [{ type: String, trim: true }],
  createdBy:   { type: Schema.Types.ObjectId, ref: 'User', index:true }
}, { timestamps:true });

module.exports = model('PortfolioTest', PortfolioSchema);