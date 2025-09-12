// routes/brands-test.js
const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

// ---- Schema (테스트용 단일 파일 모델) ----
const PriceSchema = new mongoose.Schema({
  name: { type: String, trim: true, required: true },
  price: { type: Number, default: 0 },
  duration: { type: String, trim: true },
  includes: [{ type: String, trim: true }],
  options: [{ name: String, price: { type: Number, default: 0 } }],
}, { _id: false });

const FAQSchema = new mongoose.Schema({
  q: { type: String, trim: true },
  a: { type: String, trim: true },
}, { _id: false });

const ShortsSchema = new mongoose.Schema({
  sourceUrl: { type: String, trim: true },
  provider:  { type: String, trim: true },
  embedUrl:  { type: String, trim: true },
  thumbnailUrl: { type: String, trim: true },
}, { _id: false });

const BrandTestSchema = new mongoose.Schema({
  slug: { type: String, trim: true, index: true, unique: true },
  type: { type: String, default: 'brand' },
  status: { type: String, default: 'published' },

  name: { type: String, trim: true, required: true },
  tagline: { type: String, trim: true },
  location: { type: String, trim: true },
  hours: { type: String, trim: true },

  hero: {
    image: { type: String, trim: true },
    logo:  { type: String, trim: true },
  },

  contact: {
    phone: { type: String, trim: true },
    kakaoUrl: { type: String, trim: true },
    email: { type: String, trim: true },
  },

  links: {
    website: { type: String, trim: true },
    map: { type: String, trim: true },
  },

  studioPhotos: [{ type: String, trim: true }],
  portfolioPhotos: [{ type: String, trim: true }],
  pricing: [PriceSchema],

  availability: {
    leadDays: { type: Number, default: 0 },
    timeslots: [{ type: String, trim: true }],
    booked: [{ type: String, trim: true }],
    closed: [{ type: String, trim: true }],
  },

  faq: [FAQSchema],
  policy: { type: String, trim: true },
  shorts: [ShortsSchema],
}, { timestamps: true });

const BrandTest = mongoose.models.BrandTest || mongoose.model('BrandTest', BrandTestSchema);

// ---- helpers ----
const asArray = (v) => Array.isArray(v) ? v : (v ? [v] : []);
const pick = (obj, keys) => Object.fromEntries(keys.map(k => [k, obj[k]]));

// ---- GET /?slug=byhen&limit=1  (리스트/단건) ----
router.get('/', async (req, res) => {
  try {
    const { slug, limit = 20 } = req.query;
    if (slug) {
      const doc = await BrandTest.findOne({ slug }).lean();
      if (!doc) return res.fail ? res.fail('NOT_FOUND', 404, { slug }) : res.status(404).json({ ok:false, message:'NOT_FOUND' });
      return res.ok ? res.ok({ data: doc }) : res.json({ ok:true, data: doc });
    }
    const items = await BrandTest.find({}).sort({ updatedAt: -1 }).limit(Number(limit) || 20).lean();
    return res.ok ? res.ok({ items }) : res.json({ ok:true, items });
  } catch (err) {
    console.error('[brands-test GET]', err);
    return res.fail ? res.fail('INTERNAL_ERROR', 500) : res.status(500).json({ ok:false, message:'INTERNAL_ERROR' });
  }
});

// ---- GET /:id ----
router.get('/:id', async (req, res) => {
  try {
    const doc = await BrandTest.findById(req.params.id).lean();
    if (!doc) return res.fail ? res.fail('NOT_FOUND', 404) : res.status(404).json({ ok:false });
    return res.ok ? res.ok({ data: doc }) : res.json({ ok:true, data: doc });
  } catch (err) {
    console.error('[brands-test GET/:id]', err);
    return res.fail ? res.fail('INTERNAL_ERROR', 500) : res.status(500).json({ ok:false });
  }
});

// ---- POST /  (slug 기준 upsert, 비로그인 허용) ----
router.post('/', async (req, res) => {
  try {
    const b = req.body || {};
    const slug = (b.slug || 'byhen').trim().toLowerCase();
    const name = (b.name || '').trim();
    const heroImage = b?.hero?.image;

    if (!name)  return res.fail ? res.fail('BAD_REQUEST', 400, { field:'name' }) : res.status(400).json({ ok:false, message:'name required' });
    if (!heroImage) return res.fail ? res.fail('BAD_REQUEST', 400, { field:'hero.image' }) : res.status(400).json({ ok:false, message:'hero.image required' });

    // 정규화
    const payload = {
      slug,
      type: b.type || 'brand',
      status: b.status || 'published',
      name,
      tagline: b.tagline,
      location: b.location,
      hours: b.hours,
      hero: { image: heroImage, logo: b?.hero?.logo },
      contact: b.contact || {},
      links: b.links || {},
      studioPhotos: asArray(b.studioPhotos),
      portfolioPhotos: asArray(b.portfolioPhotos),
      pricing: asArray(b.pricing),
      availability: {
        leadDays: Number(b?.availability?.leadDays || 0),
        timeslots: asArray(b?.availability?.timeslots),
        booked: asArray(b?.availability?.booked),
        closed: asArray(b?.availability?.closed),
      },
      faq: asArray(b.faq),
      policy: b.policy || '',
      shorts: asArray(b.shorts),
    };

    const doc = await BrandTest.findOneAndUpdate(
      { slug },
      { $set: payload },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();

    return res.ok ? res.ok({ data: doc }, 201) : res.status(201).json({ ok:true, data: doc });
  } catch (err) {
    console.error('[brands-test POST]', err);
    // 중복키 등
    const code = err?.code === 11000 ? 'ALREADY_EXISTS' : 'INTERNAL_ERROR';
    const status = err?.code === 11000 ? 409 : 500;
    return res.fail ? res.fail(code, status, { error: err.message }) : res.status(status).json({ ok:false, message:code });
  }
});

// ---- PUT /:id  (수정) ----
router.put('/:id', async (req, res) => {
  try {
    const b = req.body || {};
    const allowed = [
      'name','tagline','location','hours','status','type','hero','contact','links',
      'studioPhotos','portfolioPhotos','pricing','availability','faq','policy','shorts'
    ];
    const toSet = pick(b, allowed);
    const doc = await BrandTest.findByIdAndUpdate(req.params.id, { $set: toSet }, { new: true }).lean();
    if (!doc) return res.fail ? res.fail('NOT_FOUND', 404) : res.status(404).json({ ok:false });
    return res.ok ? res.ok({ data: doc }) : res.json({ ok:true, data: doc });
  } catch (err) {
    console.error('[brands-test PUT/:id]', err);
    return res.fail ? res.fail('INTERNAL_ERROR', 500) : res.status(500).json({ ok:false });
  }
});

// ---- DELETE /:id (테스트용) ----
router.delete('/:id', async (req, res) => {
  try {
    const r = await BrandTest.findByIdAndDelete(req.params.id).lean();
    if (!r) return res.fail ? res.fail('NOT_FOUND', 404) : res.status(404).json({ ok:false });
    return res.ok ? res.ok({ deleted: true, id: req.params.id }) : res.json({ ok:true, deleted:true });
  } catch (err) {
    console.error('[brands-test DELETE/:id]', err);
    return res.fail ? res.fail('INTERNAL_ERROR', 500) : res.status(500).json({ ok:false });
  }
});

module.exports = router;