const express = require("express");
const router = express.Router();
const authMiddleware = require("../src/middleware/auth");

const Portfolio = require("../models/Portfolio");

// 👉 포트폴리오 저장
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


// ✅ [추가] 내 포트폴리오 불러오기
router.get("/mine", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const myPortfolio = await Portfolio.findOne({ user: userId });

    if (!myPortfolio) {
      return res.status(404).json({ message: "등록된 포트폴리오가 없습니다." });
    }

    res.json(myPortfolio);
  } catch (err) {
    console.error("포트폴리오 불러오기 오류:", err);
    res.status(500).json({ message: "서버 오류로 불러오기 실패" });
  }
});

module.exports = router;