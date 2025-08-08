const mongoose = require("mongoose");

const portfolioSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true
    },
    profileImage: String,
    backgroundImage: String,
    name: { type: String, required: true },
    statusMessage: String,
    jobTag: String,
    region: String,
    experienceYears: Number,
    introText: String,
    youtubeLinks: [String],
    isPublic: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Portfolio", portfolioSchema);