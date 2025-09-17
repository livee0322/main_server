// server/routes/brands-test.js
const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

// ----- Schemas (route-local for test) -----
const OptionSchema = new mongoose.Schema({ name:String, price:{type:Number,default:0} },{_id:false});
const PriceSchema  = new mongoose.Schema({
  name: { type:String, trim:true, required:true },
  price:{ type:Number, default:0 },
  duration:{ type:String, trim:true },
  includes:[{ type:String, trim:true }],
  options:[OptionSchema],
  badge:{ type:String, trim:true },
},{ _id:false });

const FAQSchema = new mongoose.Schema({ q:{type:String,trim:true}, a:{type:String,trim:true} },{_id:false});
const ShortsSchema = new mongoose.Schema({
  sourceUrl:{ type:String, trim:true },
  provider: { type:String, trim:true },
  embedUrl: { type:String, trim:true },
  thumbnailUrl:{ type:String, trim:true },
},{ _id:false });

const RatingSchema = new mongoose.Schema({ avg:Number, count:Number },{ _id:false });
const MapSchema    = new mongoose.Schema({
  embedUrl:String, staticImage:String, link:String
},{ _id:false });

const BrandTestSchema = new mongoose.Schema({
  slug:   { type:String, trim:true, index:true, unique:true },
  type:   { type:String, default:'brand' },
  status: { type:String, default:'published' },

  name:     { type:String, trim:true, required:true },
  tagline:  { type:String, trim:true },
  location: { type:String, trim:true },
  hours:    { type:String, trim:true },

  hero: {
    image:{ type:String, trim:true, required:true },
    logo: { type:String, trim:true },
    images:[{ type:String, trim:true }] // NEW
  },

  contact: {
    phone:String, kakaoUrl:String, email:String
  },

  rating: RatingSchema,            // NEW
  description:{ type:String, trim:true }, // NEW
  rules:      { type:String, trim:true }, // NEW
  map:        MapSchema,                   // NEW

  studioPhotos:    [{ type:String, trim:true }],
  portfolioPhotos: [{ type:String, trim:true }],
  pricing: [PriceSchema],

  availability: {
    leadDays: { type:Number, default:0 },
    timeslots:[{ type:String, trim:true }],
    booked:   [{ type:String, trim:true }],
    closed:   [{ type:String, trim:true }],
  },

  faq:   [FAQSchema],
  policy:{ type:String, trim:true },
  shorts:[ShortsSchema],
}, { timestamps:true });

const BrandTest = mongoose.models.BrandTest || mongoose.model('BrandTest', BrandTestSchema);

// ----- helpers -----
const arr = (v)=> Array.isArray(v)? v : (v? [v] : []);
const pick = (o,keys)=> Object.fromEntries(keys.filter(k=>k in o).map(k=>[k,o[k]]));

// ----- GET /?slug=byhen&limit=1 -----
router.get('/', async (req,res)=>{
  try{
    const { slug, limit=20 } = req.query;
    if(slug){
      const doc = await BrandTest.findOne({ slug }).lean();
      if(!doc) return res.status(404).json({ ok:false, message:'NOT_FOUND' });
      return res.json({ ok:true, data:doc });
    }
    const items = await BrandTest.find({}).sort({ updatedAt:-1 }).limit(Number(limit)||20).lean();
    return res.json({ ok:true, items });
  }catch(err){
    console.error('[brands-test GET]', err);
    return res.status(500).json({ ok:false, message:'INTERNAL_ERROR' });
  }
});

// ----- GET /:id -----
router.get('/:id', async (req,res)=>{
  try{
    const doc = await BrandTest.findById(req.params.id).lean();
    if(!doc) return res.status(404).json({ ok:false, message:'NOT_FOUND' });
    return res.json({ ok:true, data:doc });
  }catch(err){
    console.error('[brands-test GET/:id]', err);
    return res.status(500).json({ ok:false, message:'INTERNAL_ERROR' });
  }
});

// ----- POST /  (slug upsert) -----
router.post('/', async (req,res)=>{
  try{
    const b = req.body || {};
    const slug = (b.slug || 'byhen').trim().toLowerCase();
    const name = (b.name || '').trim();
    const heroImg = b?.hero?.image || (Array.isArray(b?.hero?.images) && b.hero.images[0]);

    if(!name)     return res.status(400).json({ ok:false, message:'name required' });
    if(!heroImg)  return res.status(400).json({ ok:false, message:'hero.image required' });

    // normalize
    const payload = {
      slug,
      type:   b.type   || 'brand',
      status: b.status || 'published',
      name,
      tagline:  b.tagline,
      location: b.location,
      hours:    b.hours,
      hero: {
        image: heroImg,
        logo:  b?.hero?.logo,
        images: arr(b?.hero?.images).filter(Boolean)
      },
      contact: b.contact || {},
      rating:  b.rating || undefined,
      description: b.description || '',
      rules:       b.rules || '',
      map: (b.map && (b.map.embedUrl || b.map.staticImage || b.map.link)) ? b.map : undefined,

      studioPhotos:    arr(b.studioPhotos),
      portfolioPhotos: arr(b.portfolioPhotos),
      pricing:         arr(b.pricing),

      availability: {
        leadDays: Number(b?.availability?.leadDays || 0),
        timeslots: arr(b?.availability?.timeslots),
        booked:    arr(b?.availability?.booked),
        closed:    arr(b?.availability?.closed),
      },

      faq:    arr(b.faq),
      policy: b.policy || '',
      shorts: arr(b.shorts),
    };

    const doc = await BrandTest.findOneAndUpdate(
      { slug },
      { $set: payload },
      { new:true, upsert:true, setDefaultsOnInsert:true }
    ).lean();

    return res.status(201).json({ ok:true, data:doc });
  }catch(err){
    console.error('[brands-test POST]', err);
    const conflict = err?.code === 11000;
    return res.status(conflict?409:500).json({ ok:false, message: conflict?'ALREADY_EXISTS':'INTERNAL_ERROR' });
  }
});

// ----- PUT /:id -----
router.put('/:id', async (req,res)=>{
  try{
    const b = req.body || {};
    const allowed = [
      'name','tagline','location','hours','status','type',
      'hero','contact','rating','description','rules','map',
      'studioPhotos','portfolioPhotos','pricing',
      'availability','faq','policy','shorts'
    ];
    const toSet = pick(b, allowed);
    const doc = await BrandTest.findByIdAndUpdate(req.params.id, { $set: toSet }, { new:true }).lean();
    if(!doc) return res.status(404).json({ ok:false, message:'NOT_FOUND' });
    return res.json({ ok:true, data:doc });
  }catch(err){
    console.error('[brands-test PUT/:id]', err);
    return res.status(500).json({ ok:false, message:'INTERNAL_ERROR' });
  }
});

// ----- DELETE /:id (test only) -----
router.delete('/:id', async (req,res)=>{
  try{
    const r = await BrandTest.findByIdAndDelete(req.params.id).lean();
    if(!r) return res.status(404).json({ ok:false, message:'NOT_FOUND' });
    return res.json({ ok:true, deleted:true, id:req.params.id });
  }catch(err){
    console.error('[brands-test DELETE/:id]', err);
    return res.status(500).json({ ok:false, message:'INTERNAL_ERROR' });
  }
});

module.exports = router;