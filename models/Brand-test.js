// models/Brand-test.js — v1.0.1
const mongoose = require('mongoose');

const BrandSchema = new mongoose.Schema({
  type: { type:String, default:'brand' },
  status: { type:String, enum:['draft','published'], default:'published', index:true },
  slug: { type:String, required:true, unique:true, lowercase:true, trim:true, index:true },
  name: { type:String, required:true, trim:true },

  thumbnail: { type:String, default:'' },
  subThumbnails: { type:[String], default:[] },
  gallery: { type:[String], default:[] },

  intro: { type:String, default:'' },          // 한 줄 소개
  description: { type:String, default:'' },    // 상세 소개
  usageGuide: { type:String, default:'' },
  priceInfo: { type:String, default:'' },

  contact: {
    phone: { type:String, default:'' },
    email: { type:String, default:'' },
    kakao: { type:String, default:'' }
  },

  address: { type:String, default:'' },
  map: { link:{ type:String, default:'' } },

  availableHours: { type:String, default:'' },
  timeslots: { type:[String], default:[] },
  availableDates: { type:[String], default:[] },

  closed: { type:[String], default:[] },  // YYYY-MM-DD
  booked: { type:[String], default:[] }
}, { timestamps:true });

BrandSchema.index({ name:'text', intro:'text', description:'text', address:'text' });

module.exports = mongoose.model('BrandTest', BrandSchema, 'brand-test');