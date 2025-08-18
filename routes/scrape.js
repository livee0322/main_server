//routes/scrape.js
const router = require('express').Router();
const axios = require('axios');
const cheerio = require('cheerio');
const sanitizeHtml = require('sanitize-html');

// 로깅 모델
let TrackEvent;
try {
  TrackEvent = require('../../models/TrackEvent'); // src/routes -> ../../models
} catch (e) {
  // 모델이 없더라도 서버가 죽지 않도록 no-op
  TrackEvent = mongooseFallback();
}

function mongooseFallback() {
  return { create: async () => {} };
}

function detectVendor(url = '') {
  if (/smartstore\.naver\.com/i.test(url)) return 'naver';
  if (/coupang\.com/i.test(url)) return 'coupang';
  if (/gmarket\.co\.kr/i.test(url)) return 'gmarket';
  if (/11st\.co\.kr/i.test(url)) return '11st';
  return 'unknown';
}

router.get('/', async (req, res) => {
  const url = String(req.query.url || '').trim();
  if (!url) return res.status(400).json({ ok: false, message: 'url is required' });

  const vendor = detectVendor(url);
  let result = { vendor, title: '', price: null, image: '', raw: {} };

  try {
    const { data: html } = await axios.get(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml'
      },
      timeout: 15000
    });

    const $ = cheerio.load(html);

    // 공통 메타 우선
    const ogTitle = $('meta[property="og:title"]').attr('content') || '';
    const ogImage = $('meta[property="og:image"]').attr('content') || '';
    const ogDesc  = $('meta[property="og:description"]').attr('content') || '';

    // 대략적인 가격 추출 (사이트마다 다르므로 best-effort)
    let price =
      $('meta[property="product:price:amount"]').attr('content') ||
      $('[class*="price"], [id*="price"]').first().text().replace(/[^\d]/g, '') ||
      null;

    if (price) price = Number(price) || null;

    const title = (ogTitle || $('title').text() || '').trim();
    const image = ogImage || '';

    result = {
      vendor,
      title,
      price,
      image,
      raw: {
        description: sanitizeHtml(ogDesc || ''),
      }
    };

    await TrackEvent.create({ type: 'scrape', url, vendor, ok: true, meta: { title, price } });

    return res.json({ ok: true, data: result });
  } catch (err) {
    await TrackEvent.create({
      type: 'scrape',
      url,
      vendor,
      ok: false,
      message: err?.message
    });
    return res.status(500).json({
      ok: false,
      message: 'SCRAPE_FAILED',
      detail: err?.message
    });
  }
});

module.exports = router;