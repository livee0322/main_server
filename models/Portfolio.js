const mongoose = require("mongoose");

const portfolioSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true
    },
    name: { type: String, required: true },
    statusMessage: { type: String },
    jobTag: { type: String },
    region: { type: String },
    experienceYears: { type: Number },
    introText: { type: String },
    profileImage: { type: String, default: "" },
    backgroundImage: { type: String, default: "" },
    youtubeLinks: [String],
    isPublic: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Portfolio", portfolioSchema);