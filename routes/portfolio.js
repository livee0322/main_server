const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth");
const Portfolio = require("../models/Portfolio");

// 🔹 등록
router.post("/", authMiddleware, async (req, res) => {
  try {
    const exists = await Portfolio.findOne({ user: req.user.id });
    if (exists) return res.status(400).json({ message: "이미 등록됨" });

    const portfolio = new Portfolio({ user: req.user.id, ...req.body });
    await portfolio.save();
    res.status(201).json({ message: "포트폴리오 등록 완료", data: portfolio });
  } catch (err) {
    res.status(500).json({ message: "서버 오류" });
  }
});

// 🔹 내 정보 조회
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const portfolio = await Portfolio.findOne({ user: req.user.id });
    if (!portfolio) return res.status(404).json({ message: "없음" });
    res.status(200).json(portfolio);
  } catch {
    res.status(500).json({ message: "서버 오류" });
  }
});

// 🔹 수정
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const updated = await Portfolio.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      req.body,
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: "수정 실패" });
    res.status(200).json({ message: "수정 완료", data: updated });
  } catch {
    res.status(500).json({ message: "서버 오류" });
  }
});

// 🔹 삭제
router.delete("/me", authMiddleware, async (req, res) => {
  try {
    const deleted = await Portfolio.findOneAndDelete({ user: req.user.id });
    if (!deleted) return res.status(404).json({ message: "삭제 실패" });
    res.status(200).json({ message: "삭제 완료" });
  } catch {
    res.status(500).json({ message: "서버 오류" });
  }
});

module.exports = router;