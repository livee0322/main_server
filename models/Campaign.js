// models/Campaign.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

// Product 스키마에 detailHtml 추가 (Recruit 모델 호환)
const ProductItemSchema = new Schema({
  url: { type: String, required: true },
  marketplace: { type: String, enum: ['smartstore', 'coupang', 'gmarket', 'etc'], default: 'smartstore' },
  title: String,
  price: Number,
  salePrice: Number,
  saleDurationSec: Number, // 0|3600|7200|10800
  saleUntil: Date,
  imageUrl: String,
  deepLink: String,
  utm: { source: String, medium: String, campaign: String },
  detailHtml: String, // Recruit 모델의 Product 스키마와 호환을 위해 추가
}, { _id: true });

const QuestionSchema = new Schema({
  label: { type: String, required: true },
  type: { type: String, enum: ['short','long','select','file','url','number'], default: 'short' },
  required: { type: Boolean, default: false },
  options: [String],
}, { _id: true });

const CampaignSchema = new Schema({
  type: { type: String, enum: ['product','recruit'], required: true, index: true },
  status: { type: String, enum: ['draft','scheduled','published','closed'], default: 'draft', index: true },

  title: { type: String, required: true },
  brand: String,
  category: String,

  coverImageUrl: String,
  thumbnailUrl: String, // derived from coverImageUrl (Cloudinary transform)
  descriptionHTML: String,

  liveDate: Date,
  liveTime: String,

  publishAt: Date,
  closeAt: Date,

  // 상품 정보 (이제 'recruit' 타입도 상품을 가질 수 있음)
  products: [ProductItemSchema],

  location: String,
  shootDate: Date,
  shootTime: String,
  fee: Number, // 'pay'에서 'fee'로 이름 변경 및 타입 지정
  feeNegotiable: { type: Boolean, default: false }, // 'payNegotiable'에서 이름 변경

  // 모집형 상세 정보
  recruit: {
    // Recruit 모델의 필드들을 통합
    recruitType: { type: String, enum:['product','host','both'], default:'product' }, 
    location: String,
    requirements: String, // Recruit 모델의 description과 호환
    preferred: String,
    questions: [QuestionSchema],
  },

  metrics: {
    views: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
    applications: { type: Number, default: 0 },
  },

  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
}, { timestamps: true });

CampaignSchema.index({ createdAt: -1 });
CampaignSchema.index({ type: 1, status: 1 });

module.exports = mongoose.model('Campaign', CampaignSchema);