// routes/uploads.js
const router = require('express').Router();
const cloudinary = require('../src/lib/cloudinary');      // ← 설정 모듈
const auth = require('../src/middleware/auth');           // ← JWT 미들웨어
const requireRole = require('../src/middleware/requireRole'); // ← role 체크

const DEFAULT_FOLDER = process.env.CLOUDINARY_FOLDER || 'livee';

// 헬스체크(선택)
router.get('/ping', (_req, res) => res.json({ ok: true, message: 'uploads alive' }));

// 🔐 브랜드/관리자 전용: Cloudinary 서명 발급
router.get('/signature', auth, requireRole('brand', 'admin'), async (_req, res) => {
  try {
    const ts = Math.round(Date.now() / 1000);
    const paramsToSign = { timestamp: ts, folder: DEFAULT_FOLDER };

    const cfg = cloudinary.config(); // { cloud_name, api_key, api_secret, ... }
    if (!cfg.api_key || !cfg.api_secret || !cfg.cloud_name) {
      return res.status(500).json({
        ok: false,
        code: 'CLOUDINARY_ENV_MISSING',
        message: 'Cloudinary 환경변수가 설정되지 않았습니다.'
      });
    }

    const signature = cloudinary.utils.api_sign_request(paramsToSign, cfg.api_secret);

    return res.json({
      ok: true,
      data: {
        cloudName: cfg.cloud_name,
        apiKey: cfg.api_key,
        timestamp: ts,
        folder: DEFAULT_FOLDER,
        signature
      }
    });
  } catch (e) {
    console.error('[uploads/signature] error:', e);
    return res.status(500).json({ ok: false, code: 'CLOUDINARY_SIGN_FAIL', message: '서명 생성 실패' });
  }
});

module.exports = router;