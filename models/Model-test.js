'use strict';
const { Schema, model } = require('mongoose');

const ModelSchema = new Schema({
  type:       { type: String, default: 'model' },

  // 공개/발행
  status:     { type: String, enum: ['draft','published'], default: 'draft' },
  visibility: { type: String, enum: ['public','unlisted','private'], default: 'public' },

  // 기본 정보
  nickname: { type: String, trim: true },
  headline: { type: String, trim: true },   // 한 줄 소개
  bio:      { type: String, default: '' },

  // 이미지
  mainThumbnailUrl: { type: String, trim: true },
  coverImageUrl:    { type: String, trim: true },
  subThumbnails:    [{ type: String, trim: true }],

  // 과거 호환 필드(읽기 전용 느낌)
  mainThumbnail: { type: String, trim: true },
  coverImage:    { type: String, trim: true },
  subImages:     [{ type: String, trim: true }],
  displayName:   { type: String, trim: true },
  name:          { type: String, trim: true },

  // 프로필 수치
  careerYears: { type: Number, min:0, max:50 },
  age:         { type: Number, min: 12, max: 99 },

  // 공개/제안
  openToOffers: { type: Boolean, default: true },
  primaryLink:  { type: String, trim: true },

  // 지역/데모그래픽/소셜
  region: {
    city:    { type: String, trim: true },
    area:    { type: String, trim: true },
    country: { type: String, trim: true, default: 'KR' }
  },
  demographics: {
    gender:  { type: String, enum:['female','male','other',''], default: '' },
    height:  { type: Number, min: 100, max: 220 },
    weight:  { type: Number, min: 30, max: 200 },
    sizeTop:    { type: String, trim: true },
    sizeBottom: { type: String, trim: true },
    shoe:       { type: String, trim: true },
    sizePublic: { type: Boolean, default: false }
  },
  links: {
    website:   { type: String, trim: true },
    instagram: { type: String, trim: true },
    youtube:   { type: String, trim: true },
    tiktok:    { type: String, trim: true }
  },

  // 기타
  tags: [{ type: String, trim: true }],
  shorts: [{ type: String, trim: true }], // 선택: 연결된 숏폼 ID

  createdBy: { type: Schema.Types.ObjectId, ref: 'User', index: true }
}, { timestamps: true });

ModelSchema.index({ createdAt: -1 });
ModelSchema.index({ status: 1, visibility: 1 });

module.exports = model('ModelTest', ModelSchema);
