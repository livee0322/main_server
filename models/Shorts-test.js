// models/Shorts-test.js
const mongoose = require('mongoose');

const ShortsSchema = new mongoose.Schema(
  {
    // 기본
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },

    // 공개 상태
    status: { type: String, enum: ['draft', 'published', 'archived'], default: 'published', index: true },
    isFeatured: { type: Boolean, default: false, index: true },

    // 소스
    provider: { type: String, enum: ['youtube', 'instagram', 'tiktok', 'etc'], required: true, index: true },
    sourceUrl: { type: String, required: true, trim: true },
    // 썸네일(선택)
    thumbnailUrl: { type: String, default: '' },
    durationSec: { type: Number },

    // 작성자/태그
    authorName: { type: String, default: '' },
    tags: { type: [String], default: [], index: true },

    // 노출/지표
    publishedAt: { type: Date, default: Date.now, index: true },
    metrics: {
      views: { type: Number, default: 0 },
      likes: { type: Number, default: 0 }
    }
  },
  { timestamps: true, collection: 'shorts' } // ← 컬렉션명을 명시(충돌 방지)
);

/* --- 가상 필드: embedUrl --- */
function ytId(url='') {
  // youtu.be/ID, youtube.com/watch?v=ID, /shorts/ID 모두 허용
  const m = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{6,})/
  );
  return m ? m[1] : '';
}
function igId(url='') {
  const m = url.match(/instagram\.com\/(?:reel|p)\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : '';
}
function tkId(url='') {
  const m = url.match(/tiktok\.com\/@[^/]+\/video\/(\d+)/);
  return m ? m[1] : '';
}

ShortsSchema.virtual('embedUrl').get(function () {
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

/* --- 인덱스/텍스트 검색 --- */
ShortsSchema.index({ title: 'text', description: 'text', tags: 'text' });
ShortsSchema.index({ status: 1, publishedAt: -1 });

/* --- 출력 정리 --- */
ShortsSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform(_doc, ret) {
    ret.id = ret._id;
    delete ret._id;
  }
});

module.exports = mongoose.model('ShortsTest', ShortsSchema);