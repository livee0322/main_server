// routes/uploads.js
const router = require('express').Router();
const cloudinary = require('cloudinary').v2;
const auth = require('../src/middleware/auth');
const requireRole = require('../src/middleware/requireRole');

const DEFAULT_FOLDER = process.env.CLOUDINARY_FOLDER || 'livee';

// 서명 발급 (브랜드/관리자만)
router.get('/signature', auth, requireRole('brand','admin'), async (req, res) => {
  try {
    const timestamp = Math.round(Date.now() / 1000);
    // 프론트에 노출될 파라미터만 포함 (preset 없이 서명 업로드)
    const paramsToSign = {
      timestamp,
      folder: DEFAULT_FOLDER,
    };

    // api_secret 은 서버에서만 사용됨
    const signature = cloudinary.utils.api_sign_request(
      paramsToSign,
      cloudinary.config().api_secret
    );

    return res.ok({
      cloudName: cloudinary.config().cloud_name,
      apiKey: cloudinary.config().api_key,
      timestamp,
      folder: DEFAULT_FOLDER,
      signature,
    });
  } catch (e) {
    return res.fail('서명 생성 실패', 'CLOUDINARY_SIGN_FAIL', 500);
  }
});

module.exports = router;