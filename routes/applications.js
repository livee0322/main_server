const router = require('express').Router();
const Campaign = require('../models/Campaign');
const Application = require('../models/Application');
const auth = require('../src/middleware/auth');
const requireRole = require('../src/middleware/requireRole');

/* Create application */
router.post('/campaigns/:cid/applications', auth, async (req,res)=>{
  const c = await Campaign.findById(req.params.cid);
  if (!c || c.type!=='recruit') return res.fail('NOT_FOUND','NOT_FOUND',404);

  const created = await Application.create({
    campaign: c._id,
    user: req.user.id,
    answers: Array.isArray(req.body.answers) ? req.body.answers : [],
  });

  await Campaign.updateOne({_id:c._id}, {$inc:{'metrics.applications':1}});
  res.ok({ data: created }, 201);
});

/* List applications (owner) */
router.get('/campaigns/:cid/applications', auth, requireRole('brand','admin'), async (req,res)=>{
  const c = await Campaign.findOne({ _id:req.params.cid, createdBy:req.user.id });
  if (!c) return res.fail('FORBIDDEN','FORBIDDEN',403);

  const list = await Application.find({ campaign:c._id }).sort({ createdAt:-1 });
  res.ok({ items: list });
});

/* Update application status/memo */
router.put('/applications/:id', auth, requireRole('brand','admin'), async (req,res)=>{
  const app = await Application.findById(req.params.id).populate('campaign');
  if (!app || String(app.campaign.createdBy) !== req.user.id) return res.fail('FORBIDDEN','FORBIDDEN',403);

  const $set = {};
  if (req.body.status) $set.status = req.body.status;
  if (typeof req.body.memo === 'string') $set.memo = req.body.memo;

  const updated = await Application.findByIdAndUpdate(app._id, {$set}, { new:true });
  res.ok({ data: updated });
});

module.exports = router;