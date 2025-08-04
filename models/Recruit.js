// models/Recruit.js

const mongoose = require("mongoose");

const recruitSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  title: { type: String, required: true },
  category: { type: String },
  description: { type: String },
  image: { type: String },
  fee: { type: String },           // 출연료 정보 (문자열로 처리)
  tags: { type: String },          // 쉼표로 구분된 태그
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Recruit", recruitSchema);