const mongoose = require("mongoose");

const portfolioSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    nickname: { type: String, trim: true },
    oneLineIntro: { type: String, trim: true },
    detailedIntro: { type: String },
    experienceYears: { type: Number },
    age: { type: Number },
    mainLink: { type: String, trim: true },
    mainThumbnailUrl: { type: String, trim: true },
    backgroundImageUrl: { type: String, trim: true },
    subThumbnailUrls: [{ type: String, trim: true }],
    publicScope: { type: String, default: '전체공개' },
    isReceivingOffers: { type: Boolean, default: true },
    recentLives: [{
      title: { type: String, trim: true },
      url:   { type: String, trim: true },
      date:  { type: Date }
    }],
    tags: [{ type: String, trim: true }],
    status: { type: String, enum: ['draft','published'], default: 'draft' },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Portfolio", portfolioSchema);