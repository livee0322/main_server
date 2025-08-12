// routes/uploads.js
const router = require('express').Router();
const cloudinary = require('../src/lib/cloudinary');
const auth = require('../src/middleware/auth');
const requireRole = require('../src/middleware/requireRole');

const DEFAULT_FOLDER = process.env.CLOUDINARY_FOLDER || 'livee';

// 작은 유틸: CLOUDINARY_URL에서 cloud_name 추출 (fallback)
function parseCloudNameFromUrl(url) {
  try {
    // cloudinary://<key>:<secret>@<cloud_name>
    const at = url.split('@')[1];
    return at?.trim();
  } catch { return undefined; }
}

router.get('/ping', (_req, res) => res.json({ ok: true, message: 'uploads alive' }));

router.get('/signature', auth, requireRole('brand','admin'), async (_req, res) => {
  try {
    const ts = Math.round(Date.now() / 1000);
    const paramsToSign = { timestamp: ts, folder: DEFAULT_FOLDER };

    // 안전하게 환경값 모으기 (CLOUDINARY_URL 또는 개별 키)
    const cfg = cloudinary.config();
    const cloudName =
      cfg.cloud_name ||
      process.env.CLOUDINARY_CLOUD_NAME ||
      parseCloudNameFromUrl(process.env.CLOUDINARY_URL || '');

    const apiKey =
      cfg.api_key || process.env.CLOUDINARY_API_KEY;

    const apiSecret =
      cfg.api_secret || process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      console.error('[uploads/signature] CLOUDINARY ENV MISSING', {
        hasUrl: !!process.env.CLOUDINARY_URL,
        cloudName, hasApiKey: !!apiKey, hasApiSecret: !!apiSecret
      });
      return res.status(500).json({
        ok: false,
        code: 'CLOUDINARY_ENV_MISSING',
        message: 'Cloudinary 환경변수가 올바르지 않습니다. (cloud name / api key / secret 확인)'
      });
    }

    const signature = cloudinary.utils.api_sign_request(paramsToSign, apiSecret);

    return res.json({
      ok: true,
      data: { cloudName, apiKey, timestamp: ts, folder: DEFAULT_FOLDER, signature }
    });
  } catch (e) {
    console.error('[uploads/signature] error:', e);
    return res.status(500).json({ ok:false, code:'CLOUDINARY_SIGN_FAIL', message:'서명 생성 실패' });
  }
});

module.exports = router;