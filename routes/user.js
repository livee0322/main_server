// routes/user.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');

// 🔐 JWT 시크릿키
const JWT_SECRET = process.env.JWT_SECRET || 'livee_secret';

// ✅ 회원가입
router.post('/signup', async (req, res) => {
  try {
    const { email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: '이미 존재하는 이메일입니다.' });
    }

    const newUser = new User({ email, password });
    await newUser.save();

    res.status(201).json({ message: '회원가입 성공!' });
  } catch (error) {
    console.error('회원가입 오류:', error);
    res.status(500).json({ message: '서버 오류입니다.' });
  }
});

// ✅ 로그인
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user || user.password !== password) {
      return res.status(401).json({ message: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    }

    // JWT 발급
    const token = jwt.sign({ email: user.email, id: user._id }, JWT_SECRET, {
      expiresIn: '7d',
    });

    res.status(200).json({ message: '로그인 성공', token });
  } catch (error) {
    console.error('로그인 오류:', error);
    res.status(500).json({ message: '서버 오류입니다.' });
  }
});

module.exports = router;