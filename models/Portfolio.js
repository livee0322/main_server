const // 📍 /models/Portfolio.js

const mongoose = require("mongoose");

const PortfolioSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // 사용자 연결
  name: { type: String, required: true },
  age: { type: String },
  experience: { type: String },
  region: { type: String },
  sns: { type: String },
  tags: { type: String },
  specialty: { type: String },
  image: { type: String },
  isPublic: { type: Boolean, default: false },
}, {
  timestamps: true, // createdAt, updatedAt 자동 생성
});

module.exports = mongoose.model("Portfolio", PortfolioSchema);