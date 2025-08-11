// routes/user.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;
const SALT_ROUNDS = Number(process.env.SALT_ROUNDS || 10);
if (!JWT_SECRET) {
  // 배포 전 반드시 설정 필요
  console.warn('[users] JWT_SECRET not set – set process.env.JWT_SECRET');
}

/** 공통: Authorization 헤더 검사 */
function requireAuth(req, res, next) {
  try {
    const h = req.headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : '';
    if (!token) {
      return res.status(401).json({ ok:false, code:'NO_TOKEN', message:'인증 토큰이 없습니다.' });
    }
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.id;
    req.userRole = payload.role;
    next();
  } catch (err) {
    return res.status(401).json({ ok:false, code:'INVALID_TOKEN', message:'유효하지 않은 토큰입니다.' });
  }
}

/**
 * POST /api/v1/users/signup
 * req: { name, email, password, role }
 * res: { ok:true, userId, role }
 */
router.post('/signup', async (req, res) => {
  try {
    let { name, email, password, role } = req.body || {};
    name = (name || '').trim();
    email = (email || '').trim().toLowerCase();
    password = password || '';
    role = (role || '').trim();

    if (!name || !email || !password || !role) {
      return res.status(400).json({ ok:false, code:'VALIDATION_FAILED', message:'필수 값 누락' });
    }
    if (!['brand', 'showhost'].includes(role)) {
      return res.status(400).json({ ok:false, code:'VALIDATION_FAILED', message:'role이 올바르지 않습니다' });
    }

    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(409).json({ ok:false, code:'DUPLICATE', message:'이미 가입된 이메일입니다.' });
    }

    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await User.create({ name, email, password: hash, role });

    return res.status(201).json({ ok:true, userId: user._id.toString(), role: user.role });
  } catch (err) {
    console.error('signup error:', err);
    return res.status(500).json({ ok:false, code:'INTERNAL_ERROR', message:'서버 오류' });
  }
});

/**
 * POST /api/v1/users/login
 * req: { email, password }
 * res: { ok:true, token, name, role }
 */
router.post('/login', async (req, res) => {
  try {
    let { email, password } = req.body || {};
    email = (email || '').trim().toLowerCase();
    password = password || '';

    if (!email || !password) {
      return res.status(400).json({ ok:false, code:'VALIDATION_FAILED', message:'이메일과 비밀번호는 필수입니다.' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ ok:false, code:'INVALID_CREDENTIALS', message:'이메일 또는 비밀번호가 잘못되었습니다.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ ok:false, code:'INVALID_CREDENTIALS', message:'이메일 또는 비밀번호가 잘못되었습니다.' });
    }

    const token = jwt.sign(
      { id: user._id.toString(), role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(200).json({ ok:true, token, name: user.name, role: user.role });
  } catch (err) {
    console.error('login error:', err);
    return res.status(500).json({ ok:false, code:'INTERNAL_ERROR', message:'서버 오류' });
  }
});

/**
 * GET /api/v1/users/me
 * header: Authorization: Bearer <JWT>
 * res: { ok:true, id, name, role }
 */
router.get('/me', requireAuth, async (req, res) => {
  try {
    const u = await User.findById(req.userId).select('_id name role');
    if (!u) return res.status(404).json({ ok:false, code:'NOT_FOUND', message:'사용자를 찾을 수 없습니다.' });
    return res.json({ ok:true, id: u._id.toString(), name: u.name, role: u.role });
  } catch (err) {
    console.error('me error:', err);
    return res.status(500).json({ ok:false, code:'INTERNAL_ERROR', message:'서버 오류' });
  }
});

module.exports = router;