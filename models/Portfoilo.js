const mongoose = require("mongoose");

const PortfolioSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  name: String,
  age: String,
  experience: String,
  region: String,
  sns: String,
  tags: String,
  specialty: String,
  image: String,
  isPublic: Boolean,
}, { timestamps: true });

module.exports = mongoose.model("Portfolio", PortfolioSchema);