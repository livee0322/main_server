// routes/portfolio.js
const express = require("express");
const router = express.Router();
const authMiddleware = require("../src/middleware/auth");// 토큰 인증 미들웨어

// Portfolio 모델 불러오기 (모델이 없다면 먼저 만들어야 함)
const Portfolio = require("../models/Portfolio");

// 저장
router.post("/", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const newPortfolio = new Portfolio({
      user: userId,
      ...req.body,
    });

    await newPortfolio.save();
    res.status(201).json({ message: "포트폴리오 저장 완료" });
  } catch (err) {
    console.error("포트폴리오 저장 오류:", err);
    res.status(500).json({ message: "서버 오류로 저장 실패" });
  }
});

module.exports = router;