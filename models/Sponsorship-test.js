// models/Sponsorship-test.js — v1.0.0
'use strict';
const { Schema, model } = require('mongoose');

const ProductSchema = new Schema({
  name:  { type:String, trim:true },
  url:   { type:String, trim:true },
  thumb: { type:String, trim:true },
  price: { type:Number, min:0 }
}, { _id:false });

const SponsorshipSchema = new Schema({
  // 유형/상태
  type:   { type:String, enum:['delivery_keep','delivery_return','experience_review'], required:true, index:true },
  status: { type:String, enum:['open','in_progress','closed','completed'], default:'open', index:true },

  // 기본
  title:      { type:String, required:true, trim:true },
  brandName:  { type:String, required:true, trim:true },
  descriptionHTML: { type:String, default:'' },

  // 보상
  fee:           { type:Number, min:0 },
  feeNegotiable: { type:Boolean, default:false },
  productOnly:   { type:Boolean, default:false },

  // 마감
  closeAt: { type:Date, index:true },

  // 상품
  product: { type: ProductSchema, default: undefined },

  // 소유
  createdBy: { type: Schema.Types.ObjectId, ref:'User', required:true, index:true }
}, { timestamps:true, collection:'sponsorships' });

SponsorshipSchema.index({ createdAt:-1 });
SponsorshipSchema.set('toJSON', {
  virtuals:true, versionKey:false,
  transform(_d,ret){ ret.id = String(ret._id); delete ret._id; }
});

module.exports = model('Sponsorship-test', SponsorshipSchema);