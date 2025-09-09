// models/Application-test.js
'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const ApplicationSchema = new Schema(
  {
    recruitId:   { type: Schema.Types.ObjectId, ref: 'Recruit-test', required: true, index: true },
    portfolioId: { type: Schema.Types.ObjectId, ref: 'Portfolio-test', required: true, index: true },
    message:     { type: String, maxlength: 800, default: '' },
    createdBy:   { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // 프론트와 동일한 상태 세트
    status:      { type: String, enum: ['pending','on_hold','accepted','rejected'], default: 'pending', index: true }
  },
  { timestamps: true }
);

// 동일 포트폴리오가 동일 공고에 중복 지원 못하게
ApplicationSchema.index({ recruitId: 1, portfolioId: 1 }, { unique: true });

// JSON 직렬화: _id -> id
ApplicationSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform(_doc, ret) {
    ret.id = ret._id.toString();
    delete ret._id;
  },
});

module.exports = mongoose.model('Application-test', ApplicationSchema);