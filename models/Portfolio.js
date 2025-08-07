const mongoose = require("mongoose");

const portfolioSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true // 사용자당 하나만
    },
    profileImage: {
      type: String,
      default: ""
    },
    backgroundImage: {
      type: String,
      default: ""
    },
    name: {
      type: String,
      required: true
    },
    statusMessage: String,
    jobTag: String,
    region: String,
    experienceYears: Number,
    introText: String,
    youtubeLinks: [String],
    isPublic: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true // createdAt, updatedAt 자동 생성
  }
);

module.exports = mongoose.model("Portfolio", portfolioSchema);