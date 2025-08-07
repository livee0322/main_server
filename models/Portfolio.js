const mongoose = require("mongoose");

const PortfolioSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true // 사용자당 하나의 포트폴리오만 허용
  },
  name: { type: String, required: true },
  statusMessage: { type: String },
  jobTag: { type: String },
  region: { type: String },
  experienceYears: { type: Number },
  introText: { type: String },
  profileImage: { type: String },        // ✅ 프로필 이미지 URL (Cloudinary)
  backgroundImage: { type: String },     // ✅ 배경 이미지 URL (Cloudinary)
  youtubeLinks: [{ type: String }],      // ✅ 쇼핑라이브 영상 링크들
  isPublic: { type: Boolean, default: true }
}, {
  timestamps: true
});

module.exports = mongoose.model("Portfolio", PortfolioSchema);