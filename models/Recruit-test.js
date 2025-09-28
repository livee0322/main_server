// models/Recruit-test.js — v1.0.0 (단일 리크루트 모델)
'use strict';
const { Schema, model } = require('mongoose');

const RecruitBodySchema = new Schema({
  recruitType:   { type: String, enum:['product','host','both'], default:'product' },
  brandName:     { type: String, trim: true },
  location:      { type: String, trim: true },
  shootDate:     { type: Date },
  shootTime:     { type: String, trim: true },     // 예: "14:00~18:00"
  durationHours: { type: Number, min: 0 },
  // 하위(pay)는 상위(fee)와 동치. 저장은 해주되 조회시 상위값을 기준으로 노출.
  pay:           { type: Number, min: 0 },
  payNegotiable: { type: Boolean, default: false },
  requirements:  { type: String, default: '' }
}, { _id:false });

const RecruitSchema = new Schema({
  type:        { type: String, default: 'recruit', index: true },
  status:      { type: String, enum:['draft','scheduled','published','closed'], default:'draft', index:true },

  title:       { type: String, required: true, trim: true },
  brandName:   { type: String, trim: true },
  category:    { type: String, trim: true },

  coverImageUrl: { type: String, trim: true },
  thumbnailUrl:  { type: String, trim: true },
  descriptionHTML: { type: String, default: '' },

  roles:       [{ type: String, trim: true }],     // 체크박스 직군

  // 마감/요약 필드
  closeAt:     { type: Date },

  // 요약 출연료(목록 카드에서 바로 쓰는 값)
  fee:           { type: Number, min: 0 },
  feeNegotiable: { type: Boolean, default: false },

  // 상세
  recruit:     { type: RecruitBodySchema, default: undefined },

  // 소유자
  createdBy:   { type: Schema.Types.ObjectId, ref:'User', required:true, index:true },
}, { timestamps:true, collection:'recruits' });

/* 인덱스 */
RecruitSchema.index({ createdAt:-1 });
RecruitSchema.index({ status:1, closeAt:1 });
RecruitSchema.index({ brandName:1 });
RecruitSchema.index({ category:1 });

/* JSON 변환 */
RecruitSchema.set('toJSON', {
  virtuals: true, versionKey: false,
  transform(_doc, ret){
    ret.id = String(ret._id); delete ret._id;
  }
});

module.exports = model('Recruit-test', RecruitSchema);