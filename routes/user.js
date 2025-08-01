// ✅ 회원가입 및 로그인 라우터 - JSON 응답 통일
const express = require('express');
const router = express.Router();
const User = require('../models/User'); // 반드시 대소문자 정확히
const jwt = require('jsonwebtoken');

// 🔐 JWT 시크릿키 (환경변수 또는 기본값)
const JWT_SECRET = process.env.JWT_SECRET || 'livee_secret';

// ✅ 회원가입 라우터
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // 모든 항목 입력 여부 확인
    if (!name || !email || !password) {
      return res.status(400).json({ message: '모든 항목을 입력해주세요.' });
    }

    // 이메일 중복 확인
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: '이미 존재하는 이메일입니다.' });
    }

    // 사용자 생성 및 저장
    const newUser = new User({ name, email, password });
    await newUser.save();

    return res.status(201).json({ message: '회원가입 성공!' });
  } catch (error) {
    console.error('회원가입 오류:', error);
    return res.status(500).json({ message: '서버 오류입니다.' });
  }
});

// ✅ 로그인 라우터
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // 이메일/비밀번호 체크
    const user = await User.findOne({ email });
    if (!user || user.password !== password) {
      return res.status(401).json({ message: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    }

    // JWT 발급
    const token = jwt.sign({ email: user.email, id: user._id }, JWT_SECRET, {
      expiresIn: '7d',
    });

    return res.status(200).json({ message: '로그인 성공', token });
  } catch (error) {
    console.error('로그인 오류:', error);
    return res.status(500).json({ message: '서버 오류입니다.' });
  }
});

module.exports = router;
