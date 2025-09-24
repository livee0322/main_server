// models/Offer-test.js — v1.2.0 (실사용 필드 확장)
'use strict';
const { Schema, model } = require('mongoose');

const OfferSchema = new Schema(
  {
    type:          { type: String, default: 'offer' },

    // 발신자(브랜드) / 수신자(쇼호스트)
    createdBy:     { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // 실제 포트폴리오 모델명은 'PortfolioTest'
    toPortfolioId: { type: Schema.Types.ObjectId, ref: 'PortfolioTest', required: true, index: true },
    toUser:        { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    // 선택: 특정 공고와 연결
    recruitId:     { type: Schema.Types.ObjectId, ref: 'Recruit-test' },

    // 제안 본문
    brandName:     { type: String, trim: true },   // 발신 브랜드명(표시용)
    fee:           { type: Number, min: 0 },       // 출연료(숫자)
    feeNegotiable: { type: Boolean, default: false },
    message:       { type: String, maxlength: 800, default: '' },

    // 일정/장소
    shootDate:     { type: Date },                 // 촬영 날짜
    shootTime:     { type: String, trim: true },   // 촬영 시간 텍스트 (예: 14:00~16:00)
    location:      { type: String, trim: true },

    // 답장 기한
    replyDeadline: { type: Date },

    // 상태
    status: { type: String, enum: ['pending','on_hold','accepted','rejected','withdrawn'],
              default: 'pending', index: true },

    // 응답 기록(수락/거절/보류 시 메시지)
    responseMessage: { type: String, maxlength: 800 },
    respondedAt:     { type: Date }
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