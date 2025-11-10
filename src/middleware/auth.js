// /src/middleware/auth.js
const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.fail("AUTH_REQUIRED", 401);
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // decoded = { id: ... }
    next();
  } catch (err) {
    console.error("❌ auth 미들웨어 오류:", err);
    return res.fail("INVALID_TOKEN", 403);
  }
};