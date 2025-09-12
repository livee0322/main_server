// models/BrandPage.test.js
const mongoose = require('mongoose');

const OptionSchema = new mongoose.Schema({
  name: { type: String, trim: true },
  price: { type: Number, default: 0 },
},{ _id:false });

const PlanSchema = new mongoose.Schema({
  id: { type: String, trim: true },
  name: { type: String, trim: true },
  price: { type: Number, default: 0 },
  duration: { type: String, trim: true },
  includes: [{ type: String, trim: true }],
  options: [OptionSchema],
  badge: { type: String, trim: true },
},{ _id:false });

const ShortSchema = new mongoose.Schema({
  provider: { type: String, trim: true },
  sourceUrl: { type: String, trim: true },
  thumbnailUrl: { type: String, trim: true },
  embedUrl: { type: String, trim: true },
},{ _id:false });

const BrandPageSchema = new mongoose.Schema({
  slug: { type: String, required: true, unique: true, index: true }, // e.g., 'byhen'
  name: { type: String, trim: true },
  tagline: { type: String, trim: true },
  location: { type: String, trim: true },
  hours: { type: String, trim: true },
  contact: {
    phone: { type: String, trim: true },
    kakaoUrl: { type: String, trim: true },
    email: { type: String, trim: true }
  },
  hero: {
    image: { type: String, trim: true },
    logo:  { type: String, trim: true }
  },
  pricing: [PlanSchema],
  availability: {
    leadDays: { type: Number, default: 0 },
    booked:   [{ type: String, trim: true }], // 'YYYY-MM-DD'
    closed:   [{ type: String, trim: true }],
    timeslots:[{ type: String, trim: true }]
  },
  studioPhotos:    [{ type: String, trim: true }],
  portfolioPhotos: [{ type: String, trim: true }],
  shorts:          [ShortSchema],
  faq: [{ q:{ type:String, trim:true }, a:{ type:String, trim:true } }],
  policy: { type: String, trim: true },
}, { timestamps: true, versionKey: false });

module.exports = mongoose.model('BrandPageTest', BrandPageSchema, 'brand_pages_test');