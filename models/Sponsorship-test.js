'use strict';
const { Schema, model, Types } = require('mongoose');

const ProductSchema = new Schema({
  name:     { type: String, trim: true },
  url:      { type: String, trim: true },
  imageUrl: { type: String, trim: true }
},{ _id:false });

const SponsorshipSchema = new Schema({
  // 고정 타입 (프런트가 보내는 값과 동일)
  type:   { type: String, default: 'sponsorship', index: true },

  status: { type: String, enum: ['draft','published','closed'], default: 'published', index: true },

  // 기본 정보
  title:      { type: String, trim: true },
  brandName:  { type: String, trim: true },

  // 유형: 배송형/반납형/체험후기형 (+ 기타)
  sponsorType: { type: String, enum: ['shipping','return','review','other'], default: 'shipping' },

  // 비용
  fee:           { type: Number, min: 0 },
  feeNegotiable: { type: Boolean, default: false },

  // 설명/가이드(HTML 허용)
  descriptionHTML: { type: String },

  // 썸네일
  coverImageUrl: { type: String, trim: true },
  thumbnailUrl:  { type: String, trim: true },

  // 상품 블록
  product: { type: ProductSchema, default: {} },

  // 소유자
  createdBy: { type: Types.ObjectId, ref: 'User', required: true, index: true }
},{
  timestamps: true,
  collection: 'sponsorships'
});

SponsorshipSchema.set('toJSON', {
  virtuals: true, versionKey: false,
  transform(_doc, ret){ ret.id = ret._id.toString(); delete ret._id; }
});

module.exports = model('SponsorshipTest', SponsorshipSchema);