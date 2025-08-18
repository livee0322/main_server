const { Schema, model } = require('mongoose');

const AnswerSchema = new Schema({
  questionId: String,          // Campaign.recruit.questions[*]._id
  value: Schema.Types.Mixed,    // string|number|url|...
});

const ApplicationSchema = new Schema({
  campaign: { type: Schema.Types.ObjectId, ref:'Campaign', required: true, index: true },
  user:     { type: Schema.Types.ObjectId, ref:'User', required: true, index: true },
  status:   { type: String, enum:['new','shortlist','rejected','hired'], default:'new', index:true },
  answers:  [AnswerSchema],
  memo:     String,
}, { timestamps: true });

ApplicationSchema.index({ campaign:1, user:1 }, { unique: true });

module.exports = model('Application', ApplicationSchema);