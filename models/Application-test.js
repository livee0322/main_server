const mongoose = require('mongoose');
const { Schema } = mongoose;

const ApplicationSchema = new Schema({
  recruitId: { type: Schema.Types.ObjectId, ref: 'Recruit-test', required: true, index: true },
  portfolioId: { type: Schema.Types.ObjectId, ref: 'Portfolio-test', required: true, index: true },
  message: { type: String, maxlength: 800, default: '' },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  status: { type: String, enum:['submitted','reviewed','accepted','rejected'], default:'submitted', index:true }
}, { timestamps: true });

module.exports = mongoose.model('Application-test', ApplicationSchema);