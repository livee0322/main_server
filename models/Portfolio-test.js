// models/Portfolio-test.js
'use strict';
const { Schema, model, Types } = require('mongoose');

const PortfolioSchema = new Schema({
  type: { type: String, default: 'portfolio', index: true },
  status: { type: String, enum: ['draft','published'], default: 'draft', index: true },
  visibility: { type: String, enum: ['public','unlisted','private'], default: 'public', index: true },

  nickname: { type: String, required: true, trim: true },
  headline: { type: String, required: true, trim: true },
  bio: { type: String, default: '' },

  mainThumbnailUrl: { type: String, default: '' },
  coverImageUrl: { type: String, default: '' },
  subThumbnails: { type: [String], default: [] },

  realName: { type: String, default: '' },
  realNamePublic: { type: Boolean, default: false },
  age: { type: Number },
  agePublic: { type: Boolean, default: false },
  careerYears: { type: Number },

  primaryLink: { type: String, default: '' },
  liveLinks: [{
    title: { type: String, trim: true },
    url:   { type: String, trim: true },
    date:  { type: Date }
  }],

  tags: { type: [String], default: [] },
  openToOffers: { type: Boolean, default: true },

  createdBy: { type: Types.ObjectId, ref: 'User', required: true, index: true }, // ✅ unique 제거
}, { timestamps: true });

PortfolioSchema.index({ createdAt: -1 });
PortfolioSchema.index({ status: 1, visibility: 1, createdAt: -1 });

module.exports = model('Portfolio', PortfolioSchema);