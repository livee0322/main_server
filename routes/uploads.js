// routes/uploads.js
const router = require('express').Router();
const cloudinary = require('../src/lib/cloudinary');
const auth = require('../src/middleware/auth');
const requireRole = require('../src/middleware/requireRole');

// 헬스체크
router.get('/ping', (_req, res) => res.json({ ok: true }));

// 브랜드/관리자만 서명 발급 (timestamp-only)
router.get('/signature', auth, requireRole('brand','admin'), async (_req, res) => {
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

    // 디버깅에 도움되는 stringToSign 같이 내려주기(선택)
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