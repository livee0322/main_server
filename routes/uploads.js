// routes/uploads.js (Refactored to include 'showhost' role)
const router = require('express').Router();
const cloudinary = require('../src/lib/cloudinary');
const auth = require('../src/middleware/auth');
const requireRole = require('../src/middleware/requireRole');

// 헬스체크
router.get('/ping', (_req, res) => res.json({ ok: true }));

// 1. 'showhost' 역할을 허용 목록에 추가합니다.
router.get('/signature', auth, requireRole('brand', 'admin', 'showhost'), async (_req, res) => {
  try {
    const cfg = cloudinary.config(); // CLOUDINARY_URL 자동 인식
    const cloudName = cfg.cloud_name;
    const apiKey    = cfg.api_key;
    const apiSecret = cfg.api_secret;

    if (!cloudName || !apiKey || !apiSecret) {
      return res.status(500).json({ ok:false, message:'CLOUDINARY_URL 재확인 필요' });
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const paramsToSign = { timestamp };

    const stringToSign = Object.keys(paramsToSign)
      .sort()
      .map(k => `${k}=${paramsToSign[k]}`)
      .join('&');

    const signature = cloudinary.utils.api_sign_request(paramsToSign, apiSecret);

    return res.json({
      ok: true,
      data: { cloudName, apiKey, timestamp, signature, stringToSign }
    });
  } catch (err) {
    console.error('[uploads/signature] error:', err);
    return res.status(500).json({ ok:false, message:'서명 생성 실패' });
  }
});

module.exports = router;