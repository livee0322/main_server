// models/Recruit.js
const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
  url: { type: String, required: true },
  title: String,
  price: Number,        // 원가
  salePrice: Number,    // 할인 적용가
  thumbUrl: String,
  detailHtml: String,   // 상세페이지(HTML 허용: 서버에서 sanitize)
  saleUntil: Date,      // 할인 종료 시각(서버에서 최대 3시간 제한)
}, { _id: true, timestamps: true });

const RecruitSchema = new mongoose.Schema({
  // 공통
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum:['product','host','both'], default:'product' },

  // 공통 표시
  title: { type: String, required: true },
  description: String,
  imageUrl: String,      // 대표 썸네일(선택)
  thumbnailUrl: String,  // 서버에서 변환본 저장해둘 수 있음
  date: Date,
  time: String,
  location: String,

  // 쇼호스트 모집 전용
  pay: String,
  payNegotiable: Boolean,

  // 상품 등록 전용
  products: { type: [ProductSchema], default: [] },

}, { timestamps: true });

module.exports = mongoose.model('Recruit', RecruitSchema);