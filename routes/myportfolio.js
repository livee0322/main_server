// 📍 /routes/portfolio.js

const express = require("express");
const router = express.Router();
const authMiddleware = require("../src/middleware/auth");
const Portfolio = require("../models/Portfolio");

// ✅ 포트폴리오 등록 (POST)
router.post("/", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // 이미 등록된 포트폴리오가 있다면 등록 방지 (중복 방지용 - 선택 사항)
    const existing = await Portfolio.findOne({ user: userId });
    if (existing) {
      return res.status(400).json({ message: "이미 등록된 포트폴리오가 있습니다." });
    }

    const newPortfolio = new Portfolio({
      user: userId,
      ...req.body,
    });

    await newPortfolio.save();
    res.status(201).json({ message: "포트폴리오 등록 완료", data: newPortfolio });
  } catch (err) {
    console.error("❌ 포트폴리오 등록 오류:", err);
    res.status(500).json({ message: "서버 오류로 등록 실패" });
  }
});

// ✅ 내 포트폴리오 가져오기 (GET)
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

// ✅ 포트폴리오 수정 (PUT)
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const portfolioId = req.params.id;

    // 해당 포트폴리오가 본인의 것인지 확인
    const existing = await Portfolio.findOne({ _id: portfolioId, user: userId });
    if (!existing) {
      return res.status(404).json({ message: "수정할 포트폴리오가 없습니다." });
    }

    const updated = await Portfolio.findByIdAndUpdate(portfolioId, req.body, { new: true });
    res.status(200).json({ message: "포트폴리오 수정 완료", data: updated });
  } catch (err) {
    console.error("❌ 포트폴리오 수정 오류:", err);
    res.status(500).json({ message: "서버 오류로 수정 실패" });
  }
});

module.exports = router;