const router = require('express').Router();
const Campaign = require('../models/Campaign');
const auth = require('../src/middleware/auth');
const requireRole = require('../src/middleware/requireRole');

const THUMB = process.env.CLOUDINARY_THUMB || 'c_fill,g_auto,w_640,h_360,f_auto,q_auto';
const toThumb = (url='') => { try { const [h,t]=String(url).split('/upload/'); return t ? `${h}/upload/${THUMB}/${t}` : url; } catch { return url; } };
const toDTO = (doc) => {
  const o = (doc?.toObject ? doc.toObject() : doc) || {};
  const imageUrl = o.coverImageUrl || o.thumbnailUrl || '';
  const thumbnailUrl = o.thumbnailUrl || toThumb(imageUrl) || '';
  return { ...o, imageUrl, thumbnailUrl, id: o._id?.toString?.() || o.id, _id: o._id };
};

// GET /recruits?limit=
router.get('/', async (req,res)=>{
  const limit = Math.min(parseInt(req.query.limit||'20'), 50);
  const docs = await Campaign.find({ type:'recruit' }).sort({ createdAt:-1 }).limit(limit);
  res.ok({ items: docs.map(toDTO) });
});

// GET /recruits/mine
router.get('/mine', auth, requireRole('brand','admin'), async (req,res)=>{
  const docs = await Campaign.find({ type:'recruit', createdBy:req.user.id }).sort({ createdAt:-1 });
  res.ok({ items: docs.map(toDTO) });
});

// GET /recruits/schedule (today~+3)
router.get('/schedule', async (_req,res)=>{
  const now = new Date(); now.setHours(0,0,0,0);
  const end = new Date(now); end.setDate(end.getDate()+3); end.setHours(23,59,59,999);
  const docs = await Campaign.find({
    type:'recruit',
    'recruit.shootDate': { $gte: now, $lte: end }
  }).sort({ 'recruit.shootDate': 1 }).limit(50);

  const items = docs.map(toDTO).map(r => ({
    _id: r._id || r.id,
    title: r.title,
    date: r.recruit?.shootDate || r.liveDate,
    description: r.recruit?.requirements || r.descriptionHTML,
    imageUrl: r.imageUrl,
    thumbnailUrl: r.thumbnailUrl,
  }));
  res.ok({ items });
});

// POST /recruits
router.post('/', auth, requireRole('brand'),
  async (req,res)=>{
    const payload = {
      type: 'recruit',
      title: req.body.title,
      coverImageUrl: req.body.imageUrl,
      thumbnailUrl: req.body.thumbnailUrl || toThumb(req.body.imageUrl),
      descriptionHTML: (req.body.description || '').replace(/\n/g,'<br/>'),
      recruit: {
        shootDate: req.body.date ? new Date(req.body.date) : undefined,
        shootTime: req.body.time,
        location: req.body.location,
        pay: req.body.pay,
        payNegotiable: !!req.body.payNeg,
        requirements: req.body.description,
      },
      brand: req.body.brand,
      category: req.body.category,
      createdBy: req.user.id,
      status: 'published',
    };
    const created = await Campaign.create(payload);
    res.ok({ message:'공고 등록', data: toDTO(created) }, 201);
  }
);

// PUT /recruits/:id
router.put('/:id', auth, requireRole('brand','admin'), async (req,res)=>{
  const $set = {
    title: req.body.title,
    coverImageUrl: req.body.imageUrl,
    thumbnailUrl: req.body.thumbnailUrl || (req.body.imageUrl ? toThumb(req.body.imageUrl) : undefined),
    descriptionHTML: (req.body.description || '').replace(/\n/g,'<br/>'),
    brand: req.body.brand,
    category: req.body.category,
    recruit: {
      shootDate: req.body.date ? new Date(req.body.date) : undefined,
      shootTime: req.body.time,
      location: req.body.location,
      pay: req.body.pay,
      payNegotiable: !!req.body.payNeg,
      requirements: req.body.description,
    },
  };
  const updated = await Campaign.findOneAndUpdate(
    { _id: req.params.id, createdBy: req.user.id, type:'recruit' },
    { $set }, { new:true }
  );
  if (!updated) return res.fail('RECRUIT_FORBIDDEN_EDIT','RECRUIT_FORBIDDEN_EDIT',403);
  res.ok({ message:'수정 완료', data: toDTO(updated) });
});

// DELETE /recruits/:id
router.delete('/:id', auth, requireRole('brand','admin'), async (req,res)=>{
  const removed = await Campaign.findOneAndDelete({ _id:req.params.id, createdBy:req.user.id, type:'recruit' });
  if (!removed) return res.fail('RECRUIT_FORBIDDEN_DELETE','RECRUIT_FORBIDDEN_DELETE',403);
  res.ok({ message:'삭제 완료' });
});

module.exports = router;