// models/Recruit-test.js
'use strict';
const mongoose = require('mongoose');

/**
 * Recruit-test
 * 실제 컬렉션은 campaigns를 공유합니다(type:'recruit' 문서 사용).
 * 엄격 검증은 해제하고 라우터에서 type 필터로 제어합니다.
 */
const RecruitTestSchema = new mongoose.Schema(
  {},
  { strict: false, collection: 'campaigns' }
);

module.exports = mongoose.model('Recruit-test', RecruitTestSchema);