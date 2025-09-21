// Brand-test.js — v1.0.0 (Mongoose Model)
const mongoose = require('mongoose');

const ContactSchema = new mongoose.Schema({
  phone: String,
  email: String,
  kakao: String
}, { _id:false });

const MapSchema = new mongoose.Schema({
  link: String
}, { _id:false });

const ScheduleSchema = new mongoose.Schema({
  availableHours: String,
  timeslots:     [String],
  availableDates:[String], // 'YYYY-MM-DD'
  closed:        [String],
  booked:        [String]
}, { _id:false });

const BrandSchema = new mongoose.Schema({
  type:   { type:String, default:'brand' },
  status: { type:String, enum:['draft','published'], default:'draft' },

  slug:   { type:String, required:true, unique:true, index:true, lowercase:true, trim:true },
  name:   { type:String, required:true },

  thumbnail:      { type:String, default:'' },
  subThumbnails:  { type:[String], default:[] },

  intro:       { type:String, default:'' },
  usageGuide:  { type:String, default:'' },
  priceInfo:   { type:String, default:'' },
  address:     { type:String, default:'' },

  contact:     { type: ContactSchema, default: {} },
  map:         { type: MapSchema,      default: {} },

  gallery:     { type:[String], default:[] },
  schedule:    { type: ScheduleSchema, default: {} },

  // timestamps
}, { timestamps:true, collection:'brands-test' });

// 인덱스(간단 검색용)
BrandSchema.index({ name:'text', intro:'text', address:'text' });

module.exports = mongoose.model('BrandTest', BrandSchema);