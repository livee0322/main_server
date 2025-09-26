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

// YouTube URL에서 Video ID를 추출하는 유틸리티 함수
function ytId(url = '') {
    // youtu.be/ID, youtube.com/watch?v=ID, /shorts/ID 모두 허용
    const m = url.match(
        /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{6,})/
    );
    return m ? m[1] : '';
}

// YouTube/TikTok 등을 포함하도록 로직 확장
function detectVendor(url = '') {
    // [수정] 유튜브 탐지 로직 추가
    if (/youtube\.com|youtu\.be/i.test(url)) return 'youtube';
    if (/smartstore\.naver\.com/i.test(url)) return 'naver';
    if (/coupang\.com/i.test(url)) return 'coupang';
    if (/gmarket\.co\.kr/i.test(url)) return 'gmarket';
    if (/11st\.co\.kr/i.test(url)) return '11st';
    if (/instagram\.com/i.test(url)) return 'instagram'; // [추가] 인스타그램 탐지 로직
    if (/tiktok\.com/i.test(url)) return 'tiktok'; // [추가] 틱톡 탐지 로직
    return 'unknown';
}

router.get('/', async (req, res) => {
    const url = String(req.query.url || '').trim();
    if (!url)
        return res.status(400).json({ ok: false, message: 'url is required' });

    const vendor = detectVendor(url);
    let result = { vendor, title: '', price: null, image: '', raw: {} };

    try {
        const { data: html } = await axios.get(url, {
            headers: {
                'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
                Accept: 'text/html,application/xhtml+xml',
            },
            timeout: 15000,
        });

        const $ = cheerio.load(html);

        // 공통 메타 우선
        let ogTitle = $('meta[property="og:title"]').attr('content') || '';
        let ogImage = $('meta[property="og:image"]').attr('content') || '';
        const ogDesc =
            $('meta[property="og:description"]').attr('content') || '';

        // 대략적인 가격 추출 (사이트마다 다르므로 best-effort)
        let price =
            $('meta[property="product:price:amount"]').attr('content') ||
            $('[class*="price"], [id*="price"]')
                .first()
                .text()
                .replace(/[^\d]/g, '') ||
            null;

        if (price) price = Number(price) || null;

        // [추가] YouTube 숏클립/영상 썸네일 및 제목 보정 로직
        if (vendor === 'youtube') {
            const videoId = ytId(url); // 영상 ID 추출

            if (videoId) {
                // [추가] 썸네일 URL을 직접 생성 (YouTube 고정 포맷: maxresdefault.jpg)
                ogImage = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

                // [추가] OG 태그로 제목 추출이 실패했을 경우, <title> 태그에서 제목 재추출
                if (
                    !ogTitle ||
                    ogTitle.trim() === '- YouTube' ||
                    ogTitle.endsWith(' - YouTube')
                ) {
                    const pageTitle = $('title').text() || '';
                    // '영상 제목 - YouTube' 형식에서 ' - YouTube' 부분을 제거하여 제목만 추출
                    if (pageTitle.endsWith(' - YouTube')) {
                        ogTitle = pageTitle
                            .substring(0, pageTitle.lastIndexOf(' - YouTube'))
                            .trim();
                    } else {
                        ogTitle = pageTitle.trim();
                    }
                }
            }
        }

        const title = (ogTitle || $('title').text() || '').trim();
        const image = ogImage || '';

        result = {
            vendor,
            title,
            price,
            image,
            raw: {
                description: sanitizeHtml(ogDesc || ''),
            },
        };

        await TrackEvent.create({
            type: 'scrape',
            url,
            vendor,
            ok: true,
            meta: { title, price },
        });

        return res.json({ ok: true, data: result });
    } catch (err) {
        await TrackEvent.create({
            type: 'scrape',
            url,
            vendor,
            ok: false,
            message: err?.message,
        });
        return res.status(500).json({
            ok: false,
            message: 'SCRAPE_FAILED',
            detail: err?.message,
        });
    }
});

module.exports = router;
