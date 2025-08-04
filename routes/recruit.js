// routes/recruit.js

const express = require("express");
const router = express.Router();
const authMiddleware = require("../src/middleware/auth");
const Recruit = require("../models/Recruit");

// ✅ 모집공고 등록
router.post("/", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const newRecruit = new Recruit({ user: userId, ...req.body });
    await newRecruit.save();

    res.status(201).json({ message: "모집공고가 등록되었습니다." });
  } catch (err) {
    console.error("❌ 모집공고 등록 오류:", err);
    res.status(500).json({ message: "서버 오류로 등록 실패" });
  }
});

// ✅ 전체 모집공고 조회
router.get("/", async (req, res) => {
  try {
    const list = await Recruit.find().sort({ createdAt: -1 });
    res.status(200).json(list);
  } catch (err) {
    console.error("❌ 모집공고 조회 오류:", err);
    res.status(500).json({ message: "서버 오류" });
  }
});

module.exports = router;