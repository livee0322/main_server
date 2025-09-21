// Brand-test.js
const mongoose = require('mongoose');

const BrandSchema = new mongoose.Schema({
  slug: { type: String, unique: true, index: true, required: true }, // 'byhen'
  name: { type: String, default: '' },

  thumbnail: { type: String, default: '' },
  subThumbnails: { type: [String], default: [] },

  intro: { type: String, default: '' },        // 소개
  usageGuide: { type: String, default: '' },   // 이용 안내(규정/환불 등)
  priceInfo: { type: String, default: '' },    // 금액 안내 텍스트

  availableHours: { type: String, default: '' },
  timeslots: { type: [String], default: [] },  // ["10:00","14:00","19:00"]

  availableDates: { type: [String], default: [] }, // 허용일(선택)
  closed: { type: [String], default: [] },         // 휴무일
  booked: { type: [String], default: [] },         // 마감일

  contact: {
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
    kakao: { type: String, default: '' }
  },

  address: { type: String, default: '' },
  map: {
    link: { type: String, default: '' }
  },

  gallery: { type: [String], default: [] },    // 이미지 URL들
}, { timestamps: true });

module.exports = mongoose.model('BrandTest', BrandSchema);
