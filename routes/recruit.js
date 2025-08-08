const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const authMiddleware = require("../src/middleware/auth");
const Recruit = require("../models/Recruit");

// 📌 공고 등록
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

// 📌 공고 수정
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const recruitId = req.params.id;

    const recruit = await Recruit.findById(recruitId);
    if (!recruit) return res.status(404).json({ message: "공고를 찾을 수 없습니다." });

    if (recruit.user.toString() !== userId) {
      return res.status(403).json({ message: "수정 권한이 없습니다." });
    }

    Object.assign(recruit, req.body);
    await recruit.save();

    res.status(200).json({ message: "공고가 수정되었습니다." });
  } catch (err) {
    console.error("❌ 모집공고 수정 오류:", err);
    res.status(500).json({ message: "서버 오류로 수정 실패" });
  }
});

// 📌 전체 공고 조회 (ex: /api/recruit?user=abc123)
router.get("/", async (req, res) => {
  try {
    const { user } = req.query;
    const filter = user ? { user: new mongoose.Types.ObjectId(user) } : {};
    const list = await Recruit.find(filter).sort({ createdAt: -1 });
    res.status(200).json(list);
  } catch (err) {
    console.error("❌ 모집공고 조회 오류:", err);
    res.status(500).json({ message: "서버 오류" });
  }
});

// 📌 내 공고 조회
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const list = await Recruit.find({ user: userId }).sort({ createdAt: -1 });
    res.status(200).json(list);
  } catch (err) {
    console.error("❌ 내 공고 불러오기 오류:", err);
    res.status(500).json({ message: "서버 오류" });
  }
});

// 📌 단일 공고 조회 (ObjectId 유효성 검사 추가)
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // ObjectId 형식 확인
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "유효하지 않은 ID 형식" });
    }

    const recruit = await Recruit.findById(id);
    if (!recruit) return res.status(404).json({ message: "공고를 찾을 수 없습니다." });
    res.status(200).json(recruit);
  } catch (err) {
    console.error("❌ 단일 공고 조회 오류:", err);
    res.status(500).json({ message: "서버 오류" });
  }
});

// 📌 공고 삭제
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const recruitId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(recruitId)) {
      return res.status(400).json({ message: "유효하지 않은 ID 형식" });
    }

    const recruit = await Recruit.findById(recruitId);
    if (!recruit) return res.status(404).json({ message: "공고를 찾을 수 없습니다." });

    if (recruit.user.toString() !== userId) {
      return res.status(403).json({ message: "삭제 권한이 없습니다." });
    }

    await Recruit.deleteOne({ _id: recruitId });
    res.status(200).json({ message: "공고가 삭제되었습니다." });
  } catch (err) {
    console.error("❌ 공고 삭제 오류:", err);
    res.status(500).json({ message: "서버 오류" });
  }
});

module.exports = router;