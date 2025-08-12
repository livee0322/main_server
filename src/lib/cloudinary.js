// src/lib/cloudinary.js
require('dotenv').config();
const cloudinary = require('cloudinary').v2;

/**
 * 환경변수 우선순위:
 * - CLOUDINARY_URL=cloudinary://<API_KEY>:<API_SECRET>@<cloud_name>
 * - 또는 개별 변수 CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET
 */
const hasUrl = !!process.env.CLOUDINARY_URL;

if (!hasUrl &&
    (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET)) {
  console.warn('[cloudinary] 환경변수 누락: CLOUDINARY_URL 또는 개별 키들을 설정하세요.');
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || undefined,
  api_key: process.env.CLOUDINARY_API_KEY || undefined,
  api_secret: process.env.CLOUDINARY_API_SECRET || undefined,
  secure: true
});

// CLOUDINARY_URL 이 있으면 위 config는 보완용이며, v2가 자동으로 읽습니다.
module.exports = cloudinary;
