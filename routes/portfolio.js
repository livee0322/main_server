const express = require("express");
const router = express.Router();
const authMiddleware = require("../src/middleware/auth"); // ✅ 경로 주의
const Portfolio = require("../models/Portfolio");

// 🔹 포트폴리오 등록 (중복 방지)
router.post("/", authMiddleware, async (req, res) => {
  try {
    const exists = await Portfolio.findOne({ user: req.user.id });
    if (exists) return res.status(400).json({ message: "이미 등록됨" });

    const portfolio = new Portfolio({ user: req.user.id, ...req.body });
    await portfolio.save();

    res.status(201).json({ message: "포트폴리오 등록 완료", data: portfolio });
  } catch (err) {
    console.error("❌ 등록 오류:", err);
    res.status(500).json({ message: "서버 오류" });
  }
});

// 🔹 내 포트폴리오 조회
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const portfolio = await Portfolio.findOne({ user: req.user.id });
    if (!portfolio) return res.status(404).json({ message: "포트폴리오 없음" });

    res.status(200).json(portfolio);
  } catch (err) {
    console.error("❌ 조회 오류:", err);
    res.status(500).json({ message: "서버 오류" });
  }
});

// 🔹 포트폴리오 수정
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const updated = await Portfolio.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      req.body,
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: "수정 실패" });

    res.status(200).json({ message: "수정 완료", data: updated });
  } catch (err) {
    console.error("❌ 수정 오류:", err);
    res.status(500).json({ message: "서버 오류" });
  }
});

// 🔹 포트폴리오 삭제
router.delete("/me", authMiddleware, async (req, res) => {
  try {
    const deleted = await Portfolio.findOneAndDelete({ user: req.user.id });
    if (!deleted) return res.status(404).json({ message: "삭제 실패" });

    res.status(200).json({ message: "삭제 완료" });
  } catch (err) {
    console.error("❌ 삭제 오류:", err);
    res.status(500).json({ message: "서버 오류" });
  }
});

// 🔹 전체 공개 포트폴리오 조회 (옵션)
router.get("/all", async (req, res) => {
  try {
    const list = await Portfolio.find({ isPublic: true }).sort({ createdAt: -1 });
    res.status(200).json(list);
  } catch (err) {
    console.error("❌ 전체 포트폴리오 조회 오류:", err);
    res.status(500).json({ message: "서버 오류" });
  }
});

module.exports = router;