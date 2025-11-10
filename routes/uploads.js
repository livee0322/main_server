const router = require("express").Router()
const cloudinary = require("../src/lib/cloudinary")
const auth = require("../src/middleware/auth")
const requireRole = require("../src/middleware/requireRole")
const asyncHandler = require("../src/middleware/asyncHandler")

// 헬스체크
router.get("/ping", (_req, res) => res.json({ ok: true }))


router.get("/signature", auth, requireRole("brand", "admin", "showhost"), asyncHandler(async (req, res) => {
  const cfg = cloudinary.config()
  const cloudName = cfg.cloud_name
  const apiKey = cfg.api_key
  const apiSecret = cfg.api_secret

  if (!cloudName || !apiKey || !apiSecret) {
    return res.fail("INTERNAL_ERROR", 500, { userMessage: "CLOUDINARY_URL 재확인 필요" })
  }

  const timestamp = Math.floor(Date.now() / 1000)
  const uploadType = req.query.type || "image"

  // [수정] 서명에 사용할 파라미터를 담는 객체입니다.
  let paramsToSign = { timestamp }

  // [수정] 업로드 타입이 'raw'인 경우, 'folder' 파라미터를 서명 대상에 추가합니다.
  // 이렇게 해야 프론트에서 folder와 함께 요청을 보낼 때 서명이 일치하게 됩니다.
  if (uploadType === "raw") {
    paramsToSign.folder = "resumes"
  }

  // Cloudinary 유틸리티를 사용하여 서명을 생성합니다.
  const signature = cloudinary.utils.api_sign_request(paramsToSign, apiSecret)

  // [추가] 프론트엔드에 응답으로 전달할 전체 파라미터 객체입니다.
  let responseData = {
    cloudName,
    apiKey,
    timestamp,
    signature,
    ...paramsToSign, // folder가 있다면 여기에 포함됩니다.
  }

  // [추가] 'raw' 타입의 경우, 서명에는 포함되지 않지만 업로드 시 필요한 'resource_type'을 추가합니다.
  if (uploadType === "raw") {
    responseData.resource_type = "raw"
  }

  // 최종 응답을 반환합니다.
  return res.json({ ok: true, data: responseData })
}))

module.exports = router