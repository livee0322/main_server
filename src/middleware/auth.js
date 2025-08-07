// 📍 /middleware/auth.js (최종 수정본)
const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "인증이 필요합니다." });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ✅ 여기!!
    req.user = decoded; // decoded = { id: ... } 라고 가정

    next();
  } catch (err) {
    console.error("❌ auth 미들웨어 오류:", err);
    return res.status(403).json({ message: "유효하지 않은 토큰입니다." });
  }
};