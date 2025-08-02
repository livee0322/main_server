// 📍 /models/Portfolio.js

const mongoose = require("mongoose");

const PortfolioSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
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
  timestamps: true,
});

module.exports = mongoose.model("Portfolio", PortfolioSchema);