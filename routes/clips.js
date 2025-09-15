const router = require('express').Router();
const { body, validationResult } = require('express-validator');
const auth = require('../src/middleware/auth');
const Shorts = require('../models/Shorts');
const asyncHandler = require('../src/middleware/asyncHandler');

/**
 * @function detectProvider
 * @description URL을 분석하여 어느 플랫폼(youtube, instagram, tiktok)의 영상인지 식별
 * @param {string} url - 검사할 영상의 URL
 * @returns {string} - 'youtube', 'instagram', 'tiktok', 또는 'etc'
 */
const detectProvider = (url = '') => {
    if (/youtube\.com|youtu\.be/i.test(url)) return 'youtube';
    if (/instagram\.com/i.test(url)) return 'instagram';
    if (/tiktok\.com/i.test(url)) return 'tiktok';
    return 'etc';
};

/**
 * @route   POST /api/v1/clips
 * @desc    새로운 숏클립을 생성
 * @access  Private
 */
router.post(
    '/',
    auth, // 요청 헤더의 JWT 토큰을 확인하여 로그인된 사용자인지 검증
    [
        // 요청 본문의 'url' 필드가 유효한 URL 형식인지 확인합니다.
        body('url').isURL({ protocols: ['http', 'https'], require_protocol: true }),
        // 요청 본문의 'title'과 'description'은 선택사항이며, 문자열인지 확인
        body('title').optional().isString(),
        body('description').optional().isString(),
    ],
    asyncHandler(async (req, res) => {
        // 유효성 검사 결과에 에러가 있으면 422 상태 코드로 응답
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.fail('VALIDATION_FAILED', 422, { errors: errors.array() });
        }

        const { url, title, description } = req.body;
        const userId = req.user.id; // auth 미들웨어로부터 얻은 사용자 ID

        // URL을 분석하여 영상 제공 플랫폼을 결정
        const provider = detectProvider(url);

        // 데이터베이스에 저장할 숏클립 객체를 생성
        const newClip = {
            sourceUrl: url,
            provider,
            title,
            description,
            createdBy: userId,
        };

        // Shorts 모델을 사용하여 데이터베이스에 문서를 생성
        const created = await Shorts.create(newClip);

        // 성공적으로 생성되었음을 201 상태 코드와 함께 생성된 데이터를 응답
        return res.ok({ data: created }, 201);
    })
);

module.exports = router;