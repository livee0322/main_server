// models/Offer-test.js — v1.0.1 (ref 고정: PortfolioTest)
'use strict';
const { Schema, model } = require('mongoose');

const OfferSchema = new Schema(
  {
    type: { type: String, default: 'offer' },

    // 발신자(브랜드) / 수신자(쇼호스트)
    createdBy:     { type: Schema.Types.ObjectId, ref: 'User',          required: true, index: true },
    toPortfolioId: { type: Schema.Types.ObjectId, ref: 'PortfolioTest', required: true, index: true }, // ★ 모델명
    toUser:        { type: Schema.Types.ObjectId, ref: 'User',          required: true, index: true },

    // (옵션) 특정 공고 제안
    recruitId: { type: Schema.Types.ObjectId, ref: 'Recruit-test' },

    message:  { type: String, maxlength: 800, default: '' },

    // UI 호환 위해 on_hold 포함
    status: { type: String, enum: ['pending','on_hold','accepted','rejected','withdrawn'], default: 'pending', index: true }
  },
  { timestamps: true, collection: 'offers' }
);

// 조회 인덱스
OfferSchema.index({ toUser: 1,     createdAt: -1 });
OfferSchema.index({ createdBy: 1,  createdAt: -1 });

// 직렬화: _id -> id
OfferSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform(_doc, ret) {
    ret.id = String(ret._id);
    delete ret._id;
  },
});

module.exports = model('Offer-test', OfferSchema);