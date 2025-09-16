'use strict';
const { Schema, model } = require('mongoose');

const LinkSchema = new Schema({
  website:   { type: String, trim: true },
  instagram: { type: String, trim: true },
  youtube:   { type: String, trim: true }
}, { _id:false });

const RegionSchema = new Schema({
  country: { type: String, trim: true, default: 'KR' },
  city:    { type: String, trim: true },
  area:    { type: String, trim: true }
}, { _id:false });

const DemographicsSchema = new Schema({
  gender:   { type: String, enum: ['', 'female','male','other'], default: '' },
  height:   { type: Number, min: 100, max: 220 },
  weight:   { type: Number, min: 30,  max: 150 },
  sizeTop:    { type: String, trim: true },
  sizeBottom: { type: String, trim: true },
  shoe:       { type: String, trim: true },

  // 공개 스위치
  sizePublic:    { type: Boolean, default: false },
  agePublic:     { type: Boolean, default: false },
  genderPublic:  { type: Boolean, default: false },
  regionPublic:  { type: Boolean, default: false },
  careerPublic:  { type: Boolean, default: false },
}, { _id:false });

const ModelSchema = new Schema({
  type: { type: String, default: 'model', index: true },

  status:     { type: String, enum: ['draft','published'], default: 'draft', index: true },
  visibility: { type: String, enum: ['public','private'],  default: 'public', index: true },

  nickname: { type: String, trim: true },        // 필수(발행 시)
  headline: { type: String, trim: true },        // 필수(발행 시)
  bio:      { type: String, default: '' },       // sanitize 된 HTML

  // 이미지
  mainThumbnailUrl: { type: String, trim: true },
  coverImageUrl:    { type: String, trim: true },
  subThumbnails:    [{ type: String, trim: true, maxlength: 350 }], // 최대 5장 사용

  // 추가 메타
  careerYears: { type: Number, min: 0, max: 50 },
  age:         { type: Number, min: 14, max: 99 },

  // 링크/지역/디모그래픽
  links:        { type: LinkSchema, default: () => ({}) },
  region:       { type: RegionSchema, default: () => ({ country: 'KR' }) },
  demographics: { type: DemographicsSchema, default: () => ({}) },

  tags: [{ type: String, trim: true, maxlength: 30 }],

  openToOffers: { type: Boolean, default: true },

  createdBy: { type: Schema.Types.ObjectId, ref: 'User', index: true },
}, { timestamps: true });

ModelSchema.index({ createdAt: -1 });

module.exports = model('ModelTest', ModelSchema);