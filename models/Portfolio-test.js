'use strict';
const { Schema, model } = require('mongoose');

/**
 * Portfolio (showhost) — v2
 * - visibility: public | private
 * - field-level "public" flags for profile facets
 */
const LiveLinkSchema = new Schema({
  title: { type: String, trim: true },
  url:   { type: String, trim: true },                  // https://...
  date:  { type: Date },
  role:  { type: String, enum: ['host', 'guest'], default: 'host' },
  thumbnailUrl: { type: String, trim: true },           // 미리보기 섬네일(선택)
}, { _id: false });

const FileSchema = new Schema({
  url:  { type: String, trim: true },                   // 업로드 완료된 절대 URL
  name: { type: String, trim: true },
  size: { type: Number, min: 0 },
  mime: { type: String, trim: true },
}, { _id: false });

const RegionSchema = new Schema({
  city:    { type: String, trim: true },               // 시/도
  area:    { type: String, trim: true },               // 구/군
  country: { type: String, trim: true, default: 'KR' },
}, { _id: false });

const LinksSchema = new Schema({
  website:   { type: String, trim: true },
  instagram: { type: String, trim: true },
  youtube:   { type: String, trim: true },
}, { _id: false });

const PortfolioSchema = new Schema({
  type: { type: String, default: 'portfolio' },

  // 상태/공개
  status:     { type: String, enum: ['draft','published'], default: 'draft' },
  visibility: { type: String, enum: ['public','private'],  default: 'public' },

  // 기본 프로필
  nickname: { type: String, trim: true },              // 필수(발행 시)
  headline: { type: String, trim: true },              // 한줄 소개 (필수-발행시)
  bio:      { type: String, default: '' },             // HTML sanitize 서버에서 처리

  // 썸네일/커버/갤러리
  mainThumbnailUrl: { type: String, trim: true },
  coverImageUrl:    { type: String, trim: true },
  subThumbnails:    [{ type: String, trim: true }],    // 최대 12개 사용 권장

  // 과거 호환 (읽기전용성)
  mainThumbnail: { type: String, trim: true },
  coverImage:    { type: String, trim: true },
  subImages:     [{ type: String, trim: true }],
  displayName:   { type: String, trim: true },
  name:          { type: String, trim: true },

  // 프로필 상세 + 공개여부
  careerYears:       { type: Number, min:0, max:50 },
  careerYearsPublic: { type: Boolean, default: false },

  age:         { type: Number, min:14, max:99 },
  agePublic:   { type: Boolean, default: false },

  realName:        { type: String, trim:true },
  realNamePublic:  { type: Boolean, default: false },

  region:       { type: RegionSchema, default: undefined },
  regionPublic: { type: Boolean, default: false },

  demographics: {
    gender:  { type: String, trim: true, enum: ['', 'female', 'male', 'other'], default: '' },
    height:  { type: Number, min:120, max:230 },
    weight:  { type: Number, min:30,  max:200 },
    sizeTop:    { type: String, trim: true },          // S/M/L…
    sizeBottom: { type: String, trim: true },          // 26/28…
    shoe:       { type: String, trim: true },          // 240…
    // 공개 플래그
    genderPublic: { type: Boolean, default: false },
    heightPublic: { type: Boolean, default: false },
    weightPublic: { type: Boolean, default: false },
    sizePublic:   { type: Boolean, default: false },
  },

  // 링크
  primaryLink: { type: String, trim: true },           // 대표 링크
  links:       { type: LinksSchema, default: undefined },

  // 라이브 링크(최근 진행/게스트 기록)
  liveLinks: [LiveLinkSchema],

  // 파일 첨부
  files: [FileSchema],

  // 태그/쇼츠
  tags:   [{ type: String, trim: true }],
  shorts: [{ type: String, trim: true }],              // 연동된 쇼츠 ID(선택)

  // 소유
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', index: true }
}, { timestamps:true });

/* 인덱스 */
PortfolioSchema.index({ createdAt: -1 });
PortfolioSchema.index({ status: 1, visibility: 1 });
PortfolioSchema.index({ nickname: 1 });

module.exports = model('PortfolioTest', PortfolioSchema);