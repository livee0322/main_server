// models/Offer-test.js — v1.1.0 (on_hold 추가)
'use strict';
const { Schema, model } = require('mongoose');

const OfferSchema = new Schema(
  {
    type:          { type: String, default: 'offer' },

    // 발신자(브랜드) / 수신자(쇼호스트)
    createdBy:     { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    toPortfolioId: { type: Schema.Types.ObjectId, ref: 'Portfolio-test', required: true, index: true },
    toUser:        { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    // 선택: 특정 공고 연동
    recruitId:     { type: Schema.Types.ObjectId, ref: 'Recruit-test' },

    message:       { type: String, maxlength: 800, default: '' },

    // UI와 맞춤 (보류 on_hold 포함)
    status:        { type: String, enum: ['pending','on_hold','accepted','rejected','withdrawn'], default: 'pending', index: true }
  },
  { timestamps: true, collection: 'offers' }
);

// 조회 편의 인덱스
OfferSchema.index({ toUser: 1, createdAt: -1 });
OfferSchema.index({ createdBy: 1, createdAt: -1 });

// 직렬화
OfferSchema.set('toJSON', {
  virtuals: true, versionKey: false,
  transform(_doc, ret) { ret.id = ret._id.toString(); delete ret._id; }
});

module.exports = model('Offer-test', OfferSchema);