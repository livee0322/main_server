// Cloudinary 썸네일 URL 생성 헬퍼
const THUMB = process.env.CLOUDINARY_THUMB || 'c_fill,g_auto,w_640,h_360,f_auto,q_auto';

const toThumb = (url = '') => {
  try {
    const [h, t] = String(url).split('/upload/');
    return t ? `${h}/upload/${THUMB}/${t}` : url;
  } catch {
    return url;
  }
};

// DB Document를 API 응답 DTO(Data Transfer Object)로 변환하는 헬퍼
const toDTO = (doc) => {
  const o = (doc?.toObject ? doc.toObject() : doc) || {};
  const imageUrl = o.coverImageUrl || o.thumbnailUrl || '';
  const thumbnailUrl = o.thumbnailUrl || toThumb(imageUrl) || '';
  // _id 필드를 id 문자열로 변환하여 프론트엔드 호환성 증대
  return { ...o, imageUrl, thumbnailUrl, id: o._id?.toString?.() || o.id };
};

module.exports = {
  toThumb,
  toDTO,
};