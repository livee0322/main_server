// models/News-test.js
const mongoose = require('mongoose');

const NewsSchema = new mongoose.Schema({
  type: { type:String, default:'news', index:true },

  status: { type:String, enum:['draft','pending','published','rejected'], default:'published', index:true }, // ✅ 기본 발행
  visibility: { type:String, enum:['public','unlisted','private'], default:'public', index:true },

  category: { type:String, trim:true, default:'공지' },
  title:    { type:String, trim:true, required:true, maxlength:60 },
  summary:  { type:String, trim:true, maxlength:300 },
  content:  { type:String },
  thumbnailUrl: { type:String, trim:true },

  consent:  { type:Boolean, default:false },

  createdBy: { type:mongoose.Schema.Types.ObjectId, ref:'User', index:true },
}, { timestamps:true });

NewsSchema.index({ status:1, visibility:1, createdAt:-1 });

module.exports = mongoose.model('NewsTest', NewsSchema);