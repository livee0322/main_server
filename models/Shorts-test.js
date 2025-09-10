// models/Shorts-test.js
const mongoose = require('mongoose');

const ShortClipSchema = new mongoose.Schema({
  provider: { type: String, enum: ['youtube', 'instagram', 'unknown'], default: 'unknown' },
  url:       { type: String, required: true, index: true },
  embedSrc:  { type: String, required: true },     // 실제 iframe src (html 아님)
  title:     { type: String, default: '' },
  author:    { type: String, default: '' },
  thumbUrl:  { type: String, default: '' },
  tags:      [{ type: String }],
  status:    { type: String, enum: ['draft','published'], default: 'published', index: true },
}, { timestamps: true });

module.exports = mongoose.model('ShortClip', ShortClipSchema);