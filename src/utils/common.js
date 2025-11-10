// Cloudinary 썸네일 URL 생성 헬퍼
const THUMB = process.env.CLOUDINARY_THUMB || "c_fill,g_auto,w_640,h_360,f_auto,q_auto"

const toThumb = (url = "") => {
  try {
    const [h, t] = String(url).split("/upload/")
    return t ? `${h}/upload/${THUMB}/${t}` : url
  } catch {
    return url
  }
}

// DB Document를 API 응답 DTO(Data Transfer Object)로 변환하는 헬퍼
const toDTO = (doc) => {
  const o = (doc?.toObject ? doc.toObject() : doc) || {}
  const imageUrl = o.coverImageUrl || o.thumbnailUrl || ""
  const thumbnailUrl = o.thumbnailUrl || toThumb(imageUrl) || ""
  
  return { 
    ...o, 
    imageUrl, 
    thumbnailUrl, 
    id: o._id?.toString?.() || o.id,
    brand: o.brand,
    fee: o.fee,
    feeNegotiable: o.feeNegotiable,
    liveTime: o.liveTime
  }
}

module.exports = {
  toThumb,
  toDTO,
}