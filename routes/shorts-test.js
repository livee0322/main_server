// routes/shortsTest.route.js
const express = require('express');
const router  = express.Router();
const Short   = require('../models/Shorts-test');

// ---- utils: URL → provider/id → embedSrc ----
function parseShortUrl(raw){
  try{
    const u = new URL(raw);
    const host = u.hostname.replace(/^www\./,'');
    // YouTube
    if (host.includes('youtube.com') || host === 'youtu.be'){
      // cases: youtu.be/ID, youtube.com/shorts/ID, /watch?v=ID
      let id = '';
      if (host === 'youtu.be') {
        id = u.pathname.split('/')[1];
      } else if (u.pathname.startsWith('/shorts/')) {
        id = u.pathname.split('/')[2] || u.pathname.split('/')[1];
      } else if (u.pathname === '/watch') {
        id = u.searchParams.get('v') || '';
      }
      if (!id) throw new Error('YOUTUBE_ID_NOT_FOUND');
      return { provider:'youtube', id, embedSrc:`https://www.youtube.com/embed/${id}` };
    }

    // Instagram (reel / p)
    if (host.includes('instagram.com')){
      // ex) /reel/ID/ or /p/ID/
      const parts = u.pathname.split('/').filter(Boolean);
      const type = parts[0]; const id = parts[1];
      if ((type==='reel' || type==='p') && id){
        return { provider:'instagram', id, embedSrc:`https://www.instagram.com/${type}/${id}/embed` };
      }
      throw new Error('INSTAGRAM_ID_NOT_FOUND');
    }

    return { provider:'unknown', id:'', embedSrc: raw };
  }catch(e){
    return { provider:'unknown', id:'', embedSrc: raw };
  }
}

// ---- list ----
// GET /api/v1/shorts-test?status=published&limit=6&skip=0&sort=recent
router.get('/', async (req, res) => {
  try{
    const status = req.query.status || 'published';
    const limit  = Math.min(50, parseInt(req.query.limit || 10, 10));
    const skip   = Math.max(0, parseInt(req.query.skip || 0, 10));
    const sortq  = (req.query.sort === 'recent') ? { createdAt: -1 } : { createdAt: -1 };

    const [items, total] = await Promise.all([
      Short.find({ status }).sort(sortq).skip(skip).limit(limit).lean(),
      Short.countDocuments({ status })
    ]);

    res.json({ ok:true, data:{ items, total } });
  }catch(e){
    res.status(500).json({ ok:false, message:e.message || 'LIST_FAIL' });
  }
});

// GET single
router.get('/:id', async (req, res)=>{
  try{
    const it = await Short.findById(req.params.id).lean();
    if (!it) return res.status(404).json({ ok:false, message:'NOT_FOUND' });
    res.json(it);
  }catch(e){
    res.status(500).json({ ok:false, message:e.message || 'READ_FAIL' });
  }
});

// POST create
// body: { url, title?, status? }
router.post('/', async (req, res)=>{
  try{
    const { url, title='', status='published', tags=[] } = req.body || {};
    if (!url) return res.status(400).json({ ok:false, message:'URL_REQUIRED' });

    const meta = parseShortUrl(url);
    const doc = await Short.create({
      url, title, status, tags,
      provider: meta.provider,
      embedSrc: meta.embedSrc
    });
    res.status(201).json({ ok:true, data:doc });
  }catch(e){
    res.status(500).json({ ok:false, message:e.message || 'CREATE_FAIL' });
  }
});

// PATCH update
router.patch('/:id', async (req, res)=>{
  try{
    const body = { ...req.body };
    if (body.url){
      const meta = parseShortUrl(body.url);
      body.provider = meta.provider;
      body.embedSrc = meta.embedSrc;
    }
    const it = await Short.findByIdAndUpdate(req.params.id, body, { new:true }).lean();
    if (!it) return res.status(404).json({ ok:false, message:'NOT_FOUND' });
    res.json({ ok:true, data:it });
  }catch(e){
    res.status(500).json({ ok:false, message:e.message || 'UPDATE_FAIL' });
  }
});

// DELETE
router.delete('/:id', async (req, res)=>{
  try{
    await Short.findByIdAndDelete(req.params.id);
    res.json({ ok:true });
  }catch(e){
    res.status(500).json({ ok:false, message:e.message || 'DELETE_FAIL' });
  }
});

module.exports = router;