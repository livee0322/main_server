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

// 카테고리 한글 → 영문 코드 매핑
const categoryMap = {
  "뷰티": "beauty",
  "패션": "fashion",
  "식품": "food",
  "가전": "electronics",
  "생활/리빙": "lifestyle",
}

// 카테고리 영문 코드 → 한글 매핑 (역매핑)
const categoryReverseMap = {
  "beauty": "뷰티",
  "fashion": "패션",
  "food": "식품",
  "electronics": "가전",
  "lifestyle": "생활/리빙",
}

// 모집구분 한글 → 영문 코드 매핑
const prefixMap = {
  "쇼호스트모집": "showhost",
  "촬영스태프": "staff",
  "모델모집": "model",
  "기타모집": "other",
}

// 모집구분 영문 코드 → 한글 매핑 (역매핑)
const prefixReverseMap = {
  "showhost": "쇼호스트모집",
  "staff": "촬영스태프",
  "model": "모델모집",
  "other": "기타모집",
}

// 영문 코드를 한글로 변환하는 헬퍼 함수
const convertCategoryToKorean = (code) => {
  if (!code) return null
  // 이미 한글이면 그대로 반환
  if (categoryMap[code]) return code
  // 영문 코드면 한글로 변환
  return categoryReverseMap[code] || code
}

const convertPrefixToKorean = (code) => {
  if (!code) return null
  // 이미 한글이면 그대로 반환
  if (prefixMap[code]) return code
  // 영문 코드면 한글로 변환
  return prefixReverseMap[code] || code
}

// 문자열을 줄바꿈 기준으로 배열로 변환 (자격요건, 우대사항용)
const stringToArray = (str) => {
  if (!str) return []
  return str
    .split(/\n|\r\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

// DB Document를 API 응답 DTO(Data Transfer Object)로 변환하는 헬퍼
const toDTO = (doc) => {
  const o = (doc?.toObject ? doc.toObject() : doc) || {}
  const imageUrl = o.coverImageUrl || o.thumbnailUrl || ""
  const thumbnailUrl = o.thumbnailUrl || toThumb(imageUrl) || ""
  
  // 카테고리 영문 코드 변환
  const categoryCode = o.category ? categoryMap[o.category] || o.category : null
  const categoryName = o.category || null
  
  // 모집구분 영문 코드 변환
  const prefixCode = o.prefix ? prefixMap[o.prefix] || o.prefix : null
  const prefixName = o.prefix || null
  
  // 자격요건 및 우대사항 배열 변환
  const qualifications = o.recruit?.requirements ? stringToArray(o.recruit.requirements) : []
  const preferredQualifications = o.recruit?.preferred ? stringToArray(o.recruit.preferred) : []
  
  return { 
    ...o, 
    imageUrl, 
    thumbnailUrl, 
    id: o._id?.toString?.() || o.id,
    brand: o.brand,
    fee: o.fee,
    feeNegotiable: o.feeNegotiable,
    liveTime: o.liveTime,
    // 카테고리 영문 코드 변환
    category: categoryCode,
    categoryCode,
    categoryName,
    // 모집구분 영문 코드 변환
    prefix: prefixCode,
    prefixCode,
    prefixName,
    // 상세 내용 (content와 동일)
    detailedContent: o.content || "",
    // 브랜드 소개
    brandIntroduction: o.brandIntroduction || "",
    // 모집부문 상세 설명 (recruit.requirements와 동일)
    recruitmentSection: o.recruit?.requirements || "",
    // 자격요건 배열
    qualifications,
    // 우대사항 배열
    preferredQualifications,
    // 상품 이미지 URL (productThumbnailUrl 사용)
    productImageUrl: o.productThumbnailUrl || "",
  }
}

module.exports = {
  toThumb,
  toDTO,
  sanitize,
  formatDate,
  convertCategoryToKorean,
  convertPrefixToKorean,
}