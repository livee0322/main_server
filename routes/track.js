const router = require('express').Router();
const Campaign = require('../models/Campaign');
const TrackEvent = require('../models/TrackEvent');

/* click → redirect */
router.get('/t/:cid', async (req,res)=>{
  const { cid } = req.params;
  const { to, tag } = req.query;
  if (!to) return res.fail('to required','VALIDATION_FAILED',422);
  try {
    await Campaign.updateOne({ _id: cid }, { $inc: { 'metrics.clicks': 1 } });
    await TrackEvent.create({ campaign: cid, type: 'click', ua: req.headers['user-agent'], ip: req.ip, ref: req.get('referer'), tag });
  } catch {}
  res.redirect(302, to);
});

/* 1x1 view pixel */
router.get('/px.gif', async (req,res)=>{
  const { cid, tag } = req.query;
  try {
    if (cid) {
      await Campaign.updateOne({ _id: cid }, { $inc: { 'metrics.views': 1 } });
      await TrackEvent.create({ campaign: cid, type: 'view', ua: req.headers['user-agent'], ip: req.ip, ref: req.get('referer'), tag });
    }
  } catch {}
  const buf = Buffer.from('R0lGODlhAQABAPAAAP///wAAACwAAAAAAQABAAACAkQBADs=', 'base64');
  res.set('Content-Type','image/gif');
  res.set('Cache-Control','no-store');
  res.end(buf,'binary');
});

module.exports = router;