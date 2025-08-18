const mongoose = require('mongoose');
const { Schema } = mongoose;

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

  // 상품형
  products: [ProductItemSchema],

  // 모집형
  recruit: {
    location: String,
    shootDate: Date,
    shootTime: String,
    pay: String,
    payNegotiable: { type: Boolean, default: false },
    requirements: String,
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