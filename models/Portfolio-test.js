// models/Portfolio-test.js
'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * 통일 스키마
 * - draft: 거의 제한 없음
 * - published: 라우터에서 nickname/headline/mainThumbnailUrl/bio(50+) 필수 검사
 */
const LiveLinkSchema = new Schema(
  {
    title: { type: String, trim: true },
    url:   { type: String, trim: true },
    date:  { type: Date }
  },
  { _id: false }
);

const PortfolioTestSchema = new Schema(
  {
    type:          { type: String, default: 'portfolio', index: true },
    status:        { type: String, enum: ['draft', 'published'], default: 'draft', index: true },
    visibility:    { type: String, enum: ['public','unlisted','private'], default: 'public', index: true },

    nickname:      { type: String, trim: true },      // (=displayName|name 호환은 라우터에서 흡수)
    headline:      { type: String, trim: true, maxlength: 120 },
    bio:           { type: String },

    mainThumbnailUrl: { type: String, trim: true },
    coverImageUrl:    { type: String, trim: true },
    subThumbnails:    [{ type: String, trim: true }],

    realName:        { type: String, trim: true },
    realNamePublic:  { type: Boolean, default: false },
    age:             { type: Number, min: 14, max: 99 },
    agePublic:       { type: Boolean, default: false },
    careerYears:     { type: Number, min: 0, max: 50 },

    primaryLink:     { type: String, trim: true },

    liveLinks:       { type: [LiveLinkSchema], default: [] },
    tags:            { type: [String], default: [] },

    openToOffers:    { type: Boolean, default: true },

    createdBy:      { type: Schema.Types.ObjectId, ref: 'User', index: true },
  },
  { timestamps: true, collection: 'portfolios' } // 테스트도 동일 컬렉션 사용
);

// 검색·리스트 정렬에 도움되는 인덱스
PortfolioTestSchema.index({ status: 1, visibility: 1, createdAt: -1 });

module.exports =
  mongoose.models.PortfolioTest ||
  mongoose.model('PortfolioTest', PortfolioTestSchema);