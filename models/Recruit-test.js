// models/Recruit-test.js — v1.0.0
const mongoose = require('mongoose');
const { Schema } = mongoose;

/* Product 아이템(라이브/상품 공통) */
const ProductItemSchema = new Schema({
  url: String,
  marketplace: {
    type: String,
    enum: ['smartstore','coupang','gmarket','etc'],
    default: 'etc'
  },
  title: String,
  price: Number,
  salePrice: Number,
  saleDurationSec: Number,
  saleUntil: Date,
  imageUrl: String,
  deepLink: String,
  utm: { source:String, medium:String, campaign:String },
  detailHtml: String
},{ _id:true });

/* 추가 질문(옵션) */
const QuestionSchema = new Schema({
  label: { type:String, required:true },
  type: {
    type:String,
    enum:['short','long','select','file','url','number'],
    default:'short'
  },
  required: { type:Boolean, default:false },
  options: [String]
},{ _id:true });

/* Recruit 메인 스키마 */
const RecruitSchema = new Schema({
  type:   { type:String, enum:['recruit'], default:'recruit', index:true },
  status: { type:String, enum:['draft','scheduled','published','closed'], default:'draft', index:true },

  title: { type:String, required:true },
  brandName: String,
  category: String,

  coverImageUrl: String,
  thumbnailUrl: String, // Cloudinary 변환 결과 저장
  descriptionHTML: String,

  publishAt: Date,
  closeAt: Date,

  /* 카드/상세에서 사용하는 요약 필드 */
  location: String,
  shootDate: Date,
  shootTime: String,
  fee: Number,
  feeNegotiable: { type:Boolean, default:false },

  /* 상세 정보 */
  recruit: {
    recruitType: { type:String, enum:['product','host','both'], default:'product' },
    brandName: String,
    location: String,
    requirements: String,
    preferred: String,
    durationHours: Number,
    questions: [QuestionSchema],
    pay: Number,               // 호환용 입력
    payNegotiable: Boolean     // 호환용 입력
  },

  /* 쇼핑라이브 / 상품 */
  products: [ProductItemSchema],

  metrics: {
    views: { type:Number, default:0 },
    clicks: { type:Number, default:0 },
    applications: { type:Number, default:0 }
  },

  createdBy: { type: Schema.Types.ObjectId, ref:'User', required:true, index:true }
},{ timestamps:true });

RecruitSchema.index({ createdAt:-1 });
RecruitSchema.index({ type:1, status:1 });

module.exports = mongoose.model('RecruitTest', RecruitSchema, 'recruits-dev');