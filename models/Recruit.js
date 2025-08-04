const mongoose = require("mongoose");

const recruitSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  title: { type: String, required: true },
  brand: { type: String },                 // 브랜드명
  category: { type: String },              // 카테고리 (패션, 뷰티 등)
  date: { type: Date },                    // 방송일시
  description: { type: String },           // 상세 내용
  link: { type: String },                  // 지원 링크
  thumbnailUrl: { type: String },          // 썸네일 이미지 URL
  fee: { type: String },                   // 출연료 정보 (선택)
  tags: { type: String },                  // 쉼표로 구분된 태그 (선택)
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Recruit", recruitSchema);