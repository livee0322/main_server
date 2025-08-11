const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, index: true },
  password: { type: String, required: true },
  role: { type: String, required: true, enum: ['brand', 'showhost'] } // ✅ 스펙 통일
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);