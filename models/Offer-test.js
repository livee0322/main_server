// models/Offer-test.js — v1.1.1 (ref 이름 교정: PortfolioTest)
'use strict';
const { Schema, model } = require('mongoose');

const OfferSchema = new Schema(
  {
    type:          { type: String, default: 'offer' },

    // 발신자(브랜드) / 수신자(쇼호스트)
    createdBy:     { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // ▼ 실제 등록된 포트폴리오 모델명은 'PortfolioTest' 입니다.
    toPortfolioId: { type: Schema.Types.ObjectId, ref: 'PortfolioTest', required: true, index: true },
    toUser:        { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    // 선택: 특정 공고 연동
    recruitId:     { type: Schema.Types.ObjectId, ref: 'Recruit-test' },

    message:       { type: String, maxlength: 800, default: '' },

    // UI와 일치 (보류 포함)
    status: { type: String, enum: ['pending','on_hold','accepted','rejected','withdrawn'],
              default: 'pending', index: true }
  },
  { timestamps: true, collection: 'offers' }
);

OfferSchema.index({ toUser: 1, createdAt: -1 });
OfferSchema.index({ createdBy: 1, createdAt: -1 });

OfferSchema.set('toJSON', {
  virtuals: true, versionKey: false,
  transform(_doc, ret) { ret.id = ret._id.toString(); delete ret._id; }
});

module.exports = model('Offer-test', OfferSchema);