const express = require("express");
const router = express.Router();
const authMiddleware = require("../src/middleware/auth");
const Portfolio = require("../models/Portfolio");

// ✅ 전체 포트폴리오 조회 (쇼호스트 리스트용)
router.get("/all", async (req, res) => {
  try {
    const portfolios = await Portfolio.find({ isPublic: true }).sort({ createdAt: -1 });
    res.status(200).json(portfolios);
  } catch (err) {
    console.error("❌ 전체 포트폴리오 불러오기 오류:", err);
    res.status(500).json({ message: "서버 오류" });
  }
});

// ✅ 내 포트폴리오 조회
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const portfolio = await Portfolio.findOne({ user: userId });

    if (!portfolio) {
      return res.status(404).json({ message: "포트폴리오 없음" });
    }

    res.status(200).json(portfolio);
  } catch (err) {
    console.error("❌ 포트폴리오 조회 오류:", err);
    res.status(500).json({ message: "서버 오류" });
  }
});

// ✅ 등록 또는 수정 (통합)
router.post("/", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const updatedPortfolio = await Portfolio.findOneAndUpdate(
      { user: userId },
      { ...req.body, user: userId },
      { new: true, upsert: true } // 없으면 새로 생성됨
    );

    res.status(200).json({ message: "포트폴리오 저장 완료", data: updatedPortfolio });
  } catch (err) {
    console.error("❌ 포트폴리오 저장 오류:", err);
    res.status(500).json({ message: "서버 오류로 저장 실패" });
  }
});

// ✅ 포트폴리오 삭제
router.delete("/me", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const deleted = await Portfolio.findOneAndDelete({ user: userId });

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