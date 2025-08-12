// src/lib/cloudinary.js
require('dotenv').config();
const cloudinary = require('cloudinary').v2;

// CLOUDINARY_URL 이 있으면 v2가 자동으로 읽습니다.
cloudinary.config({ secure: true });

// 개별 키 방식 쓰는 경우 아래 주석 해제:
// cloudinary.config({
//   cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
//   api_key: process.env.CLOUDINARY_API_KEY,
//   api_secret: process.env.CLOUDINARY_API_SECRET,
//   secure: true
// });

module.exports = cloudinary;