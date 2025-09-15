const mongoose = require('mongoose');

// 숏클립 데이터의 구조(스키마)를 정의합니다.
const shortsSchema = new mongoose.Schema(
    {
        // 필수 정보
        sourceUrl: { type: String, required: true, trim: true }, // 외부 영상 원본 URL
        provider: { type: String, enum: ['youtube', 'instagram', 'tiktok', 'etc'], required: true }, // 영상 플랫폼
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true }, // 등록한 사용자 ID

        // 선택 정보
        title: { type: String, trim: true }, // 영상 제목
        description: { type: String, trim: true }, // 영상 설명
        thumbnailUrl: { type: String, trim: true }, // 썸네일 이미지 URL

        // 상태 정보
        status: { type: String, enum: ['published', 'archived'], default: 'published', index: true },
    },
    { timestamps: true } // createdAt, updatedAt 타임스탬프 자동 생성
);

/**
 * @method ytId
 * @description YouTube URL에서 영상 ID를 추출합니다.
 */
function ytId(url = '') {
    const m = url.match(
        /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/
    );
    return m ? m[1] : '';
}

/**
 * @method igId
 * @description Instagram URL에서 영상 ID를 추출합니다.
 */
function igId(url = '') {
    const m = url.match(/instagram\.com\/(?:reel|p)\/([A-Za-z0-9_-]+)/);
    return m ? m[1] : '';
}

/**
 * @method tkId
 * @description TikTok URL에서 영상 ID를 추출합니다.
 */
function tkId(url = '') {
    const m = url.match(/tiktok\.com\/@[^/]+\/video\/(\d+)/);
    return m ? m[1] : '';
}

// 'embedUrl'이라는 가상 필드를 추가하여, 원본 URL을 퍼가기용 URL로 변환
shortsSchema.virtual('embedUrl').get(function () {
    const u = this.sourceUrl || '';
    switch (this.provider) {
        case 'youtube': {
            const id = ytId(u);
            return id ? `https://www.youtube.com/embed/${id}` : '';
        }
        case 'instagram': {
            const id = igId(u);
            return id ? `https://www.instagram.com/reel/${id}/embed` : '';
        }
        case 'tiktok': {
            const id = tkId(u);
            return id ? `https://www.tiktok.com/embed/v2/${id}` : '';
        }
        default:
            return '';
    }
});

// JSON으로 변환 시 가상 필드를 포함하도록 설정
shortsSchema.set('toJSON', { virtuals: true });

// 'Shorts' 모델을 생성하며, 실제 MongoDB에서는 'shorts-dev' 컬렉션을 사용하도록 지정
module.exports = mongoose.model('Shorts', shortsSchema, 'shorts-dev');