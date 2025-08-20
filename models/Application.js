// /models/Application.js
const mongoose = require('mongoose');

const ApplicationSchema = new mongoose.Schema({
  campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', required: true, index: true },
  userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  profileRef: { type: String },   // 포트폴리오 링크 or id
  message:    { type: String },
  status:     { type: String, enum: ['submitted','reviewing','shortlisted','accepted','rejected'], default: 'submitted', index: true },
}, { timestamps: true });

ApplicationSchema.index({ campaignId: 1, userId: 1 }, { unique: true }); // 중복 지원 방지

module.exports = mongoose.model('Application', ApplicationSchema);