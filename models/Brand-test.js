// models/Brand-test.js
const mongoose = require('mongoose');

const ContactSchema = new mongoose.Schema({
  phone: { type: String, default: '' },
  email: { type: String, default: '' },
  kakao: { type: String, default: '' },
}, { _id: false });

const MapSchema = new mongoose.Schema({
  link: { type: String, default: '' },
}, { _id: false });

const BrandSchema = new mongoose.Schema({
  type:   { type: String, default: 'brand' },
  status: { type: String, enum: ['draft','published'], default: 'draft' },

  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, trim: true, lowercase: true, index: true, unique: true },

  thumbnail: { type: String, default: '' },
  subThumbnails: { type: [String], default: [] },
  gallery: { type: [String], default: [] },

  intro:        { type: String, default: '' },
  description:  { type: String, default: '' },
  usageGuide:   { type: String, default: '' },
  priceInfo:    { type: String, default: '' },

  contact: ContactSchema,
  address: { type: String, default: '' },
  map:     MapSchema,

  availableHours: { type: String, default: '' },
  timeslots:      { type: [String], default: [] },
  availableDates: { type: [String], default: [] },
  closed:         { type: [String], default: [] },
  booked:         { type: [String], default: [] },
}, { timestamps: true });

// 텍스트 검색 인덱스
BrandSchema.index({ name: 'text', intro: 'text', description: 'text', address: 'text' });

// 모델명은 하이픈 없이!
module.exports = mongoose.models.BrandTest || mongoose.model('BrandTest', BrandSchema);