// models/ModelProfile.js
const mongoose = require('mongoose');

const ModelProfileSchema = new mongoose.Schema({
  slug: { type: String, unique: true, trim: true, lowercase: true, index: true },
  name: { type: String, required: true, trim: true, index: 'text' },
  gender: { type: String, enum: ['female','male','other'], default: 'female' },
  birthYear: Number,
  physical: { height: Number, weight: Number, top: String, bottom: String, shoes: String },
  tags: [String],                // 예: '뷰티', '패션', '홈쇼핑', '피팅'
  hero: { image: String, images: [String] }, // 대표/슬라이드 (Cloudinary)
  gallery: [String],             // 포트폴리오 이미지
  reels: [{ provider: String, embedUrl: String, thumbnailUrl: String }],
  socials: {
    instagram: String, tiktok: String, youtube: String
  },
  contact: { phone: String, kakaoUrl: String, email: String },
  agency: { name: String, contact: String },
  location: String,
  languages: [String],
  feeNote: String,               // 출연/촬영료 메모
  experience: String,            // 경력/레퍼런스 서술형
  rating: { avg: Number, count: Number },
  availability: {
    leadDays: { type: Number, default: 2 },
    timeslots: [String],
    booked: [String],            // 'YYYY-MM-DD'
    closed: [String]
  },
  status: { type: String, enum: ['draft','published','archived'], default: 'published', index: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: Date
}, { timestamps: true });

ModelProfileSchema.index({ name: 'text', tags: 'text' });
module.exports = mongoose.model('ModelProfile', ModelProfileSchema);