// 📍 /routes/portfolio.js

const express = require("express");
const router = express.Router();
const authMiddleware = require("../src/middleware/auth");
const Portfolio = require("../models/Portfolio");

// ✅ 포트폴리오 저장
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

// ✅ 내 포트폴리오 가져오기 (GET /api/portfolio/me)
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const portfolio = await Portfolio.findOne({ user: userId });

    if (!portfolio) {
      return res.status(404).json({ message: "포트폴리오 없음" });
    }

    res.status(200).json(portfolio);
  } catch (err) {
    console.error("포트폴리오 조회 오류:", err);
    res.status(500).json({ message: "서버 오류" });
  }
});

// ✅ 전체 포트폴리오 조회 (공개된 것만, 쇼호스트 리스트용)
router.get("/all", async (req, res) => {
  try {
    const portfolios = await Portfolio.find({ isPublic: true }).sort({ createdAt: -1 });
    res.status(200).json(portfolios);
  } catch (err) {
    console.error("❌ 전체 포트폴리오 불러오기 오류:", err);
    res.status(500).json({ message: "서버 오류" });
  }
});

// ✅ 전체 포트폴리오 조회 (전체용, 테스트용으로 사용 가능)
router.get("/", async (req, res) => {
  try {
    const portfolios = await Portfolio.find().sort({ createdAt: -1 });
    res.status(200).json(portfolios);
  } catch (err) {
    console.error("❌ 전체 포트폴리오(ALL) 불러오기 오류:", err);
    res.status(500).json({ message: "서버 오류" });
  }
});

module.exports = router;