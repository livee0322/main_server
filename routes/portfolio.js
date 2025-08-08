const express = require("express");
const router = express.Router();
const authMiddleware = require("../src/middleware/auth"); // ✅ 경로 수정 완료
const Portfolio = require("../models/Portfolio");

// 🔹 내 포트폴리오 등록 (중복 방지)
router.post("/", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const exists = await Portfolio.findOne({ user: userId });
    if (exists) {
      return res.status(400).json({ message: "이미 등록된 포트폴리오가 있습니다." });
    }

    const newPortfolio = new Portfolio({
      user: userId,
      ...req.body
    });

    await newPortfolio.save();
    res.status(201).json({ message: "포트폴리오 등록 완료", data: newPortfolio });
  } catch (err) {
    console.error("❌ 포트폴리오 등록 오류:", err);
    res.status(500).json({ message: "서버 오류로 등록 실패" });
  }
});

// 🔹 내 포트폴리오 조회
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const portfolio = await Portfolio.findOne({ user: req.user.id });

    if (!portfolio) {
      return res.status(404).json({ message: "포트폴리오 없음" });
    }

    res.status(200).json(portfolio);
  } catch (err) {
    console.error("❌ 포트폴리오 조회 오류:", err);
    res.status(500).json({ message: "서버 오류" });
  }
});

// 🔹 전체 공개 포트폴리오 (쇼호스트 탭용)
router.get("/all", async (req, res) => {
  try {
    const portfolios = await Portfolio.find({ isPublic: true }).sort({ createdAt: -1 });
    res.status(200).json(portfolios);
  } catch (err) {
    console.error("❌ 전체 포트폴리오 불러오기 오류:", err);
    res.status(500).json({ message: "서버 오류" });
  }
});

// 🔹 포트폴리오 삭제
router.delete("/me", authMiddleware, async (req, res) => {
  try {
    const deleted = await Portfolio.findOneAndDelete({ user: req.user.id });

    if (!deleted) {
      return res.status(404).json({ message: "삭제할 포트폴리오가 없습니다." });
    }

    res.status(200).json({ message: "포트폴리오가 삭제되었습니다." });
  } catch (err) {
    console.error("❌ 포트폴리오 삭제 오류:", err);
    res.status(500).json({ message: "서버 오류" });
  }
});

module.exports = router;