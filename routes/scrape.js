const router = require('express').Router();
const axios = require('axios');
const cheerio = require('cheerio');

router.get('/product', async (req,res)=>{
  const { url } = req.query;
  if (!url) return res.fail('url required','VALIDATION_FAILED',422);
  try {
    const { data:html } = await axios.get(url, { timeout: 8000, headers: { 'User-Agent': 'Mozilla/5.0' } });
    const $ = cheerio.load(html);

    const title = $('meta[property="og:title"]').attr('content') || $('title').text().trim();
    const image = $('meta[property="og:image"]').attr('content');

    let price;
    $('script[type="application/ld+json"]').each((_,el)=>{
      try {
        const json = JSON.parse($(el).contents().text());
        const node = Array.isArray(json) ? json.find(x=>x.offers) : json;
        const offers = node?.offers;
        if (offers?.price) price = Number(offers.price);
        if (!price && offers?.priceSpecification?.price) price = Number(offers.priceSpecification.price);
      } catch {}
    });
    if (!price) price = Number($('meta[itemprop="price"]').attr('content')) || undefined;

    const host = new URL(url).hostname;
    const marketplace = /smartstore|naver/.test(host) ? 'smartstore'
                      : /coupang/.test(host) ? 'coupang'
                      : /gmarket/.test(host) ? 'gmarket' : 'etc';

    res.ok({ data: { title, imageUrl: image, price, marketplace } });
  } catch (e) {
    res.fail('SCRAPE_FAILED','SCRAPE_FAILED',502,{ detail: e.message });
  }
});

module.exports = router;