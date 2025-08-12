// routes/uploads.js (refactored)
const router = require('express').Router();
const cloudinary = require('../src/lib/cloudinary');
const auth = require('../src/middleware/auth');
const requireRole = require('../src/middleware/requireRole');

const DEFAULT_FOLDER = process.env.CLOUDINARY_FOLDER || 'livee';

/** Cloudinary 자격증명 읽기 (CLOUDINARY_URL만 신뢰) */
function getCreds() {
  const cfg = cloudinary.config(); // v2가 CLOUDINARY_URL 자동 인식
  // 개별 키가 섞여 있을 경우 혼란 방지: URL만 사용하도록 강제
  const cloudName = cfg.cloud_name;
  const apiKey    = cfg.api_key;
  const apiSecret = cfg.api_secret;
  return { cloudName, apiKey, apiSecret };
}

/** 헬스체크 */
router.get('/ping', (_req, res) => res.json({ ok: true, message: 'uploads alive' }));

/** (옵션) 현재 자격증명 노출 없는 디버그 */
router.get('/debug', auth, requireRole('admin'), (_req, res) => {
  const { cloudName, apiKey, apiSecret } = getCreds();
  return res.json({
    ok: true,
    cloudName,
    apiKey,
    hasSecret: Boolean(apiSecret)
  });
});

/** 🔐 서명 발급 (brand/admin 전용) */
router.get('/signature', auth, requireRole('brand', 'admin'), async (_req, res) => {
  try {
    const { cloudName, apiKey, apiSecret } = getCreds();

    if (!cloudName || !apiKey || !apiSecret) {
      console.error('[uploads/signature] MISSING CREDS', {
        cloudName, hasApiKey: !!apiKey, hasApiSecret: !!apiSecret,
        hasUrl: !!process.env.CLOUDINARY_URL
      });
      return res.status(500).json({
        ok: false,
        code: 'CLOUDINARY_ENV_MISSING',
        message: 'Cloudinary 환경변수(CLOUDINARY_URL)가 올바르지 않습니다.'
      });
    }

    // timestamp는 초 단위, 5분 이내 유효 (클라이언트가 오래된 응답 캐시하지 않게)
    const timestamp = Math.floor(Date.now() / 1000);
    const folder = DEFAULT_FOLDER;

    // 클라이언트가 전송할 정확한 파라미터만 서명
    const paramsToSign = { timestamp, folder };
    const signature = cloudinary.utils.api_sign_request(paramsToSign, apiSecret);

    return res.json({
      ok: true,
      data: { cloudName, apiKey, timestamp, folder, signature }
    });
  } catch (err) {
    console.error('[uploads/signature] error:', err);
    return res.status(500).json({
      ok: false,
      code: 'CLOUDINARY_SIGN_FAIL',
      message: '서명 생성 실패'
    });
  }
});

module.exports = router;