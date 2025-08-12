// routes/uploads.js
const router = require('express').Router();
const cloudinary = require('../src/lib/cloudinary');
const auth = require('../src/middleware/auth');
const requireRole = require('../src/middleware/requireRole');

// 헬스체크
router.get('/ping', (_req, res) => res.json({ ok: true }));

// ✅ brand/admin만 서명 발급. 서명에는 timestamp만 포함(가장 단순)
router.get('/signature', auth, requireRole('brand','admin'), async (_req, res) => {
  try {
    const { cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret } = cloudinary.config();
    if (!cloudName || !apiKey || !apiSecret) return res.status(500).json({ ok:false, message:'CLOUDINARY_URL 재확인 필요' });

    const timestamp = Math.floor(Date.now() / 1000);
    const paramsToSign = { timestamp };

    // ⬇️ 디버그용: 서버가 실제로 서명한 문자열/서명값을 함께 내려줌
    const stringToSign = Object.keys(paramsToSign).sort().map(k => `${k}=${paramsToSign[k]}`).join('&');
    const signature = cloudinary.utils.api_sign_request(paramsToSign, apiSecret);

    return res.json({ ok:true, data:{ cloudName, apiKey, timestamp, signature, stringToSign } }); // ⬅️ stringToSign 포함
  } catch (err) { ... }
});

module.exports = router;