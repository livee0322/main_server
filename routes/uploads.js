const router = require('express').Router();
const cloudinary = require('../src/lib/cloudinary');
const auth = require('../src/middleware/auth');
const requireRole = require('../src/middleware/requireRole');

// 헬스체크
router.get('/ping', (_req, res) => res.json({ ok: true }));


router.get('/signature', auth, requireRole('brand', 'admin', 'showhost'), async (req, res) => {
  try {
    const cfg = cloudinary.config();
    const cloudName = cfg.cloud_name;
    const apiKey = cfg.api_key;
    const apiSecret = cfg.api_secret;

    if (!cloudName || !apiKey || !apiSecret) {
      return res.status(500).json({ ok: false, message: 'CLOUDINARY_URL 재확인 필요' });
    }

    const timestamp = Math.floor(Date.now() / 1000);

    // 요청의 쿼리 파라미터에서 업로드 타입을 확인. (기본값: 'image')
    const uploadType = req.query.type || 'image';

    let paramsToSign = { timestamp };

    // 업로드 타입이 'raw'인 경우, 서명에 resource_type과 폴더를 추가
    if (uploadType === 'raw') {
      paramsToSign.resource_type = 'raw';
      paramsToSign.folder = 'resumes'; // Cloudinary에 'resumes'라는 폴더에 저장
    }

    const signature = cloudinary.utils.api_sign_request(paramsToSign, apiSecret);

    // 응답 데이터에 서명에 사용된 파라미터를 함께 전달하여 프론트에서 활용
    return res.json({
      ok: true,
      data: {
        cloudName,
        apiKey,
        timestamp,
        signature,
        params: paramsToSign // 서명된 파라미터
      }
    });
  } catch (err) {
    console.error('[uploads/signature] error:', err);
    return res.status(500).json({ ok: false, message: '서명 생성 실패' });
  }
});

module.exports = router;