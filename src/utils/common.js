// Cloudinary 썸네일 URL 생성 헬퍼
const THUMB = process.env.CLOUDINARY_THUMB || "c_fill,g_auto,w_640,h_360,f_auto,q_auto"
const sanitizeHtml = require("sanitize-html")

const toThumb = (url = "") => {
  try {
    const [h, t] = String(url).split("/upload/")
    return t ? `${h}/upload/${THUMB}/${t}` : url
  } catch {
    return url
  }
}

// HTML 콘텐츠를 안전하게 정리하는 헬퍼 함수
const sanitize = (html) =>
  sanitizeHtml(html || "", {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      "img",
      "h1",
      "h2",
      "u",
      "span",
      "figure",
      "figcaption",
    ]),
    allowedAttributes: {
      "*": ["style", "class", "id", "src", "href", "alt", "title"],
    },
    allowedSchemes: ["http", "https", "data", "mailto", "tel"],
  })

// 날짜를 'YYYY. MM. DD' 형식으로 변환하는 헬퍼 함수
const formatDate = (date) =>
  new Date(date)
    .toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
    .replace(/\s/g, "")
    .slice(0, -1)

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
  sanitize,
  formatDate,
}