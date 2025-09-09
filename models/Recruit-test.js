'use strict';
const mongoose = require('mongoose');

/**
 * Recruit-test
 * - 실제 저장소는 campaigns 컬렉션을 사용
 * - 라우터에서 반드시 { type: 'recruit' } 필터를 함께 사용하세요.
 */
const RecruitTestSchema = new mongoose.Schema(
  {},
  { strict: false, collection: 'campaigns' } // 🔸 alias: campaigns
);

module.exports = mongoose.model('Recruit-test', RecruitTestSchema);