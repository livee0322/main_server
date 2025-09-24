// models/Offer-test.js — v1.0.0
'use strict';
const { Schema, model, Types } = require('mongoose');

const OfferSchema = new Schema(
  {
    type:         { type: String, default: 'offer' },

    // 발신자(브랜드) / 수신자(쇼호스트)
    createdBy:    { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true }, // 브랜드 유저
    toPortfolioId:{ type: Schema.Types.ObjectId, ref: 'Portfolio-test', required: true, index: true },
    toUser:       { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true }, // 포트폴리오 소유자

    // 옵션: 특정 공고에 대한 제안이면 연결
    recruitId:    { type: Schema.Types.ObjectId, ref: 'Recruit-test' },

    message:      { type: String, maxlength: 800, default: '' },

    status:       { type: String, enum: ['pending','accepted','rejected','withdrawn'], default: 'pending', index: true }
  },
  { timestamps: true, collection: 'offers' }
);

// 조회 편의를 위한 인덱스
OfferSchema.index({ toUser: 1, createdAt: -1 });
OfferSchema.index({ createdBy: 1, createdAt: -1 });

// JSON 직렬화
OfferSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform(_doc, ret) {
    ret.id = ret._id.toString();
    delete ret._id;
  },
});

module.exports = model('Offer-test', OfferSchema);