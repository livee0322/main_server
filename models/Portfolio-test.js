// models/Portfolio-test.js
const { Schema, model } = require('mongoose');

const LinkSchema = new Schema({ title:String, url:String, date:Date }, { _id:false });

const PortfolioSchema = new Schema({
  type: { type:String, default:'portfolio' },
  status: { type:String, enum:['draft','published'], default:'draft' },
  visibility: { type:String, enum:['public','unlisted','private'], default:'public' },

  nickname: String,
  headline: String,
  bio: String,

  mainThumbnailUrl: String,
  coverImageUrl: String,
  subThumbnails: [String],

  realName: String,
  realNamePublic: Boolean,
  careerYears: Number,
  age: Number,
  agePublic: Boolean,

  primaryLink: String,
  liveLinks: [LinkSchema],
  tags: [String],
  openToOffers: { type:Boolean, default:true },

  createdBy: { type: Schema.Types.ObjectId, ref:'User', index:true }, // ⚠ unique 아님!
}, { timestamps:true });

PortfolioSchema.index({ status:1, visibility:1, createdAt:-1 });

module.exports = model('PortfolioTest', PortfolioSchema);